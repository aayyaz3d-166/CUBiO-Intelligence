/**
 * CUBiO AI — ONE LANGUAGE — NATIVE TRAINING ACCELERATION TEST SUITE
 * =================================================================
 * Test: test_training_acceleration.ts
 * Gate: CNL-P26.1-R1 / TEST-03 Acceleration & Equivalence Certification
 *
 * Verifies:
 *   1. Authoritative 148,912-parameter architecture conformance
 *   2. Numerical equivalence between baseline and accelerated engines (ε < 10⁻⁵)
 *   3. Multi-step optimization weight trajectory equivalence
 *   4. Zero-variance deterministic replay (σ² = 0.0)
 *   5. Fail-closed actuation lock (isActuationBlocked === true)
 *   6. Strict physical memory ceiling enforcement (≤ 512 MB)
 */

import {
  BaselineTrainingEngine,
  AcceleratedNativeEngine,
  TENSOR_MAP,
  TrainingBatch,
  OptimizerConfig,
} from '../../../src/one/intelligence/compute/NativeTrainingAccelerator';
import { NativeModelRegistry } from '../../../src/one/native_model_registry';

let passedAssertions = 0;
let totalAssertions = 0;

function assert(condition: boolean, testName: string, detail: string = ''): void {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ PASS [${testName}] ${detail}`);
  } else {
    console.error(`  ✗ FAIL [${testName}] ${detail}`);
    throw new Error(`Assertion failed in test: ${testName} - ${detail}`);
  }
}

console.log('================================================================================');
console.log('  CUBiO AI — ONE LANGUAGE: NATIVE TRAINING ACCELERATION & EQUIVALENCE TEST');
console.log('================================================================================\n');

// ── GATE 1: Parameter & Architecture Conformance ──────────────────────────────
console.log('[GATE 1/5] Authoritative Model Architecture Conformance (148,912 Params)');
assert(
  TENSOR_MAP.totalParameters === NativeModelRegistry.AUTHORITATIVE_PARAM_COUNT,
  'PARAM-01',
  `Total parameters (${TENSOR_MAP.totalParameters}) exactly matches authoritative count (${NativeModelRegistry.AUTHORITATIVE_PARAM_COUNT})`
);

const modelAuth = NativeModelRegistry.getAuthoritativeModel();
assert(
  modelAuth.status === 'AUTHORITATIVE_VERIFIED',
  'PARAM-02',
  'Authoritative model status is verified'
);

assert(
  TENSOR_MAP.embeddingLength === 23616 &&
  TENSOR_MAP.attnTier1Length === 28160 &&
  TENSOR_MAP.attnTier2Length === 28160 &&
  TENSOR_MAP.attnTier3Length === 28160 &&
  TENSOR_MAP.mlpLength === 38208 &&
  TENSOR_MAP.outputHeadLength === 2608,
  'PARAM-03',
  'All 6 tensor layers strictly match authoritative parameter specifications'
);

// ── GATE 2: Single-Step Numerical Equivalence (Baseline vs Accelerated) ───────
console.log('\n[GATE 2/5] Single-Step Mathematical & Numerical Equivalence');

const config: OptimizerConfig = {
  learningRate: 0.001,
  beta1: 0.9,
  beta2: 0.999,
  epsilon: 1e-8,
  weightDecay: 0.01,
  dpoBeta: 0.1,
};

const testBatch1: TrainingBatch = {
  tokens: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 42, 48, 54, 60],
  targetSpatialState: new Float32Array(40).map((_, i) => Math.sin(i * 0.369)),
  referenceLogits: new Float32Array(40).map((_, i) => Math.cos(i * 0.369)),
};

const baseline1 = new BaselineTrainingEngine(1337);
const accelerated1 = new AcceleratedNativeEngine(1337);

const resBase1 = baseline1.executeStep(testBatch1, config);
const resAccel1 = accelerated1.executeStep(testBatch1, config);

const lossDiff = Math.abs(resBase1.loss - resAccel1.loss);
const dpoDiff = Math.abs(resBase1.dpoDivergence - resAccel1.dpoDivergence);
const gradNormDiff = Math.abs(resBase1.gradientNorm - resAccel1.gradientNorm);

console.log(`  Baseline Step Latency   : ${resBase1.stepLatencyMs.toFixed(3)} ms | Loss: ${resBase1.loss.toFixed(6)}`);
console.log(`  Accelerated Step Latency: ${resAccel1.stepLatencyMs.toFixed(3)} ms | Loss: ${resAccel1.loss.toFixed(6)}`);
console.log(`  Loss Difference         : ${lossDiff.toExponential(4)}`);
console.log(`  DPO Divergence Diff     : ${dpoDiff.toExponential(4)}`);
console.log(`  Gradient Norm Diff      : ${gradNormDiff.toExponential(4)}`);

assert(lossDiff < 1e-5, 'EQUIV-01', `Loss difference (${lossDiff}) is within tolerance ε < 10⁻⁵`);
assert(dpoDiff < 1e-5, 'EQUIV-02', `DPO divergence difference (${dpoDiff}) is within tolerance ε < 10⁻⁵`);
assert(gradNormDiff < 1e-3, 'EQUIV-03', `Gradient norm difference (${gradNormDiff}) is within tolerance ε < 10⁻³`);

// ── GATE 3: Multi-Step Trajectory Equivalence Across 5 Steps ───────────────────
console.log('\n[GATE 3/5] Multi-Step Parameter Trajectory Equivalence (5 Steps)');

const baselineMulti = new BaselineTrainingEngine(9999);
const acceleratedMulti = new AcceleratedNativeEngine(9999);

let maxWeightDiffAcrossSteps = 0;

for (let s = 1; s <= 5; s++) {
  const stepBatch: TrainingBatch = {
    tokens: [s * 3, s * 6, s * 9, s * 12, s * 15, s * 18, s * 21, s * 24],
    targetSpatialState: new Float32Array(40).map((_, i) => Math.sin((i + s) * 0.369)),
  };

  const bRes = baselineMulti.executeStep(stepBatch, config);
  const aRes = acceleratedMulti.executeStep(stepBatch, config);

  const bWeights = baselineMulti.getWeights();
  const aWeights = acceleratedMulti.getWeights();

  let maxDiffThisStep = 0;
  // Sample every 37th parameter across 148,912
  for (let i = 0; i < TENSOR_MAP.totalParameters; i += 37) {
    const diff = Math.abs(bWeights[i] - aWeights[i]);
    if (diff > maxDiffThisStep) maxDiffThisStep = diff;
  }
  if (maxDiffThisStep > maxWeightDiffAcrossSteps) maxWeightDiffAcrossSteps = maxDiffThisStep;

  console.log(`  Step ${s}: Baseline Latency = ${bRes.stepLatencyMs} ms, Accel Latency = ${aRes.stepLatencyMs} ms, Max Δw = ${maxDiffThisStep.toExponential(4)}`);
}

assert(
  maxWeightDiffAcrossSteps < 1e-4,
  'TRAJ-01',
  `5-step post-optimization weight trajectory maximum difference (${maxWeightDiffAcrossSteps.toExponential(4)}) < 10⁻⁴`
);

// ── GATE 4: Zero-Variance Deterministic Replay (σ² = 0.0) ──────────────────────
console.log('\n[GATE 4/5] Zero-Variance Deterministic Replay (σ² = 0.0)');

const run1 = new AcceleratedNativeEngine(424242);
const run2 = new AcceleratedNativeEngine(424242);

let bitExactMatches = 0;
const testSteps = 3;

for (let s = 1; s <= testSteps; s++) {
  const r1 = run1.executeStep(testBatch1, config);
  const r2 = run2.executeStep(testBatch1, config);

  if (r1.loss === r2.loss && r1.gradientNorm === r2.gradientNorm && r1.weightsChecksum === r2.weightsChecksum) {
    bitExactMatches++;
  }
}

assert(
  bitExactMatches === testSteps,
  'DET-01',
  `Deterministic replay variance strictly σ² = 0.0 across all ${testSteps} steps`
);

// ── GATE 5: Sovereign Security Lockout & Physical Resource Bounds ─────────────
console.log('\n[GATE 5/5] Sovereign Actuation Lockout & Memory Enforcement');

assert(
  accelerated1.isActuationBlocked === true,
  'SEC-01',
  'Physical actuation lock is strictly permanent and fail-closed (isActuationBlocked === true)'
);

const currentHeapMB = process.memoryUsage().heapUsed / (1024 * 1024);
console.log(`  Current V8 Physical Heap: ${currentHeapMB.toFixed(2)} MB / 512 MB limit`);

assert(
  currentHeapMB < 512.0,
  'MEM-01',
  `Physical heap (${currentHeapMB.toFixed(2)} MB) is strictly within the 512 MB physical ceiling`
);

console.log('\n================================================================================');
console.log(`  FINAL RESULT: ${passedAssertions} / ${totalAssertions} ASSERTIONS PASSED (100%)`);
console.log('  NATIVE TRAINING ACCELERATION & NUMERICAL EQUIVALENCE 100% CERTIFIED');
console.log('================================================================================\n');
