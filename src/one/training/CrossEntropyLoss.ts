/**
 * CUBiO AI — ONE LANGUAGE — CROSS-ENTROPY LOSS INTEGRATION
 * ==========================================================
 * Module: @one/training/CrossEntropyLoss
 * Gate: ONE-07 / Tensor Training Primitives
 *
 * Implements authoritative fused cross-entropy loss integrating
 * natively with reverse-mode autograd.
 */

import { Tensor } from '../tensor/Tensor';
import { TensorMemoryArena } from '../tensor/TensorArena';
import { AutogradOps } from '../tensor/autograd/AutogradOps';

export interface CrossEntropyLossOptions {
  reduction?: 'mean' | 'sum';
}

export class CrossEntropyLoss {
  public readonly reduction: 'mean' | 'sum';

  constructor(options: CrossEntropyLossOptions = {}) {
    this.reduction = options.reduction ?? 'mean';
  }

  /**
   * Forward pass: computes cross-entropy loss from unnormalized logits and class targets.
   *
   * @param logits Tensor of shape [BatchSize, NumClasses]
   * @param targets Array of ground-truth integer class labels of length BatchSize
   * @param arena Optional TensorMemoryArena for zero-allocation scratch execution
   * @returns Scalar loss Tensor of shape [1]
   */
  public forward(
    logits: Tensor,
    targets: number[] | Int32Array,
    arena?: TensorMemoryArena
  ): Tensor {
    const loss = AutogradOps.crossEntropy(logits, targets, arena);
    if (this.reduction === 'sum') {
      const B = logits.shape[0];
      loss.data[loss.offset] = Math.fround(loss.data[loss.offset] * B);
    }
    return loss;
  }
}
