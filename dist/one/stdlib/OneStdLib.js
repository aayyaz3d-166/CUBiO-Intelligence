/**
 * ONE Language — Standard Library Foundation (v0.1)
 * =================================================
 * Verified built-in standard APIs for:
 *   - String
 *   - Number
 *   - Boolean
 *   - Array
 *   - Object
 *   - Math
 *   - JSON
 *   - Date/Time
 *   - File I/O
 *
 * Designed to be zero-eval, pure in-memory, deterministic, and securely bounded.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Tensor } from '../tensor/Tensor';
import { AutogradOps } from '../tensor/autograd/AutogradOps';
export class StdString {
    static length(str) {
        return String(str).length;
    }
    static toLowerCase(str) {
        return String(str).toLowerCase();
    }
    static toUpperCase(str) {
        return String(str).toUpperCase();
    }
    static trim(str) {
        return String(str).trim();
    }
    static split(str, delimiter = ',') {
        return String(str).split(delimiter);
    }
    static slice(str, start, end) {
        return String(str).slice(start, end);
    }
    static replace(str, target, replacement) {
        return String(str).replace(target, replacement);
    }
    static includes(str, search) {
        return String(str).includes(search);
    }
    static charAt(str, index) {
        return String(str).charAt(index);
    }
}
export class StdNumber {
    static parseInt(val) {
        return parseInt(String(val), 10);
    }
    static parseFloat(val) {
        return parseFloat(String(val));
    }
    static toFixed(num, digits = 2) {
        return Number(num).toFixed(digits);
    }
    static isNaN(val) {
        return Number.isNaN(Number(val));
    }
    static isFinite(val) {
        return Number.isFinite(Number(val));
    }
    static toI32(val) {
        return (Number(val) || 0) | 0;
    }
    static toF32(val) {
        return Math.fround(Number(val) || 0.0);
    }
    static isI32(val) {
        return typeof val === 'number' && Number.isInteger(val) && val >= -2147483648 && val <= 2147483647;
    }
    static isF32(val) {
        return typeof val === 'number' && !Number.isNaN(val);
    }
}
export class StdBoolean {
    static parse(val) {
        if (typeof val === 'string') {
            const lower = val.trim().toLowerCase();
            return lower === 'true' || lower === '1';
        }
        return Boolean(val);
    }
    static toBool(val) {
        if (typeof val === 'string') {
            const lower = val.trim().toLowerCase();
            return lower === 'true' || lower === '1';
        }
        return Boolean(val);
    }
    static isBool(val) {
        return typeof val === 'boolean';
    }
    static toString(val) {
        return Boolean(val) ? 'true' : 'false';
    }
}
export class StdArray {
    static length(arr) {
        return Array.isArray(arr) ? arr.length : 0;
    }
    static push(arr, item) {
        if (!Array.isArray(arr))
            return 0;
        arr.push(item);
        return arr.length;
    }
    static pop(arr) {
        if (!Array.isArray(arr) || arr.length === 0)
            return null;
        return arr.pop();
    }
    static shift(arr) {
        if (!Array.isArray(arr) || arr.length === 0)
            return null;
        return arr.shift();
    }
    static unshift(arr, item) {
        if (!Array.isArray(arr))
            return 0;
        arr.unshift(item);
        return arr.length;
    }
    static join(arr, separator = ',') {
        return Array.isArray(arr) ? arr.join(separator) : '';
    }
    static slice(arr, start, end) {
        return Array.isArray(arr) ? arr.slice(start, end) : [];
    }
    static indexOf(arr, item) {
        return Array.isArray(arr) ? arr.indexOf(item) : -1;
    }
    static reverse(arr) {
        if (!Array.isArray(arr))
            return [];
        return [...arr].reverse();
    }
}
export class StdObject {
    static keys(obj) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj))
            return [];
        return Object.keys(obj);
    }
    static values(obj) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj))
            return [];
        return Object.values(obj);
    }
    static entries(obj) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj))
            return [];
        return Object.entries(obj);
    }
    static hasKey(obj, key) {
        if (!obj || typeof obj !== 'object')
            return false;
        return Object.prototype.hasOwnProperty.call(obj, key);
    }
}
export class StdMath {
    static PI = Math.PI;
    static E = Math.E;
    static abs(x) { return Math.abs(x); }
    static sqrt(x) { return Math.sqrt(x); }
    static pow(base, exp) { return Math.pow(base, exp); }
    static sin(x) { return Math.sin(x); }
    static cos(x) { return Math.cos(x); }
    static tan(x) { return Math.tan(x); }
    static floor(x) { return Math.floor(x); }
    static ceil(x) { return Math.ceil(x); }
    static round(x) { return Math.round(x); }
    static min(a, b) { return Math.min(a, b); }
    static max(a, b) { return Math.max(a, b); }
}
export class StdJSON {
    static stringify(val) {
        return JSON.stringify(val);
    }
    static parse(text) {
        return JSON.parse(text);
    }
}
export class StdDateTime {
    static now() {
        return Date.now();
    }
    static timestamp() {
        return Math.floor(Date.now() / 1000);
    }
    static iso() {
        return new Date().toISOString();
    }
}
export class StdIO {
    static readText(filePath) {
        const resolved = path.resolve(filePath);
        if (!fs.existsSync(resolved)) {
            throw new Error(`[StdIO Error] File not found: ${filePath}`);
        }
        return fs.readFileSync(resolved, 'utf-8');
    }
    static writeText(filePath, content) {
        const resolved = path.resolve(filePath);
        const dir = path.dirname(resolved);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(resolved, content, 'utf-8');
        return true;
    }
    static exists(filePath) {
        return fs.existsSync(path.resolve(filePath));
    }
}
/**
 * Built-in functions map ready for injection into UnifiedVM.
 */
