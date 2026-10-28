/**
 * CUBiO AI — ONE LANGUAGE — FINITE-DIFFERENCE GRADIENT CHECK HARNESS
 * ====================================================================
 * Module: @one/tensor/GradCheck
 * Gate: ONE-02 / Numeric Foundation for Training
 *
 * Implements a rigorous, bit-exact finite-difference gradient verification
 * harness to mathematically validate analytical gradients against numerical
 * approximations via two-sided central differences:
 *
 *   g_num[i] = (f(x + eps * e_i) - f(x - eps * e_i)) / (2 * eps)
 *   rel_error[i] = |g_num[i] - g_ana[i]| / (max(|g_num[i]|, |g_ana[i]|) + delta)
 */
import { Tensor } from './Tensor';
export class GradCheck {
    /**
     * Computes the numerical gradient of a scalar function f(x) with respect to input tensor x.
     * Returns a new Tensor containing the numerical gradients.
     */
    static computeNumericalGradient(f, x, eps = 1e-3) {
        if (!x.isContiguous()) {
            x = x.contiguous();
        }
        const numGrad = Tensor.zeros(x.shape);
        const data = x.data;
        const offset = x.offset;
        const invTwoEps = 1.0 / (2.0 * eps);
        for (let i = 0; i < x.size; i++) {
            const origVal = data[offset + i];
            // Forward perturbation: x + eps
            data[offset + i] = origVal + eps;
            const fPlus = f(x);
            // Backward perturbation: x - eps
            data[offset + i] = origVal - eps;
            const fMinus = f(x);
            // Restore original value
            data[offset + i] = origVal;
            // Two-sided central difference
            const gNum = (fPlus - fMinus) * invTwoEps;
            numGrad.data[numGrad.offset + i] = Math.fround(gNum);
        }
        return numGrad;
    }
    /**
     * Performs finite-difference gradient check comparing analytical gradient against numerical gradient.
     */
    static check(f, x, analyticalGrad, options = {}) {
        if (!x.isContiguous()) {
            x = x.contiguous();
        }
        if (!analyticalGrad.isContiguous()) {
            analyticalGrad = analyticalGrad.contiguous();
        }
        const eps = options.eps ?? 1e-3;
        const rtol = options.rtol ?? 1e-3;
        const atol = options.atol ?? 1e-4;
        const delta = options.delta ?? 1e-7;
        const maxSamples = options.maxSamples ?? 256;
        if (x.size !== analyticalGrad.size) {
            throw new Error(`Size mismatch: input x (${x.size}) !== analyticalGrad (${analyticalGrad.size})`);
        }
        // Determine indices to check
        let indicesToCheck;
        if (options.sampleIndices) {
            indicesToCheck = options.sampleIndices;
        }
        else if (x.size <= maxSamples) {
            indicesToCheck = Array.from({ length: x.size }, (_, i) => i);
        }
        else {
            // Stratified / deterministic sampling
            indicesToCheck = [];
            const stride = Math.floor(x.size / maxSamples);
            for (let i = 0; i < x.size && indicesToCheck.length < maxSamples; i += stride) {
                indicesToCheck.push(i);
            }
        }
        const data = x.data;
        const offset = x.offset;
        const anaData = analyticalGrad.data;
        const anaOffset = analyticalGrad.offset;
        const invTwoEps = 1.0 / (2.0 * eps);
        const details = [];
        let maxRelError = 0.0;
        let maxAbsError = 0.0;
        let sumRelError = 0.0;
        let failedCount = 0;
        for (const idx of indicesToCheck) {
            const origVal = data[offset + idx];
            // f(x + eps)
            data[offset + idx] = origVal + eps;
            const fPlus = f(x);
            // f(x - eps)
            data[offset + idx] = origVal - eps;
            const fMinus = f(x);
            // Restore
            data[offset + idx] = origVal;
            const gNum = (fPlus - fMinus) * invTwoEps;
            const gAna = anaData[anaOffset + idx];
            const absErr = Math.abs(gNum - gAna);
            const denom = Math.max(Math.abs(gNum), Math.abs(gAna)) + delta;
            const relErr = absErr / denom;
            if (absErr > maxAbsError)
                maxAbsError = absErr;
            if (relErr > maxRelError)
                maxRelError = relErr;
            sumRelError += relErr;
            // Check against tolerance: either absErr <= atol OR relErr <= rtol
            const passed = absErr <= atol || relErr <= rtol;
            if (!passed)
                failedCount++;
            details.push({
                index: idx,
                numericalGrad: gNum,
                analyticalGrad: gAna,
                absError: absErr,
                relError: relErr,
                passed,
            });
        }
        const meanRelError = sumRelError / indicesToCheck.length;
        return {
            passed: failedCount === 0,
            totalChecked: indicesToCheck.length,
            failedCount,
            maxRelError,
            maxAbsError,
            meanRelError,
            details,
        };
    }
    // ───────────────────────────────────────────────────────────────────────────
    // PRE-CONFIGURED VERIFICATION SUITES FOR CORE OPERATIONS
    // ───────────────────────────────────────────────────────────────────────────
    /**
     * Verifies gradient of Mean Squared Error loss w.r.t input prediction.
     * L = (1/N) * sum((pred - target)^2)
     * dL/d(pred) = (2/N) * (pred - target)
     */
    static checkMSE(pred, target, options) {
        const { grad: anaGrad } = pred.mseLoss(target);
        const lossFn = (p) => p.mseLoss(target).loss;
        return GradCheck.check(lossFn, pred, anaGrad, options);
    }
    /**
     * Verifies gradient of Linear / Matmul: y = x W^T -> Loss = sum(y * target).
     */
    static checkLinearInput(x, W, target, options) {
        // Loss = sum(matmul(x, W^T) * target)
        // dL/dx = matmul(target, W)
        const WT = W.transpose(0, 1).contiguous();
        const anaGrad = target.matmul(W); // [M, N] x [N, K] -> [M, K]
        const lossFn = (xInput) => {
            const y = xInput.matmul(WT);
            const prod = y.mul(target);
            return prod.sum().item();
        };
        return GradCheck.check(lossFn, x, anaGrad, options);
    }
    /**
     * Verifies gradient of Fast GELU activation w.r.t input.
     */
    static checkGELU(x, targetWeight, options) {
        // Forward: y = GELU(x)
        // Loss = sum(y * targetWeight)
        // Analytical gradient approx derivative: dy/dx ~= 0.95 (or exact GELU derivative)
        const c1 = 0.7978845608;
        const c2 = 0.044715;
        const anaGrad = Tensor.zeros(x.shape);
        for (let i = 0; i < x.size; i++) {
            const xi = x.data[x.offset + i];
            const inner = c1 * (xi + c2 * xi * xi * xi);
            const tanhVal = Math.tanh(inner);
            const sech2 = 1.0 - tanhVal * tanhVal;
            const dInner = c1 * (1.0 + 3.0 * c2 * xi * xi);
            // d(GELU)/dx = 0.5 * (1 + tanh) + 0.5 * x * sech^2 * dInner
            const dGelu = 0.5 * (1.0 + tanhVal) + 0.5 * xi * sech2 * dInner;
            anaGrad.data[anaGrad.offset + i] = Math.fround(dGelu * targetWeight.data[targetWeight.offset + i]);
        }
        const lossFn = (xInput) => {
            const y = xInput.gelu();
            const prod = y.mul(targetWeight);
            return prod.sum().item();
        };
        return GradCheck.check(lossFn, x, anaGrad, options);
    }
}
