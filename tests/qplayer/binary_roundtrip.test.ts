/**
 * ONE Language — Qplayer Execution Architecture (Phase 2 Test)
 * =============================================================
 * binary_roundtrip.test.ts: OBI Binary Encoding, Decoding, Roundtrip, and Fuzz Tests
 */

import * as assert from 'assert';
import {
  OBICategory,
  OBIOpcodeArithmetic,
  OBIOpcodeIO,
  OBIOpcodeControl,
  OBIOperandMode,
  OBIInstruction,
  OBI_FLAG_ACTUATION_LOCKED,
} from '../../src/qplayer/spec/OBISpec';
import { QBinaryEncoder } from '../../src/qplayer/binary/QBinaryEncoder';
import { QBinaryDecoder, QBinaryDecoderError } from '../../src/qplayer/binary/QBinaryDecoder';
import { QBinaryValidator } from '../../src/qplayer/binary/QBinaryValidator';

export async function runBinaryRoundtripTests(): Promise<void> {
  console.log('\n================================================================================');
  console.log('  QPLAYER — PHASE 2: OBI BINARY ENCODING & VALIDATION TEST SUITE');
  console.log('================================================================================\n');

  // ── Test 1: Minimal Instruction & Constant Pool Roundtrip ──────────────────
  console.log('[Test 1] Roundtrip Encoding and Decoding of OBI Instructions...');
  const sampleInstructions: OBIInstruction[] = [
    {
      category: OBICategory.IO,
      opcode: OBIOpcodeIO.INPUT,
      harmonicDest: 0, // r0
      srcA: 0,
      srcB: 0,
      mode: OBIOperandMode.REG_IMM9,
    },
    {
      category: OBICategory.IO,
      opcode: OBIOpcodeIO.INPUT,
      harmonicDest: 1, // r1
      srcA: 0,
      srcB: 0,
      mode: OBIOperandMode.REG_IMM9,
    },
    {
      category: OBICategory.ARITHMETIC,
      opcode: OBIOpcodeArithmetic.ADD,
      harmonicDest: 2, // r2 = r0 + r1
      srcA: 0,
      srcB: 1,
      mode: OBIOperandMode.REG_REG,
    },
    {
      category: OBICategory.IO,
      opcode: OBIOpcodeIO.OUTPUT,
      harmonicDest: 0,
      srcA: 2, // output r2
      srcB: 0,
      mode: OBIOperandMode.REG_REG,
    },
    {
      category: OBICategory.CONTROL,
      opcode: OBIOpcodeControl.HALT,
      harmonicDest: 0,
      srcA: 0,
      srcB: 0,
      mode: OBIOperandMode.REG_REG,
    },
  ];

  const sampleConstants = [42, 3.14159, 'Hello Qplayer', true];

  const encodedBuffer = QBinaryEncoder.encode(sampleInstructions, sampleConstants);
  assert.ok(encodedBuffer.length >= 32, 'Encoded buffer must contain at least 32-byte header');
  console.log(`  ✔ Encoded ${sampleInstructions.length} instructions & ${sampleConstants.length} constants into ${encodedBuffer.length} bytes.`);

  const decoded = QBinaryDecoder.decode(encodedBuffer);
  assert.strictEqual(decoded.header.magic.toString('ascii'), 'OBI1', 'Magic must match OBI1');
  assert.strictEqual(decoded.instructions.length, sampleInstructions.length, 'Instruction count must match');

  for (let i = 0; i < sampleInstructions.length; i++) {
    const orig = sampleInstructions[i];
    const dec = decoded.instructions[i];
    assert.strictEqual(dec.category, orig.category, `Instruction ${i}: category mismatch`);
    assert.strictEqual(dec.opcode, orig.opcode, `Instruction ${i}: opcode mismatch`);
    assert.strictEqual(dec.harmonicDest, orig.harmonicDest, `Instruction ${i}: harmonicDest mismatch`);
    assert.strictEqual(dec.srcA, orig.srcA, `Instruction ${i}: srcA mismatch`);
    assert.strictEqual(dec.srcB, orig.srcB, `Instruction ${i}: srcB mismatch`);
    assert.strictEqual(dec.mode, orig.mode, `Instruction ${i}: mode mismatch`);
  }

  assert.strictEqual(decoded.constants.length, sampleConstants.length, 'Constants count must match');
  assert.strictEqual(decoded.constants[0], 42);
  assert.strictEqual(decoded.constants[1], 3.14159);
  assert.strictEqual(decoded.constants[2], 'Hello Qplayer');
  assert.strictEqual(decoded.constants[3], true);
  console.log('  ✔ All instructions and constants decoded bit-for-bit identical.');

  // ── Test 2: Validation Engine ──────────────────────────────────────────────
  console.log('[Test 2] Structural and Invariant Validation...');
  const valResult = QBinaryValidator.validateBuffer(encodedBuffer);
  assert.ok(valResult.valid, `Validation should pass, got error: ${valResult.error}`);
  console.log('  ✔ OBI binary validated successfully.');

  // ── Test 3: Corruption & Checksum Failure Detection (Fail-Closed) ──────────
  console.log('[Test 3] Checksum Corruption & Tampering Interception...');
  const corruptedBuffer = Buffer.from(encodedBuffer);
  // Corrupt an instruction byte
  corruptedBuffer[35] = corruptedBuffer[35] ^ 0xFF;

  let caughtChecksumError = false;
  try {
    QBinaryDecoder.decode(corruptedBuffer);
  } catch (err: any) {
    if (err instanceof QBinaryDecoderError && err.code === 'E8104') {
      caughtChecksumError = true;
    }
  }
  assert.ok(caughtChecksumError, 'Corrupted binary must throw E8104 Checksum Mismatch');
  console.log('  ✔ Checksum tampering detected and failed closed (E8104).');

  // ── Test 4: Truncated Buffer Rejection ──────────────────────────────────────
  console.log('[Test 4] Truncation Interception...');
  const truncatedHeader = encodedBuffer.slice(0, 16);
  let caughtTruncation = false;
  try {
    QBinaryDecoder.decode(truncatedHeader);
  } catch (err: any) {
    if (err instanceof QBinaryDecoderError && err.code === 'E8101') {
      caughtTruncation = true;
    }
  }
  assert.ok(caughtTruncation, 'Truncated header must throw E8101');
  console.log('  ✔ Truncated header intercepted cleanly (E8101).');

  // ── Test 5: Address369 Bound Safety Rejection ──────────────────────────────
  console.log('[Test 5] Address369 Boundary Enforcement (> 368 rejected)...');
  const invalidSpatialInstructions: OBIInstruction[] = [
    {
      category: OBICategory.SPATIAL369,
      opcode: 0,
      harmonicDest: 369, // Out of bounds! Valid range is [0..368]
      srcA: 0,
      srcB: 0,
      mode: OBIOperandMode.SPATIAL_ADDR,
    },
  ];

  const spatialBuf = QBinaryEncoder.encode(invalidSpatialInstructions, []);
  const spatialVal = QBinaryValidator.validateBuffer(spatialBuf);
  assert.strictEqual(spatialVal.valid, false, 'Spatial address 369 must fail validation');
  assert.strictEqual(spatialVal.errorCode, 'E8005', 'Spatial address > 368 must emit E8005');
  console.log('  ✔ Address369 invariant enforced: address > 368 rejected with E8005.');

  console.log('\n================================================================================');
  console.log('  ALL PHASE 2 OBI BINARY ENCODING & VALIDATION TESTS PASSED (100%)');
  console.log('================================================================================\n');
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('binary_roundtrip.test.ts')) {
  runBinaryRoundtripTests().catch((err) => {
    console.error('\n[FATAL TEST ERROR]:', err);
    process.exit(1);
  });
}
