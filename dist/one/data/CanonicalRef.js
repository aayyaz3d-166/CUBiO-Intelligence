/**
 * ONE Language — Canonical Reference Data Structure
 * =================================================
 * Module: @one/data/CanonicalRef
 *
 * Safe handle/pointer indirection supporting Heap, 3D Spatial Voxel,
 * and Canonical Address369 targets with strict capability masks.
 *
 * Invariants:
 *   - Zero raw pointer manipulation / zero unsafe memory access
 *   - Spatial references bound strictly to 7x7x7 lattice [0..6]
 *   - Mutations on READ_ONLY references or actuation-locked cells throw fail-closed errors
 */
import { createNull, fromRaw, toRaw } from '../runtime/NativeValues';
import { CanonicalAddress369 } from '../address369_canonical';
export class CanonicalRef {
    refId;
    kind;
    permission;
    heapTarget;
    spatialTarget;
    addressTarget;
    constructor(refId, kind, permission) {
        this.refId = refId;
        this.kind = kind;
        this.permission = permission;
    }
    // ── Factory Constructors ──────────────────────────────────────────────────
    static createHeapRef(refId, target, permission = 'READ_WRITE') {
        const ref = new CanonicalRef(refId, 'HEAP', permission);
        ref.heapTarget = target;
        return ref;
    }
    static createSpatialRef(i, j, k, bridge, permission = 'READ_WRITE') {
        if (i < 0 || i > 6 || j < 0 || j > 6 || k < 0 || k > 6) {
            throw new Error(`[CanonicalRef E7012] Spatial voxel coordinate (${i}, ${j}, ${k}) out of bounds [0..6].`);
        }
        const addr = CanonicalAddress369.spatialCoordToCanonicalAddress(i, j, k);
        const refId = `one://spatial/${i}/${j}/${k}#addr${addr}`;
        const ref = new CanonicalRef(refId, 'SPATIAL_VOXEL', permission);
        ref.spatialTarget = { i, j, k, bridge };
        return ref;
    }
    static createAddressRef(address, bridge, permission = 'READ_WRITE') {
        if (address < 0 || address > 368) {
            throw new Error(`[CanonicalRef E7013] Canonical address ${address} out of bounds [0..368].`);
        }
        const disp = CanonicalAddress369.toDisplayIndex(address);
        const refId = `one://addr/${address}#disp${disp}`;
        const ref = new CanonicalRef(refId, 'CANONICAL_ADDRESS', permission);
        ref.addressTarget = { address, bridge };
        return ref;
    }
    // ── Operations ────────────────────────────────────────────────────────────
    deref() {
        switch (this.kind) {
            case 'HEAP': {
                if (!this.heapTarget)
                    return createNull();
                return this.heapTarget.getter();
            }
            case 'SPATIAL_VOXEL': {
                if (!this.spatialTarget)
                    return createNull();
                const { i, j, k, bridge } = this.spatialTarget;
                const raw = bridge.get(i, j, k);
                return fromRaw(raw);
            }
            case 'CANONICAL_ADDRESS': {
                if (!this.addressTarget)
                    return createNull();
                const { address, bridge } = this.addressTarget;
                const raw = bridge.address(address);
                return fromRaw(raw);
            }
            default:
                return createNull();
        }
    }
    assign(value) {
        if (this.permission === 'READ_ONLY') {
            throw new Error(`[CanonicalRef E7010] Cannot assign to READ_ONLY reference '${this.refId}'.`);
        }
        switch (this.kind) {
            case 'HEAP': {
                if (!this.heapTarget?.setter) {
                    throw new Error(`[CanonicalRef E7010] Target of reference '${this.refId}' is not writable.`);
                }
                this.heapTarget.setter(value);
                break;
            }
            case 'SPATIAL_VOXEL': {
                if (!this.spatialTarget)
                    break;
                const { i, j, k, bridge } = this.spatialTarget;
                bridge.set(i, j, k, toRaw(value));
                break;
            }
            case 'CANONICAL_ADDRESS': {
                if (!this.addressTarget)
                    break;
                const { address, bridge } = this.addressTarget;
                bridge.addressSet(address, toRaw(value));
                break;
            }
        }
    }
    isReadOnly() {
        return this.permission === 'READ_ONLY';
    }
    toURI() {
        return this.refId;
    }
}
