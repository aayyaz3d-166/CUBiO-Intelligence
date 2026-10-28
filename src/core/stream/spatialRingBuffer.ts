import { RSSGuard } from '../memory/rssGuard';

export interface RingBufferHeader {
  writeOffset: number;
  readOffset: number;
  capacityBytes: number;
  droppedPackets: number;
}

export class SpatialRingBuffer {
  private sharedBuffer: SharedArrayBuffer;
  private headerView: Int32Array;
  private dataView: Uint8Array;
  public readonly bufferMb: number;

  constructor(bufferMb: number, rssGuard: RSSGuard) {
    this.bufferMb = bufferMb;
    const capacityBytes = bufferMb * 1024 * 1024;
    
    // Allocate physical memory under strict RSS Guard
    rssGuard.allocate(capacityBytes, `RingBuffer:${bufferMb}MB`);

    // Shared Array Buffer for Zero-Copy Thread Execution
    this.sharedBuffer = new SharedArrayBuffer(capacityBytes + 16);
    this.headerView = new Int32Array(this.sharedBuffer, 0, 4);
    this.dataView = new Uint8Array(this.sharedBuffer, 16, capacityBytes);

    // Initialize Header: [0: writeOffset, 1: readOffset, 2: capacityBytes, 3: droppedPackets]
    Atomics.store(this.headerView, 0, 0);
    Atomics.store(this.headerView, 1, 0);
    Atomics.store(this.headerView, 2, capacityBytes);
    Atomics.store(this.headerView, 3, 0);
  }

  /**
   * Creates a first-class zero-copy slice view directly over the underlying SharedArrayBuffer.
   */
  public createMemoryView(byteOffset: number = 0, byteLength?: number): Uint8Array {
    const capacity = Atomics.load(this.headerView, 2);
    const length = byteLength !== undefined ? Math.min(byteLength, capacity - byteOffset) : capacity - byteOffset;
    return new Uint8Array(this.sharedBuffer, 16 + byteOffset, length);
  }

  public getSharedBuffer(): SharedArrayBuffer {
    return this.sharedBuffer;
  }

  /**
   * Deterministic Write with Backpressure Signaling
   */
  public writeChunk(chunk: Uint8Array): boolean {
    const capacity = Atomics.load(this.headerView, 2);
    const writePos = Atomics.load(this.headerView, 0);
    const readPos = Atomics.load(this.headerView, 1);

    // Bounded capacity reservation: capacity - 1 to distinguish full from empty
    const availableSpace = (readPos <= writePos) 
      ? (capacity - 1) - (writePos - readPos) 
      : (readPos - writePos - 1);

    if (chunk.length > availableSpace) {
      // Backpressure Triggered: Buffer Full
      Atomics.add(this.headerView, 3, 1);
      return false; 
    }

    // Zero-copy chunk write
    for (let i = 0; i < chunk.length; i++) {
      this.dataView[(writePos + i) % capacity] = chunk[i];
    }

    Atomics.store(this.headerView, 0, (writePos + chunk.length) % capacity);
    return true;
  }

  /**
   * Deterministic Read Operation
   */
  public readChunk(dest: Uint8Array): number {
    const capacity = Atomics.load(this.headerView, 2);
    const writePos = Atomics.load(this.headerView, 0);
    const readPos = Atomics.load(this.headerView, 1);

    if (readPos === writePos) return 0; // Empty Buffer

    const availableData = (writePos >= readPos) 
      ? writePos - readPos 
      : capacity - readPos + writePos;

    const readSize = Math.min(dest.length, availableData);

    for (let i = 0; i < readSize; i++) {
      dest[i] = this.dataView[(readPos + i) % capacity];
    }

    Atomics.store(this.headerView, 1, (readPos + readSize) % capacity);
    return readSize;
  }

  public getAvailableSpace(): number {
    const capacity = Atomics.load(this.headerView, 2);
    const writePos = Atomics.load(this.headerView, 0);
    const readPos = Atomics.load(this.headerView, 1);
    return (readPos <= writePos) 
      ? (capacity - 1) - (writePos - readPos) 
      : (readPos - writePos - 1);
  }

  public getAvailableData(): number {
    const capacity = Atomics.load(this.headerView, 2);
    const writePos = Atomics.load(this.headerView, 0);
    const readPos = Atomics.load(this.headerView, 1);
    if (readPos === writePos) return 0;
    return (writePos >= readPos) 
      ? writePos - readPos 
      : capacity - readPos + writePos;
  }

  public getDroppedPackets(): number {
    return Atomics.load(this.headerView, 3);
  }

  public isEmpty(): boolean {
    return Atomics.load(this.headerView, 0) === Atomics.load(this.headerView, 1);
  }

  public isFull(): boolean {
    return this.getAvailableSpace() === 0;
  }

  public reset(): void {
    Atomics.store(this.headerView, 0, 0);
    Atomics.store(this.headerView, 1, 0);
    Atomics.store(this.headerView, 3, 0);
  }
}

export interface ReplayTransition {
  id: string;
  tokens: number[];
  targetSpatialState: Float32Array;
  loss?: number;
  reward?: number;
  step?: number;
  timestamp: number;
}

export interface ReplayBufferConfig {
  maxTransitions: number;
  maxBytes?: number;
  rssGuard: RSSGuard;
}

export class SpatialReplayBuffer {
  private transitions: ReplayTransition[] = [];
  private readonly maxTransitions: number;
  private readonly rssGuard: RSSGuard;

  constructor(config: ReplayBufferConfig) {
    if (config.maxTransitions <= 0) {
      throw new Error(`[ReplayBuffer Error] maxTransitions must be positive, got ${config.maxTransitions}`);
    }
    this.maxTransitions = config.maxTransitions;
    this.rssGuard = config.rssGuard;
    const initialAlloc = config.maxBytes ?? (config.maxTransitions * 1024);
    this.rssGuard.allocate(initialAlloc, `SpatialReplayBuffer:${config.maxTransitions}items`);
  }

  public push(transition: ReplayTransition): boolean {
    if (!transition || !Array.isArray(transition.tokens) || !transition.targetSpatialState) {
      throw new Error('[ReplayBuffer Error] Invalid transition structure provided.');
    }
    if (this.transitions.length >= this.maxTransitions) {
      // FIFO eviction of oldest transition
      this.transitions.shift();
    }
    this.transitions.push({
      ...transition,
      tokens: [...transition.tokens],
      targetSpatialState: new Float32Array(transition.targetSpatialState),
    });
    return true;
  }

  public sample(batchSize: number, seed?: number): ReplayTransition[] {
    if (this.transitions.length === 0 || batchSize <= 0) return [];
    const count = Math.min(batchSize, this.transitions.length);
    if (seed === undefined) {
      const indices = new Set<number>();
      while (indices.size < count) {
        indices.add(Math.floor(Math.random() * this.transitions.length));
      }
      return Array.from(indices).map((idx) => this.transitions[idx]);
    }
    // Deterministic seeded sampling using Mulberry32 PRNG
    let s = seed >>> 0;
    const indices: number[] = [];
    const pool = Array.from({ length: this.transitions.length }, (_, i) => i);
    for (let i = 0; i < count; i++) {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      const pick = Math.floor(r * pool.length);
      indices.push(pool[pick]);
      pool.splice(pick, 1);
    }
    return indices.map((idx) => this.transitions[idx]);
  }

  public size(): number {
    return this.transitions.length;
  }

  public capacity(): number {
    return this.maxTransitions;
  }

  public clear(): void {
    this.transitions = [];
  }
}
