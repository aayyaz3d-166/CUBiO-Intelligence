/**
 * ONE Language — Virtual Capacity Profiler
 * ========================================
 * Module: @one/memory/extreme/VirtualCapacityProfiler
 *
 * Implements Section 14 of Extreme-Scale 3D Memory Toolchain.
 * Separately profiles and reports:
 *   A. Virtual logical capacity
 *   B. Physical bytes used
 *   C. Heap / RSS
 *   D. Persistent disk bytes
 *   E. Recoverable information bytes
 *   F. Metadata bytes
 *   G. CPU time
 *   H. Lookup time
 *
 * MANDATORY SCIENTIFIC INVARIANT:
 *   VIRTUAL CAPACITY ≠ PHYSICAL STORAGE ≠ RECOVERABLE INFORMATION
 */

export interface CapacityAuditRecord {
  readonly virtualLogicalCapacityBigInt: bigint;
  readonly virtualCapacityFormatted: string;
  readonly physicalBytesUsed: number;
  readonly heapUsedBytes: number;
  readonly heapTotalBytes: number;
  readonly rssBytes: number;
  readonly persistentDiskBytes: number;
  readonly recoverableInformationBytes: number;
  readonly metadataOverheadBytes: number;
  readonly cpuTimeMs: number;
  readonly meanLookupLatencyMicros: number;
  readonly virtualToPhysicalRatio: string;
  readonly trueCompressionRatio: number; // recoverable / (physical + metadata)
  readonly timestamp: string;
}

export class VirtualCapacityProfiler {
  /**
   * Builds an authoritative capacity profile separating logical address space from physical storage.
   */
  public static profile(
    virtualCapacityBigInt: bigint,
    physicalBytesUsed: number,
    recoverableBytes: number,
    metadataBytes: number,
    cpuTimeMs: number,
    meanLookupMicros: number,
    persistentDiskBytes: number = 0
  ): CapacityAuditRecord {
    const mem = process.memoryUsage();

    // Virtual to Physical ratio
    const physBig = BigInt(Math.max(1, physicalBytesUsed));
    const ratioBig = virtualCapacityBigInt / physBig;
    const ratioFormatted = `${ratioBig.toString()} : 1`;

    // True compression ratio: recoverable payload / physical stored payload + metadata
    const denom = physicalBytesUsed + metadataBytes;
    const trueCompression = denom > 0 ? recoverableBytes / denom : 0.0;

    return {
      virtualLogicalCapacityBigInt: virtualCapacityBigInt,
      virtualCapacityFormatted: this.formatBigIntBytes(virtualCapacityBigInt),
      physicalBytesUsed,
      heapUsedBytes: mem.heapUsed,
      heapTotalBytes: mem.heapTotal,
      rssBytes: mem.rss,
      persistentDiskBytes,
      recoverableInformationBytes: recoverableBytes,
      metadataOverheadBytes: metadataBytes,
      cpuTimeMs,
      meanLookupLatencyMicros: meanLookupMicros,
      virtualToPhysicalRatio: ratioFormatted,
      trueCompressionRatio: trueCompression,
      timestamp: new Date().toISOString(),
    };
  }

  public static formatBigIntBytes(bytes: bigint): string {
    const ZB = 1024n * 1024n * 1024n * 1024n * 1024n * 1024n * 1024n;
    const EB = 1024n * 1024n * 1024n * 1024n * 1024n * 1024n;
    const PB = 1024n * 1024n * 1024n * 1024n * 1024n;
    const TB = 1024n * 1024n * 1024n * 1024n;
    const GB = 1024n * 1024n * 1024n;

    if (bytes >= ZB) return `${(Number(bytes / (ZB / 100n)) / 100).toFixed(2)} ZB`;
    if (bytes >= EB) return `${(Number(bytes / (EB / 100n)) / 100).toFixed(2)} EB`;
    if (bytes >= PB) return `${(Number(bytes / (PB / 100n)) / 100).toFixed(2)} PB`;
    if (bytes >= TB) return `${(Number(bytes / (TB / 100n)) / 100).toFixed(2)} TB`;
    if (bytes >= GB) return `${(Number(bytes / (GB / 100n)) / 100).toFixed(2)} GB`;
    return `${bytes.toString()} Bytes`;
  }
}
