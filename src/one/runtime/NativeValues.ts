/**
 * ONE Language — Native Value Domain
 * ==================================
 * Module: @one/runtime/NativeValues
 *
 * Formal runtime value representation for One Language.
 * Supports primitives, structured records/arrays, callable closures,
 * byte buffers, CUBiO spatial coordinates, Canonical Address369 types,
 * and deterministic numeric types (i32, f32, bool).
 *
 * Invariants:
 *   - Explicit discriminant tagging (`kind`)
 *   - Deep structural equality & deterministic ordering
 *   - Coordinate boundaries strictly [0..6] per axis
 *   - Canonical address boundaries strictly [0..368]
 *   - 32-bit integer truncation (x | 0) for i32
 *   - IEEE-754 32-bit single-precision truncation (Math.fround) for f32
 */

import { CanonicalAddress369 } from '../address369_canonical';

export type NativeValueKind =
  | 'null'
  | 'bool'
  | 'int'
  | 'float'
  | 'i32'
  | 'f32'
  | 'string'
  | 'array'
  | 'record'
  | 'spatial_coord'
  | 'canonical_address'
  | 'closure'
  | 'native_fn'
  | 'byte_buffer';

export interface SpatialCoordValue {
  i: number;
  j: number;
  k: number;
}

export interface ClosureValue {
  name: string;
  params: string[];
  entryPC: number;
  env?: Map<string, NativeValue>;
}

export type NativeFnCallback = (...args: NativeValue[]) => NativeValue;

export interface NativeFnValue {
  name: string;
  fn: NativeFnCallback;
  arity?: number;
}

export interface NativeValue {
  kind: NativeValueKind;
  value:
    | null
    | boolean
    | number
    | string
    | NativeValue[]
    | Record<string, NativeValue>
    | SpatialCoordValue
    | number // For canonical_address
    | ClosureValue
    | NativeFnValue
    | Uint8Array;
}

// ─────────────────────────────────────────────────────────────────────────────
// Typed Constructors
// ─────────────────────────────────────────────────────────────────────────────

export function createNull(): NativeValue {
  return { kind: 'null', value: null };
}

export function createBool(val: boolean): NativeValue {
  return { kind: 'bool', value: Boolean(val) };
}

export function createInt(val: number): NativeValue {
  const intVal = (Number(val) || 0) | 0;
  return { kind: 'int', value: intVal };
}

export function createFloat(val: number): NativeValue {
  return { kind: 'float', value: Number(val) || 0.0 };
}

export function createI32(val: number): NativeValue {
  const intVal = (Number(val) || 0) | 0;
  return { kind: 'i32', value: intVal };
}

export function createF32(val: number): NativeValue {
  return { kind: 'f32', value: Math.fround(Number(val) || 0.0) };
}

export function createString(val: string): NativeValue {
  return { kind: 'string', value: String(val) };
}

export function createArray(items: NativeValue[] = []): NativeValue {
  return { kind: 'array', value: [...items] };
}

export function createRecord(entries: Record<string, NativeValue> = {}): NativeValue {
  return { kind: 'record', value: { ...entries } };
}

export function createSpatialCoord(i: number, j: number, k: number): NativeValue {
  const ci = Math.trunc(i);
  const cj = Math.trunc(j);
  const ck = Math.trunc(k);
  if (ci < 0 || ci > 6 || cj < 0 || cj > 6 || ck < 0 || ck > 6) {
    throw new Error(
      `[NativeValues E7012] Spatial coordinate (${ci}, ${cj}, ${ck}) is outside the 7x7x7 grid [0..6].`
    );
  }
  return {
    kind: 'spatial_coord',
    value: { i: ci, j: cj, k: ck },
  };
}

export function createCanonicalAddress(addr: number): NativeValue {
  const a = Math.trunc(addr);
  if (a < CanonicalAddress369.SYMBOLIC_START || a > CanonicalAddress369.SPATIAL_END) {
    throw new Error(
      `[NativeValues E7013] Canonical address ${a} is outside canonical range [0..368].`
    );
  }
  return {
    kind: 'canonical_address',
    value: a,
  };
}

