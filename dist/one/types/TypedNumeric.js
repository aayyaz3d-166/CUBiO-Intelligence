/**
 * ONE Language — Typed Numeric Runtime Representation & Invariants
 * ================================================================
 * Module: @one/types/TypedNumeric
 *
 * Implements deterministic numeric runtime types:
 *   - i32: 32-bit two's complement signed integer [-2,147,483,648 .. 2,147,483,647]
 *   - f32: 32-bit IEEE-754 single-precision floating point (via Math.fround)
 *   - bool: Canonical boolean { true, false }
 *
 * Provides:
 *   - Exact range limits and bit-level constants
 *   - Coercion and explicit conversion functions
 *   - Strict and non-strict runtime validators
 *   - Deterministic arithmetic operations with overflow and zero-division handling
 *   - Conversion rules matrix
 */
// ─────────────────────────────────────────────────────────────────────────────
// Type Constants & Bounds
// ─────────────────────────────────────────────────────────────────────────────
export const I32_MIN = -2147483648; // -2^31
export const I32_MAX = 2147483647; // 2^31 - 1
export const F32_MAX = 3.4028234663852886e+38;
export const F32_MIN_POSITIVE = 1.401298464324817e-45;
export const F32_EPSILON = 1.1920928955078125e-7;
// ─────────────────────────────────────────────────────────────────────────────
// Deterministic Value Conversion Rules
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Deterministically converts any value into a 32-bit signed integer.
 * Applies standard two's complement integer truncation (x | 0).
 */
export function toI32(val) {
    if (typeof val === 'number') {
        if (Number.isNaN(val) || !Number.isFinite(val))
            return 0;
        return val | 0;
    }
    if (typeof val === 'boolean') {
        return val ? 1 : 0;
    }
    if (typeof val === 'string') {
        const parsed = parseInt(val.trim(), 10);
        return Number.isNaN(parsed) ? 0 : parsed | 0;
    }
    return 0;
}
/**
 * Deterministically converts any value into a 32-bit single-precision float.
 * Uses IEEE-754 Math.fround for exact 32-bit truncation.
 */
export function toF32(val) {
    if (typeof val === 'number') {
        return Math.fround(val);
    }
    if (typeof val === 'boolean') {
        return val ? 1.0 : 0.0;
    }
    if (typeof val === 'string') {
        const s = val.trim();
        const clean = s.endsWith('f') || s.endsWith('F') ? s.slice(0, -1) : s;
        const parsed = parseFloat(clean);
        return Math.fround(Number.isNaN(parsed) ? 0.0 : parsed);
    }
    return 0.0;
}
/**
 * Deterministically converts any value into a canonical boolean.
 */
export function toBool(val) {
    if (typeof val === 'boolean') {
        return val;
    }
    if (typeof val === 'number') {
        return val !== 0 && !Number.isNaN(val);
    }
    if (typeof val === 'string') {
        const s = val.trim().toLowerCase();
        if (s === 'true' || s === '1')
            return true;
        if (s === 'false' || s === '0' || s === '')
            return false;
        return s.length > 0;
    }
    return Boolean(val);
}
// ─────────────────────────────────────────────────────────────────────────────
// Runtime Validation & Type Guards
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Checks if a value is strictly within 32-bit signed integer bounds.
 */
export function isStrictI32(val) {
    return (typeof val === 'number' &&
        Number.isInteger(val) &&
        val >= I32_MIN &&
        val <= I32_MAX);
}
/**
 * Checks if a value is a valid 32-bit single-precision float.
 */
export function isStrictF32(val) {
    if (typeof val !== 'number')
        return false;
    if (Number.isNaN(val))
        return true; // NaN is representable in f32
    if (!Number.isFinite(val))
        return true; // +/- Infinity representable in f32
    return Math.fround(val) === val;
}
/**
 * Checks if a value is strictly a boolean.
 */
