/**
 * CUBiO AI — ONE LANGUAGE — VERIFIED TENSOR TRAINING KERNELS
 * ============================================================
 * Kernel: SoftmaxKernel (Numerically Stable Softmax & Jacobian-Vector Product)
 * Module: @one/tensor/kernels/SoftmaxKernel
 */

import { Tensor } from '../Tensor';
import { TensorMemoryArena } from '../TensorArena';

export interface SoftmaxContext {
  probs: Tensor;
  axis: number;
}

export interface SoftmaxForwardResult {
  output: Tensor;
  ctx: SoftmaxContext;
}

export interface SoftmaxBackwardResult {
  dX: Tensor;
}

export class SoftmaxKernel {
  /**
   * Forward: S = softmax(X, axis=-1)
   * Uses max-subtraction for numerical stability.
   */
  public static forward(X: Tensor, axis: number = -1, arena?: TensorMemoryArena): SoftmaxForwardResult {
    SoftmaxKernel.validate(X, axis);

    const resolvedAxis = axis < 0 ? axis + X.ndim : axis;
    const D = X.shape[resolvedAxis];
    const outerRows = X.size / D;

    const out = arena ? arena.allocateTensor(X.shape) : Tensor.zeros(X.shape);
    const xData = X.data;
    const sData = out.data;

    for (let r = 0; r < outerRows; r++) {
      const rStart = X.offset + r * D;
      const outStart = out.offset + r * D;

      // 1. Find row max
      let maxVal = -Infinity;
      for (let j = 0; j < D; j++) {
        const v = xData[rStart + j];
        if (v > maxVal) maxVal = v;
      }

      // 2. Exponentials and sum
      let expSum = 0.0;
      for (let j = 0; j < D; j++) {
        const e = Math.exp(xData[rStart + j] - maxVal);
        sData[outStart + j] = e;
        expSum += e;
      }

      // 3. Normalize
      const invSum = 1.0 / (expSum + 1e-12);
      for (let j = 0; j < D; j++) {
        sData[outStart + j] = Math.fround(sData[outStart + j] * invSum);
      }
    }

    return {
      output: out,
      ctx: { probs: out, axis: resolvedAxis },
    };
  }

  /**
   * Backward:
   * dX_j = S_j * (dS_j - sum_k(dS_k * S_k))
   */
  public static backward(dS: Tensor, ctx: SoftmaxContext, arena?: TensorMemoryArena): SoftmaxBackwardResult {
    const { probs, axis } = ctx;
    if (dS.size !== probs.size) {
      throw new Error(`Size mismatch in Softmax backward: ${dS.size} !== ${probs.size}`);
    }

    const dX = arena ? arena.allocateTensor(probs.shape) : Tensor.zeros(probs.shape);
    const D = probs.shape[axis];
    const outerRows = probs.size / D;

    const dsData = dS.data;
    const sData = probs.data;
    const dxData = dX.data;

    for (let r = 0; r < outerRows; r++) {
      const rStart = r * D;

      // Compute inner dot product sum = sum_k (dS_k * S_k)
      let dot = 0.0;
      for (let j = 0; j < D; j++) {
        dot += dsData[dS.offset + rStart + j] * sData[probs.offset + rStart + j];
      }

      // dX_j = S_j * (dS_j - dot)
      for (let j = 0; j < D; j++) {
        const s = sData[probs.offset + rStart + j];
        const ds = dsData[dS.offset + rStart + j];
        dxData[dX.offset + rStart + j] = Math.fround(s * (ds - dot));
      }
    }

    return { dX };
  }

  /**
   * Canonical numerical reference.
   */
  public static reference(X: Tensor, axis: number = -1): Float32Array {
    SoftmaxKernel.validate(X, axis);
    const resolvedAxis = axis < 0 ? axis + X.ndim : axis;
    const D = X.shape[resolvedAxis];
    const outerRows = X.size / D;
    const ref = new Float32Array(X.size);

    for (let r = 0; r < outerRows; r++) {
      let maxVal = -Infinity;
      for (let j = 0; j < D; j++) {
        const v = X.data[X.offset + r * D + j];
        if (v > maxVal) maxVal = v;
      }
      let sumExp = 0.0;
      for (let j = 0; j < D; j++) {
        const e = Math.exp(X.data[X.offset + r * D + j] - maxVal);
        ref[r * D + j] = e;
        sumExp += e;
      }
      for (let j = 0; j < D; j++) {
        ref[r * D + j] = Math.fround(ref[r * D + j] / sumExp);
      }
    }
    return ref;
  }

  /**
   * Validation.
   */
  public static validate(X: Tensor, axis: number): void {
    const resolvedAxis = axis < 0 ? axis + X.ndim : axis;
    if (resolvedAxis !== X.ndim - 1) {
      throw new Error(`SoftmaxKernel currently supports the innermost dimension (axis = -1 or ${X.ndim - 1})`);
    }
  }
}
