/**
 * CUBiO AI — ONE LANGUAGE — WORKER THREAD LOGIC
 * ===============================================
 * Module: @one/workers/WorkerThreadLogic
 * Gate: ONE-06 / Multi-Threaded Kernel Execution Logic
 *
 * Implements the execution kernel run inside worker threads.
 * Provides both in-process invocation and pre-serialized JavaScript source
 * for Node.js worker_threads { eval: true }.
 */

import {
  MasterToWorkerMessage,
  WorkerToMasterMessage,
  WorkerResultMessage,
  TrainingBatchData,
} from './WorkerProtocol';
import { SharedMemoryArena, WORKER_STATUS } from './SharedMemoryArena';

export interface WorkerThreadState {
  workerId: number;
  totalWorkers: number;
  arena: SharedMemoryArena | null;
  seed: number;
}

/**
 * Core task execution dispatcher. Used for in-process execution and tests.
 */
export function executeWorkerTask(
  msg: MasterToWorkerMessage,
  state: WorkerThreadState,
  postMessage: (res: WorkerToMasterMessage) => void
): void {
  const tStart = performance.now();

  switch (msg.type) {
    case 'INIT': {
      state.workerId = msg.workerId;
      state.totalWorkers = msg.totalWorkers;
      state.arena = SharedMemoryArena.fromExistingBuffer(msg.sab, msg.layout);
      state.seed = msg.seed;
      state.arena.setWorkerStatus(state.workerId, WORKER_STATUS.IDLE);

      postMessage({
        type: 'RESULT',
        taskId: 'init',
        sequence: 0,
        workerId: state.workerId,
        success: true,
        durationMs: performance.now() - tStart,
      });
      break;
    }

    case 'PING': {
      postMessage({
        type: 'PONG',
        taskId: msg.taskId,
        sequence: msg.sequence ?? 0,
        workerId: state.workerId,
        timestamp: Date.now(),
        success: true,
      });
      break;
    }

    case 'TENSOR_CHUNK': {
      if (!state.arena) {
        postMessage({
          type: 'RESULT',
          taskId: msg.taskId,
          sequence: msg.sequence,
          workerId: state.workerId,
          success: false,
          error: 'SharedMemoryArena not initialized in worker',
        });
        return;
      }

      state.arena.setWorkerStatus(state.workerId, WORKER_STATUS.BUSY);
      const ws = state.arena.workspace;

      try {
        if (msg.op === 'matmul') {
          // Parallel chunked matrix multiplication: C[rowStart..rowEnd, :] = A[rowStart..rowEnd, :] x B
          const { rowStart, rowEnd, K, N, offsetA, offsetB, offsetC } = msg;

          for (let i = rowStart; i < rowEnd; i++) {
            const aRowOffset = offsetA + i * K;
            const cRowOffset = offsetC + i * N;

            for (let j = 0; j < N; j++) {
              let sum = 0.0;
              for (let k = 0; k < K; k++) {
                sum += ws[aRowOffset + k] * ws[offsetB + k * N + j];
              }
              ws[cRowOffset + j] = sum;
            }
          }

          state.arena.setWorkerStatus(state.workerId, WORKER_STATUS.DONE);
          postMessage({
            type: 'RESULT',
            taskId: msg.taskId,
            sequence: msg.sequence,
            workerId: state.workerId,
            success: true,
            elementsProcessed: (msg.rowEnd - msg.rowStart) * msg.N,
            durationMs: performance.now() - tStart,
          });
        } else if (msg.op === 'reduce_sum') {
          // Chunked reduction sum
          let sum = 0.0;
          const { rowStart, rowEnd, offsetA } = msg;
          for (let i = rowStart; i < rowEnd; i++) {
            sum += ws[offsetA + i];
          }

          state.arena.setWorkerStatus(state.workerId, WORKER_STATUS.DONE);
          postMessage({
            type: 'RESULT',
            taskId: msg.taskId,
            sequence: msg.sequence,
            workerId: state.workerId,
            success: true,
            computedSum: sum,
            elementsProcessed: rowEnd - rowStart,
            durationMs: performance.now() - tStart,
          });
        }
      } catch (err: any) {
        state.arena.setWorkerStatus(state.workerId, WORKER_STATUS.ERROR);
        postMessage({
          type: 'RESULT',
          taskId: msg.taskId,
          sequence: msg.sequence,
          workerId: state.workerId,
          success: false,
          error: err?.message || String(err),
          durationMs: performance.now() - tStart,
        });
      }
      break;
    }

    case 'BATCH': {
      if (!state.arena) {
        postMessage({
          type: 'RESULT',
          taskId: msg.taskId,
          sequence: msg.sequence,
          workerId: state.workerId,
          success: false,
          error: 'SharedMemoryArena not initialized in worker',
        });
        return;
      }

      state.arena.setWorkerStatus(state.workerId, WORKER_STATUS.BUSY);

      try {
        const workerGrads = state.arena.getWorkerGradients(state.workerId);
        const weights = state.arena.weights;
        const batch = msg.batch;

        // Compute forward pass and analytical gradients for the batch
        const stepResult = computeMicroBatchForwardBackward(
          weights,
          workerGrads,
          batch,
          msg.sequence
        );

        state.arena.setWorkerStatus(state.workerId, WORKER_STATUS.DONE);
        postMessage({
          type: 'RESULT',
          taskId: msg.taskId,
          sequence: msg.sequence,
          workerId: state.workerId,
          success: true,
          loss: stepResult.loss,
          dpoDivergence: stepResult.dpoDivergence,
          gradientNorm: stepResult.gradientNorm,
          durationMs: performance.now() - tStart,
        });
      } catch (err: any) {
        state.arena.setWorkerStatus(state.workerId, WORKER_STATUS.ERROR);
        postMessage({
          type: 'RESULT',
          taskId: msg.taskId,
          sequence: msg.sequence,
          workerId: state.workerId,
          success: false,
          error: err?.message || String(err),
          durationMs: performance.now() - tStart,
        });
      }
      break;
    }

    case 'EPISODE': {
      if (!state.arena) {
        postMessage({
          type: 'RESULT',
          taskId: msg.taskId,
          sequence: msg.sequence,
          workerId: state.workerId,
          success: false,
          error: 'SharedMemoryArena not initialized in worker',
        });
        return;
      }

      state.arena.setWorkerStatus(state.workerId, WORKER_STATUS.BUSY);

      try {
        const workerGrads = state.arena.getWorkerGradients(state.workerId);
        const weights = state.arena.weights;
        let cumulativeLoss = 0;

        for (let s = 0; s < msg.steps; s++) {
          const synthBatch = generateSyntheticBatch(msg.seed + s, s);
          const res = computeMicroBatchForwardBackward(weights, workerGrads, synthBatch, msg.sequence);
          cumulativeLoss += res.loss;
        }

        const meanLoss = cumulativeLoss / Math.max(1, msg.steps);
        state.arena.setWorkerStatus(state.workerId, WORKER_STATUS.DONE);

        postMessage({
          type: 'RESULT',
          taskId: msg.taskId,
          sequence: msg.sequence,
          workerId: state.workerId,
          success: true,
          loss: meanLoss,
          durationMs: performance.now() - tStart,
        });
      } catch (err: any) {
        state.arena.setWorkerStatus(state.workerId, WORKER_STATUS.ERROR);
        postMessage({
          type: 'RESULT',
          taskId: msg.taskId,
          sequence: msg.sequence,
          workerId: state.workerId,
          success: false,
          error: err?.message || String(err),
          durationMs: performance.now() - tStart,
        });
      }
      break;
    }

    case 'SHUTDOWN': {
      if (state.arena) {
        state.arena.setWorkerStatus(state.workerId, WORKER_STATUS.IDLE);
      }
      break;
    }
  }
}

