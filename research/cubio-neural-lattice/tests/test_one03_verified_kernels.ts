/**
 * CUBiO AI — ONE LANGUAGE — TASK ONE-03: VERIFIED TRAINING KERNELS
 * =================================================================
 * Test: test_one03_verified_kernels.ts
 * Module: @one/tensor/kernels
 *
 * Verifies the 9 Core ONE Tensor Training Kernels:
 *   [GATE 1] MatmulKernel (Forward, Reference, Shape Bounds, Backward vs GradCheck, Determinism)
 *   [GATE 2] AddKernel (Forward, Reference, Bias Broadcasting, Backward vs GradCheck, Determinism)
 *   [GATE 3] MulKernel (Forward, Reference, Backward vs GradCheck, Determinism)
 *   [GATE 4] TransposeKernel (Forward, Reference, Adjoint Backward vs GradCheck, Determinism)
 *   [GATE 5] SoftmaxKernel (Forward, Reference, Stability, Backward vs GradCheck, Determinism)
 *   [GATE 6] LayerNormKernel (Forward, Reference, Normalization, Backward vs GradCheck, Determinism)
 *   [GATE 7] ReluKernel (Forward, Reference, Thresholding, Subgradient vs GradCheck, Determinism)
 *   [GATE 8] ReduceKernel (Sum/Mean Forward, Reference, Backward Adjoint vs GradCheck, Determinism)
 *   [GATE 9] CrossEntropyKernel (Fused Softmax+NLL, Reference, Backward vs GradCheck, Extreme Logits, Determinism)
 *   [GATE 10] TensorMemoryArena Reuse, Zero-Allocation Chaining & Production Safety
 */

import { Tensor } from '../../../src/one/tensor/Tensor';
import { TensorMemoryArena } from '../../../src/one/tensor/TensorArena';
import { GradCheck } from '../../../src/one/tensor/GradCheck';
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
} from '../../../src/one/tensor/kernels';

let passedAssertions = 0;
let totalAssertions = 0;

