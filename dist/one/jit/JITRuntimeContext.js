/**
 * CUBiO AI — ONE LANGUAGE — JIT CODEGEN
 * ========================================
 * Module: @one/jit/JITRuntimeContext
 * Gate: ONE-05 / JavaScript JIT Code Generation
 *
 * Provides sandbox runtime context, deterministic numeric operations,
 * Tensor builtins, and error classes injected into the V8 JIT compiled function.
 */
import { OneVMError } from '../vm/UnifiedVM';
import { DeterministicNumericOps, toI32, toF32, toBool } from '../types/TypedNumeric';
import { ONE_BUILTIN_FUNCTIONS } from '../stdlib/OneStdLib';
import { Tensor } from '../tensor/Tensor';
import { AutogradOps } from '../tensor/autograd/AutogradOps';
export function formatVMValue(value) {
    if (value === null || value === undefined)
        return 'null';
    if (value instanceof Tensor) {
        return `Tensor(shape=[${value.shape.join(', ')}], size=${value.size})`;
    }
    if (Array.isArray(value)) {
        return '[' + value.map((v) => formatVMValue(v)).join(', ') + ']';
    }
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    return String(value);
}
/**
 * Standard Tensor Builtin Functions available in both JIT and Interpreter.
 */
export const TENSOR_BUILTIN_FUNCTIONS = {
    // Creation
    'Tensor.zeros': (shape) => Tensor.zeros(shape),
    'Tensor.ones': (shape) => Tensor.ones(shape),
    'Tensor.fill': (val, shape) => Tensor.fill(val, shape),
    'Tensor.fromArray': (arr, shape) => Tensor.fromArray(arr, shape),
    'Tensor.randn': (shape, seed) => Tensor.randn(shape, seed),
    // Alternate functional names
    tensor_zeros: (shape) => Tensor.zeros(shape),
    tensor_ones: (shape) => Tensor.ones(shape),
    tensor_fromArray: (arr, shape) => Tensor.fromArray(arr, shape),
    tensor_randn: (shape, seed) => Tensor.randn(shape, seed),
    // Kernels / Ops
    tensor_matmul: (a, b) => a.matmul(b),
    tensor_add: (a, b) => a.add(b),
    tensor_sub: (a, b) => a.sub(b),
    tensor_mul: (a, b) => a.mul(b),
    tensor_div: (a, b) => a.div(b),
    tensor_relu: (a) => a.relu(),
    tensor_gelu: (a) => a.gelu(),
    tensor_softmax: (a, axis = -1) => a.softmax(axis),
    tensor_layernorm: (x, gamma, beta, eps = 1e-5) => AutogradOps.layerNorm(x, gamma, beta, eps),
    tensor_sum: (a, axis, keepdim = false) => a.sum(axis, keepdim),
    tensor_mean: (a, axis, keepdim = false) => a.mean(axis, keepdim),
    tensor_item: (a) => a.item(),
    tensor_get: (a, ...coords) => a.get(...coords),
    tensor_set: (a, val, ...coords) => {
        a.set(val, ...coords);
        return a;
    },
    tensor_shape: (a) => a.shape,
    tensor_size: (a) => a.size,
};
export function createJITRuntimeContext() {
    const builtins = new Map();
    // Register Standard Library builtins
    for (const [name, fn] of Object.entries(ONE_BUILTIN_FUNCTIONS)) {
        builtins.set(name, fn);
    }
    // Register Tensor builtins
    for (const [name, fn] of Object.entries(TENSOR_BUILTIN_FUNCTIONS)) {
        builtins.set(name, fn);
    }
    return {
        OneVMError,
        DeterministicNumericOps,
        toI32,
        toF32,
        toBool,
        Tensor,
        AutogradOps,
        builtins,
        output: [],
        formatValue: formatVMValue,
    };
}
