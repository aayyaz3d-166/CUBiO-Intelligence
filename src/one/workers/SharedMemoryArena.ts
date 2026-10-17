/**
 * CUBiO AI — ONE LANGUAGE — WORKER PARALLELISM & SHARED MEMORY
 * ==============================================================
 * Module: @one/workers/SharedMemoryArena
 * Gate: ONE-06 / SharedArrayBuffer & Multi-Worker Memory Management
 *
 * Implements an authoritative zero-copy shared memory arena built directly
 * on JavaScript SharedArrayBuffer and Atomics synchronization.
 *
 * Provides:
 *   1. Shared model weights slice (zero IPC serialization overhead).
 *   2. Per-worker partitioned gradient slices for concurrent execution.
 *   3. Shared accumulated gradient reduction buffer.
 *   4. Control header with Atomics mutex, barrier, status, and sequence counters.
 *   5. Shared Tensor workspace for parallel tensor operations (chunked matmul, reduction).
 *   6. Strict fixed-order deterministic gradient reduction.
 */

import { Tensor } from '../tensor/Tensor';

export interface SharedArenaConfig {
  parameterCount: number;      // e.g. 148,912 parameters
  maxWorkers?: number;         // Max concurrent worker threads (default: 8)
  workspaceElements?: number;  // Elements for parallel tensor workspace (default: 262,144)
}

export interface SharedArenaLayout {
  totalBytes: number;
  headerBytes: number;
  headerOffset: number;
  weightsOffset: number;
  weightsLength: number;
  accumGradOffset: number;
  accumGradLength: number;
  workerGradOffset: number;
  workerGradLengthPerWorker: number;
  maxWorkers: number;
  workspaceOffset: number;
  workspaceLength: number;
}

// Control Header Slot Indices (in 32-bit integers)
export const HEADER_SLOTS = {
  MUTEX_LOCK: 0,          // 0 = unlocked, 1 = locked
  BARRIER_ARRIVED: 1,     // Workers arrived at current barrier
  BARRIER_GEN: 2,         // Generation counter to avoid barrier races
  CURRENT_SEQUENCE: 3,    // 369-harmonic sequence index
  ACTIVE_WORKERS: 4,      // Number of active workers
  GLOBAL_STEP: 5,         // Global training step count
  STATUS_BASE: 8,         // Status slots for workers 0..31 (0=IDLE, 1=BUSY, 2=DONE, 3=ERROR)
  METRICS_BASE: 40,       // Loss, throughput, telemetry slots
};

export const WORKER_STATUS = {
  IDLE: 0,
  BUSY: 1,
  DONE: 2,
  ERROR: 3,
};

export class SharedMemoryArena {
  public readonly sab: SharedArrayBuffer;
  public readonly layout: SharedArenaLayout;

  // Views on SharedArrayBuffer
  public readonly header: Int32Array;
  public readonly weights: Float32Array;
  public readonly accumulatedGradients: Float32Array;
  public readonly workspace: Float32Array;

  // Per-worker gradient views
  private workerGradients: Float32Array[] = [];

  constructor(config: SharedArenaConfig) {
    const maxWorkers = Math.max(1, Math.min(32, config.maxWorkers ?? 8));
    const parameterCount = config.parameterCount;
    const workspaceElements = config.workspaceElements ?? 262144; // ~1 MB

    // Align all offsets to 64-byte boundaries (cache line aligned)
    const align64 = (bytes: number) => (bytes + 63) & ~63;

    const headerBytes = 256 * 4; // 1024 bytes for 256 Int32 control slots
    let currentOffset = align64(headerBytes);

    const weightsOffset = currentOffset;
    const weightsBytes = parameterCount * 4;
    currentOffset = align64(currentOffset + weightsBytes);

    const accumGradOffset = currentOffset;
    const accumGradBytes = parameterCount * 4;
    currentOffset = align64(currentOffset + accumGradBytes);

    const workerGradOffset = currentOffset;
    const workerGradBytes = maxWorkers * parameterCount * 4;
    currentOffset = align64(currentOffset + workerGradBytes);

    const workspaceOffset = currentOffset;
    const workspaceBytes = workspaceElements * 4;
    currentOffset = align64(currentOffset + workspaceBytes);

    const totalBytes = currentOffset;

    this.layout = {
      totalBytes,
      headerBytes,
      headerOffset: 0,
      weightsOffset,
      weightsLength: parameterCount,
      accumGradOffset,
      accumGradLength: parameterCount,
      workerGradOffset,
      workerGradLengthPerWorker: parameterCount,
      maxWorkers,
      workspaceOffset,
      workspaceLength: workspaceElements,
    };

    this.sab = new SharedArrayBuffer(totalBytes);

    // Initialize typed views on the SharedArrayBuffer
    this.header = new Int32Array(this.sab, 0, headerBytes / 4);
    this.weights = new Float32Array(this.sab, weightsOffset, parameterCount);
    this.accumulatedGradients = new Float32Array(this.sab, accumGradOffset, parameterCount);
    this.workspace = new Float32Array(this.sab, workspaceOffset, workspaceElements);

    // Initialize per-worker gradient slices
    for (let k = 0; k < maxWorkers; k++) {
      const offset = workerGradOffset + k * parameterCount * 4;
      this.workerGradients.push(new Float32Array(this.sab, offset, parameterCount));
    }

    // Set initial header values
    Atomics.store(this.header, HEADER_SLOTS.MUTEX_LOCK, 0);
    Atomics.store(this.header, HEADER_SLOTS.BARRIER_ARRIVED, 0);
    Atomics.store(this.header, HEADER_SLOTS.BARRIER_GEN, 0);
    Atomics.store(this.header, HEADER_SLOTS.CURRENT_SEQUENCE, 0);
    Atomics.store(this.header, HEADER_SLOTS.ACTIVE_WORKERS, maxWorkers);
    Atomics.store(this.header, HEADER_SLOTS.GLOBAL_STEP, 0);

    for (let k = 0; k < maxWorkers; k++) {
      Atomics.store(this.header, HEADER_SLOTS.STATUS_BASE + k, WORKER_STATUS.IDLE);
    }
  }

