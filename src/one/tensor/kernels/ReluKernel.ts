/**
 * CUBiO AI — ONE LANGUAGE — VERIFIED TENSOR TRAINING KERNELS
 * ============================================================
 * Kernel: ReluKernel (Rectified Linear Unit & Subgradient)
 * Module: @one/tensor/kernels/ReluKernel
 */

import { Tensor } from '../Tensor';
import { TensorMemoryArena } from '../TensorArena';

export interface ReluContext {
  X: Tensor;
}

export interface ReluForwardResult {
  output: Tensor;
  ctx: ReluContext;
}

export interface ReluBackwardResult {
  dX: Tensor;
}

export class ReluKernel {
  /**
   * Forward: Y = max(0, X)
   */
  public static forward(X: Tensor, arena?: TensorMemoryArena): ReluForwardResult {
    const out = arena ? arena.allocateTensor(X.shape) : Tensor.zeros(X.shape);
    const xData = X.data;
    const yData = out.data;

    for (let i = 0; i < X.size; i++) {
      const v = xData[X.offset + i];
      yData[out.offset + i] = v > 0 ? v : 0.0;
    }

    return {
      output: out,
      ctx: { X },
    };
  }

  /**
   * Backward:
   * dX = dY * (X > 0 ? 1 : 0)
   */
  public static backward(dY: Tensor, ctx: ReluContext, arena?: TensorMemoryArena): ReluBackwardResult {
    const { X } = ctx;
    if (dY.size !== X.size) {
      throw new Error(`Size mismatch in Relu backward: ${dY.size} !== ${X.size}`);
    }

    const dX = arena ? arena.allocateTensor(X.shape) : Tensor.zeros(X.shape);
    const dyData = dY.data;
    const xData = X.data;
    const dxData = dX.data;

    for (let i = 0; i < X.size; i++) {
      dxData[dX.offset + i] = xData[X.offset + i] > 0 ? dyData[dY.offset + i] : 0.0;
    }

    return { dX };
  }

  /**
   * Canonical numerical reference.
   */
  public static reference(X: Tensor): Float32Array {
    const ref = new Float32Array(X.size);
    for (let i = 0; i < X.size; i++) {
      const v = X.data[X.offset + i];
      ref[i] = v > 0 ? v : 0.0;
    }
    return ref;
  }
}
