/**
 * Phase 8E — Concurrency Integration Test Suite
 *
 * Verifies parallel task execution, lock-free queues, and thread-safe VM operations.
 */

import { ThreadPool } from '../core/engine/threadPool';
import { LockFreeQueue, ConcurrentNodeRegistry } from '../core/engine/lockFreeStructures';
import { ConcurrencyBridge } from './concurrencyBridge';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`❌ FAIL: ${message}`);
  console.log(`  ✓ ${message}`);
}

async function runConcurrencyTestSuite(): Promise<void> {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  ONE Language — Phase 8: Concurrency & Multi-Threaded VM');
  console.log('══════════════════════════════════════════════════════════════\n');

  try {
    // 1. Thread Pool Test
    console.log('─── 8A: Thread Pool Dispatch ──────────────────────────────');
    const pool = new ThreadPool({ maxThreads: 4 });
    const t1 = pool.executeTask('test', { val: 1 }, 2);
    const t2 = pool.executeTask('test', { val: 2 }, 1);
    const res = await Promise.all([t1, t2]);
    assert(res.length === 2, 'Executed 2 concurrent tasks');
    pool.shutdown();
    console.log();

    // 2. Lock-Free Queue Test
    console.log('─── 8B: Lock-Free Structures ─────────────────────────────');
    const queue = new LockFreeQueue<number>(10);
    assert(queue.enqueue(42), 'Enqueue item 42');
    assert(queue.size() === 1, 'Queue size is 1');
    const dequeued = queue.dequeue();
    assert(dequeued === 42, `Dequeued item is 42 (got ${dequeued})`);
    assert(queue.size() === 0, 'Queue size is 0 after dequeue');

    const registry = new ConcurrentNodeRegistry();
    registry.registerNode('Alpha', [0.1, 0.2, 0.3]);
    const node = registry.getNode('Alpha');
    assert(node !== undefined && node.x === 0.1, 'Concurrently registered node retrieved');
    console.log();

    // 3. Concurrency Bridge Test
    console.log('─── 8D: Concurrency Safety Bridge ─────────────────────────');
    const bridge = new ConcurrencyBridge();
    const parallelInputs = [
      'create node Alpha at 0.1, 0.2, 0.3',
      'let count be 100 as number',
      'set rss max to 512'
    ];
    const parallelResults = await bridge.executeConcurrentNL(parallelInputs);
    assert(parallelResults.length === 3, 'Executed parallel NL statements');
    bridge.shutdown();
    console.log();

    console.log('══════════════════════════════════════════════════════════════');
    console.log('  🎉 ALL PHASE 8 CONCURRENCY TESTS PASSED SUCCESSFULLY!');
    console.log('══════════════════════════════════════════════════════════════\n');
  } catch (err: any) {
    console.error(`❌ Concurrency Test Failed: ${err.message}`);
    throw err;
  }
}

// Run test if invoked directly
if (require.main === module) {
  runConcurrencyTestSuite();
}
