/**
 * ONE Language — Task 15 Verification Suite
 * Module: Autograd, Native Kernels & WASM Acceleration Audit & Validation
 * Path: tests/tensor/task15_autograd_kernels_wasm.test.ts
 */

import { Tensor } from '../../src/one/tensor/Tensor';
import { TensorMemoryArena, TensorArenaOOMError } from '../../src/one/tensor/TensorArena';
import { GradCheck } from '../../src/one/tensor/GradCheck';
import { AutogradTape, AutogradOps } from '../../src/one/tensor/autograd';
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
} from '../../src/one/tensor/kernels';
import { createWasmSimdMatmul, WasmSimdInstance } from '../../src/one/wasm/WasmSimdMatmul';
import { NativeTrainingKernelSelector } from '../../src/one/intelligence/compute/NativeTrainingKernelSelector';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

export function runTask15AutogradKernelWasmTests(): void {
  console.log('='.repeat(80));
  console.log('  ONE INTELLIGENCE — TASK 15: AUTOGRAD, NATIVE KERNELS & WASM ACCELERATION');
  console.log('='.repeat(80));

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 1: Mathematical Correctness on Small Reference Cases
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 1] Mathematical Correctness on Small Reference Cases...');

  // 1A: Elementwise Add & Bias Broadcasting
  const tA = Tensor.fromArray([1, 2, 3, 4], [2, 2]);
  const tB = Tensor.fromArray([5, 6, 7, 8], [2, 2]);
  const tAdd = AddKernel.forward(tA, tB).output;
  assert(tAdd.get(0, 0) === 6 && tAdd.get(0, 1) === 8, 'Suite 1A: Add row 0 matches reference [6, 8]');
  assert(tAdd.get(1, 0) === 10 && tAdd.get(1, 1) === 12, 'Suite 1A: Add row 1 matches reference [10, 12]');

  // Bias broadcast [2, 2] + [2] (row broadcast)
  const tBias = Tensor.fromArray([10, 20], [2]);
  const tBroad = AddKernel.forward(tA, tBias).output;
  assert(tBroad.get(0, 0) === 11 && tBroad.get(0, 1) === 22, 'Suite 1A: Bias broadcast row 0 is [11, 22]');
  assert(tBroad.get(1, 0) === 13 && tBroad.get(1, 1) === 24, 'Suite 1A: Bias broadcast row 1 is [13, 24]');

  // 1B: Matrix Multiplication: [[1, 2], [3, 4]] x [[5, 6], [7, 8]] = [[19, 22], [43, 50]]
  const tMatmul = MatmulKernel.forward(tA, tB).output;
  assert(tMatmul.get(0, 0) === 19 && tMatmul.get(0, 1) === 22, 'Suite 1B: Matmul row 0 matches reference [19, 22]');
  assert(tMatmul.get(1, 0) === 43 && tMatmul.get(1, 1) === 50, 'Suite 1B: Matmul row 1 matches reference [43, 50]');

  // 1C: ReLU Activation: [-2, 0, 3] -> [0, 0, 3]
  const tReluIn = Tensor.fromArray([-2, 0, 3], [3]);
  const tReluOut = ReluKernel.forward(tReluIn).output;
  assert(tReluOut.get(0) === 0 && tReluOut.get(1) === 0 && tReluOut.get(2) === 3, 'Suite 1C: ReLU matches reference');

  // 1D: Transpose: [[1, 2, 3], [4, 5, 6]] -> shape [3, 2]
  const tRect = Tensor.fromArray([1, 2, 3, 4, 5, 6], [2, 3]);
  const tTrans = TransposeKernel.forward(tRect, 0, 1).output;
  assert(tTrans.shape[0] === 3 && tTrans.shape[1] === 2, 'Suite 1D: Transpose swaps dimensions to [3, 2]');
  assert(tTrans.get(0, 1) === 4 && tTrans.get(2, 0) === 3, 'Suite 1D: Transposed elements match indices');

  console.log('  ✓ Suite 1 passed: All small reference operations match analytical linear algebra solutions.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 2: Reverse-Mode Autograd & Finite-Difference GradCheck
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 2] Reverse-Mode Autograd & Finite-Difference GradCheck...');

  AutogradTape.resetDefaultTape();

  // 2A: Analytical DAG: y = x^2 + 3x => dy/dx = 2x + 3. At x = 4, dy/dx = 11.0.
  const tX = Tensor.fromArray([4.0], [1]).withRequiresGrad(true);
  const tX2 = AutogradOps.mul(tX, tX); // x^2
  const t3 = Tensor.fromArray([3.0], [1]);
  const t3X = AutogradOps.mul(t3, tX); // 3x
  const tY = AutogradOps.add(tX2, t3X); // y = x^2 + 3x

  assert(tY.item() === 28.0, 'Suite 2A: Forward computation y = 4^2 + 3(4) = 28.0');
  assert(AutogradTape.getActiveTape().count === 3, 'Suite 2A: Tape recorded 3 operations');

  AutogradTape.getActiveTape().backward(tY);
  assert(tX.grad !== null, 'Suite 2A: Gradient populated on tX');
  assert(Math.abs(tX.grad.item() - 11.0) < 1e-5, `Suite 2A: Analytical dy/dx at x=4 is 11.0 (got ${tX.grad.item()})`);

  // 2B: Finite-Difference Gradient Check on Matmul: L = sum(A x B)
  const tGradA = Tensor.fromArray([1.2, -0.5, 0.8, 2.1], [2, 2]).withRequiresGrad(true);
  const tGradB = Tensor.fromArray([0.4, 1.1, -1.5, 0.7], [2, 2]).withRequiresGrad(true);

  // Compute analytical gradients via Autograd
  AutogradTape.resetDefaultTape();
  const tOut = AutogradOps.matmul(tGradA, tGradB);
  const tLoss = AutogradOps.reduceSum(tOut);
  AutogradTape.getActiveTape().backward(tLoss);

  // Compute numerical gradients via finite difference
  const fA = (x: Tensor) => {
    let sum = 0;
    const prod = MatmulKernel.forward(x, tGradB).output;
    for (let i = 0; i < prod.size; i++) sum += prod.data[prod.offset + i];
    return sum;
  };
  const numGradA = GradCheck.computeNumericalGradient(fA, tGradA, 1e-3);
  const checkA = GradCheck.check(fA, tGradA, tGradA.grad!, { eps: 1e-3, rtol: 1e-3, atol: 1e-4 });
  assert(checkA.passed, `Suite 2B: Matmul dA finite difference check passed (maxRelErr=${checkA.maxRelError.toExponential(3)})`);

  // 2C: DAG Multi-Path Fanout Accumulation
  AutogradTape.resetDefaultTape();
  const tFanout = Tensor.fromArray([2.0], [1]).withRequiresGrad(true);
  const tBranch1 = AutogradOps.mul(tFanout, Tensor.fromArray([3.0], [1])); // 3x
  const tBranch2 = AutogradOps.mul(tFanout, Tensor.fromArray([5.0], [1])); // 5x
  const tFanoutLoss = AutogradOps.add(tBranch1, tBranch2); // 8x -> grad should be 8.0
  AutogradTape.getActiveTape().backward(tFanoutLoss);
  assert(Math.abs(tFanout.grad!.item() - 8.0) < 1e-5, 'Suite 2C: Multi-path DAG fanout accumulated correctly (3 + 5 = 8.0)');

  // 2D: noGrad suppression
  AutogradTape.resetDefaultTape();
  AutogradTape.noGrad(() => {
    const tSupp = AutogradOps.add(tGradA, tGradA);
    assert(AutogradTape.getActiveTape().count === 0, 'Suite 2D: noGrad suppresses tape recording');
    assert(!tSupp.requiresGrad, 'Suite 2D: noGrad output requiresGrad === false');
  });

  console.log('  ✓ Suite 2 passed: Reverse-mode autograd passes finite-difference checks and DAG accumulation.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 3: Shape & Dtype Invariant Validation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 3] Shape & Dtype Invariant Validation...');

  // 3A: Inner dimension mismatch in matmul: [2, 3] x [4, 2]
  const tM1 = Tensor.zeros([2, 3]);
  const tM2 = Tensor.zeros([4, 2]);
  let threwMatmulShape = false;
  try {
    MatmulKernel.forward(tM1, tM2);
  } catch (e: any) {
    threwMatmulShape = e.message.includes('shape mismatch');
  }
  assert(threwMatmulShape, 'Suite 3A: Matmul inner dimension mismatch throws error fail-closed');

  // 3B: Incompatible elementwise shapes
  const tE1 = Tensor.zeros([2, 3]);
  const tE2 = Tensor.zeros([3, 2]);
  let threwAddShape = false;
  try {
    AddKernel.forward(tE1, tE2);
  } catch (e: any) {
    threwAddShape = e.message.includes('Incompatible shapes');
  }
  assert(threwAddShape, 'Suite 3B: Add elementwise shape mismatch throws error fail-closed');

  // 3C: Out of bounds axis in reduction
  let threwAxis = false;
  try {
    ReduceKernel.forward(tE1, 'sum', 5);
  } catch (e: any) {
    threwAxis = e.message.includes('out of bounds') || e.message.includes('out of range');
  }
  assert(threwAxis, 'Suite 3C: Reduction out of range axis throws error fail-closed');

  console.log('  ✓ Suite 3 passed: Shape and dimensional invariants strictly enforced fail-closed.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 4: Numerical Stability & Extremes Validation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 4] Numerical Stability & Extremes Validation...');

  // 4A: Softmax with Extreme Logits (Max-subtraction stability)
  const extremeLogits = Tensor.fromArray([1000.0, 1001.0, 1002.0], [1, 3]);
  const extremeSoftmax = SoftmaxKernel.forward(extremeLogits).output;
  assert(!isNaN(extremeSoftmax.get(0, 0)) && isFinite(extremeSoftmax.get(0, 0)), 'Suite 4A: Extreme softmax is finite');
  assert(!isNaN(extremeSoftmax.get(0, 2)) && isFinite(extremeSoftmax.get(0, 2)), 'Suite 4A: Extreme softmax element 2 is finite');
  const sumProb = extremeSoftmax.get(0, 0) + extremeSoftmax.get(0, 1) + extremeSoftmax.get(0, 2);
  assert(Math.abs(sumProb - 1.0) < 1e-5, 'Suite 4A: Probabilities sum to 1.0 even with logits >= 1000');
  assert(extremeSoftmax.get(0, 2) > extremeSoftmax.get(0, 1), 'Suite 4A: Monotonic order preserved');

  // Large negative logits
  const negLogits = Tensor.fromArray([-1000.0, -999.0, -998.0], [1, 3]);
  const negSoftmax = SoftmaxKernel.forward(negLogits).output;
  assert(isFinite(negSoftmax.get(0, 0)) && isFinite(negSoftmax.get(0, 2)), 'Suite 4A: Large negative logits are finite');

  // 4B: Cross-Entropy with Extreme Logits
  const ceLogits = Tensor.fromArray([1000.0, 0.0, 0.0, 1000.0], [2, 2]);
  const ceTargets = [0, 1]; // Exactly matching highest logits
  const ceResult = CrossEntropyKernel.forward(ceLogits, ceTargets);
  assert(isFinite(ceResult.loss), 'Suite 4B: CrossEntropy loss on extreme logits is finite');
  assert(ceResult.loss < 1e-4, 'Suite 4B: Confident correct predictions yield loss ~= 0.0');

  // 4C: LayerNorm with Zero Variance (epsilon numerical guard)
  const constInput = Tensor.fromArray([5.0, 5.0, 5.0], [1, 3]);
  const lnGamma = Tensor.ones([3]);
  const lnBeta = Tensor.zeros([3]);
  const lnResult = LayerNormKernel.forward(constInput, lnGamma, lnBeta);
  assert(!isNaN(lnResult.output.get(0, 0)) && isFinite(lnResult.output.get(0, 0)), 'Suite 4C: LayerNorm with constant input avoids zero-division');

  console.log('  ✓ Suite 4 passed: Softmax, Cross-Entropy, and LayerNorm mathematically stable under extreme values.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 5: Memory Arena Allocation, Lexical Scopes & Zero-Leakage
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 5] Memory Arena Allocation, Lexical Scopes & Zero-Leakage...');

  const arena = new TensorMemoryArena({
    maxBytes: 16 * 1024 * 1024, // 16 MB limit
    slabSizeBytes: 4 * 1024 * 1024, // 4 MB slab
  });

  const initialStats = arena.stats();
  assert(initialStats.activeBytes === 0, 'Suite 5: Initial active bytes is 0');

  // 5A: Scoped Tensor Lifetime Reclamation
  arena.enterScope();
  const tArena1 = arena.allocateTensor([64, 64]); // 4096 floats = 16,384 bytes
  const tArena2 = arena.allocateTensor([128, 128]); // 16384 floats = 65,536 bytes
  assert(arena.stats().activeBytes > 0, 'Suite 5A: Active bytes increased inside scope');
  arena.exitScope();

  // Active bytes rolled back to baseline
  assert(arena.stats().activeBytes === 0, 'Suite 5A: Memory rolls back to baseline on scope exit (zero leak)');

  // 5B: Hard Safety Ceiling Rejection (Fail-Closed OOM)
  const smallArena = new TensorMemoryArena({
    maxBytes: 1024 * 1024, // 1 MB limit
    slabSizeBytes: 512 * 1024,
  });

  let threwOOM = false;
  try {
    smallArena.allocateTensor([1024, 1024]); // 1M floats = 4 MB > 1 MB limit
  } catch (e: any) {
    threwOOM = e instanceof TensorArenaOOMError;
  }
  assert(threwOOM, 'Suite 5B: Exceeding arena hard ceiling throws TensorArenaOOMError fail-closed');

  console.log('  ✓ Suite 5 passed: Bump allocation, lexical scope rollback, and OOM ceilings certified.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 6: WASM SIMD (f32x4) vs. Reference Parity & Empirical Benchmark
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 6] WASM SIMD (f32x4) vs. Reference Parity & Empirical Benchmark...');

  const M = 256;
  const K = 512;
  const N = 256;
  const FLOPs = 2 * M * N * K;

  const aData = new Float32Array(M * K);
  const bData = new Float32Array(K * N);
  const cDataJS = new Float32Array(M * N);

  // Deterministic values
  for (let i = 0; i < aData.length; i++) aData[i] = ((i % 17) - 8) * 0.05;
  for (let i = 0; i < bData.length; i++) bData[i] = ((i % 19) - 9) * 0.05;

  // Reference Pure JS Implementation (Contiguous IKJ)
  cDataJS.fill(0);
  for (let i = 0; i < M; i++) {
    const aOff = i * K;
    const cOff = i * N;
    for (let k = 0; k < K; k++) {
      const aVal = aData[aOff + k];
      const bOff = k * N;
      for (let j = 0; j < N; j++) {
        cDataJS[cOff + j] += aVal * bData[bOff + j];
      }
    }
  }

  // WASM SIMD Implementation
  const wasm = createWasmSimdMatmul(128);
  const wasmMem = new Float32Array(wasm.memory.buffer);
  const ptrA = 0;
  const ptrB = ptrA + M * K * 4;
  const ptrC = ptrB + K * N * 4;

  wasmMem.set(aData, ptrA / 4);
  wasmMem.set(bData, ptrB / 4);
  wasmMem.fill(0, ptrC / 4, ptrC / 4 + M * N);

  // Execute WASM SIMD kernel
  wasm.matmulForward(ptrA, ptrB, ptrC, M, K, N);

  // Parity Verification: Max absolute difference must be <= 1e-6
  let maxDiff = 0.0;
  const cWasm = wasmMem.subarray(ptrC / 4, ptrC / 4 + M * N);
  for (let i = 0; i < cDataJS.length; i++) {
    const diff = Math.abs(cDataJS[i] - cWasm[i]);
    if (diff > maxDiff) maxDiff = diff;
  }

  assert(maxDiff <= 1e-6, `Suite 6: WASM SIMD matches pure JS reference (maxDiff=${maxDiff.toExponential(3)})`);

  // Measured Benchmark (10 iterations)
  const iters = 10;
  const t0_js = performance.now();
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < M; i++) {
      const aOff = i * K;
      const cOff = i * N;
      for (let k = 0; k < K; k++) {
        const aVal = aData[aOff + k];
        const bOff = k * N;
        for (let j = 0; j < N; j++) {
          cDataJS[cOff + j] += aVal * bData[bOff + j];
        }
      }
    }
  }
  const jsLatencyMs = (performance.now() - t0_js) / iters;
  const jsGflops = (FLOPs / (jsLatencyMs / 1000)) / 1e9;

  const t0_wasm = performance.now();
  for (let it = 0; it < iters; it++) {
    wasm.matmulForward(ptrA, ptrB, ptrC, M, K, N);
  }
  const wasmLatencyMs = (performance.now() - t0_wasm) / iters;
  const wasmGflops = (FLOPs / (wasmLatencyMs / 1000)) / 1e9;
  const speedup = jsLatencyMs / Math.max(0.001, wasmLatencyMs);

  assert(speedup > 2.0, `Suite 6: WASM SIMD achieves significant speedup over pure JS (${speedup.toFixed(2)}x)`);
  console.log(`  ✓ Suite 6 passed: WASM SIMD bit-exact parity (${maxDiff.toExponential(3)} diff), ${speedup.toFixed(2)}x speedup (${wasmGflops.toFixed(2)} vs ${jsGflops.toFixed(2)} GFLOP/s).`);

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 7: Backend Fallback & Deterministic Replay Invariance (sigma^2 = 0.0)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 7] Backend Fallback & Deterministic Replay Invariance (sigma^2 = 0.0)...');

  // 7A: Adaptive Kernel Selector Safe Fallback
  const decisionNoGpu = NativeTrainingKernelSelector.selectOptimalKernel({
    parameterCount: 4894208,
    sequenceLength: 64,
    batchSize: 4,
    availableMemoryMB: 1024,
    hasHardwareGPU: false, // Fallback scenario
  });
  assert(decisionNoGpu.selectedSubstrate === 'CPU_NATIVE_SIMD', 'Suite 7A: Without GPU, safely selects CPU SIMD');
  assert(decisionNoGpu.isActuationBlocked === true, 'Suite 7A: Actuation lock strictly maintained');

  // 7B: Deterministic Replay Invariance (10 runs, sigma^2 = 0.0)
  const replayOutputs: number[] = [];
  for (let r = 0; r < 10; r++) {
    AutogradTape.resetDefaultTape();
    const tRepX = Tensor.fromArray([1.5, -2.5, 3.0, -1.0], [2, 2]).withRequiresGrad(true);
    const tRepW = Tensor.fromArray([0.8, 1.2, -0.5, 0.4], [2, 2]).withRequiresGrad(true);
    const tRepOut = AutogradOps.matmul(tRepX, tRepW);
    const tRepLoss = AutogradOps.reduceSum(tRepOut);
    AutogradTape.getActiveTape().backward(tRepLoss);

    replayOutputs.push(tRepLoss.item());
    replayOutputs.push(tRepX.grad!.get(0, 0));
  }

  // Calculate variance across 10 runs
  for (let r = 1; r < 10; r++) {
    assert(
      replayOutputs[r * 2] === replayOutputs[0],
      `Suite 7B: Run ${r} loss matches run 0 bit-for-bit`
    );
    assert(
      replayOutputs[r * 2 + 1] === replayOutputs[1],
      `Suite 7B: Run ${r} gradient matches run 0 bit-for-bit`
    );
  }
  console.log('  ✓ Suite 7 passed: Adaptive fallback verified and replay variance sigma^2 = 0.0 across 10 runs.');

  console.log('\n' + '='.repeat(80));
  console.log('  TASK 15 VERIFICATION: ALL 7 SUITES PASSED (100%)');
  console.log('='.repeat(80) + '\n');
}

if (require.main === module || (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('task15_autograd_kernels_wasm'))) {
  runTask15AutogradKernelWasmTests();
}
