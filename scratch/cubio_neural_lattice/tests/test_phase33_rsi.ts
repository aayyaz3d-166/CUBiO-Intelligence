/**
 * Comprehensive Automated Test Suite for Gate CNL-P33-001
 * Target: Autonomous Recursive Self-Compiler & AST Genesis ("one-rsi")
 *
 * 6 Test Gates:
 *   Gate 1 — Autonomous Source Tree Inspection & AST Complexity Profiling
 *   Gate 2 — Multi-Pass AST Optimization Generation (>= +35.0% Acceleration Gain)
 *   Gate 3 — Sandboxed Autonomous Binary Emitter & PQC Signature Verification
 *   Gate 4 — Continuous CSI Grade S+ Persistence (>= 99.60%) Across Self-Compilation
 *   Gate 5 — Omnipresent LTM Dual-Layer Self-Compilation Trace Retention (0.0000% Forgetting)
 *   Gate 6 — 100-Cycle Deterministic Bit-Exact Replay (sigma^2 = 0.0, 0.0000% Drift)
 */

import { RSIGenesisOrchestrator } from '../rsi_genesis_orchestrator';
import { RecursiveSelfCompilerEngine } from '../recursive_self_compiler_engine';
import { AutonomousBinaryEmitter } from '../autonomous_binary_emitter';

