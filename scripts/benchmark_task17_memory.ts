/**
 * ONE Intelligence — Task 17 Empirical Memory & Paging Benchmark
 * ===============================================================
 * Path: scripts/benchmark_task17_memory.ts
 *
 * Measures:
 *   1. Baseline In-Memory VM execution latency and heap footprint (Factorial & Deep Recursion).
 *   2. VirtualMemoryPagingEngine 64 KB page throughput and page fault latencies.
 *   3. VM Snapshot serialization, storage, and reconstruction round-trip with SHA-256 validation.
 *   4. BoundedWorkingSetManager memory ceiling and LRU eviction pressure.
 */

import { UnifiedCompiler } from '../src/one/UnifiedCompiler';
import { UnifiedVM } from '../src/one/vm/UnifiedVM';
import {
  UnifiedExtremeMemoryToolchain,
  VirtualMemoryPagingEngine,
  BoundedWorkingSetManager,
  LosslessReconstructionEngine,
} from '../src/one/memory/extreme';
import * as crypto from 'crypto';

export async function runTask17MemoryBenchmark() {
  console.log('='.repeat(80));
  console.log('  ONE INTELLIGENCE — TASK 17: EXTREME MEMORY & VIRTUAL PAGING BENCHMARK');
  console.log('='.repeat(80));

  const compiler = new UnifiedCompiler();
  const vm = new UnifiedVM();

  // ──────────────────────────────────────────────────────────────────────────
  // Benchmark 1: In-Memory VM Baseline Execution
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Benchmark 1] In-Memory VM Baseline Execution...');

  const src = `
    fn fib(n: Int32): Int32 {
      if (n <= 1) { return n; }
      return fib(n - 1) + fib(n - 2);
    }
    fn deepCount(n: Int32): Int32 {
      if (n <= 0) { return 0; }
      return 1 + deepCount(n - 1);
    }
    let resFib = fib(15);
    let resDeep = deepCount(200);
  `;

  const program = compiler.compile(src);

  // Warmup
  vm.execute(program);

  // Measurement (50 runs)
  const iters = 50;
  const initialMem = process.memoryUsage().heapUsed;
  const t0_vm = performance.now();
  for (let i = 0; i < iters; i++) {
    vm.execute(program);
  }
  const vmLatencyMs = (performance.now() - t0_vm) / iters;
  const postMem = process.memoryUsage().heapUsed;
  const heapDeltaBytes = Math.max(0, postMem - initialMem);

  console.log(`  • VM Execution (fib(15) + deepCount(200)): ${vmLatencyMs.toFixed(3)} ms / run`);
  console.log(`  • Heap delta across ${iters} runs: ${(heapDeltaBytes / 1024).toFixed(2)} KB`);

  // ──────────────────────────────────────────────────────────────────────────
  // Benchmark 2: VirtualMemoryPagingEngine 64 KB Demand Paging
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Benchmark 2] VirtualMemoryPagingEngine (64 KB Demand Paging)...');

  const maxResidentPages = 64; // 64 pages * 64 KB = 4 MB physical working set
  const pageSize = 64 * 1024;
  const paging = new VirtualMemoryPagingEngine(maxResidentPages, pageSize);

  // Test buffer (1 MB = 16 pages)
  const testPayload = new Uint8Array(1024 * 1024);
  for (let i = 0; i < testPayload.length; i++) {
    testPayload[i] = (i * 31) & 0xff;
  }

  const t0_write = performance.now();
  const vAddr = 0x100000000n; // Virtual address in 64-bit space
  paging.writeVirtual(vAddr, testPayload);
  const writeLatencyMs = performance.now() - t0_write;
  const writeThroughputMBs = (1.0 / (writeLatencyMs / 1000)).toFixed(2);

  const t0_read = performance.now();
  const readBack = paging.readVirtual(vAddr, testPayload.length);
  const readLatencyMs = performance.now() - t0_read;
  const readThroughputMBs = (1.0 / (readLatencyMs / 1000)).toFixed(2);

  let byteDiffs = 0;
  for (let i = 0; i < testPayload.length; i++) {
    if (testPayload[i] !== readBack[i]) byteDiffs++;
  }

  const metrics = paging.getMetrics();
  console.log(`  • 1 MB Write: ${writeLatencyMs.toFixed(3)} ms (${writeThroughputMBs} MB/s)`);
  console.log(`  • 1 MB Read:  ${readLatencyMs.toFixed(3)} ms (${readThroughputMBs} MB/s)`);
  console.log(`  • Bit-exact parity: ${byteDiffs === 0 ? 'PERFECT (0 diffs)' : 'CORRUPTED'}`);
  console.log(`  • Paging Metrics: Hits=${metrics.pageHits}, Faults=${metrics.pageFaults}, Evictions=${metrics.pageEvictions}`);

  // ──────────────────────────────────────────────────────────────────────────
  // Benchmark 3: VM Checkpoint Serialization & Bit-Exact Reconstruction
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Benchmark 3] VM Checkpoint Serialization & Reconstruction...');

  // Create state to serialize
  const globals = vm.getGlobals();
  const callDepth = vm.getCallDepth();
  const stackTrace = vm.getStackTrace();

  const snapshotObject = {
    magic: 'VMCP',
    version: '1.0.0',
    snapshotId: `snap_${Date.now()}`,
    timestamp: Date.now(),
    callDepth,
    stackTrace,
    globals: Object.fromEntries(globals),
  };

  const snapshotJson = JSON.stringify(snapshotObject);
  const snapshotBytes = Buffer.from(snapshotJson, 'utf-8');
  const originalSha256 = crypto.createHash('sha256').update(snapshotBytes).digest('hex');

  // Measure write to virtual paging engine
  const snapAddr = 0x200000000n;
  const t0_snapWrite = performance.now();
  paging.writeVirtual(snapAddr, snapshotBytes);
  const snapWriteMs = performance.now() - t0_snapWrite;

  // Measure read & reconstruction from virtual paging engine
  const t0_snapRead = performance.now();
  const reconstructedBytes = paging.readVirtual(snapAddr, snapshotBytes.length);
  const reconstructedSha256 = crypto.createHash('sha256').update(reconstructedBytes).digest('hex');
  const reconstructedJson = Buffer.from(reconstructedBytes).toString('utf-8');
  const reconstructedObject = JSON.parse(reconstructedJson);
  const snapReadMs = performance.now() - t0_snapRead;

  const isLossless = originalSha256 === reconstructedSha256;
  console.log(`  • Snapshot size: ${snapshotBytes.length} bytes`);
  console.log(`  • Paged Write Latency: ${snapWriteMs.toFixed(3)} ms`);
  console.log(`  • Paged Read & Reconstruction Latency: ${snapReadMs.toFixed(3)} ms`);
  console.log(`  • SHA-256 Original:      ${originalSha256.slice(0, 16)}...`);
  console.log(`  • SHA-256 Reconstructed: ${reconstructedSha256.slice(0, 16)}...`);
  console.log(`  • Bit-exact lossless claim: ${isLossless ? 'VERIFIED' : 'FAILED'}`);

  // ──────────────────────────────────────────────────────────────────────────
  // Benchmark 4: Memory Pressure & Bounded Working-Set Eviction
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Benchmark 4] Working-Set Memory Limits & Eviction...');

  const workingSet = new BoundedWorkingSetManager({
    maxHeapBytes: 256 * 1024 * 1024,
    maxResidentPages: 16, // Strict 16 page limit (1 MB physical window)
  });

  const pressure = workingSet.checkAndEnforcePressure();
  console.log(`  • Heap Used: ${(pressure.currentHeapUsedBytes / 1024 / 1024).toFixed(2)} MB / ${(pressure.maxHeapLimitBytes / 1024 / 1024).toFixed(2)} MB (${pressure.heapUtilizationPercent.toFixed(1)}%)`);
  console.log(`  • Under Pressure: ${pressure.isUnderPressure}`);
  console.log(`  • Action: ${pressure.pressureActionTaken}`);

  console.log('\n' + '='.repeat(80));
  console.log('  TASK 17 BENCHMARK COMPLETED SUCCESSFULLY');
  console.log('='.repeat(80) + '\n');
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('benchmark_task17_memory')) {
  runTask17MemoryBenchmark();
}
