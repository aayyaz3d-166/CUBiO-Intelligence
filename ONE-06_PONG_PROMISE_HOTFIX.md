# ONE-06 HOTFIX REPORT — PONG PROMISE RESOLUTION

**Target Subsystem:** `src/one/workers/WorkerPool.ts`, `WorkerProtocol.ts`, `WorkerThreadLogic.ts`  
**Execution Context:** ONE-06 / Multi-Threaded Numeric & Training Acceleration  
**Date:** September 28, 2026  
**Status:** **HOTFIX VERIFIED & RESOLVED (PONG IPC Hang Eliminated)**

---

## 1. Root Cause Summary

When executing `pool.broadcast({ type: 'PING', timestamp: Date.now() })` during Gate 2 testing:
1. **Unresolved Callback:** In `src/one/workers/WorkerPool.ts:handleWorkerResponse`, incoming `PONG` messages were caught by `if (msg.type === 'PONG') { return; }`. The method returned immediately without resolving or removing the callback registered in `pendingCallbacks` or `activeTasks`.
2. **Missing Correlation ID:** Outgoing `PING` messages in `dispatchToWorker` did not have `taskId` and `sequence` attached to the outgoing message object before calling `worker.postMessage()`.
3. **Missing Response Metadata:** In `WorkerThreadLogic.ts` (both in-process `executeWorkerTask` and `WORKER_THREAD_CODE_STRING`), the worker responded to `PING` with `{ type: 'PONG', workerId, timestamp: Date.now() }`, omitting `taskId`, `sequence`, and `success: true`.

Consequently, the Promise returned by `dispatchToWorker` for each worker thread remained unresolved indefinitely, deadlocking `Promise.all` in `broadcast()` and causing Gate 2 to hang after `[ONE06-18]`.

---

## 2. Implemented Fix

The hotfix strictly adheres to the existing `WorkerPool` architecture and message contracts without redesign:

### 2.1 `src/one/workers/WorkerProtocol.ts`
- Added optional `taskId?: string; sequence?: number;` to `WorkerPingMessage`.
- Added optional `taskId?: string; sequence?: number; success?: boolean;` to `WorkerPongMessage`.

### 2.2 `src/one/workers/WorkerThreadLogic.ts`
- Updated both `executeWorkerTask` and `WORKER_THREAD_CODE_STRING` to return `taskId`, `sequence`, and `success: true` when responding to `PING`.

### 2.3 `src/one/workers/WorkerPool.ts`
- **`dispatchToWorker`:** Attached `taskId` and `sequence` to the outgoing message (`(message as any).taskId = taskId; (message as any).sequence = sequence;`).
- **`handleWorkerResponse`:** On `msg.type === 'PONG'`:
  - Cleared `activeTasks` and reset `healthRecords[workerId].currentTaskId / currentSequence`.
  - Incremented `healthRecords[workerId].totalTasksCompleted++`.
  - Looked up `pendingCallbacks.get(taskId)` (with fallback to `active.resolve`), removed it from the map, and resolved the Promise with the PONG message.

---

## 3. Verification Results (`npm run test:one06`)

Execution was run via `npm run test:one06`. 

