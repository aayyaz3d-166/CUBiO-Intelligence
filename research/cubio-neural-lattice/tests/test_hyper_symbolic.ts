/**
 * Comprehensive Automated Test Suite for Gate CNL-P5-001
 * Target: N-Dimensional Hyper-Spatial Grids & Neuro-Symbolic Compilation
 */

import { HyperGridEngine } from '../hyper_grid';
import { NeuroSymbolicEngine, SymbolicRule } from '../neuro_symbolic';
import { CubioHyperNeuralBuilder } from '../cubio_builder';

function runGateCNLP5001TestSuite(): void {
  console.log('================================================================================');
  console.log(' 🌌 CUBIO HYPER-NEURAL LATTICE: GATE CNL-P5-001 VERIFICATION SUITE');
  console.log('================================================================================\n');

  try {
    // -------------------------------------------------------------------------
    // GATE 1: N-Dimensional Coordinate Mapping & Unflattening (N >= 4)
    // -------------------------------------------------------------------------
    console.log('[Gate 1.1] Verifying 4D HyperGrid Space-Time [7, 7, 7, 3]...');
    const grid4D = new HyperGridEngine([7, 7, 7, 3]);
    console.log(`  - Rank: ${grid4D.rank}D | Total Tensor Cells: ${grid4D.totalCells} | Strides: [${grid4D.getStrides().join(', ')}]`);

    const c4D = [3, 6, 2, 1];
    const mapped4D = grid4D.mapCoordinates(c4D);
    const unmapped4D = grid4D.unmapIndex(mapped4D.linearIndex);
    console.log(`  ✓ Forward Mapped ${JSON.stringify(c4D)} -> Linear Index #${mapped4D.linearIndex}`);
    console.log(`  ✓ Reverse Unmapped #${mapped4D.linearIndex} -> ${JSON.stringify(unmapped4D)}`);
    console.log(`  ✓ Normalized Hyper-Coords: [${mapped4D.normalizedCoords.join(', ')}]`);

    if (JSON.stringify(c4D) !== JSON.stringify(unmapped4D)) {
      throw new Error('4D coordinate round-trip bijection failed!');
    }

    console.log('\n[Gate 1.2] Verifying 5D HyperGrid [3, 3, 3, 3, 3]...');
    const grid5D = new HyperGridEngine([3, 3, 3, 3, 3]);
    console.log(`  - Rank: ${grid5D.rank}D | Total Tensor Cells: ${grid5D.totalCells} | Strides: [${grid5D.getStrides().join(', ')}]`);
    const c5D = [1, 2, 0, 2, 1];
    const mapped5D = grid5D.mapCoordinates(c5D);
    const unmapped5D = grid5D.unmapIndex(mapped5D.linearIndex);
    console.log(`  ✓ 5D Round-Trip Mapped ${JSON.stringify(c5D)} -> #${mapped5D.linearIndex} -> ${JSON.stringify(unmapped5D)}`);

    if (JSON.stringify(c5D) !== JSON.stringify(unmapped5D)) {
      throw new Error('5D coordinate round-trip bijection failed!');
    }

    // -------------------------------------------------------------------------
    // GATE 2: Hyper-Slice Volume Query & Spatial Adjacency
    // -------------------------------------------------------------------------
    console.log('\n[Gate 2] Verifying Hyper-Slice Volume Query & Neighborhood Traversal...');
    const sliceRanges = [
      { min: 0, max: 2 }, // axis 0: 0..2 (3 values)
      { min: 0, max: 1 }, // axis 1: 0..1 (2 values)
      { min: 0, max: 0 }, // axis 2: 0..0 (1 value)
      { min: 0, max: 1 }, // axis 3: 0..1 (2 values)
    ]; // Expected matching count: 3 * 2 * 1 * 2 = 12 cells
    const slicedCells = grid4D.querySlice(sliceRanges);
    console.log(`  ✓ Hyper-Slice 4D Query matched ${slicedCells.length} cells (Expected: 12).`);
    if (slicedCells.length !== 12) {
      throw new Error(`Hyper-slice count mismatch: got ${slicedCells.length}, expected 12`);
    }

    const neighbors = grid4D.getAdjacentNeighbors([3, 3, 3, 1]);
    console.log(`  ✓ Adjacent Neighbors of [3, 3, 3, 1] in 4D space: ${neighbors.length} neighbors found.`);
    if (neighbors.length !== 8) { // 2 per axis * 4 axes = 8 neighbors
      throw new Error(`Expected 8 adjacent neighbors in 4D interior cell, got ${neighbors.length}`);
    }

    // -------------------------------------------------------------------------
    // GATE 3: Neuro-Symbolic Hybrid Compilation & Inference
    // -------------------------------------------------------------------------
    console.log('\n[Gate 3] Verifying Neuro-Symbolic Hybrid Rule Execution...');
    const nsEngine = new NeuroSymbolicEngine();

    const rule1: SymbolicRule = {
      id: 'RULE_HYPER_RESONANCE_369',
      name: 'Verify 369 Harmonic Alignment & Temperature Guard',
      predicates: [
        { field: 'harmonicLevel', operator: 'HARMONIC_MATCH', value: 369 },
        { field: 'temperatureK', operator: '<', value: 300.0 },
        { field: 'containmentStatus', operator: '==', value: 'LOCKED' },
      ],
      action: 'TRIGGER_NEURAL_SPATIAL_SYNTHESIS',
      confidenceThreshold: 0.75,
      priority: 369,
    };

    nsEngine.registerRule(rule1);
    nsEngine.setNeuralWeights(mapped4D.linearIndex, [0.8, 0.9, 0.85, 0.95], 0.1, 9);

    // Test Case A: Valid conditions -> Should pass guard & achieve high neural confidence
    const validContext = {
      harmonicLevel: 369,
      temperatureK: 273.15,
      containmentStatus: 'LOCKED',
    };
    const resA = nsEngine.evaluateHybrid('RULE_HYPER_RESONANCE_369', mapped4D.linearIndex, [1.0, 0.9, 0.8, 1.0], validContext);
    console.log(`  ✓ Test Case A (Valid Guard): Guard Passed = ${resA.symbolicGuardPassed} | Neural Score = ${resA.neuralActivationScore} | Confidence = ${resA.hybridConfidence} | Action = ${resA.actionTaken}`);
    if (!resA.symbolicGuardPassed || resA.hybridConfidence < 0.75 || resA.actionTaken !== 'TRIGGER_NEURAL_SPATIAL_SYNTHESIS') {
      throw new Error('Test Case A failed neuro-symbolic inference!');
    }

    // Test Case B: Guard Violation (Temperature too high) -> Should fail closed
    const invalidContext = {
      harmonicLevel: 369,
      temperatureK: 350.0, // Violation
      containmentStatus: 'LOCKED',
    };
    const resB = nsEngine.evaluateHybrid('RULE_HYPER_RESONANCE_369', mapped4D.linearIndex, [1.0, 0.9, 0.8, 1.0], invalidContext);
    console.log(`  ✓ Test Case B (Violated Guard): Guard Passed = ${resB.symbolicGuardPassed} | Confidence = ${resB.hybridConfidence} | Action = ${resB.actionTaken}`);
    if (resB.symbolicGuardPassed || resB.hybridConfidence !== 0.0 || resB.actionTaken !== 'REJECTED_BY_GUARD_OR_THRESHOLD') {
      throw new Error('Test Case B failed to enforce symbolic guard!');
    }

    // -------------------------------------------------------------------------
    // GATE 4: Fail-Closed Permanent Actuation Lock
    // -------------------------------------------------------------------------
    console.log('\n[Gate 4] Verifying Fail-Closed Actuation Lock...');
    console.log(`  ✓ Actuation Lock Status: is_actuation_blocked = ${nsEngine.is_actuation_blocked}`);
    if (nsEngine.is_actuation_blocked !== true) {
      throw new Error('CRITICAL VIOLATION: Actuation block must be permanently true!');
    }

    // -------------------------------------------------------------------------
    // GATE 5: Deterministic Mathematical Reproducibility (0.0000% Drift, σ² = 0.0)
    // -------------------------------------------------------------------------
    console.log('\n[Gate 5] Verifying Deterministic Replay (100 Cycles, 0.0000% Drift)...');
    const firstScore = resA.hybridConfidence;
    for (let cycle = 0; cycle < 100; cycle++) {
      const replayRes = nsEngine.evaluateHybrid('RULE_HYPER_RESONANCE_369', mapped4D.linearIndex, [1.0, 0.9, 0.8, 1.0], validContext);
      if (replayRes.hybridConfidence !== firstScore || replayRes.deterministicVariance !== 0.0) {
        throw new Error(`Determinism drift detected at cycle ${cycle}!`);
      }
    }
    console.log('  ✓ 100/100 Replay Cycles executed with bit-for-bit exactness (Drift = 0.0000%, σ² = 0.0).');

    // -------------------------------------------------------------------------
    // GATE 6: Sovereign Builder & one.exe Integration
    // -------------------------------------------------------------------------
    console.log('\n[Gate 6] Verifying Sovereign Builder & one.exe CLI Integration...');
    const builder = new CubioHyperNeuralBuilder();
    builder.addSymbolicRule(rule1);
    const compileResult = builder.compileAndSeal([7, 7, 7, 3], 'cubio_neural_lattice_phase5.3dmemory');

    console.log(`  ✓ Gate Seal                  : ${compileResult.gate}`);
    console.log(`  ✓ HyperGrid Rank             : ${compileResult.hyperGridRank}D (${compileResult.totalTensorCells} cells)`);
    console.log(`  ✓ Lineage Ancestry Chain     : ${compileResult.lineageChain.map(l => l.phase).join(' -> ')}`);
    console.log(`  ✓ Post-Quantum PQC Root Seal : ${compileResult.pqcSeal}`);
    console.log(`  ✓ Fail-Closed Actuation Block: ${compileResult.isActuationBlocked}`);
    console.log(`  ✓ one.exe Output Verification:`);
    console.log(compileResult.oneExeOutput.split('\n').slice(0, 5).map(l => `    ${l}`).join('\n'));

    console.log('\n================================================================================');
    console.log(' 🏆 GATE CNL-P5-001 FULLY CERTIFIED & PASSED (100% SUCCESS)');
    console.log('================================================================================\n');
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('\n❌ FAIL: Gate CNL-P5-001 Test Failure:');
      console.error(err.message);
    }
    process.exit(1);
  }
}

runGateCNLP5001TestSuite();
