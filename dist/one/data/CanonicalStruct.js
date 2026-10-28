/**
 * ONE Language — Structured Record (Canonical Struct) Data Structure
 * =================================================================
 * Module: @one/data/CanonicalStruct
 *
 * Schema-validated structured records with field types, default values,
 * sealed layouts, and runtime type checking.
 *
 * Invariants:
 *   - Schema type checking on instantiation and mutation (E7003 on mismatch)
 *   - Sealed struct forbids undeclared field insertion (E7009)
 *   - Structural SHA-256 state hash
 */
import * as crypto from 'crypto';
import { toRaw, formatNativeValue, } from '../runtime/NativeValues';
export class CanonicalStruct {
    schema;
    values = new Map();
    frozen = false;
    cachedHash = null;
    constructor(schema, initialValues = {}) {
        this.schema = { ...schema, sealed: schema.sealed !== false };
        // 1. Apply defaults and validate defined fields
        for (const f of this.schema.fields) {
            if (f.name in initialValues) {
                this.validateAndSet(f.name, initialValues[f.name]);
            }
            else if (f.defaultValue !== undefined) {
                this.values.set(f.name, f.defaultValue);
            }
            else if (f.required) {
                throw new Error(`[CanonicalStruct E7003] Missing required field '${f.name}' for struct '${this.schema.name}'`);
            }
        }
        // 2. Check undeclared fields if sealed
        if (this.schema.sealed) {
            const allowed = new Set(this.schema.fields.map((f) => f.name));
            for (const k of Object.keys(initialValues)) {
                if (!allowed.has(k)) {
                    throw new Error(`[CanonicalStruct E7009] Field '${k}' is not defined in sealed struct '${this.schema.name}'`);
                }
            }
        }
    }
    get(field) {
        return this.values.get(field);
    }
    set(field, val) {
        if (this.frozen) {
            throw new Error(`[CanonicalStruct E7010] Cannot mutate frozen struct: set('${field}') denied.`);
        }
        this.validateAndSet(field, val);
        this.cachedHash = null;
        return this;
    }
    validateAndSet(field, val) {
        const fDef = this.schema.fields.find((f) => f.name === field);
        if (!fDef) {
            if (this.schema.sealed) {
                throw new Error(`[CanonicalStruct E7009] Cannot assign undeclared field '${field}' on sealed struct '${this.schema.name}'`);
            }
            this.values.set(field, val);
            return;
        }
        // Type validation
        if (val.kind !== fDef.type) {
            throw new Error(`[CanonicalStruct E7003] Type mismatch for field '${field}' on struct '${this.schema.name}': expected ${fDef.type}, got ${val.kind}`);
        }
        // Custom validator
        if (fDef.validator && !fDef.validator(val)) {
            throw new Error(`[CanonicalStruct E7003] Custom validation failed for field '${field}' on struct '${this.schema.name}'`);
        }
        this.values.set(field, val);
    }
    has(field) {
        return this.values.has(field);
    }
    freeze() {
        this.frozen = true;
        return this;
    }
    isFrozen() {
        return this.frozen;
    }
    getFieldNames() {
        return this.schema.fields.map((f) => f.name);
    }
    computeHash() {
        if (this.cachedHash)
            return this.cachedHash;
        const sortedFields = this.getFieldNames().sort();
        const rep = sortedFields.map((fName) => {
            const v = this.values.get(fName);
            return `${fName}:${v ? formatNativeValue(v) : 'null'}`;
        }).join(';');
        const hash = crypto
            .createHash('sha256')
            .update(`${this.schema.name}:{${rep}}`)
            .digest('hex');
        this.cachedHash = `0xSTRUCT_${hash.substring(0, 16).toUpperCase()}`;
        return this.cachedHash;
    }
    toRecord() {
        const out = {};
        for (const [k, v] of this.values.entries()) {
            out[k] = toRaw(v);
        }
        return out;
    }
}
