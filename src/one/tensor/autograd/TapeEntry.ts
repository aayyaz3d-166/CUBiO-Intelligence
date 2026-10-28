/**
 * CUBiO AI — ONE LANGUAGE — REVERSE-MODE AUTOGRAD
 * =================================================
 * Module: @one/tensor/autograd/TapeEntry
 * Gate: ONE-04 / Reverse-Mode Automatic Differentiation
 *
 * Defines the core TapeEntry interface representing an atomic operation node
 * on the computation tape for backward adjoint propagation.
 */

import { Tensor } from '../Tensor';
import { TensorMemoryArena } from '../TensorArena';

export interface TapeEntry {
  /** Unique sequential identifier of the tape entry */
  readonly id: number;

  /** Human-readable operation name (e.g. 'matmul', 'add', 'layernorm') */
  readonly opName: string;

  /** List of input tensors to this operation */
  readonly inputs: readonly Tensor[];

  /** Output tensor produced by this operation */
  readonly output: Tensor;

  /**
   * Vector-Jacobian Product (VJP) backward closure.
   * Computes upstream gradient w.r.t each input tensor.
   * Returns an array matching `inputs` where element is Tensor if input.requiresGrad, else null.
   */
  backward(dOut: Tensor, arena?: TensorMemoryArena): (Tensor | null)[];

  /**
   * Cleans up saved forward activations and contexts to free memory.
   */
  cleanUp(): void;
}
