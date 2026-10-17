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
  public static length(str: string): number {
    return String(str).length;
  }

  public static toLowerCase(str: string): string {
    return String(str).toLowerCase();
  }

  public static toUpperCase(str: string): string {
    return String(str).toUpperCase();
  }

  public static trim(str: string): string {
    return String(str).trim();
  }

  public static split(str: string, delimiter: string = ','): string[] {
    return String(str).split(delimiter);
  }

  public static slice(str: string, start: number, end?: number): string {
    return String(str).slice(start, end);
  }

  public static replace(str: string, target: string, replacement: string): string {
    return String(str).replace(target, replacement);
  }

  public static includes(str: string, search: string): boolean {
    return String(str).includes(search);
  }

  public static charAt(str: string, index: number): string {
    return String(str).charAt(index);
  }
}

export class StdNumber {
  public static parseInt(val: string | number): number {
    return parseInt(String(val), 10);
  }

  public static parseFloat(val: string | number): number {
    return parseFloat(String(val));
  }

  public static toFixed(num: number, digits: number = 2): string {
    return Number(num).toFixed(digits);
  }

  public static isNaN(val: unknown): boolean {
    return Number.isNaN(Number(val));
  }

  public static isFinite(val: unknown): boolean {
    return Number.isFinite(Number(val));
  }

  public static toI32(val: unknown): number {
    return (Number(val) || 0) | 0;
  }

  public static toF32(val: unknown): number {
    return Math.fround(Number(val) || 0.0);
  }

  public static isI32(val: unknown): boolean {
    return typeof val === 'number' && Number.isInteger(val) && val >= -2147483648 && val <= 2147483647;
  }

  public static isF32(val: unknown): boolean {
    return typeof val === 'number' && !Number.isNaN(val);
  }
}

export class StdBoolean {
  public static parse(val: unknown): boolean {
    if (typeof val === 'string') {
      const lower = val.trim().toLowerCase();
      return lower === 'true' || lower === '1';
    }
    return Boolean(val);
  }

  public static toBool(val: unknown): boolean {
    if (typeof val === 'string') {
      const lower = val.trim().toLowerCase();
      return lower === 'true' || lower === '1';
    }
    return Boolean(val);
  }

  public static isBool(val: unknown): boolean {
    return typeof val === 'boolean';
  }

  public static toString(val: unknown): string {
    return Boolean(val) ? 'true' : 'false';
  }
}

export class StdArray {
  public static length(arr: unknown[]): number {
    return Array.isArray(arr) ? arr.length : 0;
  }

  public static push(arr: unknown[], item: unknown): number {
    if (!Array.isArray(arr)) return 0;
    arr.push(item);
    return arr.length;
  }

  public static pop(arr: unknown[]): unknown {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr.pop();
  }

  public static shift(arr: unknown[]): unknown {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr.shift();
  }

  public static unshift(arr: unknown[], item: unknown): number {
    if (!Array.isArray(arr)) return 0;
    arr.unshift(item);
    return arr.length;
  }

  public static join(arr: unknown[], separator: string = ','): string {
    return Array.isArray(arr) ? arr.join(separator) : '';
  }

  public static slice(arr: unknown[], start: number, end?: number): unknown[] {
    return Array.isArray(arr) ? arr.slice(start, end) : [];
  }

  public static indexOf(arr: unknown[], item: unknown): number {
    return Array.isArray(arr) ? arr.indexOf(item) : -1;
  }

  public static reverse(arr: unknown[]): unknown[] {
    if (!Array.isArray(arr)) return [];
    return [...arr].reverse();
  }
}

export class StdObject {
  public static keys(obj: Record<string, unknown>): string[] {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
    return Object.keys(obj);
  }

  public static values(obj: Record<string, unknown>): unknown[] {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
    return Object.values(obj);
  }

  public static entries(obj: Record<string, unknown>): Array<[string, unknown]> {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
    return Object.entries(obj);
  }

