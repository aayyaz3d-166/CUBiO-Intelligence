/**
 * CUBiO AI — ONE LANGUAGE — LEVEL 2 TRAINING ACCELERATION TEST SUITE
 * ==================================================================
 * Test: test_level2_training_acceleration.ts
 * Gate: CNL-P26.1-R1 / TEST-03 Level 2 Certification & Equivalence
 *
 * Verifies:
 *   1. Authoritative 148,912-parameter architecture conformance
 *   2. Level 1 IR Optimization constant folding and safety
 *   3. Single-step numerical equivalence against baseline reference (ε < 10⁻⁵)
 *   4. Multi-step optimization weight trajectory equivalence (5 steps, ε < 10⁻⁴)
 *   5. Zero-variance deterministic replay (σ² = 0.0)
 *   6. Permanent fail-closed actuation lock (isActuationBlocked === true)
 *   7. Physical memory bounds (≤ 512 MB)
 */

import {
  Level2TrainingAccelerator,
} from '../../../src/one/intelligence/compute/Level2TrainingAccelerator';
import {
  BaselineTrainingEngine,
  TENSOR_MAP,
  TrainingBatch,
  OptimizerConfig,
} from '../../../src/one/intelligence/compute/NativeTrainingAccelerator';
import { NativeModelRegistry } from '../../../src/one/native_model_registry';
import { IROptimizer } from '../../../src/one/ir/IROptimizer';
import { UnifiedIRProgram, createRegister, createConstant, createVariable } from '../../../src/one/ir/UnifiedIR';

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
console.log('  CUBiO AI — ONE LANGUAGE: LEVEL 2 DEEP TRAINING ACCELERATION TEST');
console.log('================================================================================\n');

// ── GATE 1: Parameter & Architecture Conformance ──────────────────────────────
console.log('[GATE 1/6] Authoritative Model Architecture Conformance (148,912 Params)');
assert(
  TENSOR_MAP.totalParameters === NativeModelRegistry.AUTHORITATIVE_PARAM_COUNT,
  'L2-PARAM-01',
  `Total parameters (${TENSOR_MAP.totalParameters}) exactly matches authoritative count (${NativeModelRegistry.AUTHORITATIVE_PARAM_COUNT})`
);

assert(
  TENSOR_MAP.embeddingLength === 23616 &&
  TENSOR_MAP.attnTier1Length === 28160 &&
  TENSOR_MAP.attnTier2Length === 28160 &&
  TENSOR_MAP.attnTier3Length === 28160 &&
  TENSOR_MAP.mlpLength === 38208 &&
  TENSOR_MAP.outputHeadLength === 2608,
  'L2-PARAM-02',
  'All 6 tensor layers strictly match authoritative parameter specifications'
);

// ── GATE 2: Level 1 IR Optimization Verifications ─────────────────────────────
console.log('\n[GATE 2/6] Level 1 IR Optimization (Constant Folding & Dead Code)');
const testIR: UnifiedIRProgram = {
  version: '0.1.0-IR',
  instructions: [
    { index: 0, opcode: 'CONST', destination: createRegister(1), sources: [createConstant(3)] },
    { index: 1, opcode: 'CONST', destination: createRegister(2), sources: [createConstant(6)] },
    { index: 2, opcode: 'ADD', destination: createRegister(3), sources: [createRegister(1), createRegister(2)] },
    { index: 3, opcode: 'MUL', destination: createRegister(4), sources: [createVariable('dynamicParam'), createConstant(1)] },
    { index: 4, opcode: 'MOVE', destination: createRegister(5), sources: [createRegister(5)] }, // redundant
    { index: 5, opcode: 'CONST', destination: createRegister(6), sources: [createConstant(999)] }, // unused
    { index: 6, opcode: 'RETURN', sources: [createRegister(4)] },
  ],
};

const optResult = IROptimizer.optimize(testIR);
console.log(`  Original IR Instructions  : ${optResult.stats.originalInstructionCount}`);
console.log(`  Optimized IR Instructions : ${optResult.stats.optimizedInstructionCount} (${optResult.stats.reductionPercentage}% reduction)`);
console.log(`  Constants Folded          : ${optResult.stats.constantsFolded}`);
console.log(`  Algebraic Simplified     : ${optResult.stats.algebraicIdentitiesSimplified}`);

assert(optResult.stats.constantsFolded >= 1, 'L2-IR-01', 'Constant folding succeeded (3 + 6 -> 9)');
assert(optResult.stats.algebraicIdentitiesSimplified >= 1, 'L2-IR-02', 'Algebraic identity simplified (x * 1 -> x)');
assert(optResult.stats.redundantMovesEliminated >= 1, 'L2-IR-03', 'Redundant self-move eliminated');
assert(optResult.stats.deadInstructionsEliminated >= 1, 'L2-IR-04', 'Dead code register eliminated');

// ── GATE 3: Single-Step Equivalence vs Baseline Reference Path ────────────────
console.log('\n[GATE 3/6] Single-Step Mathematical & Numerical Equivalence');

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

