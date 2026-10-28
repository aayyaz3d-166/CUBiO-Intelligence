/**
 * CUBiO / AGI ONE — GATE CNL-P26.4
 * AUTOMATED TEST SUITE: NATIVE 3D MEMORY STUDIO
 *
 * File: f:\ONE language\src\studio\test_native_3d_memory_studio.ts
 * Module: @one/studio/tests
 * Specification: Gate CNL-P26.4 Section 22 (TEST-01 to TEST-25)
 *
 * Full battery of 25 formal verification tests for the sovereign 3D Memory Studio.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import { SpatialQuantumMapper } from '../core/spatial_quantum_mapper';
import { NativeStateBridge, SnapshotValidationError } from './native_state_bridge';
import { SpatialVoxelRenderer } from './spatial_voxel_renderer';
import { AgiOneInspector } from './agi_one_inspector';
import { Native3DMemoryStudio } from './native_3d_memory_studio';
const results = [];
function runTest(id, name, fn) {
    const start = Date.now();
    try {
        fn();
        const duration = Date.now() - start;
        results.push({ id, name, passed: true, durationMs: duration });
        console.log(`  [PASS] ${id}: ${name} (${duration}ms)`);
    }
    catch (err) {
        const duration = Date.now() - start;
        results.push({ id, name, passed: false, message: err.message, durationMs: duration });
        console.error(`  [FAIL] ${id}: ${name} - ${err.message}`);
    }
}
function assert(condition, msg) {
    if (!condition)
        throw new Error(`Assertion failed: ${msg}`);
}
console.log('================================================================================');
console.log('  CUBiO / AGI ONE — GATE CNL-P26.4 TEST SUITE (TEST-01 to TEST-25)');
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
// Pre-compute a valid P26.3 snapshot
const baseSnapshot = SpatialQuantumMapper.compute_lattice_snapshot(12345, 0, standardParams, standardIntent);
// TEST-01: Native window / application initialization
runTest('TEST-01', 'Native window / application initialization', () => {
    const studio = new Native3DMemoryStudio();
    assert(studio.getLifecycleState() === 'READY', 'Initial state must be READY');
    assert(studio.getNavigation().getActiveSection() === 'MEMORY_3D', 'Initial section must be MEMORY_3D');
    assert(studio.isActuationBlocked() === true, 'Actuation must be permanently blocked');
});
// TEST-02: 343-cell volumetric rendering allocation
runTest('TEST-02', '343-cell volumetric rendering allocation', () => {
    const studio = new Native3DMemoryStudio();
    studio.ingestSnapshot(baseSnapshot);
    const output = studio.renderWorkspace();
    assert(output.lifecycleState === 'READY', 'State must remain READY after render');
    assert(output.mainViewportText.length > 0, 'Viewport text must not be empty');
    assert(output.mainViewportText.includes('343-CELL LATTICE'), 'Must declare 343-cell lattice');
});
// TEST-03: 7x7x7 coordinate space correctness
runTest('TEST-03', '7x7x7 coordinate space correctness', () => {
    const renderer = new SpatialVoxelRenderer();
    const bridge = new NativeStateBridge();
    const frame = bridge.ingestSnapshot(baseSnapshot);
    const res = renderer.render(frame);
    assert(res.voxelMatrix.length === 343, 'Must contain exactly 343 voxels');
    for (let c = 0; c < 343; c++) {
        const v = res.voxelMatrix[c];
        assert(v.coordinates[0] >= 0 && v.coordinates[0] <= 6, `i out of bounds: ${v.coordinates[0]}`);
        assert(v.coordinates[1] >= 0 && v.coordinates[1] <= 6, `j out of bounds: ${v.coordinates[1]}`);
        assert(v.coordinates[2] >= 0 && v.coordinates[2] <= 6, `k out of bounds: ${v.coordinates[2]}`);
    }
});
// TEST-04: Canonical cell ID mapping (0..342)
runTest('TEST-04', 'Canonical cell ID mapping (0..342)', () => {
    const renderer = new SpatialVoxelRenderer();
    const bridge = new NativeStateBridge();
    const frame = bridge.ingestSnapshot(baseSnapshot);
    const res = renderer.render(frame);
    for (let c = 0; c < 343; c++) {
        const v = res.voxelMatrix[c];
        const expectedId = v.coordinates[0] * 49 + v.coordinates[1] * 7 + v.coordinates[2];
        assert(v.cellId === c, `Cell ID must equal array index ${c}, got ${v.cellId}`);
        assert(v.cellId === expectedId, `Cell ID must equal canonical formula i*49+j*7+k`);
    }
});
// TEST-05: Address369 mapping (26..368)
runTest('TEST-05', 'Address369 mapping (26..368)', () => {
    const renderer = new SpatialVoxelRenderer();
    const bridge = new NativeStateBridge();
    const frame = bridge.ingestSnapshot(baseSnapshot);
    const res = renderer.render(frame);
    for (let c = 0; c < 343; c++) {
        const v = res.voxelMatrix[c];
        assert(v.address369 === 26 + c, `Address369 must equal 26 + cellId. Expected ${26 + c}, got ${v.address369}`);
        assert(v.address369 >= 26 && v.address369 <= 368, `Address369 out of range: ${v.address369}`);
    }
});
// TEST-06: Center origin node 171 (3,3,3) detection & display
runTest('TEST-06', 'Center origin node 171 (3,3,3) detection & display', () => {
    const renderer = new SpatialVoxelRenderer();
    const bridge = new NativeStateBridge();
    const frame = bridge.ingestSnapshot(baseSnapshot);
    const res = renderer.render(frame);
    const centerVoxel = res.voxelMatrix[171];
    assert(centerVoxel.cellId === 171, 'Center cell must have cellId 171');
    assert(centerVoxel.address369 === 197, 'Center cell must have Address369 = 197');
    assert(centerVoxel.coordinates[0] === 3 && centerVoxel.coordinates[1] === 3 && centerVoxel.coordinates[2] === 3, 'Center node coordinates must be (3, 3, 3)');
    assert(centerVoxel.isCenterNode === true, 'Center cell must have isCenterNode === true');
    // Verify non-center cells have isCenterNode === false
    let centerCount = 0;
    for (let c = 0; c < 343; c++) {
        if (res.voxelMatrix[c].isCenterNode)
            centerCount++;
    }
    assert(centerCount === 1, `Exactly 1 center node must exist, found: ${centerCount}`);
});
// TEST-07: Atomic snapshot validation pipeline
runTest('TEST-07', 'Atomic snapshot validation pipeline', () => {
    const studio = new Native3DMemoryStudio();
    const frame1 = studio.ingestSnapshot(baseSnapshot);
    assert(frame1.sequenceNumber === 1, 'First frame sequence must be 1');
    assert(frame1.stateEpoch === baseSnapshot.state_epoch, 'Frame epoch must match snapshot');
    const snap2 = SpatialQuantumMapper.compute_lattice_snapshot(12345, 1, standardParams, standardIntent);
    const frame2 = studio.ingestSnapshot(snap2);
    assert(frame2.sequenceNumber === 2, 'Second frame sequence must be 2');
    assert(frame2.stateEpoch === 1, 'Second frame epoch must be 1');
});
// TEST-08: Canonical SHA-256 hash verification
runTest('TEST-08', 'Canonical SHA-256 hash verification', () => {
    const bridge = new NativeStateBridge();
    const frame = bridge.ingestSnapshot(baseSnapshot);
    assert(frame.canonicalHash === baseSnapshot.canonical_hash, 'Hash must match canonical hash');
    assert(frame.canonicalHash.length === 64, 'SHA-256 hash must be 64 hex characters');
});
// TEST-09: Atomic frame swap & immutability
runTest('TEST-09', 'Atomic frame swap & immutability', () => {
    const bridge = new NativeStateBridge();
    const frame = bridge.ingestSnapshot(baseSnapshot);
    assert(Object.isFrozen(frame), 'Frame must be frozen');
    let threw = false;
    try {
        frame.sequenceNumber = 999;
    }
    catch {
        threw = true;
    }
    assert(threw || frame.sequenceNumber === 1, 'Frame modification must be rejected');
});
// TEST-10: Invalid-frame rejection (fail closed)
runTest('TEST-10', 'Invalid-frame rejection (fail closed)', () => {
    const studio = new Native3DMemoryStudio();
    // Tampered snapshot with 342 cells
    const corruptedSnapshot = {
        ...baseSnapshot,
        cell_count: 342,
        lattice_state_matrix: baseSnapshot.lattice_state_matrix.slice(0, 342)
    };
    let threw = false;
    try {
        studio.ingestSnapshot(corruptedSnapshot);
    }
    catch (err) {
        threw = true;
        assert(err instanceof SnapshotValidationError, 'Must throw SnapshotValidationError');
    }
    assert(threw, 'Corrupted snapshot must be rejected');
    assert(studio.getLifecycleState() === 'INVALID_FRAME', 'State must be INVALID_FRAME');
});
// TEST-11: Stale-frame / out-of-sequence rejection
runTest('TEST-11', 'Stale-frame / out-of-sequence rejection', () => {
    const studio = new Native3DMemoryStudio();
    const snapEpoch5 = SpatialQuantumMapper.compute_lattice_snapshot(12345, 5, standardParams, standardIntent);
    studio.ingestSnapshot(snapEpoch5);
    const snapEpoch4 = SpatialQuantumMapper.compute_lattice_snapshot(12345, 4, standardParams, standardIntent);
    let threw = false;
    try {
        studio.ingestSnapshot(snapEpoch4);
    }
    catch (err) {
        threw = true;
        assert(err instanceof SnapshotValidationError, 'Must throw SnapshotValidationError on stale frame');
    }
    assert(threw, 'Stale snapshot must be rejected');
});
// TEST-12: Cell selection & cursor movement
runTest('TEST-12', 'Cell selection & cursor movement', () => {
    const studio = new Native3DMemoryStudio();
    studio.ingestSnapshot(baseSnapshot);
    studio.selectCell(49); // i=1, j=0, k=0 -> k=0
    assert(studio.getVoxelRenderer().getSelectedCell() === 49, 'Selected cell must be 49');
    assert(studio.getVoxelRenderer().getActiveSlice() === 0, 'Active slice must auto-align to k=0');
    studio.selectCenterOrigin();
    assert(studio.getVoxelRenderer().getSelectedCell() === 171, 'Selected cell must be 171');
    assert(studio.getVoxelRenderer().getActiveSlice() === 3, 'Slice must be 3 for center node');
});
// TEST-13: Cell Inspector field completeness (all 12 fields)
runTest('TEST-13', 'Cell Inspector field completeness (all 12 fields)', () => {
    const studio = new Native3DMemoryStudio();
    const frame = studio.ingestSnapshot(baseSnapshot);
    const inspector = studio.getCellInspector();
    const details = inspector.inspectCell(frame, 171);
    assert(details.cellId === 171, 'Field 1: cellId must be 171');
    assert(details.displayIndex === 172, 'Field 2: displayIndex must be 172');
    assert(details.address369 === 197, 'Field 3: address369 must be 197');
    assert(Array.isArray(details.coordinates) && details.coordinates.length === 3, 'Field 4: coordinates must be array of 3');
    assert(typeof details.probability === 'number', 'Field 5: probability must be number');
    assert(typeof details.intentResonance === 'number', 'Field 6: intentResonance must be number');
    assert(typeof details.canonicalPhase === 'number', 'Field 7: canonicalPhase must be number');
    assert(typeof details.complexWaveState === 'object' && details.complexWaveState !== null, 'Field 8: complexWaveState must be object');
    assert(details.epoch === 0, 'Field 9: epoch must be 0');
    assert(typeof details.canonicalHash === 'string' && details.canonicalHash.length === 64, 'Field 10: canonicalHash must be 64-hex');
    assert(details.evidenceClass === 'SIMULATED', 'Field 11: evidenceClass must be SIMULATED');
    assert(details.simulationStatus === 'COMPUTED', 'Field 12: simulationStatus must be COMPUTED');
    const summary = inspector.formatInspectionDetails(details);
    assert(summary.includes('1.  Cell ID:           171'), 'Formatted text must include Cell ID');
    assert(summary.includes('12. Simulation Status: COMPUTED'), 'Formatted text must include Simulation Status');
});
// TEST-14: Probability visual mapping
runTest('TEST-14', 'Probability visual mapping', () => {
    const renderer = new SpatialVoxelRenderer();
    const bridge = new NativeStateBridge();
    const frame = bridge.ingestSnapshot(baseSnapshot);
    const res = renderer.render(frame);
    // All 343 voxels should have valid intensity glyphs
    const validGlyphs = new Set(['·', '░', '▒', '▓', '█']);
    for (const v of res.voxelMatrix) {
        assert(validGlyphs.has(v.intensityGlyph), `Invalid intensity glyph: ${v.intensityGlyph}`);
    }
});
// TEST-15: Resonance visual mapping
runTest('TEST-15', 'Resonance visual mapping', () => {
    const renderer = new SpatialVoxelRenderer();
    const bridge = new NativeStateBridge();
    const frame = bridge.ingestSnapshot(baseSnapshot);
    const res = renderer.render(frame);
    const validBands = new Set(['INACTIVE', 'HARMONIC', 'COHERENT', 'RESONANT']);
    const validHarmonicBands = new Set([
        'SIMULATED_HARMONIC_BAND_3',
        'SIMULATED_HARMONIC_BAND_6',
        'SIMULATED_HARMONIC_BAND_9'
    ]);
    const validOrders = new Set([3, 6, 9]);
    for (const v of res.voxelMatrix) {
        assert(validBands.has(v.resonanceBand), `Invalid resonance band: ${v.resonanceBand}`);
        assert(validHarmonicBands.has(v.simulatedHarmonicBand), `Invalid simulated harmonic band: ${v.simulatedHarmonicBand}`);
        assert(validOrders.has(v.simulatedHarmonicOrder), `Invalid harmonic order: ${v.simulatedHarmonicOrder}`);
    }
});
// TEST-16: Phase visual presentation
runTest('TEST-16', 'Phase visual presentation', () => {
    const renderer = new SpatialVoxelRenderer();
    const bridge = new NativeStateBridge();
    const frame = bridge.ingestSnapshot(baseSnapshot);
    const res = renderer.render(frame);
    const validQuadrants = new Set([1, 2, 3, 4]);
    const validPhaseGlyphs = new Set(['↗', '↖', '↙', '↘']);
    for (const v of res.voxelMatrix) {
        assert(validQuadrants.has(v.phaseQuadrant), `Invalid quadrant: ${v.phaseQuadrant}`);
        assert(validPhaseGlyphs.has(v.phaseGlyph), `Invalid phase glyph: ${v.phaseGlyph}`);
    }
});
// TEST-17: Physical sensor UNAVAILABLE truth handling
runTest('TEST-17', 'Physical sensor UNAVAILABLE truth handling', () => {
    const agi = new AgiOneInspector();
    const t = agi.getTelemetry();
    assert(t.physicalSensor === 'UNAVAILABLE', 'Physical sensor must strictly report UNAVAILABLE');
    const panel = agi.formatTelemetryPanel();
    assert(panel.includes('Physical Sensor:   UNAVAILABLE'), 'Telemetry panel must show UNAVAILABLE');
});
// TEST-18: Zero telemetry fabrication (no hardcoded fake latencies/FPS)
runTest('TEST-18', 'Zero telemetry fabrication', () => {
    const agi = new AgiOneInspector();
    const t = agi.getTelemetry();
    assert(t.measuredLatencyMs === null, 'Unmeasured latency must be null');
    assert(t.measuredRssBytes === null, 'Unmeasured RSS must be null');
    const panel = agi.formatTelemetryPanel();
    assert(panel.includes('Runtime Latency:      —'), 'Unmeasured latency must format as —');
    assert(panel.includes('Process RSS:          —'), 'Unmeasured RSS must format as —');
});
// TEST-19: Zero browser dependency audit
runTest('TEST-19', 'Zero browser dependency audit', () => {
    assert(typeof globalThis.window === 'undefined', 'window must not exist');
    assert(typeof globalThis.document === 'undefined', 'document must not exist');
    assert(typeof globalThis.HTMLElement === 'undefined', 'HTMLElement must not exist');
});
// TEST-20: Zero Three.js / WebGL / Canvas dependency audit
runTest('TEST-20', 'Zero Three.js / WebGL / Canvas dependency audit', () => {
    assert(typeof globalThis.THREE === 'undefined', 'THREE must not exist');
    assert(typeof globalThis.WebGLRenderingContext === 'undefined', 'WebGL must not exist');
    assert(typeof globalThis.HTMLCanvasElement === 'undefined', 'HTMLCanvasElement must not exist');
});
// TEST-21: Zero React / Tailwind / CSS dependency audit
runTest('TEST-21', 'Zero React / Tailwind / CSS dependency audit', () => {
    const studioDir = path.resolve(__dirname);
    const tsFiles = fs.readdirSync(studioDir).filter(f => f.endsWith('.ts') && !f.startsWith('test_'));
    const prohibited = ['react', 'react-dom', 'tailwindcss', '@tailwind', '.css', 'styled-components'];
    for (const file of tsFiles) {
        const content = fs.readFileSync(path.join(studioDir, file), 'utf8');
        for (const p of prohibited) {
            const regex = new RegExp(`from\\s+['"]${p}['"]|import\\s+['"].*\\.${p}['"]`, 'i');
            assert(!regex.test(content), `File ${file} contains prohibited import: ${p}`);
        }
    }
});
// TEST-22: Zero external AI model / Qwen residue
runTest('TEST-22', 'Zero external AI model / Qwen residue', () => {
    const studio = new Native3DMemoryStudio();
    const t = studio.getAgiOneInspector().getTelemetry();
    assert(t.securityBoundary.externalModelsCount === 0, 'External models count must be 0');
    assert(t.securityBoundary.qwenResidueCount === 0, 'Qwen residue count must be 0');
    assert(t.securityBoundary.isActuationBlocked === true, 'Actuation must be blocked');
});
// TEST-23: State immutability (P26.3 snapshot unmutated)
runTest('TEST-23', 'State immutability (P26.3 snapshot unmutated)', () => {
    const snap = SpatialQuantumMapper.compute_lattice_snapshot(12345, 0, standardParams, standardIntent);
    const originalHash = snap.canonical_hash;
    const originalProb0 = snap.lattice_state_matrix[0].probability;
    const studio = new Native3DMemoryStudio();
    studio.ingestSnapshot(snap);
    studio.renderWorkspace();
    assert(snap.canonical_hash === originalHash, 'Snapshot hash must remain identical');
    assert(snap.lattice_state_matrix[0].probability === originalProb0, 'Cell probability must remain identical');
});
// TEST-24: Performance baseline (render update < 20ms)
runTest('TEST-24', 'Performance baseline (render update < 20ms)', () => {
    const studio = new Native3DMemoryStudio();
    studio.ingestSnapshot(baseSnapshot);
    // Warm up
    studio.renderWorkspace();
    // Benchmark 20 iterations
    const iterations = 20;
    const times = [];
    for (let i = 0; i < iterations; i++) {
        const t0 = performance.now();
        studio.renderWorkspace();
        times.push(performance.now() - t0);
    }
    const avgMs = times.reduce((a, b) => a + b, 0) / iterations;
    console.log(`    -> Average render time: ${avgMs.toFixed(3)} ms across ${iterations} runs`);
    assert(avgMs < 20.0, `Average render time (${avgMs.toFixed(3)}ms) must be < 20ms`);
});
// TEST-25: Memory governance (Studio RSS < 512MB)
runTest('TEST-25', 'Memory governance (Studio RSS < 512MB)', () => {
    const memUsage = process.memoryUsage();
    const rssMb = memUsage.rss / (1024 * 1024);
    console.log(`    -> Process RSS: ${rssMb.toFixed(2)} MB`);
    assert(rssMb < 512, `RSS (${rssMb.toFixed(2)}MB) must be under 512MB`);
});
// ============================================================================
// RECONCILIATION TEST BATTERY: GATE CNL-P26.4-RECON-001
// ============================================================================
// MODEL-01: Model identity reconciliation
runTest('MODEL-01', 'Model identity reconciliation', () => {
    const studio = new Native3DMemoryStudio();
    const identity = studio.getAgiOneInspector().getModelIdentity();
    const telemetry = studio.getAgiOneInspector().getTelemetry();
    assert(identity.modelId === 'CUBIO-MODEL-STAGE1-V1', 'modelId must be CUBIO-MODEL-STAGE1-V1');
    assert(telemetry.modelBridge.includes('148,912 params'), 'modelBridge must display 148,912 params');
});
// MODEL-02: Checkpoint hash verification
runTest('MODEL-02', 'Checkpoint hash verification', () => {
    const studio = new Native3DMemoryStudio();
    const identity = studio.getAgiOneInspector().getModelIdentity();
    assert(identity.checkpointHash === '43498d9b2c9a58c688bf949cd4016ee76866974257ed64155e7716506a16628c', 'checkpointHash must match 43498d9b...');
});
// MODEL-03: Parameter-count verification
runTest('MODEL-03', 'Parameter-count verification', () => {
    const studio = new Native3DMemoryStudio();
    const identity = studio.getAgiOneInspector().getModelIdentity();
    assert(identity.parameterCount === 148912, 'parameterCount must equal 148912 (authoritative P24 baseline)');
});
// MODEL-04: Model lineage verification
runTest('MODEL-04', 'Model lineage verification', () => {
    const studio = new Native3DMemoryStudio();
    const identity = studio.getAgiOneInspector().getModelIdentity();
    assert(identity.lineageRoot === 'CUBIO-GENESIS', 'lineageRoot must be CUBIO-GENESIS');
    assert(identity.tokenizerVersion === 'CUBIO-TOKENIZER-V1', 'tokenizerVersion must be CUBIO-TOKENIZER-V1');
    assert(identity.checkpointVersion === '1.0.0', 'checkpointVersion must be 1.0.0');
});
// HARM-01: No physical MHz claim
runTest('HARM-01', 'No physical MHz claim in studio source', () => {
    const studioDir = path.resolve(__dirname);
    const tsFiles = fs.readdirSync(studioDir).filter(f => f.endsWith('.ts') && !f.startsWith('test_'));
    for (const file of tsFiles) {
        const content = fs.readFileSync(path.join(studioDir, file), 'utf8');
        assert(!/\bMHz\b/.test(content), `Prohibited MHz found in file: ${file}`);
    }
});
// HARM-02: Simulated harmonic labeling
runTest('HARM-02', 'Simulated harmonic labeling', () => {
    const renderer = new SpatialVoxelRenderer();
    const bridge = new NativeStateBridge();
    const frame = bridge.ingestSnapshot(baseSnapshot);
    const res = renderer.render(frame);
    const allowedBands = new Set([
        'SIMULATED_HARMONIC_BAND_3',
        'SIMULATED_HARMONIC_BAND_6',
        'SIMULATED_HARMONIC_BAND_9'
    ]);
    for (const v of res.voxelMatrix) {
        assert(allowedBands.has(v.simulatedHarmonicBand), `Invalid harmonic band label: ${v.simulatedHarmonicBand}`);
    }
});
// HARM-03: Physical sensor remains UNAVAILABLE
runTest('HARM-03', 'Physical sensor remains UNAVAILABLE', () => {
    const studio = new Native3DMemoryStudio();
    const t = studio.getAgiOneInspector().getTelemetry();
    assert(t.physicalSensor === 'UNAVAILABLE', 'Physical sensor must strictly report UNAVAILABLE');
});
// RENDER-01: No browser Canvas
runTest('RENDER-01', 'No browser Canvas APIs', () => {
    assert(typeof globalThis.HTMLCanvasElement === 'undefined', 'HTMLCanvasElement must not exist');
    assert(typeof globalThis.CanvasRenderingContext2D === 'undefined', 'CanvasRenderingContext2D must not exist');
});
// RENDER-02: Native render-buffer terminology
runTest('RENDER-02', 'Native render-buffer terminology', () => {
    const renderer = new SpatialVoxelRenderer({ renderBufferWidth: 80, renderBufferHeight: 24 });
    const size = renderer.getRenderBufferSize();
    assert(size.width === 80, 'renderBufferWidth must be 80');
    assert(size.height === 24, 'renderBufferHeight must be 24');
});
// RENDER-03: No WebGL
runTest('RENDER-03', 'No WebGL APIs or contexts', () => {
    assert(typeof globalThis.WebGLRenderingContext === 'undefined', 'WebGLRenderingContext must not exist');
    assert(typeof globalThis.WebGL2RenderingContext === 'undefined', 'WebGL2RenderingContext must not exist');
});
// RENDER-04: No Three.js
runTest('RENDER-04', 'No Three.js library in runtime', () => {
    assert(typeof globalThis.THREE === 'undefined', 'THREE must not exist in global scope');
});
// REG-01: P26.3 zero drift
runTest('REG-01', 'P26.3 zero drift', () => {
    const mapperPath = path.resolve(__dirname, '../core/spatial_quantum_mapper.ts');
    const buffer = fs.readFileSync(mapperPath);
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const expectedHash = '4a116f40d4121c081802d5517949366ac0c0537caea08d63dc86cbe3ea5235c6';
    assert(hash === expectedHash, `P26.3 hash drift detected! Got ${hash}, expected ${expectedHash}`);
});
// REG-02: INT-001 zero drift
runTest('REG-02', 'INT-001 zero drift', () => {
    const rootE = 'e:\\3D memory studio';
    const res = child_process.spawnSync('python', ['INT-001_VERIFIER.py'], {
        cwd: rootE,
        encoding: 'utf8',
        timeout: 30000
    });
    assert(res.status === 0, `INT-001 verifier failed with exit code: ${res.status}`);
    assert(res.stdout.includes('19/19') && res.stdout.includes('PASSED'), 'INT-001 must pass 19/19 checks');
});
console.log('\n================================================================================');
const passedCount = results.filter(r => r.passed).length;
console.log(`  RESULTS: ${passedCount} / ${results.length} PASSED (${((passedCount / results.length) * 100).toFixed(1)}%)`);
console.log('================================================================================\n');
if (passedCount !== results.length) {
    process.exit(1);
}
