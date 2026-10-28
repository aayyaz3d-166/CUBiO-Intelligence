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
    constructor(requestedBytes, currentBytes, limitBytes) {
        super(`[TensorArenaOOMError] Allocation of ${(requestedBytes / (1024 * 1024)).toFixed(2)} MB rejected. ` +
            `Current active: ${(currentBytes / (1024 * 1024)).toFixed(2)} MB, Hard Limit: ${(limitBytes / (1024 * 1024)).toFixed(2)} MB.`);
        this.name = 'TensorArenaOOMError';
    }
}
export class TensorMemoryArena {
    maxBytes;
    slabSizeBytes;
    alignment;
    slabs = [];
    currentSlabIndex = 0;
    nextSlabId = 0;
    // Telemetry & Accounting
    allocatedBytes = 0;
    activeBytes = 0;
    peakBytes = 0;
    totalAllocations = 0;
    totalReuses = 0;
    // Scope Stack for Automatic Lifetime Tracking
    scopeStack = [];
    // Free-List Buffer Cache by element count for exact reuse
    freeList = new Map();
    constructor(config = {}) {
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
    allocateNewSlab(minBytes) {
        const bytesToAllocate = Math.max(this.slabSizeBytes, minBytes ?? this.slabSizeBytes);
        if (this.allocatedBytes + bytesToAllocate > this.maxBytes) {
            throw new TensorArenaOOMError(bytesToAllocate, this.allocatedBytes, this.maxBytes);
        }
        const buffer = new ArrayBuffer(bytesToAllocate);
        const floatView = new Float32Array(buffer);
        const slab = {
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
    allocate(numElements) {
        if (numElements <= 0) {
            throw new Error(`Requested allocation size must be positive, got ${numElements}`);
        }
        const alignedElements = Math.ceil(numElements / this.alignment) * this.alignment;
        const requiredBytes = alignedElements * Float32Array.BYTES_PER_ELEMENT;
        // Check Free-List Cache for reusable buffer
        const cached = this.freeList.get(alignedElements);
        if (cached && cached.length > 0) {
            const reusedBuffer = cached.pop();
            this.totalReuses++;
            this.totalAllocations++;
            this.activeBytes += requiredBytes;
            if (this.activeBytes > this.peakBytes)
                this.peakBytes = this.activeBytes;
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
    allocateTensor(shape) {
        const size = shape.reduce((a, b) => a * b, 1);
        const { data, offset } = this.allocate(size);
        // Initialize data slice to zero
        data.fill(0, offset, offset + size);
        return new Tensor(data, shape, undefined, offset);
    }
    /**
     * Recycles a tensor buffer into the free-list for immediate reuse.
     */
    free(tensor) {
        if (!tensor.isContiguous())
            return;
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
    reset() {
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
    enterScope() {
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
    exitScope() {
        const checkpoint = this.scopeStack.pop();
        if (!checkpoint)
            return;
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
    scope(fn) {
        this.enterScope();
        try {
            const result = fn();
            return result;
        }
        finally {
            this.exitScope();
        }
    }
    /**
     * Returns complete telemetry and lifetime statistics.
     */
    stats() {
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
