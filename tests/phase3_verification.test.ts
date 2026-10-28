/**
 * ONE Language & CubiO Spatial VM — Phase 3
 * Comprehensive Test Suite (tests/phase3_verification.test.ts)
 *
 * Covers:
 *  1. FNV-1a 32-bit checksum correctness
 *  2. Serialize → Deserialize round-trip (all occupied cells restored)
 *  3. Checksum tamper detection (SNAPSHOT_VERIFY catches corruption)
 *  4. Shell-range query (cells in shell band [1, 2])
 *  5. Entropy-range query (Zone B: 0.6 ≤ S ≤ 1.4)
 *  6. Tag-based query
 *  7. K-Nearest-Neighbor query
 *  8. Snapshot diff (added / removed / modified tracking)
 *  9. Shell aggregate stats
 * 10. Entropy centroid
 * 11. End-to-end: populate lattice via Phase 2 dispatcher → snapshot → query → load → verify integrity
 */

import { GridMemory } from '../src/vm/gridMemory';
import { LatticeSnapshotEngine } from '../src/vm/latticeSnapshot';
import { SpatialQueryEngine } from '../src/vm/spatialQuery';
import { CubioVMPhase3, Phase3Opcode } from '../src/vm/cubioVMPhase3';
import { Opcode } from '../src/vm/cubioVM';
import { BitAgent } from '../src/vm/bitAgent';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}
function assertClose(a: number, b: number, tol = 1e-3, msg = '') {
  if (Math.abs(a - b) > tol) throw new Error(`ASSERTION FAILED: ${msg} (got ${a}, expected ${b})`);
}

