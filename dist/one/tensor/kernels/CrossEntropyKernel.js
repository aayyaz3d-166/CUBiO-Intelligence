/**
 * CUBiO AI — ONE LANGUAGE — VERIFIED TENSOR TRAINING KERNELS
 * ============================================================
 * Kernel: CrossEntropyKernel (Fused Softmax + Negative Log-Likelihood Loss)
 * Module: @one/tensor/kernels/CrossEntropyKernel
 */
import { Tensor } from '../Tensor';
export class CrossEntropyKernel {
    /**
     * Forward: Fused Softmax + Cross-Entropy Loss
     * Logits [B, C], Targets [B] with class indices in [0, C-1].
     */
    static forward(logits, targets, arena) {
        CrossEntropyKernel.validate(logits, targets);
        const [B, C] = logits.shape;
        const invB = 1.0 / B;
        const probs = arena ? arena.allocateTensor([B, C]) : Tensor.zeros([B, C]);
        const zData = logits.data;
        const pData = probs.data;
        let totalLoss = 0.0;
        for (let i = 0; i < B; i++) {
            const rowStart = logits.offset + i * logits.strides[0];
            const pStart = probs.offset + i * probs.strides[0];
            const targetClass = targets[i];
            // 1. Max for Log-Sum-Exp stability
            let maxLogit = -Infinity;
            for (let j = 0; j < C; j++) {
                const val = zData[rowStart + j * logits.strides[1]];
                if (val > maxLogit)
                    maxLogit = val;
            }
            // 2. Exponentials & sum
            let sumExp = 0.0;
            for (let j = 0; j < C; j++) {
                const expVal = Math.exp(zData[rowStart + j * logits.strides[1]] - maxLogit);
                pData[pStart + j * probs.strides[1]] = expVal;
                sumExp += expVal;
            }
            // 3. Log-Sum-Exp & Loss
            const logSumExp = maxLogit + Math.log(sumExp + 1e-12);
            const targetLogit = zData[rowStart + targetClass * logits.strides[1]];
            const sampleLoss = logSumExp - targetLogit;
            totalLoss += sampleLoss;
            // 4. Softmax probabilities
            const invSumExp = 1.0 / (sumExp + 1e-12);
            for (let j = 0; j < C; j++) {
                pData[pStart + j * probs.strides[1]] = Math.fround(pData[pStart + j * probs.strides[1]] * invSumExp);
            }
        }
        const meanLoss = Math.fround(totalLoss * invB);
        const out = arena ? arena.allocateTensor([1]) : Tensor.zeros([1]);
        out.data[out.offset] = meanLoss;
        return {
            loss: meanLoss,
            output: out,
            ctx: { probs, targets, batchSize: B, numClasses: C },
        };
    }
    /**
     * Backward:
     * dLogits_{ij} = (1 / B) * (probs_{ij} - (j === y_i ? 1 : 0))
     */
    static backward(dLoss = 1.0, ctx, arena) {
        const { probs, targets, batchSize: B, numClasses: C } = ctx;
        const upstreamGrad = typeof dLoss === 'number' ? dLoss : dLoss.item();
        const dLogits = arena ? arena.allocateTensor([B, C]) : Tensor.zeros([B, C]);
        const factor = upstreamGrad / B;
        const pData = probs.data;
        const dlData = dLogits.data;
        for (let i = 0; i < B; i++) {
            const pStart = probs.offset + i * probs.strides[0];
            const dlStart = dLogits.offset + i * dLogits.strides[0];
            const targetClass = targets[i];
            for (let j = 0; j < C; j++) {
                const prob = pData[pStart + j * probs.strides[1]];
                const indicator = j === targetClass ? 1.0 : 0.0;
                const g = (prob - indicator) * factor;
                dlData[dlStart + j * dLogits.strides[1]] = Math.fround(g);
            }
        }
        return { dLogits };
    }
    /**
     * Canonical numerical reference.
     */
    static reference(logits, targets) {
        CrossEntropyKernel.validate(logits, targets);
        const [B, C] = logits.shape;
        let sumLoss = 0.0;
        for (let i = 0; i < B; i++) {
            let maxVal = -Infinity;
            for (let j = 0; j < C; j++) {
                const v = logits.get(i, j);
                if (v > maxVal)
                    maxVal = v;
            }
            let sumExp = 0.0;
            for (let j = 0; j < C; j++) {
                sumExp += Math.exp(logits.get(i, j) - maxVal);
            }
            const lse = maxVal + Math.log(sumExp);
            const loss_i = lse - logits.get(i, targets[i]);
            sumLoss += loss_i;
        }
        return Math.fround(sumLoss / B);
    }
    /**
     * Validation.
     */
    static validate(logits, targets) {
        if (logits.ndim !== 2) {
            throw new Error(`CrossEntropyKernel requires 2D logits [Batch, Classes], got ${logits.ndim}D`);
        }
        const [B, C] = logits.shape;
        if (targets.length !== B) {
            throw new Error(`Targets length (${targets.length}) must match batch dimension (${B})`);
        }
        for (let i = 0; i < B; i++) {
            if (targets[i] < 0 || targets[i] >= C) {
                throw new RangeError(`Target class index ${targets[i]} at batch item ${i} is outside [0, ${C})`);
            }
        }
    }
}
