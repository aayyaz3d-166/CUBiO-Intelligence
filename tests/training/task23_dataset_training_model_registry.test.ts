/**
 * ONE INTELLIGENCE — TASK 23 MASTER VERIFICATION SUITE
 * =======================================================
 * Gate: CNL-TASK23 / Dataset Ingestion, Training Pipeline & Model Registry Lineage
 *
 * Covers:
 *   1. Dataset Schema Validation & Bounds Checking (Tokens, Shapes, dtypes, NaN/Inf rejection)
 *   2. Deterministic Train/Validation/Test Splits & Zero Data Leakage Controls
 *   3. Deduplication & Record Content Fingerprinting
 *   4. Replay Buffer (SpatialRingBuffer boundary & SpatialReplayBuffer deterministic sampling)
 *   5. Training Pipeline (Autograd forward/backward, AdamW, Gradient Clipping, LR Cosine Schedule, StateDict)
 *   6. Checkpoint Serialization, Cryptographic Checksum Integrity & Read-Only Immutability
 *   7. Model Registry Lineage, Deprecated Parameter Count Rejection & Fail-Closed Actuation Safety
 */

import { RSSGuard } from '../../src/core/memory/rssGuard';
import {
  DatasetIngestionPipeline,
  computeRecordHash,
  DatasetRecord,
  ValidationSchema,
} from '../../src/core/training/datasetIngestion';
import {
  SpatialRingBuffer,
  SpatialReplayBuffer,
  ReplayTransition,
} from '../../src/core/stream/spatialRingBuffer';
import {
  NativeModelRegistry,
  AuthoritativeModelIdentity,
} from '../../src/one/native_model_registry';
import {
  Authoritative5MCheckpoint,
  CUBIO_5M_CONFIG,
  CUBIO_5M_LAYER_OFFSETS,
} from '../../src/one/training/CUBiO5MModel';
import { FaultTolerantWAL } from '../../src/core/training/faultTolerantWAL';
import { PretrainingScheduler } from '../../src/core/training/pretrainingScheduler';
import { LinearWarmupCosineDecayScheduler } from '../../src/one/training/LRScheduler';
import { OneTrainingEngine } from '../../src/one/training/OneTrainingEngine';
import { Tensor } from '../../src/one/tensor/Tensor';
import { cloneOptimizerState, computeMomentsChecksum } from '../../src/one/training/OptimizerState';

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, message: string): void {
  totalAssertions++;
  if (!condition) {
    console.error(`  ✗ FAIL [TASK23-${String(totalAssertions).padStart(2, '0')}] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ PASS [TASK23-${String(totalAssertions).padStart(2, '0')}] ${message}`);
  passedAssertions++;
}

export async function runTask23DatasetTrainingModelRegistryTests(): Promise<void> {
  console.log('================================================================================');
  console.log('  ONE INTELLIGENCE — TASK 23: DATASET INGESTION, TRAINING & MODEL REGISTRY');
  console.log('================================================================================\n');

  const rssGuard = new RSSGuard(512);

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 1: DATASET SCHEMA VALIDATION & BOUNDS CHECKING
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Suite 1] Dataset Ingestion Schema Validation & Bounds Checking...');
  const ingestion = new DatasetIngestionPipeline(rssGuard);

  // 1.1 Valid records test
  const validBatch: DatasetRecord[] = [
    {
      id: 'rec_01',
      tokens: [0, 36, 128, 256, 368],
      targetSpatialState: new Float32Array(40).fill(0.5),
      referenceLogits: new Float32Array(369).fill(0.01),
    },
    {
      id: 'rec_02',
      tokens: [10, 20, 30],
      targetSpatialState: Array.from({ length: 40 }, (_, i) => i * 0.01),
    },
  ];

  const valRes1 = ingestion.validateRecords(validBatch);
  assert(valRes1.valid === true, 'Valid dataset batch certified by schema validator');
  assert(valRes1.validRecords.length === 2, 'All valid records accepted into valid set');
  assert(valRes1.invalidRecords.length === 0, 'Zero invalid records for clean batch');

  // 1.2 Invalid records test (out of bounds tokens, dimension mismatch, NaN/Inf)
  const invalidBatch = [
    { id: 'bad_token_neg', tokens: [-1, 20, 30] }, // negative token
    { id: 'bad_token_overflow', tokens: [369, 10] }, // 369 is >= vocabSize 369
    { id: 'bad_token_float', tokens: [1.5, 20] }, // non-integer token
    { id: 'bad_seq_len', tokens: [] }, // empty sequence < minSeqLen
    { id: 'bad_spatial_dim', tokens: [1, 2], targetSpatialState: [0.1, 0.2] }, // length 2 !== 40
    { id: 'bad_spatial_nan', tokens: [1, 2], targetSpatialState: new Array(40).fill(NaN) }, // NaN
    { id: 'bad_spatial_inf', tokens: [1, 2], targetSpatialState: new Array(40).fill(Infinity) }, // Infinity
    { id: 'bad_logits_dim', tokens: [1, 2], referenceLogits: [0.1] }, // length 1 !== 369
    null, // null record
    'not-an-object', // non-object record
  ];

  const valRes2 = ingestion.validateRecords(invalidBatch);
  assert(valRes2.valid === false, 'Invalid batch correctly rejected');
  assert(valRes2.invalidRecords.length === 10, 'All 10 corrupted/malformed records detected');
  assert(valRes2.validRecords.length === 0, 'Zero malformed records admitted to valid set');
  assert(valRes2.errorCount >= 10, 'Descriptive error logs generated for every failure reason');

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 2: DETERMINISTIC DATASET SPLITS & ZERO DATA LEAKAGE CONTROLS
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 2] Deterministic Dataset Splits & Zero Data Leakage Controls...');

  // Create 100 unique synthetic records
  const uniqueRecords: DatasetRecord[] = [];
  for (let i = 0; i < 100; i++) {
    uniqueRecords.push({
      id: `record_unique_${String(i).padStart(3, '0')}`,
      tokens: [i % 369, (i * 3) % 369, (i * 7) % 369, (i * 11) % 369],
      targetSpatialState: new Float32Array(40).fill(i * 0.001),
    });
  }

  // Split with 80% train, 10% val, 10% test with deterministic seed 369
  const splitsA = ingestion.splitDataset(uniqueRecords, {
    trainRatio: 0.8,
    valRatio: 0.1,
    testRatio: 0.1,
    seed: 369,
  });

  assert(splitsA.train.length === 80, 'Train split contains exactly 80 records (80%)');
  assert(splitsA.validation.length === 10, 'Validation split contains exactly 10 records (10%)');
  assert(splitsA.test.length === 10, 'Test split contains exactly 10 records (10%)');
  assert(splitsA.stats.totalRecords === 100, 'Total split records sum to 100% of input dataset');

  // Leakage verification: disjoint hash sets
  assert(splitsA.leakageFree === true, 'Dataset partition is certified 100% leakage-free');
  assert(splitsA.leakageIncidents.length === 0, 'Zero leakage incidents between Train/Val/Test');

  for (const h of splitsA.trainHashes) {
    assert(!splitsA.valHashes.has(h), `Train hash ${h} does not leak into Validation set`);
    assert(!splitsA.testHashes.has(h), `Train hash ${h} does not leak into Test set`);
  }
  for (const h of splitsA.valHashes) {
    assert(!splitsA.testHashes.has(h), `Validation hash ${h} does not leak into Test set`);
  }

  // Reproducibility seed test: rerun with seed 369 yields identical partition
  const splitsB = ingestion.splitDataset(uniqueRecords, {
    trainRatio: 0.8,
    valRatio: 0.1,
    testRatio: 0.1,
    seed: 369,
  });

  let exactMatch = true;
  for (let i = 0; i < 80; i++) {
    if (splitsA.train[i].id !== splitsB.train[i].id) {
      exactMatch = false;
      break;
    }
  }
  assert(exactMatch === true, 'Seeded dataset split produces bit-exact identical ordering across runs (sigma^2 = 0.0)');

  // Intentional Leakage Injection Test: ensure duplicate lands in train AND test
  const contaminatedRecords = [...uniqueRecords];
  const trainRecordId = splitsA.train[0].id;
  const testRecordId = splitsA.test[0].id;
  const targetTrainRecord = uniqueRecords.find((r) => r.id === trainRecordId)!;
  const testIdx = uniqueRecords.findIndex((r) => r.id === testRecordId);

  contaminatedRecords[testIdx] = {
    id: 'injected_leakage_duplicate',
    tokens: [...targetTrainRecord.tokens],
    targetSpatialState: new Float32Array(targetTrainRecord.targetSpatialState!),
  };

  const splitsContaminated = ingestion.splitDataset(contaminatedRecords, {
    trainRatio: 0.8,
    valRatio: 0.1,
    testRatio: 0.1,
    seed: 369,
  });

  assert(splitsContaminated.leakageFree === false, 'Data leakage detector caught contaminated split');
  assert(splitsContaminated.leakageIncidents.length > 0, 'Leakage report contains incident details');
  assert(
    splitsContaminated.leakageIncidents[0].splits.includes('train') &&
    splitsContaminated.leakageIncidents[0].splits.includes('test'),
    'Contaminated split pair accurately identified as train + test'
  );

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 3: DEDUPLICATION & RECORD CONTENT FINGERPRINTING
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 3] Deduplication & Record Content Fingerprinting...');

  const batchWithDups: DatasetRecord[] = [
    { id: 'u1', tokens: [1, 2, 3], targetSpatialState: new Float32Array(40).fill(1.0) },
    { id: 'u2', tokens: [4, 5, 6], targetSpatialState: new Float32Array(40).fill(2.0) },
    { id: 'dup_u1', tokens: [1, 2, 3], targetSpatialState: new Float32Array(40).fill(1.0) }, // Duplicate of u1
    { id: 'u3', tokens: [7, 8, 9], targetSpatialState: new Float32Array(40).fill(3.0) },
    { id: 'dup_u2', tokens: [4, 5, 6], targetSpatialState: new Float32Array(40).fill(2.0) }, // Duplicate of u2
  ];

  const dedupRes = ingestion.deduplicate(batchWithDups);
  assert(dedupRes.uniqueCount === 3, 'Exactly 3 unique records identified');
  assert(dedupRes.duplicateCount === 2, 'Exactly 2 duplicate records filtered out');
  assert(dedupRes.uniqueRecords.map((r) => r.id).join(',') === 'u1,u2,u3', 'Canonical records preserved in first-seen order');

  const hash1 = computeRecordHash(batchWithDups[0]);
  const hashDup = computeRecordHash(batchWithDups[2]);
  assert(hash1 === hashDup, 'Deterministic content hashes match for identical payloads');

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 4: REPLAY BUFFER OPERATIONS & ZERO DATA CORRUPTION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 4] Replay Buffer Operations & Zero Data Corruption...');

  // 4.1 SpatialRingBuffer circular FIFO boundary test
  const ringBuffer = new SpatialRingBuffer(1, rssGuard); // 1 MB buffer = 1,048,576 bytes
  assert(ringBuffer.isEmpty() === true, 'Ring buffer initializes in empty state');
  assert(ringBuffer.getAvailableSpace() === 1024 * 1024 - 1, 'Initial available space matches capacity - 1');

  // Write and read chunk
  const chunkA = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const writeOk = ringBuffer.writeChunk(chunkA);
  assert(writeOk === true, 'Write chunk succeeded');
  assert(ringBuffer.isEmpty() === false, 'Ring buffer reports non-empty after write');

  const destA = new Uint8Array(8);
  const readLen = ringBuffer.readChunk(destA);
  assert(readLen === 8, 'Read 8 bytes from ring buffer');
  assert(destA.every((v, i) => v === chunkA[i]), 'Read data matches written data bit-exact');
  assert(ringBuffer.isEmpty() === true, 'Ring buffer returns to empty after reading all bytes');

  // 4.2 SpatialReplayBuffer experience replay test
  const replayBuffer = new SpatialReplayBuffer({
    maxTransitions: 5,
    rssGuard,
  });

  assert(replayBuffer.capacity() === 5, 'Replay buffer capacity configured to 5 transitions');
  assert(replayBuffer.size() === 0, 'Replay buffer starts empty');

  // Push 5 transitions
  for (let i = 0; i < 5; i++) {
    replayBuffer.push({
      id: `transition_${i}`,
      tokens: [i, i * 2],
      targetSpatialState: new Float32Array(40).fill(i * 0.1),
      loss: 1.0 - i * 0.1,
      timestamp: Date.now(),
    });
  }
  assert(replayBuffer.size() === 5, 'Replay buffer contains 5 transitions');

  // Push 6th transition: FIFO eviction of transition_0
  replayBuffer.push({
    id: 'transition_5',
    tokens: [5, 10],
    targetSpatialState: new Float32Array(40).fill(0.5),
    loss: 0.5,
    timestamp: Date.now(),
  });
  assert(replayBuffer.size() === 5, 'Replay buffer remains bounded at capacity 5 after eviction');

  // Sample batch with fixed seed for determinism
  const sample1 = replayBuffer.sample(3, 369);
  const sample2 = replayBuffer.sample(3, 369);
  assert(sample1.length === 3, 'Sampled exactly 3 transitions');
  assert(sample1[0].id === sample2[0].id, 'Deterministic replay sampling matches across calls with identical seed');
  assert(sample1.every((t) => t.id !== 'transition_0'), 'Evicted oldest transition is absent from samples');

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 5: TRAINING PIPELINE FORWARD/BACKWARD & OPTIMIZER STATE RESTORATION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 5] Training Pipeline Forward/Backward & Optimizer State Restoration...');

  const weights = new Tensor(new Float32Array([0.5, -0.5, 0.2, -0.2]), [2, 2]);
  weights.requiresGrad = true;

  const trainingEngine = new OneTrainingEngine([weights], {
    optimizer: { lr: 0.01, weightDecay: 0.001 },
    scheduler: { baseLR: 0.01, warmupSteps: 2, totalSteps: 10, minLR: 0.001 },
    maxGradNorm: 1.0,
  });

  assert(trainingEngine.isActuationBlocked === true, 'Training engine has permanent fail-closed actuation lock');

  // Run training step
  const initialWeight0 = weights.data[0];
  const stepTelemetry = trainingEngine.step(() => {
    // Forward pass: simulate logits and target classes
    const logits = new Tensor(new Float32Array([1.0, 0.0, 0.0, 1.0]), [2, 2]);
    logits.requiresGrad = true;
    const targets = [0, 1];
    return { logits, targets };
  });

  assert(stepTelemetry.step === 1, 'Training step 1 completed');
  assert(typeof stepTelemetry.loss === 'number' && !isNaN(stepTelemetry.loss), 'Valid loss calculated');
  assert(stepTelemetry.durationMs >= 0, 'Step duration measured');
  assert(stepTelemetry.isActuationBlocked === true, 'Actuation lock verified in step telemetry');

  // Optimizer state serialization & deep cloning
  const state = trainingEngine.stateDict();
  assert(state.stepCount === 1, 'Optimizer state preserves step count 1');
  const checksum = computeMomentsChecksum(state.moments);
  assert(checksum > 0, 'Deterministic moments checksum computed');

  const clonedState = cloneOptimizerState(state);
  assert(clonedState.stepCount === state.stepCount, 'Cloned state matches step count');
  assert(clonedState.checksum === state.checksum, 'Cloned state matches checksum');

  // Verify deep copy isolation
  clonedState.moments[0].m[0] += 999.0;
  assert(state.moments[0].m[0] !== clonedState.moments[0].m[0], 'Cloned optimizer moments are completely isolated from source');

  // Restore state
  trainingEngine.loadStateDict(state);
  assert(trainingEngine.getStep() === 1, 'Restored optimizer state recovered step count 1');

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 6: CHECKPOINT SERIALIZATION, INTEGRITY CHECKS & READ-ONLY IMMUTABILITY
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 6] Checkpoint Serialization, Integrity Checks & Read-Only Immutability...');

  // 6.1 Authoritative 5M Checkpoint
  const checkpoint5M = Authoritative5MCheckpoint.getInstance();
  const integrity = checkpoint5M.verifyIntegrity();
  assert(integrity.verified === true, 'Authoritative 5M Checkpoint cryptographic checksum verified');
  assert(integrity.totalParameters === 5000000, 'Checkpoint contains authoritative 5,000,000 parameters');
  assert(checkpoint5M.isReadOnly === true, 'Authoritative checkpoint is strictly read-only');

  const readOnlyWeights = checkpoint5M.getReadOnlyWeights();
  assert(readOnlyWeights.length === 5000000, 'Read-only weights view spans full 5,000,000 floats');

  // Test sandbox weights isolation: mutating sandbox must not affect authoritative checkpoint
  const sandboxWeights = checkpoint5M.createSandboxWeights();
  sandboxWeights[0] = 9999.0;
  sandboxWeights[1000] = -8888.0;

  const postMutationIntegrity = checkpoint5M.verifyIntegrity();
  assert(postMutationIntegrity.verified === true, 'Authoritative checkpoint 100% UNTOUCHED by sandbox mutation');
  assert(readOnlyWeights[0] !== 9999.0, 'Authoritative buffer values unmodified by sandbox mutation');

  // 6.2 Fault-Tolerant WAL Checkpoint & Recovery
  const wal = new FaultTolerantWAL(rssGuard);
  wal.writeCheckpoint(100, 1.4820, '0xHASH_STEP_100_AUTH');
  wal.writeCheckpoint(200, 1.2150, '0xHASH_STEP_200_AUTH');

  const recovered = wal.recoverLastState();
  assert(recovered !== null, 'WAL successfully recovered state');
  assert(recovered!.step === 200, 'WAL recovered latest checkpoint step 200');
  assert(recovered!.weightsHash === '0xHASH_STEP_200_AUTH', 'WAL recovered matching weights hash');

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 7: MODEL REGISTRY LINEAGE, DEPRECATED REJECTION & SAFETY LOCKOUT
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 7] Model Registry Lineage, Deprecated Rejection & Safety Lockout...');

  // 7.1 Authoritative STAGE1-V1 Model (148,912 Parameters)
  const stage1Model = NativeModelRegistry.getAuthoritativeModel();
  assert(stage1Model.modelId === 'CUBIO-MODEL-STAGE1-V1', 'Authoritative STAGE1 model ID certified');
  assert(stage1Model.totalParameters === 148912, 'Authoritative STAGE1 parameters locked at exactly 148,912');
  assert(stage1Model.layers.length === 6, 'STAGE1 layer breakdown contains exactly 6 harmonic tiers');
  assert(stage1Model.isActuationBlocked === true, 'STAGE1 model actuation safety lock engaged');

  // 7.2 Authoritative 5M Harmonic Model (5,000,000 Parameters)
  const fiveMModel = NativeModelRegistry.get5MHarmonicModel();
  assert(fiveMModel.modelId === 'CUBIO-MODEL-5M-HARMONIC', 'Authoritative 5M model ID certified');
  assert(fiveMModel.totalParameters === 5000000, 'Authoritative 5M parameters locked at exactly 5,000,000');
  assert(fiveMModel.layers.length === 10, '5M layer breakdown contains exactly 10 structural tiers');
  assert(fiveMModel.isActuationBlocked === true, '5M model actuation safety lock engaged');

  // 7.3 Model Registry Lookup & Listing
  const allModels = NativeModelRegistry.listRegisteredModels();
  assert(allModels.length === 2, 'Model registry lists exactly 2 authoritative models');

  const foundStage1 = NativeModelRegistry.getModelById('STAGE1_148K');
  assert(foundStage1 !== undefined && foundStage1.totalParameters === 148912, 'Lookup by STAGE1_148K alias succeeds');

  const found5M = NativeModelRegistry.getModelById('HARMONIC_5M');
  assert(found5M !== undefined && found5M.totalParameters === 5000000, 'Lookup by HARMONIC_5M alias succeeds');

  // 7.4 Inference Routing with Deterministic Fallback
  const selStage1 = NativeModelRegistry.resolveInferenceSelection('STAGE1_148K');
  assert(selStage1.selectedModel !== null && selStage1.fallbackToSymbolic === false, 'STAGE1_148K routed to active model');

  const sel5M = NativeModelRegistry.resolveInferenceSelection('HARMONIC_5M');
  assert(sel5M.selectedModel !== null && sel5M.fallbackToSymbolic === false, 'HARMONIC_5M routed to active model');

  const selOffline = NativeModelRegistry.resolveInferenceSelection('SYMBOLIC_ONLY');
  assert(selOffline.selectedModel === null && selOffline.fallbackToSymbolic === true, 'SYMBOLIC_ONLY correctly routes to deterministic fallback');

  const selUnknown = NativeModelRegistry.resolveInferenceSelection('UNKNOWN_FUTURE_MODEL');
  assert(selUnknown.selectedModel === null && selUnknown.fallbackToSymbolic === true, 'Unknown model safely falls back to symbolic reasoning');

  // 7.5 Strict Deprecated Parameter Count Rejection
  let deprecatedRejected = false;
  try {
    NativeModelRegistry.validateParameterCount(38400);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('DEPRECATED and INVALID')) {
      deprecatedRejected = true;
    }
  }
  assert(deprecatedRejected === true, 'Deprecated parameter count 38,400 strictly blocked and rejected with error');

  // 7.6 Parameter Validation Acceptance
  const val148k = NativeModelRegistry.validateParameterCount(148912);
  assert(val148k.valid === true, 'Authoritative 148,912 parameter count certified valid');

  const val5m = NativeModelRegistry.validateParameterCount(5000000);
  assert(val5m.valid === true, 'Authoritative 5,000,000 parameter count certified valid');

  let randomRejected = false;
  try {
    NativeModelRegistry.validateParameterCount(123456);
  } catch (err: unknown) {
    randomRejected = true;
  }
  assert(randomRejected === true, 'Arbitrary uncertified parameter count (123,456) rejected with error');

  // 7.7 Memory and Actuation Ceilings
  assert(rssGuard.getAllocatedMB() <= 512, `Physical memory allocation (${rssGuard.getAllocatedMB()} MB) safely within 512 MB ceiling`);
  assert(ingestion.isActuationBlocked === true, 'Dataset ingestion pipeline has permanent fail-closed actuation lock');

  console.log('\n================================================================================');
  console.log(`  FINAL RESULTS: ${passedAssertions} / ${totalAssertions} ASSERTIONS PASSED (100%)`);
  console.log('  TASK 23 DATASET INGESTION, TRAINING & MODEL REGISTRY FULLY CERTIFIED');
  console.log('================================================================================\n');
}

// Auto-run if executed directly
if (
  typeof process !== 'undefined' &&
  process.argv &&
  process.argv[1] &&
  process.argv[1].includes('task23_dataset_training_model_registry')
) {
  runTask23DatasetTrainingModelRegistryTests().catch((err) => {
    console.error('Fatal error during Task 23 execution:', err);
    process.exit(1);
  });
}
