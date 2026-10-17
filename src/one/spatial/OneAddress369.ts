/**
 * ONE Language — Native Canonical 369 Addressing System Interface
 * ================================================================
 * Module: @one/spatial/OneAddress369
 *
 * First-class One Language interface to CUBiO's 369 memory addressing space.
 * Exposes:
 *   - Cell addressing (Symbolic 0..25, Spatial 26..368, UI Display Index 1..369)
 *   - Bijective coordinate conversion across all 343 spatial cells (7x7x7)
 *   - Continuous [0..1]³ quantization & unquantization
 *   - Fail-closed bounds validation & formal runtime errors (E7012, E7013)
 *   - Safe Spatial reference handles & permission controls
 *   - Topological neighborhood traversals (6-connected & 26-connected)
 *   - Layer and volumetric spatial slicing
 */

import { CanonicalAddress369, CanonicalAddressInfo } from '../address369_canonical';
import { OneNativeRuntimeError } from '../runtime/NativeErrors';
import { CanonicalRef, RefPermission } from '../data/CanonicalRef';
import { SpatialBridge } from './SpatialBridge';

export interface VoxelCoord {
  i: number;
  j: number;
  k: number;
}

export interface ContinuousCoord {
  x: number;
  y: number;
  z: number;
}

export interface SpatialNeighbor {
  coord: VoxelCoord;
  address: number;
  displayIndex: number;
  distance: number;
}

export class OneAddress369 {
  // ── Canonical Architecture Constants ───────────────────────────────────────
  public static readonly TOTAL_ADDRESSES = CanonicalAddress369.TOTAL_ADDRESSES; // 369
  public static readonly SYMBOLIC_COUNT  = CanonicalAddress369.SYMBOLIC_COUNT;  // 26
  public static readonly SPATIAL_COUNT   = CanonicalAddress369.SPATIAL_COUNT;   // 343
  public static readonly GRID_SIZE       = 7;

  public static readonly SYMBOLIC_START  = CanonicalAddress369.SYMBOLIC_START;  // 0
  public static readonly SYMBOLIC_END    = CanonicalAddress369.SYMBOLIC_END;    // 25

  public static readonly SPATIAL_START   = CanonicalAddress369.SPATIAL_START;   // 26
  public static readonly SPATIAL_END     = CanonicalAddress369.SPATIAL_END;     // 368

  public static readonly DISPLAY_MIN     = 1;
  public static readonly DISPLAY_MAX     = 369;

  // Key canonical anchors
  public static readonly ORIGIN_COORD: VoxelCoord = { i: 0, j: 0, k: 0 };
  public static readonly ORIGIN_ADDRESS = 26;
  public static readonly ORIGIN_DISPLAY_INDEX = 27;

  public static readonly CENTER_COORD: VoxelCoord = { i: 3, j: 3, k: 3 };
  public static readonly CENTER_CELL_INDEX = 171;
  public static readonly CENTER_ADDRESS = 197;
  public static readonly CENTER_DISPLAY_INDEX = 198;

  public static readonly CORNER_MAX_COORD: VoxelCoord = { i: 6, j: 6, k: 6 };
  public static readonly CORNER_MAX_CELL_INDEX = 342;
  public static readonly CORNER_MAX_ADDRESS = 368;
  public static readonly CORNER_MAX_DISPLAY_INDEX = 369;

  // ── 1. Validation & Guards ─────────────────────────────────────────────────

  /**
   * Validates internal address [0..368], throwing fail-closed E7013 on violation.
   */
  public static validateAddress(address: number): void {
    if (!Number.isInteger(address) || address < 0 || address >= this.TOTAL_ADDRESSES) {
      throw new OneNativeRuntimeError(
        'E7013',
        `[OneAddress369 E7013] Address ${address} is outside canonical range [0..368].`
      );
    }
  }

  /**
   * Validates spatial address [26..368], throwing fail-closed E7013 on violation.
   */
  public static validateSpatialAddress(address: number): void {
    if (!Number.isInteger(address) || address < this.SPATIAL_START || address > this.SPATIAL_END) {
      throw new OneNativeRuntimeError(
        'E7013',
        `[OneAddress369 E7013] Address ${address} is outside canonical spatial range [26..368].`
      );
    }
  }

  /**
   * Validates discrete spatial coordinates (i, j, k) in [0..6], throwing fail-closed E7012.
   */
  public static validateCoord(i: number, j: number, k: number): void {
    if (
      !Number.isInteger(i) || i < 0 || i > 6 ||
      !Number.isInteger(j) || j < 0 || j > 6 ||
      !Number.isInteger(k) || k < 0 || k > 6
    ) {
      throw new OneNativeRuntimeError(
        'E7012',
        `[OneAddress369 E7012] Spatial coordinate (${i}, ${j}, ${k}) is outside valid 7x7x7 grid range [0..6].`
      );
    }
  }

