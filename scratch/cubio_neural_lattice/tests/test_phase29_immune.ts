/**
 * Comprehensive Automated Test Suite for Gate CNL-P29-001
 * Target: Sovereign Immune & Scoring System ("one-immune" / "one-score")
 *
 * 6 Test Gates:
 *   Gate 1 — CSI Sovereign Score Index: 4-pillar composite evaluation & grade
 *   Gate 2 — Autonomous Pathogen Detection: rogue packet quarantine (0 breaches)
 *   Gate 3 — Self-Healing AST & LTM: component restoration from clean PQC snapshots
 *   Gate 4 — PQC Lattice Reinforcement: post-attack entropy upgrade
 *   Gate 5 — Sovereign LTM Trace Retention (0.0000% Catastrophic Forgetting)
 *   Gate 6 — 100-Cycle Deterministic Replay (sigma^2 = 0.0, 0.0000% Drift)
 */

import { Gate29Orchestrator } from '../gate29_orchestrator';
import { SovereignScoreIndex } from '../sovereign_score_index';
import { AutonomousImmuneShield } from '../autonomous_immune_shield';

function runGateCNLP29001TestSuite(): void {
  console.log('================================================================================');
  console.log(' 🛡️ CUBIO SOVEREIGN IMMUNE & SCORING ENGINE: GATE CNL-P29-001 TEST SUITE');
  console.log('================================================================================\n');

  try {
    const orchestrator = new Gate29Orchestrator();

    // -------------------------------------------------------------------------
    // GATE 1: CSI Sovereign Score Index — 4-Pillar Composite Evaluation
    // -------------------------------------------------------------------------
    console.log('[Gate 1] Verifying CUBiO Sovereign Score Index (CSI) — 4-Pillar Evaluation...');
    const report = orchestrator.executeGate29Cycle(1);
    const csi = report.csiReport;

    console.log(`  CSI Pillar Scores:`);
    console.log(`  ├── Evolutionary Fitness  (25%) : ${csi.pillarScores.evolutionaryFitnessScore.toFixed(2)} / 100`);
    console.log(`  ├── Homeostatic Health    (30%) : ${csi.pillarScores.homeostaticHealthScore.toFixed(2)} / 100`);
    console.log(`  ├── UUP Truth Score       (30%) : ${csi.pillarScores.uupTruthScore.toFixed(2)} / 100`);
    console.log(`  └── PQC Security Score    (15%) : ${csi.pillarScores.pqcSecurityScore.toFixed(2)} / 100`);
    console.log(`  ─────────────────────────────────────────`);
    console.log(`  TOTAL CSI Score                 : ${csi.totalCSIScore.toFixed(4)} / 100`);
    console.log(`  CSI Grade                       : ${csi.csiGrade}`);
    console.log(`  Fail-Safe Triggered             : ${csi.failSafeTriggered}`);
    console.log(`  Fail-Safe Reasons               : ${csi.failSafeReasons.length === 0 ? 'NONE' : csi.failSafeReasons.join('; ')}`);
    console.log(`  CSI PQC Seal                    : ${csi.pqcCSISeal.substring(0, 28)}...`);

    if (csi.totalCSIScore <= 0) {
      throw new Error('CSI total score is zero or negative!');
    }
    if (csi.failSafeTriggered) {
      throw new Error(`CSI fail-safe triggered! Reasons: ${csi.failSafeReasons.join('; ')}`);
    }
    if (!['S+', 'S', 'A', 'B', 'C'].includes(csi.csiGrade)) {
      throw new Error(`CSI grade '${csi.csiGrade}' is failing grade!`);
    }
    if (csi.pillarScores.pqcSecurityScore < 90) {
      throw new Error(`PQC Security pillar score too low: ${csi.pillarScores.pqcSecurityScore}`);
    }

    // Verify fail-safe triggers on invalid conditions
    const testCSI = new SovereignScoreIndex();
    const badReport = testCSI.evaluate(
      { astMutationGainPct: 10, previousRssMb: 100, currentRssMb: 600, rssLimitMb: 512, replayDriftPct: 0 },
      { currentRssMb: 600, rssLimitMb: 512, harmonicFreqMhz: 3, harmonic369Locked: false, hrvCoefficient: 0.1, peakThermalKelvin: 400, hilStressCyclesPassed: 0, hilStressCyclesTotal: 50 },
      { uupConfidence: 0.5, sensorFusionNodeCount: 100, totalNodes: 343, ltmForgettingRate: 0.05, sigmaSquared: 0.01 },
      { isActuationBlocked: false, roguePktsDetected: 10, roguePktsQuarantined: 5, pqcSealValid: false, breachEvents: 2 },
    );
    if (!badReport.failSafeTriggered || badReport.pillarScores.pqcSecurityScore !== 0) {
      throw new Error('CSI fail-safe did not trigger on breach/ceiling violation!');
    }
    console.log(`  - Fail-Safe Trigger Test (breach+ceiling): ✓ TRIGGERED CORRECTLY`);
    console.log('  ✓ CUBiO Sovereign Score Index (CSI) 4-pillar evaluation verified.\n');

    // -------------------------------------------------------------------------
    // GATE 2: Autonomous Pathogen Detection — Rogue Packet Quarantine
    // -------------------------------------------------------------------------
    console.log('[Gate 2] Verifying Autonomous Pathogen Detection & Quarantine...');
    const immune = report.immuneShieldReport;
    const qLog = orchestrator.immuneShield.getQuarantineLog();

    console.log(`  - Total Threats Detected        : ${immune.totalThreatsDetected}`);
    console.log(`  - Total Threats Quarantined     : ${immune.totalThreatsQuarantined}`);
    console.log(`  - Quarantine Efficiency         : ${immune.quarantineEfficiencyPct.toFixed(4)}%`);
    console.log(`  - System Integrity Score        : ${immune.systemIntegrityScore.toFixed(4)}`);
    for (const q of qLog) {
      console.log(`    * [${q.threatVector.severity}] ${q.threatVector.threatClass} → ${q.neutralizationMethod} | Neutralized: ${q.isNeutralized}`);
    }

    if (immune.totalThreatsDetected < 4) {
      throw new Error('Immune engine detected fewer than 4 threats!');
    }
    if (immune.quarantineEfficiencyPct < 100.0) {
      throw new Error(`Quarantine efficiency below 100%! Got: ${immune.quarantineEfficiencyPct}%`);
    }

    // Verify immediate quarantine (no breach events)
    const anyUnquarantined = qLog.some(q => !q.isNeutralized);
    if (anyUnquarantined) {
      throw new Error('One or more threats were NOT neutralized!');
    }
    console.log('  - Zero Breach Events (all quarantined before breach): ✓');
    console.log('  ✓ 100% autonomous pathogen detection and quarantine verified.\n');

    // -------------------------------------------------------------------------
    // GATE 3: Self-Healing AST & LTM Repair from PQC Snapshots
    // -------------------------------------------------------------------------
    console.log('[Gate 3] Verifying Self-Healing AST & LTM Component Restoration...');
    const healingLog = orchestrator.immuneShield.getHealingLog();

    console.log(`  - Total Healing Operations      : ${immune.totalHealingOperations}`);
    console.log(`  - Successful Healings           : ${immune.successfulHealings}`);
    console.log(`  - Healing Success Rate          : ${immune.healingSuccessRatePct.toFixed(4)}%`);
    for (const h of healingLog) {
      console.log(`    * [${h.targetComponent}] Type: ${h.corruptionType} | Restored: ${h.healingSuccessful} | From: ${h.snapshotRestoredFrom.substring(0, 30)}...`);
    }

    if (immune.totalHealingOperations < 2) {
      throw new Error('Immune engine performed fewer than 2 healing operations!');
    }
    if (immune.healingSuccessRatePct < 100.0) {
      throw new Error(`Healing success rate below 100%! Got: ${immune.healingSuccessRatePct}%`);
    }

    // Verify all healed from valid PQC snapshot (not 'NO_SNAPSHOT_AVAILABLE')
    const failedHeal = healingLog.find(h => h.snapshotRestoredFrom === 'NO_SNAPSHOT_AVAILABLE');
    if (failedHeal) {
      throw new Error(`Component '${failedHeal.targetComponent}' had no clean snapshot for healing!`);
    }
    console.log('  - All components healed from valid PQC-certified clean snapshots: ✓');
    console.log('  ✓ Self-healing AST & LTM restoration from PQC snapshots verified.\n');

    // -------------------------------------------------------------------------
    // GATE 4: PQC Lattice Reinforcement — Post-Attack Entropy Upgrade
    // -------------------------------------------------------------------------
    console.log('[Gate 4] Verifying PQC Lattice Dynamic Reinforcement...');
    const reinforceLog = orchestrator.immuneShield.getReinforcementLog();

    console.log(`  - Total Lattice Reinforcements  : ${immune.totalLatticeReinforcements}`);
    for (const r of reinforceLog) {
      console.log(`    * Node: ${r.nodeId} | Entropy: ${r.previousSealStrength} → ${r.newSealStrength} bits | Seal: ${r.pqcReinforcementSeal.substring(0, 24)}...`);
    }
    console.log(`  - is_actuation_blocked          : ${report.isActuationBlocked} (Permanent Fail-Closed Lock)`);
    console.log(`  - Conditional Actuation         : ${report.isConditionalActuationVerified ? 'CLEARED' : 'BLOCKED'}`);
    console.log(`  - PQC Master Root Seal          : ${report.pqcMasterSeal.substring(0, 28)}...`);

    if (immune.totalLatticeReinforcements < 2) {
      throw new Error('Fewer than 2 lattice reinforcement operations executed!');
    }
    // Verify entropy increase on all reinforcements
    for (const r of reinforceLog) {
      if (r.newSealStrength <= r.previousSealStrength) {
        throw new Error(`Node '${r.nodeId}' lattice seal entropy did NOT increase after reinforcement!`);
      }
    }
    if (report.isActuationBlocked !== true) {
      throw new Error('CRITICAL: Permanent fail-closed PQC actuation lock released!');
    }
    if (!report.isConditionalActuationVerified) {
      throw new Error('Conditional actuation clearance failed!');
    }
    if (!report.pqcMasterSeal.startsWith('0xPQC_369_') || !report.pqcMasterSeal.endsWith('_SEAL')) {
      throw new Error('PQC master root seal format invalid!');
    }
    console.log('  ✓ PQC lattice dynamic reinforcement and fail-closed actuation shield verified.\n');

    // -------------------------------------------------------------------------
    // GATE 5: Sovereign LTM Trace Retention (0.0000% Catastrophic Forgetting)
    // -------------------------------------------------------------------------
    console.log('[Gate 5] Verifying Sovereign LTM Immune Memory Trace Retention...');
    const csiTrace    = orchestrator.ltm.recallMemoryTrace([0, 0, 0], 'CSI_EVAL_TRACE_SEQ_1');
    const immuneTrace = orchestrator.ltm.recallMemoryTrace([3, 3, 3], 'IMMUNE_SHIELD_TRACE_SEQ_1');
    const apTrace     = orchestrator.ltm.recallMemoryTrace([6, 6, 6], 'PACEMAKER_TRACE_SEQ_1');
    const forgetting  = orchestrator.ltm.getForgettingRate();

    console.log(`  - CSI Eval Trace    [@0,0,0]: ${csiTrace    ? 'YES' : 'NO'}`);
    console.log(`  - Immune Shield Trace[@3,3,3]: ${immuneTrace ? 'YES' : 'NO'}`);
    console.log(`  - Pacemaker Trace   [@6,6,6]: ${apTrace     ? 'YES' : 'NO'}`);
    console.log(`  - LTM Forgetting Rate        : ${(forgetting * 100).toFixed(4)}%`);

    if (!csiTrace || !immuneTrace || !apTrace || forgetting !== 0.0) {
      throw new Error('LTM immune trace retention failed — catastrophic forgetting detected!');
    }
    console.log('  ✓ Zero catastrophic forgetting (0.0000%) across all 3 LTM immune memory layers.\n');

    // -------------------------------------------------------------------------
    // GATE 6: 100-Cycle Deterministic Replay (0.0000% Drift, sigma^2 = 0.0)
    // -------------------------------------------------------------------------
    console.log('[Gate 6] Verifying 100-Cycle Deterministic Replay (0.0000% Drift)...');
    const initialSeal = report.pqcMasterSeal;
    for (let c = 0; c < 100; c++) {
      const fresh = new Gate29Orchestrator();
      const replayed = fresh.executeGate29Cycle(1);
      if (replayed.pqcMasterSeal !== initialSeal) {
        throw new Error(`Determinism drift at immune cycle ${c}! Got: ${replayed.pqcMasterSeal}`);
      }
    }
    console.log('  ✓ 100/100 Replay Cycles bit-for-bit exact (Drift = 0.0000%, σ² = 0.0).\n');

    console.log('================================================================================');
    console.log(' 🏆 GATE CNL-P29-001 FULLY CERTIFIED & PASSED (100% SUCCESS)');
    console.log(' 🛡️ SOVEREIGN IMMUNE & SCORING ENGINE ALIVE — SYSTEM IS SELF-HEALING');
    console.log('================================================================================\n');

  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('\n❌ FAIL: Gate CNL-P29-001 Test Failure:');
      console.error(err.message);
    }
    process.exit(1);
  }
}

runGateCNLP29001TestSuite();