  public static hasKey(obj: Record<string, unknown>, key: string): boolean {
    if (!obj || typeof obj !== 'object') return false;
    return Object.prototype.hasOwnProperty.call(obj, key);
  }
}

export class StdMath {
  public static readonly PI: number = Math.PI;
  public static readonly E: number = Math.E;

  public static abs(x: number): number { return Math.abs(x); }
  public static sqrt(x: number): number { return Math.sqrt(x); }
  public static pow(base: number, exp: number): number { return Math.pow(base, exp); }
  public static sin(x: number): number { return Math.sin(x); }
  public static cos(x: number): number { return Math.cos(x); }
  public static tan(x: number): number { return Math.tan(x); }
  public static floor(x: number): number { return Math.floor(x); }
  public static ceil(x: number): number { return Math.ceil(x); }
  public static round(x: number): number { return Math.round(x); }
  public static min(a: number, b: number): number { return Math.min(a, b); }
  public static max(a: number, b: number): number { return Math.max(a, b); }
}

export class StdJSON {
  public static stringify(val: unknown): string {
    return JSON.stringify(val);
  }

  public static parse(text: string): unknown {
    return JSON.parse(text);
  }
}

export class StdDateTime {
  public static now(): number {
    return Date.now();
  }

  public static timestamp(): number {
    return Math.floor(Date.now() / 1000);
  }

  public static iso(): string {
    return new Date().toISOString();
  }
}

export class StdIO {
  public static readText(filePath: string): string {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`[StdIO Error] File not found: ${filePath}`);
    }
    return fs.readFileSync(resolved, 'utf-8');
  }

  public static writeText(filePath: string, content: string): boolean {
    const resolved = path.resolve(filePath);
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(resolved, content, 'utf-8');
    return true;
  }

  public static exists(filePath: string): boolean {
    return fs.existsSync(path.resolve(filePath));
  }
}

/**
 * Built-in functions map ready for injection into UnifiedVM.
 */