export function runPhase3Tests() {
  console.log('='.repeat(78));
  console.log('       ONE LANGUAGE & CUBIO SPATIAL VM: PHASE 3 TEST SUITE');
  console.log('='.repeat(78));

  const snap = new LatticeSnapshotEngine();

  // =========================================================================
  // TEST 1: FNV-1a Checksum Correctness
  // =========================================================================
  console.log('\n[TEST 1] FNV-1a 32-bit Checksum...');

  // Known vectors
  const emptyHash = LatticeSnapshotEngine.fnv1a32(new Uint8Array(0));
  assert(emptyHash === 0x811c9dc5, `FNV-1a empty hash must be 0x811c9dc5, got 0x${emptyHash.toString(16)}`);

  // "a" -> FNV-1a 32 = 0xe40c292c
  const aHash = LatticeSnapshotEngine.fnv1a32(new Uint8Array([0x61]));
  assert(aHash === 0xe40c292c, `FNV-1a('a') must be 0xe40c292c, got 0x${aHash.toString(16)}`);

  // Verify different data produces different hash
  const h1 = LatticeSnapshotEngine.fnv1a32(new Uint8Array([1, 2, 3]));
  const h2 = LatticeSnapshotEngine.fnv1a32(new Uint8Array([1, 2, 4]));
  assert(h1 !== h2, 'Different data must produce different FNV-1a hash');
  console.log(`   Checksum empty=0x${emptyHash.toString(16).padStart(8,'0').toUpperCase()}, "a"=0x${aHash.toString(16).padStart(8,'0').toUpperCase()}`);
  console.log('   [PASS] FNV-1a checksum verified.');

  // =========================================================================
  // TEST 2: Serialize → Deserialize Round-Trip
  // =========================================================================
  console.log('\n[TEST 2] Snapshot Serialize → Deserialize Round-Trip...');
  const mem = new GridMemory();

  const payloads: Array<{ coord: { x: number; y: number; z: number }; data: string }> = [
    { coord: { x: 3, y: 3, z: 3 }, data: 'CORE_PAYLOAD' },
    { coord: { x: 0, y: 0, z: 0 }, data: 'ORIGIN_PAYLOAD' },
    { coord: { x: 6, y: 6, z: 6 }, data: 'CORNER_PAYLOAD' },
    { coord: { x: 1, y: 2, z: 3 }, data: 'MIXED_PAYLOAD' },
  ];

  for (const { coord, data } of payloads) {
    const bytes = new TextEncoder().encode(data);
    mem.write(coord, bytes, { entropyScore: 1.2, bitDensity: 0.5, tags: [data] });
  }

  const { buffer, metadata } = snap.serialize(mem);
  console.log(` - Snapshot: ${metadata.totalCellsWritten} cells, ${metadata.byteSize} bytes, checksum=0x${metadata.checksum.toString(16).toUpperCase()}`);
  assert(metadata.totalCellsWritten === 4, 'Snapshot must record 4 occupied cells');
  assert(metadata.magic === 'ONE1', 'Snapshot magic must be ONE1');

  const { memory: restored, valid } = snap.deserialize(buffer);
  assert(valid, 'Deserialized snapshot checksum must be valid');
  assert(restored.getStats().occupiedCells === 4, 'Restored memory must have 4 occupied cells');

  for (const { coord, data } of payloads) {
    const cell = restored.read(coord);
    assert(cell !== null && cell.occupied, `Cell at [${coord.x},${coord.y},${coord.z}] must be occupied`);
    const text = new TextDecoder().decode(cell!.data!);
    assert(text === data, `Cell data must be '${data}', got '${text}'`);
  }
  console.log('   [PASS] Round-trip snapshot serialization verified.');

  // =========================================================================
  // TEST 3: Checksum Tamper Detection
  // =========================================================================
  console.log('\n[TEST 3] Snapshot Checksum Tamper Detection...');
  const tampered = new Uint8Array(buffer);
  tampered[20] ^= 0xff; // flip bits in payload

  const { valid: tamperedValid } = snap.deserialize(tampered);
  assert(!tamperedValid, 'Tampered snapshot must report invalid checksum');
  console.log('   [PASS] Tamper detection verified (invalid checksum correctly reported).');

  // =========================================================================
  // TEST 4: Shell-Range Query
  // =========================================================================
  console.log('\n[TEST 4] Shell-Range Query (Shell 1–2)...');
  const queryMem = new GridMemory();
  // Write one cell in each shell
  queryMem.write({ x: 3, y: 3, z: 3 }, new Uint8Array([1]), { entropyScore: 0.1 }); // Shell 0
  queryMem.write({ x: 2, y: 3, z: 3 }, new Uint8Array([2]), { entropyScore: 0.8 }); // Shell 1
  queryMem.write({ x: 1, y: 3, z: 3 }, new Uint8Array([3]), { entropyScore: 1.5 }); // Shell 2
  queryMem.write({ x: 0, y: 3, z: 3 }, new Uint8Array([4]), { entropyScore: 1.9 }); // Shell 3

  const qe = new SpatialQueryEngine(queryMem);
  const shellResult = qe.queryByShellRange(1, 2);
  assert(shellResult.matchCount === 2, 'Shell [1,2] query must match 2 cells');
  console.log(`   Shell [1,2] query: ${shellResult.matchCount} matches in ${shellResult.executionTimeMs}ms`);
  console.log('   [PASS] Shell-range query verified.');

  // =========================================================================
  // TEST 5: Entropy-Range Query
  // =========================================================================
  console.log('\n[TEST 5] Entropy-Range Query (Zone B: 0.6 ≤ S ≤ 1.4)...');
  const zoneB = qe.queryByEntropyRange(0.6, 1.4);
  assert(zoneB.matchCount === 1, 'Zone B entropy query must match exactly 1 cell (S=0.8)');
  assertClose(zoneB.cells[0].entropyScore, 0.8, 0.01, 'Zone B cell entropy must be ~0.8');
  console.log(`   Zone B query: ${zoneB.matchCount} match, S=${zoneB.cells[0].entropyScore.toFixed(3)}`);
  console.log('   [PASS] Entropy-range query verified.');

  // =========================================================================
  // TEST 6: Tag-Based Query
  // =========================================================================
  console.log('\n[TEST 6] Tag-Based Query...');
  const tagMem = new GridMemory();
  tagMem.write({ x: 0, y: 0, z: 0 }, new Uint8Array([0xaa]), { tags: ['ALPHA', 'SHARED'] });
  tagMem.write({ x: 1, y: 0, z: 0 }, new Uint8Array([0xbb]), { tags: ['BETA', 'SHARED'] });
  tagMem.write({ x: 2, y: 0, z: 0 }, new Uint8Array([0xcc]), { tags: ['GAMMA'] });
  const tagQE = new SpatialQueryEngine(tagMem);

  const sharedResult = tagQE.queryByAnyTag(['SHARED']);
  assert(sharedResult.matchCount === 2, 'SHARED tag query must return 2 cells');

  const betaResult = tagQE.queryByAllTags(['BETA', 'SHARED']);
  assert(betaResult.matchCount === 1, 'BETA+SHARED tag query must return 1 cell');

  const gammaResult = tagQE.queryByAnyTag(['GAMMA']);
  assert(gammaResult.matchCount === 1, 'GAMMA tag query must return 1 cell');
  console.log('   [PASS] Tag-based queries verified.');

  // =========================================================================
  // TEST 7: K-Nearest-Neighbor Query
  // =========================================================================
  console.log('\n[TEST 7] K-Nearest-Neighbor Query...');
  const knn3 = qe.knn({ x: 3, y: 3, z: 3 }, 3);
  assert(knn3.length === 3, 'KNN k=3 must return 3 cells');
  // Closest to [3,3,3] should be Shell 0 cell at [3,3,3] itself (dist=0)
  assert(knn3[0].coord.x === 3 && knn3[0].coord.y === 3 && knn3[0].coord.z === 3,
    'Nearest neighbor must be the core cell [3,3,3]');
  console.log(`   KNN(k=3): [${knn3.map(c => `[${c.coord.x},${c.coord.y},${c.coord.z}]`).join(', ')}]`);
  console.log('   [PASS] K-Nearest-Neighbor query verified.');

  // =========================================================================
  // TEST 8: Snapshot Diff (Added / Removed / Modified)
  // =========================================================================
  console.log('\n[TEST 8] Snapshot Diff (Added / Removed / Modified)...');
  const baseMem = new GridMemory();
  baseMem.write({ x: 3, y: 3, z: 3 }, new Uint8Array([0xAA]), { entropyScore: 1.0 });
  baseMem.write({ x: 0, y: 0, z: 0 }, new Uint8Array([0xBB]), { entropyScore: 0.5 });
  const baseSnap = snap.serialize(baseMem).buffer;

  const newMem = new GridMemory();
  newMem.write({ x: 3, y: 3, z: 3 }, new Uint8Array([0xFF]), { entropyScore: 1.0 }); // modified
  // [0,0,0] removed
  newMem.write({ x: 6, y: 6, z: 6 }, new Uint8Array([0xCC]), { entropyScore: 1.8 }); // added
  const newSnap = snap.serialize(newMem).buffer;

  const diff = snap.diff(baseSnap, newSnap);
  console.log(` - Diff: +${diff.added.length} added, -${diff.removed.length} removed, ~${diff.modified.length} modified, =${diff.unchangedCount} unchanged`);
  assert(diff.added.length === 1, 'Diff must show 1 added cell ([6,6,6])');
  assert(diff.removed.length === 1, 'Diff must show 1 removed cell ([0,0,0])');
  assert(diff.modified.length === 1, 'Diff must show 1 modified cell ([3,3,3])');
  assert(diff.unchangedCount === 0, 'No cell must be unchanged');
  console.log('   [PASS] Snapshot diff verified.');

  // =========================================================================
  // TEST 9: Shell Aggregate Stats
  // =========================================================================
  console.log('\n[TEST 9] Shell Aggregate Statistics...');
  const aggs = qe.shellAggregates();
  assert(aggs.length === 4, 'Must produce stats for 4 shells (0..3)');
  // Shell 0 has 1 cell with S=0.1
  assertClose(aggs[0].avgEntropy, 0.1, 0.01, 'Shell 0 avg entropy must be ~0.1');
  // Shell 1 has 1 cell with S=0.8
  assertClose(aggs[1].avgEntropy, 0.8, 0.01, 'Shell 1 avg entropy must be ~0.8');
  console.log(' - Shell aggregates:');
  aggs.forEach((a) => {
    if (a.count > 0) {
      console.log(`     Shell ${a.shellRadius}: count=${a.count}, avgS=${a.avgEntropy.toFixed(3)}, bytes=${a.totalBytes}`);
    }
  });
  console.log('   [PASS] Shell aggregate stats verified.');

  // =========================================================================
  // TEST 10: Entropy Centroid
  // =========================================================================
  console.log('\n[TEST 10] Entropy Centroid...');
  const centroid = qe.entropyCentroid();
  console.log(` - Entropy centroid: [${centroid.x}, ${centroid.y}, ${centroid.z}]`);
  // With 4 cells at shells 0,1,2,3 weighted by entropy, centroid should be away from [3,3,3]
  assert(centroid.x >= 0 && centroid.x <= 6, 'Centroid X must be within lattice');
  assert(centroid.y >= 0 && centroid.y <= 6, 'Centroid Y must be within lattice');
  assert(centroid.z >= 0 && centroid.z <= 6, 'Centroid Z must be within lattice');
  console.log('   [PASS] Entropy centroid computed and within lattice bounds.');

  // =========================================================================
  // TEST 11: End-to-End Phase 3 VM Program with Snapshot/Query Opcodes
  // =========================================================================
  console.log('\n[TEST 11] End-to-End Phase 3 VM Program...');
  const vm = new CubioVMPhase3();

  // Structured Phase 3 payload bitstrings
  const orderedBits = '00000000'.repeat(20);       // S=0.0 -> Zone A -> Shell 0
  const balancedBits = '0000000100000001'.repeat(10); // S≈0.81 -> Zone B -> Shell 1
  const chaosBits = '00011011'.repeat(20);          // S=2.0 -> Zone C -> Shell 3

  const p3Program = [
    // Initialize grid
    { op: Opcode.GRID_INIT },

    // Write 3 payloads via dynamic dispatch — each will be zone-classified and routed
    { op: Opcode.CELL_WRITE, data: orderedBits, coord: { x: 0, y: 0, z: 0 }, comment: 'Ordered payload' },
    { op: Opcode.CELL_WRITE, data: balancedBits, coord: { x: 1, y: 0, z: 0 }, comment: 'Balanced payload' },
    { op: Opcode.CELL_WRITE, data: chaosBits, coord: { x: 2, y: 0, z: 0 }, comment: 'Chaos payload' },

    // Save snapshot into register 'SNAP_A'
    { op: Phase3Opcode.SNAPSHOT_SAVE, destReg: 'SNAP_A' },

    // Verify the snapshot
    { op: Phase3Opcode.SNAPSHOT_VERIFY, sourceReg: 'SNAP_A' },

    // Query Zone B cells (entropy 0.6..1.4)
    { op: Phase3Opcode.SPATIAL_QUERY, queryType: 'entropy', sMin: 0.6, sMax: 1.4, destReg: 'ZONE_B_CELLS' },

    // Compute shell aggregates
    { op: Phase3Opcode.QUERY_AGGREGATE },

    // Compute entropy centroid
    { op: Phase3Opcode.ENTROPY_CENTROID, destReg: 'CENTROID' },

    { op: Opcode.HALT },
  ];

  const vmResult = vm.run(p3Program as any, false); // pinned coords, disable dynamic dispatch

  assert(vm.registers['SNAPSHOT_VALID'] === true, 'Snapshot must verify as VALID');
  assert(vm.registers['SNAP_A'] instanceof Uint8Array, 'SNAP_A must be a Uint8Array buffer');
  assert(vmResult.gridStats.occupiedCells > 0, 'Grid must have occupied cells after Phase 3 run');

  const centroidReg = vm.registers['CENTROID'] as { x: number; y: number; z: number };
  assert(centroidReg !== undefined, 'ENTROPY_CENTROID register must be set');

  const shellAggs = vm.registers['SHELL_AGGREGATES'];
  assert(Array.isArray(shellAggs) && shellAggs.length === 4, 'SHELL_AGGREGATES must contain 4 shells');

  console.log(` - Grid occupied: ${vmResult.gridStats.occupiedCells}/343 cells`);
  console.log(` - Snapshot size: ${(vm.registers['SNAP_A'] as Uint8Array).length} bytes`);
  console.log(` - Snapshot valid: ${vm.registers['SNAPSHOT_VALID']}`);
  console.log(` - Entropy centroid: [${centroidReg.x}, ${centroidReg.y}, ${centroidReg.z}]`);
  console.log(`   Shell aggregates:`);
  (shellAggs as any[]).forEach((s: any) => {
    if (s.count > 0) console.log(`     Shell ${s.shellRadius}: ${s.count} cells, avgS=${s.avgEntropy.toFixed(3)}`);
  });
  console.log('   [PASS] End-to-end Phase 3 VM program verified.');

  // =========================================================================
  // TEST 12: Load → Diff Round-Trip Integrity
  // =========================================================================
  console.log('\n[TEST 12] Load → Diff Round-Trip Integrity...');

  // Save original state
  const { buffer: snap1 } = snap.serialize(vm.memory);

  // Load it back into a fresh VM and re-save
  const vm2 = new CubioVMPhase3();
  const loadResult = snap.deserialize(snap1);
  vm2.memory = loadResult.memory;
  const { buffer: snap2 } = snap.serialize(vm2.memory);

  const roundTripDiff = snap.diff(snap1, snap2);
  assert(roundTripDiff.added.length === 0, 'Round-trip must add no cells');
  assert(roundTripDiff.removed.length === 0, 'Round-trip must remove no cells');
  assert(roundTripDiff.modified.length === 0, 'Round-trip must modify no cells');
  console.log(` - Round-trip diff: +${roundTripDiff.added.length} -${roundTripDiff.removed.length} ~${roundTripDiff.modified.length}`);
  console.log('   [PASS] Snapshot round-trip diff is clean (no changes).');

  // =========================================================================
  // TEST 13: High-Level Phase 3 ONE Language Compilation & Execution
  // =========================================================================
  console.log('\n[TEST 13] High-Level Phase 3 ONE Language Compilation & VM Execution...');
  const { OneCompiler } = require('../src/compiler/oneCompiler');
  const p3Compiler = new OneCompiler();

  const phase3Source = `
    spatial grid: Cube(7, 7, 7);
    let sample = "CUBIO_SNAPSHOT_TEST";
    cell[3, 3, 3].write(sample);
    snapshot_save(regSnap);
    snapshot_verify(regSnap);
    spatial_query(queryType = "shell", rMin = 0, rMax = 1, regQuery);
    query_aggregate(regAgg);
    entropy_centroid(regCentroid);
  `;

  const compilation = p3Compiler.compile(phase3Source);
  assert(compilation.instructions.length >= 7, 'Phase 3 compiler must produce at least 7 instructions');

  const p3Ops = compilation.instructions.map((i: any) => i.op);
  assert(p3Ops.includes(Phase3Opcode.SNAPSHOT_SAVE), 'Emitted bytecode must contain 0x20 SNAPSHOT_SAVE');
  assert(p3Ops.includes(Phase3Opcode.SNAPSHOT_VERIFY), 'Emitted bytecode must contain 0x22 SNAPSHOT_VERIFY');
  assert(p3Ops.includes(Phase3Opcode.SPATIAL_QUERY), 'Emitted bytecode must contain 0x23 SPATIAL_QUERY');
  assert(p3Ops.includes(Phase3Opcode.QUERY_AGGREGATE), 'Emitted bytecode must contain 0x25 QUERY_AGGREGATE');
  assert(p3Ops.includes(Phase3Opcode.ENTROPY_CENTROID), 'Emitted bytecode must contain 0x26 ENTROPY_CENTROID');

  const p3VM = new CubioVMPhase3();
  const vmRunRes = p3VM.run(compilation.instructions as any, false);

  assert(p3VM.registers['regSnap'] instanceof Uint8Array, 'regSnap must contain serialized binary snapshot');
  assert(p3VM.registers['SNAPSHOT_VALID'] === true, 'Snapshot verification must pass');
  assert(p3VM.registers['regQuery'] !== undefined, 'regQuery must contain query results');
  assert(p3VM.registers['regAgg'] !== undefined, 'regAgg must contain aggregate results');
  assert(p3VM.registers['regCentroid'] !== undefined, 'regCentroid must contain centroid coord');

  console.log(` - Compiler produced ${compilation.instructions.length} bytecode ops (including Phase 3 opcodes 0x20..0x26)`);
  console.log(` - VM executed ${vmRunRes.cyclesExecuted} cycles cleanly.`);
  console.log(` - Snapshot stored in 'regSnap': ${(p3VM.registers['regSnap'] as Uint8Array).length} bytes`);
  console.log(` - Query matches in Shell [0..1]: ${(p3VM.registers['regQuery'] as any).matchCount} cell(s)`);
  console.log('   [PASS] High-level Phase 3 language compilation and execution verified.');

  console.log('\n' + '='.repeat(78));
  console.log('         PHASE 3 VERIFICATION: ALL 13 TESTS PASSED (100%)');
  console.log('='.repeat(78) + '\n');
}

if (require.main === module) {
  runPhase3Tests();
}
