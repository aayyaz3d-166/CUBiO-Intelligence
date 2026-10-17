/**
 * CUBiO AI — ONE LANGUAGE — FUSED ADAMW & GRADIENT CLIPPING KERNEL
 * =================================================================
 * Module: @one/training/FusedAdamWClipping
 * Task: ONE Benchmark Suite / Fused Float32Array Kernel
 *
 * Combines global L2 gradient norm reduction, dynamic threshold clipping,
 * and AdamW parameter updates into an optimized contiguous Float32Array loop.
 *
 * Eliminates redundant memory sweeps across multi-megabyte parameter buffers:
 * - Unfused: Pass 1 (norm reduce) + Pass 2 (in-place clip) + Pass 3 (AdamW moments & update)
 * - Fused:   Pass 1 (norm reduce) + Pass 2 (fused clip + AdamW streaming update)
 */

export interface FusedAdamWOptions {
  lr?: number;
  maxNorm?: number;
  beta1?: number;
  beta2?: number;
  eps?: number;
  weightDecay?: number;
}

export class FusedAdamWClippingOptimizer {
  public lr: number;
  public maxNorm: number;
  public beta1: number;
  public beta2: number;
  public eps: number;
  public weightDecay: number;
  public stepCount: number = 0;

  public readonly m: Float32Array;
  public readonly v: Float32Array;
  public readonly totalParams: number;

  constructor(totalParams: number, options: FusedAdamWOptions = {}) {
    this.totalParams = totalParams;
    this.lr = options.lr ?? 0.001;
    this.maxNorm = options.maxNorm ?? 1.0;
    this.beta1 = options.beta1 ?? 0.9;
    this.beta2 = options.beta2 ?? 0.999;
    this.eps = options.eps ?? 1e-8;
    this.weightDecay = options.weightDecay ?? 0.01;

    this.m = new Float32Array(totalParams);
    this.v = new Float32Array(totalParams);
  }

  /**
   * Unfused Baseline Execution (for direct apples-to-apples performance comparison):
   * Pass 1: compute L2 norm of gradients
   * Pass 2: scale gradients in-place if totalNorm > maxNorm
   * Pass 3: AdamW moments and parameter update
   */
  public stepUnfused(
    params: Float32Array,
    grads: Float32Array
  ): { totalNorm: number; clipped: boolean; durationMs: number } {
    const t0 = performance.now();
    this.stepCount++;
    const P = this.totalParams;
    const maxNorm = this.maxNorm;

    // Pass 1: L2 Norm Reduction
    let sumSq = 0.0;
    for (let i = 0; i < P; i++) {
      const g = grads[i];
      sumSq += g * g;
    }
    const totalNorm = Math.sqrt(sumSq);

    // Pass 2: In-place gradient clipping
    const clipped = totalNorm > maxNorm;
    if (clipped) {
      const clipCoef = maxNorm / (totalNorm + 1e-6);
      for (let i = 0; i < P; i++) {
        grads[i] *= clipCoef;
      }
    }

    // Pass 3: AdamW update
    const beta1 = this.beta1;
    const beta2 = this.beta2;
    const lr = this.lr;
    const eps = this.eps;
    const wd = this.weightDecay;
    const corr1 = 1.0 - Math.pow(beta1, this.stepCount);
    const corr2 = 1.0 - Math.pow(beta2, this.stepCount);
    const m = this.m;
    const v = this.v;

    for (let i = 0; i < P; i++) {
      const g = grads[i];
      const mNext = beta1 * m[i] + (1.0 - beta1) * g;
      m[i] = mNext;

      const vNext = beta2 * v[i] + (1.0 - beta2) * g * g;
      v[i] = vNext;

      const mHat = mNext / corr1;
      const vHat = vNext / corr2;
      const step = mHat / (Math.sqrt(vHat) + eps);

      params[i] -= lr * (step + wd * params[i]);
    }

    const durationMs = performance.now() - t0;
    return { totalNorm, clipped, durationMs };
  }

  /**
   * Fused Execution:
   * Pass 1: compute L2 norm of gradients
   * Pass 2: FUSED single streaming loop applying clipCoef and AdamW moments + parameter updates.
   *
   * Completely bypasses writing scaled gradients back to memory, saving 40 MB of RAM traffic.
   */
  public stepFused(
    params: Float32Array,
    grads: Float32Array
  ): { totalNorm: number; clipped: boolean; durationMs: number } {
    const t0 = performance.now();
    this.stepCount++;
    const P = this.totalParams;
    const maxNorm = this.maxNorm;

    // Pass 1: L2 Norm Reduction (fast single-array sweep)
    let sumSq = 0.0;
    // 4-way unrolled reduction for maximum CPU IPC
    const unrollLimit = P - (P % 4);
    let i = 0;
    for (; i < unrollLimit; i += 4) {
      const g0 = grads[i];
      const g1 = grads[i + 1];
      const g2 = grads[i + 2];
      const g3 = grads[i + 3];
      sumSq += g0 * g0 + g1 * g1 + g2 * g2 + g3 * g3;
    }
    for (; i < P; i++) {
      const g = grads[i];
      sumSq += g * g;
    }
    const totalNorm = Math.sqrt(sumSq);

    const clipped = totalNorm > maxNorm;
    const clipCoef = clipped ? maxNorm / (totalNorm + 1e-6) : 1.0;

    // Pass 2: FUSED AdamW + Dynamic Clip Streaming Loop
    const beta1 = this.beta1;
    const beta2 = this.beta2;
    const oneMinusBeta1 = 1.0 - beta1;
    const oneMinusBeta2 = 1.0 - beta2;
    const lr = this.lr;
    const eps = this.eps;
    const wd = this.weightDecay;
    const corr1 = 1.0 - Math.pow(beta1, this.stepCount);
    const corr2 = 1.0 - Math.pow(beta2, this.stepCount);
    const invCorr1 = 1.0 / corr1;
    const invCorr2 = 1.0 / corr2;
    const m = this.m;
    const v = this.v;

    // Stream through params, grads, m, v simultaneously
    for (let j = 0; j < P; j++) {
      // Dynamic clip in register (zero redundant RAM round-trip)
      const g = grads[j] * clipCoef;

      const mNext = beta1 * m[j] + oneMinusBeta1 * g;
      m[j] = mNext;

      const vNext = beta2 * v[j] + oneMinusBeta2 * g * g;
      v[j] = vNext;

      const mHat = mNext * invCorr1;
      const vHat = vNext * invCorr2;
      const stepVal = mHat / (Math.sqrt(vHat) + eps);

      params[j] -= lr * (stepVal + wd * params[j]);
    }

    const durationMs = performance.now() - t0;
    return { totalNorm, clipped, durationMs };
  }
}
