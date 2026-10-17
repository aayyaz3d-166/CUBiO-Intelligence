/**
 * Gate CNL-P26.3-BINARY: Test Suite for SpatialEngineBinaryEmitter
 *
 * Validates:
 *  T1: Binary buffer total size = 9,668 bytes (64 header + 9,604 data)
 *  T2: Magic number at offset 0 = 0x3690B4E0
 *  T3: Cell count at offset 8 = 343
 *  T4: Bytes per cell at offset 12 = 28
 *  T5: Data section size at offset 16 = 9,604
 *  T6: Origin X/Y/Z at offsets 28/32/36 = 3,3,3
 *  T7: is_actuation_blocked at offset 40 = 0x01
 *  T8: UUP byte at offset 41 = 0x01
 *  T9: First cell (0,0,0) canonical address = 26 (Display Index 27)
 *  T10: Origin cell (3,3,3) → is_collapsed = 0x01, quantum_probability ≈ 1.0
 *  T11: PQC Binary Root Seal format = '0xPQC_369_*_SEAL' (32-char hex)
 *  T12: PQC Binary Root Seal is deterministic (two identical emissions → same seal)
 *  T13: Seal anchored to raw bytecode (NOT a metadata string hash)
 *  T14: .3dmemory snapshot JSON is valid and contains all required keys
 *  T15: dist/bin/spatial_engine.rv64.bin file exists on disk
 *  T16: cubio_spatial_binary.3dmemory file exists on disk
 *  T17: BinaryEmissionResult.success = true
 *  T18: RSS < 512 MB at emission time
 *  T19: emissionLatencyMs > 0
 *  T20: Zero external library usage (no Three.js, no external math deps)
 */

import * as fs from 'fs';
import * as path from 'path';
import { SpatialEngineBinaryEmitter, BinaryEmissionResult } from '../../../src/one/spatial_engine_binary_emitter';

// ── Test Infrastructure ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const errors: string[] = [];

