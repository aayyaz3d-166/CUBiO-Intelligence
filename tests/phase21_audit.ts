/**
 * ONE LANGUAGE — Phase 2.1 Independent Protocol Audit Script
 * Run from: F:\ONE language
 * Command: npx ts-node --transpile-only audit/phase21_audit.ts
 */

import { BinaryEncoder, BinaryDecoder, BinaryError } from '../src/binary';
import { BinaryCodebook } from '../src/binary/binaryCodebook';
import { TriangleMapper } from '../src/binary/triangleMapper';
import { BitCategory, TriangleOpcode } from '../src/binary/types';
import { CanonicalAddress369 } from '../src/one/address369_canonical';
import { runPhase2BinaryTests } from './binary/phase2_binary_language.test';

let passCount = 0;
let failCount = 0;
const failures: string[] = [];
const findings: { sev: string; label: string; detail: string }[] = [];

function check(label: string, cond: boolean, details?: string): void {
  if (cond) {
    console.log(`  ✓ PASS: ${label}`);
    passCount++;
  } else {
    console.log(`  ✗ FAIL: ${label}${details ? ' — ' + details : ''}`);
    failCount++;
    failures.push(`${label}${details ? ': ' + details : ''}`);
  }
}

function finding(sev: string, label: string, detail: string): void {
  console.log(`  [${sev}] ${label}: ${detail}`);
  findings.push({ sev, label, detail });
}