  /**
   * Factory method to reconstruct an arena instance from an existing SharedArrayBuffer.
   * Used inside worker threads to share the identical memory space.
   */
  public static fromExistingBuffer(sab: SharedArrayBuffer, layout: SharedArenaLayout): SharedMemoryArena {
    const arena = Object.create(SharedMemoryArena.prototype) as SharedMemoryArena;
    (arena as any).sab = sab;
    (arena as any).layout = layout;
    (arena as any).header = new Int32Array(sab, 0, layout.headerBytes / 4);
    (arena as any).weights = new Float32Array(sab, layout.weightsOffset, layout.weightsLength);
    (arena as any).accumulatedGradients = new Float32Array(sab, layout.accumGradOffset, layout.accumGradLength);
    (arena as any).workspace = new Float32Array(sab, layout.workspaceOffset, layout.workspaceLength);

    const workerGrads: Float32Array[] = [];
    for (let k = 0; k < layout.maxWorkers; k++) {
      const offset = layout.workerGradOffset + k * layout.workerGradLengthPerWorker * 4;
      workerGrads.push(new Float32Array(sab, offset, layout.workerGradLengthPerWorker));
    }
    (arena as any).workerGradients = workerGrads;
    return arena;
  }

  /**
   * Returns a zero-copy Tensor view over the shared weights.
   */
  public getWeightsTensor(shape: number[]): Tensor {
    return new Tensor(this.weights, shape);
  }

  /**
   * Returns a zero-copy Tensor view over the shared accumulated gradients.
   */
  public getGradientsTensor(shape: number[]): Tensor {
    return new Tensor(this.accumulatedGradients, shape);
  }

  /**
   * Returns a zero-copy Tensor view over a specific worker's gradient slice.
   */
  public getWorkerGradientsTensor(workerId: number, shape: number[]): Tensor {
    if (workerId < 0 || workerId >= this.workerGradients.length) {
      throw new RangeError(`SharedMemoryArena: workerId ${workerId} out of bounds (max: ${this.workerGradients.length - 1})`);
    }
    return new Tensor(this.workerGradients[workerId], shape);
  }

  /**
   * Returns a Float32Array slice for a specific worker's gradients.
   */
  public getWorkerGradients(workerId: number): Float32Array {
    if (workerId < 0 || workerId >= this.workerGradients.length) {
      throw new RangeError(`SharedMemoryArena: workerId ${workerId} out of bounds (max: ${this.workerGradients.length - 1})`);
    }
    return this.workerGradients[workerId];
  }

