/**
 * ONE Language — Canonical Array Data Structure
 * ==============================================
 * Module: @one/data/CanonicalArray
 *
 * Indexed sequence of native values with capacity bounds, immutability freezing,
 * structural equality, memory tracking, and deterministic state hashing.
 *
 * Invariants:
 *   - Strict integer indexing within [0..length-1]
 *   - Out-of-bounds access throws fail-closed error E7008
 *   - Bit-exact structural SHA-256 state hashing
 */

import * as crypto from 'crypto';
import {
  NativeValue,
  toRaw,
  fromRaw,
  isEqual,
  formatNativeValue,
} from '../runtime/NativeValues';

export class CanonicalArray {
  private elements: NativeValue[] = [];
  private frozen: boolean = false;
  private cachedHash: string | null = null;

  constructor(initialElements?: NativeValue[]) {
    if (initialElements) {
      this.elements = [...initialElements];
    }
  }

  public get length(): number {
    return this.elements.length;
  }

  public get(index: number): NativeValue {
    if (!Number.isInteger(index) || index < 0 || index >= this.elements.length) {
      throw new Error(
        `[CanonicalArray E7008] Index ${index} out of bounds for array length ${this.elements.length}`
      );
    }
    return this.elements[index];
  }

  public set(index: number, value: NativeValue): this {
    if (this.frozen) {
      throw new Error(
        `[CanonicalArray E7010] Cannot mutate frozen canonical array: set(${index}) denied.`
      );
    }
    if (!Number.isInteger(index) || index < 0 || index >= this.elements.length) {
      throw new Error(
        `[CanonicalArray E7008] Index ${index} out of bounds for array length ${this.elements.length}`
      );
    }
    this.elements[index] = value;
    this.cachedHash = null;
    return this;
  }

  public push(value: NativeValue): number {
    if (this.frozen) {
      throw new Error(
        `[CanonicalArray E7010] Cannot mutate frozen canonical array: push() denied.`
      );
    }
    this.elements.push(value);
    this.cachedHash = null;
    return this.elements.length;
  }

  public pop(): NativeValue | undefined {
    if (this.frozen) {
      throw new Error(
        `[CanonicalArray E7010] Cannot mutate frozen canonical array: pop() denied.`
      );
    }
    const val = this.elements.pop();
    if (val !== undefined) this.cachedHash = null;
    return val;
  }

  public shift(): NativeValue | undefined {
    if (this.frozen) {
      throw new Error(
        `[CanonicalArray E7010] Cannot mutate frozen canonical array: shift() denied.`
      );
    }
    const val = this.elements.shift();
    if (val !== undefined) this.cachedHash = null;
    return val;
  }

  public unshift(value: NativeValue): number {
    if (this.frozen) {
      throw new Error(
        `[CanonicalArray E7010] Cannot mutate frozen canonical array: unshift() denied.`
      );
    }
    this.elements.unshift(value);
    this.cachedHash = null;
    return this.elements.length;
  }

  public slice(start?: number, end?: number): CanonicalArray {
    return new CanonicalArray(this.elements.slice(start, end));
  }

  public reverse(): this {
    if (this.frozen) {
      throw new Error(
        `[CanonicalArray E7010] Cannot mutate frozen canonical array: reverse() denied.`
      );
    }
    this.elements.reverse();
    this.cachedHash = null;
    return this;
  }

  public freeze(): this {
    this.frozen = true;
    return this;
  }

  public isFrozen(): boolean {
    return this.frozen;
  }

  public equals(other: CanonicalArray): boolean {
    if (this.length !== other.length) return false;
    for (let i = 0; i < this.elements.length; i++) {
      if (!isEqual(this.elements[i], other.get(i))) {
        return false;
      }
    }
    return true;
  }

  public computeHash(): string {
    if (this.cachedHash) return this.cachedHash;

    const rep = this.elements.map((v) => formatNativeValue(v)).join(',');
    const hash = crypto
      .createHash('sha256')
      .update(`[${rep}]`)
      .digest('hex');

    this.cachedHash = `0xARR_${hash.substring(0, 16).toUpperCase()}`;
    return this.cachedHash;
  }

  public estimateMemoryBytes(): number {
    let bytes = 48; // Array header overhead
    for (const el of this.elements) {
      bytes += 8; // Pointer overhead
      switch (el.kind) {
        case 'null':
        case 'bool':
          bytes += 8;
          break;
        case 'int':
        case 'float':
        case 'canonical_address':
          bytes += 16;
          break;
        case 'string':
          bytes += (el.value as string).length * 2 + 16;
          break;
        case 'spatial_coord':
          bytes += 24;
          break;
        default:
          bytes += 32;
          break;
      }
    }
    return bytes;
  }

  public toArray(): unknown[] {
    return this.elements.map(toRaw);
  }

  public static fromArray(arr: unknown[]): CanonicalArray {
    return new CanonicalArray(arr.map(fromRaw));
  }
}
