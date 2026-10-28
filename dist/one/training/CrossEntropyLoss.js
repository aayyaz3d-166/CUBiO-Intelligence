/**
 * CUBiO AI — ONE LANGUAGE — CROSS-ENTROPY LOSS INTEGRATION
 * ==========================================================
 * Module: @one/training/CrossEntropyLoss
 * Gate: ONE-07 / Tensor Training Primitives
 *
 * Implements authoritative fused cross-entropy loss integrating
 * natively with reverse-mode autograd.
 */
import { AutogradOps } from '../tensor/autograd/AutogradOps';
export class CrossEntropyLoss {
    reduction;
    constructor(options = {}) {
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
    forward(logits, targets, arena) {
        const loss = AutogradOps.crossEntropy(logits, targets, arena);
        if (this.reduction === 'sum') {
            const B = logits.shape[0];
            loss.data[loss.offset] = Math.fround(loss.data[loss.offset] * B);
        }
        return loss;
    }
}