  /**
   * Returns a zero-copy Tensor view over a subregion of the shared workspace.
   */
  public getWorkspaceTensor(shape: number[], elementOffset: number = 0): Tensor {
    const size = shape.reduce((a, b) => a * b, 1);
    if (elementOffset + size > this.workspace.length) {
      throw new RangeError(
        `SharedMemoryArena: workspace allocation ${elementOffset} + ${size} exceeds workspace length ${this.workspace.length}`
      );
    }
    const slice = new Float32Array(this.sab, this.layout.workspaceOffset + elementOffset * 4, size);
    return new Tensor(slice, shape);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ATOMICS SYNCHRONIZATION PRIMITIVES
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Acquires the global spinlock using Atomics.compareExchange.
   */
  public acquireLock(): void {
    while (true) {
      // Try to acquire: 0 -> 1
      if (Atomics.compareExchange(this.header, HEADER_SLOTS.MUTEX_LOCK, 0, 1) === 0) {
        return;
      }
      // Spin with Atomics.wait if possible or yield
      Atomics.wait(this.header, HEADER_SLOTS.MUTEX_LOCK, 1, 1);
    }
  }

  /**
   * Releases the global spinlock using Atomics.store and notifies waiters.
   */
  public releaseLock(): void {
    Atomics.store(this.header, HEADER_SLOTS.MUTEX_LOCK, 0);
    Atomics.notify(this.header, HEADER_SLOTS.MUTEX_LOCK, 1);
  }

  /**
   * Atomically sets the status of a worker.
   */
  public setWorkerStatus(workerId: number, status: number): void {
    if (workerId >= 0 && workerId < this.layout.maxWorkers) {
      Atomics.store(this.header, HEADER_SLOTS.STATUS_BASE + workerId, status);
      Atomics.notify(this.header, HEADER_SLOTS.STATUS_BASE + workerId, 1);
    }
  }

  /**
   * Reads the current status of a worker.
   */
  public getWorkerStatus(workerId: number): number {
    if (workerId >= 0 && workerId < this.layout.maxWorkers) {
      return Atomics.load(this.header, HEADER_SLOTS.STATUS_BASE + workerId);
    }
    return WORKER_STATUS.ERROR;
  }

  /**
   * Deterministic synchronization barrier across active workers.
   * All arriving workers wait until the target worker count is satisfied.
   */
  public barrierWait(workerId: number, totalWorkers: number, timeoutMs: number = 5000): boolean {
    const currentGen = Atomics.load(this.header, HEADER_SLOTS.BARRIER_GEN);
    const arrived = Atomics.add(this.header, HEADER_SLOTS.BARRIER_ARRIVED, 1) + 1;

    if (arrived === totalWorkers) {
      // Last worker to arrive resets the barrier and increments generation
      Atomics.store(this.header, HEADER_SLOTS.BARRIER_ARRIVED, 0);
      Atomics.add(this.header, HEADER_SLOTS.BARRIER_GEN, 1);
      Atomics.notify(this.header, HEADER_SLOTS.BARRIER_GEN, totalWorkers);
      return true;
    } else {
      // Wait for the generation counter to change
      const waitResult = Atomics.wait(this.header, HEADER_SLOTS.BARRIER_GEN, currentGen, timeoutMs);
      return waitResult !== 'timed-out';
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DETERMINISTIC GRADIENT ACCUMULATION (FIXED SEQUENCE ORDER)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Strictly accumulates worker gradients in ascending index order (k = 0, 1, ..., K-1).
   *
   * In floating-point arithmetic: (A + B) + C != A + (B + C) due to non-associativity.
   * A fixed-order reduction ensures 100% bit-for-bit identical results regardless of
   * thread scheduling order (variance sigma^2 = 0.0).
   */
  public deterministicReduceGradients(activeWorkerCount: number): void {
    const P = this.layout.weightsLength;
    const acc = this.accumulatedGradients;

    // Reset accumulator to zero
    acc.fill(0);

    // Sum strictly in fixed worker order: k = 0, 1, ..., activeWorkerCount - 1
    for (let k = 0; k < activeWorkerCount; k++) {
      const gradK = this.workerGradients[k];
      for (let i = 0; i < P; i++) {
        acc[i] += gradK[i];
      }
    }

    // Scale by 1 / activeWorkerCount for mean gradient
    if (activeWorkerCount > 1) {
      const invK = 1.0 / activeWorkerCount;
      for (let i = 0; i < P; i++) {
        acc[i] *= invK;
      }
    }
  }

  /**
   * Resets all gradient buffers (accumulated + per-worker) to zero.
   */
  public zeroGradients(): void {
    this.accumulatedGradients.fill(0);
    for (const wGrad of this.workerGradients) {
      wGrad.fill(0);
    }
  }

  /**
   * Computes a 32-bit checksum of the current weights for deterministic validation.
   */
  public computeWeightsChecksum(): number {
    let hash = 0x811c9dc5;
    const intView = new Int32Array(this.sab, this.layout.weightsOffset, Math.min(1000, this.layout.weightsLength));
    for (let i = 0; i < intView.length; i++) {
      hash ^= intView[i];
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }
}
