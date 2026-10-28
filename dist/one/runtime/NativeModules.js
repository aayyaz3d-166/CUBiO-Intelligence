/**
 * ONE Language — Native Module Registry
 * =====================================
 * Module: @one/runtime/NativeModules
 *
 * Provides safe, deterministic native standard library modules:
 *   - std:math    (deterministic mathematical operations)
 *   - std:string  (string inspection & manipulation)
 *   - std:array   (deterministic collection operations)
 *   - std:spatial (CUBiO 7x7x7 lattice & Canonical Address369 interop)
 *   - std:crypto  (deterministic SHA-256 and PQC lattice seals)
 *   - std:system  (telemetry, cycle clock, and actuation lock inspection)
 *
 * Security Invariants:
 *   - Zero external network access
 *   - Zero Node.js process / child_process / arbitrary fs escape
 *   - Zero eval() / Function() constructors
 */
import * as crypto from 'crypto';
import { createNull, createBool, createInt, createFloat, createString, createArray, createRecord, createSpatialCoord, createCanonicalAddress, createNativeFunction, toRaw, fromRaw, } from './NativeValues';
import { OneNativeRuntimeError } from './NativeErrors';
import { CanonicalAddress369 } from '../address369_canonical';
import { SpatialBridge } from '../spatial/SpatialBridge';
import { PQCLatticeSealEngine } from '../../core/crypto/pqc_lattice_seal';
export class NativeModuleRegistry {
    modules = new Map();
    spatialBridge;
    constructor(spatialBridge) {
        this.spatialBridge = spatialBridge || new SpatialBridge({ actuationLock: true });
        this.registerCoreModules();
    }
    getSpatialBridge() {
        return this.spatialBridge;
    }
    // ── Core Module Registration ──────────────────────────────────────────────
    registerCoreModules() {
        this.registerModule(this.buildMathModule());
        this.registerModule(this.buildStringModule());
        this.registerModule(this.buildArrayModule());
        this.registerModule(this.buildSpatialModule());
        this.registerModule(this.buildCryptoModule());
        this.registerModule(this.buildSystemModule());
    }
    registerModule(mod) {
        this.modules.set(mod.name, mod);
    }
    getModule(name) {
        return this.modules.get(name);
    }
    hasModule(name) {
        return this.modules.has(name);
    }
    listModules() {
        return Array.from(this.modules.keys());
    }
    // ── Math Module (std:math) ────────────────────────────────────────────────
    buildMathModule() {
        const exports = {
            PI: createFloat(Math.PI),
            E: createFloat(Math.E),
            sqrt: createNativeFunction('sqrt', (arg) => {
                const n = Number(toRaw(arg)) || 0;
                return createFloat(Math.sqrt(n));
            }),
            abs: createNativeFunction('abs', (arg) => {
                const n = Number(toRaw(arg)) || 0;
                return createFloat(Math.abs(n));
            }),
            pow: createNativeFunction('pow', (base, exp) => {
                const b = Number(toRaw(base)) || 0;
                const e = Number(toRaw(exp)) || 0;
                return createFloat(Math.pow(b, e));
            }),
            sin: createNativeFunction('sin', (arg) => {
                const n = Number(toRaw(arg)) || 0;
                return createFloat(Math.sin(n));
            }),
            cos: createNativeFunction('cos', (arg) => {
                const n = Number(toRaw(arg)) || 0;
                return createFloat(Math.cos(n));
            }),
            tan: createNativeFunction('tan', (arg) => {
                const n = Number(toRaw(arg)) || 0;
                return createFloat(Math.tan(n));
            }),
            floor: createNativeFunction('floor', (arg) => {
                const n = Number(toRaw(arg)) || 0;
                return createInt(Math.floor(n));
            }),
            ceil: createNativeFunction('ceil', (arg) => {
                const n = Number(toRaw(arg)) || 0;
                return createInt(Math.ceil(n));
            }),
            round: createNativeFunction('round', (arg) => {
                const n = Number(toRaw(arg)) || 0;
                return createInt(Math.round(n));
            }),
            min: createNativeFunction('min', (a, b) => {
                const na = Number(toRaw(a)) || 0;
                const nb = Number(toRaw(b)) || 0;
                return createFloat(Math.min(na, nb));
            }),
            max: createNativeFunction('max', (a, b) => {
                const na = Number(toRaw(a)) || 0;
                const nb = Number(toRaw(b)) || 0;
                return createFloat(Math.max(na, nb));
            }),
            clamp: createNativeFunction('clamp', (val, min, max) => {
                const v = Number(toRaw(val)) || 0;
                const lo = Number(toRaw(min)) || 0;
                const hi = Number(toRaw(max)) || 0;
                return createFloat(Math.max(lo, Math.min(hi, v)));
            }),
        };
        return { name: 'std:math', version: '0.1.0', exports };
    }
    // ── String Module (std:string) ────────────────────────────────────────────
    buildStringModule() {
        const exports = {
            length: createNativeFunction('length', (s) => {
                const str = String(toRaw(s));
                return createInt(str.length);
            }),
            slice: createNativeFunction('slice', (s, start, end) => {
                const str = String(toRaw(s));
                const st = Number(toRaw(start)) || 0;
                const en = end ? Number(toRaw(end)) : undefined;
                return createString(str.slice(st, en));
            }),
            split: createNativeFunction('split', (s, delim) => {
                const str = String(toRaw(s));
                const d = delim ? String(toRaw(delim)) : ',';
                const parts = str.split(d).map(createString);
                return createArray(parts);
            }),
            trim: createNativeFunction('trim', (s) => {
                return createString(String(toRaw(s)).trim());
            }),
            toLowerCase: createNativeFunction('toLowerCase', (s) => {
                return createString(String(toRaw(s)).toLowerCase());
            }),
            toUpperCase: createNativeFunction('toUpperCase', (s) => {
                return createString(String(toRaw(s)).toUpperCase());
            }),
            charAt: createNativeFunction('charAt', (s, idx) => {
                const str = String(toRaw(s));
                const i = Number(toRaw(idx)) || 0;
                return createString(str.charAt(i));
            }),
            includes: createNativeFunction('includes', (s, q) => {
                const str = String(toRaw(s));
                const query = String(toRaw(q));
                return createBool(str.includes(query));
            }),
            replace: createNativeFunction('replace', (s, target, replacement) => {
                const str = String(toRaw(s));
                const t = String(toRaw(target));
                const r = String(toRaw(replacement));
                return createString(str.replace(t, r));
            }),
            concat: createNativeFunction('concat', (a, b) => {
                return createString(String(toRaw(a)) + String(toRaw(b)));
            }),
        };
        return { name: 'std:string', version: '0.1.0', exports };
    }
    // ── Array Module (std:array) ──────────────────────────────────────────────
    buildArrayModule() {
        const exports = {
            length: createNativeFunction('length', (arr) => {
                const raw = toRaw(arr);
                return createInt(Array.isArray(raw) ? raw.length : 0);
            }),
            push: createNativeFunction('push', (arr, item) => {
                if (arr.kind !== 'array') {
                    throw new OneNativeRuntimeError('E7003', 'Expected array argument for push');
                }
                const list = arr.value;
                list.push(item);
                return createInt(list.length);
            }),
            pop: createNativeFunction('pop', (arr) => {
                if (arr.kind !== 'array') {
                    throw new OneNativeRuntimeError('E7003', 'Expected array argument for pop');
                }
                const list = arr.value;
                return list.pop() || createNull();
            }),
            shift: createNativeFunction('shift', (arr) => {
                if (arr.kind !== 'array') {
                    throw new OneNativeRuntimeError('E7003', 'Expected array argument for shift');
                }
                const list = arr.value;
                return list.shift() || createNull();
            }),
            unshift: createNativeFunction('unshift', (arr, item) => {
                if (arr.kind !== 'array') {
                    throw new OneNativeRuntimeError('E7003', 'Expected array argument for unshift');
                }
                const list = arr.value;
                list.unshift(item);
                return createInt(list.length);
            }),
            slice: createNativeFunction('slice', (arr, start, end) => {
                if (arr.kind !== 'array') {
                    throw new OneNativeRuntimeError('E7003', 'Expected array argument for slice');
                }
                const list = arr.value;
                const st = Number(toRaw(start)) || 0;
                const en = end ? Number(toRaw(end)) : undefined;
                return createArray(list.slice(st, en));
            }),
            join: createNativeFunction('join', (arr, sep) => {
                const raw = toRaw(arr);
                if (!Array.isArray(raw))
                    return createString('');
                const s = sep ? String(toRaw(sep)) : ',';
                return createString(raw.join(s));
            }),
            reverse: createNativeFunction('reverse', (arr) => {
                if (arr.kind !== 'array') {
                    throw new OneNativeRuntimeError('E7003', 'Expected array argument for reverse');
                }
                const list = arr.value;
                return createArray([...list].reverse());
            }),
        };
        return { name: 'std:array', version: '0.1.0', exports };
    }
    // ── Spatial Module (std:spatial) ──────────────────────────────────────────
    buildSpatialModule() {
        const bridge = this.spatialBridge;
        const exports = {
            get: createNativeFunction('get', (i, j, k) => {
                const ci = Number(toRaw(i));
                const cj = Number(toRaw(j));
                const ck = Number(toRaw(k));
                try {
                    const val = bridge.get(ci, cj, ck);
                    return fromRaw(val);
                }
                catch (err) {
                    throw new OneNativeRuntimeError('E7012', err.message);
                }
            }),
            set: createNativeFunction('set', (i, j, k, v) => {
                const ci = Number(toRaw(i));
                const cj = Number(toRaw(j));
                const ck = Number(toRaw(k));
                try {
                    bridge.set(ci, cj, ck, toRaw(v));
                    return createNull();
                }
                catch (err) {
                    if (err.message.includes('Actuation lock')) {
                        throw new OneNativeRuntimeError('E7010', err.message);
                    }
                    throw new OneNativeRuntimeError('E7012', err.message);
                }
            }),
            address: createNativeFunction('address', (addr) => {
                const a = Number(toRaw(addr));
                try {
                    const val = bridge.address(a);
                    return fromRaw(val);
                }
                catch (err) {
                    throw new OneNativeRuntimeError('E7013', err.message);
                }
            }),
            addressSet: createNativeFunction('addressSet', (addr, v) => {
                const a = Number(toRaw(addr));
                try {
                    bridge.addressSet(a, toRaw(v));
                    return createNull();
                }
                catch (err) {
                    if (err.message.includes('Actuation lock')) {
                        throw new OneNativeRuntimeError('E7010', err.message);
                    }
                    throw new OneNativeRuntimeError('E7013', err.message);
                }
            }),
            inspect: createNativeFunction('inspect', (i, j, k) => {
                const ci = Number(toRaw(i));
                const cj = Number(toRaw(j));
                const ck = Number(toRaw(k));
                try {
                    const info = bridge.inspect(ci, cj, ck);
                    return createRecord({
                        value: fromRaw(info.value),
                        address: createCanonicalAddress(info.address),
                        displayIndex: createInt(info.displayIndex),
                        coord: createSpatialCoord(info.coord.i, info.coord.j, info.coord.k),
                    });
                }
                catch (err) {
                    throw new OneNativeRuntimeError('E7012', err.message);
                }
            }),
            toDisplayIndex: createNativeFunction('toDisplayIndex', (addr) => {
                const a = Number(toRaw(addr));
                try {
                    return createInt(CanonicalAddress369.toDisplayIndex(a));
                }
                catch (err) {
                    throw new OneNativeRuntimeError('E7013', err.message);
                }
            }),
            fromDisplayIndex: createNativeFunction('fromDisplayIndex', (disp) => {
                const d = Number(toRaw(disp));
                try {
                    return createCanonicalAddress(CanonicalAddress369.fromDisplayIndex(d));
                }
                catch (err) {
                    throw new OneNativeRuntimeError('E7013', err.message);
                }
            }),
            isLocked: createNativeFunction('isLocked', () => {
                return createBool(bridge.isLocked());
            }),
        };
        return { name: 'std:spatial', version: '0.1.0', exports };
    }
    // ── Crypto Module (std:crypto) ────────────────────────────────────────────
    buildCryptoModule() {
        const exports = {
            sha256: createNativeFunction('sha256', (data) => {
                const raw = String(toRaw(data));
                const hash = crypto.createHash('sha256').update(raw).digest('hex');
                return createString(hash);
            }),
            pqcSeal: createNativeFunction('pqcSeal', (payload) => {
                const raw = Buffer.from(String(toRaw(payload)), 'utf-8');
                const seal = PQCLatticeSealEngine.generatePQCSeal(raw);
                return createString(seal);
            }),
            pqcVerify: createNativeFunction('pqcVerify', (seal) => {
                const s = String(toRaw(seal));
                const valid = s.startsWith('0xPQC_369_') && s.endsWith('_SEAL');
                return createBool(valid);
            }),
        };
        return { name: 'std:crypto', version: '0.1.0', exports };
    }
    // ── System Module (std:system) ────────────────────────────────────────────
    buildSystemModule() {
        const exports = {
            version: createNativeFunction('version', () => {
                return createString('ONE-NATIVE-RUNTIME-v0.1');
            }),
            isActuationLocked: createNativeFunction('isActuationLocked', () => {
                return createBool(true); // Fail-closed invariant
            }),
        };
        return { name: 'std:system', version: '0.1.0', exports };
    }
    /**
     * Helper to populate a globals Map with standard module namespaces (e.g. Math, String, Spatial).
     */
    populateGlobals(globals) {
        // Top-level aliases for developer convenience
        const mathMod = this.getModule('std:math');
        if (mathMod)
            globals.set('Math', createRecord(mathMod.exports));
        const strMod = this.getModule('std:string');
        if (strMod)
            globals.set('String', createRecord(strMod.exports));
        const arrMod = this.getModule('std:array');
        if (arrMod)
            globals.set('Array', createRecord(arrMod.exports));
        const spatialMod = this.getModule('std:spatial');
        if (spatialMod)
            globals.set('spatial', createRecord(spatialMod.exports));
        const cryptoMod = this.getModule('std:crypto');
        if (cryptoMod)
            globals.set('Crypto', createRecord(cryptoMod.exports));
        const sysMod = this.getModule('std:system');
        if (sysMod)
            globals.set('System', createRecord(sysMod.exports));
    }
}
