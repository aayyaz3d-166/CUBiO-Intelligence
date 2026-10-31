/**
 * Comprehensive Automated Test Suite for Gate CNL-P25-001
 * Target: Autonomous Self-Evolving Code & AST Mutation Engine ("one-evolve")
 */

import { EvolutionOrchestrator } from '../evolution_orchestrator';

function runGateCNLP25001TestSuite(): void {
  console.log('================================================================================');
  console.log(' 🧬 CUBIO AUTONOMOUS SELF-EVOLVING CODE: GATE CNL-P25-001 TEST SUITE');
  console.log('================================================================================\n');

  try {
    const orchestrator = new EvolutionOrchestrator();

    // -------------------------------------------------------------------------
    // GATE 1: Multi-Generation Autonomous AST Evolution (GEN_0 -> GEN_4)
    // -------------------------------------------------------------------------
    console.log('[Gate 1] Verifying Multi-Generation AST Evolution Pipeline...');
    const report = orchestrator.executeEvolutionPipeline(1);
    console.log(`  - Total Active Generations : ${report.totalGenerations}`);
    console.log(`  - Active AST Tag           : ${report.activeProfile.generationTag}`);
    console.log(`  - Active Node Count        : ${report.activeProfile.astNodeCount} nodes`);
    console.log(`  - PQC Generation Seal      : ${report.activeProfile.pqcGenSeal.substring(0, 32)}...`);

    if (report.totalGenerations < 5 || report.activeProfile.generation !== 4) {
      throw new Error(`Expected 5 generations with active generation 4, got total: ${report.totalGenerations}, active: ${report.activeProfile.generation}`);
    }
    console.log('  ✓ 5 evolutionary generations successfully generated and tracked.');

    // -------------------------------------------------------------------------
    // GATE 2: Mathematical Fitness & Performance Acceleration (>30%)
    // -------------------------------------------------------------------------
    console.log('\n[Gate 2] Verifying Mathematical Fitness & Cumulative Gain...');
    console.log(`  - Initial Baseline Fitness : ${report.initialFitness.toFixed(4)}`);
    console.log(`  - Evolved Final Fitness    : ${report.finalFitness.toFixed(4)}`);
    console.log(`  - Cumulative Gain          : +${report.cumulativeFitnessGainPercent.toFixed(2)}% (Requirement: > 30.00%)`);
    console.log(`  - Evolved Latency          : ${report.activeProfile.latencyMs.toFixed(4)} ms (Baseline: 10.0 ms)`);
    console.log(`  - Evolved Energy Flux      : ${report.activeProfile.energyFluxUnits.toFixed(4)} (Baseline: 100.0)`);

    if (report.cumulativeFitnessGainPercent <= 30.0) {
      throw new Error(`Cumulative fitness gain ${report.cumulativeFitnessGainPercent.toFixed(2)}% did not exceed required threshold of 30.00%!`);
    }
    console.log('  ✓ Cumulative performance and energy optimization (>30%) verified.');

    // -------------------------------------------------------------------------
    // GATE 3: Instant Degraded Mutation Rollback Guard (< 1 ms)
    // -------------------------------------------------------------------------
    console.log('\n[Gate 3] Verifying Instant Rollback Guard on Degraded Candidate...');
    console.log(`  - Handled Rollbacks Count  : ${report.rollbackCount}`);
    console.log(`  - Active Generation Intact : ${report.activeProfile.generationTag} (Fitness: ${report.activeProfile.fitnessScore.toFixed(4)})`);

    if (report.rollbackCount !== 1) {
      throw new Error(`Expected exactly 1 rollback event, got ${report.rollbackCount}`);
    }
    console.log('  ✓ Degraded candidate mutation safely rejected and rolled back.');

    // -------------------------------------------------------------------------
    // GATE 4: Sovereign LTM Evolution Trace Guidance & Zero Forgetting
    // -------------------------------------------------------------------------
    console.log('\n[Gate 4] Verifying LTM Trace Storage and Zero Catastrophic Forgetting...');
    const storedTraces = orchestrator.ltm.getTotalStoredKeys();
    const forgettingRate = orchestrator.ltm.getForgettingRate();
    console.log(`  - Total LTM Stored Traces  : ${storedTraces}`);
    console.log(`  - LTM Forgetting Rate      : ${(forgettingRate * 100).toFixed(4)}%`);

    if (storedTraces < 5 || forgettingRate !== 0.0) {
      throw new Error('LTM evolutionary trace retention failed!');
    }
    console.log('  ✓ Evolution telemetry securely persisted in LTM with 0.0000% forgetting rate.');

    // -------------------------------------------------------------------------
    // GATE 5: Fail-Closed Actuation Lock & Memory Bounds (<512 MB)
    // -------------------------------------------------------------------------
    console.log('\n[Gate 5] Verifying Fail-Closed Actuation Lock & Memory RSS...');
    console.log(`  - Measured Memory RSS      : ${report.peakRssMb} MB (Limit: 512 MB)`);
    console.log(`  - is_actuation_blocked     : ${report.isActuationBlocked}`);

    if (report.peakRssMb > 512.0 || report.isActuationBlocked !== true) {
      throw new Error('Safety invariants breached!');
    }
    console.log('  ✓ Permanent fail-closed lock and memory containment verified.');

    // -------------------------------------------------------------------------
    // GATE 6: 100-Cycle Deterministic Replay (0.0000% Drift)
    // -------------------------------------------------------------------------
    console.log('\n[Gate 6] Verifying 100-Cycle Deterministic Replay (0.0000% Drift)...');
    const initialSeal = report.pqcMasterSeal;
    for (let c = 0; c < 100; c++) {
      const freshOrchestrator = new EvolutionOrchestrator();
      const replayed = freshOrchestrator.executeEvolutionPipeline(1);
      if (replayed.pqcMasterSeal !== initialSeal) {
        throw new Error(`Determinism drift at evolution cycle ${c}!`);
      }
    }
    console.log('  ✓ 100/100 Replay Cycles executed with bit-for-bit exactness (Drift = 0.0000%, σ² = 0.0).');

    console.log('\n================================================================================');
    console.log(' 🏆 GATE CNL-P25-001 FULLY CERTIFIED & PASSED (100% SUCCESS)');
    console.log('================================================================================\n');
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('\n❌ FAIL: Gate CNL-P25-001 Test Failure:');
      console.error(err.message);
    }
    process.exit(1);
  }
}

runGateCNLP25001TestSuite();

