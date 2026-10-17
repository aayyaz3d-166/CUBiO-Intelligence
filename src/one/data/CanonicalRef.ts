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

import { NativeValue, createNull, fromRaw, toRaw } from '../runtime/NativeValues';
import { SpatialBridge } from '../spatial/SpatialBridge';
import { CanonicalAddress369 } from '../address369_canonical';

export type RefKind = 'HEAP' | 'SPATIAL_VOXEL' | 'CANONICAL_ADDRESS';
export type RefPermission = 'READ_ONLY' | 'READ_WRITE';

export interface SpatialVoxelTarget {
  i: number;
  j: number;
  k: number;
  bridge: SpatialBridge;
}

export interface CanonicalAddressTarget {
  address: number;
  bridge: SpatialBridge;
}

export interface HeapTarget {
  getter: () => NativeValue;
  setter?: (val: NativeValue) => void;
}

export class CanonicalRef {
  public readonly refId: string;
  public readonly kind: RefKind;
  public readonly permission: RefPermission;

  private heapTarget?: HeapTarget;
  private spatialTarget?: SpatialVoxelTarget;
  private addressTarget?: CanonicalAddressTarget;

  private constructor(
    refId: string,
    kind: RefKind,
    permission: RefPermission
  ) {
    this.refId = refId;
    this.kind = kind;
    this.permission = permission;
  }

  // ── Factory Constructors ──────────────────────────────────────────────────

  public static createHeapRef(
    refId: string,
    target: HeapTarget,
    permission: RefPermission = 'READ_WRITE'
  ): CanonicalRef {
    const ref = new CanonicalRef(refId, 'HEAP', permission);
    ref.heapTarget = target;
    return ref;
  }

  public static createSpatialRef(
    i: number,
    j: number,
    k: number,
    bridge: SpatialBridge,
    permission: RefPermission = 'READ_WRITE'
  ): CanonicalRef {
    if (i < 0 || i > 6 || j < 0 || j > 6 || k < 0 || k > 6) {
      throw new Error(
        `[CanonicalRef E7012] Spatial voxel coordinate (${i}, ${j}, ${k}) out of bounds [0..6].`
      );
    }
    const addr = CanonicalAddress369.spatialCoordToCanonicalAddress(i, j, k);
    const refId = `one://spatial/${i}/${j}/${k}#addr${addr}`;
    const ref = new CanonicalRef(refId, 'SPATIAL_VOXEL', permission);
    ref.spatialTarget = { i, j, k, bridge };
    return ref;
  }

  public static createAddressRef(
    address: number,
    bridge: SpatialBridge,
    permission: RefPermission = 'READ_WRITE'
  ): CanonicalRef {
    if (address < 0 || address > 368) {
      throw new Error(
        `[CanonicalRef E7013] Canonical address ${address} out of bounds [0..368].`
      );
    }
    const disp = CanonicalAddress369.toDisplayIndex(address);
    const refId = `one://addr/${address}#disp${disp}`;
    const ref = new CanonicalRef(refId, 'CANONICAL_ADDRESS', permission);
    ref.addressTarget = { address, bridge };
    return ref;
  }

  // ── Operations ────────────────────────────────────────────────────────────

  public deref(): NativeValue {
    switch (this.kind) {
      case 'HEAP': {
        if (!this.heapTarget) return createNull();
        return this.heapTarget.getter();
      }

      case 'SPATIAL_VOXEL': {
        if (!this.spatialTarget) return createNull();
        const { i, j, k, bridge } = this.spatialTarget;
        const raw = bridge.get(i, j, k);
        return fromRaw(raw);
      }

      case 'CANONICAL_ADDRESS': {
        if (!this.addressTarget) return createNull();
        const { address, bridge } = this.addressTarget;
        const raw = bridge.address(address);
        return fromRaw(raw);
      }

      default:
        return createNull();
    }
  }

  public assign(value: NativeValue): void {
    if (this.permission === 'READ_ONLY') {
      throw new Error(
        `[CanonicalRef E7010] Cannot assign to READ_ONLY reference '${this.refId}'.`
      );
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
        if (!this.spatialTarget) break;
        const { i, j, k, bridge } = this.spatialTarget;
        bridge.set(i, j, k, toRaw(value) as any);
        break;
      }

      case 'CANONICAL_ADDRESS': {
        if (!this.addressTarget) break;
        const { address, bridge } = this.addressTarget;
        bridge.addressSet(address, toRaw(value) as any);
        break;
      }
    }
  }

  public isReadOnly(): boolean {
    return this.permission === 'READ_ONLY';
  }

  public toURI(): string {
    return this.refId;
  }
}