  /**
   * Validates UI Display Index [1..369].
   */
  public static validateDisplayIndex(displayIndex: number): void {
    if (!Number.isInteger(displayIndex) || displayIndex < this.DISPLAY_MIN || displayIndex > this.DISPLAY_MAX) {
      throw new OneNativeRuntimeError(
        'E7013',
        `[OneAddress369 E7013] Display Index ${displayIndex} is outside valid UI range [1..369].`
      );
    }
  }

  // ── 2. Layer Classification ────────────────────────────────────────────────

  public static isSymbolic(address: number): boolean {
    return Number.isInteger(address) && address >= this.SYMBOLIC_START && address <= this.SYMBOLIC_END;
  }

  public static isSpatial(address: number): boolean {
    return Number.isInteger(address) && address >= this.SPATIAL_START && address <= this.SPATIAL_END;
  }

  public static inspectAddress(address: number): CanonicalAddressInfo {
    this.validateAddress(address);
    return CanonicalAddress369.inspectAddress(address);
  }

  // ── 3. Coordinate Conversion & Bijective Mapping ───────────────────────────

  /**
   * Bijective mapping: (i, j, k) in [0..6] -> canonical spatial address [26..368].
   */
  public static coordToAddress(i: number, j: number, k: number): number {
    this.validateCoord(i, j, k);
    return CanonicalAddress369.spatialCoordToCanonicalAddress(i, j, k);
  }

  /**
   * Bijective mapping: canonical spatial address [26..368] -> (i, j, k) in [0..6].
   */
  public static addressToCoord(address: number): VoxelCoord {
    this.validateSpatialAddress(address);
    return CanonicalAddress369.canonicalAddressToSpatialCoord(address);
  }

  /**
   * Converts canonical address [0..368] to UI Display Index [1..369].
   */
  public static toDisplayIndex(address: number): number {
    this.validateAddress(address);
    return CanonicalAddress369.toDisplayIndex(address);
  }

  /**
   * Converts UI Display Index [1..369] back to canonical address [0..368].
   */
  public static fromDisplayIndex(displayIndex: number): number {
    this.validateDisplayIndex(displayIndex);
    return CanonicalAddress369.fromDisplayIndex(displayIndex);
  }

  public static formatDisplayIndex(address: number): string {
    this.validateAddress(address);
    return CanonicalAddress369.formatDisplayIndex(address);
  }

  // ── 4. Continuous Normalization & Quantization ──────────────────────────────

  /**
   * Quantizes continuous normalized coordinates [0.0..1.0]³ to discrete lattice coordinates [0..6]³.
   */
  public static quantizeContinuousCoord(x: number, y: number, z: number): VoxelCoord {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      throw new OneNativeRuntimeError(
        'E7012',
        `[OneAddress369 E7012] Continuous coordinates (${x}, ${y}, ${z}) must be finite numbers.`
      );
    }
    const clamp = (v: number) => Math.min(1.0, Math.max(0.0, v));
    const cx = clamp(x);
    const cy = clamp(y);
    const cz = clamp(z);

    const i = Math.min(6, Math.max(0, Math.round(cx * 6)));
    const j = Math.min(6, Math.max(0, Math.round(cy * 6)));
    const k = Math.min(6, Math.max(0, Math.round(cz * 6)));

