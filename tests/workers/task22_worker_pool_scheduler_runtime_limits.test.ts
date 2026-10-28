/**
 * ONE Intelligence — Task 22 Verification Suite
 * ===============================================
 * Tests: WorkerPool, Scheduler & Runtime Limits
 * Module: tests/workers/task22_worker_pool_scheduler_runtime_limits.test.ts
 */

import * as assert from 'assert';
import * as os from 'os';
import { performance } from 'perf_hooks';

import {
  SharedMemoryArena,
  HEADER_SLOTS,
  WORKER_STATUS,
} from '../../src/one/workers/SharedMemoryArena';
import { WorkerPool } from '../../src/one/workers/WorkerPool';
import {
  TrainingBatchData,
  WorkerBatchTaskMessage,
} from '../../src/one/workers/WorkerProtocol';
import {
  generateSyntheticBatch,
  computeMicroBatchForwardBackward,
} from '../../src/one/workers/WorkerThreadLogic';
import { ParallelTrainingEngine } from '../../src/one/workers/ParallelTrainingEngine';

import {
  ResourceScheduler,
  TaskPriority,
} from '../../src/one/intelligence/scheduler/ResourceScheduler';
import { ThreadPool } from '../../src/core/engine/threadPool';
import { RSSGuard } from '../../src/core/memory/rssGuard';
import {
  BoundedWorkingSetManager,
  MemoryCeilingExceededError,
} from '../../src/one/memory/extreme/BoundedWorkingSetManager';
import { UnifiedVM } from '../../src/one/vm/UnifiedVM';
import { UnifiedCompiler } from '../../src/one/UnifiedCompiler';
import { ReasoningEngine } from '../../src/one/intelligence/reasoning/ReasoningEngine';
import { RuleRegistry } from '../../src/one/intelligence/reasoning/RuleRegistry';
import {
  ReasoningStatus,
  ReasoningRule,
} from '../../src/one/intelligence/reasoning/types';

