/**
 * ONE Language — Phase 2 Verification Suite
 * Module: 3/6/9-Bit Binary Language, Codebook, Triangle & Codecs (tests/binary/phase2_binary_language.test.ts)
 */

import {
  BitCategory,
  TriangleOpcode,
  TriangleMapper,
  BinaryCodebook,
  BinaryEncoder,
  BinaryDecoder,
  BinaryError,
} from '../../src/binary';
import { CanonicalAddress369 } from '../../src/one/address369_canonical';

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    throw new Error(`[ASSERTION FAILED] ${msg}`);
  }
}

export function runPhase2BinaryTests(): void {
  console.log('='.repeat(78));
  console.log('  ONE LANGUAGE — PHASE 2: 3/6/9-BIT BINARY LANGUAGE VERIFICATION SUITE');
  console.log('='.repeat(78));

  // ── Test 1: Complete 3-Bit Space Enumeration (8 Patterns) ─────────────────
  console.log('\n[Test 1] Enumerating All 8 Three-Bit Patterns...');
  assert(BinaryCodebook.TABLE_3BIT.length === 8, 'Must have exactly 8 three-bit entries');
  const seen3Bit = new Set<string>();
  for (let i = 0; i < 8; i++) {
    const pattern = i.toString(2).padStart(3, '0');
    const entry = BinaryCodebook.lookup3Bit(pattern);
    assert(entry.category === i, `3-bit pattern ${pattern} category must match ${i}`);
    seen3Bit.add(pattern);
  }
  assert(seen3Bit.size === 8, 'All 8 patterns must be unique');
  console.log('  ✓ 8/8 Three-bit patterns enumerated, classified, and verified.');

  // ── Test 2: Complete 6-Bit Space Enumeration (64 Patterns) ────────────────
  console.log('\n[Test 2] Enumerating All 64 Six-Bit Patterns...');
  assert(BinaryCodebook.TABLE_6BIT.length === 64, 'Must have exactly 64 six-bit entries');
  const seen6Bit = new Set<string>();
  for (let i = 0; i < 64; i++) {
    const entry = BinaryCodebook.lookup6Bit(i);
    assert(entry.code === i, `Entry code must equal ${i}`);
    assert(entry.pattern === i.toString(2).padStart(6, '0'), 'Pattern bitstring must match index');
    seen6Bit.add(entry.pattern);
  }
  assert(seen6Bit.size === 64, 'All 64 patterns must be unique');
  console.log('  ✓ 64/64 Six-bit patterns enumerated, categorized across 4 quartiles.');

  // ── Test 3: Complete 9-Bit Space Enumeration (512 Patterns) ───────────────
  console.log('\n[Test 3] Enumerating All 512 Nine-Bit Patterns...');
  assert(BinaryCodebook.TABLE_9BIT.length === 512, 'Must have exactly 512 nine-bit entries');
  let assignedCount = 0;
  let reservedCount = 0;
  for (let i = 0; i < 512; i++) {
    const entry = BinaryCodebook.lookup9Bit(i);
    assert(entry.code === i, `9-bit code must equal ${i}`);
    if (i <= 368) {
      assert(entry.status === 'ASSIGNED', `Address ${i} must be ASSIGNED`);
      assignedCount++;
    } else {
      assert(entry.status === 'RESERVED', `Address ${i} must be RESERVED`);
      reservedCount++;
    }
  }
  assert(assignedCount === 369, 'Must have exactly 369 assigned addresses (Address369)');
  assert(reservedCount === 143, 'Must have exactly 143 reserved addresses (369..511)');
  console.log('  ✓ 512/512 Nine-bit patterns enumerated (369 Assigned Address369, 143 Reserved).');

  // ── Test 4: Triangle Geometric Mapping (64 Configurations) ────────────────
  console.log('\n[Test 4] Verifying Triangle Geometric Mapping Roundtrip (64 configurations)...');
  for (let c = 0; c < 64; c++) {
    const pos = TriangleMapper.codeToPositions(c);
    const recCode = TriangleMapper.positionsToCode(pos);
    assert(recCode === c, `Triangle mapping mismatch at code ${c}`);

    const bitStr = TriangleMapper.toBitString(c);
    const fromStr = TriangleMapper.fromBitString(bitStr);
    assert(fromStr === c, `Bitstring parse mismatch at code ${c}`);
  }
  // Verify ASCII rendering works without crash
  const sampleAscii = TriangleMapper.renderAscii(0b101100);
  assert(sampleAscii.includes('●') && sampleAscii.includes('○'), 'Ascii diagram must render corners');
  console.log('  ✓ 64/64 Triangle geometric configurations verify 100% bijective roundtrip.');

  // ── Test 5: Encoder / Decoder Primitive Values Roundtrip ──────────────────
  console.log('\n[Test 5] Verifying Encoder / Decoder Roundtrip for Primitives...');
  // Null
  const nullBits = BinaryEncoder.encode(null);
  assert(nullBits === '000', 'Null must encode to 000');
  assert(BinaryDecoder.decode(nullBits).value === null, 'Decode null');

  // Booleans
  const falseBits = BinaryEncoder.encode(false);
  const trueBits = BinaryEncoder.encode(true);
  assert(falseBits === '0010', 'false must encode to 0010');
  assert(trueBits === '0011', 'true must encode to 0011');
  assert(BinaryDecoder.decode(falseBits).value === false, 'Decode false');
  assert(BinaryDecoder.decode(trueBits).value === true, 'Decode true');

  // Integers
  const testInts = [0, 1, -1, 42, -42, 127, -128, 65535, -65536, 1000000000, -1000000000];
  for (const n of testInts) {
    const bits = BinaryEncoder.encode(n);
    const decoded = BinaryDecoder.decode(bits).value;
    assert(decoded === n, `Integer roundtrip failed for ${n} (got ${decoded})`);
  }

  // Float64
  const testFloats = [0.0, 3.141592653589793, -2.718281828459045, 1e-10, -1e10];
  for (const f of testFloats) {
    const bits = BinaryEncoder.encode(f);
    const decoded = BinaryDecoder.decode(bits).value;
    assert(decoded === f, `Float64 roundtrip failed for ${f} (got ${decoded})`);
  }
  console.log('  ✓ Null, Booleans, Signed Integers, and IEEE 754 Floats roundtrip bit-exact.');

  // ── Test 6: Text & UTF-8 Strings Roundtrip ─────────────────────────────────
  console.log('\n[Test 6] Verifying Strings & Unicode Text Roundtrip...');
  const testStrings = [
    '',
    'hello',
    'ONE Language CUBiO',
    'Unicode: 🧠 ⚡ 📍 🏆',
    'Complex string with symbols !@#$%^&*()_+-=[]{}|;:,.<>?',
  ];
  for (const str of testStrings) {
    const bits = BinaryEncoder.encode(str);
    const decoded = BinaryDecoder.decode(bits).value;
    assert(decoded === str, `String roundtrip failed for '${str}'`);
  }
  console.log('  ✓ ASCII, Symbols, and Multi-byte Unicode UTF-8 strings roundtrip cleanly.');

  // ── Test 7: Address369 & Opcode Encoding Roundtrip ─────────────────────────
  console.log('\n[Test 7] Verifying Address369 & Opcode Instruction Roundtrip...');
  // All 369 Canonical Addresses
  for (let a = 0; a < CanonicalAddress369.TOTAL_ADDRESSES; a++) {
    const bits = BinaryEncoder.encode({ kind: 'address369', address: a });
    const decoded = BinaryDecoder.decode(bits).value as { kind: string; address: number };
    assert(decoded.kind === 'address369' && decoded.address === a, `Address369 roundtrip failed for ${a}`);
  }

  // Assigned Opcodes
  const opcodes = [
    TriangleOpcode.OP_NOP,
    TriangleOpcode.OP_HALT,
    TriangleOpcode.OP_READ,
    TriangleOpcode.OP_WRITE,
    TriangleOpcode.OP_INSPECT,
    TriangleOpcode.OP_ADD,
    TriangleOpcode.OP_JUMP,
    TriangleOpcode.OP_SHELL_ALLOC,
    TriangleOpcode.OP_BARRIER,
  ];
  for (const op of opcodes) {
    const bits = BinaryEncoder.encode({ kind: 'opcode', opcode: op });
    const decoded = BinaryDecoder.decode(bits).value as { kind: string; opcode: TriangleOpcode };
    assert(decoded.kind === 'opcode' && decoded.opcode === op, `Opcode roundtrip failed for 0x${op.toString(16)}`);
  }
  console.log('  ✓ All 369 Canonical Addresses and Triangle Opcodes roundtrip cleanly.');

  // ── Test 8: Concatenated Stream Decoding ──────────────────────────────────
  console.log('\n[Test 8] Verifying Multi-Element Stream Decoding...');
  const streamValues = [
    { kind: 'opcode' as const, opcode: TriangleOpcode.OP_PUSH },
    42,
    { kind: 'opcode' as const, opcode: TriangleOpcode.OP_WRITE },
    { kind: 'address369' as const, address: 197 },
    'NODE_SEALED',
    null,
  ];
  let fullStreamBits = '';
  for (const v of streamValues) {
    fullStreamBits += BinaryEncoder.encode(v);
  }

  const decodedStream = BinaryDecoder.decodeStream(fullStreamBits);
  assert(decodedStream.length === streamValues.length, 'Stream item count must match');
  for (let i = 0; i < streamValues.length; i++) {
    const original = streamValues[i];
    const decoded = decodedStream[i];
    if (typeof original === 'object' && original !== null) {
      assert(JSON.stringify(decoded) === JSON.stringify(original), `Item ${i} mismatch`);
    } else {
      assert(decoded === original, `Item ${i} mismatch`);
    }
  }
  console.log('  ✓ Multi-element concatenated binary stream decoded with exact framing.');

  // ── Test 9: Fail-Closed Bounds & Error Rejection ───────────────────────────
  console.log('\n[Test 9] Verifying Fail-Closed Error Rejection...');
  // 1. Incomplete stream
  let caughtIncomplete = false;
  try {
    BinaryDecoder.decode('01'); // only 2 bits, need 3 for tag
  } catch (err: any) {
    caughtIncomplete = err instanceof BinaryError && err.code === 'INCOMPLETE_STREAM';
  }
  assert(caughtIncomplete, 'Incomplete stream must throw INCOMPLETE_STREAM');

  // 2. Incomplete integer payload
  let caughtIncompleteInt = false;
  try {
    BinaryDecoder.decode('0100000100'); // type int, sign 0, len 4 (need 4 bits payload, got 0)
  } catch (err: any) {
    caughtIncompleteInt = err instanceof BinaryError && err.code === 'INCOMPLETE_STREAM';
  }
  assert(caughtIncompleteInt, 'Incomplete integer payload must throw INCOMPLETE_STREAM');

  // 3. Out-of-bounds address in decode
  let caughtAddrOOB = false;
  try {
    // tag '101' + address 400 ('110010000') -> outside 0..368
    const oobBits = '101' + (400).toString(2).padStart(9, '0');
    BinaryDecoder.decode(oobBits);
  } catch (err: any) {
    caughtAddrOOB = err instanceof BinaryError && err.code === 'ADDRESS_OUT_OF_BOUNDS';
  }
  assert(caughtAddrOOB, 'Out-of-bounds address 400 must throw ADDRESS_OUT_OF_BOUNDS');

  // 4. Invalid bitstream chars
  let caughtInvalidChars = false;
  try {
    BinaryDecoder.decode('0101201');
  } catch (err: any) {
    caughtInvalidChars = err instanceof BinaryError && err.code === 'INVALID_BITSTREAM';
  }
  assert(caughtInvalidChars, 'Non-binary characters must throw INVALID_BITSTREAM');
  console.log('  ✓ Incomplete streams, out-of-bounds addresses, and malformed inputs rejected fail-closed.');

  // ── Test 10: Performance and Bit Length Telemetry ─────────────────────────
  console.log('\n[Test 10] Performance & Storage Telemetry Check...');
  const t0 = performance.now();
  const iterations = 5000;
  for (let i = 0; i < iterations; i++) {
    const bits = BinaryEncoder.encode(i);
    BinaryDecoder.decode(bits);
  }
  const elapsedMs = performance.now() - t0;
  const ratePerSec = Math.round((iterations / (elapsedMs / 1000)));
  console.log(`  ✓ 5,000 Encode-Decode roundtrips executed in ${elapsedMs.toFixed(2)}ms (${ratePerSec.toLocaleString()} ops/sec).`);

  // ── Test 11: Fail-Closed Reserved Opcode Validation (FIND-H1 Correction) ──
  console.log('\n[Test 11] Verifying Fail-Closed Reserved Opcode Rejection & Assigned Opcode Integrity...');
  let assignedTested = 0;
  let reservedTested = 0;

  for (let c = 0; c < 64; c++) {
    const entry = BinaryCodebook.lookup6Bit(c);
    const opBits = '110' + entry.pattern;

    if (entry.status === 'ASSIGNED') {
      const res = BinaryDecoder.decode(opBits);
      assert(res.bitsConsumed === 9, `Assigned opcode 0x${c.toString(16)} must consume 9 bits`);
      assert((res.value as any)?.kind === 'opcode', `Assigned opcode 0x${c.toString(16)} must decode kind 'opcode'`);
      assert((res.value as any)?.opcode === c, `Assigned opcode 0x${c.toString(16)} value mismatch`);
      assignedTested++;
    } else {
      let threw = false;
      let errorCode = '';
      try {
        BinaryDecoder.decode(opBits);
      } catch (err: any) {
        threw = true;
        errorCode = err.code;
      }
      assert(threw, `Reserved opcode 0x${c.toString(16)} (pattern '${entry.pattern}') must throw`);
      assert(errorCode === 'RESERVED_OPCODE', `Reserved opcode 0x${c.toString(16)} must throw RESERVED_OPCODE, got ${errorCode}`);
      reservedTested++;
    }
  }

  assert(assignedTested === 26, `Must verify exactly 26 assigned opcodes, got ${assignedTested}`);
  assert(reservedTested === 38, `Must verify exactly 38 reserved opcodes, got ${reservedTested}`);
  console.log(`  ✓ All ${reservedTested} reserved opcodes rejected with RESERVED_OPCODE.`);
  console.log(`  ✓ All ${assignedTested} assigned opcodes remain cleanly decodable.`);

  console.log('\n' + '='.repeat(78));
  console.log('  PHASE 2 VERIFICATION: ALL 11 TESTS PASSED (100%)');
  console.log('='.repeat(78) + '\n');
}

if (require.main === module) {
  runPhase2BinaryTests();
}
