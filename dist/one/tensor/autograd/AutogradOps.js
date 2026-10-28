/**
 * CUBiO AI — ONE LANGUAGE — AUTOGRAD OPERATORS
 * ===============================================
 * Module: @one/tensor/autograd/AutogradOps
 * Gate: ONE-04 / Reverse-Mode Automatic Differentiation
 *
 * Implements high-level tensor operations that transparently record
 * computation tape entries integrating with ONE-03 kernels.
 */
import { Tensor } from '../Tensor';
import { AutogradTape } from './AutogradTape';
import { MatmulKernel, AddKernel, MulKernel, TransposeKernel, SoftmaxKernel, LayerNormKernel, ReluKernel, ReduceKernel, CrossEntropyKernel, } from '../kernels';
export class AutogradOps {
    /**
     * Matrix multiplication: C = A x B.
     */
    static matmul(A, B, arena) {
        const tape = AutogradTape.getActiveTape();
        const needsGrad = (A.requiresGrad || B.requiresGrad) && AutogradTape.isRecording();
        const { output, ctx } = MatmulKernel.forward(A, B, arena);
        if (needsGrad) {
            tape.record({
                opName: 'matmul',
                inputs: [A, B],
                output,
                backward: (dOut, bwdArena) => {
                    const { dA, dB } = MatmulKernel.backward(dOut, ctx, bwdArena ?? arena);
                    return [A.requiresGrad ? dA : null, B.requiresGrad ? dB : null];
                },
                cleanUp: () => {
                    ctx.A = null;
                    ctx.B = null;
                },
            });
        }
        return output;
    }
    /**
     * Elementwise addition & bias broadcasting: C = A + B.
     */
    static add(A, B, arena) {
        const tape = AutogradTape.getActiveTape();
        const needsGrad = (A.requiresGrad || B.requiresGrad) && AutogradTape.isRecording();
        const { output, ctx } = AddKernel.forward(A, B, arena);
        if (needsGrad) {
            tape.record({
                opName: 'add',
                inputs: [A, B],
                output,
                backward: (dOut, bwdArena) => {
                    const { dA, dB } = AddKernel.backward(dOut, ctx, bwdArena ?? arena);
                    return [A.requiresGrad ? dA : null, B.requiresGrad ? dB : null];
                },
                cleanUp: () => { },
            });
        }
        return output;
    }
    /**
     * Elementwise subtraction: C = A - B.
     */
    static sub(A, B, arena) {
        const tape = AutogradTape.getActiveTape();
        const needsGrad = (A.requiresGrad || B.requiresGrad) && AutogradTape.isRecording();
        const output = arena ? arena.allocateTensor(A.shape) : Tensor.zeros(A.shape);
        A.sub(B, output, arena);
        if (needsGrad) {
            tape.record({
                opName: 'sub',
                inputs: [A, B],
                output,
                backward: (dOut, bwdArena) => {
                    let dA = null;
                    let dB = null;
                    if (A.requiresGrad) {
                        dA = dOut.clone(bwdArena ?? arena);
                    }
                    if (B.requiresGrad) {
                        dB = bwdArena ? bwdArena.allocateTensor(B.shape) : Tensor.zeros(B.shape);
                        for (let i = 0; i < dOut.size; i++) {
                            dB.data[dB.offset + i] = Math.fround(-dOut.data[dOut.offset + i]);
                        }
                    }
                    return [dA, dB];
                },
                cleanUp: () => { },
            });
        }
        return output;
    }
    /**
     * Elementwise multiplication: C = A * B.
     */
    static mul(A, B, arena) {
        const tape = AutogradTape.getActiveTape();
        const needsGrad = (A.requiresGrad || B.requiresGrad) && AutogradTape.isRecording();
        const { output, ctx } = MulKernel.forward(A, B, arena);
        if (needsGrad) {
            tape.record({
                opName: 'mul',
                inputs: [A, B],
                output,
                backward: (dOut, bwdArena) => {
                    const { dA, dB } = MulKernel.backward(dOut, ctx, bwdArena ?? arena);
                    return [A.requiresGrad ? dA : null, B.requiresGrad ? dB : null];
                },
                cleanUp: () => {
                    ctx.A = null;
                    ctx.B = null;
                },
            });
        }
        return output;
    }
    /**
     * Transpose tensor axes: B = transpose(A, dim0, dim1).
     */
    static transpose(A, dim0 = 0, dim1 = 1, arena) {
        const tape = AutogradTape.getActiveTape();
        const needsGrad = A.requiresGrad && AutogradTape.isRecording();
        const { output, ctx } = TransposeKernel.forward(A, dim0, dim1, arena);
        if (needsGrad) {
            tape.record({
                opName: 'transpose',
                inputs: [A],
                output,
                backward: (dOut, bwdArena) => {
                    const { dA } = TransposeKernel.backward(dOut, ctx, bwdArena ?? arena);
                    return [dA];
                },
                cleanUp: () => { },
            });
        }
        return output;
    }
    /**
     * Numerically stable Softmax: S = softmax(X, axis).
     */
    static softmax(X, axis = -1, arena) {
        const tape = AutogradTape.getActiveTape();
        const needsGrad = X.requiresGrad && AutogradTape.isRecording();
        const { output, ctx } = SoftmaxKernel.forward(X, axis, arena);
        if (needsGrad) {
            tape.record({
                opName: 'softmax',
                inputs: [X],
                output,
                backward: (dOut, bwdArena) => {
                    const { dX } = SoftmaxKernel.backward(dOut, ctx, bwdArena ?? arena);
                    return [dX];
                },
                cleanUp: () => {
                    ctx.probs = null;
                },
            });
        }
        return output;
    }
    /**
     * Layer Normalization: Y = LN(X, gamma, beta).
     */
    static layerNorm(X, gamma, beta, eps = 1e-5, arena) {
        const tape = AutogradTape.getActiveTape();
        const needsGrad = (X.requiresGrad || gamma.requiresGrad || beta.requiresGrad) && AutogradTape.isRecording();
        const { output, ctx } = LayerNormKernel.forward(X, gamma, beta, eps, arena);
        if (needsGrad) {
            tape.record({
                opName: 'layernorm',
                inputs: [X, gamma, beta],
                output,
                backward: (dOut, bwdArena) => {
                    const { dX, dGamma, dBeta } = LayerNormKernel.backward(dOut, ctx, bwdArena ?? arena);
                    return [
                        X.requiresGrad ? dX : null,
                        gamma.requiresGrad ? dGamma : null,
                        beta.requiresGrad ? dBeta : null,
                    ];
                },
                cleanUp: () => {
                    ctx.XHat = null;
                    ctx.invStd = null;
                    ctx.gamma = null;
                    ctx.beta = null;
                },
            });
        }
        return output;
    }
    /**
     * Rectified Linear Unit activation: Y = max(0, X).
     */
    static relu(X, arena) {
        const tape = AutogradTape.getActiveTape();
        const needsGrad = X.requiresGrad && AutogradTape.isRecording();
        const { output, ctx } = ReluKernel.forward(X, arena);
        if (needsGrad) {
            tape.record({
                opName: 'relu',
                inputs: [X],
                output,
                backward: (dOut, bwdArena) => {
                    const { dX } = ReluKernel.backward(dOut, ctx, bwdArena ?? arena);
                    return [dX];
                },
                cleanUp: () => {
                    ctx.X = null;
                },
            });
        }
        return output;
    }
    /**
     * Fast Gaussian Error Linear Unit activation: Y = GELU(X).
     */
    static gelu(X, arena) {
        const tape = AutogradTape.getActiveTape();
        const needsGrad = X.requiresGrad && AutogradTape.isRecording();
        const output = arena ? arena.allocateTensor(X.shape) : Tensor.zeros(X.shape);
        X.gelu(output, arena);
        if (needsGrad) {
            tape.record({
                opName: 'gelu',
                inputs: [X],
                output,
                backward: (dOut, bwdArena) => {
                    const c1 = 0.7978845608;
                    const c2 = 0.044715;
                    const dX = bwdArena ? bwdArena.allocateTensor(X.shape) : Tensor.zeros(X.shape);
                    for (let i = 0; i < X.size; i++) {
                        const xi = X.data[X.offset + i];
                        const inner = c1 * (xi + c2 * xi * xi * xi);
                        const tanhVal = Math.tanh(inner);
                        const sech2 = 1.0 - tanhVal * tanhVal;
                        const dInner = c1 * (1.0 + 3.0 * c2 * xi * xi);
                        const dGelu = 0.5 * (1.0 + tanhVal) + 0.5 * xi * sech2 * dInner;
                        dX.data[dX.offset + i] = Math.fround(dGelu * dOut.data[dOut.offset + i]);
                    }
                    return [dX];
                },
                cleanUp: () => { },
            });
        }
        return output;
    }
    /**
     * Sum reduction: Y = sum(X, axis, keepdim).
     */
    static reduceSum(X, axis, keepdim = false, arena) {
        const tape = AutogradTape.getActiveTape();
        const needsGrad = X.requiresGrad && AutogradTape.isRecording();
        const { output, ctx } = ReduceKernel.forward(X, 'sum', axis, keepdim, arena);
        if (needsGrad) {
            tape.record({
                opName: 'reduce_sum',
                inputs: [X],
                output,
                backward: (dOut, bwdArena) => {
                    const { dX } = ReduceKernel.backward(dOut, ctx, bwdArena ?? arena);
                    return [dX];
                },
                cleanUp: () => { },
            });
        }
        return output;
    }
    /**
     * Mean reduction: Y = mean(X, axis, keepdim).
     */
    static reduceMean(X, axis, keepdim = false, arena) {
        const tape = AutogradTape.getActiveTape();
        const needsGrad = X.requiresGrad && AutogradTape.isRecording();
        const { output, ctx } = ReduceKernel.forward(X, 'mean', axis, keepdim, arena);
        if (needsGrad) {
            tape.record({
                opName: 'reduce_mean',
                inputs: [X],
                output,
                backward: (dOut, bwdArena) => {
                    const { dX } = ReduceKernel.backward(dOut, ctx, bwdArena ?? arena);
                    return [dX];
                },
                cleanUp: () => { },
            });
        }
        return output;
    }
    /**
     * Fused Softmax + Cross-Entropy Loss: L = CrossEntropy(logits, targets).
     */
    static crossEntropy(logits, targets, arena) {
        const tape = AutogradTape.getActiveTape();
        const needsGrad = logits.requiresGrad && AutogradTape.isRecording();
        const { output, ctx } = CrossEntropyKernel.forward(logits, targets, arena);
        if (needsGrad) {
            tape.record({
                opName: 'cross_entropy',
                inputs: [logits],
                output,
                backward: (dOut, bwdArena) => {
                    const { dLogits } = CrossEntropyKernel.backward(dOut, ctx, bwdArena ?? arena);
                    return [dLogits];
                },
                cleanUp: () => {
                    ctx.probs = null;
                    ctx.targets = null;
                },
            });
        }
        return output;
    }
    /**
     * Negative Log-Likelihood Loss for Softmax probabilities:
     * L = -1/B sum log(probs[i, target[i]]).
     * Composes directly with `softmax()` to support `softmax -> cross_entropy` graphs.
     */
    static nllLoss(probs, targets, arena) {
        const tape = AutogradTape.getActiveTape();
        const needsGrad = probs.requiresGrad && AutogradTape.isRecording();
        if (probs.ndim !== 2) {
            throw new Error(`nllLoss requires 2D probabilities [Batch, Classes], got ${probs.ndim}D`);
        }
        const [B, C] = probs.shape;
        if (targets.length !== B) {
            throw new Error(`targets length (${targets.length}) !== batch dimension (${B})`);
        }
        const invB = 1.0 / B;
        let sumLoss = 0.0;
        const pData = probs.data;
        for (let i = 0; i < B; i++) {
            const targetClass = targets[i];
            if (targetClass < 0 || targetClass >= C) {
                throw new RangeError(`Target class ${targetClass} outside [0, ${C})`);
            }
            const p = pData[probs.offset + i * probs.strides[0] + targetClass * probs.strides[1]];
            sumLoss += -Math.log(Math.max(p, 1e-15));
        }
        const meanLoss = Math.fround(sumLoss * invB);
        const output = arena ? arena.allocateTensor([1]) : Tensor.zeros([1]);
        output.data[output.offset] = meanLoss;
        if (needsGrad) {
            tape.record({
                opName: 'nll_loss',
                inputs: [probs],
                output,
                backward: (dOut, bwdArena) => {
                    const dProbs = bwdArena ? bwdArena.allocateTensor([B, C]) : Tensor.zeros([B, C]);
                    const upstreamGrad = dOut.item() * invB;
                    const dpData = dProbs.data;
                    dProbs.data.fill(0, dProbs.offset, dProbs.offset + dProbs.size);
                    for (let i = 0; i < B; i++) {
                        const targetClass = targets[i];
                        const pIdx = probs.offset + i * probs.strides[0] + targetClass * probs.strides[1];
                        const dpIdx = dProbs.offset + i * dProbs.strides[0] + targetClass * dProbs.strides[1];
                        const p = Math.max(pData[pIdx], 1e-15);
                        dpData[dpIdx] = Math.fround(-upstreamGrad / p);
                    }
                    return [dProbs];
                },
                cleanUp: () => { },
            });
        }
        return output;
    }
}
