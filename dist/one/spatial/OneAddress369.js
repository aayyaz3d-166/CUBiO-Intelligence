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
import { CanonicalAddress369 } from '../address369_canonical';
import { OneNativeRuntimeError } from '../runtime/NativeErrors';
import { CanonicalRef } from '../data/CanonicalRef';
export class OneAddress369 {
    // ── Canonical Architecture Constants ───────────────────────────────────────
    static TOTAL_ADDRESSES = CanonicalAddress369.TOTAL_ADDRESSES; // 369
    static SYMBOLIC_COUNT = CanonicalAddress369.SYMBOLIC_COUNT; // 26
    static SPATIAL_COUNT = CanonicalAddress369.SPATIAL_COUNT; // 343
    static GRID_SIZE = 7;
    static SYMBOLIC_START = CanonicalAddress369.SYMBOLIC_START; // 0
    static SYMBOLIC_END = CanonicalAddress369.SYMBOLIC_END; // 25
    static SPATIAL_START = CanonicalAddress369.SPATIAL_START; // 26
    static SPATIAL_END = CanonicalAddress369.SPATIAL_END; // 368
    static DISPLAY_MIN = 1;
    static DISPLAY_MAX = 369;
    // Key canonical anchors
    static ORIGIN_COORD = { i: 0, j: 0, k: 0 };
    static ORIGIN_ADDRESS = 26;
    static ORIGIN_DISPLAY_INDEX = 27;
    static CENTER_COORD = { i: 3, j: 3, k: 3 };
    static CENTER_CELL_INDEX = 171;
    static CENTER_ADDRESS = 197;
    static CENTER_DISPLAY_INDEX = 198;
    static CORNER_MAX_COORD = { i: 6, j: 6, k: 6 };
    static CORNER_MAX_CELL_INDEX = 342;
    static CORNER_MAX_ADDRESS = 368;
    static CORNER_MAX_DISPLAY_INDEX = 369;
    // ── 1. Validation & Guards ─────────────────────────────────────────────────
    /**
     * Validates internal address [0..368], throwing fail-closed E7013 on violation.
     */
    static validateAddress(address) {
        if (!Number.isInteger(address) || address < 0 || address >= this.TOTAL_ADDRESSES) {
            throw new OneNativeRuntimeError('E7013', `[OneAddress369 E7013] Address ${address} is outside canonical range [0..368].`);
        }
    }
    /**
     * Validates spatial address [26..368], throwing fail-closed E7013 on violation.
     */
    static validateSpatialAddress(address) {
        if (!Number.isInteger(address) || address < this.SPATIAL_START || address > this.SPATIAL_END) {
            throw new OneNativeRuntimeError('E7013', `[OneAddress369 E7013] Address ${address} is outside canonical spatial range [26..368].`);
        }
    }
    /**
     * Validates discrete spatial coordinates (i, j, k) in [0..6], throwing fail-closed E7012.
     */
    static validateCoord(i, j, k) {
        if (!Number.isInteger(i) || i < 0 || i > 6 ||
            !Number.isInteger(j) || j < 0 || j > 6 ||
            !Number.isInteger(k) || k < 0 || k > 6) {
            throw new OneNativeRuntimeError('E7012', `[OneAddress369 E7012] Spatial coordinate (${i}, ${j}, ${k}) is outside valid 7x7x7 grid range [0..6].`);
        }
    }
    /**
     * Validates UI Display Index [1..369].
     */
    static validateDisplayIndex(displayIndex) {
        if (!Number.isInteger(displayIndex) || displayIndex < this.DISPLAY_MIN || displayIndex > this.DISPLAY_MAX) {
            throw new OneNativeRuntimeError('E7013', `[OneAddress369 E7013] Display Index ${displayIndex} is outside valid UI range [1..369].`);
        }
    }
    // ── 2. Layer Classification ────────────────────────────────────────────────
    static isSymbolic(address) {
        return Number.isInteger(address) && address >= this.SYMBOLIC_START && address <= this.SYMBOLIC_END;
    }
    static isSpatial(address) {
        return Number.isInteger(address) && address >= this.SPATIAL_START && address <= this.SPATIAL_END;
    }
    static inspectAddress(address) {
        this.validateAddress(address);
        return CanonicalAddress369.inspectAddress(address);
    }
    // ── 3. Coordinate Conversion & Bijective Mapping ───────────────────────────
    /**
     * Bijective mapping: (i, j, k) in [0..6] -> canonical spatial address [26..368].
     */
    static coordToAddress(i, j, k) {
        this.validateCoord(i, j, k);
        return CanonicalAddress369.spatialCoordToCanonicalAddress(i, j, k);
    }
    /**
     * Bijective mapping: canonical spatial address [26..368] -> (i, j, k) in [0..6].
     */
    static addressToCoord(address) {
        this.validateSpatialAddress(address);
        return CanonicalAddress369.canonicalAddressToSpatialCoord(address);
    }
    /**
     * Converts canonical address [0..368] to UI Display Index [1..369].
     */
    static toDisplayIndex(address) {
        this.validateAddress(address);
        return CanonicalAddress369.toDisplayIndex(address);
    }
    /**
     * Converts UI Display Index [1..369] back to canonical address [0..368].
     */
    static fromDisplayIndex(displayIndex) {
        this.validateDisplayIndex(displayIndex);
        return CanonicalAddress369.fromDisplayIndex(displayIndex);
    }
    static formatDisplayIndex(address) {
        this.validateAddress(address);
        return CanonicalAddress369.formatDisplayIndex(address);
    }
    // ── 4. Continuous Normalization & Quantization ──────────────────────────────
    /**
     * Quantizes continuous normalized coordinates [0.0..1.0]³ to discrete lattice coordinates [0..6]³.
     */
    static quantizeContinuousCoord(x, y, z) {
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
            throw new OneNativeRuntimeError('E7012', `[OneAddress369 E7012] Continuous coordinates (${x}, ${y}, ${z}) must be finite numbers.`);
        }
        const clamp = (v) => Math.min(1.0, Math.max(0.0, v));
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
    static unquantizeToContinuousCoord(i, j, k) {
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
    static createSpatialRef(i, j, k, bridge, permission = 'READ_WRITE') {
        this.validateCoord(i, j, k);
        return CanonicalRef.createSpatialRef(i, j, k, bridge, permission);
    }
    /**
     * Creates a sovereign CanonicalRef to any canonical address [0..368].
     */
    static createAddressRef(address, bridge, permission = 'READ_WRITE') {
        this.validateAddress(address);
        return CanonicalRef.createAddressRef(address, bridge, permission);
    }
    // ── 6. Topological Neighborhood Traversal ──────────────────────────────────
    /**
     * Retrieves 6-connected Manhattan neighbors (adjacent along primary axes).
     */
    static getNeighbors6(i, j, k) {
        this.validateCoord(i, j, k);
        const deltas = [
            [1, 0, 0], [-1, 0, 0],
            [0, 1, 0], [0, -1, 0],
            [0, 0, 1], [0, 0, -1],
        ];
        const neighbors = [];
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
    static getNeighbors26(i, j, k) {
        this.validateCoord(i, j, k);
        const neighbors = [];
        for (let di = -1; di <= 1; di++) {
            for (let dj = -1; dj <= 1; dj++) {
                for (let dk = -1; dk <= 1; dk++) {
                    if (di === 0 && dj === 0 && dk === 0)
                        continue;
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
    static distanceManhattan(a, b) {
        this.validateCoord(a.i, a.j, a.k);
        this.validateCoord(b.i, b.j, b.k);
        return Math.abs(a.i - b.i) + Math.abs(a.j - b.j) + Math.abs(a.k - b.k);
    }
    static distanceEuclidean(a, b) {
        this.validateCoord(a.i, a.j, a.k);
        this.validateCoord(b.i, b.j, b.k);
        const di = a.i - b.i;
        const dj = a.j - b.j;
        const dk = a.k - b.k;
        return Math.sqrt(di * di + dj * dj + dk * dk);
    }
    static distanceChebyshev(a, b) {
        this.validateCoord(a.i, a.j, a.k);
        this.validateCoord(b.i, b.j, b.k);
        return Math.max(Math.abs(a.i - b.i), Math.abs(a.j - b.j), Math.abs(a.k - b.k));
    }
    // ── 8. Spatial Slicing ─────────────────────────────────────────────────────
    /**
     * Slices all 49 canonical addresses in a given Z/K layer (k in [0..6]).
     */
    static sliceLayerK(k) {
        if (!Number.isInteger(k) || k < 0 || k > 6) {
            throw new OneNativeRuntimeError('E7012', `[OneAddress369 E7012] Layer index k=${k} is outside valid range [0..6].`);
        }
        const addresses = [];
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
    static sliceVolume(minCoord, maxCoord) {
        this.validateCoord(minCoord.i, minCoord.j, minCoord.k);
        this.validateCoord(maxCoord.i, maxCoord.j, maxCoord.k);
        const minI = Math.min(minCoord.i, maxCoord.i);
        const maxI = Math.max(minCoord.i, maxCoord.i);
        const minJ = Math.min(minCoord.j, maxCoord.j);
        const maxJ = Math.max(minCoord.j, maxCoord.j);
        const minK = Math.min(minCoord.k, maxCoord.k);
        const maxK = Math.max(minCoord.k, maxCoord.k);
        const addresses = [];
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
    static harmonicResonance(address) {
        this.validateAddress(address);
        // 3-6-9 harmonic mapping based on digital root modulo 9
        const disp = this.toDisplayIndex(address);
        const mod = disp % 9;
        if (mod === 0)
            return 9;
        if (mod === 3 || mod === 6)
            return mod;
        // For non-3/6/9 residues, map to nearest harmonic tier
        if (mod < 3)
            return 3;
        if (mod < 6)
            return 6;
        return 9;
    }
}
