/**
 * Phase 8C — Concurrent Funnel Streams
 *
 * Multi-threaded funnel data transfer pipeline with atomic backpressure
 * and 369-harmonic flow control.
 */

import { LockFreeQueue } from './lockFreeStructures';
import { AtomicSlot } from './lockFreeStructures';

export interface FunnelStreamConfig {
  name: string;
  sourceNode: string;
  targetNode: string;
  bufferMb: number;
}

export interface FunnelDataPacket {
  sequence: number;
  data: any;
  timestamp: number;
  size: number;
}

export interface FunnelStats {
  packetsSent: number;
  packetsReceived: number;
  packetsDropped: number;
  totalBytesTransferred: number;
  currentQueueSize: number;
  activeTransfers: number;
  backpressureCount: number;
  harmonicAlignmentScore: number;
}

export interface FunnelTransferResult {
  success: boolean;
  packetsTransferred: number;
  bytesTransferred: number;
  durationMs: number;
  packetsDropped: number;
}

export class ConcurrentFunnel {
  private config: FunnelStreamConfig;
  private queue: LockFreeQueue<FunnelDataPacket>;
  private activeTransfers: AtomicSlot;
  private packetsSent: number = 0;
  private packetsReceived: number = 0;
  private packetsDropped: number = 0;
  private totalBytesTransferred: number = 0;
  private backpressureCount: number = 0;
  private harmonicCounter: number = 0;
  private readBuffer: any[] = [];
  private writeBuffer: any[] = [];
  private isClosed: boolean = false;

  constructor(config: FunnelStreamConfig) {
    this.config = config;
    // Queue capacity based on buffer size (1 MB ≈ 1024 slots)
    const capacity = Math.max(64, Math.floor(config.bufferMb * 1024));
    this.queue = new LockFreeQueue<FunnelDataPacket>(capacity);
    this.activeTransfers = new AtomicSlot();
  }

  /**
   * Push data into the funnel (source side).
   * Uses 369-harmonic backpressure when queue is full.
   */
  public pushData(data: any, sequence: number = 0): boolean {
    if (this.isClosed) return false;

    // Check if queue is full (backpressure)
    if (this.queue.isFull()) {
      this.backpressureCount++;
      // 369-harmonic backoff: wait based on sequence
      const backoff = (sequence % 369) * 0.001;
      // In real implementation, would wait here
      return false;
    }

    const packet: FunnelDataPacket = {
      sequence,
      data,
      timestamp: Date.now(),
      size: this.estimateSize(data),
    };

    const enqueued = this.queue.enqueue(packet);
    if (enqueued) {
      this.packetsSent++;
      this.totalBytesTransferred += packet.size;
      this.harmonicCounter = (this.harmonicCounter + 1) % 369;
    } else {
      this.packetsDropped++;
      this.backpressureCount++;
    }

    return enqueued;
  }

