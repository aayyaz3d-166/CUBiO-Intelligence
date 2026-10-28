/**
 * CUBiO AI — ONE LANGUAGE — NUMERIC TENSOR ENGINE
 * ================================================
 * Module: @one/tensor/Tensor
 * Gate: ONE-02 / Numeric Foundation for Training
 *
 * Implements an authoritative, high-performance n-dimensional Tensor backed
 * exclusively by Float32Array with explicit shape, strides, multi-dimensional
 * indexing, zero-copy views/reshapes, and core math operations.
 */

import { TensorMemoryArena } from './TensorArena';
import { AutogradBridge } from './AutogradBridge';

export type TensorShape = readonly number[];
export type TensorStrides = readonly number[];

export class Tensor {
  public readonly data: Float32Array;
  public readonly offset: number; // Element offset into underlying Float32Array buffer
  public readonly shape: number[];
  public readonly strides: number[];
  public readonly size: number;
  public readonly ndim: number;
  public requiresGrad: boolean = false;
  public grad: Tensor | null = null;
  public gradFn: any | null = null;

  constructor(
    data: Float32Array,
    shape: number[],
    strides?: number[],
    offset: number = 0
  ) {
    this.data = data;
    this.offset = offset;
    this.shape = [...shape];
    this.ndim = this.shape.length;

    // Compute size = product of shape
    let s = 1;
    for (let i = 0; i < this.ndim; i++) {
      if (this.shape[i] < 0) {
        throw new Error(`Invalid tensor dimension at axis ${i}: ${this.shape[i]} < 0`);
      }
      s *= this.shape[i];
    }
    this.size = s;

    // Compute standard C-contiguous (row-major) strides if not provided
    if (strides) {
      if (strides.length !== this.ndim) {
        throw new Error(`Strides length (${strides.length}) must match ndim (${this.ndim})`);
      }
      this.strides = [...strides];
    } else {
      this.strides = Tensor.computeRowMajorStrides(this.shape);
    }

    // Verify buffer capacity
    const maxOffset = this.size > 0 ? this.computeMaxOffset() : this.offset;
    if (maxOffset > this.data.length) {
      throw new Error(
        `Buffer overflow: required elements up to index ${maxOffset}, but buffer length is ${this.data.length}`
      );
    }
  }

  /**
   * Computes standard row-major (C-contiguous) strides for a given shape.
   */
  public static computeRowMajorStrides(shape: number[]): number[] {
    const ndim = shape.length;
    if (ndim === 0) return [];
    const strides = new Array<number>(ndim);
    let stride = 1;
    for (let i = ndim - 1; i >= 0; i--) {
      strides[i] = stride;
      stride *= Math.max(1, shape[i]);
    }
    return strides;
  }