export const ONE_BUILTIN_FUNCTIONS: Record<string, (...args: any[]) => any> = {
  // Math functions
  abs: (x: number) => StdMath.abs(x),
  sqrt: (x: number) => StdMath.sqrt(x),
  pow: (b: number, e: number) => StdMath.pow(b, e),
  sin: (x: number) => StdMath.sin(x),
  cos: (x: number) => StdMath.cos(x),
  tan: (x: number) => StdMath.tan(x),
  floor: (x: number) => StdMath.floor(x),
  ceil: (x: number) => StdMath.ceil(x),
  round: (x: number) => StdMath.round(x),
  min: (a: number, b: number) => StdMath.min(a, b),
  max: (a: number, b: number) => StdMath.max(a, b),

  // String functions
  str_len: (s: string) => StdString.length(s),
  str_lower: (s: string) => StdString.toLowerCase(s),
  str_upper: (s: string) => StdString.toUpperCase(s),
  str_trim: (s: string) => StdString.trim(s),
  str_split: (s: string, d?: string) => StdString.split(s, d),
  str_slice: (s: string, start: number, end?: number) => StdString.slice(s, start, end),
  str_replace: (s: string, t: string, r: string) => StdString.replace(s, t, r),
  str_includes: (s: string, q: string) => StdString.includes(s, q),

  // Array functions
  arr_len: (a: any[]) => StdArray.length(a),
  arr_push: (a: any[], i: any) => StdArray.push(a, i),
  arr_pop: (a: any[]) => StdArray.pop(a),
  arr_shift: (a: any[]) => StdArray.shift(a),
  arr_unshift: (a: any[], i: any) => StdArray.unshift(a, i),
  arr_join: (a: any[], sep?: string) => StdArray.join(a, sep),
  arr_slice: (a: any[], start: number, end?: number) => StdArray.slice(a, start, end),
  arr_index_of: (a: any[], item: any) => StdArray.indexOf(a, item),
  arr_reverse: (a: any[]) => StdArray.reverse(a),
  len: (val: any) => (Array.isArray(val) ? val.length : typeof val === 'string' ? val.length : 0),
  push: (arr: any[], item: any) => StdArray.push(arr, item),
  pop: (arr: any[]) => StdArray.pop(arr),

  // Number functions
  parse_int: (v: any) => StdNumber.parseInt(v),
  parse_float: (v: any) => StdNumber.parseFloat(v),
  to_fixed: (n: number, d?: number) => StdNumber.toFixed(n, d),
  is_nan: (v: any) => StdNumber.isNaN(v),
  i32: (v: any) => StdNumber.toI32(v),
  f32: (v: any) => StdNumber.toF32(v),
  bool: (v: any) => StdBoolean.toBool(v),
  is_i32: (v: any) => StdNumber.isI32(v),
  is_f32: (v: any) => StdNumber.isF32(v),
  is_bool: (v: any) => StdBoolean.isBool(v),

  // Object functions
  obj_keys: (o: any) => StdObject.keys(o),
  obj_values: (o: any) => StdObject.values(o),
  obj_entries: (o: any) => StdObject.entries(o),
  obj_has_key: (o: any, k: string) => StdObject.hasKey(o, k),

  // JSON functions
  json_stringify: (v: any) => StdJSON.stringify(v),
  json_parse: (s: string) => StdJSON.parse(s),

  // Time functions
  time_now: () => StdDateTime.now(),
  time_timestamp: () => StdDateTime.timestamp(),
  time_iso: () => StdDateTime.iso(),

  // File I/O functions
  io_read: (path: string) => StdIO.readText(path),
  io_write: (path: string, content: string) => StdIO.writeText(path, content),
  io_exists: (path: string) => StdIO.exists(path),

  // Common aliases
  trim: (s: string) => StdString.trim(s),
  length: (val: any) => (Array.isArray(val) ? val.length : typeof val === 'string' ? val.length : 0),

  // Tensor functions
  tensor_zeros: (shape: number[]) => Tensor.zeros(shape),
  tensor_ones: (shape: number[]) => Tensor.ones(shape),
  tensor_fromArray: (arr: number[] | Float32Array, shape?: number[]) => Tensor.fromArray(arr, shape),
  tensor_randn: (shape: number[], seed?: number) => Tensor.randn(shape, seed),
  tensor_matmul: (a: any, b: any) => (a instanceof Tensor ? a.matmul(b) : null),
  tensor_add: (a: any, b: any) => (a instanceof Tensor ? a.add(b) : null),
  tensor_sub: (a: any, b: any) => (a instanceof Tensor ? a.sub(b) : null),
  tensor_mul: (a: any, b: any) => (a instanceof Tensor ? a.mul(b) : null),
  tensor_div: (a: any, b: any) => (a instanceof Tensor ? a.div(b) : null),
  tensor_relu: (a: any) => (a instanceof Tensor ? a.relu() : null),
  tensor_gelu: (a: any) => (a instanceof Tensor ? a.gelu() : null),
  tensor_softmax: (a: any, axis: number = -1) => (a instanceof Tensor ? a.softmax(axis) : null),
  tensor_layernorm: (x: any, gamma: any, beta: any, eps: number = 1e-5) =>
    AutogradOps.layerNorm(x, gamma, beta, eps),
  tensor_sum: (a: any, axis?: number, keepdim: boolean = false) => (a instanceof Tensor ? a.sum(axis, keepdim) : null),
  tensor_mean: (a: any, axis?: number, keepdim: boolean = false) => (a instanceof Tensor ? a.mean(axis, keepdim) : null),
  tensor_item: (a: any) => (a instanceof Tensor ? a.item() : null),
  tensor_get: (a: any, ...coords: number[]) => (a instanceof Tensor ? a.get(...coords) : null),
  tensor_set: (a: any, val: number, ...coords: number[]) => {
    if (a instanceof Tensor) {
      a.set(val, ...coords);
    }
    return a;
  },
  tensor_shape: (a: any) => (a instanceof Tensor ? a.shape : null),
  tensor_size: (a: any) => (a instanceof Tensor ? a.size : null),
};
