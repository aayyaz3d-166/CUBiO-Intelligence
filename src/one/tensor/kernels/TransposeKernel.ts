/**
 * CUBiO AI — ONE LANGUAGE — VERIFIED TENSOR TRAINING KERNELS
 * ============================================================
 * Kernel: TransposeKernel (Axis Permutation & Adjoint Gradient)
 * Module: @one/tensor/kernels/TransposeKernel
 */

import { Tensor } from '../Tensor';
import { TensorMemoryArena } from '../TensorArena';

export interface TransposeContext {
  axis0: number;
  axis1: number;
  origShape: number[];
}

export interface TransposeForwardResult {
  output: Tensor;
  ctx: TransposeContext;
}

export interface TransposeBackwardResult {
  dA: Tensor;
}

export class TransposeKernel {
  /**
   * Forward: B = transpose(A, axis0, axis1)
   * Produces a contiguous materialized transposed tensor.
   */
  public static forward(
    A: Tensor,
    axis0: number = 0,
    axis1: number = 1,
    arena?: TensorMemoryArena
  ): TransposeForwardResult {
    TransposeKernel.validateAxes(A, axis0, axis1);

    const viewT = A.transpose(axis0, axis1);
    const out = viewT.contiguous(arena);

    return {
      output: out,
      ctx: { axis0, axis1, origShape: [...A.shape] },
    };
  }

  /**
   * Backward:
   * dA = transpose(dB, axis0, axis1)
   */
  public static backward(dB: Tensor, ctx: TransposeContext, arena?: TensorMemoryArena): TransposeBackwardResult {
    const { axis0, axis1, origShape } = ctx;
    const dAView = dB.transpose(axis0, axis1);
    const dA = dAView.contiguous(arena);

    if (dA.shape.length !== origShape.length || !dA.shape.every((v, i) => v === origShape[i])) {
      throw new Error(`Backward transpose shape [${dA.shape}] does not match original shape [${origShape}]`);
    }

    return { dA };
  }

  /**
   * Canonical numerical reference.
   */
  public static reference(A: Tensor, axis0: number = 0, axis1: number = 1): Float32Array {
    TransposeKernel.validateAxes(A, axis0, axis1);
    const t = A.transpose(axis0, axis1);
    const it = t.elementIterator();
    const ref = new Float32Array(A.size);
    let i = 0;
    for (const val of it) {
      ref[i++] = val;
    }
    return ref;
  }

  /**
   * Shape and axis validation.
   */
  public static validateAxes(A: Tensor, axis0: number, axis1: number): void {
    if (axis0 < 0 || axis0 >= A.ndim || axis1 < 0 || axis1 >= A.ndim) {
      throw new RangeError(`Invalid axes [${axis0}, ${axis1}] for tensor with ndim ${A.ndim}`);
    }
  }
}
