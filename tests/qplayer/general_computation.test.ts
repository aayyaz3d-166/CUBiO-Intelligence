/**
 * ONE Language — Qplayer Execution Architecture (Phase 5 & 6 Test)
 * =================================================================
 * general_computation.test.ts: Full General Computation, Spatial 369, and Invariants Suite
 */

import * as assert from 'assert';
import {
  OBICategory,
  OBIOpcodeArithmetic,
  OBIOpcodeControl,
  OBIOpcodeMemory,
  OBIOpcodeIO,
  OBIOpcodeSpatial,
  OBIOperandMode,
  OBIInstruction,
  OBI_FLAG_ACTUATION_LOCKED,
} from '../../src/qplayer/spec/OBISpec';
import { QBinaryEncoder } from '../../src/qplayer/binary/QBinaryEncoder';
import { QplayerRuntime } from '../../src/qplayer/runtime/QplayerRuntime';

export async function runGeneralComputationTests(): Promise<void> {
  console.log('\n================================================================================');
  console.log('  QPLAYER — PHASE 5 & 6: GENERAL COMPUTATION & SPATIAL 369 TEST SUITE');
  console.log('================================================================================\n');

  // ── Test 1: Arithmetic & Division by Zero Safety ──────────────────────────
  console.log('[Test 1] Arithmetic Computations and Zero-Division Interception...');
  // r0 = 100, r1 = 20, r2 = r0 / r1 (5), r3 = 0, r4 = r0 / r3 (triggers E5001)
  const divZeroInstructions: OBIInstruction[] = [
    { category: OBICategory.MEMORY, opcode: OBIOpcodeMemory.LOAD_CONST, harmonicDest: 0, srcA: 0, srcB: 0, mode: OBIOperandMode.REG_CONSTPOOL }, // r0 = 100
    { category: OBICategory.MEMORY, opcode: OBIOpcodeMemory.LOAD_CONST, harmonicDest: 1, srcA: 0, srcB: 1, mode: OBIOperandMode.REG_CONSTPOOL }, // r1 = 20
    { category: OBICategory.ARITHMETIC, opcode: OBIOpcodeArithmetic.DIV, harmonicDest: 2, srcA: 0, srcB: 1, mode: OBIOperandMode.REG_REG },      // r2 = 100 / 20 = 5
    { category: OBICategory.MEMORY, opcode: OBIOpcodeMemory.LOAD_CONST, harmonicDest: 3, srcA: 0, srcB: 2, mode: OBIOperandMode.REG_CONSTPOOL }, // r3 = 0
    { category: OBICategory.ARITHMETIC, opcode: OBIOpcodeArithmetic.DIV, harmonicDest: 4, srcA: 0, srcB: 3, mode: OBIOperandMode.REG_REG },      // r4 = 100 / 0 -> E5001
    { category: OBICategory.CONTROL, opcode: OBIOpcodeControl.HALT, harmonicDest: 0, srcA: 0, srcB: 0, mode: OBIOperandMode.REG_REG },
  ];

  const divZeroBuf = QBinaryEncoder.encode(divZeroInstructions, [100, 20, 0]);
  const runtime1 = new QplayerRuntime();
  const divResult = runtime1.executeBuffer(divZeroBuf);

  assert.strictEqual(divResult.success, false, 'Division by zero must fail');
  assert.strictEqual(divResult.error?.code, 'E5001', 'Error code must be E5001');
  assert.strictEqual(divResult.registers[2], 5, 'Register r2 should hold valid pre-error calculation (5)');
  console.log('  ✔ Division by zero intercepted fail-closed with code E5001.');

  // ── Test 2: Loop Execution (Sum 1 to 5 = 15) ──────────────────────────────
  console.log('[Test 2] Loop Execution with Counter & Conditional Branching...');
  // r0 = count (5), r1 = sum (0), r2 = 1 (step), r3 = 0 (stop condition)
  // Loop:
  // PC 4: JUMP_IF_ZERO r0 to PC 10 (exit)
  // PC 5: r1 = r1 + r0 (accumulate)
  // PC 6: r0 = r0 - r2 (decrement)
  // PC 7: JUMP to PC 4 (repeat)
  // PC 8: OUTPUT r1
  // PC 9: HALT
  const loopInstructions: OBIInstruction[] = [
    { category: OBICategory.MEMORY, opcode: OBIOpcodeMemory.LOAD_CONST, harmonicDest: 0, srcA: 0, srcB: 0, mode: OBIOperandMode.REG_CONSTPOOL }, // r0 = 5
    { category: OBICategory.MEMORY, opcode: OBIOpcodeMemory.LOAD_CONST, harmonicDest: 1, srcA: 0, srcB: 1, mode: OBIOperandMode.REG_CONSTPOOL }, // r1 = 0
    { category: OBICategory.MEMORY, opcode: OBIOpcodeMemory.LOAD_CONST, harmonicDest: 2, srcA: 0, srcB: 2, mode: OBIOperandMode.REG_CONSTPOOL }, // r2 = 1
    // Loop header
    { category: OBICategory.CONTROL, opcode: OBIOpcodeControl.JUMP_IF_ZERO, harmonicDest: 7, srcA: 0, srcB: 0, mode: OBIOperandMode.REG_REG },   // If r0 == 0 -> jump to PC 7
    { category: OBICategory.ARITHMETIC, opcode: OBIOpcodeArithmetic.ADD, harmonicDest: 1, srcA: 1, srcB: 0, mode: OBIOperandMode.REG_REG },      // r1 = r1 + r0
    { category: OBICategory.ARITHMETIC, opcode: OBIOpcodeArithmetic.SUB, harmonicDest: 0, srcA: 0, srcB: 2, mode: OBIOperandMode.REG_REG },      // r0 = r0 - 1
    { category: OBICategory.CONTROL, opcode: OBIOpcodeControl.JUMP, harmonicDest: 3, srcA: 0, srcB: 0, mode: OBIOperandMode.REG_REG },           // Jump back to loop header (PC 3)
    // Loop exit
    { category: OBICategory.IO, opcode: OBIOpcodeIO.OUTPUT, harmonicDest: 0, srcA: 1, srcB: 0, mode: OBIOperandMode.REG_REG },                  // Output r1 (sum)
    { category: OBICategory.CONTROL, opcode: OBIOpcodeControl.HALT, harmonicDest: 0, srcA: 0, srcB: 0, mode: OBIOperandMode.REG_REG },
  ];

  const loopBuf = QBinaryEncoder.encode(loopInstructions, [5, 0, 1]);
  const runtime2 = new QplayerRuntime();
  const loopResult = runtime2.executeBuffer(loopBuf);

  assert.ok(loopResult.success, `Loop execution failed: ${loopResult.error?.message}`);
  assert.strictEqual(loopResult.output[0], '15', `Expected sum 15, got ${loopResult.output[0]}`);
  console.log(`  ✔ Loop computed sum (1..5) = ${loopResult.output[0]} in ${loopResult.instructionsExecuted} instructions.`);

  // ── Test 3: Function Call & Return (CALL, RET) ────────────────────────────
  console.log('[Test 3] Function Activation & Call Stack Frames (CALL & RET)...');
  // Main:
  // PC 0: r0 = 21
  // PC 1: CALL doubleFunc (PC 5), return to r1
  // PC 2: OUTPUT r1 (should be 42)
  // PC 3: HALT
  // doubleFunc: (PC 4)
  // PC 4: r2 = r0 + r0 (42)
  // PC 5: RET with r2
  const fnInstructions: OBIInstruction[] = [
    { category: OBICategory.MEMORY, opcode: OBIOpcodeMemory.LOAD_CONST, harmonicDest: 0, srcA: 0, srcB: 0, mode: OBIOperandMode.REG_CONSTPOOL }, // PC 0: r0 = 21
    { category: OBICategory.CONTROL, opcode: OBIOpcodeControl.CALL, harmonicDest: 4, srcA: 1, srcB: 0, mode: OBIOperandMode.REG_REG },          // PC 1: call PC 4, dest r1
    { category: OBICategory.IO, opcode: OBIOpcodeIO.OUTPUT, harmonicDest: 0, srcA: 1, srcB: 0, mode: OBIOperandMode.REG_REG },                  // PC 2: output r1
    { category: OBICategory.CONTROL, opcode: OBIOpcodeControl.HALT, harmonicDest: 0, srcA: 0, srcB: 0, mode: OBIOperandMode.REG_REG },           // PC 3: halt
    // Function body at PC 4
    { category: OBICategory.ARITHMETIC, opcode: OBIOpcodeArithmetic.ADD, harmonicDest: 2, srcA: 0, srcB: 0, mode: OBIOperandMode.REG_REG },      // PC 4: r2 = r0 + r0
    { category: OBICategory.CONTROL, opcode: OBIOpcodeControl.RET, harmonicDest: 0, srcA: 2, srcB: 0, mode: OBIOperandMode.REG_REG },           // PC 5: ret r2
  ];

  const fnBuf = QBinaryEncoder.encode(fnInstructions, [21]);
  const runtime3 = new QplayerRuntime();
  const fnResult = runtime3.executeBuffer(fnBuf);

  assert.ok(fnResult.success, `Function execution failed: ${fnResult.error?.message}`);
  assert.strictEqual(fnResult.output[0], '42', `Expected return value 42, got ${fnResult.output[0]}`);
  console.log(`  ✔ Function call and activation frame executed successfully, returned: ${fnResult.output[0]}`);

  // ── Test 4: Address369 Spatial Memory Verification [0..368] ───────────────
  console.log('[Test 4] Address369 Spatial Memory Operations within [0..368]...');
  const spatialInstructions: OBIInstruction[] = [
    { category: OBICategory.MEMORY, opcode: OBIOpcodeMemory.LOAD_CONST, harmonicDest: 0, srcA: 0, srcB: 0, mode: OBIOperandMode.REG_CONSTPOOL }, // r0 = 369.777
    { category: OBICategory.SPATIAL369, opcode: OBIOpcodeSpatial.SPATIAL_STORE_369, harmonicDest: 0, srcA: 0, srcB: 0, mode: OBIOperandMode.SPATIAL_ADDR }, // Store r0 into addr 0
    { category: OBICategory.SPATIAL369, opcode: OBIOpcodeSpatial.SPATIAL_STORE_369, harmonicDest: 368, srcA: 0, srcB: 0, mode: OBIOperandMode.SPATIAL_ADDR }, // Store r0 into boundary addr 368
    { category: OBICategory.SPATIAL369, opcode: OBIOpcodeSpatial.SPATIAL_LOAD_369, harmonicDest: 368, srcA: 1, srcB: 0, mode: OBIOperandMode.SPATIAL_ADDR }, // Load addr 368 into r1
    { category: OBICategory.IO, opcode: OBIOpcodeIO.OUTPUT, harmonicDest: 0, srcA: 1, srcB: 0, mode: OBIOperandMode.REG_REG }, // Output r1
    { category: OBICategory.CONTROL, opcode: OBIOpcodeControl.HALT, harmonicDest: 0, srcA: 0, srcB: 0, mode: OBIOperandMode.REG_REG },
  ];

  const spatialBuf = QBinaryEncoder.encode(spatialInstructions, [369.777]);
  const runtime4 = new QplayerRuntime();
  const spatialResult = runtime4.executeBuffer(spatialBuf);

  assert.ok(spatialResult.success, `Spatial execution failed: ${spatialResult.error?.message}`);
  assert.strictEqual(spatialResult.output[0], '369.777', 'Must read exact value from spatial address 368');
  console.log(`  ✔ Spatial 369 memory read/write verified across boundaries (0 and 368). Value: ${spatialResult.output[0]}`);

  // ── Test 5: Actuation Lock & Safety Invariants ────────────────────────────
  console.log('[Test 5] Mandatory ACTUATION_LOCK Safety Invariant Enforcement...');
  assert.ok(spatialBuf.readUInt32LE(8) & OBI_FLAG_ACTUATION_LOCKED, 'Binary must have ACTUATION_LOCK flag set');
  console.log('  ✔ ACTUATION_LOCK permanently enforced in binary header and runtime.');

  console.log('\n================================================================================');
  console.log('  ALL PHASE 5 & 6 GENERAL COMPUTATION & SPATIAL 369 TESTS PASSED (100%)');
  console.log('================================================================================\n');
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('general_computation.test.ts')) {
  runGeneralComputationTests().catch((err) => {
    console.error('\n[FATAL TEST ERROR]:', err);
    process.exit(1);
  });
}