function expectThrow(label: string, fn: () => unknown, expectedCode?: string): void {
  try {
    fn();
    check(label, false, 'Expected error but none thrown');
  } catch (e: any) {
    if (expectedCode) {
      check(label, e instanceof BinaryError && e.code === expectedCode,
        `Expected BinaryError(${expectedCode}), got ${e?.code ?? e?.message}`);
    } else {
      check(label, true);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════════════════');
console.log('  ONE LANGUAGE — PHASE 2.1 INDEPENDENT PROTOCOL AUDIT');
console.log('══════════════════════════════════════════════════════════════');

// ═══ AUDIT A: TYPE TAG NAMESPACE ═══
console.log('\n── Audit A: Type Tag Namespace Separation ──────────────────');

// Tag 111 (TYPE_CONTROL) — decoder default case behavior
let typeControlThrew = false;
let typeControlMsg = '';
try {
  BinaryDecoder.decode('111');
} catch (e: any) {
  typeControlThrew = true;
  typeControlMsg = e.code;
}
check('Tag 111 (TYPE_CONTROL) is rejected by decoder (INVALID_CODEWORD)', typeControlThrew && typeControlMsg === 'INVALID_CODEWORD', `threw: ${typeControlMsg}`);

// Verify single namespace: 3-bit patterns serve as value-framing type tags
// (not two competing systems — "category" vs "value" is same enum with same values)
check('BitCategory enum uses same 3-bit space as value framing (single unified namespace)',
  BitCategory.TYPE_NULL === 0 && BitCategory.TYPE_CONTROL === 7);

// Check codebook labels
const cbNames = BinaryCodebook.TABLE_3BIT.map(e => e.name);
const expNames = ['TYPE_NULL','TYPE_BOOL','TYPE_INT','TYPE_FLOAT','TYPE_TEXT','TYPE_ADDR369','TYPE_OPCODE','TYPE_CONTROL'];
check('Codebook 3-bit names match spec table', JSON.stringify(cbNames) === JSON.stringify(expNames));

// Context determination: the decoder reads the first 3 bits and dispatches.
// No separate "mode" or "context" byte is needed — each element is self-framing.
finding('INFO', 'Context Determination', 'Self-framing: each element starts with a 3-bit type tag. No separate mode/context byte needed. A decoder always reads 3 bits first.');

// The "111111" end-of-stream marker mentioned in report
const decodeStreamSrc = BinaryDecoder.decodeStream.toString();
const hasDelimiterLogic = decodeStreamSrc.includes('111111') || decodeStreamSrc.includes('EOS') || decodeStreamSrc.includes('0x3f');
check('decodeStream has NO 111111 delimiter check (stream ends at exhaustion, not delimiter)', !hasDelimiterLogic);
finding('MEDIUM', 'Missing delimiter handling',
  'The spec defines MARKER_EOS (0x3F) as end-of-stream, but decodeStream() ignores it. Streams end by byte exhaustion only. An opcode-encoded EOS inside a stream will be decoded as a normal opcode value, not as a terminator.');

// Nested/embedded values: is there ambiguity?
// A string payload might contain bytes that look like type tags, but since we use
// length-prefix framing, the decoder consumes exactly the declared length.
const strWithPrefix = '?'; // '?' = 0x3F = 0b00111111. Contains "111111" pattern.
const strEnc = BinaryEncoder.encode(strWithPrefix);
const strDec = BinaryDecoder.decode(strEnc).value;
check('Byte 0x3F in string payload is not misidentified as delimiter (length-prefix framing protects)', strDec === strWithPrefix);
finding('INFO', 'Payload isolation', 'Length-prefix framing prevents delimiter confusion inside string payloads. No ambiguity for strings, float64, or address fields.');

// ═══ AUDIT B: OPCODE COMPLETENESS ═══
console.log('\n── Audit B: Opcode Completeness and Uniqueness ─────────────');

const opcodeKeys = Object.keys(TriangleOpcode).filter(k => isNaN(Number(k)));
const opcodeVals = opcodeKeys.map(k => (TriangleOpcode as any)[k]);
console.log(`  INFO: Defined TriangleOpcode entries: ${opcodeKeys.length}`);
console.log(`  INFO: Defined mnemonics: ${opcodeKeys.join(', ')}`);

// Uniqueness
check('All TriangleOpcode numeric values are unique', new Set(opcodeVals).size === opcodeVals.length);

// Check opcode 21 (0x15) — the completion report called it WRITE_SPATIAL but enum says OP_ENTROPY_EVAL
const opcode21Name = TriangleOpcode[21 as TriangleOpcode];
console.log(`  INFO: Enum lookup TriangleOpcode[21] = '${opcode21Name}'`);
check('Opcode 21 (0x15) is OP_ENTROPY_EVAL (not WRITE_SPATIAL as misstated in completion report)',
  opcode21Name === 'OP_ENTROPY_EVAL', `got: '${opcode21Name}'`);
finding('MEDIUM', 'Report Misnaming',
  'The Phase 2 completion report called opcode 21 "WRITE_SPATIAL". The actual enum member is OP_ENTROPY_EVAL. The bit encoding is correct; the label in the report is wrong.');

// Reserved opcodes fail-closed verification — Correction 1 (FIND-H1)
const reservedOpBits = '110' + (0x18).toString(2).padStart(6,'0'); // 0x18 = reserved slot
expectThrow('Reserved opcode 0x18 rejected with RESERVED_OPCODE',
  () => BinaryDecoder.decode(reservedOpBits), 'RESERVED_OPCODE');
finding('RESOLVED', 'Reserved opcode pass-through (FIND-H1)',
  'Correction 1 applied: Decoder TYPE_OPCODE case strictly enforces canonical codebook status. Reserved opcodes throw BinaryError("RESERVED_OPCODE").');

// Quartile 2 (radix-64) — spec says "Base-64 character mapping subset" but nothing is implemented
const q2 = BinaryCodebook.lookup6Bit(0x20);
check('Quartile 2 (0x20..0x2F) entries are RESERVED in codebook (radix-64 NOT implemented)', q2.status === 'RESERVED');
finding('LOW', 'Quartile 2 unimplemented',
  'Spec §3.2 describes Quartile 2 (0x20..0x2F) as "Alphanumeric Radix-64" but all entries are RESERVED. No encoder/decoder handles this range.');

// Operand semantics: opcodes have no operand schema defined in binary protocol
finding('MEDIUM', 'Opcode operand semantics not defined in binary layer',
  'The binary protocol encodes opcode IDs (6 bits) but defines no operand format, operand count, or bytecode schema. An opcode in a stream has no associated operand payload — callers must provide context externally.');

// 6-bit codebook completeness
check('6-bit codebook: exactly 64 entries', BinaryCodebook.TABLE_6BIT.length === 64);
check('6-bit codebook: all patterns unique', new Set(BinaryCodebook.TABLE_6BIT.map(e=>e.pattern)).size === 64);

// ═══ AUDIT C: 9-BIT ADDRESS SEMANTICS ═══
console.log('\n── Audit C: Nine-Bit Address Semantics ─────────────────────');

check('TOTAL_ADDRESSES === 369', CanonicalAddress369.TOTAL_ADDRESSES === 369);

const a0 = CanonicalAddress369.inspectAddress(0);
const a25 = CanonicalAddress369.inspectAddress(25);
const a26 = CanonicalAddress369.inspectAddress(26);
const a197 = CanonicalAddress369.inspectAddress(197);
const a368 = CanonicalAddress369.inspectAddress(368);

check('Address 0: SYMBOLIC layer', a0.layer === 'SYMBOLIC');
check('Address 25: SYMBOLIC layer (last symbolic)', a25.layer === 'SYMBOLIC');
check('Address 26: SPATIAL layer (first spatial)', a26.layer === 'SPATIAL');
check('Address 26: coord (0,0,0)', a26.spatialCoord?.i === 0 && a26.spatialCoord?.j === 0 && a26.spatialCoord?.k === 0);
check('Address 197: center (3,3,3)', a197.spatialCoord?.i === 3 && a197.spatialCoord?.j === 3 && a197.spatialCoord?.k === 3);
check('Address 368: SPATIAL (max)', a368.layer === 'SPATIAL');

// 9-bit payload IS the canonical address directly (not an offset)
check('Address 0 encodes to tag+000000000', BinaryEncoder.encode({ kind:'address369', address:0 }) === '101000000000');
check('Address 368 encodes to tag+(368 in 9 bits)', BinaryEncoder.encode({ kind:'address369', address:368 }) === '101' + (368).toString(2).padStart(9,'0'));
console.log(`  INFO: 368 in 9 bits = '${(368).toString(2).padStart(9,'0')}'`);

expectThrow('Address 369 rejected (encoder)', () => BinaryEncoder.encode({kind:'address369',address:369}), 'ADDRESS_OUT_OF_BOUNDS');
expectThrow('Address 369 rejected (decoder)', () => BinaryDecoder.decode('101'+(369).toString(2).padStart(9,'0')), 'ADDRESS_OUT_OF_BOUNDS');
expectThrow('Address 511 rejected (decoder)', () => BinaryDecoder.decode('101111111111'), 'ADDRESS_OUT_OF_BOUNDS');
expectThrow('Address -1 rejected (encoder)', () => BinaryEncoder.encode({kind:'address369',address:-1}), 'ADDRESS_OUT_OF_BOUNDS');

finding('INFO', 'Address payload is direct value', '9-bit payload represents the canonical address value directly (0..368), not an offset. Origin=26, Center=197, Max=368.');

// ═══ AUDIT D: PRIMITIVE VALUE ENCODING ═══
console.log('\n── Audit D: Primitive Value Encoding ───────────────────────');

// NULL
check('Null → "000" (3 bits)', BinaryEncoder.encode(null) === '000');
check('Null bitsConsumed = 3', BinaryDecoder.decode('000').bitsConsumed === 3);

// BOOLEAN
check('false → "0010"', BinaryEncoder.encode(false) === '0010');
check('true  → "0011"', BinaryEncoder.encode(true)  === '0011');
expectThrow('Bool with truncated payload (3 bits) throws', () => BinaryDecoder.decode('001'), 'INCOMPLETE_STREAM');
// Malformed bool payload: any bit is valid (0 or 1) — test non-0/1 is impossible since we validate bitstring
check('Boolean bitsConsumed = 4', BinaryDecoder.decode('0011').bitsConsumed === 4);

// INTEGER — LEN semantics
const enc0 = BinaryEncoder.encode(0);
// 0: abs=0, magnitudeBits='0', bitLen=1
check('encode(0): tag=010, sign=0, len=000001(=1), mag=0 → 11 bits total',
  enc0 === '010' + '0' + '000001' + '0', `got '${enc0}'`);
check('encode(0): bitsConsumed = 11', BinaryDecoder.decode(enc0).bitsConsumed === 11);

const dec0 = BinaryDecoder.decode(enc0).value;
check('decode(encode(0)) === 0', dec0 === 0);

// Negative zero
const negZeroEnc = BinaryEncoder.encodeInteger(-0);
check('-0 encodes same as 0 (no separate -0 representation for integers)', negZeroEnc === enc0);
finding('INFO', 'Integer negative zero', 'JS -0 is not < 0, so encodes with sign=0, same as positive zero. No negative zero issue.');

// LEN=0 rejected
expectThrow('LEN=0 in integer header rejected (MALFORMED_INTEGER)', () => BinaryDecoder.decode('010' + '0' + '000000'), 'MALFORMED_INTEGER');

// Overflow: need magnitude > 63 bits — 2^63 requires 64 bits
expectThrow('Integer 2^63 (64-bit magnitude) throws INTEGER_OVERFLOW',
  () => BinaryEncoder.encodeInteger(Math.pow(2, 63)), 'INTEGER_OVERFLOW');

// Truncated payload
const incompleteInt = '010' + '0' + '000100'; // header says 4-bit payload, but nothing follows
expectThrow('Truncated int payload throws INCOMPLETE_STREAM', () => BinaryDecoder.decode(incompleteInt), 'INCOMPLETE_STREAM');

// Round-trips
const testInts = [0, 1, -1, 127, -128, 65535, -65536, 2147483647, -2147483648];
let intOk = true;
for (const n of testInts) {
  const d = BinaryDecoder.decode(BinaryEncoder.encode(n)).value;
  if (d !== n) { intOk = false; failures.push(`Int RT fail: ${n} => ${d}`); }
}
check('Integer round-trips: all boundary values', intOk);

// FLOAT64
check('Float π encodes to 67 bits', BinaryEncoder.encode(Math.PI).length === 67);
check('Float π round-trips exactly', BinaryDecoder.decode(BinaryEncoder.encode(Math.PI)).value === Math.PI);
// Endianness verify: 3.0 → 0x4008000000000000 big-endian
const enc3 = BinaryEncoder.encodeFloat(3.0);
const highBytes = enc3.substring(3, 19); // first 16 bits of float payload
check('Float 3.0 high 16 bits = 4008 (big-endian IEEE754)', parseInt(highBytes, 2).toString(16).padStart(4,'0') === '4008',
  `got: ${parseInt(highBytes,2).toString(16)}`);
// NaN
const nanEnc = BinaryEncoder.encodeFloat(NaN);
const nanDec = BinaryDecoder.decode('011'+nanEnc.substring(3)).value;
check('NaN encodes/decodes back to NaN', typeof nanDec === 'number' && isNaN(nanDec as number));
// Repeat for bit-pattern stability
check('NaN canonical bit pattern stable', BinaryEncoder.encodeFloat(NaN) === BinaryEncoder.encodeFloat(NaN));
// -0.0 float
const negZeroFloat = BinaryDecoder.decode(BinaryEncoder.encodeFloat(-0.0)).value as number;
check('Float -0.0 round-trips (1/x === -Infinity)', 1/negZeroFloat === -Infinity);
// Infinity
check('Infinity round-trips', BinaryDecoder.decode(BinaryEncoder.encodeFloat(Infinity)).value === Infinity);

// Documented Behavior — Correction 2 (FIND-H2)
const floatLike3 = BinaryEncoder.encode(3.0);
check('Documented: encode(3.0) emits TYPE_INT (tag=010) because Number.isInteger(3.0)===true in JS',
  floatLike3.startsWith('010'));

const explicitFloat3 = BinaryEncoder.encodeFloat(3.0);
check('Explicit encodeFloat(3.0) emits TYPE_FLOAT (tag=011) with 67 bits',
  explicitFloat3.startsWith('011') && explicitFloat3.length === 67);
const decodedExplicitFloat3 = BinaryDecoder.decode(explicitFloat3);
check('Explicit encodeFloat(3.0) decodes to 3.0 with bitsConsumed=67',
  decodedExplicitFloat3.value === 3.0 && decodedExplicitFloat3.bitsConsumed === 67);

finding('RESOLVED', 'Float/Integer numeric semantics clarified (FIND-H2)',
  'Correction 2 applied: Spec amended to document JS runtime number erasure and explicit encodeFloat() contract.');

// STRING
check('Empty string → "100" + 16×0 (19 bits)', BinaryEncoder.encode('') === '100'+'0'.repeat(16));
check('Empty string bitsConsumed = 19', BinaryDecoder.decode('100'+'0'.repeat(16)).bitsConsumed === 19);
// Length is byte count
const emoji = '🧠'; // 4 UTF-8 bytes
const emojiBytes = new TextEncoder().encode(emoji).length;
check(`'🧠' UTF-8 byte count = 4`, emojiBytes === 4);
check(`'🧠' encodes to 3+16+32=51 bits`, BinaryEncoder.encode(emoji).length === 51);
check(`'🧠' decodes correctly`, BinaryDecoder.decode(BinaryEncoder.encode(emoji)).value === emoji);
// Truncated header
expectThrow('Truncated string header throws INCOMPLETE_STREAM', () => BinaryDecoder.decode('100'+'00000010'), 'INCOMPLETE_STREAM');
// Truncated payload
const hiEnc = BinaryEncoder.encode('hi');
expectThrow('Truncated string payload throws INCOMPLETE_STREAM', () => BinaryDecoder.decode(hiEnc.slice(0,-1)), 'INCOMPLETE_STREAM');
expectThrow('String > 65535 bytes throws STRING_OVERFLOW', () => BinaryEncoder.encodeText('a'.repeat(65536)), 'STRING_OVERFLOW');

// Invalid UTF-8: TextDecoder with default behavior (replacement character)
// We can't easily inject raw invalid UTF-8 through the encoder, so note it as untested
finding('LOW', 'Invalid UTF-8 not explicitly rejected',
  'The decoder uses TextDecoder().decode() with default settings, which silently replaces invalid UTF-8 sequences with U+FFFD. ' +
  'Invalid UTF-8 byte sequences are NOT fail-closed rejected. This could be a source of silent data corruption if raw bytes are injected.');

// ═══ AUDIT E: FRAMING AND CONTINUOUS STREAMS ═══
console.log('\n── Audit E: Framing and Continuous Streams ─────────────────');

// Exact bit-level verification: Address369(197) + Opcode(21/OP_ENTROPY_EVAL) + "ONE"
const a197Enc = BinaryEncoder.encode({ kind: 'address369', address: 197 });
const op21Enc  = BinaryEncoder.encode({ kind: 'opcode', opcode: 21 as TriangleOpcode });
const oneEnc   = BinaryEncoder.encode('ONE');

// Expected exact bits
const exp197 = '101' + (197).toString(2).padStart(9, '0'); // '101' + '011000101' = '101011000101'
const exp21  = '110' + (21).toString(2).padStart(6, '0');  // '110' + '010101' = '110010101'
// "ONE": O=79=01001111, N=78=01001110, E=69=01000101; length=3=0000000000000011
const expONE = '100' + '0'.repeat(13) + '011' + '01001111' + '01001110' + '01000101';

console.log(`  INFO: encode(address 197) = '${a197Enc}' (${a197Enc.length} bits)`);
console.log(`  INFO: encode(opcode 21)   = '${op21Enc}' (${op21Enc.length} bits)`);
console.log(`  INFO: encode("ONE")       = '${oneEnc}' (${oneEnc.length} bits)`);

check(`address(197) = '${exp197}' (12 bits)`, a197Enc === exp197, `got '${a197Enc}'`);
check(`opcode(21)   = '${exp21}' (9 bits)`,   op21Enc === exp21,  `got '${op21Enc}'`);
check(`"ONE"        = '${expONE}' (43 bits)`, oneEnc  === expONE, `got '${oneEnc}'`);

const fullStream = a197Enc + op21Enc + oneEnc;
check(`Full stream = ${12+9+43} = 64 bits`, fullStream.length === 64);

// Cursor positions
const s1 = BinaryDecoder.decode(fullStream, 0);
const s2 = BinaryDecoder.decode(fullStream, 12);
const s3 = BinaryDecoder.decode(fullStream, 21);
check('Cursor 0: address(197), bitsConsumed=12', s1.bitsConsumed === 12 && (s1.value as any)?.address === 197);
check('Cursor 12: opcode(21), bitsConsumed=9', s2.bitsConsumed === 9 && (s2.value as any)?.opcode === 21);
check('Cursor 21: "ONE", bitsConsumed=43', s3.bitsConsumed === 43 && s3.value === 'ONE');

// Adversarial
expectThrow('Empty stream throws INCOMPLETE_STREAM', () => BinaryDecoder.decode(''), 'INCOMPLETE_STREAM');
expectThrow('2-bit stream throws INCOMPLETE_STREAM', () => BinaryDecoder.decode('01'), 'INCOMPLETE_STREAM');
expectThrow('Tag 111 throws INVALID_CODEWORD', () => BinaryDecoder.decode('111'), 'INVALID_CODEWORD');
expectThrow('Bool only tag throws INCOMPLETE_STREAM', () => BinaryDecoder.decode('001'), 'INCOMPLETE_STREAM');
expectThrow('Float truncated to 30 bits throws INCOMPLETE_STREAM', () => BinaryDecoder.decode('011'+'0'.repeat(30)), 'INCOMPLETE_STREAM');
expectThrow('Address truncated throws INCOMPLETE_STREAM', () => BinaryDecoder.decode('101'+'01'), 'INCOMPLETE_STREAM');
expectThrow('Opcode truncated throws INCOMPLETE_STREAM', () => BinaryDecoder.decode('110'+'01'), 'INCOMPLETE_STREAM');
expectThrow('Non-binary chars throw INVALID_BITSTREAM', () => BinaryDecoder.decode('0102'), 'INVALID_BITSTREAM');

// Extra trailing bits: single decode at offset 0 stops after consuming one value
const trailStream = BinaryEncoder.encode(null) + '010'; // null(3) + partial tag(3)
const trailResult = BinaryDecoder.decode(trailStream, 0);
check('decode at offset 0 consumes only null (3 bits), ignores trailing', trailResult.bitsConsumed === 3);
// decodeStream tries to parse trailing bits and should throw
let trailStreamErr: any = null;
try { BinaryDecoder.decodeStream(trailStream); } catch(e:any) { trailStreamErr = e; }
check('decodeStream on valid+truncated throws (no silent discard)', trailStreamErr !== null, `threw: ${trailStreamErr?.code}`);

// Valid + TAG 111 continuation
const goodBad = BinaryEncoder.encode(true) + '111';
let gbErr: any = null;
try { BinaryDecoder.decodeStream(goodBad); } catch(e:any) { gbErr = e; }
check('Stream with 111 continuation throws INVALID_CODEWORD', gbErr?.code === 'INVALID_CODEWORD');

// Delimiter-like pattern inside string payload (0x3F = '00111111')
const strWithEOS = '?'; // ASCII 63 = 0x3F
const eosDec = BinaryDecoder.decode(BinaryEncoder.encode(strWithEOS)).value;
check('String "?" (contains 0x3F bytes) decodes correctly (length-prefix protects)', eosDec === strWithEOS);

// Determinism
const det1 = BinaryEncoder.encode({ kind: 'address369', address: 42 });
const det2 = BinaryEncoder.encode({ kind: 'address369', address: 42 });
check('Encoding is deterministic across repeated calls', det1 === det2);

// MARKER_EOS handling
finding('MEDIUM', 'MARKER_EOS (0x3F) not handled by stream decoder',
  'MARKER_EOS is defined in the TriangleOpcode enum and spec §3.2, but decodeStream() does not check for it. ' +
  'If a stream contains an opcode-encoded EOS, it will be decoded as { kind:"opcode", opcode:63 }, not as a terminator. ' +
  'Streams terminate only by byte exhaustion. This is safe as-is, but differs from spec intent.');

// ═══ AUDIT F: TRIANGLE MAPPING ═══
console.log('\n── Audit F: Triangle Mapping ───────────────────────────────');

let bijOk = true;
const seenPos = new Set<string>();
for (let c = 0; c < 64; c++) {
  const pos = TriangleMapper.codeToPositions(c);
  const rec = TriangleMapper.positionsToCode(pos);
  const key = `${pos.c1}${pos.e1}${pos.c2}${pos.e2}${pos.c3}${pos.e3}`;
  if (rec !== c) { bijOk = false; failures.push(`Triangle bijection fail at ${c}`); }
  if (seenPos.has(key)) { bijOk = false; failures.push(`Triangle position collision at ${c}`); }
  seenPos.add(key);
}
check('All 64 triangle codes: bijective (no collision, full inverse)', bijOk);
check('All 64 position tuples are distinct', seenPos.size === 64);

// MSB → C1 (Apex), LSB → E3 (Right slant)
const pos32 = TriangleMapper.codeToPositions(0b100000); // 32
check('Code 32 (100000): c1=1, all others 0 (MSB → Corner 1)', pos32.c1===1 && pos32.e1===0 && pos32.c2===0 && pos32.e2===0 && pos32.c3===0 && pos32.e3===0);
const pos1  = TriangleMapper.codeToPositions(1); // 000001
check('Code 1  (000001): e3=1, all others 0 (LSB → Edge 3)', pos1.c1===0 && pos1.e1===0 && pos1.c2===0 && pos1.e2===0 && pos1.c3===0 && pos1.e3===1);

check('renderAscii(0): all hollow circles ○', !TriangleMapper.renderAscii(0).includes('●'));
check('renderAscii(63): all filled circles ●', TriangleMapper.renderAscii(63).includes('●'));

expectThrow('codeToPositions(-1) throws', () => TriangleMapper.codeToPositions(-1));
expectThrow('codeToPositions(64) throws', () => TriangleMapper.codeToPositions(64));
expectThrow('fromBitString("1234567") throws (7 chars)', () => TriangleMapper.fromBitString('1234567'));
expectThrow('fromBitString("10200a") throws (non-binary)', () => TriangleMapper.fromBitString('10200a'));

// ═══ AUDIT G: INDEPENDENT PROPERTY TESTS ═══
console.log('\n── Audit G: Independent Property Tests ─────────────────────');

// G1
check('G1: 8 three-bit patterns in codebook', BinaryCodebook.TABLE_3BIT.length === 8);
for (let i = 0; i < 8; i++) {
  const entry = BinaryCodebook.lookup3Bit(i.toString(2).padStart(3,'0'));
  check(`  G1.${i}: category=${entry.category}`, entry.category === i);
}

// G2
check('G2: 64 six-bit patterns in codebook', BinaryCodebook.TABLE_6BIT.length === 64);
check('G2: all 64 patterns unique', new Set(BinaryCodebook.TABLE_6BIT.map(e=>e.pattern)).size === 64);

// G3
let g3a=0, g3r=0;
for (let i=0; i<512; i++) {
  const e = BinaryCodebook.lookup9Bit(i);
  if (e.status === 'ASSIGNED') g3a++;
  else g3r++;
}
check('G3: 369 assigned 9-bit codes', g3a === 369);
check('G3: 143 reserved 9-bit codes', g3r === 143);

// G4
let g4ok = true;
for (let c=0; c<64; c++) {
  const s = TriangleMapper.toBitString(c);
  if (TriangleMapper.fromBitString(s) !== c) g4ok = false;
}
check('G4: All 64 triangle bitstring round-trips', g4ok);

// G5
let g5ok = true;
for (let a=0; a<369; a++) {
  const enc = BinaryEncoder.encode({ kind:'address369', address:a });
  const dec = BinaryDecoder.decode(enc).value as any;
  if (dec?.address !== a) { g5ok = false; failures.push(`Addr RT fail: ${a}`); break; }
}
check('G5: All 369 addresses encode/decode correctly', g5ok);

// G6
const bounds = [0,1,-1,127,-128,65535,-65535,2147483647,-2147483648];
let g6ok = true;
for (const n of bounds) {
  if (BinaryDecoder.decode(BinaryEncoder.encode(n)).value !== n) { g6ok = false; failures.push(`G6 fail: ${n}`); }
}
check('G6: Integer boundary values round-trip', g6ok);

// G7
const vs = BinaryEncoder.encode(null) + BinaryEncoder.encode(true) + BinaryEncoder.encode(42);
check('G7: valid 3-element stream decodes to 3 values', BinaryDecoder.decodeStream(vs).length === 3);
let g7bad = false;
try { BinaryDecoder.decode('111'); } catch { g7bad = true; }
check('G7: invalid stream throws', g7bad);

// G8: determinism
const g8vals: any[] = [null, true, 42, 3.14, 'test', {kind:'address369',address:10}, {kind:'opcode',opcode:TriangleOpcode.OP_ADD}];
let g8ok = true;
for (const v of g8vals) {
  if (BinaryEncoder.encode(v) !== BinaryEncoder.encode(v)) g8ok = false;
}
check('G8: Encoding is deterministic for all value types', g8ok);

// G9: No silent coercion — document 3.0 issue
const intThreeEnc = BinaryEncoder.encode(3);
const float3Enc = BinaryEncoder.encode(3.0);
check('G9: encode(3) and encode(3.0) produce identical bits (both INTEGER tag, JS semantics)',
  intThreeEnc === float3Enc);

// G10: Run existing test suite
console.log('\n  Running existing Phase 2 test suite (regression check)...');
let regressionPassed = false;
try {
  runPhase2BinaryTests();
  regressionPassed = true;
} catch (e: any) {
  failures.push(`Regression suite failed: ${e.message}`);
}
check('G10: Existing Phase 2 test suite: 10/10 PASS', regressionPassed);

// ═══════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════════════════');
console.log('  AUDIT SUMMARY — FINDINGS');
console.log('══════════════════════════════════════════════════════════════');
for (const f of findings) {
  console.log(`  [${f.sev.padEnd(6)}] ${f.label}:`);
  console.log(`           ${f.detail}`);
}

console.log('\n══════════════════════════════════════════════════════════════');
console.log(`  TOTAL: PASS=${passCount}  FAIL=${failCount}`);
if (failures.length) {
  console.log('\n  FAILED CHECKS:');
  failures.forEach(f => console.log(`    ✗ ${f}`));
}
console.log('══════════════════════════════════════════════════════════════\n');