```
================================================================================
  ONE LANGUAGE — TASK ONE-06: WORKERS + SHAREDARRAYBUFFER TEST SUITE
  Subsystems: SharedMemoryArena, WorkerPool, ParallelTensor, ParallelTraining
================================================================================

[GATE 1/8] Verifying SharedArrayBuffer Layout, Alignment & Atomics...
  ✓ PASS [ONE06-01] Arena allocated an authoritative SharedArrayBuffer
  ✓ PASS [ONE06-02] Total allocated bytes computed correctly
  ✓ PASS [ONE06-03] Weights buffer offset is 64-byte cache-line aligned
  ✓ PASS [ONE06-04] Accumulated gradients offset is 64-byte aligned
  ✓ PASS [ONE06-05] Worker gradients offset is 64-byte aligned
  ✓ PASS [ONE06-06] Workspace offset is 64-byte aligned
  ✓ PASS [ONE06-07] Weights length matches 148912 parameters
  ✓ PASS [ONE06-08] Accumulated gradients length matches parameter count
  ✓ PASS [ONE06-09] Worker 0 and Worker 1 gradient buffers occupy disjoint memory offsets
  ✓ PASS [ONE06-10] Each worker gradient buffer has full parameter capacity
  ✓ PASS [ONE06-11] Writing to Worker 0 gradients does not mutate Worker 1 gradients (zero cross-talk)
  ✓ PASS [ONE06-12] Atomics spinlock acquired and held
  ✓ PASS [ONE06-13] Atomics spinlock released cleanly
  ✓ PASS [ONE06-14] Worker 0 status correctly updated to BUSY
  ✓ PASS [ONE06-15] Worker 0 status correctly reset to IDLE

[GATE 2/8] Verifying Worker Pool Lifecycle, IPC Protocol & Health...
  ✓ PASS [ONE06-16] WorkerPool initialized exactly 4 worker threads
  ✓ PASS [ONE06-17] Health status tracks all workers in pool
  ✓ PASS [ONE06-18] All worker threads report alive and healthy
  ✓ PASS [ONE06-19] All workers responded to broadcast PING

[GATE 3/8] Verifying Worker Failure Detection & Automatic Task Recovery...
  ✓ PASS [ONE06-20] Worker failure immediately intercepted and recorded
  ✓ PASS [ONE06-21] Interrupted worker automatically respawned and executed task to completion
  ✓ PASS [ONE06-22] Recovered worker thread reports alive and healthy

[GATE 4/8] Verifying Parallel Tensor Workloads on SharedArrayBuffer...
  ✓ PASS [ONE06-23] Parallel matmul produced correct [64, 64] shape
  ✓ PASS [ONE06-24] Parallel matmul matches single-threaded reference (maxDiff = 0.0000e+0 <= 1e-5)
  ✓ PASS [ONE06-25] Parallel reduction sum matches single-threaded sum (diff = 1.4607e-7 <= 1e-4)

[GATE 5/8] Verifying Parallel Batch Execution & Fixed-Order Accumulation...
  ✓ PASS [ONE06-26] Executed batches across all 4 workers
  ✓ PASS [ONE06-27] Valid mean loss computed: 0.267602
  ✓ PASS [ONE06-28] Valid gradient norm: 0.150991
  ✓ PASS [ONE06-29] Weights updated with non-zero checksum: 0x461b8bc6

[GATE 6/8] Verifying Concurrency & Race-Condition Freedom...
  ✗ FAIL [ONE06-30] Worker 0 and 1 computed distinct gradients for distinct batches
```

---

## 4. Hotfix Verification Criteria

| Verification Item | Target | Result | Status |
| :--- | :--- | :--- | :---: |
| **Gate 1 Status** | Maintain 100% Pass | 15/15 Pass ([ONE06-01] - [ONE06-15]) | **PASS** |
| **Gate 2 Completion** | Complete beyond [ONE06-18] | Passed [ONE06-19] without hang | **PASS** |
| **`broadcast(PING)`** | Return cleanly for all workers | All 4 worker threads responded to PING | **PASS** |
| **IPC Hang / Timeout** | Zero unhandled / unresolved promises | Clean resolution, execution progressed to Gate 6 | **PASS** |
| **Downstream Execution** | Progress through Gates 3, 4, 5 | Gates 3, 4, and 5 passed completely | **PASS** |
| **Exact Test Outcome** | Progressed past Gate 2; stopped at Gate 6 | Failed at `[ONE06-30]` in Gate 6 | **RECORDED** |

---

## 5. Scope Adherence

- **WorkerPool Redesign:** None. Utilized existing `pendingCallbacks` and `activeTasks` mappings.
- **Unrelated Systems:** Zero changes outside `WorkerPool.ts`, `WorkerProtocol.ts`, and `WorkerThreadLogic.ts`.
- **Production Models & Weights:** None touched.
- **Commands Used:** Only `npm run test:one06` (no `npx tsx -e`).
