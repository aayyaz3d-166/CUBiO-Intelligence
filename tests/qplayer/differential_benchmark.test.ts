/**
 * ONE Language — Qplayer Execution Architecture (Phase 7 Benchmark)
 * ==================================================================
 * differential_benchmark.test.ts: Side-by-side Differential Verification and Performance Benchmarks
 */

import * as assert from 'assert';
import { Qplayer } from '../../src/qplayer/index';
import { UnifiedCompiler } from '../../src/one/UnifiedCompiler';
import { QBinaryEncoder } from '../../src/qplayer/binary/QBinaryEncoder';
import { QplayerRuntime } from '../../src/qplayer/runtime/QplayerRuntime';
import {
  OBICategory,
  OBIOpcodeControl,
  OBIOpcodeArithmetic,
  OBIOpcodeMemory,
  OBIOperandMode,
  OBIInstruction,
} from '../../src/qplayer/spec/OBISpec';

export interface BenchmarkMetrics {
  workload: string;
  qplayerOutput: string;
  unifiedVmOutput: string;
  outputsMatch: boolean;
  qplayerTimeMs: number;
  unifiedVmTimeMs: number;
  speedupRatio: string;
  qplayerBinaryBytes: number;
  unifiedVmIrBytes: number;
  sizeReductionPercent: string;
}

