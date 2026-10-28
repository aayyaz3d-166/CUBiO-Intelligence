/**
 * ONE Language — Canonical Map Data Structure
 * ============================================
 * Module: @one/data/CanonicalMap
 *
 * Associative map supporting arbitrary NativeValue keys (including Spatial Coordinates
 * and Canonical Addresses) with deterministic iteration ordering and state hashing.
 *
 * Invariants:
 *   - Any valid NativeValue can serve as a key
 *   - Iteration order is strictly deterministic (sorted by canonical key representation)
 *   - Immutability guards on frozen maps
 */

import * as crypto from 'crypto';
import {
  NativeValue,
  formatNativeValue,
  isEqual,
} from '../runtime/NativeValues';

export class CanonicalMap {
  private keyMap: Map<string, NativeValue> = new Map(); // canonicalKeyStr -> keyNativeValue
  private valueMap: Map<string, NativeValue> = new Map(); // canonicalKeyStr -> valueNativeValue
  private frozen: boolean = false;
  private cachedHash: string | null = null;

  public static toKeyString(key: NativeValue): string {
    return `${key.kind}::${formatNativeValue(key)}`;
  }

  public set(key: NativeValue, value: NativeValue): this {
    if (this.frozen) {
      throw new Error(
        `[CanonicalMap E7010] Cannot mutate frozen canonical map: set() denied.`
      );
    }
    const keyStr = CanonicalMap.toKeyString(key);
    this.keyMap.set(keyStr, key);
    this.valueMap.set(keyStr, value);
    this.cachedHash = null;
    return this;
  }

  public get(key: NativeValue): NativeValue | undefined {
    const keyStr = CanonicalMap.toKeyString(key);
    return this.valueMap.get(keyStr);
  }

  public has(key: NativeValue): boolean {
    const keyStr = CanonicalMap.toKeyString(key);
    return this.valueMap.has(keyStr);
  }

  public delete(key: NativeValue): boolean {
    if (this.frozen) {
      throw new Error(
        `[CanonicalMap E7010] Cannot mutate frozen canonical map: delete() denied.`
      );
    }
    const keyStr = CanonicalMap.toKeyString(key);
    this.keyMap.delete(keyStr);
    const res = this.valueMap.delete(keyStr);
    if (res) this.cachedHash = null;
    return res;
  }

  public clear(): void {
    if (this.frozen) {
      throw new Error(
        `[CanonicalMap E7010] Cannot mutate frozen canonical map: clear() denied.`
      );
    }
    this.keyMap.clear();
    this.valueMap.clear();
    this.cachedHash = null;
  }

  public get size(): number {
    return this.valueMap.size;
  }

  public freeze(): this {
    this.frozen = true;
    return this;
  }

  public isFrozen(): boolean {
    return this.frozen;
  }

  /**
   * Deterministic sorted iteration keys.
   */
  public keys(): NativeValue[] {
    const sortedKeyStrs = Array.from(this.keyMap.keys()).sort();
    return sortedKeyStrs.map((k) => this.keyMap.get(k)!);
  }

  public values(): NativeValue[] {
    const sortedKeyStrs = Array.from(this.keyMap.keys()).sort();
    return sortedKeyStrs.map((k) => this.valueMap.get(k)!);
  }

  public entries(): Array<[NativeValue, NativeValue]> {
    const sortedKeyStrs = Array.from(this.keyMap.keys()).sort();
    return sortedKeyStrs.map((k) => [this.keyMap.get(k)!, this.valueMap.get(k)!]);
  }

  public equals(other: CanonicalMap): boolean {
    if (this.size !== other.size) return false;
    for (const [k, v] of this.entries()) {
      const otherVal = other.get(k);
      if (!otherVal || !isEqual(v, otherVal)) {
        return false;
      }
    }
    return true;
  }

  public computeHash(): string {
    if (this.cachedHash) return this.cachedHash;

    const rep = this.entries().map(([k, v]) => {
      return `${formatNativeValue(k)}=>${formatNativeValue(v)}`;
    }).join(';');

    const hash = crypto
      .createHash('sha256')
      .update(`{${rep}}`)
      .digest('hex');

    this.cachedHash = `0xMAP_${hash.substring(0, 16).toUpperCase()}`;
    return this.cachedHash;
  }

  public estimateMemoryBytes(): number {
    let bytes = 80; // Map overhead
    for (const [kStr] of this.keyMap.entries()) {
      bytes += kStr.length * 2 + 48; // Key + value slot overhead
    }
    return bytes;
  }
}
