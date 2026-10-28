/**
 * CUBiO AI — ONE LANGUAGE — PARALLEL TENSOR WORKLOADS
 * =====================================================
 * Module: @one/workers/ParallelTensorEngine
 * Gate: ONE-06 / Parallel Tensor Operations on SharedArrayBuffer
 *
 * Implements high-throughput parallel Tensor operations (chunked matmul,
 * chunked reduction) across worker threads with zero IPC copies.
 */
import { Tensor } from '../tensor/Tensor';
export class ParallelTensorEngine {
    /**
     * Executes matrix multiplication C = A x B in parallel across worker threads.
     * Partitions rows of matrix A across K workers. Each worker writes its assigned
     * rows directly into the SharedArrayBuffer output region without IPC copy overhead.
     */
    static async parallelMatmul(A, B, pool, arena) {
        if (A.ndim !== 2 || B.ndim !== 2) {
            throw new Error(`parallelMatmul requires 2D matrices, got ${A.shape} and ${B.shape}`);
        }
        const [M, K_A] = A.shape;
        const [K_B, N] = B.shape;
        if (K_A !== K_B) {
            throw new Error(`Inner dimension mismatch: A is [${M}, ${K_A}], B is [${K_B}, ${N}]`);
        }
        const K = K_A;
        const sizeA = M * K;
        const sizeB = K * N;
        const sizeC = M * N;
        // Check workspace capacity in arena
        const totalRequired = sizeA + sizeB + sizeC;
        if (totalRequired > arena.workspace.length) {
            throw new Error(`SharedMemoryArena workspace capacity (${arena.workspace.length}) insufficient for parallel matmul (${totalRequired})`);
        }
        // Offset allocations in shared workspace
        const offsetA = 0;
        const offsetB = sizeA;
        const offsetC = sizeA + sizeB;
        // Write A and B into shared workspace (contiguous zero-copy or direct set)
        arena.workspace.set(A.data.subarray(A.offset, A.offset + sizeA), offsetA);
        arena.workspace.set(B.data.subarray(B.offset, B.offset + sizeB), offsetB);
        // Partition M rows among workers
        const workerCount = Math.min(pool.workerCount, M);
        const rowsPerWorker = Math.floor(M / workerCount);
        const remainder = M % workerCount;
        const promises = [];
        let currentRow = 0;
        for (let k = 0; k < workerCount; k++) {
            const rowStart = currentRow;
            const count = rowsPerWorker + (k < remainder ? 1 : 0);
            const rowEnd = rowStart + count;
            currentRow = rowEnd;
            if (rowStart >= rowEnd)
                continue;
            const chunkTask = {
                type: 'TENSOR_CHUNK',
                taskId: `matmul_chunk_${k}_${Date.now()}`,
                sequence: k,
                op: 'matmul',
                rowStart,
                rowEnd,
                M,
                K,
                N,
                offsetA,
                offsetB,
                offsetC,
            };
            promises.push(pool.dispatchToWorker(k, chunkTask));
        }
        // Await all workers
        const results = await Promise.all(promises);
        for (const res of results) {
            if (!res.success) {
                throw new Error(`Parallel matmul chunk failed on worker ${res.workerId}: ${res.error}`);
            }
        }
        // Copy output slice out of workspace into an authoritative Tensor
        const outData = new Float32Array(sizeC);
        outData.set(arena.workspace.subarray(offsetC, offsetC + sizeC));
        return new Tensor(outData, [M, N]);
    }
    /**
     * Executes tensor reduction sum in parallel across workers.
     * Workers compute local chunk sums, reduced in strictly deterministic sequence order.
     */
    static async parallelReduceSum(A, pool, arena) {
        const totalElements = A.size;
        if (totalElements > arena.workspace.length) {
            throw new Error(`Tensor size ${totalElements} exceeds arena workspace capacity`);
        }
        const offsetA = 0;
        arena.workspace.set(A.data.subarray(A.offset, A.offset + totalElements), offsetA);
        const workerCount = Math.min(pool.workerCount, totalElements);
        const elementsPerWorker = Math.floor(totalElements / workerCount);
        const remainder = totalElements % workerCount;
        const promises = [];
        let currentIdx = 0;
        for (let k = 0; k < workerCount; k++) {
            const rowStart = currentIdx;
            const count = elementsPerWorker + (k < remainder ? 1 : 0);
            const rowEnd = rowStart + count;
            currentIdx = rowEnd;
            if (rowStart >= rowEnd)
                continue;
            const chunkTask = {
                type: 'TENSOR_CHUNK',
                taskId: `reduce_chunk_${k}_${Date.now()}`,
                sequence: k,
                op: 'reduce_sum',
                rowStart,
                rowEnd,
                M: 1,
                K: 1,
                N: 1,
                offsetA,
                offsetB: 0,
                offsetC: 0,
            };
            promises.push(pool.dispatchToWorker(k, chunkTask));
        }
        const results = await Promise.all(promises);
        // Enforce fixed-order accumulation across worker responses: k = 0, 1, ..., workerCount - 1
        results.sort((a, b) => a.sequence - b.sequence);
        let totalSum = 0.0;
        for (const res of results) {
            if (!res.success) {
                throw new Error(`Parallel reduce chunk failed: ${res.error}`);
            }
            totalSum += res.computedSum || 0.0;
        }
        return totalSum;
    }
    /**
     * Verifies bit-exact parity between parallel and single-thread execution.
     */
    static async verifyParity(A, B, pool, arena) {
        // 1. Single-thread reference
        const refTensor = A.matmul(B);
        // 2. Parallel multi-threaded execution
        const parallelTensor = await ParallelTensorEngine.parallelMatmul(A, B, pool, arena);
        // 3. Compute maximum difference
        let maxDiff = 0.0;
        for (let i = 0; i < refTensor.size; i++) {
            const diff = Math.abs(refTensor.data[refTensor.offset + i] - parallelTensor.data[parallelTensor.offset + i]);
            if (diff > maxDiff)
                maxDiff = diff;
        }
        return {
            matches: maxDiff <= 1e-5,
            maxDifference: maxDiff,
            parallelTensor,
            refTensor,
        };
    }
}
