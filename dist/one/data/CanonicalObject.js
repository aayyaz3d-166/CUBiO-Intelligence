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
import { toRaw, fromRaw, isEqual, formatNativeValue, } from '../runtime/NativeValues';
export class CanonicalObject {
    fields = new Map();
    frozen = false;
    cachedHash = null;
    constructor(initialEntries) {
        if (initialEntries) {
            if (initialEntries instanceof Map) {
                for (const [k, v] of initialEntries.entries()) {
                    this.fields.set(k, v);
                }
            }
            else {
                for (const [k, v] of Object.entries(initialEntries)) {
                    this.fields.set(k, v);
                }
            }
        }
    }
    get(key) {
        return this.fields.get(key);
    }
    set(key, value) {
        if (this.frozen) {
            throw new Error(`[CanonicalObject E7010] Cannot mutate frozen canonical object: set('${key}') denied.`);
        }
        this.fields.set(key, value);
        this.cachedHash = null; // Invalidate cache
        return this;
    }
    has(key) {
        return this.fields.has(key);
    }
    delete(key) {
        if (this.frozen) {
            throw new Error(`[CanonicalObject E7010] Cannot mutate frozen canonical object: delete('${key}') denied.`);
        }
        const res = this.fields.delete(key);
        if (res)
            this.cachedHash = null;
        return res;
    }
    clear() {
        if (this.frozen) {
            throw new Error(`[CanonicalObject E7010] Cannot mutate frozen canonical object: clear() denied.`);
        }
        this.fields.clear();
        this.cachedHash = null;
    }
    get size() {
        return this.fields.size;
    }
    freeze() {
        this.frozen = true;
        return this;
    }
    isFrozen() {
        return this.frozen;
    }
    /**
     * Deterministic sorted keys (lexicographical order).
     */
    keys() {
        return Array.from(this.fields.keys()).sort();
    }
    values() {
        return this.keys().map((k) => this.fields.get(k));
    }
    entries() {
        return this.keys().map((k) => [k, this.fields.get(k)]);
    }
    /**
     * Structural equality against another CanonicalObject.
     */
    equals(other) {
        if (this.size !== other.size)
            return false;
        const myKeys = this.keys();
        const otherKeys = other.keys();
        for (let i = 0; i < myKeys.length; i++) {
            if (myKeys[i] !== otherKeys[i])
                return false;
            const vA = this.fields.get(myKeys[i]);
            const vB = other.get(otherKeys[i]);
            if (!isEqual(vA, vB))
                return false;
        }
        return true;
    }
    /**
     * Computes a deterministic SHA-256 structural state hash.
     */
    computeHash() {
        if (this.cachedHash)
            return this.cachedHash;
        const representation = this.keys().map((k) => {
            const v = this.fields.get(k);
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
    estimateMemoryBytes() {
        let bytes = 64; // Object header overhead
        for (const [k, v] of this.fields.entries()) {
            bytes += k.length * 2 + 16; // String key overhead
            bytes += this.estimateValueBytes(v);
        }
        return bytes;
    }
    estimateValueBytes(v) {
        switch (v.kind) {
            case 'null':
            case 'bool':
                return 8;
            case 'int':
            case 'float':
            case 'canonical_address':
                return 16;
            case 'string':
                return v.value.length * 2 + 16;
            case 'spatial_coord':
                return 24;
            case 'byte_buffer':
                return v.value.byteLength + 16;
            default:
                return 32;
        }
    }
    toRecord() {
        const out = {};
        for (const k of this.keys()) {
            out[k] = toRaw(this.fields.get(k));
        }
        return out;
    }
    static fromRecord(rec) {
        const obj = new CanonicalObject();
        for (const [k, v] of Object.entries(rec)) {
            obj.set(k, fromRaw(v));
        }
        return obj;
    }
}
