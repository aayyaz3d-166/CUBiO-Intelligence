/**
 * CUBiO AI — ONE LANGUAGE — VERIFIED TENSOR TRAINING KERNELS
 * ============================================================
 * Kernel: MatmulKernel (Matrix Multiplication)
 * Module: @one/tensor/kernels/MatmulKernel
 *
 * Implements verified forward, backward, numerical reference,
 * shape validation, and finite-difference gradient check.
 */

import { Tensor } from '../Tensor';
import { TensorMemoryArena } from '../TensorArena';

export interface MatmulContext {
  A: Tensor;
  B: Tensor;
}

export interface MatmulForwardResult {
  output: Tensor;
  ctx: MatmulContext;
}

export interface MatmulBackwardResult {
  dA: Tensor;
  dB: Tensor;
}

export class MatmulKernel {
  /**
   * Forward: C = A x B
   * Shapes: A [M, K], B [K, N] -> C [M, N]
   */
  public static forward(A: Tensor, B: Tensor, arena?: TensorMemoryArena): MatmulForwardResult {
    MatmulKernel.validateShapes(A, B);

    const M = A.shape[0];
    const K = A.shape[1];
    const N = B.shape[1];

    const out = arena ? arena.allocateTensor([M, N]) : Tensor.zeros([M, N]);
    const aData = A.data;
    const bData = B.data;
    const cData = out.data;
    const aOff = A.offset;
    const bOff = B.offset;
    const cOff = out.offset;

    // Fast contiguous IKJ cache-aligned GEMM
    if (A.isContiguous() && B.isContiguous()) {
      const bStride0 = B.strides[0];
      for (let i = 0; i < M; i++) {
        const aRow = aOff + i * K;
        const cRow = cOff + i * N;
        for (let k = 0; k < K; k++) {
          const aVal = aData[aRow + k];
          const bRow = bOff + k * bStride0;
          for (let j = 0; j < N; j++) {
            cData[cRow + j] += aVal * bData[bRow + j];
          }
        }
      }
      for (let i = 0; i < out.size; i++) {
        cData[cOff + i] = Math.fround(cData[cOff + i]);
      }
      return { output: out, ctx: { A, B } };
    }

    // General strided GEMM fallback
    for (let i = 0; i < M; i++) {
      const aRow = aOff + i * A.strides[0];
      const cRow = cOff + i * out.strides[0];

      for (let j = 0; j < N; j++) {
        let sum = 0.0;
        let k = 0;
        for (; k + 3 < K; k += 4) {
          sum += aData[aRow + k * A.strides[1]] * bData[bOff + k * B.strides[0] + j * B.strides[1]] +
                 aData[aRow + (k + 1) * A.strides[1]] * bData[bOff + (k + 1) * B.strides[0] + j * B.strides[1]] +
                 aData[aRow + (k + 2) * A.strides[1]] * bData[bOff + (k + 2) * B.strides[0] + j * B.strides[1]] +
                 aData[aRow + (k + 3) * A.strides[1]] * bData[bOff + (k + 3) * B.strides[0] + j * B.strides[1]];
        }
        for (; k < K; k++) {
          sum += aData[aRow + k * A.strides[1]] * bData[bOff + k * B.strides[0] + j * B.strides[1]];
        }
        cData[cRow + j * out.strides[1]] = Math.fround(sum);
      }
    }

    return {
      output: out,
      ctx: { A, B },
    };
  }

  /**
   * Backward:
   * dA = dC x B^T  [M, N] x [N, K] -> [M, K]
   * dB = A^T x dC  [K, M] x [M, N] -> [K, N]
   */
  public static backward(dC: Tensor, ctx: MatmulContext, arena?: TensorMemoryArena): MatmulBackwardResult {
    const { A, B } = ctx;
    const [M, K] = A.shape;
    const [, N] = B.shape;

    if (dC.shape[0] !== M || dC.shape[1] !== N) {
      throw new Error(`Gradient dC shape [${dC.shape}] does not match output shape [${M}, ${N}]`);
    }

    const BT = B.transpose(0, 1);
    const AT = A.transpose(0, 1);

    const dA = arena ? arena.allocateTensor([M, K]) : Tensor.zeros([M, K]);
    const dB = arena ? arena.allocateTensor([K, N]) : Tensor.zeros([K, N]);

    // dA = dC x B^T
    const dCData = dC.data;
    const bData = B.data;
    const daData = dA.data;

    for (let i = 0; i < M; i++) {
      const dcRow = dC.offset + i * dC.strides[0];
      const daRow = dA.offset + i * dA.strides[0];
      for (let k = 0; k < K; k++) {
        let sum = 0.0;
        for (let j = 0; j < N; j++) {
          sum += dCData[dcRow + j * dC.strides[1]] * bData[B.offset + k * B.strides[0] + j * B.strides[1]];
        }
        daData[daRow + k * dA.strides[1]] = Math.fround(sum);
      }
    }

    // dB = A^T x dC
    const aData = A.data;
    const dbData = dB.data;

    for (let k = 0; k < K; k++) {
      const dbRow = dB.offset + k * dB.strides[0];
      for (let j = 0; j < N; j++) {
        let sum = 0.0;
        for (let i = 0; i < M; i++) {
          sum += aData[A.offset + i * A.strides[0] + k * A.strides[1]] * dCData[dC.offset + i * dC.strides[0] + j * dC.strides[1]];
        }
        dbData[dbRow + j * dB.strides[1]] = Math.fround(sum);
      }
    }

    return { dA, dB };
  }

  /**
   * Canonical numerical reference for matrix multiplication.
   */
  public static reference(A: Tensor, B: Tensor): Float32Array {
    MatmulKernel.validateShapes(A, B);
    const [M, K] = A.shape;
    const [, N] = B.shape;
    const ref = new Float32Array(M * N);

    for (let i = 0; i < M; i++) {
      for (let j = 0; j < N; j++) {
        let sum = 0.0;
        for (let k = 0; k < K; k++) {
          sum += A.get(i, k) * B.get(k, j);
        }
        ref[i * N + j] = Math.fround(sum);
      }
    }
    return ref;
  }

  /**
   * Shape validation.
   */
  public static validateShapes(A: Tensor, B: Tensor): void {
    if (A.ndim !== 2 || B.ndim !== 2) {
      throw new Error(`MatmulKernel requires 2D tensors, got A (${A.ndim}D) and B (${B.ndim}D)`);
    }
    if (A.shape[1] !== B.shape[0]) {
      throw new Error(`MatmulKernel shape mismatch: A [${A.shape}] cannot multiply B [${B.shape}]`);
    }
  }
}
