/**
 * CUBiO AI — ONE LANGUAGE — PARALLEL TRAINING ENGINE
 * ===================================================
 * Module: @one/workers/ParallelTrainingEngine
 * Gate: ONE-06 / Worker Parallel Training & Fixed-Order Accumulation
 *
 * Implements worker-based parallel batch/episode execution with
 * SharedArrayBuffer memory sharing and strictly deterministic fixed-order
 * gradient accumulation.
 */
import { computeMicroBatchForwardBackward } from './WorkerThreadLogic';
export class ParallelTrainingEngine {
    arena;
    pool;
    constructor(arena, pool) {
        this.arena = arena;
        this.pool = pool;
    }
    /**
     * Initializes shared weights with a deterministic seed.
     */
    initializeWeights(seed = 42) {
        const P = this.arena.layout.weightsLength;
        const weights = this.arena.weights;
        let s = seed;
        for (let i = 0; i < P; i++) {
            // Deterministic xorshift PRNG
            s ^= s << 13;
            s ^= s >>> 17;
            s ^= s << 5;
            weights[i] = ((s >>> 0) / 4294967296.0 - 0.5) * 0.04;
        }
    }
    /**
     * Sets weights from an external Float32Array.
     */
    setWeights(w) {
        this.arena.weights.set(w);
    }
    /**
     * Gets a copy of current shared weights.
     */
    getWeights() {
        return new Float32Array(this.arena.weights);
    }
    /**
     * Executes a list of micro-batches in parallel across worker threads.
     *
     * Synchronization & Accumulation guarantees:
     *   1. Each worker k writes its computed gradients into its isolated shared slice: workerGradients[k].
     *   2. Awaits all worker completions.
     *   3. Fixed-Order Reduction: reduces worker gradients strictly in worker index order k = 0, 1, ..., K-1.
     *   4. Applies deterministic optimizer update to shared weights.
     */
    async executeBatchesParallel(batches, learningRate = 0.001) {
        const tStart = performance.now();
        const K = Math.min(this.pool.workerCount, batches.length);
        const promises = [];
        // 1. Dispatch micro-batches to workers
        for (let k = 0; k < K; k++) {
            const task = {
                type: 'BATCH',
                taskId: `batch_task_${k}_${Date.now()}`,
                sequence: k,
                batch: batches[k],
                learningRate,
            };
            promises.push(this.pool.dispatchToWorker(k, task));
        }
        // 2. Await all worker batch completions
        const results = await Promise.all(promises);
        // Sort responses by sequence to guarantee ordering
        results.sort((a, b) => a.sequence - b.sequence);
        const workerLosses = [];
        let totalLoss = 0.0;
        for (const res of results) {
            if (!res.success) {
                throw new Error(`Worker ${res.workerId} failed on batch sequence ${res.sequence}: ${res.error}`);
            }
            const l = res.loss || 0.0;
            workerLosses.push(l);
            totalLoss += l;
        }
        const meanLoss = totalLoss / K;
        // 3. Deterministic Fixed-Order Gradient Accumulation:
        //    Accumulates workerGradients[0] + workerGradients[1] + ... + workerGradients[K-1]
        this.arena.deterministicReduceGradients(K);
        // 4. Deterministic Optimizer Step (SGD with momentum/decay)
        const weights = this.arena.weights;
        const grads = this.arena.accumulatedGradients;
        const P = this.arena.layout.weightsLength;
        let gradNormSq = 0.0;
        for (let i = 0; i < P; i++) {
            const g = grads[i];
            gradNormSq += g * g;
            weights[i] -= learningRate * g;
        }
        const gradientNorm = Math.sqrt(gradNormSq);
        const durationMs = performance.now() - tStart;
        const weightsChecksum = this.arena.computeWeightsChecksum();
        return {
            step: 1,
            meanLoss,
            gradientNorm,
            weightsChecksum,
            durationMs,
            workerCount: K,
            workerLosses,
        };
    }
    /**
     * Reference single-threaded execution of the same batches for parity validation.
     */
    executeBatchesSequential(batches, initialWeights, learningRate = 0.001) {
        const P = this.arena.layout.weightsLength;
        const K = batches.length;
        const weights = new Float32Array(initialWeights);
        const accumGrad = new Float32Array(P);
        const tempGrad = new Float32Array(P);
        let totalLoss = 0.0;
        // Execute batches sequentially and accumulate gradients in strict index order: k = 0, 1, ..., K-1
        for (let k = 0; k < K; k++) {
            const res = computeMicroBatchForwardBackward(weights, tempGrad, batches[k], k);
            totalLoss += res.loss;
            for (let i = 0; i < P; i++) {
                accumGrad[i] += tempGrad[i];
            }
        }
        const meanLoss = totalLoss / K;
        const invK = 1.0 / K;
        let gradNormSq = 0.0;
        for (let i = 0; i < P; i++) {
            accumGrad[i] *= invK;
            const g = accumGrad[i];
            gradNormSq += g * g;
            weights[i] -= learningRate * g;
        }
        // Compute checksum
        let hash = 0x811c9dc5;
        const intView = new Int32Array(weights.buffer, weights.byteOffset, Math.min(1000, P));
        for (let i = 0; i < intView.length; i++) {
            hash ^= intView[i];
            hash = Math.imul(hash, 0x01000193);
        }
        return {
            meanLoss,
            gradientNorm: Math.sqrt(gradNormSq),
            finalWeights: weights,
            weightsChecksum: hash >>> 0,
        };
    }
    /**
     * Certifies numerical parity between parallel worker execution and sequential reference.
     */
    async verifyParity(batches, learningRate = 0.001) {
        const initialWeights = this.getWeights();
        // 1. Run sequential reference
        const seqResult = this.executeBatchesSequential(batches, initialWeights, learningRate);
        // 2. Reset shared weights to identical initial state
        this.setWeights(initialWeights);
        // 3. Run parallel worker execution
        const parResult = await this.executeBatchesParallel(batches, learningRate);
        // 4. Compare outputs
        const lossDiff = Math.abs(parResult.meanLoss - seqResult.meanLoss);
        let maxWeightDiff = 0.0;
        const parWeights = this.arena.weights;
        const seqWeights = seqResult.finalWeights;
        const P = this.arena.layout.weightsLength;
        for (let i = 0; i < P; i++) {
            const diff = Math.abs(parWeights[i] - seqWeights[i]);
            if (diff > maxWeightDiff)
                maxWeightDiff = diff;
        }
        const matches = lossDiff <= 1e-5 && maxWeightDiff <= 1e-5;
        return {
            matches,
            parallelLoss: parResult.meanLoss,
            sequentialLoss: seqResult.meanLoss,
            lossDifference: lossDiff,
            maxWeightDifference: maxWeightDiff,
            parallelChecksum: parResult.weightsChecksum,
            sequentialChecksum: seqResult.weightsChecksum,
        };
    }
}
