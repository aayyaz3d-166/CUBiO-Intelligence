/**
 * CUBiO AI — ONE LANGUAGE — VERIFIED TENSOR TRAINING KERNELS
 * ============================================================
 * Kernel: MulKernel (Elementwise Multiplication)
 * Module: @one/tensor/kernels/MulKernel
 */

import { Tensor } from '../Tensor';
import { TensorMemoryArena } from '../TensorArena';

export interface MulContext {
  A: Tensor;
  B: Tensor;
}

export interface MulForwardResult {
  output: Tensor;
  ctx: MulContext;
}

export interface MulBackwardResult {
  dA: Tensor;
  dB: Tensor;
}

export class MulKernel {
  /**
   * Forward: C = A * B (elementwise)
   */
  public static forward(A: Tensor, B: Tensor, arena?: TensorMemoryArena): MulForwardResult {
    MulKernel.validateShapes(A, B);

    const out = arena ? arena.allocateTensor(A.shape) : Tensor.zeros(A.shape);
    const aData = A.data;
    const bData = B.data;
    const cData = out.data;

    for (let i = 0; i < A.size; i++) {
      cData[out.offset + i] = Math.fround(aData[A.offset + i] * bData[B.offset + i]);
    }

    return {
      output: out,
      ctx: { A, B },
    };
  }

  /**
   * Backward:
   * dA = dC * B
   * dB = dC * A
   */
  public static backward(dC: Tensor, ctx: MulContext, arena?: TensorMemoryArena): MulBackwardResult {
    const { A, B } = ctx;
    const dA = arena ? arena.allocateTensor(A.shape) : Tensor.zeros(A.shape);
    const dB = arena ? arena.allocateTensor(B.shape) : Tensor.zeros(B.shape);

    const dcData = dC.data;
    const aData = A.data;
    const bData = B.data;
    const daData = dA.data;
    const dbData = dB.data;

    for (let i = 0; i < A.size; i++) {
      const g = dcData[dC.offset + i];
      daData[dA.offset + i] = Math.fround(g * bData[B.offset + i]);
      dbData[dB.offset + i] = Math.fround(g * aData[A.offset + i]);
    }

    return { dA, dB };
  }

  /**
   * Canonical numerical reference.
   */
  public static reference(A: Tensor, B: Tensor): Float32Array {
    MulKernel.validateShapes(A, B);
    const ref = new Float32Array(A.size);
    for (let i = 0; i < A.size; i++) {
      ref[i] = Math.fround(A.data[A.offset + i] * B.data[B.offset + i]);
    }
    return ref;
  }

  /**
   * Shape validation.
   */
  public static validateShapes(A: Tensor, B: Tensor): void {
    if (A.ndim !== B.ndim || !A.shape.every((dim, idx) => dim === B.shape[idx])) {
      throw new Error(`MulKernel requires matching tensor shapes, got A [${A.shape}] and B [${B.shape}]`);
    }
  }
}
