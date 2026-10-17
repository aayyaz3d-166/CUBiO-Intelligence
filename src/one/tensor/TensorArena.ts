/**
 * CUBiO AI — ONE LANGUAGE — TENSOR MEMORY ARENA
 * ==============================================
 * Module: @one/tensor/TensorArena
 * Gate: ONE-02 / Numeric Foundation for Training
 *
 * Implements a high-performance, slab-based memory arena for Tensors with:
 *   - Dedicated hard safety limit (fails closed before host memory exhaustion).
 *   - Isolated accounting independent of system RSS guards.
 *   - Bump-pointer allocation for O(1) allocation speed.
 *   - Free list & slab recycling for zero-allocation buffer reuse.
 *   - Lexical scope lifetime tracking (scope stacks) for ephemeral tensor reclamation.
 *   - Comprehensive watermark & peak memory telemetry.
 */

import { Tensor } from './Tensor';

export class TensorArenaOOMError extends Error {
  constructor(requestedBytes: number, currentBytes: number, limitBytes: number) {
    super(
      `[TensorArenaOOMError] Allocation of ${(requestedBytes / (1024 * 1024)).toFixed(2)} MB rejected. ` +
      `Current active: ${(currentBytes / (1024 * 1024)).toFixed(2)} MB, Hard Limit: ${(limitBytes / (1024 * 1024)).toFixed(2)} MB.`
    );
    this.name = 'TensorArenaOOMError';
  }
}

export interface ArenaStats {
  allocatedBytes: number;
  activeBytes: number;
  peakBytes: number;
  limitBytes: number;
  totalAllocations: number;
  totalReuses: number;
  slabCount: number;
  activeScopes: number;
}

export interface TensorArenaConfig {
  /** Hard safety ceiling in bytes (default: 128 MB) */
  maxBytes?: number;
  /** Size of each allocated memory slab in bytes (default: 16 MB) */
  slabSizeBytes?: number;
  /** Alignment in elements (Float32 = 4 bytes; default: 8 elements = 32 bytes) */
  alignmentElements?: number;
}

interface MemorySlab {
  id: number;
  buffer: ArrayBuffer;
  floatView: Float32Array;
  capacityElements: number;
  usedElements: number;
}

export class TensorMemoryArena {
  public readonly maxBytes: number;
  public readonly slabSizeBytes: number;
  public readonly alignment: number;

  private slabs: MemorySlab[] = [];
  private currentSlabIndex: number = 0;
  private nextSlabId: number = 0;

  // Telemetry & Accounting
  private allocatedBytes: number = 0;
  private activeBytes: number = 0;
  private peakBytes: number = 0;
  private totalAllocations: number = 0;
  private totalReuses: number = 0;

  // Scope Stack for Automatic Lifetime Tracking
  private scopeStack: Array<{ slabIndex: number; slabOffset: number; activeBytesCheckpoint: number }> = [];

  // Free-List Buffer Cache by element count for exact reuse
  private freeList: Map<number, Float32Array[]> = new Map();

  constructor(config: TensorArenaConfig = {}) {
    this.maxBytes = config.maxBytes ?? 128 * 1024 * 1024; // 128 MB default limit
    this.slabSizeBytes = config.slabSizeBytes ?? 16 * 1024 * 1024; // 16 MB default slab
    this.alignment = config.alignmentElements ?? 8; // 32-byte cache-line alignment

    if (this.slabSizeBytes > this.maxBytes) {
      throw new Error(`Slab size (${this.slabSizeBytes}) cannot exceed arena maxBytes (${this.maxBytes})`);
    }

    // Allocate initial slab
    this.allocateNewSlab();
  }

  /**
   * Allocates a new physical slab within hard safety constraints.
   */
  private allocateNewSlab(minBytes?: number): MemorySlab {
    const bytesToAllocate = Math.max(this.slabSizeBytes, minBytes ?? this.slabSizeBytes);
    if (this.allocatedBytes + bytesToAllocate > this.maxBytes) {
      throw new TensorArenaOOMError(bytesToAllocate, this.allocatedBytes, this.maxBytes);
    }

    const buffer = new ArrayBuffer(bytesToAllocate);
    const floatView = new Float32Array(buffer);
    const slab: MemorySlab = {
      id: this.nextSlabId++,
      buffer,
      floatView,
      capacityElements: floatView.length,
      usedElements: 0,
    };

    this.slabs.push(slab);
    this.allocatedBytes += bytesToAllocate;
    return slab;
  }