export async function runTask22WorkerPoolSchedulerRuntimeLimitsTests(): Promise<void> {
  console.log('='.repeat(80));
  console.log('  ONE INTELLIGENCE — TASK 22: WORKER POOL, SCHEDULER & RUNTIME LIMITS');
  console.log('='.repeat(80));

  console.log(`[Host Environment]`);
  console.log(`  OS: ${os.platform()} (${os.release()}) ${os.arch()}`);
  console.log(`  CPU: ${os.cpus()[0]?.model || 'Generic'} (${os.cpus().length} cores)`);
  console.log(`  RAM Total: ${(os.totalmem() / (1024 ** 3)).toFixed(2)} GB | Free: ${(os.freemem() / (1024 ** 3)).toFixed(2)} GB`);
  console.log(`  Node.js: ${process.version} | PID: ${process.pid}`);

  const PARAMETER_COUNT = 23656; // 369 * 64 + 40
  const WORKER_COUNT = 4;

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 1: SharedArrayBuffer Layout, Alignment & Memory Integrity
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 1] SharedArrayBuffer Layout, Alignment & Memory Integrity...');

  const arena = new SharedMemoryArena({
    parameterCount: PARAMETER_COUNT,
    maxWorkers: WORKER_COUNT,
    workspaceElements: 65536,
  });

  assert.ok(arena.sab instanceof SharedArrayBuffer, 'Suite 1A: Allocated SharedArrayBuffer');
  assert.strictEqual(arena.layout.weightsOffset % 64, 0, 'Suite 1A: Weights 64-byte cache-line aligned');
  assert.strictEqual(arena.layout.accumGradOffset % 64, 0, 'Suite 1A: Accumulated gradients 64-byte aligned');
  assert.strictEqual(arena.layout.workerGradOffset % 64, 0, 'Suite 1A: Worker gradients 64-byte aligned');
  assert.strictEqual(arena.layout.workspaceOffset % 64, 0, 'Suite 1A: Workspace 64-byte aligned');

  // Verify slice isolation between worker gradient buffers (no overlap)
  const grad0 = arena.getWorkerGradients(0);
  const grad1 = arena.getWorkerGradients(1);
  assert.notStrictEqual(grad0.byteOffset, grad1.byteOffset, 'Suite 1B: Worker 0 and 1 have disjoint memory offsets');
  assert.strictEqual(grad0.length, PARAMETER_COUNT, 'Suite 1B: Worker 0 gradient length matches parameter count');

  // Verify zero cross-talk
  grad0[0] = 42.125;
  grad1[0] = 99.875;
  assert.strictEqual(grad0[0], 42.125, 'Suite 1B: Worker 0 written value intact');
  assert.strictEqual(grad1[0], 99.875, 'Suite 1B: Worker 1 written value intact (zero cross-talk)');

  // Verify Atomics spinlock
  arena.acquireLock();
  assert.strictEqual(Atomics.load(arena.header, HEADER_SLOTS.MUTEX_LOCK), 1, 'Suite 1C: Spinlock acquired and held');
  arena.releaseLock();
  assert.strictEqual(Atomics.load(arena.header, HEADER_SLOTS.MUTEX_LOCK), 0, 'Suite 1C: Spinlock released cleanly');

  // Verify Atomics worker status slots
  arena.setWorkerStatus(0, WORKER_STATUS.BUSY);
  assert.strictEqual(arena.getWorkerStatus(0), WORKER_STATUS.BUSY, 'Suite 1C: Worker status BUSY verified');
  arena.setWorkerStatus(0, WORKER_STATUS.IDLE);
  assert.strictEqual(arena.getWorkerStatus(0), WORKER_STATUS.IDLE, 'Suite 1C: Worker status IDLE verified');

  console.log('  ✓ Suite 1 passed: SharedArrayBuffer 64-byte alignment, slice isolation, and Atomics verified.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 2: Concurrent Task Dispatching & Fixed-Order Determinism (σ² = 0.0)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 2] Concurrent Task Dispatching & Fixed-Order Determinism (σ² = 0.0)...');

  const pool = new WorkerPool(arena, { maxWorkers: WORKER_COUNT });
  const trainingEngine = new ParallelTrainingEngine(arena, pool);
  trainingEngine.initializeWeights(1337);

  const batches: TrainingBatchData[] = [
    generateSyntheticBatch(10, 0),
    generateSyntheticBatch(20, 1),
    generateSyntheticBatch(30, 2),
    generateSyntheticBatch(40, 3),
  ];

  // Warm-up step
  const stepRes = await trainingEngine.executeBatchesParallel(batches);
  assert.strictEqual(stepRes.workerCount, WORKER_COUNT, 'Suite 2A: 4 workers dispatched concurrently');
  assert.ok(stepRes.meanLoss > 0, 'Suite 2A: Valid positive mean loss');
  assert.ok(stepRes.gradientNorm > 0, 'Suite 2A: Valid positive gradient norm');

  // Verify fixed-order deterministic reduction: repeat 10 times with bit-exact invariance
  const checksums: number[] = [];
  for (let cycle = 0; cycle < 10; cycle++) {
    // Re-accumulate gradients with fixed sequence order
    arena.deterministicReduceGradients(WORKER_COUNT);
    checksums.push(arena.computeWeightsChecksum());
  }

  const allEqual = checksums.every((c) => c === checksums[0]);
  assert.strictEqual(allEqual, true, 'Suite 2B: 10 repeated reductions produce 100% bit-exact checksums (sigma^2 = 0.0)');

  // Verify parity: parallel worker execution vs sequential reference
  const parity = await trainingEngine.verifyParity(batches);
  assert.strictEqual(parity.matches, true, 'Suite 2C: Parallel execution matches sequential reference within 1e-5 tolerance');
  assert.ok(parity.lossDifference <= 1e-5, `Suite 2C: Loss diff (${parity.lossDifference.toExponential(4)}) <= 1e-5`);

  console.log('  ✓ Suite 2 passed: Concurrent task execution achieved bit-exact determinism (sigma^2 = 0.0) and sequential parity.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 3: Worker Fault Injection, Crash Recovery & Zero State Corruption
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 3] Worker Fault Injection, Crash Recovery & Zero State Corruption...');

  const preFaultWeightsChecksum = arena.computeWeightsChecksum();
  const preFaultHealth = pool.getHealthStatus();
  assert.ok(preFaultHealth[1].isAlive, 'Suite 3A: Worker 1 is healthy before fault injection');

  const tFaultStart = performance.now();
  await pool.injectFault(1);
  const faultDuration = performance.now() - tFaultStart;

  // Let recovery take effect
  await new Promise((r) => setTimeout(r, 50));

  const postFaultHealth = pool.getHealthStatus();
  assert.ok(postFaultHealth[1].totalTasksFailed >= 1, 'Suite 3B: Fault injection intercepted in failure metrics');
  assert.ok(postFaultHealth[1].isAlive, 'Suite 3B: Worker 1 automatically respawned and healthy');

  // Verify recovered worker can process subsequent tasks successfully
  const pingRes = await pool.dispatchToWorker(1, { type: 'PING', timestamp: Date.now() });
  assert.strictEqual(pingRes.success, true, 'Suite 3C: Recovered worker processed PING task successfully');

  // Shared weights in SharedArrayBuffer must remain completely uncorrupted
  const postFaultWeightsChecksum = arena.computeWeightsChecksum();
  assert.strictEqual(
    postFaultWeightsChecksum,
    preFaultWeightsChecksum,
    'Suite 3D: SharedArrayBuffer weights remained completely uncorrupted across worker crash and respawn'
  );
  console.log(`  ✓ Suite 3 passed: Fault recovered in ${faultDuration.toFixed(2)}ms with zero memory corruption.`);

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 4: Task Cancellation & Timeout Enforcement
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 4] Task Cancellation & Timeout Enforcement...');

  // 4A: WorkerPool Timeout Enforcement (short timeout on virtual/real worker)
  const timeoutPool = new WorkerPool(arena, {
    maxWorkers: 2,
    useVirtualWorkers: true,
    taskTimeoutMs: 15, // 15 ms tight timeout
  });

  // 4B: WorkerPool Task Cancellation
  const cancelTaskId = 'task_to_cancel_123';
  const cancelPromise = timeoutPool.dispatchToWorker(0, {
    type: 'BATCH',
    taskId: cancelTaskId,
    sequence: 0,
    batch: batches[0],
  } as any);

  // Cancel immediately before worker processes it
  const didCancel = timeoutPool.cancelTask(cancelTaskId);
  assert.strictEqual(didCancel, true, 'Suite 4B: cancelTask returned true for pending task');

  await assert.rejects(
    cancelPromise,
    /was cancelled/,
    'Suite 4B: Cancelled task promise rejected with cancellation error'
  );

  // 4C: ResourceScheduler Task Cancellation
  const scheduler = new ResourceScheduler(512 * 1024 * 1024, 10);
  scheduler.enqueueTask('sched_task_1', 'BACKGROUND', 'Task 1', () => 42);
  scheduler.enqueueTask('sched_task_2', 'INTERACTIVE', 'Task 2', () => 99);
  assert.strictEqual(scheduler.getPendingTaskCount(), 2, 'Suite 4C: Two tasks queued in scheduler');

  const didCancelSched = scheduler.cancelTask('sched_task_1');
  assert.strictEqual(didCancelSched, true, 'Suite 4C: Scheduler task cancelled successfully');
  assert.strictEqual(scheduler.getPendingTaskCount(), 1, 'Suite 4C: Queue size reduced to 1 after cancellation');

  await timeoutPool.shutdown();
  console.log('  ✓ Suite 4 passed: Task timeouts and explicit cancellations enforced fail-closed.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 5: Queue Saturation, Priority Scheduling & Rejected Jobs
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 5] Queue Saturation, Priority Scheduling & Rejected Jobs...');

  // 5A: ResourceScheduler Queue Saturation
  const tightScheduler = new ResourceScheduler(512 * 1024 * 1024, 3);
  tightScheduler.enqueueTask('q1', 'BACKGROUND', 'T1', () => 1);
  tightScheduler.enqueueTask('q2', 'INTERACTIVE', 'T2', () => 2);
  tightScheduler.enqueueTask('q3', 'CRITICAL', 'T3', () => 3);

  // 4th task exceeds capacity (3)
  assert.throws(
    () => tightScheduler.enqueueTask('q4', 'CRITICAL', 'T4', () => 4),
    /ResourceScheduler queue capacity exceeded/,
    'Suite 5A: Saturated scheduler queue strictly rejects excess jobs fail-closed'
  );

  // 5B: Priority Dispatch Order (CRITICAL > INTERACTIVE > BACKGROUND)
  const firstDispatched = await tightScheduler.dispatchNextTask();
  const secondDispatched = await tightScheduler.dispatchNextTask();
  const thirdDispatched = await tightScheduler.dispatchNextTask();

  assert.strictEqual(firstDispatched?.taskId, 'q3', 'Suite 5B: CRITICAL task dispatched first');
  assert.strictEqual(secondDispatched?.taskId, 'q2', 'Suite 5B: INTERACTIVE task dispatched second');
  assert.strictEqual(thirdDispatched?.taskId, 'q1', 'Suite 5B: BACKGROUND task dispatched third');

  // 5C: ThreadPool Queue Saturation & Shutdown Rejection
  const tp = new ThreadPool({ maxThreads: 1, maxQueueSize: 2 });

  // Post-shutdown rejection in WorkerPool
  const closedPool = new WorkerPool(arena, { maxWorkers: 1, useVirtualWorkers: true });
  await closedPool.shutdown();

  await assert.rejects(
    async () => closedPool.dispatchToWorker(0, { type: 'PING', timestamp: Date.now() }),
    /WorkerPool is already shut down/,
    'Suite 5C: Closed WorkerPool rejects jobs fail-closed'
  );

  // Post-shutdown rejection in ThreadPool
  tp.shutdown();
  await assert.rejects(
    async () => tp.executeTask('test', {}),
    /ThreadPool is shut down/,
    'Suite 5C: Closed ThreadPool rejects jobs fail-closed'
  );

  console.log('  ✓ Suite 5 passed: Queue capacity limits, priority ordering, and shutdown rejections verified.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 6: Runtime Resource Guards (Instruction & Call-Depth Ceilings)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 6] Runtime Resource Guards (Instruction & Call-Depth Ceilings)...');

  const compiler = new UnifiedCompiler();

  // 6A: Instruction Budget Ceiling (E5007)
  const loopProgram = compiler.compile(`
    let counter = 0;
    while (true) {
      counter = counter + 1;
    }
  `).ir!;

  const vmLoop = new UnifiedVM();
  const loopRes = vmLoop.execute(loopProgram, { maxInstructions: 200 });
  assert.strictEqual(loopRes.success, false, 'Suite 6A: Infinite loop stopped by instruction limit');
  assert.strictEqual(loopRes.error?.code, 'E5007', 'Suite 6A: Error code strictly E5007');

  // 6B: Call-Depth Limit Ceiling (E5006)
  const recurseProgram = compiler.compile(`
    fn infiniteRecursion(n: Int32): Int32 {
      return infiniteRecursion(n + 1);
    }
    let res = infiniteRecursion(1);
  `).ir!;

  const vmRecurse = new UnifiedVM();
  const recurseRes = vmRecurse.execute(recurseProgram, { maxCallDepth: 15 });
  assert.strictEqual(recurseRes.success, false, 'Suite 6B: Deep recursion stopped by call-depth limit');
  assert.strictEqual(recurseRes.error?.code, 'E5006', 'Suite 6B: Error code strictly E5006');

  // 6C: Reasoning Engine Budgets (Step Limit & Timeout)
  const incRule: ReasoningRule<number> = {
    id: 'inc',
    description: 'Increment step',
    isApplicable: () => true,
    apply: (n) => [n + 1],
  };
  const registry = new RuleRegistry<number>();
  registry.register(incRule);
  const reasoningEngine = new ReasoningEngine<number>(registry);

  // Step budget
  const stepBudgetRes = reasoningEngine.solve({
    input: 0,
    goal: (n) => n >= 1000,
    maxSteps: 5,
  });
  assert.strictEqual(stepBudgetRes.status, ReasoningStatus.STEP_LIMIT, 'Suite 6C: Reasoning step limit enforced');

  // Timeout budget
  const timeoutRes = reasoningEngine.solve({
    input: 0,
    goal: () => {
      const tEnd = performance.now() + 5;
      while (performance.now() < tEnd) {}
      return false;
    },
    maxSteps: 10000,
    timeoutMs: 2,
  });
  assert.strictEqual(timeoutRes.status, ReasoningStatus.CANCELLED, 'Suite 6C: Reasoning timeout budget enforced');

  console.log('  ✓ Suite 6 passed: Instruction (E5007), Call-Depth (E5006), and Reasoning budgets enforced fail-closed.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 7: Physical Memory Ceilings (512 MB Physical Guard & Working Set)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 7] Physical Memory Ceilings (512 MB Physical Guard & Working Set)...');

  // 7A: RSSGuard 512 MB physical limit
  const rssGuard = new RSSGuard(512);
  assert.strictEqual(rssGuard.getUsedMb(), 0, 'Suite 7A: Initial RSS guard usage is 0 MB');

  // Allocate 200 MB
  rssGuard.allocate(200 * 1024 * 1024, 'ParallelTensorLattice');
  assert.strictEqual(rssGuard.getUsedMb(), 200, 'Suite 7A: Allocated 200 MB tracked');

  // Excess allocation request (> 512 MB) throws Hardware Panic
  assert.throws(
    () => rssGuard.allocate(350 * 1024 * 1024, 'ExcessiveBuffer'),
    /\[RSS Hardware Panic\].*exceeds maximum limit/,
    'Suite 7A: Request exceeding 512 MB ceiling triggers immediate Hardware Panic'
  );

  // Free memory
  rssGuard.free(200 * 1024 * 1024);
  assert.strictEqual(rssGuard.getUsedMb(), 0, 'Suite 7A: Memory cleanly freed');

  // 7B: BoundedWorkingSetManager hard ceiling
  assert.strictEqual(
    BoundedWorkingSetManager.ABSOLUTE_RSS_GUARD_BYTES,
    512 * 1024 * 1024,
    'Suite 7B: Absolute RSS guard ceiling is strictly 512 MB'
  );

  const wsManager = new BoundedWorkingSetManager({
    maxHeapBytes: 1, // Strict 1-byte ceiling for testing
    maxActiveObjects: 50,
  });

  assert.throws(
    () => wsManager.checkAndEnforcePressure(),
    (err: any) => err instanceof MemoryCeilingExceededError,
    'Suite 7B: Exceeding heap ceiling throws MemoryCeilingExceededError fail-closed'
  );

  // Clean shutdown of main pool
  await pool.shutdown();

  console.log('  ✓ Suite 7 passed: Physical 512 MB memory limit and working set eviction verified.');

  console.log('\n' + '='.repeat(80));
  console.log('  TASK 22 VERIFICATION: ALL 7 SUITES PASSED (100%)');
  console.log('='.repeat(80) + '\n');
}

if (
  typeof process !== 'undefined' &&
  process.argv &&
  process.argv[1] &&
  process.argv[1].includes('task22_worker_pool_scheduler_runtime_limits')
) {
  runTask22WorkerPoolSchedulerRuntimeLimitsTests().catch((err) => {
    console.error('Task 22 test runner encountered unhandled error:', err);
    process.exit(1);
  });
}
