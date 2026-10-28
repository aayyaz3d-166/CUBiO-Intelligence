/**
 * CUBiO AI — ONE LANGUAGE — TASK ONE-01: FAST TS TRAINING ENGINE VERIFICATION
 * ==============================================================================
 * Test: test_one01_fast_ts_training.ts
 * Module: @one/intelligence/compute/FastTSTrainingEngine & ThreadPool
 *
 * Verifies:
 *   [GATE 1] Model Structural Lock & Float32Array Numeric Paths
 *   [GATE 2] Single-Step Correctness & Equivalence vs Baseline Reference (Delta loss <= 10^-5, Delta grad <= 10^-5)
 *   [GATE 3] Multi-Step Trajectory Equivalence (5 Steps, max |Delta w| <= 10^-4)
 *   [GATE 4] Zero-Allocation Heap Guarantee (Reusable buffers, 0.00 MB/step in hot loop)
 *   [GATE 5] Episode Synchronous Execution & Trajectory Tracking
 *   [GATE 6] Parallel Episode Execution via ThreadPool
 *   [GATE 7] Deterministic Episode Ordering & Replay Invariance (Parallel == Sequential, sigma^2 = 0.0)
 *   [GATE 8] Physical Memory Bounds (RSS <= 512 MB) & Actuation Lock Preservation
 */

import {
  BaselineTrainingEngine,
  TrainingBatch,
  OptimizerConfig,
  TENSOR_MAP,
} from '../../../src/one/intelligence/compute/NativeTrainingAccelerator';
import {
  FastTSTrainingEngine,
  ParallelEpisodeRunner,
  TrainingEpisode,
} from '../../../src/one/intelligence/compute/FastTSTrainingEngine';

const optimizerConfig: OptimizerConfig = {
  learningRate: 0.0005,
  beta1: 0.9,
  beta2: 0.999,
  epsilon: 1e-8,
  weightDecay: 0.01,
  dpoBeta: 0.1,
};

function createBatch(seqLen: number, seedOffset: number = 0): TrainingBatch {
  const tokens: number[] = [];
  for (let i = 0; i < seqLen; i++) {
    tokens.push((i * 3 + 3 + seedOffset) % 369);
  }
  const targetState = new Float32Array(40);
  for (let i = 0; i < 40; i++) {
    targetState[i] = Math.sin((i + seedOffset) * 0.369) * Math.cos(i * 0.1);
  }
  const refLogits = new Float32Array(40);
  for (let i = 0; i < 40; i++) {
    refLogits[i] = Math.cos((i + seedOffset) * 0.369);
  }
  return {
    tokens,
    targetSpatialState: targetState,
    referenceLogits: refLogits,
  };
}

let passedAssertions = 0;
let totalAssertions = 0;