  /**
   * Allocates a contiguous Float32Array buffer for the requested number of elements.
   * Leverages free-list reuse when available; otherwise bump-allocates on the active slab.
   */
  public allocate(numElements: number): { data: Float32Array; offset: number } {
    if (numElements <= 0) {
      throw new Error(`Requested allocation size must be positive, got ${numElements}`);
    }

    const alignedElements = Math.ceil(numElements / this.alignment) * this.alignment;
    const requiredBytes = alignedElements * Float32Array.BYTES_PER_ELEMENT;

    // Check Free-List Cache for reusable buffer
    const cached = this.freeList.get(alignedElements);
    if (cached && cached.length > 0) {
      const reusedBuffer = cached.pop()!;
      this.totalReuses++;
      this.totalAllocations++;
      this.activeBytes += requiredBytes;
      if (this.activeBytes > this.peakBytes) this.peakBytes = this.activeBytes;
      return { data: reusedBuffer, offset: 0 };
    }

    // Verify against hard limit
    if (this.activeBytes + requiredBytes > this.maxBytes) {
      throw new TensorArenaOOMError(requiredBytes, this.activeBytes, this.maxBytes);
    }

    // Try current slab
    let slab = this.slabs[this.currentSlabIndex];
    if (!slab || slab.usedElements + alignedElements > slab.capacityElements) {
      // Find next slab with capacity or allocate new one
      let found = false;
      for (let i = 0; i < this.slabs.length; i++) {
        if (this.slabs[i].capacityElements - this.slabs[i].usedElements >= alignedElements) {
          this.currentSlabIndex = i;
          slab = this.slabs[i];
          found = true;
          break;
        }
      }

      if (!found) {
        slab = this.allocateNewSlab(requiredBytes);
        this.currentSlabIndex = this.slabs.length - 1;
      }
    }

    const offset = slab.usedElements;
    slab.usedElements += alignedElements;

    this.activeBytes += requiredBytes;
    if (this.activeBytes > this.peakBytes) {
      this.peakBytes = this.activeBytes;
    }
    this.totalAllocations++;

    return {
      data: slab.floatView,
      offset,
    };
  }

  /**
   * Allocates a Tensor of given shape from the arena.
   */
  public allocateTensor(shape: number[]): Tensor {
    const size = shape.reduce((a, b) => a * b, 1);
    const { data, offset } = this.allocate(size);
    // Initialize data slice to zero
    data.fill(0, offset, offset + size);
    return new Tensor(data, shape, undefined, offset);
  }

  /**
   * Recycles a tensor buffer into the free-list for immediate reuse.
   */
  public free(tensor: Tensor): void {
    if (!tensor.isContiguous()) return;
    const alignedElements = Math.ceil(tensor.size / this.alignment) * this.alignment;
    const bytes = alignedElements * Float32Array.BYTES_PER_ELEMENT;

    let bucket = this.freeList.get(alignedElements);
    if (!bucket) {
      bucket = [];
      this.freeList.set(alignedElements, bucket);
    }

    // If tensor occupies a standalone slice or subview
    const slice = tensor.data.subarray(tensor.offset, tensor.offset + alignedElements);
    bucket.push(slice);

    this.activeBytes = Math.max(0, this.activeBytes - bytes);
  }

  /**
   * Resets bump-pointer allocation offsets on all slabs to zero.
   * Retains allocated slabs for fast future reuse without host memory reallocation.
   */
  public reset(): void {
    for (const slab of this.slabs) {
      slab.usedElements = 0;
    }
    this.currentSlabIndex = 0;
    this.activeBytes = 0;
    this.freeList.clear();
    this.scopeStack = [];
  }

  /**
   * Enters a lexical scope checkpoint.
   */
  public enterScope(): void {
    const slab = this.slabs[this.currentSlabIndex];
    this.scopeStack.push({
      slabIndex: this.currentSlabIndex,
      slabOffset: slab ? slab.usedElements : 0,
      activeBytesCheckpoint: this.activeBytes,
    });
  }

  /**
   * Exits current lexical scope, rolling back bump pointers to checkpoint.
   * Tensors allocated during the scope are immediately reclaimed.
   */
  public exitScope(): void {
    const checkpoint = this.scopeStack.pop();
    if (!checkpoint) return;

    // Rollback slabs allocated after the checkpoint
    for (let i = checkpoint.slabIndex + 1; i < this.slabs.length; i++) {
      this.slabs[i].usedElements = 0;
    }

    this.currentSlabIndex = checkpoint.slabIndex;
    if (this.slabs[this.currentSlabIndex]) {
      this.slabs[this.currentSlabIndex].usedElements = checkpoint.slabOffset;
    }
    this.activeBytes = checkpoint.activeBytesCheckpoint;
  }

  /**
   * Executes a callback within a managed scope, automatically reclaiming
   * ephemeral tensors upon completion while preserving the returned value.
   */
  public scope<T>(fn: () => T): T {
    this.enterScope();
    try {
      const result = fn();
      return result;
    } finally {
      this.exitScope();
    }
  }

  /**
   * Returns complete telemetry and lifetime statistics.
   */
  public stats(): ArenaStats {
    return {
      allocatedBytes: this.allocatedBytes,
      activeBytes: this.activeBytes,
      peakBytes: this.peakBytes,
      limitBytes: this.maxBytes,
      totalAllocations: this.totalAllocations,
      totalReuses: this.totalReuses,
      slabCount: this.slabs.length,
      activeScopes: this.scopeStack.length,
    };
  }
}
