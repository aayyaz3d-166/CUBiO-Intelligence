/**
 * Automated Test Suite for Gate CNL-P38-001
 * Target: ONE Language Development Environment — ODE Mathematical Superposition Workspace ("one-ode")
 *
 * 6 Test Gates:
 *   Gate 1 — Mathematical Superposition AST Analysis & Branch Probability Verification
 *   Gate 2 — Real-Time 3-6-9 Harmonic Profiling & Canonical Address369 Spatial Mapping
 *   Gate 3 — Zero-Dependency Native ANSI IDE Workspace Rendering (Three.js = 0)
 *   Gate 4 — Hot-Compilation & Executable CubiO AST Generation
 *   Gate 5 — Continuous CSI Grade S+ Persistence (>= 99.60%) under < 512 MB RSS
 *   Gate 6 — 100-Cycle Deterministic Bit-Exact Replay (sigma^2 = 0.0, 0.0000% Drift)
 */

import { ODEMasterOrchestrator } from '../ode_master_orchestrator';
import { CanonicalAddress369 } from '../../../src/one/address369_canonical';

function runGateCNLP38ODETestSuite(): void {
  console.log('================================================================================');
  console.log(' 🌌 CUBIO ONE SOVEREIGN ODE SUITE: GATE CNL-P38-001 TEST SUITE');
  console.log('================================================================================\n');

  try {
    const orchestrator = new ODEMasterOrchestrator();
    const mission = orchestrator.executeOdeSession(ODEMasterOrchestrator.DEFAULT_SAMPLE_PROGRAM, 1, 42);
    const session = mission.session;

    // -------------------------------------------------------------------------
    // GATE 1: Mathematical Superposition AST Analysis & Branch Probability
    // -------------------------------------------------------------------------
    console.log('[Gate 1] Verifying Mathematical Superposition AST Analysis & Branch Probabilities...');
    const superReport = session.superpositionReport;
    console.log(`  - Total AST Nodes               : ${superReport.totalNodes}`);
    console.log(`  - Total Funnels                 : ${superReport.totalFunnels}`);
    console.log(`  - Superposition Branches        : ${superReport.branches.length}`);
    console.log(`  - Coherence Norm (|c|²)         : ${superReport.stateCoherenceNorm}`);
    console.log(`  - Dominant Branch ID            : ${superReport.dominantBranchId}`);
    console.log(`  - Superposition Analysis Latency: ${superReport.analysisLatencyMs} ms`);

    for (const b of superReport.branches) {
      console.log(`    * ${b.branchId}: ${b.sourceNodeId} -> ${b.targetNodeId} (amp: ${b.probabilityAmplitude}, freq: ${b.harmonicConstraintHz / 1e6} MHz)`);
    }

    if (superReport.branches.length !== 2) {
      throw new Error(`Expected 2 superposition branches, got ${superReport.branches.length}`);
    }
    if (Math.abs(superReport.stateCoherenceNorm - 1.0) > 0.05) {
      throw new Error(`Quantum coherence norm outside valid threshold: ${superReport.stateCoherenceNorm}`);
    }
    console.log('  ✓ Mathematical superposition AST evaluation and probability normalization confirmed.\n');

    // -------------------------------------------------------------------------
    // GATE 2: Real-Time 3-6-9 Harmonic Profiling & Address369 Spatial Mapping
    // -------------------------------------------------------------------------
    console.log('[Gate 2] Verifying Real-Time 3-6-9 Harmonic Profiling & Address369 Mapping...');
    const harmReport = session.harmonicReport;
    const dist = harmReport.distribution;
    console.log(`  - Harmonic Band Distribution    : 3MHz=${dist.tier3MHzPercent}%, 6MHz=${dist.tier6MHzPercent}%, 9MHz=${dist.tier9MHzPercent}%`);
    console.log(`  - Total Energy Flux             : ${dist.totalEnergyFluxMw} mW`);
    console.log(`  - Harmonic Resonance Score      : ${dist.harmonicResonanceScore} (3-6-9 Golden Ratio Alignment)`);
    console.log(`  - Peak Frequency                : ${harmReport.peakFrequencyHz / 1e6} MHz`);
    console.log(`  - Memory Allocation / Headroom  : ${harmReport.totalAllocatedMemoryMb} MB / ${harmReport.memoryHeadroomMb} MB`);

    for (const np of harmReport.nodeProfiles) {
      console.log(`    * Node '${np.nodeId}' -> Canonical Addr: ${np.canonicalAddress} [Display Index: ${np.displayIndex}] | Tier: ${np.harmonicTier} (${np.frequencyHz / 1e6} MHz)`);
      if (np.canonicalAddress < CanonicalAddress369.SPATIAL_START || np.canonicalAddress > CanonicalAddress369.SPATIAL_END) {
        throw new Error(`Node ${np.nodeId} address ${np.canonicalAddress} outside spatial range [26..368]!`);
      }
      if (np.displayIndex !== np.canonicalAddress + 1) {
        throw new Error(`Display Index ${np.displayIndex} mismatch for canonical address ${np.canonicalAddress}!`);
      }
    }

    if (dist.harmonicResonanceScore < 0.85) {
      throw new Error(`Harmonic resonance score too low: ${dist.harmonicResonanceScore}`);
    }
    console.log('  ✓ Real-time 3-6-9 harmonic tiers and Canonical Address369 spatial mapping verified.\n');

    // -------------------------------------------------------------------------
    // GATE 3: Zero-Dependency Native ANSI IDE Workspace Rendering (Three.js = 0)
    // -------------------------------------------------------------------------
    console.log('[Gate 3] Verifying Zero-Dependency Native ANSI IDE Workspace (Three.js = 0)...');
    console.log(`  - Three.js Dependency Count     : ${mission.threeJsDependencyCount} (Pure Native ONE Language)`);
    console.log(`  - Rendered View Length          : ${session.renderedTerminalView.length} characters`);

    const view = session.renderedTerminalView;
    const pane1Found = view.includes('PANE 1: SOVEREIGN SOURCE EDITOR');
    const pane2Found = view.includes('PANE 2: AST HIERARCHY & SUPERPOSITION GRAPH');
    const pane3Found = view.includes('PANE 3: 3-6-9 HARMONIC PROFILER HEATMAP');
    const pane4Found = view.includes('PANE 4: DIAGNOSTICS & PQC SECURITY ENCLAVE');

    console.log(`  - Pane 1 (Source Editor)        : ${pane1Found ? 'FOUND' : 'MISSING'}`);
    console.log(`  - Pane 2 (AST & Superposition)  : ${pane2Found ? 'FOUND' : 'MISSING'}`);
    console.log(`  - Pane 3 (Harmonic Profiler)    : ${pane3Found ? 'FOUND' : 'MISSING'}`);
    console.log(`  - Pane 4 (Diagnostics Enclave)  : ${pane4Found ? 'FOUND' : 'MISSING'}`);

    if (mission.threeJsDependencyCount !== 0) {
      throw new Error(`Three.js dependency violation: count is ${mission.threeJsDependencyCount}`);
    }
    if (!pane1Found || !pane2Found || !pane3Found || !pane4Found) {
      throw new Error('Native ANSI terminal workspace layout missing one or more required panes!');
    }
    console.log('  ✓ Zero-dependency native ANSI 4-pane IDE terminal rendering verified.\n');

    // -------------------------------------------------------------------------
    // GATE 4: Hot-Compilation & Executable AST Generation
    // -------------------------------------------------------------------------
    console.log('[Gate 4] Verifying Hot-Compilation to Bare-Metal CubiO Executable Bytecode...');
    const execAst = session.executableAst;
    if (!execAst) {
      throw new Error('Executable AST was not produced by hot-compiler!');
    }
    console.log(`  - Target RSS Limit              : ${execAst.targetRssLimitBytes / (1024 * 1024)} MB`);
    console.log(`  - Compiled Instruction Count    : ${execAst.instructions.length}`);
    console.log(`  - Spatial Nodes Count           : ${execAst.spatialNodesCount}`);
    console.log(`  - Total Voxel Cells             : ${execAst.totalVoxelCellsCount}`);
    console.log(`  - Determinism Sigma Squared     : ${execAst.determinismSigmaSq}`);

    if (execAst.instructions.length < 5) {
      throw new Error(`Insufficient compiled instructions: ${execAst.instructions.length}`);
    }
    console.log('  ✓ Hot-compilation and executable instruction bytecode verified.\n');

    // -------------------------------------------------------------------------
    // GATE 5: Continuous CSI Grade S+ Persistence (>= 99.60%) under < 512 MB RSS
    // -------------------------------------------------------------------------
    console.log('[Gate 5] Verifying Continuous CSI Grade S+ Persistence (>= 99.60%)...');
    console.log(`  - Measured Operational Memory RSS: ${mission.measuredRssMb} MB (Physical ceiling: 512 MB)`);
    console.log(`  - Permanent Fail-Closed Lock     : ${mission.isActuationBlocked}`);
    console.log(`  - CSI Score                      : ${session.diagnostics.csiScore}% (Grade ${session.diagnostics.csiGrade})`);
    console.log(`  - Master PQC Root Seal           : ${mission.pqcMasterSeal}`);

    if (mission.measuredRssMb >= 512.0) {
      throw new Error(`Memory RSS ceiling breached: ${mission.measuredRssMb} MB >= 512 MB`);
    }
    if (!mission.isActuationBlocked) {
      throw new Error('CRITICAL SAFETY VIOLATION: is_actuation_blocked is false!');
    }
    if (session.diagnostics.csiScore < 99.60) {
      throw new Error(`CSI Grade S+ breached: score is ${session.diagnostics.csiScore}%`);
    }
    if (!mission.pqcMasterSeal.startsWith('0xPQC_369_') || !mission.pqcMasterSeal.endsWith('_SEAL')) {
      throw new Error(`Invalid PQC master seal format: ${mission.pqcMasterSeal}`);
    }
    console.log('  ✓ Continuous CSI Grade S+ and permanent fail-closed hardware lock confirmed.\n');

    // -------------------------------------------------------------------------
    // GATE 6: 100-Cycle Deterministic Bit-Exact Replay (0.0000% Drift)
    // -------------------------------------------------------------------------
    console.log('[Gate 6] Verifying 100-Cycle Deterministic Bit-Exact Replay (0.0000% Drift)...');
    const initialSeal = mission.pqcMasterSeal;
    for (let c = 0; c < 100; c++) {
      const freshOrch = new ODEMasterOrchestrator();
      const replayed = freshOrch.executeOdeSession(ODEMasterOrchestrator.DEFAULT_SAMPLE_PROGRAM, 1, 42);
      if (replayed.pqcMasterSeal !== initialSeal) {
        throw new Error(`Deterministic replay drift at cycle ${c}! Base=${initialSeal}, Replay=${replayed.pqcMasterSeal}`);
      }
    }
    console.log('  ✓ 100/100 Replay Cycles executed with bit-for-bit exactness (sigma^2 = 0.0, 0.0000% Drift).\n');

    console.log('================================================================================');
    console.log(' 🏆 GATE CNL-P38-001 ODE SUITE 100% CERTIFIED & PASSED');
    console.log(' 🌌 ONE DEVELOPMENT ENVIRONMENT (ODE) SOVEREIGN WORKSPACE READY');
    console.log('================================================================================\n');

    // Display formatted workspace preview in console
    console.log('--- NATIVE ODE ANSI WORKSPACE PREVIEW ---');
    console.log(session.renderedTerminalView);
    console.log('-----------------------------------------');
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err);
    process.exit(1);
  }
}

runGateCNLP38ODETestSuite();
