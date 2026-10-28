/**
 * CUBiO AI — ONE LANGUAGE — JIT CODEGEN
 * ========================================
 * Module: @one/jit/JITRuntimeContext
 * Gate: ONE-05 / JavaScript JIT Code Generation
 *
 * Provides sandbox runtime context, deterministic numeric operations,
 * Tensor builtins, and error classes injected into the V8 JIT compiled function.
 */

import { OneVMError, VMValue } from '../vm/UnifiedVM';
import { DeterministicNumericOps, toI32, toF32, toBool } from '../types/TypedNumeric';
import { ONE_BUILTIN_FUNCTIONS } from '../stdlib/OneStdLib';
import { Tensor } from '../tensor/Tensor';
import { AutogradOps } from '../tensor/autograd/AutogradOps';

export function formatVMValue(value: any): string {
  if (value === null || value === undefined) return 'null';
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
export const TENSOR_BUILTIN_FUNCTIONS: Record<string, (...args: any[]) => any> = {
  // Creation
  'Tensor.zeros': (shape: number[]) => Tensor.zeros(shape),
  'Tensor.ones': (shape: number[]) => Tensor.ones(shape),
  'Tensor.fill': (val: number, shape: number[]) => Tensor.fill(val, shape),
  'Tensor.fromArray': (arr: number[] | Float32Array, shape?: number[]) => Tensor.fromArray(arr, shape),
  'Tensor.randn': (shape: number[], seed?: number) => Tensor.randn(shape, seed),

  // Alternate functional names
  tensor_zeros: (shape: number[]) => Tensor.zeros(shape),
  tensor_ones: (shape: number[]) => Tensor.ones(shape),
  tensor_fromArray: (arr: number[] | Float32Array, shape?: number[]) => Tensor.fromArray(arr, shape),
  tensor_randn: (shape: number[], seed?: number) => Tensor.randn(shape, seed),

  // Kernels / Ops
  tensor_matmul: (a: Tensor, b: Tensor) => a.matmul(b),
  tensor_add: (a: Tensor, b: Tensor | number) => a.add(b),
  tensor_sub: (a: Tensor, b: Tensor | number) => a.sub(b),
  tensor_mul: (a: Tensor, b: Tensor | number) => a.mul(b),
  tensor_div: (a: Tensor, b: Tensor | number) => a.div(b),
  tensor_relu: (a: Tensor) => a.relu(),
  tensor_gelu: (a: Tensor) => a.gelu(),
  tensor_softmax: (a: Tensor, axis: number = -1) => a.softmax(axis),
  tensor_layernorm: (x: Tensor, gamma: Tensor, beta: Tensor, eps: number = 1e-5) =>
    AutogradOps.layerNorm(x, gamma, beta, eps),
  tensor_sum: (a: Tensor, axis?: number, keepdim: boolean = false) => a.sum(axis, keepdim),
  tensor_mean: (a: Tensor, axis?: number, keepdim: boolean = false) => a.mean(axis, keepdim),
  tensor_item: (a: Tensor) => a.item(),
  tensor_get: (a: Tensor, ...coords: number[]) => a.get(...coords),
  tensor_set: (a: Tensor, val: number, ...coords: number[]) => {
    a.set(val, ...coords);
    return a;
  },
  tensor_shape: (a: Tensor) => a.shape,
  tensor_size: (a: Tensor) => a.size,
};

export interface JITRuntimeContext {
  OneVMError: typeof OneVMError;
  DeterministicNumericOps: typeof DeterministicNumericOps;
  toI32: typeof toI32;
  toF32: typeof toF32;
  toBool: typeof toBool;
  Tensor: typeof Tensor;
  AutogradOps: typeof AutogradOps;
  builtins: Map<string, (...args: any[]) => any>;
  output: string[];
  formatValue: (val: any) => string;
}

export function createJITRuntimeContext(): JITRuntimeContext {
  const builtins = new Map<string, (...args: any[]) => any>();

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