export function createClosure(
  name: string,
  params: string[],
  entryPC: number,
  env?: Map<string, NativeValue>
): NativeValue {
  return {
    kind: 'closure',
    value: { name, params, entryPC, env },
  };
}

export function createNativeFunction(
  name: string,
  fn: NativeFnCallback,
  arity?: number
): NativeValue {
  return {
    kind: 'native_fn',
    value: { name, fn, arity },
  };
}

export function createByteBuffer(buffer: Uint8Array): NativeValue {
  return {
    kind: 'byte_buffer',
    value: new Uint8Array(buffer),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Value Operations
// ─────────────────────────────────────────────────────────────────────────────

export function isTruthy(val: NativeValue): boolean {
  switch (val.kind) {
    case 'null':
      return false;
    case 'bool':
      return val.value as boolean;
    case 'int':
    case 'i32':
    case 'float':
    case 'f32':
      return (val.value as number) !== 0;
    case 'string':
      return (val.value as string).length > 0;
    case 'array':
      return (val.value as NativeValue[]).length > 0;
    case 'record':
      return Object.keys(val.value as Record<string, NativeValue>).length > 0;
    case 'byte_buffer':
      return (val.value as Uint8Array).length > 0;
    default:
      return true;
  }
}

export function isEqual(a: NativeValue, b: NativeValue): boolean {
  // Support numeric cross-kind equivalence (int <-> i32, float <-> f32)
  const isAInt = a.kind === 'int' || a.kind === 'i32';
  const isBInt = b.kind === 'int' || b.kind === 'i32';
  if (isAInt && isBInt) {
    return a.value === b.value;
  }

  const isAFloat = a.kind === 'float' || a.kind === 'f32';
  const isBFloat = b.kind === 'float' || b.kind === 'f32';
  if (isAFloat && isBFloat) {
    return a.value === b.value;
  }

  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case 'null':
      return true;
    case 'bool':
    case 'int':
    case 'float':
    case 'i32':
    case 'f32':
    case 'string':
    case 'canonical_address':
      return a.value === b.value;

    case 'spatial_coord': {
      const ca = a.value as SpatialCoordValue;
      const cb = b.value as SpatialCoordValue;
      return ca.i === cb.i && ca.j === cb.j && ca.k === cb.k;
    }

    case 'array': {
      const arrA = a.value as NativeValue[];
      const arrB = b.value as NativeValue[];
      if (arrA.length !== arrB.length) return false;
      for (let idx = 0; idx < arrA.length; idx++) {
        if (!isEqual(arrA[idx], arrB[idx])) return false;
      }
      return true;
    }

    case 'record': {
      const recA = a.value as Record<string, NativeValue>;
      const recB = b.value as Record<string, NativeValue>;
      const keysA = Object.keys(recA).sort();
      const keysB = Object.keys(recB).sort();
      if (keysA.length !== keysB.length) return false;
      for (let idx = 0; idx < keysA.length; idx++) {
        if (keysA[idx] !== keysB[idx]) return false;
        if (!isEqual(recA[keysA[idx]], recB[keysB[idx]])) return false;
      }
      return true;
    }

    case 'byte_buffer': {
      const bufA = a.value as Uint8Array;
      const bufB = b.value as Uint8Array;
      if (bufA.length !== bufB.length) return false;
      for (let idx = 0; idx < bufA.length; idx++) {
        if (bufA[idx] !== bufB[idx]) return false;
      }
      return true;
    }

    case 'closure': {
      const clA = a.value as ClosureValue;
      const clB = b.value as ClosureValue;
      return clA.name === clB.name && clA.entryPC === clB.entryPC;
    }

    case 'native_fn': {
      const nfA = a.value as NativeFnValue;
      const nfB = b.value as NativeFnValue;
      return nfA.name === nfB.name;
    }

    default:
      return false;
  }
}

export function compare(a: NativeValue, b: NativeValue): number {
  const isANum = a.kind === 'int' || a.kind === 'float' || a.kind === 'i32' || a.kind === 'f32';
  const isBNum = b.kind === 'int' || b.kind === 'float' || b.kind === 'i32' || b.kind === 'f32';

  if (isANum && isBNum) {
    const na = a.value as number;
    const nb = b.value as number;
    return na < nb ? -1 : na > nb ? 1 : 0;
  }
  if (a.kind === 'string' && b.kind === 'string') {
    const sa = a.value as string;
    const sb = b.value as string;
    return sa.localeCompare(sb);
  }
  if (a.kind === 'canonical_address' && b.kind === 'canonical_address') {
    const aa = a.value as number;
    const ab = b.value as number;
    return aa < ab ? -1 : aa > ab ? 1 : 0;
  }
  return 0;
}

export function formatNativeValue(val: NativeValue): string {
  switch (val.kind) {
    case 'null':
      return 'null';
    case 'bool':
      return String(val.value);
    case 'int':
    case 'i32':
    case 'float':
    case 'f32':
      return String(val.value);
    case 'string':
      return `"${val.value}"`;
    case 'canonical_address':
      return `Address369[${val.value}]`;
    case 'spatial_coord': {
      const c = val.value as SpatialCoordValue;
      return `@Coord(${c.i}, ${c.j}, ${c.k})`;
    }
    case 'array': {
      const items = (val.value as NativeValue[]).map((v) => formatNativeValue(v));
      return `[${items.join(', ')}]`;
    }
    case 'record': {
      const entries = Object.entries(val.value as Record<string, NativeValue>).map(
        ([k, v]) => `${k}: ${formatNativeValue(v)}`
      );
      return `{ ${entries.join(', ')} }`;
    }
    case 'byte_buffer': {
      const bytes = Array.from(val.value as Uint8Array)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');
      return `<ByteBuffer: ${bytes}>`;
    }
    case 'closure': {
      const cl = val.value as ClosureValue;
      return `<Closure: ${cl.name}(${cl.params.join(', ')}) @ PC ${cl.entryPC}>`;
    }
    case 'native_fn': {
      const nf = val.value as NativeFnValue;
      return `<NativeFn: ${nf.name}>`;
    }
    default:
      return String(val.value);
  }
}

export function toRaw(val: NativeValue): unknown {
  switch (val.kind) {
    case 'null':
      return null;
    case 'bool':
    case 'int':
    case 'i32':
    case 'float':
    case 'f32':
    case 'string':
    case 'canonical_address':
      return val.value;
    case 'spatial_coord':
      return { ...(val.value as SpatialCoordValue) };
    case 'array':
      return (val.value as NativeValue[]).map(toRaw);
    case 'record': {
      const rec = val.value as Record<string, NativeValue>;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rec)) {
        out[k] = toRaw(v);
      }
      return out;
    }
    case 'byte_buffer':
      return new Uint8Array(val.value as Uint8Array);
    default:
      return val.value;
  }
}

export function fromRaw(raw: unknown, typeHint?: unknown): NativeValue {
  if (typeof typeHint === 'string') {
    if (typeHint === 'i32' || typeHint === 'int32' || typeHint === 'int') {
      return createI32(Number(raw) || 0);
    }
    if (typeHint === 'f32' || typeHint === 'float32' || typeHint === 'float') {
      return createF32(Number(raw) || 0.0);
    }
    if (typeHint === 'bool' || typeHint === 'boolean') {
      return createBool(Boolean(raw));
    }
  }

  if (raw === null || raw === undefined) return createNull();
  if (typeof raw === 'boolean') return createBool(raw);
  if (typeof raw === 'number') {
    return Number.isInteger(raw) ? createInt(raw) : createFloat(raw);
  }
  if (typeof raw === 'string') return createString(raw);
  if (Array.isArray(raw)) {
    return createArray(raw.map((item) => fromRaw(item)));
  }
  if (raw instanceof Uint8Array) {
    return createByteBuffer(raw);
  }
  if (typeof raw === 'object') {
    const entries: Record<string, NativeValue> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      entries[k] = fromRaw(v);
    }
    return createRecord(entries);
  }
  return createString(String(raw));
}
