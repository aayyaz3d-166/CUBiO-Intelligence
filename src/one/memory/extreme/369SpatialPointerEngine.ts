/**
 * ONE Language — 369 Spatial Pointer Engine
 * ==========================================
 * Module: @one/memory/extreme/369SpatialPointerEngine
 *
 * Implements Section 3 of Extreme-Scale 3D Memory Toolchain.
 * Reuses canonical address369_canonical without modification.
 *
 * Strictly preserves:
 *   - cellId: 0..342
 *   - canonicalAddress: 26..368
 *   - 7x7x7 discrete spatial lattice (i, j, k in [0..6])
 *   - Symbolic layer: 0..25 (A..Z)
 *   - UI Display Index: 1..369
 */

import { CanonicalAddress369 } from '../../address369_canonical';

export interface VoxelCoordinate3D {
  readonly i: number; // 0..6
  readonly j: number; // 0..6
  readonly k: number; // 0..6
}

export interface SpatialPointer {
  readonly pointerId: string;
  readonly canonicalAddress: number;    // 26..368
  readonly cellId: number;              // 0..342
  readonly coord: VoxelCoordinate3D;
  readonly displayIndex: number;        // 27..369
  readonly uri: string;                 // one://369/spatial/<cellId>
  readonly createdAtMs: number;
}

export interface ResolvedSpatialPointerInfo {
  readonly pointer: SpatialPointer;
  readonly isValid: boolean;
  readonly layer: 'SPATIAL';
  readonly volumeOccupancyOffset: number; // 0..342
}

export class SpatialPointerBoundsError extends Error {
  constructor(message: string) {
    super(`[369SpatialPointerEngine Bounds Error] ${message}`);
    this.name = 'SpatialPointerBoundsError';
  }
}

export class SpatialPointerEngine369 {
  public static readonly GRID_DIMENSION = 7;
  public static readonly TOTAL_SPATIAL_CELLS = 343; // 7^3
  public static readonly SPATIAL_START_ADDR = CanonicalAddress369.SPATIAL_START; // 26
  public static readonly SPATIAL_END_ADDR = CanonicalAddress369.SPATIAL_END;     // 368

  /**
   * Converts 3D discrete grid coordinates (i, j, k) to 0-indexed cellId [0..342].
   */
  public static coordToCellId(i: number, j: number, k: number): number {
    if (i < 0 || i > 6 || j < 0 || j > 6 || k < 0 || k > 6) {
      throw new SpatialPointerBoundsError(`Coordinate (${i}, ${j}, ${k}) is outside 7x7x7 lattice [0..6].`);
    }
    return i + 7 * j + 49 * k;
  }

  /**
   * Converts 0-indexed cellId [0..342] to 3D discrete grid coordinates (i, j, k).
   */
  public static cellIdToCoord(cellId: number): VoxelCoordinate3D {
    if (cellId < 0 || cellId >= this.TOTAL_SPATIAL_CELLS) {
      throw new SpatialPointerBoundsError(`CellId ${cellId} is outside valid lattice range [0..342].`);
    }
    const k = Math.floor(cellId / 49);
    const rem = cellId % 49;
    const j = Math.floor(rem / 7);
    const i = rem % 7;
    return { i, j, k };
  }

  /**
   * Maps 0-indexed cellId [0..342] to canonical spatial address [26..368].
   */
  public static cellIdToAddress(cellId: number): number {
    if (cellId < 0 || cellId >= this.TOTAL_SPATIAL_CELLS) {
      throw new SpatialPointerBoundsError(`CellId ${cellId} is outside valid range [0..342].`);
    }
    return this.SPATIAL_START_ADDR + cellId;
  }

  /**
   * Maps canonical spatial address [26..368] to 0-indexed cellId [0..342].
   */
  public static addressToCellId(address: number): number {
    if (address < this.SPATIAL_START_ADDR || address > this.SPATIAL_END_ADDR) {
      throw new SpatialPointerBoundsError(
        `Address ${address} is outside canonical spatial range [${this.SPATIAL_START_ADDR}..${this.SPATIAL_END_ADDR}].`
      );
    }
    return address - this.SPATIAL_START_ADDR;
  }

  /**
   * Creates an immutable spatial pointer from coordinates (i, j, k).
   */
  public static createPointerFromCoord(i: number, j: number, k: number): SpatialPointer {
    const cellId = this.coordToCellId(i, j, k);
    const canonicalAddress = this.cellIdToAddress(cellId);
    const displayIndex = CanonicalAddress369.toDisplayIndex(canonicalAddress);

    return {
      pointerId: `ptr_369_${cellId}_${i}_${j}_${k}`,
      canonicalAddress,
      cellId,
      coord: { i, j, k },
      displayIndex,
      uri: `one://369/spatial/${cellId}`,
      createdAtMs: Date.now(),
    };
  }

  /**
   * Creates an immutable spatial pointer from a canonical address [26..368].
   */
  public static createPointerFromAddress(address: number): SpatialPointer {
    const cellId = this.addressToCellId(address);
    const coord = this.cellIdToCoord(cellId);
    const displayIndex = CanonicalAddress369.toDisplayIndex(address);

    return {
      pointerId: `ptr_369_${cellId}_${coord.i}_${coord.j}_${coord.k}`,
      canonicalAddress: address,
      cellId,
      coord,
      displayIndex,
      uri: `one://369/spatial/${cellId}`,
      createdAtMs: Date.now(),
    };
  }

  /**
   * Resolves a spatial pointer, performing round-trip validation and boundary checking.
   */
  public static resolvePointer(pointer: SpatialPointer): ResolvedSpatialPointerInfo {
    // 1. Validate cellId bounds
    if (pointer.cellId < 0 || pointer.cellId >= this.TOTAL_SPATIAL_CELLS) {
      throw new SpatialPointerBoundsError(`Pointer contains corrupt cellId: ${pointer.cellId}`);
    }

    // 2. Validate canonical address bijection
    const expectedAddr = this.cellIdToAddress(pointer.cellId);
    if (pointer.canonicalAddress !== expectedAddr) {
      throw new SpatialPointerBoundsError(
        `Pointer address mismatch: expected ${expectedAddr}, got ${pointer.canonicalAddress}`
      );
    }

    // 3. Validate coordinate bijection
    const expectedCoord = this.cellIdToCoord(pointer.cellId);
    if (
      pointer.coord.i !== expectedCoord.i ||
      pointer.coord.j !== expectedCoord.j ||
      pointer.coord.k !== expectedCoord.k
    ) {
      throw new SpatialPointerBoundsError(`Pointer coordinate corrupted for cellId ${pointer.cellId}`);
    }

    return {
      pointer,
      isValid: true,
      layer: 'SPATIAL',
      volumeOccupancyOffset: pointer.cellId,
    };
  }

  /**
   * Derives a deterministic spatial cellId from an arbitrary 64-bit virtual address.
   */
  public static virtualAddressToCellId(virtualAddress: bigint): number {
    if (virtualAddress < 0n) {
      throw new SpatialPointerBoundsError(`Negative virtual address cannot be mapped.`);
    }
    return Number(virtualAddress % BigInt(this.TOTAL_SPATIAL_CELLS));
  }

  /**
   * Derives a full SpatialPointer from an arbitrary virtual address.
   */
  public static virtualAddressToPointer(virtualAddress: bigint): SpatialPointer {
    const cellId = this.virtualAddressToCellId(virtualAddress);
    const coord = this.cellIdToCoord(cellId);
    return this.createPointerFromCoord(coord.i, coord.j, coord.k);
  }
}
