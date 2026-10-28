/**
 * CUBiO AI — ONE LANGUAGE — VERIFIED TENSOR TRAINING KERNELS
 * ============================================================
 * Kernel: LayerNormKernel (Layer Normalization & Exact Analytical Adjoint)
 * Module: @one/tensor/kernels/LayerNormKernel
 */

import { Tensor } from '../Tensor';
import { TensorMemoryArena } from '../TensorArena';

export interface LayerNormContext {
  XHat: Tensor;
  invStd: Float32Array;
  gamma: Tensor;
  beta: Tensor;
  eps: number;
}

export interface LayerNormForwardResult {
  output: Tensor;
  ctx: LayerNormContext;
}

export interface LayerNormBackwardResult {
  dX: Tensor;
  dGamma: Tensor;
  dBeta: Tensor;
}

export class LayerNormKernel {
  /**
   * Forward: Y = (X - mu) / sqrt(var + eps) * gamma + beta
   * Normalizes across the last dimension D.
   */
  public static forward(
    X: Tensor,
    gamma: Tensor,
    beta: Tensor,
    eps: number = 1e-5,
    arena?: TensorMemoryArena
  ): LayerNormForwardResult {
    LayerNormKernel.validateShapes(X, gamma, beta);

    const D = X.shape[X.ndim - 1];
    const outerRows = X.size / D;
    const invD = 1.0 / D;

    const out = arena ? arena.allocateTensor(X.shape) : Tensor.zeros(X.shape);
    const XHat = arena ? arena.allocateTensor(X.shape) : Tensor.zeros(X.shape);
    const invStd = new Float32Array(outerRows);

    const xData = X.data;
    const gData = gamma.data;
    const bData = beta.data;
    const yData = out.data;
    const xHatData = XHat.data;

    for (let r = 0; r < outerRows; r++) {
      const rStart = r * D;

      // 1. Mean
      let sum = 0.0;
      for (let j = 0; j < D; j++) {
        sum += xData[X.offset + rStart + j];
      }
      const mean = sum * invD;

      // 2. Variance
      let varSum = 0.0;
      for (let j = 0; j < D; j++) {
        const diff = xData[X.offset + rStart + j] - mean;
        varSum += diff * diff;
      }
      const variance = varSum * invD;
      const invStdVal = 1.0 / Math.sqrt(variance + eps);
      invStd[r] = invStdVal;

      // 3. Normalize, scale & shift
      for (let j = 0; j < D; j++) {
        const norm = Math.fround((xData[X.offset + rStart + j] - mean) * invStdVal);
        xHatData[XHat.offset + rStart + j] = norm;
        yData[out.offset + rStart + j] = Math.fround(norm * gData[gamma.offset + j] + bData[beta.offset + j]);
      }
    }

    return {
      output: out,
      ctx: { XHat, invStd, gamma, beta, eps },
    };
  }

  /**
   * Backward:
   * Closed-form analytical gradients w.r.t X, gamma, and beta.
   */
  public static backward(
    dY: Tensor,
    ctx: LayerNormContext,
    arena?: TensorMemoryArena
  ): LayerNormBackwardResult {
    const { XHat, invStd, gamma, beta } = ctx;
    const D = gamma.size;
    const outerRows = XHat.size / D;
    const invD = 1.0 / D;

    const dX = arena ? arena.allocateTensor(XHat.shape) : Tensor.zeros(XHat.shape);
    const dGamma = arena ? arena.allocateTensor(gamma.shape) : Tensor.zeros(gamma.shape);
    const dBeta = arena ? arena.allocateTensor(beta.shape) : Tensor.zeros(beta.shape);

    dGamma.data.fill(0, dGamma.offset, dGamma.offset + D);
    dBeta.data.fill(0, dBeta.offset, dBeta.offset + D);

    const dyData = dY.data;
    const xHatData = XHat.data;
    const gData = gamma.data;
    const dxData = dX.data;
    const dgData = dGamma.data;
    const dbData = dBeta.data;

    // Accumulate dGamma & dBeta
    for (let r = 0; r < outerRows; r++) {
      const rStart = r * D;
      for (let j = 0; j < D; j++) {
        const dy = dyData[dY.offset + rStart + j];
        const xh = xHatData[XHat.offset + rStart + j];
        dgData[dGamma.offset + j] += dy * xh;
        dbData[dBeta.offset + j] += dy;
      }
    }

    // Cast dGamma and dBeta to Float32
    for (let j = 0; j < D; j++) {
      dgData[dGamma.offset + j] = Math.fround(dgData[dGamma.offset + j]);
      dbData[dBeta.offset + j] = Math.fround(dbData[dBeta.offset + j]);
    }

    // Compute dX row by row using exact closed-form:
    // dx_j = (invStd / D) * (D * dxHat_j - sum(dxHat) - xHat_j * sum(dxHat * xHat))
    for (let r = 0; r < outerRows; r++) {
      const rStart = r * D;
      const invStdVal = invStd[r];

      let sumDxHat = 0.0;
      let sumDxHatXHat = 0.0;

      for (let j = 0; j < D; j++) {
        const dy = dyData[dY.offset + rStart + j];
        const dxHat = dy * gData[gamma.offset + j];
        const xh = xHatData[XHat.offset + rStart + j];
        sumDxHat += dxHat;
        sumDxHatXHat += dxHat * xh;
      }

      const factor = invStdVal * invD;
      for (let j = 0; j < D; j++) {
        const dy = dyData[dY.offset + rStart + j];
        const dxHat = dy * gData[gamma.offset + j];
        const xh = xHatData[XHat.offset + rStart + j];
        const val = factor * (D * dxHat - sumDxHat - xh * sumDxHatXHat);
        dxData[dX.offset + rStart + j] = Math.fround(val);
      }
    }

    return { dX, dGamma, dBeta };
  }

  /**
   * Canonical numerical reference.
   */
  public static reference(X: Tensor, gamma: Tensor, beta: Tensor, eps: number = 1e-5): Float32Array {
    LayerNormKernel.validateShapes(X, gamma, beta);
    const D = X.shape[X.ndim - 1];
    const outerRows = X.size / D;
    const ref = new Float32Array(X.size);

    for (let r = 0; r < outerRows; r++) {
      let sum = 0.0;
      for (let j = 0; j < D; j++) {
        sum += X.data[X.offset + r * D + j];
      }
      const mean = sum / D;
      let varSum = 0.0;
      for (let j = 0; j < D; j++) {
        const d = X.data[X.offset + r * D + j] - mean;
        varSum += d * d;
      }
      const invStd = 1.0 / Math.sqrt(varSum / D + eps);
      for (let j = 0; j < D; j++) {
        const norm = (X.data[X.offset + r * D + j] - mean) * invStd;
        ref[r * D + j] = Math.fround(norm * gamma.data[gamma.offset + j] + beta.data[beta.offset + j]);
      }
    }
    return ref;
  }

  /**
   * Shape validation.
   */
  public static validateShapes(X: Tensor, gamma: Tensor, beta: Tensor): void {
    const D = X.shape[X.ndim - 1];
    if (gamma.size !== D || beta.size !== D) {
      throw new Error(`LayerNormKernel dimension mismatch: last dim is ${D}, but gamma (${gamma.size}) or beta (${beta.size}) differ`);
    }
  }
}
