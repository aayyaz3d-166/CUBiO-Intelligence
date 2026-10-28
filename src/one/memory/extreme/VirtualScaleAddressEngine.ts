/**
 * ONE Language — Virtual Scale Address Engine
 * ============================================
 * Module: @one/memory/extreme/VirtualScaleAddressEngine
 *
 * Implements Section 2 of Extreme-Scale 3D Memory Toolchain.
 * Represents extremely large virtual address spaces (TB, PB, EB, ZB scale up to 5+ ZB).
 *
 * CRITICAL SCIENTIFIC PRINCIPLE:
 *   Virtual address space size is a logical mathematical coordinate system.
 *   It DOES NOT allocate or imply physical byte storage proportional to virtual scale.
 *   Physical memory remains strictly O(1) bounded.
 */

export interface VirtualScaleInfo {
  name: string;
  bytesBigInt: bigint;
  pages64KB: bigint;
  theoreticalCells343: bigint;
  hexRangeMax: string;
}

export interface VirtualAddressComponents {
  virtualAddress: bigint;
  virtualPageNumber: bigint;
  pageOffset: number;
  spatialCellAffinity: number; // 0..342 (7x7x7 lattice)
  symbolicAffinity: number;    // 0..25 (A..Z)
  canonicalAddress: number;    // 26..368
}

export class VirtualScaleAddressEngine {
  // Constant scale definitions
  public static readonly ONE_KB = 1024n;
  public static readonly ONE_MB = 1024n * 1024n;
  public static readonly ONE_GB = 1024n * 1024n * 1024n;
  public static readonly ONE_TB = 1024n * 1024n * 1024n * 1024n;                         // 2^40  (~1.099e12 B)
  public static readonly ONE_PB = 1024n * 1024n * 1024n * 1024n * 1024n;                  // 2^50  (~1.126e15 B)
  public static readonly ONE_EB = 1024n * 1024n * 1024n * 1024n * 1024n * 1024n;           // 2^60  (~1.153e18 B)
  public static readonly ONE_ZB = 1024n * 1024n * 1024n * 1024n * 1024n * 1024n * 1024n;    // 2^70  (~1.181e21 B)
  public static readonly FIVE_ZB = 5n * VirtualScaleAddressEngine.ONE_ZB;                 // 5 ZB  (~5.903e21 B)

  public static readonly DEFAULT_PAGE_SIZE = 64n * 1024n; // 64 KB per page
  public static readonly MAX_VIRTUAL_CAPACITY = 10n * VirtualScaleAddressEngine.ONE_ZB; // 10 ZB max bound

  private readonly configuredCapacity: bigint;
  private readonly pageSize: bigint;

  constructor(
    configuredCapacity: bigint = VirtualScaleAddressEngine.FIVE_ZB,
    pageSize: bigint = VirtualScaleAddressEngine.DEFAULT_PAGE_SIZE
  ) {
    if (configuredCapacity <= 0n) {
      throw new Error(`[VirtualScaleAddressEngine Error] Configured capacity must be positive.`);
    }
    if (pageSize <= 0n) {
      throw new Error(`[VirtualScaleAddressEngine Error] Page size must be positive.`);
    }
    this.configuredCapacity = configuredCapacity;
    this.pageSize = pageSize;
  }

  /**
   * Returns the configured virtual address capacity in BigInt bytes.
   */
  public getCapacity(): bigint {
    return this.configuredCapacity;
  }

  /**
   * Returns the page size in BigInt bytes.
   */
  public getPageSize(): bigint {
    return this.pageSize;
  }

  /**
   * Deterministically derives a virtual address from a namespace/domain and integer sequence index.
   * O(1) mathematical computation without heap allocation.
   */
  public deriveVirtualAddress(domain: string, sequenceIndex: bigint): bigint {
    if (sequenceIndex < 0n) {
      throw new Error(`[VirtualScaleAddressEngine Error] Sequence index must be non-negative.`);
    }

    // High 32-bit domain hash + 64-bit sequence
    let domainHash = 0x811c9dc5n; // FNV-1a 32-bit offset basis
    for (let i = 0; i < domain.length; i++) {
      domainHash ^= BigInt(domain.charCodeAt(i));
      domainHash = (domainHash * 0x01000193n) & 0xffffffffn;
    }

    // Composite 96-bit virtual address: (domainHash << 64) | (sequenceIndex & 0xFFFFFFFFFFFFFFFF)
    const rawAddr = ((domainHash & 0xffffffffn) << 64n) | (sequenceIndex & 0xffffffffffffffffn);
    const virtualAddress = rawAddr % this.configuredCapacity;

    return virtualAddress;
  }