export function isStrictBool(val) {
    return typeof val === 'boolean';
}
export function validateI32(val, strict = false) {
    if (strict) {
        if (!isStrictI32(val)) {
            return {
                valid: false,
                value: 0,
                error: `Value ${String(val)} is not a valid strict 32-bit integer [${I32_MIN}..${I32_MAX}]`,
            };
        }
        return { valid: true, value: val };
    }
    return { valid: true, value: toI32(val) };
}
export function validateF32(val, strict = false) {
    if (strict) {
        if (typeof val !== 'number') {
            return {
                valid: false,
                value: 0.0,
                error: `Value ${String(val)} is not a valid number for f32`,
            };
        }
        return { valid: true, value: Math.fround(val) };
    }
    return { valid: true, value: toF32(val) };
}
export function validateBool(val, strict = false) {
    if (strict) {
        if (typeof val !== 'boolean') {
            return {
                valid: false,
                value: false,
                error: `Value ${String(val)} is not a boolean`,
            };
        }
        return { valid: true, value: val };
    }
    return { valid: true, value: toBool(val) };
}
// ─────────────────────────────────────────────────────────────────────────────
// Deterministic Arithmetic Operations
// ─────────────────────────────────────────────────────────────────────────────
export class DeterministicNumericOps {
    // ── i32 Arithmetic ─────────────────────────────────────────────────────────
    static addI32(a, b) {
        return ((a | 0) + (b | 0)) | 0;
    }
    static subI32(a, b) {
        return ((a | 0) - (b | 0)) | 0;
    }
    static mulI32(a, b) {
        return Math.imul(a | 0, b | 0) | 0;
    }
    static divI32(a, b) {
        const divisor = b | 0;
        if (divisor === 0) {
            throw new Error('[E5001] Division by zero in i32 arithmetic');
        }
        const dividend = a | 0;
        // Overflow case: -2^31 / -1 wraps to -2^31 in two's complement
        if (dividend === I32_MIN && divisor === -1) {
            return I32_MIN | 0;
        }
        return Math.trunc(dividend / divisor) | 0;
    }
    static modI32(a, b) {
        const divisor = b | 0;
        if (divisor === 0) {
            throw new Error('[E5001] Modulo by zero in i32 arithmetic');
        }
        return ((a | 0) % divisor) | 0;
    }
    static negI32(a) {
        return (-(a | 0)) | 0;
    }
    // ── i32 Bitwise Operations ─────────────────────────────────────────────────
    static andI32(a, b) {
        return ((a | 0) & (b | 0)) | 0;
    }
    static orI32(a, b) {
        return ((a | 0) | (b | 0)) | 0;
    }
    static xorI32(a, b) {
        return ((a | 0) ^ (b | 0)) | 0;
    }
    static notI32(a) {
        return (~(a | 0)) | 0;
    }
    static shlI32(a, shift) {
        return ((a | 0) << (shift & 31)) | 0;
    }
    static shrI32(a, shift) {
        return ((a | 0) >> (shift & 31)) | 0;
    }
    static ushrI32(a, shift) {
        return (((a | 0) >>> (shift & 31)) | 0);
    }
    // ── f32 Arithmetic (Single Precision IEEE-754 via Math.fround) ─────────────
    static addF32(a, b) {
        return Math.fround(Math.fround(a) + Math.fround(b));
    }
    static subF32(a, b) {
        return Math.fround(Math.fround(a) - Math.fround(b));
    }
    static mulF32(a, b) {
        return Math.fround(Math.fround(a) * Math.fround(b));
    }
    static divF32(a, b) {
        const fa = Math.fround(a);
        const fb = Math.fround(b);
        if (fb === 0.0) {
            throw new Error('[E5001] Division by zero in f32 arithmetic');
        }
        return Math.fround(fa / fb);
    }
    static modF32(a, b) {
        const fa = Math.fround(a);
        const fb = Math.fround(b);
        if (fb === 0.0) {
            throw new Error('[E5001] Modulo by zero in f32 arithmetic');
        }
        return Math.fround(fa % fb);
    }
    static negF32(a) {
        return Math.fround(-Math.fround(a));
    }
}
export const NUMERIC_CONVERSION_RULES = [
    {
        from: 'i32',
        to: 'f32',
        isImplicit: true,
        lossless: true,
        description: 'Widening conversion: 32-bit signed int to 32-bit float',
    },
    {
        from: 'f32',
        to: 'i32',
        isImplicit: false,
        lossless: false,
        description: 'Narrowing conversion: truncates fractional part via i32() cast',
    },
    {
        from: 'bool',
        to: 'i32',
        isImplicit: false,
        lossless: true,
        description: 'Boolean to integer: true -> 1, false -> 0 via i32() cast',
    },
    {
        from: 'bool',
        to: 'f32',
        isImplicit: false,
        lossless: true,
        description: 'Boolean to float: true -> 1.0, false -> 0.0 via f32() cast',
    },
    {
        from: 'i32',
        to: 'bool',
        isImplicit: false,
        lossless: false,
        description: 'Integer to boolean: non-zero -> true, zero -> false via bool() cast',
    },
    {
        from: 'f32',
        to: 'bool',
        isImplicit: false,
        lossless: false,
        description: 'Float to boolean: non-zero -> true, zero -> false via bool() cast',
    },
    {
        from: 'number',
        to: 'i32',
        isImplicit: true,
        lossless: false,
        description: 'Generic number literal / expression to i32 with truncation',
    },
    {
        from: 'number',
        to: 'f32',
        isImplicit: true,
        lossless: false,
        description: 'Generic number literal / expression to f32 via Math.fround',
    },
];
/**
 * Checks if a type can be implicitly converted to a target type.
 */
export function canImplicitlyConvert(from, to) {
    if (from === to)
        return true;
    if (from === 'any' || to === 'any')
        return true;
    if ((from === 'bool' || from === 'boolean') && (to === 'bool' || to === 'boolean'))
        return true;
    if (to === 'number') {
        return from === 'i32' || from === 'f32' || from === 'number';
    }
    if (from === 'number') {
        return to === 'i32' || to === 'f32';
    }
    if (from === 'i32' && to === 'f32') {
        return true; // Widening i32 -> f32
    }
    return false;
}
/**
 * Converts a value to the specified target type.
 */
export function convertNumericValue(val, targetType) {
    switch (targetType.toLowerCase()) {
        case 'i32':
        case 'int32':
        case 'int':
            return toI32(val);
        case 'f32':
        case 'float32':
        case 'float':
            return toF32(val);
        case 'bool':
        case 'boolean':
            return toBool(val);
        case 'number':
            return typeof val === 'number' ? val : Number(val) || 0;
        default:
            return val;
    }
}
