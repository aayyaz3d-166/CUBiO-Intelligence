/**
 * CUBiO AI — ONE LANGUAGE — GRADIENT CLIPPING PRIMITIVE
 * ========================================================
 * Module: @one/training/GradientClipping
 * Gate: ONE-07 / Tensor Training Primitives
 *
 * Implements authoritative in-place gradient norm clipping across
 * an arbitrary list of parameter tensors.
 */
/**
 * Clips gradient norm of an iterable of parameters in place.
 *
 * The norm is computed over all gradients together, as if they were
 * concatenated into a single vector.
 *
 * @param parameters Iterable of Tensors that have potential gradients
 * @param maxNorm Max L2 norm of the gradients
 * @param normType Type of the used p-norm (default: 2.0 for L2 norm)
 * @returns Total unclipped norm of the parameters
 */
export function clipGradNorm(parameters, maxNorm, normType = 2.0) {
    if (maxNorm <= 0) {
        throw new Error(`[GradientClipping Error] maxNorm must be positive, got ${maxNorm}`);
    }
    let totalNorm = 0.0;
    if (normType === 2.0) {
        let sumSq = 0.0;
        for (const p of parameters) {
            if (!p.grad)
                continue;
            const gData = p.grad.data;
            const offset = p.grad.offset;
            const size = p.grad.size;
            for (let i = 0; i < size; i++) {
                const g = gData[offset + i];
                sumSq += g * g;
            }
        }
        totalNorm = Math.sqrt(sumSq);
    }
    else if (normType === Infinity) {
        let maxAbs = 0.0;
        for (const p of parameters) {
            if (!p.grad)
                continue;
            const gData = p.grad.data;
            const offset = p.grad.offset;
            const size = p.grad.size;
            for (let i = 0; i < size; i++) {
                const abs = Math.abs(gData[offset + i]);
                if (abs > maxAbs)
                    maxAbs = abs;
            }
        }
        totalNorm = maxAbs;
    }
    else {
        let sumP = 0.0;
        for (const p of parameters) {
            if (!p.grad)
                continue;
            const gData = p.grad.data;
            const offset = p.grad.offset;
            const size = p.grad.size;
            for (let i = 0; i < size; i++) {
                sumP += Math.pow(Math.abs(gData[offset + i]), normType);
            }
        }
        totalNorm = Math.pow(sumP, 1.0 / normType);
    }
    if (Number.isNaN(totalNorm)) {
        throw new Error('[GradientClipping Error] Gradient norm computed to NaN');
    }
    if (totalNorm > maxNorm) {
        const clipCoef = maxNorm / (totalNorm + 1e-6);
        for (const p of parameters) {
            if (!p.grad)
                continue;
            const gData = p.grad.data;
            const offset = p.grad.offset;
            const size = p.grad.size;
            for (let i = 0; i < size; i++) {
                gData[offset + i] = Math.fround(gData[offset + i] * clipCoef);
            }
        }
    }
    return totalNorm;
}
