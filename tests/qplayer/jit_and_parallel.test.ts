/**
 * ONE Language — Qplayer Execution Architecture (v1.2.1)
 * =======================================================
 * jit_and_parallel.test.ts: Verification Suite for Qplayer JIT & Spatial Parallelism
 */

import { strict as assert } from 'assert';
import {
  Qplayer,
  QplayerRuntime,
  QBinaryEncoder,
  OBIInstruction,
  OBICategory,
  OBIOpcodeControl,
  OBIOpcodeArithmetic,
  OBIOpcodeMemory,
  OBIOpcodeIO,
  OBIOpcodeSpatial,
  OBIOperandMode,
} from '../../src/qplayer/index';
import { QComputationalGraph } from '../../src/qplayer/graph/QGraph';
import { QSpatialParallelScheduler } from '../../src/qplayer/parallel/QSpatialParallelScheduler';

async function runJITAndParallelTests() {
  console.log('\n================================================================================');
  console.log('  QPLAYER v1.2.1 — JIT TIER & SPATIAL PARALLEL SCHEDULER VERIFICATION');
  console.log('================================================================================\n');

  // ── Test 1: JIT vs Interpreter Output Bit-for-Bit Parity ──────────────────
  console.log('[Test 1] JIT vs Interpreter Bit-for-Bit Parity...');
  const testProgram = `
    let x = 12
    let y = 8
    let z = (x * 4) + (y * 2) - 10
    print z
  `;

  const obiBuffer = Qplayer.compileToOBI(testProgram);

  const runtimeInterp = new QplayerRuntime({ useJIT: false });
  const resInterp = runtimeInterp.executeBuffer(obiBuffer);

  const runtimeJIT = new QplayerRuntime({ useJIT: true });
  const resJIT = runtimeJIT.executeBuffer(obiBuffer);

  assert.strictEqual(resInterp.success, true, 'Interpreter failed');
  assert.strictEqual(resJIT.success, true, 'JIT failed');
  assert.deepStrictEqual(resJIT.output, resInterp.output, 'JIT output must match interpreter bit-for-bit');
  assert.strictEqual(resJIT.output[0], '54', 'Computed (12*4)+(8*2)-10 must equal 54');
  console.log(`  ✔ Output bit-for-bit identical: JIT='${resJIT.output[0]}' == Interp='${resInterp.output[0]}'`);

  // ── Test 2: High-Throughput Loop in JIT Tier (1..1000 sum = 500500) ───────
  console.log('\n[Test 2] High-Throughput Loop Execution in JIT Tier...');
  const loopInstructions: OBIInstruction[] = [
    { category: OBICategory.MEMORY, opcode: OBIOpcodeMemory.LOAD_CONST, harmonicDest: 0, srcA: 0, srcB: 0, mode: OBIOperandMode.REG_CONSTPOOL }, // r0 = 1000
    { category: OBICategory.MEMORY, opcode: OBIOpcodeMemory.LOAD_CONST, harmonicDest: 1, srcA: 0, srcB: 1, mode: OBIOperandMode.REG_CONSTPOOL }, // r1 = 0
    { category: OBICategory.MEMORY, opcode: OBIOpcodeMemory.LOAD_CONST, harmonicDest: 2, srcA: 0, srcB: 2, mode: OBIOperandMode.REG_CONSTPOOL }, // r2 = 1
    // Loop header
    { category: OBICategory.CONTROL, opcode: OBIOpcodeControl.JUMP_IF_ZERO, harmonicDest: 7, srcA: 0, srcB: 0, mode: OBIOperandMode.REG_REG },   // If r0 == 0 -> jump to exit (PC 7)
    { category: OBICategory.ARITHMETIC, opcode: OBIOpcodeArithmetic.ADD, harmonicDest: 1, srcA: 1, srcB: 0, mode: OBIOperandMode.REG_REG },      // r1 = r1 + r0
    { category: OBICategory.ARITHMETIC, opcode: OBIOpcodeArithmetic.SUB, harmonicDest: 0, srcA: 0, srcB: 2, mode: OBIOperandMode.REG_REG },      // r0 = r0 - 1
    { category: OBICategory.CONTROL, opcode: OBIOpcodeControl.JUMP, harmonicDest: 3, srcA: 0, srcB: 0, mode: OBIOperandMode.REG_REG },           // Jump back to loop header
    // Exit
    { category: OBICategory.IO, opcode: OBIOpcodeIO.OUTPUT, harmonicDest: 0, srcA: 1, srcB: 0, mode: OBIOperandMode.REG_REG },
    { category: OBICategory.CONTROL, opcode: OBIOpcodeControl.HALT, harmonicDest: 0, srcA: 0, srcB: 0, mode: OBIOperandMode.REG_REG },
  ];

  const loopBuffer = QBinaryEncoder.encode(loopInstructions, [1000, 0, 1]);
  const loopStart = performance.now();
  const loopRes = runtimeJIT.executeBuffer(loopBuffer);
  const loopElapsed = performance.now() - loopStart;

  assert.strictEqual(loopRes.success, true, 'Loop failed');
  assert.strictEqual(loopRes.output[0], '500500', 'Sum of 1..1000 must equal 500500');
  console.log(`  ✔ Computed 1,000 loop steps in JIT: sum = ${loopRes.output[0]} (${loopElapsed.toFixed(3)}ms)`);

  // ── Test 3: Safety Invariants in JIT Tier (Fail-Closed) ───────────────────
  console.log('\n[Test 3] Safety Invariant Fail-Closed Verification in JIT Tier...');
  const divZeroProgram = `
    let a = 100
    let b = 0
    let c = a / b
    print c
  `;
  const divZeroBuffer = Qplayer.compileToOBI(divZeroProgram);
  const divZeroRes = runtimeJIT.executeBuffer(divZeroBuffer);
  assert.strictEqual(divZeroRes.success, false, 'Division by zero must fail');
  assert.strictEqual(divZeroRes.error?.code, 'E5001', 'Must intercept division by zero with E5001');
  console.log(`  ✔ Division by zero intercepted fail-closed with code E5001 in JIT.`);

  // ── Test 4: Spatial Memory Boundary Invariant in JIT Tier ─────────────────
  console.log('\n[Test 4] Address369 Boundary Enforcement in JIT Tier...');
  const oobInstructions: OBIInstruction[] = [
    { category: OBICategory.MEMORY, opcode: OBIOpcodeMemory.LOAD_CONST, harmonicDest: 0, srcA: 0, srcB: 0, mode: OBIOperandMode.REG_CONSTPOOL }, // r0 = 42
    { category: OBICategory.SPATIAL369, opcode: OBIOpcodeSpatial.SPATIAL_STORE_369, harmonicDest: 400, srcA: 0, srcB: 0, mode: OBIOperandMode.SPATIAL_ADDR }, // Address 400 > 368
    { category: OBICategory.CONTROL, opcode: OBIOpcodeControl.HALT, harmonicDest: 0, srcA: 0, srcB: 0, mode: OBIOperandMode.REG_REG },
  ];
  const oobBuffer = QBinaryEncoder.encode(oobInstructions, [42]);
  const oobRes = runtimeJIT.executeBuffer(oobBuffer);
  assert.strictEqual(oobRes.success, false, 'Out-of-bounds spatial access must fail');
  assert.strictEqual(oobRes.error?.code, 'E8005', 'Must fail closed with E8005');
  console.log(`  ✔ Address369 boundary [0..368] strictly enforced in JIT tier (E8005).`);

  // ── Test 5: QSpatialParallelScheduler DAG Partitioning ────────────────────
  console.log('\n[Test 5] Spatial Parallel DAG Partitioning & Speedup Estimation...');
  const graph = new QComputationalGraph();
  const n1 = graph.addNode('CONST', [], 10);
  const n2 = graph.addNode('CONST', [], 20);
  const n3 = graph.addNode('CONST', [], 30);
  const n4 = graph.addNode('ADD', [n1.id, n2.id]);
  const n5 = graph.addNode('MUL', [n3.id, n4.id]);

  const chunks = QSpatialParallelScheduler.partitionGraph(graph);
  const metrics = QSpatialParallelScheduler.estimateSpeedup(graph, 8);

  assert(chunks.length >= 2, 'Graph must be partitioned into multiple waves');
  assert(metrics.concurrencyLevel === 8, 'Concurrency level must be 8 cores');
  console.log(`  ✔ Graph partitioned into ${chunks.length} execution waves.`);
  console.log(`  ✔ Estimated parallel speedup across 8 logical cores: ${metrics.speedupEstimated}x`);

  console.log('\n================================================================================');
  console.log('  ALL QPLAYER v1.2.1 JIT & SPATIAL PARALLEL TESTS PASSED (100%)');
  console.log('================================================================================\n');
}

runJITAndParallelTests().catch((err) => {
  console.error('\n[FATAL TEST ERROR]:', err);
  process.exit(1);
});
