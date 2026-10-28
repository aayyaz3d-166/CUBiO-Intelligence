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
import { formatNativeValue, isEqual, } from '../runtime/NativeValues';
export class CanonicalMap {
    keyMap = new Map(); // canonicalKeyStr -> keyNativeValue
    valueMap = new Map(); // canonicalKeyStr -> valueNativeValue
    frozen = false;
    cachedHash = null;
    static toKeyString(key) {
        return `${key.kind}::${formatNativeValue(key)}`;
    }
    set(key, value) {
        if (this.frozen) {
            throw new Error(`[CanonicalMap E7010] Cannot mutate frozen canonical map: set() denied.`);
        }
        const keyStr = CanonicalMap.toKeyString(key);
        this.keyMap.set(keyStr, key);
        this.valueMap.set(keyStr, value);
        this.cachedHash = null;
        return this;
    }
    get(key) {
        const keyStr = CanonicalMap.toKeyString(key);
        return this.valueMap.get(keyStr);
    }
    has(key) {
        const keyStr = CanonicalMap.toKeyString(key);
        return this.valueMap.has(keyStr);
    }
    delete(key) {
        if (this.frozen) {
            throw new Error(`[CanonicalMap E7010] Cannot mutate frozen canonical map: delete() denied.`);
        }
        const keyStr = CanonicalMap.toKeyString(key);
        this.keyMap.delete(keyStr);
        const res = this.valueMap.delete(keyStr);
        if (res)
            this.cachedHash = null;
        return res;
    }
    clear() {
        if (this.frozen) {
            throw new Error(`[CanonicalMap E7010] Cannot mutate frozen canonical map: clear() denied.`);
        }
        this.keyMap.clear();
        this.valueMap.clear();
        this.cachedHash = null;
    }
    get size() {
        return this.valueMap.size;
    }
    freeze() {
        this.frozen = true;
        return this;
    }
    isFrozen() {
        return this.frozen;
    }
    /**
     * Deterministic sorted iteration keys.
     */
    keys() {
        const sortedKeyStrs = Array.from(this.keyMap.keys()).sort();
        return sortedKeyStrs.map((k) => this.keyMap.get(k));
    }
    values() {
        const sortedKeyStrs = Array.from(this.keyMap.keys()).sort();
        return sortedKeyStrs.map((k) => this.valueMap.get(k));
    }
    entries() {
        const sortedKeyStrs = Array.from(this.keyMap.keys()).sort();
        return sortedKeyStrs.map((k) => [this.keyMap.get(k), this.valueMap.get(k)]);
    }
    equals(other) {
        if (this.size !== other.size)
            return false;
        for (const [k, v] of this.entries()) {
            const otherVal = other.get(k);
            if (!otherVal || !isEqual(v, otherVal)) {
                return false;
            }
        }
        return true;
    }
    computeHash() {
        if (this.cachedHash)
            return this.cachedHash;
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
    estimateMemoryBytes() {
        let bytes = 80; // Map overhead
        for (const [kStr] of this.keyMap.entries()) {
            bytes += kStr.length * 2 + 48; // Key + value slot overhead
        }
        return bytes;
    }
}
