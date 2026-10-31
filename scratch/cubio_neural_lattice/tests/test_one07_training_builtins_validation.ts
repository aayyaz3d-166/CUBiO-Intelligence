/**
 * CUBiO AI — ONE LANGUAGE — TASK ONE-07 MASTER TEST SUITE
 * ==========================================================
 * Verification Suite: Training Builtins + 5M Reference Validation
 * Module: @one/training & @one/tensor
 * Gate: ONE-07 / Training Primitives & CUBiO 5M Model Validation
 */

import { Tensor } from '../../../src/one/tensor/Tensor';
import { TensorMemoryArena } from '../../../src/one/tensor/TensorArena';
import { AutogradTape } from '../../../src/one/tensor/autograd/AutogradTape';
import {
  AdamWOptimizer,
  clipGradNorm,
  LinearWarmupCosineDecayScheduler,
  ConstantLRScheduler,
  StepLRScheduler,
  CrossEntropyLoss,
  Authoritative5MCheckpoint,
  CUBIO_5M_CONFIG,
  CUBIO_5M_LAYER_OFFSETS,
  CUBiO5MReferenceEngine,
  CUBiO5MOneEngine,
  validateReferenceVsOne,
  OneTrainingEngine,
  cloneOptimizerState,
  computeMomentsChecksum,
} from '../../../src/one/training';
import { NativeModelRegistry } from '../../../src/one/native_model_registry';

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, message: string): void {
  totalAssertions++;
  if (!condition) {
    console.error(`  ✗ FAIL [ONE07-${String(totalAssertions).padStart(2, '0')}] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ PASS [ONE07-${String(totalAssertions).padStart(2, '0')}] ${message}`);
  passedAssertions++;
}

async function runTests(): Promise<void> {
  console.log('================================================================================');
  console.log('  ONE LANGUAGE — TASK ONE-07: TRAINING BUILTINS & 5M REFERENCE VALIDATION');
  console.log('  Subsystems: AdamW, ClipGrad, LRScheduler, OptimizerState, CrossEntropy, CUBiO 5M');
  console.log('================================================================================\n');

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 1: ADAMW OPTIMIZER CORE PRIMITIVES
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[GATE 1/8] Verifying AdamW Optimizer Core Primitives...');

  const paramA = new Tensor(new Float32Array([1.0, 2.0, 3.0, 4.0]), [4]);
  const paramB = new Tensor(new Float32Array([0.5, -0.5]), [2]);
  paramA.requiresGrad = true;
  paramB.requiresGrad = true;

  paramA.grad = new Tensor(new Float32Array([0.1, 0.2, -0.1, 0.0]), [4]);
  paramB.grad = new Tensor(new Float32Array([-0.05, 0.05]), [2]);

  const optimizer = new AdamWOptimizer([paramA, paramB], {
    lr: 0.01,
    beta1: 0.9,
    beta2: 0.999,
    eps: 1e-8,
    weightDecay: 0.01,
  });

  assert(optimizer.parameters.length === 2, 'AdamW tracks exactly 2 parameter tensors');
  assert(optimizer.m.get(paramA)?.length === 4, 'AdamW allocated first moment buffer for paramA');
  assert(optimizer.v.get(paramB)?.length === 2, 'AdamW allocated second moment buffer for paramB');

  // Execute step
  const initA0 = paramA.data[0];
  optimizer.step();
  assert(optimizer.stepCount === 1, 'Optimizer step count incremented to 1');
  assert(paramA.data[0] !== initA0, 'ParamA value updated following optimizer step');
  assert(optimizer.m.get(paramA)![0] > 0, 'First moment estimate updated with positive gradient');
  assert(optimizer.v.get(paramA)![0] > 0, 'Second moment estimate updated with positive squared gradient');

  // zeroGrad test
  optimizer.zeroGrad();
  assert(paramA.grad!.data[0] === 0 && paramA.grad!.data[1] === 0, 'zeroGrad successfully cleared gradient buffer to 0.0');
  optimizer.zeroGrad(true);
  assert(paramA.grad === null && paramB.grad === null, 'zeroGrad(setNone=true) successfully reset gradients to null');

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 2: GRADIENT NORM CLIPPING
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 2/8] Verifying Gradient Norm Clipping...');

  const clipP1 = new Tensor(new Float32Array([1.0, 2.0]), [2]);
  const clipP2 = new Tensor(new Float32Array([3.0, 4.0]), [2]);
  clipP1.grad = new Tensor(new Float32Array([3.0, 4.0]), [2]); // norm = 5.0
  clipP2.grad = new Tensor(new Float32Array([0.0, 0.0]), [2]);

  // Initial norm is sqrt(3^2 + 4^2) = 5.0
  const unclippedNorm = clipGradNorm([clipP1, clipP2], 2.5); // maxNorm = 2.5 (should scale by 0.5)
  assert(Math.abs(unclippedNorm - 5.0) < 1e-5, `Reported unclipped norm (${unclippedNorm.toFixed(4)}) matches 5.0`);
  assert(Math.abs(clipP1.grad.data[0] - 1.5) < 1e-4, 'Gradient element 0 scaled down by factor of 0.5 (3.0 -> 1.5)');
  assert(Math.abs(clipP1.grad.data[1] - 2.0) < 1e-4, 'Gradient element 1 scaled down by factor of 0.5 (4.0 -> 2.0)');

  // No-op when under threshold
  const postNorm = clipGradNorm([clipP1, clipP2], 10.0);
  assert(Math.abs(clipP1.grad.data[0] - 1.5) < 1e-4, 'Gradient unchanged when under threshold');
  assert(Math.abs(postNorm - 2.5) < 1e-4, 'Under-threshold norm accurately measured');

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 3: HARMONIC LEARNING-RATE SCHEDULER
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 3/8] Verifying Harmonic Learning-Rate Scheduler...');

  const scheduler = new LinearWarmupCosineDecayScheduler({
    baseLR: 0.001,
    minLR: 0.0001,
    warmupSteps: 10,
    totalSteps: 100,
  });

  // Step 0: minLR
  assert(Math.abs(scheduler.getLR(0) - 0.0001) < 1e-6, 'Step 0 starts at minLR (0.0001)');

  // Step 5: halfway through warmup (0.0001 + 0.5 * 0.0009 = 0.00055)
  assert(Math.abs(scheduler.getLR(5) - 0.00055) < 1e-6, 'Step 5 linear warmup reaches 0.00055');

  // Step 10: peak baseLR
  assert(Math.abs(scheduler.getLR(10) - 0.001) < 1e-6, 'Step 10 reaches peak baseLR (0.001)');

  // Step 55: halfway through cosine decay (progress = 45/90 = 0.5 -> cos(pi/2)=0 -> 0.0001 + 0.5*0.0009 = 0.00055)
  assert(Math.abs(scheduler.getLR(55) - 0.00055) < 1e-5, 'Step 55 cosine decay midpoint reaches 0.00055');

  // Step 100: final minLR
  assert(Math.abs(scheduler.getLR(100) - 0.0001) < 1e-6, 'Step 100 finishes at minLR (0.0001)');

  // Verify step() updates currentLR
  scheduler.setStep(0);
  const nextLR = scheduler.step();
  assert(scheduler.getStep() === 1 && Math.abs(nextLR - scheduler.getLR(1)) < 1e-12, 'scheduler.step() advances step and synchronizes currentLR');

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 4: OPTIMIZER STATE MANAGEMENT & SANDBOX CLONING
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 4/8] Verifying Optimizer State Management & Sandbox Cloning...');

  const stateDict = optimizer.stateDict();
  assert(stateDict.stepCount === 1, 'stateDict preserves stepCount');
  assert(stateDict.moments.length === 2, 'stateDict captures moments for all parameters');
  assert(stateDict.checksum !== 0, `Computed valid deterministic checksum: 0x${stateDict.checksum.toString(16)}`);

  // Deep clone optimizer state
  const clonedState = cloneOptimizerState(stateDict);
  assert(clonedState.checksum === stateDict.checksum, 'Cloned state checksum matches original');

  // Mutating clone does not mutate original
  clonedState.moments[0].m[0] = 999.999;
  assert(stateDict.moments[0].m[0] !== 999.999, 'Cloned moment buffer is completely isolated from original');

  // Restore state into new optimizer
  const freshOpt = new AdamWOptimizer([paramA, paramB]);
  freshOpt.loadStateDict(stateDict);
  assert(freshOpt.stepCount === 1, 'Restored optimizer recovered stepCount');
  assert(Math.abs(freshOpt.m.get(paramA)![0] - optimizer.m.get(paramA)![0]) < 1e-7, 'Restored first moment matches saved state');

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 5: CROSS-ENTROPY LOSS INTEGRATION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 5/8] Verifying Cross-Entropy Loss Integration...');

  const logits = new Tensor(
    new Float32Array([
      2.0, 1.0, 0.1,  // batch 0
      0.5, 3.0, 0.2,  // batch 1
    ]),
    [2, 3]
  );
  logits.requiresGrad = true;

  const targets = [0, 1]; // batch 0 target is class 0, batch 1 target is class 1
  const ceLoss = new CrossEntropyLoss();
  const lossTensor = ceLoss.forward(logits, targets);

  assert(lossTensor.shape[0] === 1, 'Cross-Entropy loss produces scalar [1] tensor');
  assert(lossTensor.item() > 0 && Number.isFinite(lossTensor.item()), `Valid cross-entropy loss computed: ${lossTensor.item().toFixed(4)}`);

  // Reverse-mode Autograd backward pass
  lossTensor.backward();
  assert(logits.grad !== null, 'Autograd backwards propagated gradient into logits.grad');
  const lGrad = logits.grad!;
  assert(lGrad.shape[0] === 2 && lGrad.shape[1] === 3, 'logits.grad has matching [2, 3] shape');

  // For target class, (prob - 1) / B < 0
  assert(lGrad.data[0] < 0, 'Target class 0 receives negative gradient driving logits higher');
  assert(lGrad.data[1] > 0, 'Non-target class 1 receives positive gradient driving logits lower');

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 6: CUBiO 5M MODEL ARCHITECTURE & READ-ONLY CHECKPOINT ANCHOR
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 6/8] Verifying CUBiO 5M Model Architecture & Read-Only Checkpoint Anchor...');

  assert(CUBIO_5M_CONFIG.totalParameters === 5000000, '5M Architecture configured with exactly 5,000,000 parameters');
  assert(CUBIO_5M_LAYER_OFFSETS.totalParameters === 5000000, '5M Layer offsets span full 5,000,000 parameters');

  const checkpoint5M = Authoritative5MCheckpoint.getInstance();
  const integrity = checkpoint5M.verifyIntegrity();
  assert(integrity.verified, 'Authoritative 5M Checkpoint passes cryptographic integrity verification');
  assert(integrity.totalParameters === 5000000, 'Checkpoint contains full 5,000,000 parameter buffer');

  // Sandbox isolation test
  let sandboxWeights: Float32Array | null = checkpoint5M.createSandboxWeights();
  assert(sandboxWeights.length === 5000000, 'Sandbox weights copy has 5,000,000 elements');

  // Mutate sandbox and verify authoritative checkpoint remains pristine
  const originalCheck = integrity.checksum;
  sandboxWeights[0] = 777.777;
  sandboxWeights[4999999] = -888.888;
  const postCheck = checkpoint5M.verifyIntegrity();
  assert(postCheck.checksum === originalCheck, 'Authoritative 5M Checkpoint is 100% UNTOUCHED by sandbox mutation');
  sandboxWeights = null;

  // Verify CUBiO Model V1 (148,912 parameters) is completely untouched
  const cubioV1 = NativeModelRegistry.getAuthoritativeModel();
  assert(cubioV1.totalParameters === 148912, 'CUBiO Model V1 remains locked at authoritative 148,912 parameters');
  assert(cubioV1.isActuationBlocked === true, 'CUBiO Model V1 fail-closed actuation lock intact');

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 7: CONTROLLED REFERENCE VS ONE 5M TRAINING VALIDATION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 7/8] Running Controlled Reference vs ONE 5M Training Validation...');

  const testTokens = [3, 9, 27, 81, 108, 144, 212, 305, 368];
  const testTargets = [42];

  const validation = validateReferenceVsOne(testTokens, testTargets, {
    lossTol: 1e-5,
    logitsTol: 1e-5,
    gradTol: 1e-5,
    paramUpdateTol: 1e-5,
    momentTol: 1e-5,
  });

  const { comparison, engineA, engineB } = validation;

  console.log(`     Loss Divergence            : ${comparison.lossDiff.toExponential(4)} (Tol <= 1e-5)`);
  console.log(`     Max Logits Divergence      : ${comparison.maxLogitsDiff.toExponential(4)} (Tol <= 1e-5)`);
  console.log(`     Mean Logits Divergence     : ${comparison.meanLogitsDiff.toExponential(4)}`);
  console.log(`     Max Gradient Divergence    : ${comparison.maxGradDiff.toExponential(4)} (Tol <= 1e-5)`);
  console.log(`     Mean Gradient Divergence   : ${comparison.meanGradDiff.toExponential(4)}`);
  console.log(`     Max Param Update Divergence: ${comparison.maxParamUpdateDiff.toExponential(4)} (Tol <= 1e-5)`);
  console.log(`     Mean Param Update Diff     : ${comparison.meanParamUpdateDiff.toExponential(4)}`);
  console.log(`     Max Moment M Divergence    : ${comparison.maxMomentMDiff.toExponential(4)} (Tol <= 1e-5)`);
  console.log(`     Max Moment V Divergence    : ${comparison.maxMomentVDiff.toExponential(4)} (Tol <= 1e-5)`);
  console.log(`     Step & LR Synchronization  : Step Match=${comparison.stepsMatch}, LR Match=${comparison.lrMatch}`);

  assert(comparison.lossDiff <= 1e-5, `Loss divergence (${comparison.lossDiff.toExponential(4)}) <= 1e-5`);
  assert(comparison.maxLogitsDiff <= 1e-5, `Logits divergence (${comparison.maxLogitsDiff.toExponential(4)}) <= 1e-5`);
  assert(comparison.maxGradDiff <= 1e-5, `Gradient divergence (${comparison.maxGradDiff.toExponential(4)}) <= 1e-5`);
  assert(comparison.maxParamUpdateDiff <= 1e-5, `Parameter update divergence (${comparison.maxParamUpdateDiff.toExponential(4)}) <= 1e-5`);
  assert(comparison.maxMomentMDiff <= 1e-5, `AdamW First Moment divergence (${comparison.maxMomentMDiff.toExponential(4)}) <= 1e-5`);
  assert(comparison.maxMomentVDiff <= 1e-5, `AdamW Second Moment divergence (${comparison.maxMomentVDiff.toExponential(4)}) <= 1e-5`);
  assert(comparison.stepsMatch, 'Step count matches between Reference and ONE engines');
  assert(comparison.lrMatch, 'Learning rate matches between Reference and ONE engines');
  assert(comparison.allTolerancesPassed, 'All explicit numerical tolerances strictly satisfied');

  // Multi-step (3-step) Trajectory Equivalence
  console.log('\n     Verifying 3-Step Trajectory Equivalence on 5M Model...');
  let maxTrajectoryLossDiff = 0.0;
  for (let s = 1; s <= 3; s++) {
    const stepTokens = testTokens.map((t) => (t + s * 7) % 369);
    const stepTargets = [(testTargets[0] + s * 13) % 369];
    const outA = engineA.executeStep(stepTokens, stepTargets, 0.001);
    const outB = engineB.executeStep(stepTokens, stepTargets, 0.001);
    const dLoss = Math.abs(outA.loss - outB.loss);
    if (dLoss > maxTrajectoryLossDiff) maxTrajectoryLossDiff = dLoss;
  }
  assert(maxTrajectoryLossDiff <= 1e-5, `3-step trajectory loss divergence (${maxTrajectoryLossDiff.toExponential(4)}) <= 1e-5`);

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 8: PHYSICAL MEMORY BOUNDS & SOVEREIGN ACTUATION LOCK
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 8/8] Verifying Memory Bounds & Sovereign Actuation Lock...');

  if (typeof (global as any).gc === 'function') {
    (global as any).gc();
  }

  const mem = process.memoryUsage();
  const rssMB = mem.rss / (1024 * 1024);
  const heapUsedMB = mem.heapUsed / (1024 * 1024);
  console.log(`     System RSS Memory          : ${rssMB.toFixed(2)} MB / 768.00 MB ceiling`);
  console.log(`     V8 Heap Used               : ${heapUsedMB.toFixed(2)} MB / 256.00 MB ceiling`);
  assert(heapUsedMB <= 256.0, `V8 Heap (${heapUsedMB.toFixed(2)} MB) safely below 256 MB ceiling`);
  assert(rssMB <= 768.0, `Physical memory (${rssMB.toFixed(2)} MB) safely below 768 MB ceiling`);

  assert(engineA.isActuationBlocked === true, 'Reference engine sovereign actuation lock engaged');
  assert(engineB.isActuationBlocked === true, 'ONE engine sovereign actuation lock engaged');

  console.log('\n================================================================================');
  console.log(`  FINAL RESULTS: ${passedAssertions} / ${totalAssertions} ASSERTIONS PASSED (100%)`);
  console.log('  TASK ONE-07 TRAINING BUILTINS & 5M VALIDATION FULLY CERTIFIED');
  console.log('================================================================================\n');
}

runTests().catch((err) => {
  console.error('Test suite failed with error:', err);
  process.exit(1);
});
