/**
 * ONE Language — Constant-Memory Bucket Engine
 * =============================================
 * Module: @one/memory/extreme/ConstantMemoryBucketEngine
 *
 * Implements Section 4 of Extreme-Scale 3D Memory Toolchain.
 * Maps arbitrarily large virtual reference streams into a strictly bounded 343-cell accumulator.
 *
 * CRITICAL SCIENTIFIC PRINCIPLE:
 *   Zero object-per-virtual-entry retention in the hot path.
 *   Uses Welford's algorithm for numerically stable running mean and variance (M2).
 *   Physical memory remains strictly constant O(1) regardless of whether N = 1K or 10M+.
 */

import * as crypto from 'crypto';
import { SpatialPointerEngine369 } from './369SpatialPointerEngine';

export interface CellBucketState {
  readonly cellId: number;
  readonly canonicalAddress: number;
  readonly i: number;
  readonly j: number;
  readonly k: number;
  count: number;
  sum: number;
  mean: number;
  m2: number;       // Running sum of squared differences from mean (Welford)
  min: number;
  max: number;
  lastUpdatedMs: number;
}

export interface BucketEngineMetrics {
  totalProcessedReferences: number;
  activeCellsCount: number;
  globalSum: number;
  globalMean: number;
  globalVariance: number;
  heapAllocatedApproxBytes: number;
  isMemoryBounded: boolean;
  stateHash: string;
}

export class ConstantMemoryBucketEngine {
  public static readonly TOTAL_CELLS = 343;

  // Static 343-cell accumulator array (fixed length, allocated ONCE)
  private readonly buckets: CellBucketState[];
  private totalIngested: number = 0;
  private runningGlobalSum: number = 0;
  private runningGlobalMean: number = 0;
  private runningGlobalM2: number = 0;

  constructor() {
    this.buckets = new Array<CellBucketState>(ConstantMemoryBucketEngine.TOTAL_CELLS);
    for (let c = 0; c < ConstantMemoryBucketEngine.TOTAL_CELLS; c++) {
      const coord = SpatialPointerEngine369.cellIdToCoord(c);
      const addr = SpatialPointerEngine369.cellIdToAddress(c);
      this.buckets[c] = {
        cellId: c,
        canonicalAddress: addr,
        i: coord.i,
        j: coord.j,
        k: coord.k,
        count: 0,
        sum: 0,
        mean: 0,
        m2: 0,
        min: Number.POSITIVE_INFINITY,
        max: Number.NEGATIVE_INFINITY,
        lastUpdatedMs: 0,
      };
    }
  }

  /**
   * Ingests a virtual reference with an optional numerical metric value.
   * Runs in O(1) time and allocates ZERO heap objects.
   */
  public ingest(virtualAddress: bigint, value: number = 1.0): void {
    const cellId = SpatialPointerEngine369.virtualAddressToCellId(virtualAddress);
    const bucket = this.buckets[cellId];

    this.totalIngested++;
    this.runningGlobalSum += value;

    // Welford's algorithm for global mean and M2
    const deltaGlobal = value - this.runningGlobalMean;
    this.runningGlobalMean += deltaGlobal / this.totalIngested;
    const delta2Global = value - this.runningGlobalMean;
    this.runningGlobalM2 += deltaGlobal * delta2Global;

    // Welford's algorithm for cell-local bucket
    bucket.count++;
    bucket.sum += value;
    const deltaCell = value - bucket.mean;
    bucket.mean += deltaCell / bucket.count;
    const delta2Cell = value - bucket.mean;
    bucket.m2 += deltaCell * delta2Cell;

    if (value < bucket.min) bucket.min = value;
    if (value > bucket.max) bucket.max = value;
    bucket.lastUpdatedMs = Date.now();
  }

  /**
   * Ingests a batch of virtual references.
   */
  public ingestBatch(addresses: bigint[], values?: number[]): void {
    const len = addresses.length;
    for (let i = 0; i < len; i++) {
      const val = values ? values[i] : 1.0;
      this.ingest(addresses[i], val);
    }
  }

  /**
   * Retrieves read-only state for a specific cell.
   */
  public getBucket(cellId: number): Readonly<CellBucketState> {
    if (cellId < 0 || cellId >= ConstantMemoryBucketEngine.TOTAL_CELLS) {
      throw new Error(`[ConstantMemoryBucketEngine Error] Invalid cellId: ${cellId}`);
    }
    return this.buckets[cellId];
  }

  /**
   * Computes sample variance for a cell.
   */
  public getCellVariance(cellId: number): number {
    const b = this.getBucket(cellId);
    if (b.count <= 1) return 0.0;
    return b.m2 / (b.count - 1);
  }

  /**
   * Computes a deterministic cryptographic hash of the entire 343-cell accumulator state.
   */
  public computeStateHash(): string {
    const hasher = crypto.createHash('sha256');
    hasher.update(`TOTAL:${this.totalIngested}:${this.runningGlobalSum}:${this.runningGlobalMean}`);

    for (let c = 0; c < ConstantMemoryBucketEngine.TOTAL_CELLS; c++) {
      const b = this.buckets[c];
      if (b.count > 0) {
        hasher.update(`C:${c}:${b.count}:${b.sum.toFixed(6)}:${b.mean.toFixed(6)}:${b.min}:${b.max}`);
      }
    }
    return '0xBUCKET_' + hasher.digest('hex').substring(0, 32);
  }

  /**
   * Returns snapshot metrics of the bucket engine.
   */
  public getMetrics(): BucketEngineMetrics {
    let activeCells = 0;
    for (let c = 0; c < ConstantMemoryBucketEngine.TOTAL_CELLS; c++) {
      if (this.buckets[c].count > 0) activeCells++;
    }

    const variance = this.totalIngested > 1 ? this.runningGlobalM2 / (this.totalIngested - 1) : 0;

    // Fixed 343 bucket objects * ~128 bytes each ~= 44 KB static footprint
    const approxBytes = ConstantMemoryBucketEngine.TOTAL_CELLS * 128 + 256;

    return {
      totalProcessedReferences: this.totalIngested,
      activeCellsCount: activeCells,
      globalSum: this.runningGlobalSum,
      globalMean: this.runningGlobalMean,
      globalVariance: variance,
      heapAllocatedApproxBytes: approxBytes,
      isMemoryBounded: true,
      stateHash: this.computeStateHash(),
    };
  }

  /**
   * Resets all buckets to zero without reallocating arrays.
   */
  public reset(): void {
    this.totalIngested = 0;
    this.runningGlobalSum = 0;
    this.runningGlobalMean = 0;
    this.runningGlobalM2 = 0;

    for (let c = 0; c < ConstantMemoryBucketEngine.TOTAL_CELLS; c++) {
      const b = this.buckets[c];
      b.count = 0;
      b.sum = 0;
      b.mean = 0;
      b.m2 = 0;
      b.min = Number.POSITIVE_INFINITY;
      b.max = Number.NEGATIVE_INFINITY;
      b.lastUpdatedMs = 0;
    }
  }
}