export const ONE_BUILTIN_FUNCTIONS = {
    // Math functions
    abs: (x) => StdMath.abs(x),
    sqrt: (x) => StdMath.sqrt(x),
    pow: (b, e) => StdMath.pow(b, e),
    sin: (x) => StdMath.sin(x),
    cos: (x) => StdMath.cos(x),
    tan: (x) => StdMath.tan(x),
    floor: (x) => StdMath.floor(x),
    ceil: (x) => StdMath.ceil(x),
    round: (x) => StdMath.round(x),
    min: (a, b) => StdMath.min(a, b),
    max: (a, b) => StdMath.max(a, b),
    // String functions
    str_len: (s) => StdString.length(s),
    str_lower: (s) => StdString.toLowerCase(s),
    str_upper: (s) => StdString.toUpperCase(s),
    str_trim: (s) => StdString.trim(s),
    str_split: (s, d) => StdString.split(s, d),
    str_slice: (s, start, end) => StdString.slice(s, start, end),
    str_replace: (s, t, r) => StdString.replace(s, t, r),
    str_includes: (s, q) => StdString.includes(s, q),
    // Array functions
    arr_len: (a) => StdArray.length(a),
    arr_push: (a, i) => StdArray.push(a, i),
    arr_pop: (a) => StdArray.pop(a),
    arr_shift: (a) => StdArray.shift(a),
    arr_unshift: (a, i) => StdArray.unshift(a, i),
    arr_join: (a, sep) => StdArray.join(a, sep),
    arr_slice: (a, start, end) => StdArray.slice(a, start, end),
    arr_index_of: (a, item) => StdArray.indexOf(a, item),
    arr_reverse: (a) => StdArray.reverse(a),
    len: (val) => (Array.isArray(val) ? val.length : typeof val === 'string' ? val.length : 0),
    push: (arr, item) => StdArray.push(arr, item),
    pop: (arr) => StdArray.pop(arr),
    // Number functions
    parse_int: (v) => StdNumber.parseInt(v),
    parse_float: (v) => StdNumber.parseFloat(v),
    to_fixed: (n, d) => StdNumber.toFixed(n, d),
    is_nan: (v) => StdNumber.isNaN(v),
    i32: (v) => StdNumber.toI32(v),
    f32: (v) => StdNumber.toF32(v),
    bool: (v) => StdBoolean.toBool(v),
    is_i32: (v) => StdNumber.isI32(v),
    is_f32: (v) => StdNumber.isF32(v),
    is_bool: (v) => StdBoolean.isBool(v),
    // Object functions
    obj_keys: (o) => StdObject.keys(o),
    obj_values: (o) => StdObject.values(o),
    obj_entries: (o) => StdObject.entries(o),
    obj_has_key: (o, k) => StdObject.hasKey(o, k),
    // JSON functions
    json_stringify: (v) => StdJSON.stringify(v),
    json_parse: (s) => StdJSON.parse(s),
    // Time functions
    time_now: () => StdDateTime.now(),
    time_timestamp: () => StdDateTime.timestamp(),
    time_iso: () => StdDateTime.iso(),
    // File I/O functions
    io_read: (path) => StdIO.readText(path),
    io_write: (path, content) => StdIO.writeText(path, content),
    io_exists: (path) => StdIO.exists(path),
    // Common aliases
    trim: (s) => StdString.trim(s),
    length: (val) => (Array.isArray(val) ? val.length : typeof val === 'string' ? val.length : 0),
    // Tensor functions
    tensor_zeros: (shape) => Tensor.zeros(shape),
    tensor_ones: (shape) => Tensor.ones(shape),
    tensor_fromArray: (arr, shape) => Tensor.fromArray(arr, shape),
    tensor_randn: (shape, seed) => Tensor.randn(shape, seed),
    tensor_matmul: (a, b) => (a instanceof Tensor ? a.matmul(b) : null),
    tensor_add: (a, b) => (a instanceof Tensor ? a.add(b) : null),
    tensor_sub: (a, b) => (a instanceof Tensor ? a.sub(b) : null),
    tensor_mul: (a, b) => (a instanceof Tensor ? a.mul(b) : null),
    tensor_div: (a, b) => (a instanceof Tensor ? a.div(b) : null),
    tensor_relu: (a) => (a instanceof Tensor ? a.relu() : null),
    tensor_gelu: (a) => (a instanceof Tensor ? a.gelu() : null),
    tensor_softmax: (a, axis = -1) => (a instanceof Tensor ? a.softmax(axis) : null),
    tensor_layernorm: (x, gamma, beta, eps = 1e-5) => AutogradOps.layerNorm(x, gamma, beta, eps),
    tensor_sum: (a, axis, keepdim = false) => (a instanceof Tensor ? a.sum(axis, keepdim) : null),
    tensor_mean: (a, axis, keepdim = false) => (a instanceof Tensor ? a.mean(axis, keepdim) : null),
    tensor_item: (a) => (a instanceof Tensor ? a.item() : null),
    tensor_get: (a, ...coords) => (a instanceof Tensor ? a.get(...coords) : null),
    tensor_set: (a, val, ...coords) => {
        if (a instanceof Tensor) {
            a.set(val, ...coords);
        }
        return a;
    },
    tensor_shape: (a) => (a instanceof Tensor ? a.shape : null),
    tensor_size: (a) => (a instanceof Tensor ? a.size : null),
};