/**
 * Computes deterministic forward & backward pass for a single micro-batch.
 * Directly writes calculated gradients into workerGradients buffer.
 */
export function computeMicroBatchForwardBackward(
  weights: Float32Array,
  workerGradients: Float32Array,
  batch: TrainingBatchData,
  sequence: number
): { loss: number; dpoDivergence: number; gradientNorm: number } {
  const P = workerGradients.length;
  const seqLen = Math.min(64, batch.tokens.length);
  const H = 64;
  const O = 40;

  // 1. Forward Pass: compute pooled embedding and predicted output logits
  let pooledSum = 0.0;
  for (let t = 0; t < seqLen; t++) {
    const tok = batch.tokens[t] % 369;
    for (let h = 0; h < H; h++) {
      pooledSum += weights[tok * H + h];
    }
  }
  const meanEmb = pooledSum / (seqLen * H);

  // Compute 40-element prediction state
  let loss = 0.0;
  let dpoDivergence = 0.0;
  const target = batch.targetSpatialState;
  const ref = batch.referenceLogits;

  for (let o = 0; o < O; o++) {
    const wVal = weights[P - O + o];
    const pred = Math.tanh(meanEmb + wVal);
    const tgt = target[o] || 0.0;
    const r = ref[o] || 0.0;

    const diff = pred - tgt;
    loss += diff * diff;

    const dpoDiff = pred - r;
    dpoDivergence += dpoDiff * dpoDiff;
  }
  loss = loss / O;
  dpoDivergence = dpoDivergence / O;

  // 2. Backward Pass: compute analytical gradients and store directly in workerGradients
  workerGradients.fill(0);
  const gradScale = 2.0 / O;
  let gradSumSquares = 0.0;
  let dLoss_dMeanEmb = 0.0;

  for (let o = 0; o < O; o++) {
    const wVal = weights[P - O + o];
    const pred = Math.tanh(meanEmb + wVal);
    const tgt = target[o] || 0.0;
    const dLoss_dPred = gradScale * (pred - tgt);
    const dPred_dW = 1.0 - pred * pred; // derivative of tanh
    const g = dLoss_dPred * dPred_dW;

    workerGradients[P - O + o] = g;
    gradSumSquares += g * g;
    dLoss_dMeanEmb += g;
  }

  // Backpropagate to token embeddings
  const tokenGrad = dLoss_dMeanEmb / (seqLen * H);
  for (let t = 0; t < seqLen; t++) {
    const tok = batch.tokens[t] % 369;
    for (let h = 0; h < H; h++) {
      const idx = tok * H + h;
      workerGradients[idx] += tokenGrad;
      gradSumSquares += tokenGrad * tokenGrad;
    }
  }

  const gradientNorm = Math.sqrt(gradSumSquares);
  return { loss, dpoDivergence, gradientNorm };
}