  /**
   * Check if the tensor has a contiguous row-major memory layout.
   */
  public isContiguous(): boolean {
    const expectedStrides = Tensor.computeRowMajorStrides(this.shape);
    for (let i = 0; i < this.ndim; i++) {
      if (this.strides[i] !== expectedStrides[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Computes the maximum flat offset accessed by this tensor's shape and strides.
   */
  private computeMaxOffset(): number {
    let maxOff = this.offset;
    for (let i = 0; i < this.ndim; i++) {
      if (this.shape[i] > 0) {
        maxOff += (this.shape[i] - 1) * this.strides[i];
      }
    }
    return maxOff + 1;
  }

  /**
   * Convert n-dimensional coordinates to flat buffer index.
   */
  public indexToOffset(...indices: number[]): number {
    if (indices.length !== this.ndim) {
      throw new Error(
        `Incorrect number of indices: expected ${this.ndim}, got ${indices.length}`
      );
    }
    let flatIdx = this.offset;
    for (let i = 0; i < this.ndim; i++) {
      let idx = indices[i];
      const dim = this.shape[i];
      // Support Python-style negative indices
      if (idx < 0) idx += dim;
      if (idx < 0 || idx >= dim) {
        throw new RangeError(
          `Index out of bounds at axis ${i}: index ${indices[i]} is outside [0, ${dim})`
        );
      }
      flatIdx += idx * this.strides[i];
    }
    return flatIdx;
  }

  /**
   * Read single scalar element at given coordinates.
   */
  public get(...indices: number[]): number {
    return this.data[this.indexToOffset(...indices)];
  }

  /**
   * Write single scalar element at given coordinates.
   */
  public set(value: number, ...indices: number[]): void {
    this.data[this.indexToOffset(...indices)] = Math.fround(value);
  }

  /**
   * Extract scalar value (valid for 0D or 1-element tensors).
   */
  public item(): number {
    if (this.size !== 1) {
      throw new Error(`Tensor.item() requires size === 1, got size === ${this.size}`);
    }
    return this.data[this.offset];
  }

  /**
   * Return a zero-copy view of this tensor with a new shape if contiguous.
   * Supports -1 for one inferred dimension.
   */
  public view(...newShape: number[]): Tensor {
    if (!this.isContiguous()) {
      throw new Error('Tensor.view() is only valid for contiguous tensors; call .contiguous() first');
    }

    const resolvedShape = [...newShape];
    let inferAxis = -1;
    let knownProduct = 1;

    for (let i = 0; i < resolvedShape.length; i++) {
      if (resolvedShape[i] === -1) {
        if (inferAxis !== -1) {
          throw new Error('Only one dimension can be inferred (-1) in Tensor.view');
        }
        inferAxis = i;
      } else if (resolvedShape[i] <= 0) {
        throw new Error(`Invalid dimension size ${resolvedShape[i]} at axis ${i}`);
      } else {
        knownProduct *= resolvedShape[i];
      }
    }

    if (inferAxis !== -1) {
      if (this.size % knownProduct !== 0) {
        throw new Error(
          `Cannot infer dimension: tensor size ${this.size} is not divisible by ${knownProduct}`
        );
      }
      resolvedShape[inferAxis] = this.size / knownProduct;
    } else {
      if (knownProduct !== this.size) {
        throw new Error(
          `New shape [${resolvedShape.join(', ')}] with size ${knownProduct} does not match tensor size ${this.size}`
        );
      }
    }

    return new Tensor(this.data, resolvedShape, undefined, this.offset);
  }

  /**
   * Reshapes the tensor to a new shape. Returns zero-copy view if contiguous,
   * or a contiguous copy if non-contiguous.
   */
  public reshape(...newShape: number[]): Tensor {
    if (this.isContiguous()) {
      return this.view(...newShape);
    }
    return this.contiguous().view(...newShape);
  }

  /**
   * Returns a contiguous copy of this tensor in memory.
   */
  public contiguous(arena?: TensorMemoryArena): Tensor {
    if (this.isContiguous()) return this;
    const result = arena ? arena.allocateTensor(this.shape) : Tensor.zeros(this.shape);
    const it = this.elementIterator();
    let idx = 0;
    for (const val of it) {
      result.data[result.offset + idx++] = val;
    }
    return result;
  }

  /**
   * Generator iterating over all elements in logical coordinate order.
   */
  public *elementIterator(): Generator<number> {
    const coords = new Array<number>(this.ndim).fill(0);
    for (let i = 0; i < this.size; i++) {
      yield this.get(...coords);
      // Advance coordinates (odometer)
      for (let d = this.ndim - 1; d >= 0; d--) {
        coords[d]++;
        if (coords[d] < this.shape[d]) break;
        coords[d] = 0;
      }
    }
  }

  /**
   * Slices the tensor along a specified dimension (zero-copy view).
   */
  public slice(axis: number, start: number, end?: number): Tensor {
    if (axis < 0 || axis >= this.ndim) {
      throw new RangeError(`Axis ${axis} out of range [0, ${this.ndim})`);
    }
    const dim = this.shape[axis];
    let s = start < 0 ? start + dim : start;
    let e = end === undefined ? dim : (end < 0 ? end + dim : end);
    s = Math.max(0, Math.min(dim, s));
    e = Math.max(s, Math.min(dim, e));

    const newLength = e - s;
    const newShape = [...this.shape];
    newShape[axis] = newLength;

    const newOffset = this.offset + s * this.strides[axis];
    return new Tensor(this.data, newShape, this.strides, newOffset);
  }

  /**
   * Swaps two axes (zero-copy view).
   */
  public transpose(axis0: number, axis1: number): Tensor {
    if (axis0 < 0 || axis0 >= this.ndim || axis1 < 0 || axis1 >= this.ndim) {
      throw new RangeError(`Axes [${axis0}, ${axis1}] out of range for ndim ${this.ndim}`);
    }
    if (axis0 === axis1) return this;

    const newShape = [...this.shape];
    const newStrides = [...this.strides];

    const tmpShape = newShape[axis0];
    newShape[axis0] = newShape[axis1];
    newShape[axis1] = tmpShape;

    const tmpStride = newStrides[axis0];
    newStrides[axis0] = newStrides[axis1];
    newStrides[axis1] = tmpStride;

    return new Tensor(this.data, newShape, newStrides, this.offset);
  }

  /**
   * Fills all elements in this tensor with the given scalar value.
   */
  public fill(value: number): this {
    const val = Math.fround(value);
    if (this.isContiguous()) {
      this.data.fill(val, this.offset, this.offset + this.size);
    } else {
      const coords = new Array<number>(this.ndim).fill(0);
      for (let i = 0; i < this.size; i++) {
        this.set(val, ...coords);
        for (let d = this.ndim - 1; d >= 0; d--) {
          coords[d]++;
          if (coords[d] < this.shape[d]) break;
          coords[d] = 0;
        }
      }
    }
    return this;
  }

  /**
   * Clones this tensor into a fresh buffer or allocated arena slice.
   */
  public clone(arena?: TensorMemoryArena): Tensor {
    const out = arena ? arena.allocateTensor(this.shape) : Tensor.zeros(this.shape);
    if (this.isContiguous()) {
      out.data.set(
        this.data.subarray(this.offset, this.offset + this.size),
        out.offset
      );
    } else {
      const it = this.elementIterator();
      let i = 0;
      for (const val of it) {
        out.data[out.offset + i++] = val;
      }
    }
    return out;
  }

  /**
   * Copies data from another tensor into this tensor.
   */
  public copyFrom(other: Tensor): void {
    if (this.size !== other.size) {
      throw new Error(`Size mismatch in copyFrom: ${this.size} !== ${other.size}`);
    }
    if (this.isContiguous() && other.isContiguous()) {
      this.data.set(
        other.data.subarray(other.offset, other.offset + other.size),
        this.offset
      );
    } else {
      const it = other.elementIterator();
      let i = 0;
      for (const val of it) {
        this.data[this.offset + i++] = val;
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MATH & OPERATOR PRIMITIVES (Float32Array Accelerated)
  // ───────────────────────────────────────────────────────────────────────────

  public add(other: Tensor | number, out?: Tensor, arena?: TensorMemoryArena): Tensor {
    if (out === undefined && other instanceof Tensor && (this.requiresGrad || other.requiresGrad)) {
      if (AutogradBridge.isRecording()) {
        const provider = AutogradBridge.getProvider();
        if (provider) return provider.add(this, other, arena);
      }
    }
    const res = out ?? (arena ? arena.allocateTensor(this.shape) : Tensor.zeros(this.shape));
    if (typeof other === 'number') {
      const val = Math.fround(other);
      for (let i = 0; i < this.size; i++) {
        res.data[res.offset + i] = Math.fround(this.data[this.offset + i] + val);
      }
    } else {
      if (this.size !== other.size) throw new Error(`Size mismatch: ${this.size} !== ${other.size}`);
      for (let i = 0; i < this.size; i++) {
        res.data[res.offset + i] = Math.fround(this.data[this.offset + i] + other.data[other.offset + i]);
      }
    }
    return res;
  }

  public sub(other: Tensor | number, out?: Tensor, arena?: TensorMemoryArena): Tensor {
    if (out === undefined && other instanceof Tensor && (this.requiresGrad || other.requiresGrad)) {
      if (AutogradBridge.isRecording()) {
        const provider = AutogradBridge.getProvider();
        if (provider) return provider.sub(this, other, arena);
      }
    }
    const res = out ?? (arena ? arena.allocateTensor(this.shape) : Tensor.zeros(this.shape));
    if (typeof other === 'number') {
      const val = Math.fround(other);
      for (let i = 0; i < this.size; i++) {
        res.data[res.offset + i] = Math.fround(this.data[this.offset + i] - val);
      }
    } else {
      if (this.size !== other.size) throw new Error(`Size mismatch: ${this.size} !== ${other.size}`);
      for (let i = 0; i < this.size; i++) {
        res.data[res.offset + i] = Math.fround(this.data[this.offset + i] - other.data[other.offset + i]);
      }
    }
    return res;
  }

  public mul(other: Tensor | number, out?: Tensor, arena?: TensorMemoryArena): Tensor {
    if (out === undefined && other instanceof Tensor && (this.requiresGrad || other.requiresGrad)) {
      if (AutogradBridge.isRecording()) {
        const provider = AutogradBridge.getProvider();
        if (provider) return provider.mul(this, other, arena);
      }
    }
    const res = out ?? (arena ? arena.allocateTensor(this.shape) : Tensor.zeros(this.shape));
    if (typeof other === 'number') {
      const val = Math.fround(other);
      for (let i = 0; i < this.size; i++) {
        res.data[res.offset + i] = Math.fround(this.data[this.offset + i] * val);
      }
    } else {
      if (this.size !== other.size) throw new Error(`Size mismatch: ${this.size} !== ${other.size}`);
      for (let i = 0; i < this.size; i++) {
        res.data[res.offset + i] = Math.fround(this.data[this.offset + i] * other.data[other.offset + i]);
      }
    }
    return res;
  }

  public div(other: Tensor | number, out?: Tensor, arena?: TensorMemoryArena): Tensor {
    const res = out ?? (arena ? arena.allocateTensor(this.shape) : Tensor.zeros(this.shape));
    if (typeof other === 'number') {
      if (other === 0) throw new Error('Division by zero in Tensor.div');
      const inv = Math.fround(1.0 / other);
      for (let i = 0; i < this.size; i++) {
        res.data[res.offset + i] = Math.fround(this.data[this.offset + i] * inv);
      }
    } else {
      if (this.size !== other.size) throw new Error(`Size mismatch: ${this.size} !== ${other.size}`);
      for (let i = 0; i < this.size; i++) {
        const denom = other.data[other.offset + i];
        if (denom === 0) throw new Error('Division by zero in Tensor.div');
        res.data[res.offset + i] = Math.fround(this.data[this.offset + i] / denom);
      }
    }
    return res;
  }

  /**
   * 2D Matrix multiplication: [M, K] x [K, N] -> [M, N].
   */
  public matmul(other: Tensor, out?: Tensor, arena?: TensorMemoryArena): Tensor {
    if (out === undefined && (this.requiresGrad || other.requiresGrad)) {
      if (AutogradBridge.isRecording()) {
        const provider = AutogradBridge.getProvider();
        if (provider) return provider.matmul(this, other, arena);
      }
    }
    if (this.ndim !== 2 || other.ndim !== 2) {
      throw new Error(`Matmul currently requires 2D tensors, got [${this.shape}] and [${other.shape}]`);
    }
    const [M, K1] = this.shape;
    const [K2, N] = other.shape;
    if (K1 !== K2) {
      throw new Error(`Incompatible matrix dimensions: [${M}, ${K1}] x [${K2}, ${N}]`);
    }

    const res = out ?? (arena ? arena.allocateTensor([M, N]) : Tensor.zeros([M, N]));
    const A = this.data;
    const B = other.data;
    const C = res.data;
    const aOff = this.offset;
    const bOff = other.offset;
    const cOff = res.offset;

    // Cache-aligned contiguous GEMM with 4x unrolling
    for (let i = 0; i < M; i++) {
      const aRow = aOff + i * K1;
      const cRow = cOff + i * N;

      for (let j = 0; j < N; j++) {
        let sum = 0.0;
        let k = 0;
        for (; k + 3 < K1; k += 4) {
          sum += A[aRow + k]     * B[bOff + k * N + j] +
                 A[aRow + k + 1] * B[bOff + (k + 1) * N + j] +
                 A[aRow + k + 2] * B[bOff + (k + 2) * N + j] +
                 A[aRow + k + 3] * B[bOff + (k + 3) * N + j];
        }
        for (; k < K1; k++) {
          sum += A[aRow + k] * B[bOff + k * N + j];
        }
        C[cRow + j] = Math.fround(sum);
      }
    }
    return res;
  }

  /**
   * Sum reduction over all elements or along a dimension.
   */
  public sum(axis?: number, keepdim: boolean = false, arena?: TensorMemoryArena): Tensor {
    if (this.requiresGrad && AutogradBridge.isRecording()) {
      const provider = AutogradBridge.getProvider();
      if (provider) return provider.reduceSum(this, axis, keepdim, arena);
    }
    if (axis === undefined) {
      let total = 0.0;
      for (let i = 0; i < this.size; i++) {
        total += this.data[this.offset + i];
      }
      const res = arena ? arena.allocateTensor([1]) : Tensor.zeros([1]);
      res.data[res.offset] = Math.fround(total);
      return res;
    }

    if (axis < 0 || axis >= this.ndim) {
      throw new RangeError(`Axis ${axis} out of range [0, ${this.ndim})`);
    }

    const outShape: number[] = [];
    for (let i = 0; i < this.ndim; i++) {
      if (i === axis) {
        if (keepdim) outShape.push(1);
      } else {
        outShape.push(this.shape[i]);
      }
    }

    const res = arena ? arena.allocateTensor(outShape) : Tensor.zeros(outShape);
    res.data.fill(0, res.offset, res.offset + res.size);

    const dimSize = this.shape[axis];
    const stride = this.strides[axis];

    // Accumulate along axis
    const it = this.elementIterator();
    const coords = new Array<number>(this.ndim).fill(0);

    for (const val of it) {
      const outCoords: number[] = [];
      for (let i = 0; i < this.ndim; i++) {
        if (i === axis) {
          if (keepdim) outCoords.push(0);
        } else {
          outCoords.push(coords[i]);
        }
      }
      const off = res.indexToOffset(...outCoords);
      res.data[off] = Math.fround(res.data[off] + val);

      for (let d = this.ndim - 1; d >= 0; d--) {
        coords[d]++;
        if (coords[d] < this.shape[d]) break;
        coords[d] = 0;
      }
    }

    return res;
  }

  /**
   * Mean reduction over all elements or along a dimension.
   */
  public mean(axis?: number, keepdim: boolean = false, arena?: TensorMemoryArena): Tensor {
    if (this.requiresGrad && AutogradBridge.isRecording()) {
      const provider = AutogradBridge.getProvider();
      if (provider) return provider.reduceMean(this, axis, keepdim, arena);
    }
    const s = this.sum(axis, keepdim, arena);
    const count = axis === undefined ? this.size : this.shape[axis < 0 ? axis + this.ndim : axis];
    const invCount = Math.fround(1.0 / count);
    for (let i = 0; i < s.size; i++) {
      s.data[s.offset + i] = Math.fround(s.data[s.offset + i] * invCount);
    }
    return s;
  }

  /**
   * Fast approximate GELU activation: 0.5 * x * (1 + tanh(sqrt(2/pi) * (x + 0.044715 * x^3))).
   */
  public gelu(out?: Tensor, arena?: TensorMemoryArena): Tensor {
    if (out === undefined && this.requiresGrad && AutogradBridge.isRecording()) {
      const provider = AutogradBridge.getProvider();
      if (provider) return provider.gelu(this, arena);
    }
    const res = out ?? (arena ? arena.allocateTensor(this.shape) : Tensor.zeros(this.shape));
    const c1 = 0.7978845608; // sqrt(2/pi)
    const c2 = 0.044715;

    for (let i = 0; i < this.size; i++) {
      const x = this.data[this.offset + i];
      const g = 0.5 * x * (1.0 + Math.tanh(c1 * (x + c2 * x * x * x)));
      res.data[res.offset + i] = Math.fround(g);
    }
    return res;
  }

  /**
   * Hyperbolic tangent activation.
   */
  public tanh(out?: Tensor, arena?: TensorMemoryArena): Tensor {
    const res = out ?? (arena ? arena.allocateTensor(this.shape) : Tensor.zeros(this.shape));
    for (let i = 0; i < this.size; i++) {
      res.data[res.offset + i] = Math.fround(Math.tanh(this.data[this.offset + i]));
    }
    return res;
  }

  /**
   * Softmax along last dimension.
   */
  public softmax(axis: number = -1, out?: Tensor, arena?: TensorMemoryArena): Tensor {
    if (out === undefined && this.requiresGrad && AutogradBridge.isRecording()) {
      const provider = AutogradBridge.getProvider();
      if (provider) return provider.softmax(this, axis, arena);
    }
    const resolvedAxis = axis < 0 ? axis + this.ndim : axis;
    if (resolvedAxis !== this.ndim - 1) {
      throw new Error('Softmax currently supports the last axis (axis = -1)');
    }

    const res = out ?? (arena ? arena.allocateTensor(this.shape) : Tensor.zeros(this.shape));
    const lastDim = this.shape[this.ndim - 1];
    const outerRows = this.size / lastDim;

    for (let r = 0; r < outerRows; r++) {
      const rowStart = this.offset + r * lastDim;
      const resStart = res.offset + r * lastDim;

      // Find max for numerical stability
      let maxVal = -Infinity;
      for (let j = 0; j < lastDim; j++) {
        const v = this.data[rowStart + j];
        if (v > maxVal) maxVal = v;
      }

      let expSum = 0.0;
      for (let j = 0; j < lastDim; j++) {
        const e = Math.exp(this.data[rowStart + j] - maxVal);
        res.data[resStart + j] = e;
        expSum += e;
      }

      const invExpSum = 1.0 / (expSum + 1e-12);
      for (let j = 0; j < lastDim; j++) {
        res.data[resStart + j] = Math.fround(res.data[resStart + j] * invExpSum);
      }
    }
    return res;
  }

  /**
   * Mean squared error loss between this tensor and a target tensor.
   * Returns scalar loss and analytical gradient tensor w.r.t this tensor.
   */
  public mseLoss(target: Tensor, arena?: TensorMemoryArena): { loss: number; grad: Tensor } {
    if (this.size !== target.size) {
      throw new Error(`Size mismatch in mseLoss: ${this.size} !== ${target.size}`);
    }
    const grad = arena ? arena.allocateTensor(this.shape) : Tensor.zeros(this.shape);
    const N = this.size;
    const invN = 1.0 / N;
    let sumSq = 0.0;

    for (let i = 0; i < N; i++) {
      const diff = this.data[this.offset + i] - target.data[target.offset + i];
      sumSq += diff * diff;
      grad.data[grad.offset + i] = Math.fround((2.0 * diff) * invN);
    }

    return {
      loss: Math.fround(sumSq * invN),
      grad,
    };
  }

  /**
   * Convert tensor to nested JavaScript numbers array for inspection / debugging.
   */
  public toArray(): any {
    if (this.ndim === 0) return this.data[this.offset];
    if (this.ndim === 1) {
      const arr = new Array<number>(this.shape[0]);
      for (let i = 0; i < this.shape[0]; i++) {
        arr[i] = this.get(i);
      }
      return arr;
    }
    if (this.ndim === 2) {
      const [rows, cols] = this.shape;
      const res: number[][] = [];
      for (let i = 0; i < rows; i++) {
        const row = new Array<number>(cols);
        for (let j = 0; j < cols; j++) {
          row[j] = this.get(i, j);
        }
        res.push(row);
      }
      return res;
    }

    // Generic recursive n-dimensional conversion
    const build = (dim: number, ...indices: number[]): any => {
      if (dim === this.ndim) {
        return this.get(...indices);
      }
      const len = this.shape[dim];
      const arr = new Array(len);
      for (let i = 0; i < len; i++) {
        arr[i] = build(dim + 1, ...indices, i);
      }
      return arr;
    };
    return build(0);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // FACTORY CONSTRUCTORS
  // ───────────────────────────────────────────────────────────────────────────

  public static zeros(shape: number[], arena?: TensorMemoryArena): Tensor {
    if (arena) return arena.allocateTensor(shape);
    const size = shape.reduce((a, b) => a * b, 1);
    const data = new Float32Array(size);
    return new Tensor(data, shape);
  }

  public static ones(shape: number[], arena?: TensorMemoryArena): Tensor {
    const t = Tensor.zeros(shape, arena);
    t.data.fill(1.0, t.offset, t.offset + t.size);
    return t;
  }

  public static fill(value: number, shape: number[], arena?: TensorMemoryArena): Tensor {
    const t = Tensor.zeros(shape, arena);
    t.data.fill(Math.fround(value), t.offset, t.offset + t.size);
    return t;
  }

  public static fromArray(values: number[] | Float32Array, shape?: number[], arena?: TensorMemoryArena): Tensor {
    const s = shape ?? [values.length];
    const expectedSize = s.reduce((a, b) => a * b, 1);
    if (values.length !== expectedSize) {
      throw new Error(`Array length (${values.length}) does not match shape [${s}] (size ${expectedSize})`);
    }

    if (arena) {
      const t = arena.allocateTensor(s);
      t.data.set(values, t.offset);
      return t;
    }

    const data = values instanceof Float32Array ? new Float32Array(values) : new Float32Array(values);
    return new Tensor(data, s);
  }

  public static randn(shape: number[], seed: number = 42, arena?: TensorMemoryArena): Tensor {
    const t = Tensor.zeros(shape, arena);
    let s = seed >>> 0;
    if (s === 0) s = 1;

    const nextFloat = (): number => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      s = s >>> 0;
      return (s >>> 0) / 4294967296;
    };

    const nextGaussian = (): number => {
      const u1 = Math.max(1e-7, nextFloat());
      const u2 = nextFloat();
      return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    };

    for (let i = 0; i < t.size; i++) {
      t.data[t.offset + i] = Math.fround(nextGaussian() * 0.1);
    }
    return t;
  }

  /**
   * Sets whether this tensor requires gradient tracking.
   */
  public withRequiresGrad(requiresGrad: boolean = true): this {
    this.requiresGrad = requiresGrad;
    return this;
  }

  /**
   * Clears accumulated gradient.
   */
  public zeroGrad(): void {
    this.grad = null;
  }

  /**
   * Executes reverse-mode automatic differentiation starting from this tensor.
   */
  public backward(grad?: Tensor, arena?: TensorMemoryArena, retainGraph: boolean = false): void {
    const provider = AutogradBridge.getProvider();
    if (!provider) {
      throw new Error(
        'Autograd provider is not registered. Ensure @one/tensor or @one/tensor/autograd is loaded before calling backward().'
      );
    }
    provider.backward(this, grad, arena, retainGraph);
  }

  /**
   * Returns a new Tensor detached from the current autograd graph.
   */
  public detach(): Tensor {
    const detached = new Tensor(this.data, this.shape, this.strides, this.offset);
    detached.requiresGrad = false;
    detached.grad = null;
    detached.gradFn = null;
    return detached;
  }

  /**
   * Rectified Linear Unit activation with autograd support.
   */
  public relu(arena?: TensorMemoryArena): Tensor {
    if (this.requiresGrad && AutogradBridge.isRecording()) {
      const provider = AutogradBridge.getProvider();
      if (provider) return provider.relu(this, arena);
    }
    const out = arena ? arena.allocateTensor(this.shape) : Tensor.zeros(this.shape);
    for (let i = 0; i < this.size; i++) {
      const v = this.data[this.offset + i];
      out.data[out.offset + i] = v > 0 ? v : 0.0;
    }
    return out;
  }
}