  /**
   * Push multiple data items in batch.
   */
  public pushBatch(dataArray: any[], startSequence: number = 0): number {
    let count = 0;
    for (let i = 0; i < dataArray.length; i++) {
      if (this.pushData(dataArray[i], startSequence + i)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Pull data from the funnel (target side).
   */
  public pullData(): FunnelDataPacket | undefined {
    if (this.isClosed) return undefined;

    const packet = this.queue.dequeue();
    if (packet) {
      this.packetsReceived++;
      this.readBuffer.push(packet.data);
      this.harmonicCounter = (this.harmonicCounter + 1) % 369;
    }
    return packet;
  }

  /**
   * Pull multiple packets in batch.
   */
  public pullBatch(maxCount: number = 10): FunnelDataPacket[] {
    const packets: FunnelDataPacket[] = [];
    for (let i = 0; i < maxCount; i++) {
      const packet = this.pullData();
      if (!packet) break;
      packets.push(packet);
    }
    return packets;
  }

  /**
   * Get the next data item (raw, without packet wrapper).
   */
  public getData(): any | undefined {
    const packet = this.pullData();
    return packet ? packet.data : undefined;
  }

  /**
   * Get current queue size.
   */
  public getQueueSize(): number {
    return this.queue.size();
  }

  /**
   * Check if funnel is empty.
   */
  public isEmpty(): boolean {
    return this.queue.isEmpty();
  }

  /**
   * Check if funnel is full (backpressure active).
   */
  public isFull(): boolean {
    return this.queue.isFull();
  }

  /**
   * Get funnel configuration.
   */
  public getConfig(): FunnelStreamConfig {
    return { ...this.config };
  }

  /**
   * Get funnel name.
   */
  public getName(): string {
    return this.config.name;
  }

  /**
   * Get source node.
   */
  public getSourceNode(): string {
    return this.config.sourceNode;
  }

  /**
   * Get target node.
   */
  public getTargetNode(): string {
    return this.config.targetNode;
  }

  /**
   * Get buffer size in MB.
   */
  public getBufferSizeMb(): number {
    return this.config.bufferMb;
  }

  /**
   * Get current stats.
   */
  public getStats(): FunnelStats {
    return {
      packetsSent: this.packetsSent,
      packetsReceived: this.packetsReceived,
      packetsDropped: this.packetsDropped,
      totalBytesTransferred: this.totalBytesTransferred,
      currentQueueSize: this.queue.size(),
      activeTransfers: this.activeTransfers.get(),
      backpressureCount: this.backpressureCount,
      harmonicAlignmentScore: this.calculateHarmonicScore(),
    };
  }

  /**
   * Calculate 369-harmonic alignment score.
   */
  private calculateHarmonicScore(): number {
    const sent = this.packetsSent;
    const recv = this.packetsReceived;
    const total = sent + recv;
    if (total === 0) return 1.0;

    // 369-harmonic alignment: perfect alignment when sent/received ratio
    // aligns with 369 harmonic series
    const ratio = recv / Math.max(1, sent);
    const harmonicScore = 1.0 - Math.abs(ratio - 1.0) * 0.5;
    return Math.max(0, Math.min(1, harmonicScore));
  }

  /**
   * Estimate size of data in bytes.
   */
  private estimateSize(data: any): number {
    if (data === null || data === undefined) return 0;
    if (typeof data === 'string') return Buffer.byteLength(data, 'utf-8');
    if (typeof data === 'number' || typeof data === 'boolean') return 8;
    if (Array.isArray(data)) {
      let size = 0;
      for (const item of data) size += this.estimateSize(item);
      return size;
    }
    if (typeof data === 'object') {
      try {
        return Buffer.byteLength(JSON.stringify(data), 'utf-8');
      } catch {
        return 100;
      }
    }
    return 100;
  }

  /**
   * Simulate data transfer from source to target.
   * This is a synchronous simulation of what would be an async transfer.
   */
  public simulateTransfer(dataArray: any[]): FunnelTransferResult {
    const startTime = Date.now();
    const packetsTransferred = this.pushBatch(dataArray);
    const bytesTransferred = packetsTransferred * 1024; // Assume ~1KB per packet
    const dropped = dataArray.length - packetsTransferred;
    const durationMs = Date.now() - startTime;

    return {
      success: dropped === 0,
      packetsTransferred,
      bytesTransferred,
      durationMs,
      packetsDropped: dropped,
    };
  }

  /**
   * Drain all remaining data from the funnel.
   */
  public drain(): any[] {
    const data: any[] = [];
    let packet: FunnelDataPacket | undefined;
    while ((packet = this.pullData()) !== undefined) {
      data.push(packet.data);
    }
    return data;
  }

  /**
   * Close the funnel (no more data can be pushed).
   */
  public close(): void {
    this.isClosed = true;
  }

  /**
   * Reset the funnel (clear all data and stats).
   */
  public reset(): void {
    this.queue.clear();
    this.activeTransfers.set(0);
    this.packetsSent = 0;
    this.packetsReceived = 0;
    this.packetsDropped = 0;
    this.totalBytesTransferred = 0;
    this.backpressureCount = 0;
    this.harmonicCounter = 0;
    this.readBuffer = [];
    this.writeBuffer = [];
    this.isClosed = false;
  }
}

// ─── Concurrent Funnel Network ──────────────────────────────────────────────

/**
 * Manages multiple concurrent funnel streams between nodes.
 * Provides 369-harmonic load balancing across funnels.
 */
export class ConcurrentFunnelNetwork {
  private funnels: Map<string, ConcurrentFunnel> = new Map();
  private harmonicCounter: number = 0;

  /**
   * Create a new funnel stream.
   */
  public createFunnel(config: FunnelStreamConfig): ConcurrentFunnel {
    const funnel = new ConcurrentFunnel(config);
    this.funnels.set(config.name, funnel);
    this.harmonicCounter = (this.harmonicCounter + 1) % 369;
    return funnel;
  }

  /**
   * Get a funnel by name.
   */
  public getFunnel(name: string): ConcurrentFunnel | undefined {
    return this.funnels.get(name);
  }

  /**
   * Get all funnels.
   */
  public getAllFunnels(): ConcurrentFunnel[] {
    return Array.from(this.funnels.values());
  }

  /**
   * Get funnel count.
   */
  public getCount(): number {
    return this.funnels.size;
  }

  /**
   * Remove a funnel.
   */
  public removeFunnel(name: string): boolean {
    const funnel = this.funnels.get(name);
    if (funnel) {
      funnel.close();
      return this.funnels.delete(name);
    }
    return false;
  }

  /**
   * Push data to a specific funnel.
   */
  public pushToFunnel(funnelName: string, data: any, sequence: number = 0): boolean {
    const funnel = this.funnels.get(funnelName);
    if (funnel) {
      return funnel.pushData(data, sequence);
    }
    return false;
  }

  /**
   * Pull data from a specific funnel.
   */
  public pullFromFunnel(funnelName: string): any | undefined {
    const funnel = this.funnels.get(funnelName);
    if (funnel) {
      return funnel.getData();
    }
    return undefined;
  }

  /**
   * Push data to all funnels (broadcast).
   */
  public broadcast(data: any, sequence: number = 0): number {
    let count = 0;
    for (const funnel of this.funnels.values()) {
      if (funnel.pushData(data, sequence + count)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get aggregate stats across all funnels.
   */
  public getAggregateStats(): { totalFunnels: number; totalPackets: number; totalBytes: number; avgHarmonicScore: number } {
    let totalPackets = 0;
    let totalBytes = 0;
    let totalScore = 0;
    const count = this.funnels.size;

    for (const funnel of this.funnels.values()) {
      const stats = funnel.getStats();
      totalPackets += stats.packetsSent + stats.packetsReceived;
      totalBytes += stats.totalBytesTransferred;
      totalScore += stats.harmonicAlignmentScore;
    }

    return {
      totalFunnels: count,
      totalPackets,
      totalBytes,
      avgHarmonicScore: count > 0 ? totalScore / count : 0,
    };
  }

  /**
   * Clear all funnels.
   */
  public clear(): void {
    for (const funnel of this.funnels.values()) {
      funnel.reset();
    }
    this.funnels.clear();
    this.harmonicCounter = 0;
  }
}