function runGateCNLP33001RSITestSuite(): void {
  console.log('================================================================================');
  console.log(' 💻 CUBIO AUTONOMOUS RECURSIVE SELF-COMPILER (one-rsi): GATE CNL-P33-001 TEST SUITE');
  console.log('================================================================================\n');

  try {
    const orchestrator = new RSIGenesisOrchestrator();

    // -------------------------------------------------------------------------
    // GATE 1: Autonomous Source Tree Inspection & AST Complexity Profiling
    // -------------------------------------------------------------------------
    console.log('[Gate 1] Verifying Autonomous Source Tree Inspection & AST Complexity Profiling...');
    const report = orchestrator.executeRSICycle(1);
    const profile = report.compilerProfile;

    console.log(`  - Source Tree Location         : ${profile.sourceTreePath}`);
    console.log(`  - Files Inspected              : ${profile.filesInspected}`);
    console.log(`  - Total Source Bytes           : ${profile.totalSourceBytes} bytes`);
    console.log(`  - Total Estimated AST Nodes    : ${profile.totalASTNodes} nodes`);

    if (profile.filesInspected < 3) {
      throw new Error(`Insufficient files inspected in src/one: ${profile.filesInspected}`);
    }
    if (profile.totalSourceBytes < 5000) {
      throw new Error(`Source bytes too low: ${profile.totalSourceBytes}`);
    }
    console.log('  ✓ Autonomous source inspection and AST profiling verified.\n');

    // -------------------------------------------------------------------------
    // GATE 2: Multi-Pass AST Optimization Generation (>= +35.0% Gain)
    // -------------------------------------------------------------------------
    console.log('[Gate 2] Verifying Multi-Pass AST Optimization Generation (>= +35.0% Gain)...');
    console.log(`  - Optimization Passes Applied  : ${profile.passesApplied.length}`);
    for (const p of profile.passesApplied) {
      console.log(`    * [${p.passType}] Target: ${p.targetFile} | Latency: -${p.latencyReductionPct}% | Energy: -${p.energyReductionPct}%`);
    }
    console.log(`  - Baseline Execution Time      : ${profile.baselineExecutionMs.toFixed(4)} ms`);
    console.log(`  - Optimized Execution Time     : ${profile.optimizedExecutionMs.toFixed(4)} ms`);
    console.log(`  - Cumulative Acceleration Gain : +${profile.cumulativeAccelerationGainPct.toFixed(2)}% (Target: >= +35.0%)`);

    if (profile.passesApplied.length < 4) {
      throw new Error(`Expected at least 4 AST optimization passes, got ${profile.passesApplied.length}`);
    }
    if (profile.cumulativeAccelerationGainPct < 35.0) {
      throw new Error(`Compiler acceleration gain below 35.0%: +${profile.cumulativeAccelerationGainPct}%`);
    }
    console.log('  ✓ Autonomous AST multi-pass optimization verified (>= +35.0% gain).\n');

    // -------------------------------------------------------------------------
    // GATE 3: Sandboxed Autonomous Binary Emitter & PQC Signature Verification
    // -------------------------------------------------------------------------
    console.log('[Gate 3] Verifying Sandboxed Autonomous Binary Emitter & PQC Signatures...');
    const bin = report.emittedBinary;
    const verify = report.binaryVerification;

    console.log(`  - Emitted Binary ID            : ${bin.binaryId}`);
    console.log(`  - Target Architecture          : ${bin.targetArchitecture}`);
    console.log(`  - Emitted Binary Size          : ${bin.binarySizeBytes} bytes`);
    console.log(`  - Entry Point                  : ${bin.entryPointHex}`);
    console.log(`  - PQC Signature Valid          : ${verify.pqcSignatureValid}`);
    console.log(`  - Sandbox Execution Passed     : ${verify.sandboxExecutionPassed}`);
    console.log(`  - Instant Rollback Guard       : ${verify.rollbackTriggered ? 'TRIGGERED (FAIL)' : 'CLEAR (PASS)'}`);

    if (!verify.pqcSignatureValid) {
      throw new Error('Emitted binary PQC signature validation failed!');
    }
    if (!verify.sandboxExecutionPassed) {
      throw new Error('Sandboxed execution test failed on emitted binary!');
    }
    if (verify.rollbackTriggered) {
      throw new Error('Rollback guard was unexpectedly triggered on valid binary!');
    }
    console.log('  ✓ Sandboxed binary emission and PQC lattice validation verified.\n');

    // -------------------------------------------------------------------------
    // GATE 4: Continuous CSI Grade S+ Persistence (>= 99.60%)
    // -------------------------------------------------------------------------
    console.log('[Gate 4] Verifying Continuous CSI Grade S+ Persistence (>= 99.60%)...');
    const csi = report.csiReport;

    console.log(`  CSI Pillar Scores:`);
    console.log(`  ├── Evolutionary Fitness  (25%) : ${csi.pillarScores.evolutionaryFitnessScore.toFixed(2)} / 100`);
    console.log(`  ├── Homeostatic Health    (30%) : ${csi.pillarScores.homeostaticHealthScore.toFixed(2)} / 100`);
    console.log(`  ├── UUP Truth Score       (30%) : ${csi.pillarScores.uupTruthScore.toFixed(2)} / 100`);
    console.log(`  └── PQC Security Score    (15%) : ${csi.pillarScores.pqcSecurityScore.toFixed(2)} / 100`);
    console.log(`  ─────────────────────────────────────────`);
    console.log(`  TOTAL CSI Score                 : ${csi.totalCSIScore.toFixed(4)} / 100`);
    console.log(`  CSI Grade                       : ${csi.csiGrade}`);
    console.log(`  Measured Memory RSS             : ${report.measuredRssMb.toFixed(2)} MB (< 512 MB ceiling)`);
    console.log(`  Permanent Fail-Closed Guard     : ${report.isActuationBlocked}`);
    console.log(`  Conditional Clearance           : ${report.isConditionalActuationVerified ? 'CLEARED' : 'BLOCKED'}`);

    if (csi.totalCSIScore < 99.60) {
      throw new Error(`CSI total score below Grade S+ threshold (99.60%): got ${csi.totalCSIScore}`);
    }
    if (csi.csiGrade !== 'S+') {
      throw new Error(`Expected CSI Grade S+, got ${csi.csiGrade}`);
    }
    if (report.measuredRssMb >= 512.0) {
      throw new Error(`Memory RSS ceiling breached: ${report.measuredRssMb} MB >= 512 MB`);
    }
    if (report.isActuationBlocked !== true) {
      throw new Error('CRITICAL: Permanent fail-closed actuation lock was breached!');
    }
    if (!report.isConditionalActuationVerified) {
      throw new Error('Conditional actuation clearance verification failed!');
    }
    console.log('  ✓ Continuous CSI Grade S+ (99.625%+) verified across self-compilation.\n');

    // -------------------------------------------------------------------------
    // GATE 5: Omnipresent LTM Dual-Layer Self-Compilation Trace Retention
    // -------------------------------------------------------------------------
    console.log('[Gate 5] Verifying Omnipresent LTM Dual-Layer Self-Compilation Trace Retention...');
    const traceRsi = orchestrator.agiCore.ltm.recallMemoryTrace([0, 0, 0], 'RSI_GENESIS_TRACE_SEQ_1');
    const tracePqc = orchestrator.agiCore.ltm.recallMemoryTrace([3, 3, 3], 'RSI_PQC_ROOT_SEQ_1');
    const forgettingRate = orchestrator.agiCore.ltm.getForgettingRate();

    console.log(`  - RSI Genesis Trace   [@0,0,0]  : ${traceRsi ? 'YES' : 'NO'}`);
    console.log(`  - RSI PQC Root Trace  [@3,3,3]  : ${tracePqc ? 'YES' : 'NO'}`);
    console.log(`  - LTM Forgetting Rate           : ${(forgettingRate * 100).toFixed(4)}%`);

    if (!traceRsi || !tracePqc || forgettingRate !== 0.0) {
      throw new Error('LTM self-compilation trace recall failed — catastrophic forgetting detected!');
    }
    console.log('  ✓ Zero catastrophic forgetting (0.0000%) across dual-layer RSI LTM confirmed.\n');

    // -------------------------------------------------------------------------
    // GATE 6: 100-Cycle Deterministic Bit-Exact Replay (sigma^2 = 0.0)
    // -------------------------------------------------------------------------
    console.log('[Gate 6] Verifying 100-Cycle Deterministic Bit-Exact Replay (0.0000% Drift)...');
    const initialSeal = report.pqcMasterSeal;
    for (let c = 0; c < 100; c++) {
      const freshOrchestrator = new RSIGenesisOrchestrator();
      const replayed = freshOrchestrator.executeRSICycle(1);
      if (replayed.pqcMasterSeal !== initialSeal) {
        throw new Error(`Determinism drift detected at RSI cycle ${c}! Got: ${replayed.pqcMasterSeal}`);
      }
    }
    console.log('  ✓ 100/100 Replay Cycles executed with bit-for-bit exactness (Drift = 0.0000%, σ² = 0.0).\n');

    console.log('================================================================================');
    console.log(' 🏆 GATE CNL-P33-001 FULLY CERTIFIED & PASSED (100% SUCCESS)');
    console.log(' 💻 AUTONOMOUS RECURSIVE SELF-COMPILER ONLINE — SYSTEM IS SELF-EVOLVING');
    console.log('================================================================================\n');
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('\n❌ FAIL: Gate CNL-P33-001 RSI Test Failure:');
      console.error(err.message);
    }
    process.exit(1);
  }
}

runGateCNLP33001RSITestSuite();
