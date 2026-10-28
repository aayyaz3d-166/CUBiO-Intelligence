/**
 * ONE Language — Computational ↔ Spatial Memory Bridge
 * =====================================================
 * Provides a safe, bounded runtime object that computational One Language
 * programs can use to read and write the 343-voxel (7×7×7) spatial lattice
 * and query canonical Address369 mappings.
 *
 * Safety guarantees:
 *   - All coordinate access bounds-checked against [0..6, 0..6, 0..6]
 *   - All canonical address access bounds-checked against [26..368]
 *   - Actuation lock: only read + metadata ops are allowed unless the bridge
 *     is explicitly constructed with { actuationLock: false }.
 *   - No filesystem, network, or process access
 *   - No eval / Function constructor
 *
 * Address369 bijection (preserved, unchanged):
 *   address = 26 + i + 7·j + 49·k     where i,j,k ∈ [0..6]
 */
import { CanonicalAddress369 } from '../address369_canonical';
// ─────────────────────────────────────────────────────────────────────────────
// Spatial Bridge
// ─────────────────────────────────────────────────────────────────────────────
export class SpatialBridge {
    /** The 343-cell (7×7×7) in-memory voxel lattice. */
    lattice = [];
    actuationLock;
    gridMemory;
    constructor(options = {}) {
        this.actuationLock = options.actuationLock !== false; // default true
        this.gridMemory = options.gridMemory;
        // Initialise all 343 cells to null
        for (let k = 0; k < 7; k++) {
            this.lattice[k] = [];
            for (let j = 0; j < 7; j++) {
                this.lattice[k][j] = new Array(7).fill(null);
            }
        }
        // If gridMemory is provided, populate existing occupied cells
        if (this.gridMemory) {
            for (let k = 0; k < 7; k++) {
                for (let j = 0; j < 7; j++) {
                    for (let i = 0; i < 7; i++) {
                        const cell = this.gridMemory.read({ x: i, y: j, z: k });
                        if (cell && cell.occupied && cell.data) {
                            this.lattice[k][j][i] = SpatialBridge.decodeCellPayload(cell.data);
                        }
                    }
                }
            }
        }
    }
    /**
     * Encodes a SpatialCellValue into a Uint8Array payload with type tag:
     * [0x00] = null
     * [0x01] = boolean false
     * [0x02] = boolean true
     * [0x03, ...8 bytes float64 BE] = number
     * [0x04, ...UTF-8 bytes] = string
     */
    static encodeCellPayload(val) {
        if (val === null) {
            return new Uint8Array([0x00]);
        }
        if (typeof val === 'boolean') {
            return new Uint8Array([val ? 0x02 : 0x01]);
        }
        if (typeof val === 'number') {
            const buf = new Uint8Array(9);
            buf[0] = 0x03;
            new DataView(buf.buffer).setFloat64(1, val, false);
            return buf;
        }
        if (typeof val === 'string') {
            const encoded = new TextEncoder().encode(val);
            const buf = new Uint8Array(1 + encoded.length);
            buf[0] = 0x04;
            buf.set(encoded, 1);
            return buf;
        }
        return new Uint8Array([0x00]);
    }
    /**
     * Decodes a Uint8Array payload back to a SpatialCellValue.
     */
    static decodeCellPayload(bytes) {
        if (bytes.length === 0)
            return null;
        const tag = bytes[0];
        switch (tag) {
            case 0x00:
                return null;
            case 0x01:
                return false;
            case 0x02:
                return true;
            case 0x03:
                if (bytes.length < 9)
                    return 0;
                return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getFloat64(1, false);
            case 0x04:
                return new TextDecoder().decode(bytes.subarray(1));
            default:
                // Raw string fallback for existing payloads written directly
                return new TextDecoder().decode(bytes);
        }
    }
    // ── Coordinate Validation ─────────────────────────────────────────────────
    assertCoord(i, j, k) {
        if (!Number.isInteger(i) || i < 0 || i > 6 ||
            !Number.isInteger(j) || j < 0 || j > 6 ||
            !Number.isInteger(k) || k < 0 || k > 6) {
            throw new Error(`[SpatialBridge E6001] Coordinate (${i}, ${j}, ${k}) is out of bounds. Valid range: [0..6] per axis.`);
        }
    }
    assertCanonicalSpatial(address) {
        if (!Number.isInteger(address) || address < 26 || address > 368) {
            throw new Error(`[SpatialBridge E6002] Canonical address ${address} is outside the spatial range [26..368].`);
        }
    }
    // ── Public API ────────────────────────────────────────────────────────────
    /**
     * Read a voxel by 3D coordinate.
     * spatial.get(i, j, k) → value
     */
    get(i, j, k) {
        this.assertCoord(i, j, k);
        return this.lattice[k][j][i];
    }
    /**
     * Write a voxel by 3D coordinate.
     * spatial.set(i, j, k, value) — blocked when actuationLock is true.
     */
    set(i, j, k, value) {
        this.assertCoord(i, j, k);
        if (this.actuationLock) {
            throw new Error(`[SpatialBridge E6003] Actuation lock is engaged — write to (${i}, ${j}, ${k}) denied.`);
        }
        this.lattice[k][j][i] = value;
        if (this.gridMemory) {
            if (value === null) {
                this.gridMemory.clear({ x: i, y: j, z: k });
            }
            else {
                const payload = SpatialBridge.encodeCellPayload(value);
                this.gridMemory.write({ x: i, y: j, z: k }, payload);
            }
        }
    }
    /**
     * Read a voxel by canonical address [26..368].
     * spatial.address(addr) → value
     */
    address(addr) {
        this.assertCanonicalSpatial(addr);
        const { i, j, k } = CanonicalAddress369.canonicalAddressToSpatialCoord(addr);
        return this.lattice[k][j][i];
    }
    /**
     * Write a voxel by canonical address [26..368].
     * spatial.addressSet(addr, value) — blocked when actuationLock is true.
     */
    addressSet(addr, value) {
        this.assertCanonicalSpatial(addr);
        if (this.actuationLock) {
            throw new Error(`[SpatialBridge E6003] Actuation lock is engaged — write to address ${addr} denied.`);
        }
        const { i, j, k } = CanonicalAddress369.canonicalAddressToSpatialCoord(addr);
        this.lattice[k][j][i] = value;
        if (this.gridMemory) {
            if (value === null) {
                this.gridMemory.clear({ x: i, y: j, z: k });
            }
            else {
                const payload = SpatialBridge.encodeCellPayload(value);
                this.gridMemory.write({ x: i, y: j, z: k }, payload);
            }
        }
    }
    /**
     * Inspect a voxel — returns full cell metadata without triggering the lock.
     */
    inspect(i, j, k) {
        this.assertCoord(i, j, k);
        const addr = CanonicalAddress369.spatialCoordToCanonicalAddress(i, j, k);
        return {
            value: this.lattice[k][j][i],
            address: addr,
            displayIndex: CanonicalAddress369.toDisplayIndex(addr),
            coord: { i, j, k },
        };
    }
    /**
     * Bulk-load values into the lattice from a flat array indexed by (i + 7j + 49k).
     * Used for deterministic test setup. Ignores the actuation lock.
     */
    loadFlat(values) {
        if (values.length !== 343) {
            throw new Error(`[SpatialBridge E6004] loadFlat expects exactly 343 values, got ${values.length}.`);
        }
        for (let k = 0; k < 7; k++) {
            for (let j = 0; j < 7; j++) {
                for (let i = 0; i < 7; i++) {
                    this.lattice[k][j][i] = values[i + 7 * j + 49 * k];
                }
            }
        }
    }
    /**
     * Export all 343 cells as a flat array indexed by (i + 7j + 49k).
     */
    exportFlat() {
        const out = [];
        for (let k = 0; k < 7; k++) {
            for (let j = 0; j < 7; j++) {
                for (let i = 0; i < 7; i++) {
                    out.push(this.lattice[k][j][i]);
                }
            }
        }
        return out;
    }
    /**
     * Returns true if the actuation lock is currently engaged.
     */
    isLocked() {
        return this.actuationLock;
    }
    /**
     * Build the stdlib-compatible method object that the VM injects
     * into the global 'spatial' identifier.
     */
    toVMObject() {
        // Capture `this` for closures
        const bridge = this;
        return {
            get: (i, j, k) => bridge.get(Number(i), Number(j), Number(k)),
            set: (i, j, k, v) => {
                bridge.set(Number(i), Number(j), Number(k), v);
                return null;
            },
            address: (addr) => bridge.address(Number(addr)),
            addressSet: (addr, v) => {
                bridge.addressSet(Number(addr), v);
                return null;
            },
            inspect: (i, j, k) => {
                const info = bridge.inspect(Number(i), Number(j), Number(k));
                return {
                    value: info.value,
                    address: info.address,
                    displayIndex: info.displayIndex,
                    i: info.coord.i,
                    j: info.coord.j,
                    k: info.coord.k,
                };
            },
            isLocked: () => bridge.isLocked(),
        };
    }
}