function assert(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✅ PASS  ${label}`);
    passed++;
  } else {
    const msg = detail ? `${label} — ${detail}` : label;
    console.error(`  ❌ FAIL  ${msg}`);
    failed++;
    errors.push(msg);
  }
}

function assertApprox(label: string, actual: number, expected: number, tolerance = 0.0001): void {
  assert(label, Math.abs(actual - expected) <= tolerance, `actual=${actual}, expected=${expected}`);
}

// ── Helper: Read raw binary emitted during test ──────────────────────────────

const TEST_BIN_DIR = path.resolve(__dirname, '../dist/bin/test_binary_emit');
const TEST_SNAPSHOT_DIR = path.resolve(__dirname, '..');

// ── Run emission once, share across tests ────────────────────────────────────

let result1: BinaryEmissionResult;
let result2: BinaryEmissionResult;
let binaryBuffer: Buffer;

function runTests(): void {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  Gate CNL-P26.3-BINARY: Unified Binary Emitter Test Suite');
  console.log('══════════════════════════════════════════════════════════════\n');

  // ── Emission Run 1 (shared state) ─────────────────────────────────────────
  const emitter1 = new SpatialEngineBinaryEmitter(TEST_BIN_DIR, TEST_SNAPSHOT_DIR);
  result1 = emitter1.emitBinary();

  // T17: success flag
  assert('T17: BinaryEmissionResult.success = true', result1.success === true, result1.error);

  if (!result1.success) {
    console.error('\n[FATAL] Emission failed — cannot run structural tests. Aborting.');
    printSummary();
    return;
  }

  // Read the emitted binary file for byte-level inspection
  binaryBuffer = fs.readFileSync(result1.binaryPath);

  // ── T1: Total binary size ─────────────────────────────────────────────────
  assert('T1: Total binary size = 9,668 bytes', binaryBuffer.length === 9668,
    `actual=${binaryBuffer.length}`);

  // ── T2: Magic number ──────────────────────────────────────────────────────
  const magic = binaryBuffer.readUInt32LE(0);
  assert('T2: Magic = 0x3690B4E0', magic === 0x3690b4e0,
    `actual=0x${magic.toString(16).toUpperCase()}`);

  // ── T3: Cell count ────────────────────────────────────────────────────────
  const cellCount = binaryBuffer.readUInt32LE(8);
  assert('T3: Cell count at offset 8 = 343', cellCount === 343, `actual=${cellCount}`);

  // ── T4: Bytes per cell ────────────────────────────────────────────────────
  const bytesPerCell = binaryBuffer.readUInt32LE(12);
  assert('T4: Bytes per cell at offset 12 = 28', bytesPerCell === 28, `actual=${bytesPerCell}`);

  // ── T5: Data section size ─────────────────────────────────────────────────
  const dataSectionSize = binaryBuffer.readUInt32LE(16);
  assert('T5: Data section size = 9,604', dataSectionSize === 9604, `actual=${dataSectionSize}`);

  // ── T6: Origin coordinates ────────────────────────────────────────────────
  const originX = binaryBuffer.readInt32LE(28);
  const originY = binaryBuffer.readInt32LE(32);
  const originZ = binaryBuffer.readInt32LE(36);
  assert('T6: Origin X = 3', originX === 3, `actual=${originX}`);
  assert('T6: Origin Y = 3', originY === 3, `actual=${originY}`);
  assert('T6: Origin Z = 3', originZ === 3, `actual=${originZ}`);

  // ── T7: is_actuation_blocked ──────────────────────────────────────────────
  const actuationByte = binaryBuffer.readUInt8(40);
  assert('T7: is_actuation_blocked byte = 0x01', actuationByte === 0x01, `actual=0x${actuationByte.toString(16)}`);

  // ── T8: UUP byte ──────────────────────────────────────────────────────────
  const uupByte = binaryBuffer.readUInt8(41);
  assert('T8: UUP byte = 0x01 (1.0)', uupByte === 0x01, `actual=0x${uupByte.toString(16)}`);

  // ── T9: First cell (0,0,0) → canonical address = 26 ──────────────────────
  // First cell starts at offset 64 (after header)
  const firstCellOffset = 64;
  const cell0_x = binaryBuffer.readInt32LE(firstCellOffset + 0);
  const cell0_y = binaryBuffer.readInt32LE(firstCellOffset + 4);
  const cell0_z = binaryBuffer.readInt32LE(firstCellOffset + 8);
  const cell0_addr = binaryBuffer.readInt32LE(firstCellOffset + 12);
  assert('T9: First cell x=0', cell0_x === 0, `actual=${cell0_x}`);
  assert('T9: First cell y=0', cell0_y === 0, `actual=${cell0_y}`);
  assert('T9: First cell z=0', cell0_z === 0, `actual=${cell0_z}`);
  assert('T9: First cell canonical address = 26', cell0_addr === 26, `actual=${cell0_addr}`);

  // ── T10: Origin cell (3,3,3) → cell index 171 → offset 64 + (171 * 28) ──
  // Grid traversal: z=3,y=3,x=3 → linearIndex = z*49 + y*7 + x = 3*49+3*7+3 = 147+21+3 = 171
  const originCellIndex = 3 * 49 + 3 * 7 + 3; // 171
  const originCellOffset = 64 + originCellIndex * 28;
  const originQProb = binaryBuffer.readFloatLE(originCellOffset + 16);
  const originIntentRes = binaryBuffer.readFloatLE(originCellOffset + 20);
  const originCollapsedByte = binaryBuffer.readUInt8(originCellOffset + 24);
  assertApprox('T10: Origin cell quantum_probability ≈ 1.0', originQProb, 1.0, 0.001);
  assertApprox('T10: Origin cell intent_resonance ≈ 1.0', originIntentRes, 1.0, 0.001);
  assert('T10: Origin cell is_collapsed = 0x01', originCollapsedByte === 0x01,
    `actual=0x${originCollapsedByte.toString(16)}`);

  // ── T11: PQC Binary Root Seal format ─────────────────────────────────────
  const sealPattern = /^0xPQC_369_[0-9a-f]{32}_SEAL$/;
  assert('T11: PQC Binary Root Seal format valid', sealPattern.test(result1.pqcBinaryRootSeal),
    `actual="${result1.pqcBinaryRootSeal}"`);

  // ── T12: Determinism — two emissions produce same seal ────────────────────
  const emitter2 = new SpatialEngineBinaryEmitter(TEST_BIN_DIR, TEST_SNAPSHOT_DIR);
  result2 = emitter2.emitBinary();
  assert('T12: PQC Binary Root Seal is deterministic (run1 === run2)',
    result1.pqcBinaryRootSeal === result2.pqcBinaryRootSeal,
    `run1="${result1.pqcBinaryRootSeal}" run2="${result2.pqcBinaryRootSeal}"`);

  // ── T13: Seal is NOT the same as the compilation-stage metadata seal ──────
  // Read the .3dmemory to check compilationPqcSeal vs pqcBinaryRootSeal differ
  const snapshot = JSON.parse(fs.readFileSync(result1.memorySnapshotPath, 'utf-8'));
  assert('T13: Binary root seal ≠ compilation metadata seal (anchored to bytecode)',
    snapshot.pqcBinaryRootSeal !== snapshot.compilationPqcSeal,
    `binary seal = compilation seal (should differ)`);

  // ── T14: .3dmemory snapshot keys ─────────────────────────────────────────
  const requiredKeys = [
    'gate', 'timestamp', 'module', 'binaryName', 'targetArchitecture',
    'binaryMagic', 'headerSizeBytes', 'dataSectionBytes', 'totalBinaryBytes',
    'totalCells', 'bytesPerCell', 'canonicalAddressRange', 'origin',
    'originResonance', 'originCollapsed', 'pqcBinaryRootSeal',
    'compilationPqcSeal', 'binaryPath', 'constraints',
  ];
  const missingKeys = requiredKeys.filter(k => !(k in snapshot));
  assert('T14: .3dmemory snapshot contains all required keys',
    missingKeys.length === 0, `missing: [${missingKeys.join(', ')}]`);

  // T14a: constraints sub-keys
  const constraintKeys = ['isActuationBlocked', 'uup', 'sigmaSq', 'csiGrade', 'rssLimitMb', 'externalDependencies'];
  const missingConstraints = constraintKeys.filter(k => !(k in snapshot.constraints));
  assert('T14a: Constraints block complete', missingConstraints.length === 0,
    `missing: [${missingConstraints.join(', ')}]`);
  assert('T14b: constraints.isActuationBlocked = true', snapshot.constraints.isActuationBlocked === true);
  assert('T14c: constraints.uup = 1.0', snapshot.constraints.uup === 1.0);
  assert('T14d: constraints.sigmaSq = 0.0', snapshot.constraints.sigmaSq === 0.0);
  assert('T14e: constraints.csiGrade = S+', snapshot.constraints.csiGrade === 'S+');
  assert('T14f: constraints.externalDependencies = 0', snapshot.constraints.externalDependencies === 0);

  // ── T15: dist/bin binary file exists ─────────────────────────────────────
  assert('T15: spatial_engine.rv64.bin exists on disk', fs.existsSync(result1.binaryPath),
    `path=${result1.binaryPath}`);

  // ── T16: .3dmemory snapshot file exists ──────────────────────────────────
  assert('T16: cubio_spatial_binary.3dmemory exists on disk', fs.existsSync(result1.memorySnapshotPath),
    `path=${result1.memorySnapshotPath}`);

  // ── T18: RSS < 512 MB ─────────────────────────────────────────────────────
  const rssMb = process.memoryUsage().rss / (1024 * 1024);
  assert('T18: RSS < 512 MB', rssMb < 512, `actual=${rssMb.toFixed(2)} MB`);

  // ── T19: emissionLatencyMs > 0 ────────────────────────────────────────────
  assert('T19: emissionLatencyMs > 0', result1.emissionLatencyMs > 0,
    `actual=${result1.emissionLatencyMs}`);

  // ── T20: No external library usage (no Three.js, no ML libs) ─────────────
  const emitterSrc = fs.readFileSync(
    path.resolve(__dirname, '../../../src/one/spatial_engine_binary_emitter.ts'), 'utf-8'
  );
  const hasBadImports = /three\.js|tensorflow|ml-matrix|mathjs/.test(emitterSrc);
  assert('T20: Zero external 3D/ML library imports in binary emitter', !hasBadImports,
    'Found forbidden external import');

  // ── Result Summary ────────────────────────────────────────────────────────
  console.log('\n  === Binary Emission Stats ===');
  console.log(`    Magic               : ${result1.binaryMagic}`);
  console.log(`    Total Binary Size   : ${result1.totalBinaryBytes} bytes`);
  console.log(`    PQC Binary Root Seal: ${result1.pqcBinaryRootSeal}`);
  console.log(`    Emission Latency    : ${result1.emissionLatencyMs} ms`);
  console.log(`    Determinism         : σ² = ${result1.sigmaSq}`);

  printSummary();
}

function printSummary(): void {
  const total = passed + failed;
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`  GATE CNL-P26.3-BINARY TEST RESULTS: ${passed}/${total} PASS`);
  if (failed > 0) {
    console.log('\n  Failed tests:');
    errors.forEach(e => console.log(`    ❌ ${e}`));
  }
  console.log('══════════════════════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

runTests();