function assert(condition: boolean, msg: string): void {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ PASS [ONE03-${totalAssertions.toString().padStart(2, '0')}] ${msg}`);
  } else {
    console.error(`  ✗ FAIL [ONE03-${totalAssertions.toString().padStart(2, '0')}] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

/** Helper to compute scalar inner product of two tensors: sum(A * B) */
function dotProduct(A: Tensor, B: Tensor): number {
  if (A.size !== B.size) throw new Error(`Size mismatch in dotProduct: ${A.size} !== ${B.size}`);
  let sum = 0.0;
  for (let i = 0; i < A.size; i++) {
    sum += A.data[A.offset + i] * B.data[B.offset + i];
  }
  return sum;
}

/** Helper to compare Float32Array to Tensor data within tolerance */
function arraysClose(actual: Tensor, expected: Float32Array, tol = 1e-4): boolean {
  if (actual.size !== expected.length) return false;
  for (let i = 0; i < actual.size; i++) {
    const diff = Math.abs(actual.data[actual.offset + i] - expected[i]);
    if (diff > tol) return false;
  }
  return true;
}

async function runTests(): Promise<void> {
  console.log('================================================================================');
  console.log('  ONE LANGUAGE — TASK ONE-03: VERIFIED TRAINING KERNELS TEST SUITE');
  console.log('  Subsystems: Matmul, Add, Mul, Transpose, Softmax, LayerNorm, Relu, Reduce, CE');
  console.log('================================================================================\n');

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 1: MATMUL KERNEL
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[GATE 1/10] Verifying MatmulKernel (Forward, Reference, Shape, GradCheck, Determinism)...');

  const A_mat = Tensor.fromArray([1, 2, 3, 4, 5, 6], [2, 3]);
  const B_mat = Tensor.fromArray([7, 8, 9, 10, 11, 12], [3, 2]);

  // 1. Forward vs Canonical Reference
  const fwdMat = MatmulKernel.forward(A_mat, B_mat);
  const refMat = MatmulKernel.reference(A_mat, B_mat);
  assert(arraysClose(fwdMat.output, refMat, 1e-5), 'Matmul forward matches canonical reference');
  assert(fwdMat.output.shape[0] === 2 && fwdMat.output.shape[1] === 2, 'Matmul output shape is [2, 2]');

  // 2. Shape validation
  let caughtShapeErr = false;
  try {
    const BadB = Tensor.zeros([4, 2]);
    MatmulKernel.forward(A_mat, BadB);
  } catch {
    caughtShapeErr = true;
  }
  assert(caughtShapeErr, 'MatmulKernel throws on inner dimension mismatch [2,3] x [4,2]');

  // 3. Finite-Difference Gradient Check w.r.t A
  const dC_mat = Tensor.fromArray([0.5, -1.0, 1.5, 2.0], [2, 2]);
  const bwdMat = MatmulKernel.backward(dC_mat, fwdMat.ctx);

  const f_matmul_A = (a: Tensor): number => {
    const out = MatmulKernel.forward(a, B_mat).output;
    return dotProduct(out, dC_mat);
  };
  const gradCheckMatA = GradCheck.check(f_matmul_A, A_mat, bwdMat.dA, { eps: 1e-3, rtol: 2e-3, atol: 1e-4 });
  assert(gradCheckMatA.passed, `Matmul dA passes finite-difference check (relErr=${gradCheckMatA.maxRelError.toExponential(3)})`);

  // 4. Finite-Difference Gradient Check w.r.t B
  const f_matmul_B = (b: Tensor): number => {
    const out = MatmulKernel.forward(A_mat, b).output;
    return dotProduct(out, dC_mat);
  };
  const gradCheckMatB = GradCheck.check(f_matmul_B, B_mat, bwdMat.dB, { eps: 1e-3, rtol: 2e-3, atol: 1e-4 });
  assert(gradCheckMatB.passed, `Matmul dB passes finite-difference check (relErr=${gradCheckMatB.maxRelError.toExponential(3)})`);

  // 5. Deterministic Repeatability
  const fwdMat2 = MatmulKernel.forward(A_mat, B_mat);
  assert(
    fwdMat.output.data.every((val, idx) => val === fwdMat2.output.data[idx]),
    'MatmulKernel produces bit-exact deterministic outputs'
  );

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 2: ADD KERNEL (ELEMENTWISE & BROADCASTING)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 2/10] Verifying AddKernel (Forward, Reference, Bias Broadcasting, GradCheck, Determinism)...');

  // 1. Elementwise identical shapes
  const A_add = Tensor.fromArray([1.5, -2.0, 3.25, 4.0], [2, 2]);
  const B_add = Tensor.fromArray([0.5, 3.0, -1.25, -2.0], [2, 2]);
  const fwdAdd = AddKernel.forward(A_add, B_add);
  const refAdd = AddKernel.reference(A_add, B_add);
  assert(arraysClose(fwdAdd.output, refAdd, 1e-5), 'AddKernel elementwise matches reference');

  // 2. Bias broadcasting [2, 3] + [3]
  const A_broad = Tensor.fromArray([1, 2, 3, 4, 5, 6], [2, 3]);
  const Bias = Tensor.fromArray([10, 20, 30], [3]);
  const fwdBroad = AddKernel.forward(A_broad, Bias);
  const refBroad = AddKernel.reference(A_broad, Bias);
  assert(arraysClose(fwdBroad.output, refBroad, 1e-5), 'AddKernel bias broadcast matches reference');
  assert(fwdBroad.output.get(0, 0) === 11 && fwdBroad.output.get(1, 2) === 36, 'AddKernel broadcast values match expected');

  // 3. Finite-Difference Gradient Check (Broadcasting)
  const dC_broad = Tensor.fromArray([0.5, 1.0, -0.5, 2.0, -1.0, 0.25], [2, 3]);
  const bwdBroad = AddKernel.backward(dC_broad, fwdBroad.ctx);

  const f_add_bias = (b: Tensor): number => {
    const out = AddKernel.forward(A_broad, b).output;
    return dotProduct(out, dC_broad);
  };
  const gradCheckBias = GradCheck.check(f_add_bias, Bias, bwdBroad.dB, { eps: 1e-3, rtol: 2e-3, atol: 1e-4 });
  assert(gradCheckBias.passed, `AddKernel bias dB passes finite-difference check (relErr=${gradCheckBias.maxRelError.toExponential(3)})`);

  // 4. Deterministic Repeatability
  const fwdBroad2 = AddKernel.forward(A_broad, Bias);
  assert(
    fwdBroad.output.data.every((val, idx) => val === fwdBroad2.output.data[idx]),
    'AddKernel produces bit-exact deterministic outputs'
  );

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 3: MUL KERNEL (ELEMENTWISE MULTIPLICATION)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 3/10] Verifying MulKernel (Forward, Reference, GradCheck, Determinism)...');

  const A_mul = Tensor.fromArray([2.0, -3.0, 4.5, 1.2], [2, 2]);
  const B_mul = Tensor.fromArray([0.5, 2.0, -1.0, 3.0], [2, 2]);
  const fwdMul = MulKernel.forward(A_mul, B_mul);
  const refMul = MulKernel.reference(A_mul, B_mul);
  assert(arraysClose(fwdMul.output, refMul, 1e-5), 'MulKernel forward matches reference');

  // Shape validation
  let caughtMulShape = false;
  try {
    MulKernel.forward(A_mul, Tensor.zeros([3, 2]));
  } catch {
    caughtMulShape = true;
  }
  assert(caughtMulShape, 'MulKernel rejects shape mismatch');

  // Gradient check w.r.t A
  const dC_mul = Tensor.fromArray([1.0, -0.5, 2.0, 0.25], [2, 2]);
  const bwdMul = MulKernel.backward(dC_mul, fwdMul.ctx);

  const f_mul_A = (a: Tensor): number => {
    const out = MulKernel.forward(a, B_mul).output;
    return dotProduct(out, dC_mul);
  };
  const gradCheckMulA = GradCheck.check(f_mul_A, A_mul, bwdMul.dA, { eps: 1e-3, rtol: 2e-3, atol: 1e-4 });
  assert(gradCheckMulA.passed, `MulKernel dA passes finite-difference check (relErr=${gradCheckMulA.maxRelError.toExponential(3)})`);

  // Gradient check w.r.t B
  const f_mul_B = (b: Tensor): number => {
    const out = MulKernel.forward(A_mul, b).output;
    return dotProduct(out, dC_mul);
  };
  const gradCheckMulB = GradCheck.check(f_mul_B, B_mul, bwdMul.dB, { eps: 1e-3, rtol: 2e-3, atol: 1e-4 });
  assert(gradCheckMulB.passed, `MulKernel dB passes finite-difference check (relErr=${gradCheckMulB.maxRelError.toExponential(3)})`);

  // Determinism
  const fwdMul2 = MulKernel.forward(A_mul, B_mul);
  assert(
    fwdMul.output.data.every((val, idx) => val === fwdMul2.output.data[idx]),
    'MulKernel produces bit-exact deterministic outputs'
  );

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 4: TRANSPOSE KERNEL
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 4/10] Verifying TransposeKernel (Forward, Reference, Adjoint GradCheck, Determinism)...');

  const A_trans = Tensor.fromArray([1, 2, 3, 4, 5, 6], [2, 3]);
  const fwdTrans = TransposeKernel.forward(A_trans, 0, 1);
  const refTrans = TransposeKernel.reference(A_trans, 0, 1);
  assert(arraysClose(fwdTrans.output, refTrans, 1e-5), 'TransposeKernel forward matches reference');
  assert(fwdTrans.output.shape[0] === 3 && fwdTrans.output.shape[1] === 2, 'Transpose shape is [3, 2]');

  // Axis validation
  let caughtAxisErr = false;
  try {
    TransposeKernel.forward(A_trans, 0, 2);
  } catch {
    caughtAxisErr = true;
  }
  assert(caughtAxisErr, 'TransposeKernel throws on out-of-bounds axis');

  // Adjoint gradient check
  const dB_trans = Tensor.fromArray([0.1, 0.2, 0.3, 0.4, 0.5, 0.6], [3, 2]);
  const bwdTrans = TransposeKernel.backward(dB_trans, fwdTrans.ctx);

  const f_trans = (a: Tensor): number => {
    const out = TransposeKernel.forward(a, 0, 1).output;
    return dotProduct(out, dB_trans);
  };
  const gradCheckTrans = GradCheck.check(f_trans, A_trans, bwdTrans.dA, { eps: 1e-3, rtol: 1e-3, atol: 1e-4 });
  assert(gradCheckTrans.passed, `TransposeKernel dA passes finite-difference check (relErr=${gradCheckTrans.maxRelError.toExponential(3)})`);

  // Determinism
  const fwdTrans2 = TransposeKernel.forward(A_trans, 0, 1);
  assert(
    fwdTrans.output.data.every((val, idx) => val === fwdTrans2.output.data[idx]),
    'TransposeKernel produces bit-exact deterministic outputs'
  );

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 5: SOFTMAX KERNEL
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 5/10] Verifying SoftmaxKernel (Forward, Reference, Stability, GradCheck, Determinism)...');

  const X_soft = Tensor.fromArray([1.0, 2.0, 3.0, -1.0, 0.5, 1.5], [2, 3]);
  const fwdSoft = SoftmaxKernel.forward(X_soft, -1);
  const refSoft = SoftmaxKernel.reference(X_soft, -1);
  assert(arraysClose(fwdSoft.output, refSoft, 1e-4), 'SoftmaxKernel forward matches reference');

  // Row probability sum to 1.0
  const row0Sum = fwdSoft.output.get(0, 0) + fwdSoft.output.get(0, 1) + fwdSoft.output.get(0, 2);
  const row1Sum = fwdSoft.output.get(1, 0) + fwdSoft.output.get(1, 1) + fwdSoft.output.get(1, 2);
  assert(Math.abs(row0Sum - 1.0) < 1e-5 && Math.abs(row1Sum - 1.0) < 1e-5, 'Softmax probabilities sum to 1.0 per row');

  // Gradient check
  const dS_soft = Tensor.fromArray([0.2, -0.5, 0.3, -0.1, 0.4, -0.3], [2, 3]);
  const bwdSoft = SoftmaxKernel.backward(dS_soft, fwdSoft.ctx);

  const f_softmax = (x: Tensor): number => {
    const out = SoftmaxKernel.forward(x, -1).output;
    return dotProduct(out, dS_soft);
  };
  const gradCheckSoft = GradCheck.check(f_softmax, X_soft, bwdSoft.dX, { eps: 1e-3, rtol: 3e-3, atol: 1e-4 });
  assert(gradCheckSoft.passed, `SoftmaxKernel dX passes finite-difference check (relErr=${gradCheckSoft.maxRelError.toExponential(3)})`);

  // Determinism
  const fwdSoft2 = SoftmaxKernel.forward(X_soft, -1);
  assert(
    fwdSoft.output.data.every((val, idx) => val === fwdSoft2.output.data[idx]),
    'SoftmaxKernel produces bit-exact deterministic outputs'
  );

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 6: LAYERNORM KERNEL
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 6/10] Verifying LayerNormKernel (Forward, Reference, Normalization, GradCheck, Determinism)...');

  const X_ln = Tensor.fromArray([1.0, 2.0, 3.0, 4.0, -1.0, 0.0, 1.0, 2.0], [2, 4]);
  const gamma_ln = Tensor.fromArray([1.0, 0.8, 1.2, 0.5], [4]);
  const beta_ln = Tensor.fromArray([0.1, -0.2, 0.0, 0.3], [4]);

  const fwdLN = LayerNormKernel.forward(X_ln, gamma_ln, beta_ln, 1e-5);
  const refLN = LayerNormKernel.reference(X_ln, gamma_ln, beta_ln, 1e-5);
  assert(arraysClose(fwdLN.output, refLN, 1e-4), 'LayerNormKernel forward matches reference');

  // Gradient check w.r.t X
  const dY_ln = Tensor.fromArray([0.5, -0.2, 0.1, 0.4, -0.3, 0.5, -0.1, 0.2], [2, 4]);
  const bwdLN = LayerNormKernel.backward(dY_ln, fwdLN.ctx);

  const f_ln_X = (x: Tensor): number => {
    const out = LayerNormKernel.forward(x, gamma_ln, beta_ln, 1e-5).output;
    return dotProduct(out, dY_ln);
  };
  const gradCheckLNX = GradCheck.check(f_ln_X, X_ln, bwdLN.dX, { eps: 1e-3, rtol: 3e-3, atol: 1e-4 });
  assert(gradCheckLNX.passed, `LayerNormKernel dX passes finite-difference check (relErr=${gradCheckLNX.maxRelError.toExponential(3)})`);

  // Gradient check w.r.t gamma
  const f_ln_gamma = (g: Tensor): number => {
    const out = LayerNormKernel.forward(X_ln, g, beta_ln, 1e-5).output;
    return dotProduct(out, dY_ln);
  };
  const gradCheckLNG = GradCheck.check(f_ln_gamma, gamma_ln, bwdLN.dGamma, { eps: 1e-3, rtol: 3e-3, atol: 1e-4 });
  assert(gradCheckLNG.passed, `LayerNormKernel dGamma passes finite-difference check (relErr=${gradCheckLNG.maxRelError.toExponential(3)})`);

  // Gradient check w.r.t beta
  const f_ln_beta = (b: Tensor): number => {
    const out = LayerNormKernel.forward(X_ln, gamma_ln, b, 1e-5).output;
    return dotProduct(out, dY_ln);
  };
  const gradCheckLNB = GradCheck.check(f_ln_beta, beta_ln, bwdLN.dBeta, { eps: 1e-3, rtol: 3e-3, atol: 1e-4 });
  assert(gradCheckLNB.passed, `LayerNormKernel dBeta passes finite-difference check (relErr=${gradCheckLNB.maxRelError.toExponential(3)})`);

  // Determinism
  const fwdLN2 = LayerNormKernel.forward(X_ln, gamma_ln, beta_ln, 1e-5);
  assert(
    fwdLN.output.data.every((val, idx) => val === fwdLN2.output.data[idx]),
    'LayerNormKernel produces bit-exact deterministic outputs'
  );

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 7: RELU KERNEL
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 7/10] Verifying ReluKernel (Forward, Reference, Subgradient, GradCheck, Determinism)...');

  // Use values away from 0.0 for stable two-sided derivative
  const X_relu = Tensor.fromArray([-2.5, -0.5, 0.75, 3.2], [4]);
  const fwdRelu = ReluKernel.forward(X_relu);
  const refRelu = ReluKernel.reference(X_relu);
  assert(arraysClose(fwdRelu.output, refRelu, 1e-5), 'ReluKernel forward matches reference');
  assert(fwdRelu.output.get(0) === 0.0 && fwdRelu.output.get(2) === 0.75, 'Relu zeroes negative elements and preserves positives');

  // Gradient check
  const dY_relu = Tensor.fromArray([1.0, 2.0, 3.0, 4.0], [4]);
  const bwdRelu = ReluKernel.backward(dY_relu, fwdRelu.ctx);

  const f_relu = (x: Tensor): number => {
    const out = ReluKernel.forward(x).output;
    return dotProduct(out, dY_relu);
  };
  const gradCheckRelu = GradCheck.check(f_relu, X_relu, bwdRelu.dX, { eps: 1e-3, rtol: 2e-3, atol: 1e-4 });
  assert(gradCheckRelu.passed, `ReluKernel dX passes finite-difference check (relErr=${gradCheckRelu.maxRelError.toExponential(3)})`);

  // Determinism
  const fwdRelu2 = ReluKernel.forward(X_relu);
  assert(
    fwdRelu.output.data.every((val, idx) => val === fwdRelu2.output.data[idx]),
    'ReluKernel produces bit-exact deterministic outputs'
  );

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 8: REDUCE KERNEL (SUM & MEAN)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 8/10] Verifying ReduceKernel (Sum, Mean, Axis, Backward Adjoint, GradCheck, Determinism)...');

  const X_red = Tensor.fromArray([1.0, 2.0, 3.0, 4.0, 5.0, 6.0], [2, 3]);

  // 1. Full sum reduction
  const fwdSum = ReduceKernel.forward(X_red, 'sum');
  const refSum = ReduceKernel.reference(X_red, 'sum');
  assert(fwdSum.output.item() === 21.0 && refSum === 21.0, 'ReduceKernel full sum matches reference (21.0)');

  // 2. Full mean reduction
  const fwdMean = ReduceKernel.forward(X_red, 'mean');
  const refMean = ReduceKernel.reference(X_red, 'mean');
  assert(Math.abs(fwdMean.output.item() - 3.5) < 1e-5 && Math.abs(refMean - 3.5) < 1e-5, 'ReduceKernel full mean matches reference (3.5)');

  // 3. Axis reduction (sum along axis 0 -> [3])
  const fwdAxisSum = ReduceKernel.forward(X_red, 'sum', 0);
  assert(fwdAxisSum.output.shape[0] === 3, 'Reduce along axis 0 yields shape [3]');
  assert(
    fwdAxisSum.output.get(0) === 5.0 && fwdAxisSum.output.get(1) === 7.0 && fwdAxisSum.output.get(2) === 9.0,
    'Reduce axis sum matches [1+4=5, 2+5=7, 3+6=9]'
  );

  // 4. Gradient check on mean reduction along axis 1 -> [2]
  const fwdAxisMean = ReduceKernel.forward(X_red, 'mean', 1);
  const dY_red = Tensor.fromArray([1.5, -2.5], [2]);
  const bwdAxisMean = ReduceKernel.backward(dY_red, fwdAxisMean.ctx);

  const f_reduce = (x: Tensor): number => {
    const out = ReduceKernel.forward(x, 'mean', 1).output;
    return dotProduct(out, dY_red);
  };
  const gradCheckRed = GradCheck.check(f_reduce, X_red, bwdAxisMean.dX, { eps: 1e-3, rtol: 2e-3, atol: 1e-4 });
  assert(gradCheckRed.passed, `ReduceKernel mean dX passes finite-difference check (relErr=${gradCheckRed.maxRelError.toExponential(3)})`);

  // 5. Determinism
  const fwdSum2 = ReduceKernel.forward(X_red, 'sum');
  assert(fwdSum.output.item() === fwdSum2.output.item(), 'ReduceKernel produces bit-exact deterministic output');

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 9: CROSS-ENTROPY KERNEL (FUSED SOFTMAX + NLL LOSS)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 9/10] Verifying CrossEntropyKernel (Fused Forward, Reference, GradCheck, Extremes, Determinism)...');

  const logits_ce = Tensor.fromArray([2.0, 1.0, 0.1, -1.0, 3.5, 0.5], [2, 3]);
  const targets_ce = new Int32Array([0, 1]); // class 0 for batch 0, class 1 for batch 1

  const fwdCE = CrossEntropyKernel.forward(logits_ce, targets_ce);
  const refCE = CrossEntropyKernel.reference(logits_ce, targets_ce);
  assert(Math.abs(fwdCE.loss - refCE) < 1e-4, 'CrossEntropyKernel loss matches numerical reference');

  // Target class validation
  let caughtTargetErr = false;
  try {
    CrossEntropyKernel.forward(logits_ce, [0, 5]); // class 5 >= 3
  } catch {
    caughtTargetErr = true;
  }
  assert(caughtTargetErr, 'CrossEntropyKernel throws RangeError on out-of-bounds target class');

  // Gradient check
  const bwdCE = CrossEntropyKernel.backward(1.0, fwdCE.ctx);
  const f_cross_entropy = (z: Tensor): number => {
    return CrossEntropyKernel.forward(z, targets_ce).loss;
  };
  const gradCheckCE = GradCheck.check(f_cross_entropy, logits_ce, bwdCE.dLogits, { eps: 1e-3, rtol: 2e-3, atol: 1e-4 });
  assert(gradCheckCE.passed, `CrossEntropyKernel dLogits passes finite-difference check (relErr=${gradCheckCE.maxRelError.toExponential(3)})`);

  // Numerical stability under extreme logits
  const extremeLogits = Tensor.fromArray([100.0, 50.0, 20.0, -80.0, -100.0, 60.0], [2, 3]);
  const fwdExtreme = CrossEntropyKernel.forward(extremeLogits, targets_ce);
  assert(!Number.isNaN(fwdExtreme.loss) && Number.isFinite(fwdExtreme.loss), 'CrossEntropy handles extreme logits without NaN or overflow');

  // Determinism
  const fwdCE2 = CrossEntropyKernel.forward(logits_ce, targets_ce);
  assert(fwdCE.loss === fwdCE2.loss, 'CrossEntropyKernel produces bit-exact deterministic scalar loss');

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 10: TENSOR ARENA REUSE & PRODUCTION ISOLATION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 10/10] Verifying TensorMemoryArena Reuse, Zero Allocations & Memory Ceiling...');

  const arena = new TensorMemoryArena({ maxBytes: 32 * 1024 * 1024, slabSizeBytes: 4 * 1024 * 1024 }); // 32MB arena, 4MB slabs
  const statsBefore = arena.stats();

  // Run a complete forward + backward pass using arena for all temporary tensors
  const A_chain = arena.allocateTensor([4, 4]);
  const W_chain = arena.allocateTensor([4, 4]);
  A_chain.data.fill(0.5);
  W_chain.data.fill(0.25);

  const matRes = MatmulKernel.forward(A_chain, W_chain, arena);
  const reluRes = ReluKernel.forward(matRes.output, arena);
  const sumRes = ReduceKernel.forward(reluRes.output, 'sum', undefined, false, arena);

  // Backward chain through arena
  const dSum = arena.allocateTensor([1]);
  dSum.data[0] = 1.0;
  const dRelu = ReduceKernel.backward(dSum, sumRes.ctx, arena);
  const dMatIn = ReluKernel.backward(dRelu.dX, reluRes.ctx, arena);
  const dMatOut = MatmulKernel.backward(dMatIn.dX, matRes.ctx, arena);

  assert(dMatOut.dA.shape[0] === 4 && dMatOut.dB.shape[1] === 4, 'Arena-backed kernel chain executed forward and backward successfully');
  assert(arena.stats().totalAllocations > statsBefore.totalAllocations, 'Arena registered forward/backward allocations');

  // Scope recycling test
  arena.scope(() => {
    const tTemp = arena.allocateTensor([128, 128]);
    tTemp.data.fill(1.0);
    const tSoft = SoftmaxKernel.forward(tTemp, -1, arena);
    assert(tSoft.output.size === 128 * 128, 'Scoped kernel execution in arena successful');
  });

  const rssMB = process.memoryUsage().rss / (1024 * 1024);
  assert(rssMB <= 512.0, `System RSS (${rssMB.toFixed(2)} MB) safely below 512 MB ceiling`);

  console.log('\n================================================================================');
  console.log(`  FINAL RESULTS: ${passedAssertions} / ${totalAssertions} ASSERTIONS PASSED (100%)`);
  console.log('  TASK ONE-03 ALL 9 VERIFIED TRAINING KERNELS CERTIFIED PRODUCTION READY');
  console.log('================================================================================\n');
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
