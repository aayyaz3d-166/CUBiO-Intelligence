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
import { TensorMemoryArena } from '../TensorArena';
import { AutogradTape } from './AutogradTape';
import {
  MatmulKernel,
  AddKernel,
  MulKernel,
  TransposeKernel,
  SoftmaxKernel,
  LayerNormKernel,
  ReluKernel,
  ReduceKernel,
  CrossEntropyKernel,
} from '../kernels';

export class AutogradOps {
  /**
   * Matrix multiplication: C = A x B.
   */
  public static matmul(A: Tensor, B: Tensor, arena?: TensorMemoryArena): Tensor {
    const tape = AutogradTape.getActiveTape();
    const needsGrad = (A.requiresGrad || B.requiresGrad) && AutogradTape.isRecording();

    const { output, ctx } = MatmulKernel.forward(A, B, arena);

    if (needsGrad) {
      tape.record({
        opName: 'matmul',
        inputs: [A, B],
        output,
        backward: (dOut: Tensor, bwdArena?: TensorMemoryArena) => {
          const { dA, dB } = MatmulKernel.backward(dOut, ctx, bwdArena ?? arena);
          return [A.requiresGrad ? dA : null, B.requiresGrad ? dB : null];
        },
        cleanUp: () => {
          (ctx as any).A = null;
          (ctx as any).B = null;
        },
      });
    }

    return output;
  }

  /**
   * Elementwise addition & bias broadcasting: C = A + B.
   */
  public static add(A: Tensor, B: Tensor, arena?: TensorMemoryArena): Tensor {
    const tape = AutogradTape.getActiveTape();
    const needsGrad = (A.requiresGrad || B.requiresGrad) && AutogradTape.isRecording();

    const { output, ctx } = AddKernel.forward(A, B, arena);

    if (needsGrad) {
      tape.record({
        opName: 'add',
        inputs: [A, B],
        output,
        backward: (dOut: Tensor, bwdArena?: TensorMemoryArena) => {
          const { dA, dB } = AddKernel.backward(dOut, ctx, bwdArena ?? arena);
          return [A.requiresGrad ? dA : null, B.requiresGrad ? dB : null];
        },
        cleanUp: () => {},
      });
    }

    return output;
  }

