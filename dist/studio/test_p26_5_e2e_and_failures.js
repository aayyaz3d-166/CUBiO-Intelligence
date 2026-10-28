/**
 * CUBiO / AGI ONE — GATE CNL-P26.5
 * END-TO-END PIPELINE, DETERMINISTIC REPLAY & FAILURE INJECTION BATTERY
 *
 * File: f:\ONE language\src\studio\test_p26_5_e2e_and_failures.ts
 * Module: @one/studio/tests/p26_5
 * Specification: Gate CNL-P26.5 Sections 13, 14, 16, 18, 19
 *
 * Exhaustive audit of:
 *   1. Full End-to-End pipeline (P26.3 -> P26.2 Native Bridge -> P26.4 Studio Renderer -> Cell Inspector)
 *   2. State provenance (inspector values originate from canonical snapshot, not hardcoded)
 *   3. Deterministic Replay & Canonical Mutation Detection (hash alteration & recovery)
 *   4. Failure Injection Battery (12 fail-closed negative test cases)
 */
import { SpatialQuantumMapper, NumericalInstabilityError, StateDimensionError } from '../core/spatial_quantum_mapper';
import { NativeStateBridge, SnapshotValidationError, FrameIntegrityError } from './native_state_bridge';
import { AgiOneInspector, AUTHORITATIVE_P24_MODEL_IDENTITY } from './agi_one_inspector';
import { Native3DMemoryStudio, ActuationBlockedError } from './native_3d_memory_studio';
const records = [];
function testCase(id, name, fn) {
    const start = Date.now();
    try {
        fn();
        const duration = Date.now() - start;
        records.push({ id, name, passed: true, durationMs: duration });
        console.log(`  [PASS] ${id}: ${name} (${duration}ms)`);
    }
    catch (err) {
        const duration = Date.now() - start;
        records.push({ id, name, passed: false, message: err.message, durationMs: duration });
        console.error(`  [FAIL] ${id}: ${name} - ${err.message}`);
    }
}
function expect(condition, msg) {
    if (!condition)
        throw new Error(`Expectation failed: ${msg}`);
}
console.log('================================================================================');
console.log('  CUBiO / AGI ONE — GATE CNL-P26.5 E2E, REPLAY & FAILURE INJECTION SUITE');
console.log('================================================================================\n');
const standardParams = {
    base_frequency: 3.0,
    phase_velocity: 1.0,
    decay_constant: 0.1,
    harmonic_order: 3
};
const standardIntent = {
    direction: [0.57735, 0.57735, 0.57735],
    focus_point: [3.0, 3.0, 3.0],
    intensity: 0.8
};
// ============================================================================
// PART 1: END-TO-END PIPELINE & PROVENANCE AUDIT
// ============================================================================
testCase('E2E-01', 'Complete P26.3 -> P26.2 Bridge -> P26.4 Studio Data Flow', () => {
    // 1. P26.3 generates mathematical state snapshot
    const snapshot = SpatialQuantumMapper.compute_lattice_snapshot(369001, 42, standardParams, standardIntent);
    expect(snapshot.cell_count === 343, 'Snapshot must have exactly 343 cells');
    expect(snapshot.simulation_status === 'COMPUTED', 'Status must be COMPUTED');
    expect(snapshot.evidence_class === 'SIMULATED', 'Evidence must be SIMULATED');
    // 2. Instantiate Studio and ingest snapshot through NativeStateBridge
    const studio = new Native3DMemoryStudio();
    const frame = studio.ingestSnapshot(snapshot);
    expect(frame.sequenceNumber === 1, 'Sequence number must be 1');
    expect(frame.stateEpoch === 42, 'Epoch must be 42');
    expect(frame.canonicalHash === snapshot.canonical_hash, 'Frame hash must equal snapshot hash');
    expect(Object.isFrozen(frame), 'Frame must be deep-frozen');
    // 3. Render 3D workspace
    const renderOutput = studio.renderWorkspace();
    expect(renderOutput.lifecycleState === 'READY', 'Lifecycle state must remain READY');
    expect(renderOutput.activeSection === 'MEMORY_3D', 'Active section must be MEMORY_3D');
    expect(renderOutput.mainViewportText.includes('SLICE LAYER K = 3'), 'Default render must show center slice layer 3');
    // 4. Select Center Origin Node 171
    studio.selectCenterOrigin();
    const centerInspect = studio.getCellInspector().inspectCell(frame, 171);
    expect(centerInspect.cellId === 171, 'Center node cellId must be 171');
    expect(centerInspect.displayIndex === 172, 'Center node displayIndex must be 172');
    expect(centerInspect.address369 === 197, 'Center node Address369 must be 197');
    expect(Array.isArray(centerInspect.coordinates), 'Coordinates must be array');
    const [i, j, k] = centerInspect.coordinates;
    expect(i === 3 && j === 3 && k === 3, 'Center coordinates must be (3, 3, 3)');
    expect(centerInspect.isCenterOriginNode === true, 'isCenterOriginNode must be true');
    // 5. Verify Provenance: values match snapshot exactly
    const rawCell171 = snapshot.lattice_state_matrix[171];
    expect(centerInspect.probability === rawCell171.probability, 'Probability must originate from snapshot');
    expect(centerInspect.intentResonance === rawCell171.resonance, 'Resonance must originate from snapshot');
    expect(centerInspect.canonicalPhase === rawCell171.phase, 'Phase must originate from snapshot');
    expect(centerInspect.epoch === 42, 'Epoch must match snapshot');
    expect(centerInspect.canonicalHash === snapshot.canonical_hash, 'Hash must match snapshot');
});
testCase('E2E-02', 'Isometric 3D Orbit View Projection & Depth Ordering', () => {
    const snapshot = SpatialQuantumMapper.compute_lattice_snapshot(369001, 0, standardParams, standardIntent);
    const studio = new Native3DMemoryStudio();
    studio.ingestSnapshot(snapshot);
    studio.setProjectionMode('ISOMETRIC');
    studio.rotateCamera(45, 15);
    studio.setZoom(1.2);
    const output = studio.renderWorkspace();
    expect(output.mainViewportText.includes('ISOMETRIC ORBIT'), 'Viewport must render isometric view');
    expect(output.mainViewportText.includes('YAW: 90°'), 'Yaw must reflect rotation (45+45=90)');
    expect(output.mainViewportText.includes('PITCH: 45°'), 'Pitch must reflect rotation (30+15=45)');
    expect(output.mainViewportText.includes('ZOOM: 1.2x'), 'Zoom must reflect 1.2x');
});
// ============================================================================
// PART 2: DETERMINISTIC REPLAY & INTEGRITY MUTATION AUDIT
// ============================================================================
testCase('REPLAY-01', 'Deterministic Bit-Identical Replay Audit', () => {
    const seed = 987654321;
    const epoch = 7;
    // Run 1
    const snap1 = SpatialQuantumMapper.compute_lattice_snapshot(seed, epoch, standardParams, standardIntent);
    const studio1 = new Native3DMemoryStudio();
    const frame1 = studio1.ingestSnapshot(snap1);
    const out1 = studio1.renderWorkspace();
    // Run 2 (Independent instance, identical parameters)
    const snap2 = SpatialQuantumMapper.compute_lattice_snapshot(seed, epoch, standardParams, standardIntent);
    const studio2 = new Native3DMemoryStudio();
    const frame2 = studio2.ingestSnapshot(snap2);
    const out2 = studio2.renderWorkspace();
    // Verify exact bit-identical state
    expect(snap1.canonical_hash === snap2.canonical_hash, 'Canonical SHA-256 hashes must be bit-identical');
    expect(frame1.canonicalHash === frame2.canonicalHash, 'Frame canonical hashes must be bit-identical');
    expect(out1.mainViewportText === out2.mainViewportText, 'Rendered viewport text must be bit-identical');
    for (let c = 0; c < 343; c++) {
        const cellA = snap1.lattice_state_matrix[c];
        const cellB = snap2.lattice_state_matrix[c];
        expect(cellA.cell_id === cellB.cell_id, `cell_id mismatch at ${c}`);
        expect(cellA.probability === cellB.probability, `probability mismatch at ${c}`);
        expect(cellA.phase === cellB.phase, `phase mismatch at ${c}`);
        expect(cellA.resonance === cellB.resonance, `resonance mismatch at ${c}`);
        expect(cellA.state_hash === cellB.state_hash, `state_hash mismatch at ${c}`);
    }
});
testCase('INTEG-01', 'Canonical State Hash Mutation Detection & Recovery', () => {
    const baseSnap = SpatialQuantumMapper.compute_lattice_snapshot(12345, 0, standardParams, standardIntent);
    const originalHash = baseSnap.canonical_hash;
    // Clone snapshot to test mutation
    const matrixClone = baseSnap.lattice_state_matrix.map(c => ({ ...c }));
    const tamperedCell171 = {
        ...matrixClone[171],
        probability: matrixClone[171].probability + 0.0001
    };
    matrixClone[171] = tamperedCell171;
    // Recompute canonical hash with mutated cell
    const tamperedSnap = {
        ...baseSnap,
        lattice_state_matrix: matrixClone,
        canonical_hash: SpatialQuantumMapper.compute_snapshot_hash(baseSnap.schema_version, baseSnap.engine_version, baseSnap.seed, baseSnap.state_epoch, matrixClone)
    };
    expect(tamperedSnap.canonical_hash !== originalHash, 'Mutated state MUST produce different canonical hash');
    // Verify that passing tampered state with original hash fails closed
    const spoofedSnap = {
        ...baseSnap,
        lattice_state_matrix: matrixClone,
        canonical_hash: originalHash // Spoofed original hash
    };
    const bridge = new NativeStateBridge();
    let threw = false;
    try {
        bridge.ingestSnapshot(spoofedSnap);
    }
    catch (err) {
        threw = true;
        expect(err instanceof FrameIntegrityError, 'Must throw FrameIntegrityError on hash mismatch');
    }
    expect(threw, 'Spoofed hash must be rejected');
    // Recovery: restore original state and verify original hash returns
    matrixClone[171] = { ...baseSnap.lattice_state_matrix[171] };
    const restoredHash = SpatialQuantumMapper.compute_snapshot_hash(baseSnap.schema_version, baseSnap.engine_version, baseSnap.seed, baseSnap.state_epoch, matrixClone);
    expect(restoredHash === originalHash, 'Restored state must strictly return original canonical hash');
});
// ============================================================================
// PART 3: FAILURE INJECTION BATTERY (12 FAIL-CLOSED NEGATIVE TESTS)
// ============================================================================
const validSnapshot = SpatialQuantumMapper.compute_lattice_snapshot(12345, 0, standardParams, standardIntent);
testCase('FAIL-01', 'Failure Injection: Corrupted Canonical Hash', () => {
    const corrupted = {
        ...validSnapshot,
        canonical_hash: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    };
    const studio = new Native3DMemoryStudio();
    let threw = false;
    try {
        studio.ingestSnapshot(corrupted);
    }
    catch (err) {
        threw = true;
        expect(err instanceof FrameIntegrityError, 'Must throw FrameIntegrityError');
    }
    expect(threw, 'Corrupted hash must fail closed');
    expect(studio.getLifecycleState() === 'INTEGRITY_FAILURE', 'State must transition to INTEGRITY_FAILURE');
});
testCase('FAIL-02', 'Failure Injection: Missing Cell (342 cells)', () => {
    const incomplete = {
        ...validSnapshot,
        cell_count: 342,
        lattice_state_matrix: validSnapshot.lattice_state_matrix.slice(0, 342)
    };
    const studio = new Native3DMemoryStudio();
    let threw = false;
    try {
        studio.ingestSnapshot(incomplete);
    }
    catch (err) {
        threw = true;
        expect(err instanceof SnapshotValidationError, 'Must throw SnapshotValidationError');
    }
    expect(threw, 'Incomplete snapshot must fail closed');
    expect(studio.getLifecycleState() === 'INVALID_FRAME', 'State must transition to INVALID_FRAME');
});
testCase('FAIL-03', 'Failure Injection: Duplicate Cell ID', () => {
    const duplicateMatrix = validSnapshot.lattice_state_matrix.map(c => ({ ...c }));
    // Duplicate cell 0 at index 1
    duplicateMatrix[1] = { ...duplicateMatrix[0] };
    const dupSnap = {
        ...validSnapshot,
        lattice_state_matrix: duplicateMatrix
    };
    const studio = new Native3DMemoryStudio();
    let threw = false;
    try {
        studio.ingestSnapshot(dupSnap);
    }
    catch (err) {
        threw = true;
        expect(err instanceof SnapshotValidationError, 'Must throw SnapshotValidationError on duplicate ID');
    }
    expect(threw, 'Duplicate cell ID must fail closed');
});
testCase('FAIL-04', 'Failure Injection: Invalid Address369 (Out of Range)', () => {
    const invalidAddrMatrix = validSnapshot.lattice_state_matrix.map(c => ({ ...c }));
    invalidAddrMatrix[10] = { ...invalidAddrMatrix[10], address369: 999 };
    const badAddrSnap = {
        ...validSnapshot,
        lattice_state_matrix: invalidAddrMatrix
    };
    const studio = new Native3DMemoryStudio();
    let threw = false;
    try {
        studio.ingestSnapshot(badAddrSnap);
    }
    catch (err) {
        threw = true;
        expect(err instanceof SnapshotValidationError, 'Must throw SnapshotValidationError on bad Address369');
    }
    expect(threw, 'Invalid Address369 must fail closed');
});
testCase('FAIL-05', 'Failure Injection: Stale Epoch Rejection', () => {
    const snapEpoch10 = SpatialQuantumMapper.compute_lattice_snapshot(12345, 10, standardParams, standardIntent);
    const snapEpoch9 = SpatialQuantumMapper.compute_lattice_snapshot(12345, 9, standardParams, standardIntent);
    const studio = new Native3DMemoryStudio();
    studio.ingestSnapshot(snapEpoch10);
    let threw = false;
    try {
        studio.ingestSnapshot(snapEpoch9);
    }
    catch (err) {
        threw = true;
        expect(err instanceof SnapshotValidationError, 'Must reject stale epoch');
    }
    expect(threw, 'Stale frame must fail closed');
});
testCase('FAIL-06', 'Failure Injection: Null or Undefined Snapshot', () => {
    const studio = new Native3DMemoryStudio();
    let threw = false;
    try {
        studio.ingestSnapshot(null);
    }
    catch (err) {
        threw = true;
        expect(err instanceof SnapshotValidationError, 'Must reject null snapshot');
    }
    expect(threw, 'Null snapshot must fail closed');
});
testCase('FAIL-07', 'Failure Injection: NaN in Probability Normalization', () => {
    let threw = false;
    try {
        SpatialQuantumMapper.normalize_probability_vector([0.5, NaN, 0.5]);
    }
    catch (err) {
        threw = true;
        expect(err instanceof NumericalInstabilityError, 'Must throw NumericalInstabilityError on NaN');
    }
    expect(threw, 'NaN value must fail closed');
});
testCase('FAIL-08', 'Failure Injection: Infinity in Probability Normalization', () => {
    let threw = false;
    try {
        SpatialQuantumMapper.normalize_probability_vector([0.5, Infinity, 0.5]);
    }
    catch (err) {
        threw = true;
        expect(err instanceof NumericalInstabilityError, 'Must throw NumericalInstabilityError on Infinity');
    }
    expect(threw, 'Infinity value must fail closed');
});
testCase('FAIL-09', 'Failure Injection: Negative State Dimension', () => {
    let threw = false;
    try {
        SpatialQuantumMapper.generate_state_vector(12345, 0, standardParams, -5);
    }
    catch (err) {
        threw = true;
        expect(err instanceof StateDimensionError, 'Must throw StateDimensionError on negative dimension');
    }
    expect(threw, 'Negative dimension must fail closed');
});
testCase('FAIL-10', 'Failure Injection: Invalid Simulation Status', () => {
    const badStatus = {
        ...validSnapshot,
        simulation_status: 'UNVERIFIED_EXPERIMENTAL'
    };
    const studio = new Native3DMemoryStudio();
    let threw = false;
    try {
        studio.ingestSnapshot(badStatus);
    }
    catch (err) {
        threw = true;
        expect(err instanceof SnapshotValidationError, 'Must reject non-COMPUTED simulation status');
    }
    expect(threw, 'Invalid simulation status must fail closed');
});
testCase('FAIL-11', 'Failure Injection: Unauthorized Hardware Actuation', () => {
    const studio = new Native3DMemoryStudio();
    expect(studio.isActuationBlocked() === true, 'isActuationBlocked must be true');
    let threw = false;
    try {
        studio.executeActuation();
    }
    catch (err) {
        threw = true;
        expect(err instanceof ActuationBlockedError, 'Must throw ActuationBlockedError');
    }
    expect(threw, 'Actuation attempt must fail closed');
});
testCase('FAIL-12', 'Failure Injection: Unavailable Hardware Ingestion', () => {
    const agi = new AgiOneInspector();
    const t = agi.getTelemetry();
    expect(t.physicalSensor === 'UNAVAILABLE', 'Physical sensor must be UNAVAILABLE');
    // Verify non-existent sensor telemetry cannot be fabricated into physical measurements
    const panel = agi.formatTelemetryPanel();
    expect(panel.includes('Physical Sensor:   UNAVAILABLE'), 'Panel must display UNAVAILABLE');
});
// ============================================================================
// PART 4: RECONCILED MODEL & ARCHITECTURAL INVARIANTS
// ============================================================================
testCase('ARCH-01', 'Authoritative Model Identity & Checkpoint Integrity', () => {
    expect(AUTHORITATIVE_P24_MODEL_IDENTITY.modelId === 'CUBIO-MODEL-STAGE1-V1', 'Model ID must match');
    expect(AUTHORITATIVE_P24_MODEL_IDENTITY.parameterCount === 148912, 'Parameter count must be 148,912');
    expect(AUTHORITATIVE_P24_MODEL_IDENTITY.checkpointHash ===
        '43498d9b2c9a58c688bf949cd4016ee76866974257ed64155e7716506a16628c', 'Checkpoint hash must match 43498d9b...');
    expect(AUTHORITATIVE_P24_MODEL_IDENTITY.lineageRoot === 'CUBIO-GENESIS', 'Lineage must be CUBIO-GENESIS');
});
testCase('ARCH-02', 'Lattice Addressing Invariants across Entire 343 Space', () => {
    const matrix = validSnapshot.lattice_state_matrix;
    for (let c = 0; c < 343; c++) {
        const cell = matrix[c];
        expect(cell.cell_id === c, `cell_id must be ${c}`);
        expect(cell.address369 === 26 + c, `address369 must be ${26 + c}`);
        expect(cell.display_index === c + 1, `display_index must be ${c + 1}`);
        const i = Math.floor(c / 49);
        const j = Math.floor((c % 49) / 7);
        const k = c % 7;
        expect(cell.i === i && cell.j === j && cell.k === k, `Coordinates mismatch at index ${c}`);
    }
});
console.log('\n================================================================================');
const passedTotal = records.filter(r => r.passed).length;
console.log(`  E2E & FAILURE SUITE RESULTS: ${passedTotal} / ${records.length} PASSED (${((passedTotal / records.length) * 100).toFixed(1)}%)`);
console.log('================================================================================\n');
if (passedTotal !== records.length) {
    process.exit(1);
}