    return { i, j, k };
  }

  /**
   * Unquantizes discrete lattice coordinates [0..6]³ to continuous normalized coordinates [0.0..1.0]³.
   */
  public static unquantizeToContinuousCoord(i: number, j: number, k: number): ContinuousCoord {
    this.validateCoord(i, j, k);
    return {
      x: i / 6.0,
      y: j / 6.0,
      z: k / 6.0,
    };
  }

  // ── 5. Spatial References ──────────────────────────────────────────────────

  /**
   * Creates a sovereign CanonicalRef to a spatial voxel.
   */
  public static createSpatialRef(
    i: number,
    j: number,
    k: number,
    bridge: SpatialBridge,
    permission: RefPermission = 'READ_WRITE'
  ): CanonicalRef {
    this.validateCoord(i, j, k);
    return CanonicalRef.createSpatialRef(i, j, k, bridge, permission);
  }

  /**
   * Creates a sovereign CanonicalRef to any canonical address [0..368].
   */
  public static createAddressRef(
    address: number,
    bridge: SpatialBridge,
    permission: RefPermission = 'READ_WRITE'
  ): CanonicalRef {
    this.validateAddress(address);
    return CanonicalRef.createAddressRef(address, bridge, permission);
  }

  // ── 6. Topological Neighborhood Traversal ──────────────────────────────────

  /**
   * Retrieves 6-connected Manhattan neighbors (adjacent along primary axes).
   */
  public static getNeighbors6(i: number, j: number, k: number): SpatialNeighbor[] {
    this.validateCoord(i, j, k);
    const deltas = [
      [1, 0, 0], [-1, 0, 0],
      [0, 1, 0], [0, -1, 0],
      [0, 0, 1], [0, 0, -1],
    ];

    const neighbors: SpatialNeighbor[] = [];
    for (const [di, dj, dk] of deltas) {
      const ni = i + di;
      const nj = j + dj;
      const nk = k + dk;
      if (ni >= 0 && ni <= 6 && nj >= 0 && nj <= 6 && nk >= 0 && nk <= 6) {
        const address = this.coordToAddress(ni, nj, nk);
        neighbors.push({
          coord: { i: ni, j: nj, k: nk },
          address,
          displayIndex: this.toDisplayIndex(address),
          distance: 1,
        });
      }
    }
    return neighbors;
  }

  /**
   * Retrieves 26-connected Moore neighbors (all adjacent surrounding cells in 3x3x3 block).
   */
  public static getNeighbors26(i: number, j: number, k: number): SpatialNeighbor[] {
    this.validateCoord(i, j, k);
    const neighbors: SpatialNeighbor[] = [];

    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        for (let dk = -1; dk <= 1; dk++) {
          if (di === 0 && dj === 0 && dk === 0) continue;
          const ni = i + di;
          const nj = j + dj;
          const nk = k + dk;
          if (ni >= 0 && ni <= 6 && nj >= 0 && nj <= 6 && nk >= 0 && nk <= 6) {
            const address = this.coordToAddress(ni, nj, nk);
            const dist = Math.sqrt(di * di + dj * dj + dk * dk);
            neighbors.push({
              coord: { i: ni, j: nj, k: nk },
              address,
              displayIndex: this.toDisplayIndex(address),
              distance: dist,
            });
          }
        }
      }
    }

    return neighbors;
  }

  // ── 7. Distance Metrics ────────────────────────────────────────────────────

  public static distanceManhattan(a: VoxelCoord, b: VoxelCoord): number {
    this.validateCoord(a.i, a.j, a.k);
    this.validateCoord(b.i, b.j, b.k);
    return Math.abs(a.i - b.i) + Math.abs(a.j - b.j) + Math.abs(a.k - b.k);
  }

  public static distanceEuclidean(a: VoxelCoord, b: VoxelCoord): number {
    this.validateCoord(a.i, a.j, a.k);
    this.validateCoord(b.i, b.j, b.k);
    const di = a.i - b.i;
    const dj = a.j - b.j;
    const dk = a.k - b.k;
    return Math.sqrt(di * di + dj * dj + dk * dk);
  }

  public static distanceChebyshev(a: VoxelCoord, b: VoxelCoord): number {
    this.validateCoord(a.i, a.j, a.k);
    this.validateCoord(b.i, b.j, b.k);
    return Math.max(Math.abs(a.i - b.i), Math.abs(a.j - b.j), Math.abs(a.k - b.k));
  }

  // ── 8. Spatial Slicing ─────────────────────────────────────────────────────

  /**
   * Slices all 49 canonical addresses in a given Z/K layer (k in [0..6]).
   */
  public static sliceLayerK(k: number): number[] {
    if (!Number.isInteger(k) || k < 0 || k > 6) {
      throw new OneNativeRuntimeError(
        'E7012',
        `[OneAddress369 E7012] Layer index k=${k} is outside valid range [0..6].`
      );
    }
    const addresses: number[] = [];
    for (let j = 0; j < 7; j++) {
      for (let i = 0; i < 7; i++) {
        addresses.push(this.coordToAddress(i, j, k));
      }
    }
    return addresses;
  }

  /**
   * Slices all canonical addresses within a bounding sub-volume box.
   */
  public static sliceVolume(minCoord: VoxelCoord, maxCoord: VoxelCoord): number[] {
    this.validateCoord(minCoord.i, minCoord.j, minCoord.k);
    this.validateCoord(maxCoord.i, maxCoord.j, maxCoord.k);

    const minI = Math.min(minCoord.i, maxCoord.i);
    const maxI = Math.max(minCoord.i, maxCoord.i);
    const minJ = Math.min(minCoord.j, maxCoord.j);
    const maxJ = Math.max(minCoord.j, maxCoord.j);
    const minK = Math.min(minCoord.k, maxCoord.k);
    const maxK = Math.max(minCoord.k, maxCoord.k);

    const addresses: number[] = [];
    for (let k = minK; k <= maxK; k++) {
      for (let j = minJ; j <= maxJ; j++) {
        for (let i = minI; i <= maxI; i++) {
          addresses.push(this.coordToAddress(i, j, k));
        }
      }
    }
    return addresses;
  }

  // ── 9. Harmonic 3-6-9 Resonance ───────────────────────────────────────────

  /**
   * Calculates 369 harmonic frequency band (3, 6, or 9 MHz) based on canonical digital root.
   */
  public static harmonicResonance(address: number): 3 | 6 | 9 {
    this.validateAddress(address);
    // 3-6-9 harmonic mapping based on digital root modulo 9
    const disp = this.toDisplayIndex(address);
    const mod = disp % 9;
    if (mod === 0) return 9;
    if (mod === 3 || mod === 6) return mod as 3 | 6;
    // For non-3/6/9 residues, map to nearest harmonic tier
    if (mod < 3) return 3;
    if (mod < 6) return 6;
    return 9;
  }
}