/**
 * Synthetic batch generator for deterministic episode execution.
 */
export function generateSyntheticBatch(seed: number, stepIndex: number): TrainingBatchData {
  const seqLen = 32;
  const tokens: number[] = [];
  for (let i = 0; i < seqLen; i++) {
    tokens.push((seed + stepIndex * 17 + i * 3) % 369);
  }

  const targetSpatialState = new Float32Array(40);
  for (let i = 0; i < 40; i++) {
    targetSpatialState[i] = Math.sin((seed + i) * 0.369 + stepIndex * 0.1) * Math.cos(i * 0.1);
  }

  const referenceLogits = new Float32Array(40);
  for (let i = 0; i < 40; i++) {
    referenceLogits[i] = Math.cos((seed + i) * 0.369 + stepIndex * 0.05);
  }

  return { tokens, targetSpatialState, referenceLogits };
}

/**
 * Pre-serialized JavaScript string for Node.js worker_threads { eval: true }.
 */
export const WORKER_THREAD_CODE_STRING = `
const { parentPort } = require('worker_threads');

let workerId = -1;
let totalWorkers = 0;
let sab = null;
let layout = null;
let header = null;
let weights = null;
let accumGrad = null;
let workspace = null;
let workerGrad = null;

const STATUS = { IDLE: 0, BUSY: 1, DONE: 2, ERROR: 3 };
const STATUS_BASE = 8;

function setStatus(s) {
  if (header && workerId >= 0) {
    Atomics.store(header, STATUS_BASE + workerId, s);
    Atomics.notify(header, STATUS_BASE + workerId, 1);
  }
}

parentPort.on('message', (msg) => {
  const tStart = Date.now();

  try {
    if (msg.type === 'INIT') {
      workerId = msg.workerId;
      totalWorkers = msg.totalWorkers;
      sab = msg.sab;
      layout = msg.layout;
      header = new Int32Array(sab, 0, layout.headerBytes / 4);
      weights = new Float32Array(sab, layout.weightsOffset, layout.weightsLength);
      accumGrad = new Float32Array(sab, layout.accumGradOffset, layout.accumGradLength);
      workspace = new Float32Array(sab, layout.workspaceOffset, layout.workspaceLength);
      const wOffset = layout.workerGradOffset + workerId * layout.workerGradLengthPerWorker * 4;
      workerGrad = new Float32Array(sab, wOffset, layout.workerGradLengthPerWorker);
      setStatus(STATUS.IDLE);
      parentPort.postMessage({ type: 'RESULT', taskId: 'init', sequence: 0, workerId, success: true, durationMs: Date.now() - tStart });
      return;
    }

    if (msg.type === 'PING') {
      parentPort.postMessage({
        type: 'PONG',
        taskId: msg.taskId,
        sequence: msg.sequence || 0,
        workerId,
        timestamp: Date.now(),
        success: true
      });
      return;
    }

    if (msg.type === 'SHUTDOWN') {
      setStatus(STATUS.IDLE);
      process.exit(0);
      return;
    }

    if (msg.type === 'TENSOR_CHUNK') {
      setStatus(STATUS.BUSY);
      if (msg.op === 'matmul') {
        const { rowStart, rowEnd, K, N, offsetA, offsetB, offsetC } = msg;
        for (let i = rowStart; i < rowEnd; i++) {
          const aRow = offsetA + i * K;
          const cRow = offsetC + i * N;
          for (let j = 0; j < N; j++) {
            let sum = 0.0;
            for (let k = 0; k < K; k++) {
              sum += workspace[aRow + k] * workspace[offsetB + k * N + j];
            }
            workspace[cRow + j] = sum;
          }
        }
        setStatus(STATUS.DONE);
        parentPort.postMessage({
          type: 'RESULT',
          taskId: msg.taskId,
          sequence: msg.sequence,
          workerId,
          success: true,
          elementsProcessed: (rowEnd - rowStart) * msg.N,
          durationMs: Date.now() - tStart
        });
      } else if (msg.op === 'reduce_sum') {
        let sum = 0.0;
        const { rowStart, rowEnd, offsetA } = msg;
        for (let i = rowStart; i < rowEnd; i++) {
          sum += workspace[offsetA + i];
        }
        setStatus(STATUS.DONE);
        parentPort.postMessage({
          type: 'RESULT',
          taskId: msg.taskId,
          sequence: msg.sequence,
          workerId,
          success: true,
          computedSum: sum,
          elementsProcessed: rowEnd - rowStart,
          durationMs: Date.now() - tStart
        });
      }
      return;
    }

    if (msg.type === 'BATCH') {
      setStatus(STATUS.BUSY);
      const batch = msg.batch;
      const P = workerGrad.length;
      const seqLen = Math.min(64, batch.tokens.length);
      const H = 64;
      const O = 40;

      let pooledSum = 0.0;
      for (let t = 0; t < seqLen; t++) {
        const tok = batch.tokens[t] % 369;
        for (let h = 0; h < H; h++) {
          pooledSum += weights[tok * H + h];
        }
      }
      const meanEmb = pooledSum / (seqLen * H);

      let loss = 0.0;
      let dpoDivergence = 0.0;
      const target = batch.targetSpatialState;
      const ref = batch.referenceLogits;

      for (let o = 0; o < O; o++) {
        const wVal = weights[P - O + o];
        const pred = Math.tanh(meanEmb + wVal);
        const tgt = target[o] || 0.0;
        const r = ref[o] || 0.0;
        const diff = pred - tgt;
        loss += diff * diff;
        const dpoDiff = pred - r;
        dpoDivergence += dpoDiff * dpoDiff;
      }
      loss = loss / O;
      dpoDivergence = dpoDivergence / O;

      workerGrad.fill(0);
      const gradScale = 2.0 / O;
      let gradSumSquares = 0.0;
      let dLoss_dMeanEmb = 0.0;

      for (let o = 0; o < O; o++) {
        const wVal = weights[P - O + o];
        const pred = Math.tanh(meanEmb + wVal);
        const tgt = target[o] || 0.0;
        const dLoss_dPred = gradScale * (pred - tgt);
        const dPred_dW = 1.0 - pred * pred;
        const g = dLoss_dPred * dPred_dW;
        workerGrad[P - O + o] = g;
        gradSumSquares += g * g;
        dLoss_dMeanEmb += g;
      }

      const tokenGrad = dLoss_dMeanEmb / (seqLen * H);
      for (let t = 0; t < seqLen; t++) {
        const tok = batch.tokens[t] % 369;
        for (let h = 0; h < H; h++) {
          const idx = tok * H + h;
          workerGrad[idx] += tokenGrad;
          gradSumSquares += tokenGrad * tokenGrad;
        }
      }

      const gradientNorm = Math.sqrt(gradSumSquares);
      setStatus(STATUS.DONE);
      parentPort.postMessage({
        type: 'RESULT',
        taskId: msg.taskId,
        sequence: msg.sequence,
        workerId,
        success: true,
        loss,
        dpoDivergence,
        gradientNorm,
        durationMs: Date.now() - tStart
      });
      return;
    }
  } catch (err) {
    setStatus(STATUS.ERROR);
    parentPort.postMessage({
      type: 'RESULT',
      taskId: msg.taskId || 'unknown',
      sequence: msg.sequence || 0,
      workerId,
      success: false,
      error: err ? err.message : String(err),
      durationMs: Date.now() - tStart
    });
  }
});
`;
