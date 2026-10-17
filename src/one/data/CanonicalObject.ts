/**
 * ONE Language — Canonical Object Data Structure
 * ===============================================
 * Module: @one/data/CanonicalObject
 *
 * Ordered key-value dictionary with deterministic sorted-key iteration,
 * freeze/immutability protection, structural hashing, and memory estimation.
 *
 * Invariants:
 *   - Iteration order is strictly lexicographical (deterministic)
 *   - Mutations on frozen objects throw fail-closed errors
 *   - Structural hash (SHA-256) is bit-exact across executions
 */

import * as crypto from 'crypto';
import {
  NativeValue,
  toRaw,
  fromRaw,
  isEqual,
  formatNativeValue,
} from '../runtime/NativeValues';

export class CanonicalObject {
  private fields: Map<string, NativeValue> = new Map();
  private frozen: boolean = false;
  private cachedHash: string | null = null;

  constructor(initialEntries?: Record<string, NativeValue> | Map<string, NativeValue>) {
    if (initialEntries) {
      if (initialEntries instanceof Map) {
        for (const [k, v] of initialEntries.entries()) {
          this.fields.set(k, v);
        }
      } else {
        for (const [k, v] of Object.entries(initialEntries)) {
          this.fields.set(k, v);
        }
      }
    }
  }

  public get(key: string): NativeValue | undefined {
    return this.fields.get(key);
  }

  public set(key: string, value: NativeValue): this {
    if (this.frozen) {
      throw new Error(
        `[CanonicalObject E7010] Cannot mutate frozen canonical object: set('${key}') denied.`
      );
    }
    this.fields.set(key, value);
    this.cachedHash = null; // Invalidate cache
    return this;
  }

  public has(key: string): boolean {
    return this.fields.has(key);
  }

  public delete(key: string): boolean {
    if (this.frozen) {
      throw new Error(
        `[CanonicalObject E7010] Cannot mutate frozen canonical object: delete('${key}') denied.`
      );
    }
    const res = this.fields.delete(key);
    if (res) this.cachedHash = null;
    return res;
  }

  public clear(): void {
    if (this.frozen) {
      throw new Error(
        `[CanonicalObject E7010] Cannot mutate frozen canonical object: clear() denied.`
      );
    }
    this.fields.clear();
    this.cachedHash = null;
  }

  public get size(): number {
    return this.fields.size;
  }

  public freeze(): this {
    this.frozen = true;
    return this;
  }

  public isFrozen(): boolean {
    return this.frozen;
  }

  /**
   * Deterministic sorted keys (lexicographical order).
   */
  public keys(): string[] {
    return Array.from(this.fields.keys()).sort();
  }

  public values(): NativeValue[] {
    return this.keys().map((k) => this.fields.get(k)!);
  }

  public entries(): Array<[string, NativeValue]> {
    return this.keys().map((k) => [k, this.fields.get(k)!]);
  }

  /**
   * Structural equality against another CanonicalObject.
   */
  public equals(other: CanonicalObject): boolean {
    if (this.size !== other.size) return false;
    const myKeys = this.keys();
    const otherKeys = other.keys();
    for (let i = 0; i < myKeys.length; i++) {
      if (myKeys[i] !== otherKeys[i]) return false;
      const vA = this.fields.get(myKeys[i])!;
      const vB = other.get(otherKeys[i])!;
      if (!isEqual(vA, vB)) return false;
    }
    return true;
  }

  /**
   * Computes a deterministic SHA-256 structural state hash.
   */
  public computeHash(): string {
    if (this.cachedHash) return this.cachedHash;

    const representation = this.keys().map((k) => {
      const v = this.fields.get(k)!;
      return `${k}:${formatNativeValue(v)}`;
    }).join(';');

    const hash = crypto
      .createHash('sha256')
      .update(representation)
      .digest('hex');

    this.cachedHash = `0xOBJ_${hash.substring(0, 16).toUpperCase()}`;
    return this.cachedHash;
  }

  /**
   * Estimates heap byte footprint of this object.
   */
  public estimateMemoryBytes(): number {
    let bytes = 64; // Object header overhead
    for (const [k, v] of this.fields.entries()) {
      bytes += k.length * 2 + 16; // String key overhead
      bytes += this.estimateValueBytes(v);
    }
    return bytes;
  }

  private estimateValueBytes(v: NativeValue): number {
    switch (v.kind) {
      case 'null':
      case 'bool':
        return 8;
      case 'int':
      case 'float':
      case 'canonical_address':
        return 16;
      case 'string':
        return (v.value as string).length * 2 + 16;
      case 'spatial_coord':
        return 24;
      case 'byte_buffer':
        return (v.value as Uint8Array).byteLength + 16;
      default:
        return 32;
    }
  }

  public toRecord(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const k of this.keys()) {
      out[k] = toRaw(this.fields.get(k)!);
    }
    return out;
  }

  public static fromRecord(rec: Record<string, unknown>): CanonicalObject {
    const obj = new CanonicalObject();
    for (const [k, v] of Object.entries(rec)) {
      obj.set(k, fromRaw(v));
    }
    return obj;
  }
}
