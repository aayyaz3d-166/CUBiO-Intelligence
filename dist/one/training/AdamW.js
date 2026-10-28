/**
 * CUBiO AI — ONE LANGUAGE — ADAMW OPTIMIZER
 * ===========================================
 * Module: @one/training/AdamW
 * Gate: ONE-07 / Tensor Training Primitives
 *
 * Implements decoupled weight decay AdamW optimizer operating natively on
 * ONE Float32Array-backed Tensors.
 */
import { computeMomentsChecksum, } from './OptimizerState';
export class AdamWOptimizer {
    parameters;
    lr;
    beta1;
    beta2;
    eps;
    weightDecay;
    stepCount = 0;
    // First and second moment buffers mapped by parameter Tensor
    m = new Map();
    v = new Map();
    constructor(parameters, options = {}) {
        this.parameters = [...parameters];
        this.lr = options.lr ?? options.learningRate ?? 0.001;
        this.beta1 = options.beta1 ?? 0.9;
        this.beta2 = options.beta2 ?? 0.999;
        this.eps = options.eps ?? options.epsilon ?? 1e-8;
        this.weightDecay = options.weightDecay ?? 0.01;
        // Allocate moment buffers
        for (const p of this.parameters) {
            this.m.set(p, new Float32Array(p.size));
            this.v.set(p, new Float32Array(p.size));
        }
    }
    /**
     * Resets all parameter gradients to zero.
     *
     * @param setNone If true, sets param.grad = null instead of zeroing buffer
     */
    zeroGrad(setNone = false) {
        for (const p of this.parameters) {
            if (p.grad) {
                if (setNone) {
                    p.grad = null;
                }
                else {
                    p.grad.data.fill(0, p.grad.offset, p.grad.offset + p.grad.size);
                }
            }
        }
    }
    /**
     * Performs a single optimization step (parameter update).
     */
    step() {
        this.stepCount++;
        const corr1 = 1.0 - Math.pow(this.beta1, this.stepCount);
        const corr2 = 1.0 - Math.pow(this.beta2, this.stepCount);
        for (const p of this.parameters) {
            if (!p.grad)
                continue;
            const mArr = this.m.get(p);
            const vArr = this.v.get(p);
            if (!mArr || !vArr)
                continue;
            const pData = p.data;
            const gData = p.grad.data;
            const pOffset = p.offset;
            const gOffset = p.grad.offset;
            const size = p.size;
            const lr = this.lr;
            const beta1 = this.beta1;
            const beta2 = this.beta2;
            const eps = this.eps;
            const wd = this.weightDecay;
            for (let i = 0; i < size; i++) {
                const g = gData[gOffset + i];
                // 1. Update biased first moment estimate
                const mNext = beta1 * mArr[i] + (1.0 - beta1) * g;
                mArr[i] = mNext;
                // 2. Update biased second raw moment estimate
                const vNext = beta2 * vArr[i] + (1.0 - beta2) * g * g;
                vArr[i] = vNext;
                // 3. Compute bias-corrected moments
                const mHat = mNext / corr1;
                const vHat = vNext / corr2;
                // 4. Update parameter using decoupled weight decay
                const step = mHat / (Math.sqrt(vHat) + eps);
                pData[pOffset + i] -= lr * (step + wd * pData[pOffset + i]);
            }
        }
    }
    /**
     * Serializes current optimizer state into a portable record.
     */
    stateDict() {
        const moments = this.parameters.map((p, idx) => ({
            paramIndex: idx,
            shape: [...p.shape],
            size: p.size,
            m: new Float32Array(this.m.get(p)),
            v: new Float32Array(this.v.get(p)),
        }));
        const checksum = computeMomentsChecksum(moments);
        return {
            stepCount: this.stepCount,
            lr: this.lr,
            beta1: this.beta1,
            beta2: this.beta2,
            eps: this.eps,
            weightDecay: this.weightDecay,
            moments,
            checksum,
        };
    }
    /**
     * Loads optimizer state from a state record.
     */
    loadStateDict(state) {
        this.stepCount = state.stepCount;
        this.lr = state.lr;
        this.beta1 = state.beta1;
        this.beta2 = state.beta2;
        this.eps = state.eps;
        this.weightDecay = state.weightDecay;
        for (let idx = 0; idx < this.parameters.length; idx++) {
            const p = this.parameters[idx];
            const rec = state.moments.find((m) => m.paramIndex === idx);
            if (rec) {
                const mArr = this.m.get(p);
                const vArr = this.v.get(p);
                mArr.set(rec.m);
                vArr.set(rec.v);
            }
        }
    }
    /**
     * Clones this optimizer into an isolated sandbox instance.
     */
    clone(sandboxParams) {
        const targetParams = sandboxParams ?? this.parameters.map((p) => p.clone());
        const cloned = new AdamWOptimizer(targetParams, {
            lr: this.lr,
            beta1: this.beta1,
            beta2: this.beta2,
            eps: this.eps,
            weightDecay: this.weightDecay,
        });
        cloned.stepCount = this.stepCount;
        for (let idx = 0; idx < this.parameters.length; idx++) {
            const origP = this.parameters[idx];
            const targetP = targetParams[idx];
            const mOrig = this.m.get(origP);
            const vOrig = this.v.get(origP);
            cloned.m.get(targetP).set(mOrig);
            cloned.v.get(targetP).set(vOrig);
        }
        return cloned;
    }
}
