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
   * Deterministic Write with Backpressure Signaling
   */
  public writeChunk(chunk: Uint8Array): boolean {
    const capacity = Atomics.load(this.headerView, 2);
    const writePos = Atomics.load(this.headerView, 0);
    const readPos = Atomics.load(this.headerView, 1);

    const availableSpace = (readPos <= writePos) 
      ? capacity - (writePos - readPos) 
      : readPos - writePos;

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
}