  /**
   * Direct O(1) address decomposition into page number, page offset, and 369 spatial affinity.
   * Runs in O(1) constant time, guaranteed zero full-space scanning.
   */
  public decomposeAddress(virtualAddress: bigint): VirtualAddressComponents {
    this.validateAddress(virtualAddress);

    const virtualPageNumber = virtualAddress / this.pageSize;
    const pageOffset = Number(virtualAddress % this.pageSize);

    // Deterministic 343-cell lattice affinity: address mod 343 (0..342)
    const spatialCellAffinity = Number(virtualAddress % 343n);

    // Symbolic affinity: address mod 26 (0..25)
    const symbolicAffinity = Number(virtualAddress % 26n);

    // Canonical address: 26 + spatialCellAffinity (26..368)
    const canonicalAddress = 26 + spatialCellAffinity;

    return {
      virtualAddress,
      virtualPageNumber,
      pageOffset,
      spatialCellAffinity,
      symbolicAffinity,
      canonicalAddress,
    };
  }

  /**
   * Reconstitutes a virtual address from page number and offset.
   */
  public composeAddress(virtualPageNumber: bigint, pageOffset: number): bigint {
    if (virtualPageNumber < 0n) {
      throw new Error(`[VirtualScaleAddressEngine Error] Page number cannot be negative.`);
    }
    if (pageOffset < 0 || BigInt(pageOffset) >= this.pageSize) {
      throw new Error(`[VirtualScaleAddressEngine Error] Page offset ${pageOffset} out of range [0..${this.pageSize - 1n}].`);
    }

    const addr = virtualPageNumber * this.pageSize + BigInt(pageOffset);
    this.validateAddress(addr);
    return addr;
  }

  /**
   * Fail-closed boundary and overflow validation.
   */
  public validateAddress(virtualAddress: bigint): void {
    if (virtualAddress < 0n) {
      throw new Error(`[VirtualScaleAddressEngine Error] Negative address: ${virtualAddress} is invalid.`);
    }
    if (virtualAddress >= this.configuredCapacity) {
      throw new Error(
        `[VirtualScaleAddressEngine Error] Address overflow: ${virtualAddress} exceeds capacity ${this.configuredCapacity} (${this.formatBytes(this.configuredCapacity)}).`
      );
    }
  }

  /**
   * Validates address range [startAddress, startAddress + length).
   */
  public validateRange(startAddress: bigint, length: bigint): void {
    if (startAddress < 0n) {
      throw new Error(`[VirtualScaleAddressEngine Error] Range start cannot be negative.`);
    }
    if (length <= 0n) {
      throw new Error(`[VirtualScaleAddressEngine Error] Range length must be positive.`);
    }
    const endAddress = startAddress + length;
    if (endAddress > this.configuredCapacity) {
      throw new Error(
        `[VirtualScaleAddressEngine Error] Range [${startAddress}..${endAddress}) overflows capacity ${this.configuredCapacity}.`
      );
    }
  }

  /**
   * Returns scale metadata for standard architectural scales.
   */
  public static getScaleInfo(scaleName: '1TB' | '1PB' | '1EB' | '1ZB' | '5ZB' | '10ZB'): VirtualScaleInfo {
    let bytes: bigint;
    switch (scaleName) {
      case '1TB':  bytes = this.ONE_TB; break;
      case '1PB':  bytes = this.ONE_PB; break;
      case '1EB':  bytes = this.ONE_EB; break;
      case '1ZB':  bytes = this.ONE_ZB; break;
      case '5ZB':  bytes = this.FIVE_ZB; break;
      case '10ZB': bytes = this.MAX_VIRTUAL_CAPACITY; break;
    }

    const pages = bytes / this.DEFAULT_PAGE_SIZE;
    const cells = bytes / 343n;
    const hex = '0x' + (bytes - 1n).toString(16);

    return {
      name: scaleName,
      bytesBigInt: bytes,
      pages64KB: pages,
      theoreticalCells343: cells,
      hexRangeMax: hex,
    };
  }

  /**
   * Formats BigInt bytes into standard human-readable units.
   */
  public formatBytes(bytes: bigint): string {
    if (bytes >= VirtualScaleAddressEngine.ONE_ZB) {
      const zbs = Number(bytes / (VirtualScaleAddressEngine.ONE_ZB / 100n)) / 100;
      return `${zbs.toFixed(2)} ZB`;
    }
    if (bytes >= VirtualScaleAddressEngine.ONE_EB) {
      const ebs = Number(bytes / (VirtualScaleAddressEngine.ONE_EB / 100n)) / 100;
      return `${ebs.toFixed(2)} EB`;
    }
    if (bytes >= VirtualScaleAddressEngine.ONE_PB) {
      const pbs = Number(bytes / (VirtualScaleAddressEngine.ONE_PB / 100n)) / 100;
      return `${pbs.toFixed(2)} PB`;
    }
    if (bytes >= VirtualScaleAddressEngine.ONE_TB) {
      const tbs = Number(bytes / (VirtualScaleAddressEngine.ONE_TB / 100n)) / 100;
      return `${tbs.toFixed(2)} TB`;
    }
    if (bytes >= VirtualScaleAddressEngine.ONE_GB) {
      const gbs = Number(bytes / (VirtualScaleAddressEngine.ONE_GB / 100n)) / 100;
      return `${gbs.toFixed(2)} GB`;
    }
    return `${bytes.toString()} Bytes`;
  }
}