export async function runDifferentialBenchmarks(): Promise<BenchmarkMetrics[]> {
  console.log('\n================================================================================');
  console.log('  QPLAYER — PHASE 7: DIFFERENTIAL TESTING & BENCHMARK SUITE');
  console.log('================================================================================\n');

  const results: BenchmarkMetrics[] = [];
  const compiler = new UnifiedCompiler();

  // ── Workload 1: Arithmetic & Expression Tree ──────────────────────────────
  console.log('[Workload 1] Arithmetic & Expression Tree Verification...');
  const w1Source = `let a = 125;
let b = 75;
let c = a + b;
print c;
`;
  // Qplayer
  const qStart1 = performance.now();
  const qRes1 = Qplayer.execute(w1Source);
  const qTime1 = performance.now() - qStart1;
  const qBin1 = Qplayer.compileToOBI(w1Source);

  // UnifiedVM
  const vmStart1 = performance.now();
  const vmRes1 = compiler.execute(w1Source);
  const vmTime1 = performance.now() - vmStart1;
  const vmIrBytes1 = Buffer.byteLength(JSON.stringify(vmRes1.compilation.ir || {}));

  assert.strictEqual(qRes1.output[0], vmRes1.vmResult?.output[0], 'Workload 1 output parity mismatch');
  console.log(`  ✔ Output parity verified: Qplayer='${qRes1.output[0]}' == UnifiedVM='${vmRes1.vmResult?.output[0]}'`);
  console.log(`  ✔ OBI Binary: ${qBin1.length} bytes vs JSON IR: ${vmIrBytes1} bytes (-${((1 - qBin1.length / vmIrBytes1) * 100).toFixed(1)}%)`);

  results.push({
    workload: 'Workload 1: Arithmetic Tree',
    qplayerOutput: qRes1.output[0],
    unifiedVmOutput: vmRes1.vmResult?.output[0] || '',
    outputsMatch: true,
    qplayerTimeMs: qTime1,
    unifiedVmTimeMs: vmTime1,
    speedupRatio: `${(vmTime1 / qTime1).toFixed(2)}x`,
    qplayerBinaryBytes: qBin1.length,
    unifiedVmIrBytes: vmIrBytes1,
    sizeReductionPercent: `${((1 - qBin1.length / vmIrBytes1) * 100).toFixed(1)}%`,
  });

  // ── Workload 2: Multi-step Sequential Pipeline ────────────────────────────
  console.log('\n[Workload 2] Multi-step Sequential Dependency Pipeline...');
  const w2Source = `let x = 10;
let y = 20;
let z = x + y;
let w = z + 12;
print w;
`;
  const qStart2 = performance.now();
  const qRes2 = Qplayer.execute(w2Source);
  const qTime2 = performance.now() - qStart2;
  const qBin2 = Qplayer.compileToOBI(w2Source);

  const vmStart2 = performance.now();
  const vmRes2 = compiler.execute(w2Source);
  const vmTime2 = performance.now() - vmStart2;
  const vmIrBytes2 = Buffer.byteLength(JSON.stringify(vmRes2.compilation.ir || {}));

  assert.strictEqual(qRes2.output[0], vmRes2.vmResult?.output[0], 'Workload 2 output parity mismatch');
  console.log(`  ✔ Output parity verified: Qplayer='${qRes2.output[0]}' == UnifiedVM='${vmRes2.vmResult?.output[0]}'`);
  console.log(`  ✔ OBI Binary: ${qBin2.length} bytes vs JSON IR: ${vmIrBytes2} bytes (-${((1 - qBin2.length / vmIrBytes2) * 100).toFixed(1)}%)`);

  results.push({
    workload: 'Workload 2: Sequential Pipeline',
    qplayerOutput: qRes2.output[0],
    unifiedVmOutput: vmRes2.vmResult?.output[0] || '',
    outputsMatch: true,
    qplayerTimeMs: qTime2,
    unifiedVmTimeMs: vmTime2,
    speedupRatio: `${(vmTime2 / qTime2).toFixed(2)}x`,
    qplayerBinaryBytes: qBin2.length,
    unifiedVmIrBytes: vmIrBytes2,
    sizeReductionPercent: `${((1 - qBin2.length / vmIrBytes2) * 100).toFixed(1)}%`,
  });

  // ── Workload 3: Repeated Pure Register Loop Benchmark (1,000 steps) ───────
  console.log('\n[Workload 3] Register-Machine Execution Loop Benchmark (1,000 steps)...');
  const count = 1000;
  const loopInstructions: OBIInstruction[] = [
    { category: OBICategory.MEMORY, opcode: OBIOpcodeMemory.LOAD_CONST, harmonicDest: 0, srcA: 0, srcB: 0, mode: OBIOperandMode.REG_CONSTPOOL }, // r0 = 1000
    { category: OBICategory.MEMORY, opcode: OBIOpcodeMemory.LOAD_CONST, harmonicDest: 1, srcA: 0, srcB: 1, mode: OBIOperandMode.REG_CONSTPOOL }, // r1 = 0
    { category: OBICategory.MEMORY, opcode: OBIOpcodeMemory.LOAD_CONST, harmonicDest: 2, srcA: 0, srcB: 2, mode: OBIOperandMode.REG_CONSTPOOL }, // r2 = 1
    // Loop header: PC 3
    { category: OBICategory.CONTROL, opcode: OBIOpcodeControl.JUMP_IF_ZERO, harmonicDest: 7, srcA: 0, srcB: 0, mode: OBIOperandMode.REG_REG },
    { category: OBICategory.ARITHMETIC, opcode: OBIOpcodeArithmetic.ADD, harmonicDest: 1, srcA: 1, srcB: 2, mode: OBIOperandMode.REG_REG },
    { category: OBICategory.ARITHMETIC, opcode: OBIOpcodeArithmetic.SUB, harmonicDest: 0, srcA: 0, srcB: 2, mode: OBIOperandMode.REG_REG },
    { category: OBICategory.CONTROL, opcode: OBIOpcodeControl.JUMP, harmonicDest: 3, srcA: 0, srcB: 0, mode: OBIOperandMode.REG_REG },
    // PC 7: Output & Halt
    { category: OBICategory.CONTROL, opcode: OBIOpcodeControl.HALT, harmonicDest: 0, srcA: 0, srcB: 0, mode: OBIOperandMode.REG_REG },
  ];

  const loopBuf = QBinaryEncoder.encode(loopInstructions, [count, 0, 1]);
  const runtime = new QplayerRuntime();

  const loopBenchStart = performance.now();
  const loopExecRes = runtime.executeBuffer(loopBuf);
  const loopBenchTime = performance.now() - loopBenchStart;

  assert.ok(loopExecRes.success, 'Loop execution must succeed');
  assert.strictEqual(loopExecRes.registers[1], 1000, 'Sum accumulator should be 1000');
  console.log(`  ✔ Qplayer executed ${loopExecRes.instructionsExecuted} instructions in ${loopBenchTime.toFixed(3)}ms (~${(loopExecRes.instructionsExecuted / (loopBenchTime / 1000)).toFixed(0)} ops/sec).`);

  // ── Workload 4: Differential Malformed Security Invariants ─────────────────
  console.log('\n[Workload 4] Security Invariants: Malformed Input Interception...');
  const corruptedBuf = Buffer.from(qBin1);
  corruptedBuf[10] = 0xAA; // Corrupt header flags
  corruptedBuf[29] = 0xFF; // Corrupt CRC32

  const malformedRes = Qplayer.runBinary(corruptedBuf);
  assert.strictEqual(malformedRes.success, false, 'Corrupted binary must fail validation');
  console.log(`  ✔ Tampered binary intercepted fail-closed: [${malformedRes.error?.code}] ${malformedRes.error?.message}`);

  console.log('\n================================================================================');
  console.log('  ALL DIFFERENTIAL BENCHMARK AND VALIDATION SUITES PASSED (100%)');
  console.log('================================================================================\n');

  return results;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('differential_benchmark.test.ts')) {
  runDifferentialBenchmarks().catch((err) => {
    console.error('\n[FATAL BENCHMARK ERROR]:', err);
    process.exit(1);
  });
}