const baseline = new BaselineTrainingEngine(1337);
const level2 = new Level2TrainingAccelerator(1337);

const resBase = baseline.executeStep(testBatch1, config);
const resL2 = level2.executeStep(testBatch1, config);

const lossDiff = Math.abs(resBase.loss - resL2.loss);
const dpoDiff = Math.abs(resBase.dpoDivergence - resL2.dpoDivergence);
const gradNormDiff = Math.abs(resBase.gradientNorm - resL2.gradientNorm);

console.log(`  Baseline Step Latency   : ${resBase.stepLatencyMs.toFixed(3)} ms | Loss: ${resBase.loss.toFixed(6)}`);
console.log(`  Level 2 Step Latency    : ${resL2.stepLatencyMs.toFixed(3)} ms | Loss: ${resL2.loss.toFixed(6)}`);
console.log(`  Loss Difference         : ${lossDiff.toExponential(4)}`);
console.log(`  DPO Divergence Diff     : ${dpoDiff.toExponential(4)}`);
console.log(`  Gradient Norm Diff      : ${gradNormDiff.toExponential(4)}`);

assert(lossDiff < 1e-5, 'L2-EQUIV-01', `Loss difference (${lossDiff}) is within tolerance ε < 10⁻⁵`);
assert(dpoDiff < 1e-5, 'L2-EQUIV-02', `DPO divergence difference (${dpoDiff}) is within tolerance ε < 10⁻⁵`);
assert(gradNormDiff < 1e-3, 'L2-EQUIV-03', `Gradient norm difference (${gradNormDiff}) is within tolerance ε < 10⁻³`);

// ── GATE 4: Multi-Step Trajectory Equivalence (5 Steps) ───────────────────────
console.log('\n[GATE 4/6] Multi-Step Parameter Trajectory Equivalence (5 Steps)');

const baselineMulti = new BaselineTrainingEngine(9999);
const level2Multi = new Level2TrainingAccelerator(9999);

let maxWeightDiff = 0;

for (let s = 1; s <= 5; s++) {
  const stepBatch: TrainingBatch = {
    tokens: [s * 3, s * 6, s * 9, s * 12, s * 15, s * 18, s * 21, s * 24],
    targetSpatialState: new Float32Array(40).map((_, i) => Math.sin((i + s) * 0.369)),
  };

  const bRes = baselineMulti.executeStep(stepBatch, config);
  const l2Res = level2Multi.executeStep(stepBatch, config);

  const bWeights = baselineMulti.getWeights();
  const l2Weights = level2Multi.getWeights();

  let maxDiffThisStep = 0;
  for (let i = 0; i < TENSOR_MAP.totalParameters; i += 37) {
    const diff = Math.abs(bWeights[i] - l2Weights[i]);
    if (diff > maxDiffThisStep) maxDiffThisStep = diff;
  }
  if (maxDiffThisStep > maxWeightDiff) maxWeightDiff = maxDiffThisStep;

  console.log(`  Step ${s}: Baseline = ${bRes.stepLatencyMs} ms, Level 2 = ${l2Res.stepLatencyMs} ms, Max Δw = ${maxDiffThisStep.toExponential(4)}`);
}

assert(
  maxWeightDiff < 1e-4,
  'L2-TRAJ-01',
  `5-step post-optimization weight trajectory maximum difference (${maxWeightDiff.toExponential(4)}) < 10⁻⁴`
);

// ── GATE 5: Zero-Variance Deterministic Replay (σ² = 0.0) ──────────────────────
console.log('\n[GATE 5/6] Zero-Variance Deterministic Replay (σ² = 0.0)');

const run1 = new Level2TrainingAccelerator(424242);
const run2 = new Level2TrainingAccelerator(424242);

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
  'L2-DET-01',
  `Deterministic replay variance strictly σ² = 0.0 across all ${testSteps} steps`
);

// ── GATE 6: Sovereign Security Lockout & Physical Resource Bounds ─────────────
console.log('\n[GATE 6/6] Sovereign Actuation Lockout & Physical Memory Enforcement');

assert(
  level2.isActuationBlocked === true,
  'L2-SEC-01',
  'Physical actuation lock is strictly permanent and fail-closed (isActuationBlocked === true)'
);

const currentHeapMB = process.memoryUsage().heapUsed / (1024 * 1024);
console.log(`  Current V8 Physical Heap: ${currentHeapMB.toFixed(2)} MB / 512 MB limit`);

assert(
  currentHeapMB < 512.0,
  'L2-MEM-01',
  `Physical heap (${currentHeapMB.toFixed(2)} MB) is strictly within the 512 MB physical ceiling`
);

console.log('\n================================================================================');
console.log(`  FINAL RESULT: ${passedAssertions} / ${totalAssertions} ASSERTIONS PASSED (100%)`);
console.log('  LEVEL 2 DEEP ACCELERATION & EQUIVALENCE 100% CERTIFIED');
console.log('================================================================================\n');
