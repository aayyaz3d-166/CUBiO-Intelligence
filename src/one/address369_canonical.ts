/**
 * Canonical Address369 Memory Map
 * Module: ONE Language Core ("one-memory-canonical")
 * Specification: Gate CNL-P26.1-R1 Forensic Correction
 *
 * Canonical Indexing Architecture:
 *   - Internal Addresses: [0..368] (Strictly 369 cells)
 *   - Symbolic Layer:     [0..25]  (26 symbolic registers)
 *   - Spatial Layer:      [26..368] (343 spatial voxel cells, 7x7x7)
 *   - UI Display Index:   [1..369] (Explicitly designated as Display Index)
 */

export interface CanonicalAddressInfo {
  internalAddress: number; // 0..368
  displayIndex: number;    // 1..369
  layer: 'SYMBOLIC' | 'SPATIAL';
  symbolicKey?: string;
  spatialCoord?: { i: number; j: number; k: number };
  description: string;
}

export class CanonicalAddress369 {
  public static readonly TOTAL_ADDRESSES: number = 369;
  public static readonly SYMBOLIC_COUNT: number = 26;
  public static readonly SPATIAL_COUNT: number = 343; // 7 * 7 * 7

  public static readonly SYMBOLIC_START: number = 0;
  public static readonly SYMBOLIC_END: number = 25;

  public static readonly SPATIAL_START: number = 26;
  public static readonly SPATIAL_END: number = 368;

  /**
   * Converts an internal 0-indexed address [0..368] to an explicit UI Display Index [1..369].
   */
  public static toDisplayIndex(internalAddress: number): number {
    if (internalAddress < 0 || internalAddress >= this.TOTAL_ADDRESSES) {
      throw new Error(
        `[Address369 Bounds Error] Internal address ${internalAddress} is outside valid canonical range [0..368].`
      );
    }
    return internalAddress + 1;
  }

  /**
   * Converts a UI Display Index [1..369] back to an internal 0-indexed address [0..368].
   */
  public static fromDisplayIndex(displayIndex: number): number {
    if (displayIndex < 1 || displayIndex > this.TOTAL_ADDRESSES) {
      throw new Error(
        `[Address369 Bounds Error] Display Index ${displayIndex} is outside valid UI range [1..369].`
      );
    }
    return displayIndex - 1;
  }

  /**
   * Returns human-readable explicit Display Index tag.
   */
  public static formatDisplayIndex(internalAddress: number): string {
    const disp = this.toDisplayIndex(internalAddress);
    return `Display Index [${disp}..369] (Internal: ${internalAddress})`;
  }

  /**
   * Maps 3D spatial voxel coordinates (i, j, k) in [0..6] to canonical spatial address [26..368].
   */
  public static spatialCoordToCanonicalAddress(i: number, j: number, k: number): number {
    if (i < 0 || i > 6 || j < 0 || j > 6 || k < 0 || k > 6) {
      throw new Error(`[Address369 Error] Coordinate (${i}, ${j}, ${k}) is outside 7x7x7 grid [0..6].`);
    }
    const spatialOffset = i + 7 * j + 49 * k; // 0..342
    return this.SPATIAL_START + spatialOffset; // 26..368
  }

  /**
   * Maps a canonical spatial address [26..368] back to 3D spatial voxel coordinates (i, j, k) in [0..6].
   */
  public static canonicalAddressToSpatialCoord(address: number): { i: number; j: number; k: number } {
    if (address < this.SPATIAL_START || address > this.SPATIAL_END) {
      throw new Error(
        `[Address369 Error] Address ${address} is not in the canonical spatial range [26..368].`
      );
    }
    const offset = address - this.SPATIAL_START; // 0..342
    const k = Math.floor(offset / 49);
    const rem = offset % 49;
    const j = Math.floor(rem / 7);
    const i = rem % 7;
    return { i, j, k };
  }

  /**
   * Inspects and returns complete metadata for any canonical address [0..368].
   */
  public static inspectAddress(internalAddress: number): CanonicalAddressInfo {
    const displayIndex = this.toDisplayIndex(internalAddress);

    if (internalAddress <= this.SYMBOLIC_END) {
      const symLetter = String.fromCharCode(65 + internalAddress); // A..Z
      return {
        internalAddress,
        displayIndex,
        layer: 'SYMBOLIC',
        symbolicKey: `SYM_${symLetter}_${internalAddress.toString().padStart(2, '0')}`,
        description: `Symbolic Register [${symLetter}] at ${this.formatDisplayIndex(internalAddress)}`,
      };
    }

    const coord = this.canonicalAddressToSpatialCoord(internalAddress);
    return {
      internalAddress,
      displayIndex,
      layer: 'SPATIAL',
      spatialCoord: coord,
      description: `Spatial Voxel Cell (${coord.i}, ${coord.j}, ${coord.k}) at ${this.formatDisplayIndex(internalAddress)}`,
    };
  }
}
