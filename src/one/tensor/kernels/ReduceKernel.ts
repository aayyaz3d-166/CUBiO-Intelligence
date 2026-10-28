/**
 * CUBiO AI — ONE LANGUAGE — VERIFIED TENSOR TRAINING KERNELS
 * ============================================================
 * Kernel: ReduceKernel (Sum and Mean Reductions & Adjoint Broadcast)
 * Module: @one/tensor/kernels/ReduceKernel
 */

import { Tensor } from '../Tensor';
import { TensorMemoryArena } from '../TensorArena';

export type ReduceOp = 'sum' | 'mean';

export interface ReduceContext {
  op: ReduceOp;
  origShape: number[];
  axis?: number;
  keepdim: boolean;
  reducedElements: number;
}

export interface ReduceForwardResult {
  output: Tensor;
  ctx: ReduceContext;
}

export interface ReduceBackwardResult {
  dX: Tensor;
}

export class ReduceKernel {
  /**
   * Forward: Sum or Mean reduction over all elements or along a specific axis.
   */
  public static forward(
    X: Tensor,
    op: ReduceOp = 'sum',
    axis?: number,
    keepdim: boolean = false,
    arena?: TensorMemoryArena
  ): ReduceForwardResult {
    if (axis !== undefined && (axis < 0 || axis >= X.ndim)) {
      throw new RangeError(`Reduce axis ${axis} is out of bounds for ndim ${X.ndim}`);
    }

    if (axis === undefined) {
      // Full tensor reduction to scalar
      let total = 0.0;
      const xData = X.data;
      const xOff = X.offset;
      for (let i = 0; i < X.size; i++) {
        total += xData[xOff + i];
      }
      if (op === 'mean') total /= Math.max(1, X.size);

      const outShape = keepdim ? new Array(X.ndim).fill(1) : [1];
      const out = arena ? arena.allocateTensor(outShape) : Tensor.zeros(outShape);
      out.data[out.offset] = Math.fround(total);

      return {
        output: out,
        ctx: {
          op,
          origShape: [...X.shape],
          axis: undefined,
          keepdim,
          reducedElements: X.size,
        },
      };
    }

    // Reduction along a single axis
    const resolvedAxis = axis;
    const dimSize = X.shape[resolvedAxis];
    const outShape: number[] = [];
    for (let i = 0; i < X.ndim; i++) {
      if (i === resolvedAxis) {
        if (keepdim) outShape.push(1);
      } else {
        outShape.push(X.shape[i]);
      }
    }

    const out = arena ? arena.allocateTensor(outShape) : Tensor.zeros(outShape);
    out.data.fill(0, out.offset, out.offset + out.size);

    const it = X.elementIterator();
    const coords = new Array<number>(X.ndim).fill(0);

    for (const val of it) {
      const outCoords: number[] = [];
      for (let i = 0; i < X.ndim; i++) {
        if (i === resolvedAxis) {
          if (keepdim) outCoords.push(0);
        } else {
          outCoords.push(coords[i]);
        }
      }
      const off = out.indexToOffset(...outCoords);
      out.data[off] += val;

      for (let d = X.ndim - 1; d >= 0; d--) {
        coords[d]++;
        if (coords[d] < X.shape[d]) break;
        coords[d] = 0;
      }
    }

    // If mean, divide by dimSize
    const factor = op === 'mean' ? 1.0 / dimSize : 1.0;
    for (let i = 0; i < out.size; i++) {
      out.data[out.offset + i] = Math.fround(out.data[out.offset + i] * factor);
    }

    return {
      output: out,
      ctx: {
        op,
        origShape: [...X.shape],
        axis: resolvedAxis,
        keepdim,
        reducedElements: dimSize,
      },
    };
  }

  /**
   * Backward: Broadcasts upstream gradient back to original shape.
   */
  public static backward(dOut: Tensor, ctx: ReduceContext, arena?: TensorMemoryArena): ReduceBackwardResult {
    const { op, origShape, axis, keepdim, reducedElements } = ctx;
    const dX = arena ? arena.allocateTensor(origShape) : Tensor.zeros(origShape);
    const scale = op === 'mean' ? 1.0 / reducedElements : 1.0;

    if (axis === undefined) {
      // Broadcast scalar gradient to all elements
      const scalarGrad = dOut.item() * scale;
      dX.data.fill(Math.fround(scalarGrad), dX.offset, dX.offset + dX.size);
      return { dX };
    }

    // Broadcast across reduced axis
    const coords = new Array<number>(origShape.length).fill(0);
    for (let i = 0; i < dX.size; i++) {
      const outCoords: number[] = [];
      for (let d = 0; d < origShape.length; d++) {
        if (d === axis) {
          if (keepdim) outCoords.push(0);
        } else {
          outCoords.push(coords[d]);
        }
      }
      const g = dOut.get(...outCoords) * scale;
      dX.set(Math.fround(g), ...coords);

      for (let d = origShape.length - 1; d >= 0; d--) {
        coords[d]++;
        if (coords[d] < origShape[d]) break;
        coords[d] = 0;
      }
    }

    return { dX };
  }

  /**
   * Canonical numerical reference.
   */
  public static reference(X: Tensor, op: ReduceOp = 'sum'): number {
    let total = 0.0;
    for (let i = 0; i < X.size; i++) {
      total += X.data[X.offset + i];
    }
    return op === 'mean' ? total / X.size : total;
  }
}