  /**
   * Elementwise subtraction: C = A - B.
   */
  public static sub(A: Tensor, B: Tensor, arena?: TensorMemoryArena): Tensor {
    const tape = AutogradTape.getActiveTape();
    const needsGrad = (A.requiresGrad || B.requiresGrad) && AutogradTape.isRecording();

    const output = arena ? arena.allocateTensor(A.shape) : Tensor.zeros(A.shape);
    A.sub(B, output, arena);

    if (needsGrad) {
      tape.record({
        opName: 'sub',
        inputs: [A, B],
        output,
        backward: (dOut: Tensor, bwdArena?: TensorMemoryArena) => {
          let dA: Tensor | null = null;
          let dB: Tensor | null = null;

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
        cleanUp: () => {},
      });
    }

    return output;
  }

  /**
   * Elementwise multiplication: C = A * B.
   */
  public static mul(A: Tensor, B: Tensor, arena?: TensorMemoryArena): Tensor {
    const tape = AutogradTape.getActiveTape();
    const needsGrad = (A.requiresGrad || B.requiresGrad) && AutogradTape.isRecording();

    const { output, ctx } = MulKernel.forward(A, B, arena);

    if (needsGrad) {
      tape.record({
        opName: 'mul',
        inputs: [A, B],
        output,
        backward: (dOut: Tensor, bwdArena?: TensorMemoryArena) => {
          const { dA, dB } = MulKernel.backward(dOut, ctx, bwdArena ?? arena);
          return [A.requiresGrad ? dA : null, B.requiresGrad ? dB : null];
        },
        cleanUp: () => {
          (ctx as any).A = null;
          (ctx as any).B = null;
        },
      });
    }

    return output;
  }

  /**
   * Transpose tensor axes: B = transpose(A, dim0, dim1).
   */
  public static transpose(
    A: Tensor,
    dim0: number = 0,
    dim1: number = 1,
    arena?: TensorMemoryArena
  ): Tensor {
    const tape = AutogradTape.getActiveTape();
    const needsGrad = A.requiresGrad && AutogradTape.isRecording();

    const { output, ctx } = TransposeKernel.forward(A, dim0, dim1, arena);

    if (needsGrad) {
      tape.record({
        opName: 'transpose',
        inputs: [A],
        output,
        backward: (dOut: Tensor, bwdArena?: TensorMemoryArena) => {
          const { dA } = TransposeKernel.backward(dOut, ctx, bwdArena ?? arena);
          return [dA];
        },
        cleanUp: () => {},
      });
    }

    return output;
  }

  /**
   * Numerically stable Softmax: S = softmax(X, axis).
   */
  public static softmax(X: Tensor, axis: number = -1, arena?: TensorMemoryArena): Tensor {
    const tape = AutogradTape.getActiveTape();
    const needsGrad = X.requiresGrad && AutogradTape.isRecording();

    const { output, ctx } = SoftmaxKernel.forward(X, axis, arena);

    if (needsGrad) {
      tape.record({
        opName: 'softmax',
        inputs: [X],
        output,
        backward: (dOut: Tensor, bwdArena?: TensorMemoryArena) => {
          const { dX } = SoftmaxKernel.backward(dOut, ctx, bwdArena ?? arena);
          return [dX];
        },
        cleanUp: () => {
          (ctx as any).probs = null;
        },
      });
    }

    return output;
  }

  /**
   * Layer Normalization: Y = LN(X, gamma, beta).
   */
  public static layerNorm(
    X: Tensor,
    gamma: Tensor,
    beta: Tensor,
    eps: number = 1e-5,
    arena?: TensorMemoryArena
  ): Tensor {
    const tape = AutogradTape.getActiveTape();
    const needsGrad = (X.requiresGrad || gamma.requiresGrad || beta.requiresGrad) && AutogradTape.isRecording();

    const { output, ctx } = LayerNormKernel.forward(X, gamma, beta, eps, arena);

    if (needsGrad) {
      tape.record({
        opName: 'layernorm',
        inputs: [X, gamma, beta],
        output,
        backward: (dOut: Tensor, bwdArena?: TensorMemoryArena) => {
          const { dX, dGamma, dBeta } = LayerNormKernel.backward(dOut, ctx, bwdArena ?? arena);
          return [
            X.requiresGrad ? dX : null,
            gamma.requiresGrad ? dGamma : null,
            beta.requiresGrad ? dBeta : null,
          ];
        },
        cleanUp: () => {
          (ctx as any).XHat = null;
          (ctx as any).invStd = null;
          (ctx as any).gamma = null;
          (ctx as any).beta = null;
        },
      });
    }

    return output;
  }

  /**
   * Rectified Linear Unit activation: Y = max(0, X).
   */
  public static relu(X: Tensor, arena?: TensorMemoryArena): Tensor {
    const tape = AutogradTape.getActiveTape();
    const needsGrad = X.requiresGrad && AutogradTape.isRecording();

    const { output, ctx } = ReluKernel.forward(X, arena);

    if (needsGrad) {
      tape.record({
        opName: 'relu',
        inputs: [X],
        output,
        backward: (dOut: Tensor, bwdArena?: TensorMemoryArena) => {
          const { dX } = ReluKernel.backward(dOut, ctx, bwdArena ?? arena);
          return [dX];
        },
        cleanUp: () => {
          (ctx as any).X = null;
        },
      });
    }

    return output;
  }

  /**
   * Fast Gaussian Error Linear Unit activation: Y = GELU(X).
   */
  public static gelu(X: Tensor, arena?: TensorMemoryArena): Tensor {
    const tape = AutogradTape.getActiveTape();
    const needsGrad = X.requiresGrad && AutogradTape.isRecording();

    const output = arena ? arena.allocateTensor(X.shape) : Tensor.zeros(X.shape);
    X.gelu(output, arena);

    if (needsGrad) {
      tape.record({
        opName: 'gelu',
        inputs: [X],
        output,
        backward: (dOut: Tensor, bwdArena?: TensorMemoryArena) => {
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
        cleanUp: () => {},
      });
    }

    return output;
  }

  /**
   * Sum reduction: Y = sum(X, axis, keepdim).
   */
  public static reduceSum(
    X: Tensor,
    axis?: number,
    keepdim: boolean = false,
    arena?: TensorMemoryArena
  ): Tensor {
    const tape = AutogradTape.getActiveTape();
    const needsGrad = X.requiresGrad && AutogradTape.isRecording();

    const { output, ctx } = ReduceKernel.forward(X, 'sum', axis, keepdim, arena);

    if (needsGrad) {
      tape.record({
        opName: 'reduce_sum',
        inputs: [X],
        output,
        backward: (dOut: Tensor, bwdArena?: TensorMemoryArena) => {
          const { dX } = ReduceKernel.backward(dOut, ctx, bwdArena ?? arena);
          return [dX];
        },
        cleanUp: () => {},
      });
    }

    return output;
  }

  /**
   * Mean reduction: Y = mean(X, axis, keepdim).
   */
  public static reduceMean(
    X: Tensor,
    axis?: number,
    keepdim: boolean = false,
    arena?: TensorMemoryArena
  ): Tensor {
    const tape = AutogradTape.getActiveTape();
    const needsGrad = X.requiresGrad && AutogradTape.isRecording();

    const { output, ctx } = ReduceKernel.forward(X, 'mean', axis, keepdim, arena);

    if (needsGrad) {
      tape.record({
        opName: 'reduce_mean',
        inputs: [X],
        output,
        backward: (dOut: Tensor, bwdArena?: TensorMemoryArena) => {
          const { dX } = ReduceKernel.backward(dOut, ctx, bwdArena ?? arena);
          return [dX];
        },
        cleanUp: () => {},
      });
    }

    return output;
  }

  /**
   * Fused Softmax + Cross-Entropy Loss: L = CrossEntropy(logits, targets).
   */
  public static crossEntropy(
    logits: Tensor,
    targets: number[] | Int32Array,
    arena?: TensorMemoryArena
  ): Tensor {
    const tape = AutogradTape.getActiveTape();
    const needsGrad = logits.requiresGrad && AutogradTape.isRecording();

    const { output, ctx } = CrossEntropyKernel.forward(logits, targets, arena);

    if (needsGrad) {
      tape.record({
        opName: 'cross_entropy',
        inputs: [logits],
        output,
        backward: (dOut: Tensor, bwdArena?: TensorMemoryArena) => {
          const { dLogits } = CrossEntropyKernel.backward(dOut, ctx, bwdArena ?? arena);
          return [dLogits];
        },
        cleanUp: () => {
          (ctx as any).probs = null;
          (ctx as any).targets = null;
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
  public static nllLoss(
    probs: Tensor,
    targets: number[] | Int32Array,
    arena?: TensorMemoryArena
  ): Tensor {
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
        backward: (dOut: Tensor, bwdArena?: TensorMemoryArena) => {
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
        cleanUp: () => {},
      });
    }

    return output;
  }
}
