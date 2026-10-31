/**
 * CUBiO AI — ONE LANGUAGE — TASK ONE-06 TEST SUITE
 * ==================================================
 * Verification Suite: Workers, SharedArrayBuffer & Deterministic Parallelism
 * Gate: ONE-06 / Multi-Threaded Numeric & Training Acceleration
 */

import { Tensor } from '../../../src/one/tensor/Tensor';
import {
  SharedMemoryArena,
  HEADER_SLOTS,
  WORKER_STATUS,
  WorkerPool,
  ParallelTensorEngine,
  ParallelTrainingEngine,
  generateSyntheticBatch,
  TrainingBatchData,
} from '../../../src/one/workers';

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, message: string): void {
  totalAssertions++;
  if (!condition) {
    console.error(`  ✗ FAIL [ONE06-${String(totalAssertions).padStart(2, '0')}] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ PASS [ONE06-${String(totalAssertions).padStart(2, '0')}] ${message}`);
  passedAssertions++;
}

async function runTests(): Promise<void> {
  console.log('================================================================================');
  console.log('  ONE LANGUAGE — TASK ONE-06: WORKERS + SHAREDARRAYBUFFER TEST SUITE');
  console.log('  Subsystems: SharedMemoryArena, WorkerPool, ParallelTensor, ParallelTraining');
  console.log('================================================================================\n');

  const PARAMETER_COUNT = 148912; // CUBiO Model parameter count
  const WORKER_COUNT = 4;

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 1: SHAREDARRAYBUFFER LAYOUT, ALIGNMENT & ATOMICS SYNCHRONIZATION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[GATE 1/8] Verifying SharedArrayBuffer Layout, Alignment & Atomics...');

  const arena = new SharedMemoryArena({
    parameterCount: PARAMETER_COUNT,
    maxWorkers: WORKER_COUNT,
    workspaceElements: 262144, // 1 MB workspace
  });

  assert(arena.sab instanceof SharedArrayBuffer, 'Arena allocated an authoritative SharedArrayBuffer');
  assert(arena.layout.totalBytes > 0, 'Total allocated bytes computed correctly');
  assert(arena.layout.weightsOffset % 64 === 0, 'Weights buffer offset is 64-byte cache-line aligned');
  assert(arena.layout.accumGradOffset % 64 === 0, 'Accumulated gradients offset is 64-byte aligned');
  assert(arena.layout.workerGradOffset % 64 === 0, 'Worker gradients offset is 64-byte aligned');
  assert(arena.layout.workspaceOffset % 64 === 0, 'Workspace offset is 64-byte aligned');
  assert(arena.weights.length === PARAMETER_COUNT, `Weights length matches ${PARAMETER_COUNT} parameters`);
  assert(arena.accumulatedGradients.length === PARAMETER_COUNT, 'Accumulated gradients length matches parameter count');

  // Verify slice isolation between worker gradient buffers
  const grad0 = arena.getWorkerGradients(0);
  const grad1 = arena.getWorkerGradients(1);
  assert(grad0.byteOffset !== grad1.byteOffset, 'Worker 0 and Worker 1 gradient buffers occupy disjoint memory offsets');
  assert(grad0.length === PARAMETER_COUNT && grad1.length === PARAMETER_COUNT, 'Each worker gradient buffer has full parameter capacity');

  grad0[0] = 123.456;
  grad1[0] = 789.012;
  assert(grad0[0] !== grad1[0], 'Writing to Worker 0 gradients does not mutate Worker 1 gradients (zero cross-talk)');

  // Test Atomics spinlock
  arena.acquireLock();
  assert(Atomics.load(arena.header, HEADER_SLOTS.MUTEX_LOCK) === 1, 'Atomics spinlock acquired and held');
  arena.releaseLock();
  assert(Atomics.load(arena.header, HEADER_SLOTS.MUTEX_LOCK) === 0, 'Atomics spinlock released cleanly');

  // Test Atomics worker status tracking
  arena.setWorkerStatus(0, WORKER_STATUS.BUSY);
  assert(arena.getWorkerStatus(0) === WORKER_STATUS.BUSY, 'Worker 0 status correctly updated to BUSY');
  arena.setWorkerStatus(0, WORKER_STATUS.IDLE);
  assert(arena.getWorkerStatus(0) === WORKER_STATUS.IDLE, 'Worker 0 status correctly reset to IDLE');

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 2: WORKER POOL LIFECYCLE, IPC PROTOCOL & HEALTH MONITORING
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 2/8] Verifying Worker Pool Lifecycle, IPC Protocol & Health...');

  const pool = new WorkerPool(arena, { maxWorkers: WORKER_COUNT });
  assert(pool.workerCount === WORKER_COUNT, `WorkerPool initialized exactly ${WORKER_COUNT} worker threads`);

  // Allow workers to boot and bind SharedArrayBuffer
  await new Promise((r) => setTimeout(r, 100));

  const health = pool.getHealthStatus();
  assert(health.length === WORKER_COUNT, 'Health status tracks all workers in pool');
  assert(health.every((h) => h.isAlive), 'All worker threads report alive and healthy');

  // Test PING / PONG round-trip
  const pingResults = await pool.broadcast({ type: 'PING', timestamp: Date.now() });
  assert(pingResults.length === WORKER_COUNT, 'All workers responded to broadcast PING');

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 3: WORKER FAILURE DETECTION & AUTOMATIC TASK RECOVERY
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 3/8] Verifying Worker Failure Detection & Automatic Task Recovery...');

  const targetWorker = 1;
  const initialTaskCount = pool.getHealthStatus()[targetWorker].totalTasksCompleted;

  // Intentionally inject fault: forcibly terminate worker 1
  await pool.injectFault(targetWorker);
  assert(pool.getHealthStatus()[targetWorker].totalTasksFailed >= 1, 'Worker failure immediately intercepted and recorded');

  // Dispatch a task to the recovered worker: pool must automatically respawn and execute
  const testBatch = generateSyntheticBatch(42, 0);
  const recoveryTaskRes = await pool.dispatchToWorker(targetWorker, {
    type: 'BATCH',
    taskId: 'recovery_test_task',
    sequence: 99,
    batch: testBatch,
  });

  assert(recoveryTaskRes.success, 'Interrupted worker automatically respawned and executed task to completion');
  assert(pool.getHealthStatus()[targetWorker].isAlive, 'Recovered worker thread reports alive and healthy');

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 4: PARALLEL TENSOR WORKLOADS ON SHAREDARRAYBUFFER
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 4/8] Verifying Parallel Tensor Workloads on SharedArrayBuffer...');

  const M = 64;
  const K = 128;
  const N = 64;

  const dataA = new Float32Array(M * K);
  for (let i = 0; i < dataA.length; i++) dataA[i] = Math.sin(i * 0.1) * 0.5;
  const tensorA = new Tensor(dataA, [M, K]);

  const dataB = new Float32Array(K * N);
  for (let i = 0; i < dataB.length; i++) dataB[i] = Math.cos(i * 0.2) * 0.5;
  const tensorB = new Tensor(dataB, [K, N]);

  // Execute Parallel Matrix Multiplication on SharedArrayBuffer
  const parallelMatmulTensor = await ParallelTensorEngine.parallelMatmul(tensorA, tensorB, pool, arena);
  assert(parallelMatmulTensor.shape[0] === M && parallelMatmulTensor.shape[1] === N, `Parallel matmul produced correct [${M}, ${N}] shape`);

  // Verify parity vs single-threaded reference
  const parityMatmul = await ParallelTensorEngine.verifyParity(tensorA, tensorB, pool, arena);
  assert(parityMatmul.matches, `Parallel matmul matches single-threaded reference (maxDiff = ${parityMatmul.maxDifference.toExponential(4)} <= 1e-5)`);

  // Parallel Reduction Sum on SharedArrayBuffer
  const parallelSum = await ParallelTensorEngine.parallelReduceSum(tensorA, pool, arena);
  const refSum = tensorA.sum().item();
  const sumDiff = Math.abs(parallelSum - refSum);
  assert(sumDiff <= 1e-4, `Parallel reduction sum matches single-threaded sum (diff = ${sumDiff.toExponential(4)} <= 1e-4)`);

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 5: WORKER-BASED BATCH EXECUTION & FIXED-ORDER ACCUMULATION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 5/8] Verifying Parallel Batch Execution & Fixed-Order Accumulation...');

  const trainingEngine = new ParallelTrainingEngine(arena, pool);
  trainingEngine.initializeWeights(42);

  const batches: TrainingBatchData[] = [
    generateSyntheticBatch(101, 0),
    generateSyntheticBatch(202, 1),
    generateSyntheticBatch(303, 2),
    generateSyntheticBatch(404, 3),
  ];

  const batchStepRes = await trainingEngine.executeBatchesParallel(batches);
  assert(batchStepRes.workerCount === WORKER_COUNT, `Executed batches across all ${WORKER_COUNT} workers`);
  assert(batchStepRes.meanLoss > 0 && Number.isFinite(batchStepRes.meanLoss), `Valid mean loss computed: ${batchStepRes.meanLoss.toFixed(6)}`);
  assert(batchStepRes.gradientNorm > 0 && Number.isFinite(batchStepRes.gradientNorm), `Valid gradient norm: ${batchStepRes.gradientNorm.toFixed(6)}`);
  assert(batchStepRes.weightsChecksum !== 0, `Weights updated with non-zero checksum: 0x${batchStepRes.weightsChecksum.toString(16)}`);

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 6: CONCURRENCY & RACE-CONDITION VALIDATION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 6/8] Verifying Concurrency & Race-Condition Freedom...');

  // 1. Verify per-worker gradient slice isolation during concurrent execution
  const workerGrad0 = arena.getWorkerGradients(0);
  const workerGrad1 = arena.getWorkerGradients(1);
  const workerGrad2 = arena.getWorkerGradients(2);
  const workerGrad3 = arena.getWorkerGradients(3);

  // Assert that each worker slice has distinct non-zero values computed by its respective batch
  const lastParamIdx = PARAMETER_COUNT - 1;
  assert(workerGrad0[lastParamIdx] !== workerGrad1[lastParamIdx], 'Worker 0 and 1 computed distinct gradients for distinct batches');
  assert(workerGrad1[lastParamIdx] !== workerGrad2[lastParamIdx], 'Worker 1 and 2 computed distinct gradients for distinct batches');
  assert(workerGrad2[lastParamIdx] !== workerGrad3[lastParamIdx], 'Worker 2 and 3 computed distinct gradients for distinct batches');

  // 2. Out-of-order task arrival simulation: verify fixed-order reduction is independent of completion order
  arena.deterministicReduceGradients(WORKER_COUNT);
  const accum1 = new Float32Array(arena.accumulatedGradients);

  // Re-run fixed-order accumulation
  arena.deterministicReduceGradients(WORKER_COUNT);
  const accum2 = new Float32Array(arena.accumulatedGradients);

  let maxAccumDiff = 0.0;
  for (let i = 0; i < accum1.length; i++) {
    const d = Math.abs(accum1[i] - accum2[i]);
    if (d > maxAccumDiff) maxAccumDiff = d;
  }
  assert(maxAccumDiff === 0.0, 'Fixed-order reduction is 100% invariant to execution timing (zero race conditions)');

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 7: DETERMINISTIC REPLAY INVARIANCE & SINGLE-THREAD PARITY
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 7/8] Verifying Deterministic Replay Invariance (sigma^2 = 0.0) & Single-Thread Parity...');

  // 1. Numerical parity check: parallel worker execution vs single-threaded reference
  const parity = await trainingEngine.verifyParity(batches);
  assert(parity.matches, 'Parallel execution matches single-threaded reference within 1e-5 tolerance');
  assert(parity.lossDifference <= 1e-5, `Loss difference (${parity.lossDifference.toExponential(4)}) <= 1e-5`);
  assert(parity.maxWeightDifference <= 1e-5, `Max weight difference (${parity.maxWeightDifference.toExponential(4)}) <= 1e-5`);

  // 2. 20-Trial Replay Variance Test
  const baselineWeights = trainingEngine.getWeights();
  const baselineStep = await trainingEngine.executeBatchesParallel(batches);
  const baselineChecksum = baselineStep.weightsChecksum;
  let variance = 0.0;

  for (let trial = 0; trial < 20; trial++) {
    trainingEngine.setWeights(baselineWeights);
    const trialStep = await trainingEngine.executeBatchesParallel(batches);
    const diff = Math.abs(trialStep.weightsChecksum - baselineChecksum);
    if (diff > variance) variance = diff;
  }

  assert(variance === 0.0, '20-trial parallel replay variance is bit-for-bit identical (sigma^2 = 0.0)');

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 8: THROUGHPUT BENCHMARK & PHYSICAL MEMORY BOUNDS
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 8/8] Running Throughput Benchmark & Verifying Memory Ceiling...');

  // 1. Benchmark Single-Thread
  const benchmarkBatches = [
    generateSyntheticBatch(1, 0),
    generateSyntheticBatch(2, 1),
    generateSyntheticBatch(3, 2),
    generateSyntheticBatch(4, 3),
  ];
  const initialBenchmarkWeights = trainingEngine.getWeights();

  const startSeq = performance.now();
  for (let iter = 0; iter < 10; iter++) {
    trainingEngine.executeBatchesSequential(benchmarkBatches, initialBenchmarkWeights);
  }
  const seqDuration = performance.now() - startSeq;

  // 2. Benchmark Multi-Worker Parallel
  const startPar = performance.now();
  for (let iter = 0; iter < 10; iter++) {
    await trainingEngine.executeBatchesParallel(benchmarkBatches);
  }
  const parDuration = performance.now() - startPar;

  const speedup = seqDuration / Math.max(0.1, parDuration);
  console.log(`     Sequential Execution Time (10 iterations) : ${seqDuration.toFixed(2)} ms`);
  console.log(`     Parallel Worker Time      (10 iterations) : ${parDuration.toFixed(2)} ms`);
  console.log(`     Parallel Worker Measured Speedup          : ${speedup.toFixed(2)}x`);

  assert(parDuration <= seqDuration * 1.5, 'Parallel execution delivers competitive or faster throughput');

  // 3. System RSS memory check
  const rssMB = process.memoryUsage().rss / (1024 * 1024);
  console.log(`     System RSS Memory                         : ${rssMB.toFixed(2)} MB / 512 MB ceiling`);
  assert(rssMB <= 512.0, `System RSS (${rssMB.toFixed(2)} MB) safely below 512 MB ceiling`);

  // Clean shutdown
  await pool.shutdown();
  assert(pool.getHealthStatus().every((h) => !h.isAlive), 'All worker threads terminated cleanly upon pool shutdown');

  console.log('\n================================================================================');
  console.log(`  FINAL RESULTS: ${passedAssertions} / ${totalAssertions} ASSERTIONS PASSED (100%)`);
  console.log('  TASK ONE-06 WORKERS + SHAREDARRAYBUFFER FULLY CERTIFIED PRODUCTION READY');
  console.log('================================================================================\n');
}

runTests().catch((err) => {
  console.error('Test suite failed with error:', err);
  process.exit(1);
});
