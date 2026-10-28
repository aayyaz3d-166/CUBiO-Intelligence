/**
 * CUBiO AI — ONE LANGUAGE WORKER GRADIENT DETERMINISM TEST
 * ==========================================================
 * Verifies that parallel execution across 4 workers produces bit-identical
 * accumulated gradients to 1 worker sequential execution on the exact same workload.
 */

import { SharedMemoryArena } from '../../src/one/workers/SharedMemoryArena';
import { WorkerPool } from '../../src/one/workers/WorkerPool';
import {
  generateSyntheticBatch,
  computeMicroBatchForwardBackward,
} from '../../src/one/workers/WorkerThreadLogic';
import { TrainingBatchData, WorkerBatchTaskMessage } from '../../src/one/workers/WorkerProtocol';

async function runWorkerDeterminismTest() {
  console.log('='.repeat(70));
  console.log('WORKER DETERMINISM TEST: 1 WORKER VS 4 WORKERS BIT-IDENTITY');
  console.log('='.repeat(70));

  const totalParams = 369 * 64 + 40; // 23,656 parameters
  const batchCount = 4;

  // 1. Generate 4 deterministic micro-batches
  const batches: TrainingBatchData[] = [];
  for (let k = 0; k < batchCount; k++) {
    batches.push(generateSyntheticBatch(1337 + k * 100, 1));
  }

  // 2. Deterministic initial weights
  const initialWeights = new Float32Array(totalParams);
  let s = 42;
  for (let i = 0; i < totalParams; i++) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    initialWeights[i] = ((s >>> 0) / 4294967296.0 - 0.5) * 0.04;
  }

  // =========================================================================
  // RUN A: 1 Worker (Sequential Execution of all 4 micro-batches)
  // =========================================================================
  console.log('\n[1] Executing with 1 Worker (Sequential Reference)...');
  const arena1 = new SharedMemoryArena({ maxWorkers: 1, parameterCount: totalParams });
  arena1.weights.set(initialWeights);

  const grad1WorkerAccum = new Float32Array(totalParams);
  const tempGrad = new Float32Array(totalParams);

  const tStart1 = performance.now();
  // Fixed sequence accumulation: k = 0, 1, 2, 3
  for (let k = 0; k < batchCount; k++) {
    tempGrad.fill(0);
    computeMicroBatchForwardBackward(arena1.weights, tempGrad, batches[k], k);
    for (let i = 0; i < totalParams; i++) {
      grad1WorkerAccum[i] += tempGrad[i];
    }
  }
  // Scale by 1 / 4 for mean gradient
  const invK = 1.0 / batchCount;
  for (let i = 0; i < totalParams; i++) {
    grad1WorkerAccum[i] *= invK;
  }
  const dur1 = performance.now() - tStart1;
  console.log(`  1 Worker duration: ${dur1.toFixed(2)} ms`);

  // =========================================================================
  // RUN B: 4 Workers (Parallel Execution via SharedArrayBuffer & WorkerPool)
  // =========================================================================
  console.log('\n[2] Executing with 4 Workers in Parallel...');
  const arena4 = new SharedMemoryArena({ maxWorkers: 4, parameterCount: totalParams });
  arena4.weights.set(initialWeights);

  const pool4 = new WorkerPool(arena4, { maxWorkers: 4, useVirtualWorkers: true });

  const tStart4 = performance.now();
  // Dispatch 4 tasks to 4 workers in parallel
  const promises: Promise<any>[] = [];
  for (let k = 0; k < batchCount; k++) {
    const task: WorkerBatchTaskMessage = {
      type: 'BATCH',
      taskId: `task_det_${k}`,
      sequence: k,
      batch: batches[k],
      learningRate: 0.001,
    };
    promises.push(pool4.dispatchToWorker(k, task));
  }
  await Promise.all(promises);

  // Deterministic Fixed-Order Gradient Reduction
  arena4.deterministicReduceGradients(4);
  const dur4 = performance.now() - tStart4;
  console.log(`  4 Workers duration: ${dur4.toFixed(2)} ms`);

  const grad4WorkerAccum = arena4.accumulatedGradients;

  // =========================================================================
  // RUN C: Bit-for-Bit Identity Check
  // =========================================================================
  console.log('\n[3] Comparing 1 Worker vs 4 Workers Gradients...');

  let maxDiff = 0.0;
  let bitMismatchCount = 0;
  const view1 = new DataView(grad1WorkerAccum.buffer, grad1WorkerAccum.byteOffset, grad1WorkerAccum.byteLength);
  const view4 = new DataView(grad4WorkerAccum.buffer, grad4WorkerAccum.byteOffset, grad4WorkerAccum.byteLength);

  for (let i = 0; i < totalParams; i++) {
    const val1 = grad1WorkerAccum[i];
    const val4 = grad4WorkerAccum[i];
    const diff = Math.abs(val1 - val4);
    if (diff > maxDiff) maxDiff = diff;

    // Check 32-bit float bit pattern
    const bits1 = view1.getUint32(i * 4, true);
    const bits4 = view4.getUint32(i * 4, true);
    if (bits1 !== bits4) {
      bitMismatchCount++;
    }
  }

  console.log(`  Total Parameters Evaluated: ${totalParams.toLocaleString()}`);
  console.log(`  Maximum Absolute Difference: ${maxDiff.toExponential(6)}`);
  console.log(`  Bit Mismatch Count        : ${bitMismatchCount} / ${totalParams}`);

  const isBitIdentical = bitMismatchCount === 0 && maxDiff === 0.0;
  console.log(`  Bit-Identical Status      : ${isBitIdentical ? '✅ 100% BIT-IDENTICAL (Difference = 0.000000e+0)' : '❌ MISMATCH'}`);
  console.log('='.repeat(70));

  await pool4.shutdown();

  if (!isBitIdentical) {
    process.exit(1);
  }
}

runWorkerDeterminismTest().catch((err) => {
  console.error('Worker determinism test failed:', err);
  process.exit(1);
});