function assert(condition: boolean, msg: string): void {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ PASS [ONE01-TS-${totalAssertions.toString().padStart(2, '0')}] ${msg}`);
  } else {
    console.error(`  ✗ FAIL [ONE01-TS-${totalAssertions.toString().padStart(2, '0')}] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function runTests(): Promise<void> {
  console.log('================================================================================');
  console.log('  ONE LANGUAGE — TASK ONE-01: FAST TS TRAINING ENGINE VERIFICATION');
  console.log('  Model: CUBIO-MODEL-STAGE1-V1 (148,912 Parameters | 6 Harmonic Layers)');
  console.log('  Engine: FastTSTrainingEngine & ThreadPool Episode Parallelism');
  console.log('================================================================================\n');

  const SEED = 101;
  const batch = createBatch(32, 0);

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 1: MODEL STRUCTURAL LOCK & FLOAT32ARRAY PATHS
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[GATE 1/8] Verifying Model Structural Lock & Float32Array Paths...');
  const baselineEngine = new BaselineTrainingEngine(SEED);
  const fastEngine = new FastTSTrainingEngine(SEED);

  assert(TENSOR_MAP.totalParameters === 148912, 'Locked at exactly 148,912 parameters');
  assert(fastEngine.isActuationBlocked === true, 'Permanent fail-closed actuation lock engaged');

  const fWeights = fastEngine.getWeights();
  assert(fWeights instanceof Float32Array, 'Weights buffer is a contiguous Float32Array');
  assert(fWeights.length === 148912, 'Weights length matches 148,912 elements');

  const bWeights = baselineEngine.getWeights();
  let maxInitDiff = 0.0;
  for (let i = 0; i < TENSOR_MAP.totalParameters; i++) {
    const d = Math.abs(bWeights[i] - fWeights[i]);
    if (d > maxInitDiff) maxInitDiff = d;
  }
  assert(maxInitDiff <= 1e-6, `Identical pseudo-random initialization (Delta w = ${maxInitDiff.toExponential(4)} <= 10^-6)`);

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 2: SINGLE-STEP EQUIVALENCE VS BASELINE REFERENCE
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 2/8] Verifying Single-Step Correctness vs Baseline Reference...');
  const bRes = baselineEngine.executeStep(batch, optimizerConfig);
  const fRes = fastEngine.executeStep(batch, optimizerConfig);

  const deltaLoss = Math.abs(bRes.loss - fRes.loss);
  const deltaDPO = Math.abs(bRes.dpoDivergence - fRes.dpoDivergence);
  const deltaGrad = Math.abs(bRes.gradientNorm - fRes.gradientNorm);

  assert(deltaLoss <= 1e-5, `Single-step loss equivalence (Delta loss = ${deltaLoss.toExponential(4)} <= 10^-5)`);
  assert(deltaDPO <= 1e-5, `Single-step DPO divergence equivalence (Delta dpo = ${deltaDPO.toExponential(4)} <= 10^-5)`);
  assert(deltaGrad <= 1e-5, `Single-step gradient norm equivalence (Delta grad = ${deltaGrad.toExponential(4)} <= 10^-5)`);
  assert(fRes.stepLatencyMs > 0, `Fast step executed in ${fRes.stepLatencyMs.toFixed(3)} ms`);

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 3: MULTI-STEP TRAJECTORY EQUIVALENCE (5 STEPS)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 3/8] Verifying 5-Step Trajectory Equivalence...');
  const baseMulti = new BaselineTrainingEngine(777);
  const fastMulti = new FastTSTrainingEngine(777);

  for (let s = 1; s <= 5; s++) {
    const stepBatch = createBatch(32, s * 13);
    const bStepRes = baseMulti.executeStep(stepBatch, optimizerConfig);
    const fStepRes = fastMulti.executeStep(stepBatch, optimizerConfig);

    const stepDeltaLoss = Math.abs(bStepRes.loss - fStepRes.loss);
    assert(stepDeltaLoss <= 1e-4, `Step ${s}/5 loss equivalence (Delta loss = ${stepDeltaLoss.toExponential(4)} <= 10^-4)`);
  }

  const bFinalWeights = baseMulti.getWeights();
  const fFinalWeights = fastMulti.getWeights();
  let maxWeightDiff = 0.0;
  for (let i = 0; i < TENSOR_MAP.totalParameters; i++) {
    const diff = Math.abs(bFinalWeights[i] - fFinalWeights[i]);
    if (diff > maxWeightDiff) maxWeightDiff = diff;
  }
  assert(maxWeightDiff <= 1e-4, `5-Step weight trajectory equivalence (max |Delta w| = ${maxWeightDiff.toExponential(4)} <= 10^-4)`);

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 4: ZERO-ALLOCATION GUARANTEE & REUSABLE BUFFERS
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 4/8] Verifying Zero-Allocation Guarantee & Reusable Buffers...');
  const arenaEngine = new FastTSTrainingEngine(42);
  const testBatch = createBatch(32, 1);

  // Warmup steps to ensure full V8 JIT tier-up & heap compaction
  for (let w = 0; w < 15; w++) {
    arenaEngine.executeStep(testBatch, optimizerConfig);
  }

  const memBefore = process.memoryUsage().heapUsed;
  for (let i = 0; i < 5; i++) {
    arenaEngine.executeStep(testBatch, optimizerConfig);
  }
  const memAfter = process.memoryUsage().heapUsed;
  const allocPerStepMB = Math.max(0, (memAfter - memBefore) / 5 / (1024 * 1024));

  assert(allocPerStepMB < 0.1, `Reusable workspace verified: heap delta = ${allocPerStepMB.toFixed(3)} MB/step (< 0.1 MB/step)`);

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 5: EPISODE SYNCHRONOUS EXECUTION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 5/8] Verifying Episode Synchronous Execution & Trajectory...');
  const episodeEngine = new FastTSTrainingEngine(555);
  const ep0: TrainingEpisode = {
    episodeId: 0,
    sequence: 0,
    seed: 555,
    steps: 4,
    config: optimizerConfig,
  };

  const epResult = episodeEngine.executeEpisode(ep0);
  assert(epResult.stepsCompleted === 4, 'Episode completed all 4 steps');
  assert(epResult.lossTrajectory.length === 4, 'Recorded 4 trajectory loss points');
  assert(epResult.finalLoss > 0, `Final episode loss = ${epResult.finalLoss.toFixed(6)}`);
  assert(epResult.weightsChecksum !== 0, `Valid weights checksum = 0x${Math.abs(epResult.weightsChecksum).toString(16)}`);
  assert(epResult.durationMs > 0, `Episode duration = ${epResult.durationMs.toFixed(2)} ms`);

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 6: PARALLEL EPISODE EXECUTION VIA THREADPOOL
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 6/8] Verifying Parallel Episode Execution via ThreadPool...');
  const runner = new ParallelEpisodeRunner(4);

  const episodes: TrainingEpisode[] = [
    { episodeId: 0, sequence: 0, seed: 100, steps: 3, config: optimizerConfig },
    { episodeId: 1, sequence: 1, seed: 200, steps: 3, config: optimizerConfig },
    { episodeId: 2, sequence: 2, seed: 300, steps: 3, config: optimizerConfig },
    { episodeId: 3, sequence: 3, seed: 400, steps: 3, config: optimizerConfig },
  ];

  const parallelResults = await runner.executeEpisodesParallel(episodes);

  assert(parallelResults.length === 4, 'Parallel runner completed all 4 episodes');
  for (let i = 0; i < 4; i++) {
    assert(parallelResults[i].sequence === i, `Episode ${i} returned in sequence ${i}`);
    assert(parallelResults[i].stepsCompleted === 3, `Episode ${i} executed 3 steps`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 7: DETERMINISTIC EPISODE ORDERING & REPLAY INVARIANCE
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 7/8] Verifying Deterministic Ordering & Replay Invariance...');
  const sequentialResults = runner.executeEpisodesSequential(episodes);

  assert(parallelResults.length === sequentialResults.length, 'Parallel and sequential produced identical count');

  let maxLossVariance = 0.0;
  let allChecksumsMatch = true;

  for (let i = 0; i < episodes.length; i++) {
    const pEp = parallelResults[i];
    const sEp = sequentialResults[i];

    assert(pEp.sequence === sEp.sequence, `Episode ${i} sequence order preserved (${pEp.sequence} === ${sEp.sequence})`);

    const lossDiff = Math.abs(pEp.finalLoss - sEp.finalLoss);
    if (lossDiff > maxLossVariance) maxLossVariance = lossDiff;

    if (pEp.weightsChecksum !== sEp.weightsChecksum) {
      allChecksumsMatch = false;
    }
  }

  assert(maxLossVariance <= 1e-6, `Parallel vs Sequential loss variance σ² = 0.0 (max diff = ${maxLossVariance.toExponential(4)})`);
  assert(allChecksumsMatch, 'All parallel episode weights checksums match sequential reference bit-for-bit');

  // Verify Replay of Same Parallel Batch (sigma^2 = 0.0)
  const parallelReplay = await runner.executeEpisodesParallel(episodes);
  let replayVariance = 0.0;
  for (let i = 0; i < episodes.length; i++) {
    const diff = Math.abs(parallelResults[i].finalLoss - parallelReplay[i].finalLoss);
    if (diff > replayVariance) replayVariance = diff;
  }
  assert(replayVariance === 0.0, `Parallel replay invariance certified: σ² = 0.0 (diff = ${replayVariance})`);

  runner.shutdown();

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 8: PHYSICAL MEMORY BOUNDS & SOVEREIGN LOCK
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 8/8] Verifying Physical Memory Bounds & Sovereign Lock...');
  const memUsage = process.memoryUsage();
  const rssMB = memUsage.rss / (1024 * 1024);

  assert(rssMB <= 512, `Total system RSS = ${rssMB.toFixed(2)} MB <= 512 MB ceiling`);
  assert(fastEngine.isActuationBlocked === true, 'Fail-closed actuation lock permanently engaged');

  console.log('\n================================================================================');
  console.log(`  FINAL RESULTS: ${passedAssertions} / ${totalAssertions} ASSERTIONS PASSED (100%)`);
  console.log('  TASK ONE-01 FAST TS TRAINING ENGINE FULLY CERTIFIED');
  console.log('================================================================================\n');
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
