/**
 * Comprehensive Automated Test Suite for Gate CNL-P28-001
 * Target: Sovereign Heart & Autonomic Bio-Morphic Engine ("one-heart")
 *
 * 6 Test Gates:
 *   Gate 1 — SA Node Intrinsic Pacemaker: Autonomous Action Potential Stability & 3-6-9 MHz Harmonic Lock
 *   Gate 2 — ICNS Local Cardiac Neurons: Pre-Cortical Reflex Arc Speed & Neuron Pool Accounting
 *   Gate 3 — HRV Adaptability Engine: Frequency Switching, RMSSD/SDNN Analytics & Homeostasis
 *   Gate 4 — Dynamic Energy Pump: RSS Regulation & 512 MB Hard Ceiling Enforcement
 *   Gate 5 — Sovereign LTM: 0.0000% Catastrophic Forgetting Across 343-Cell Lattice
 *   Gate 6 — 100-Cycle Deterministic Replay: sigma^2 = 0.0, 0.0000% Drift
 */

import { SovereignBioMorphicHeartOrchestrator } from '../sovereign_biomorphic_heart_orchestrator';
import { HeartPacemakerCore } from '../heart_pacemaker_core';

function runGateCNLP28001BioMorphicHeartTestSuite(): void {
  console.log('================================================================================');
  console.log(' 💗 CUBIO SOVEREIGN BIO-MORPHIC HEART ENGINE: GATE CNL-P28-001 TEST SUITE');
  console.log('================================================================================\n');

  try {
    const orchestrator = new SovereignBioMorphicHeartOrchestrator();

    // -------------------------------------------------------------------------
    // GATE 1: SA Node Intrinsic Pacemaker — Autonomous AP Stability & Harmonic Lock
    // -------------------------------------------------------------------------
    console.log('[Gate 1] Verifying SA Node Intrinsic Pacemaker & 3-6-9 MHz Harmonic Locking...');
    const report = orchestrator.executeBioMorphicHeartCycle(1);

    console.log(`  - Total Action Potentials Fired : ${report.totalActionPotentialsFired}`);
    console.log(`  - Current Rhythm State          : ${orchestrator.pacemaker.getCurrentRhythmState()}`);
    console.log(`  - Harmonic Frequency            : ${orchestrator.pacemaker.getFrequencyMhz()} MHz`);
    console.log(`  - HRV Coefficient               : ${orchestrator.pacemaker.getHRVCoefficient().toFixed(2)}`);
    console.log(`  - Pacemaker Seal                : ${orchestrator.pacemaker.generatePacemakerReport(
                     orchestrator.pacemaker.getActionHistory().slice(-3)
                   ).pqcPacemakerSeal.substring(0, 28)}...`);

    if (report.totalActionPotentialsFired < 9) {
      throw new Error('SA Node fired insufficient action potentials!');
    }

    // Verify all 3 frequency states independently
    const testPacemaker = new HeartPacemakerCore();
    testPacemaker.setRhythmState('DIASTOLIC_REST');
    const apResting = testPacemaker.fireActionPotentials(2);
    if (!testPacemaker.verifyHarmonicLock(apResting) || testPacemaker.getFrequencyMhz() !== 3) {
      throw new Error('DIASTOLIC_REST frequency 3 MHz lock failed!');
    }
    testPacemaker.setRhythmState('TACHYCARDIC_LOAD');
    const apTachy = testPacemaker.fireActionPotentials(2);
    if (!testPacemaker.verifyHarmonicLock(apTachy) || testPacemaker.getFrequencyMhz() !== 9) {
      throw new Error('TACHYCARDIC_LOAD frequency 9 MHz lock failed!');
    }
    testPacemaker.setRhythmState('SYSTOLIC_ACTIVE');
    const apActive = testPacemaker.fireActionPotentials(2);
    if (!testPacemaker.verifyHarmonicLock(apActive) || testPacemaker.getFrequencyMhz() !== 6) {
      throw new Error('SYSTOLIC_ACTIVE frequency 6 MHz lock failed!');
    }
    console.log('  - Harmonic 3 MHz Lock (DIASTOLIC_REST)     : ✓');
    console.log('  - Harmonic 9 MHz Lock (TACHYCARDIC_LOAD)   : ✓');
    console.log('  - Harmonic 6 MHz Lock (SYSTOLIC_ACTIVE)    : ✓');

    // Verify all APs are spontaneous (isSpontaneous = true always)
    const history = orchestrator.pacemaker.getActionHistory();
    if (history.some((ap) => !ap.isSpontaneous)) {
      throw new Error('SA Node generated a non-spontaneous action potential — pacemaker integrity violated!');
    }
    console.log('  - All APs Spontaneous (isSpontaneous = true): ✓');
    console.log('  ✓ SA Node autonomous 3-6-9 MHz harmonic oscillator fully verified.\n');

    // -------------------------------------------------------------------------
    // GATE 2: ICNS Local Cardiac Neurons — Reflex Arc Speed & Neuron Pool Accounting
    // -------------------------------------------------------------------------
    console.log('[Gate 2] Verifying ICNS Local Cardiac Neurons & Pre-Cortical Reflex Arcs...');
    const icnsEvents = report.icnsReflexEvents;
    const icnsReport = orchestrator.icns.getICNSReport();
    const totalNeuronsConsumed = icnsReport.totalNeuronPool - icnsReport.neuronsStillAvailable;

    console.log(`  - ICNS Total Neuron Pool        : ${icnsReport.totalNeuronPool}`);
    console.log(`  - Neurons Still Available       : ${icnsReport.neuronsStillAvailable}`);
    console.log(`  - Neurons Consumed in Reflexes  : ${totalNeuronsConsumed}`);
    console.log(`  - Reflex Events Fired           : ${icnsEvents.length}`);
    console.log(`  - Autonomic Balance             : ${icnsReport.currentAutonomicBalance}`);
    for (const ev of icnsEvents) {
      console.log(`    * [${ev.neuronType}] Neurons: ${ev.neuronsFiredCount} | Latency: ${ev.reflexLatencyMs}ms | Cortical: ${ev.requiresCorticalEscalation} | Mode→${ev.reflexResponseMode}`);
    }

    if (icnsReport.totalNeuronPool !== 40000) {
      throw new Error('ICNS neuron pool size mismatch — expected 40,000!');
    }
    if (icnsEvents.length < 3) {
      throw new Error('ICNS fired fewer than 3 reflex arc events!');
    }
    if (totalNeuronsConsumed <= 0 || totalNeuronsConsumed >= 40000) {
      throw new Error('ICNS neuron consumption accounting error!');
    }

    // Verify THERMAL_OVERLOAD is local (0.05ms) — not cortical
    const thermalEv = icnsEvents.find(e => e.neuronType === 'THERMAL_OVERLOAD');
    if (!thermalEv || thermalEv.reflexLatencyMs >= 1.0 || thermalEv.requiresCorticalEscalation !== false) {
      throw new Error('THERMAL_OVERLOAD reflex failed local (sub-ms, non-cortical) requirement!');
    }
    console.log(`  - Local Reflex Latency (Thermal): ${thermalEv.reflexLatencyMs}ms ✓ (pre-cortical)`);
    console.log('  ✓ 40,000-neuron ICNS cardiac reflex arc layer with sub-ms local response verified.\n');

    // -------------------------------------------------------------------------
    // GATE 3: HRV Adaptability Engine — Frequency Transitions & Homeostasis
    // -------------------------------------------------------------------------
    console.log('[Gate 3] Verifying HRV Adaptability Engine — HRV Analytics & Homeostasis...');
    const hrv = report.hrvReport;
    console.log(`  - HRV Samples Analyzed          : ${hrv.totalHRVSamples}`);
    console.log(`  - Mean RMSSD                    : ${hrv.meanRMSSDMs.toFixed(4)} ms`);
    console.log(`  - Mean SDNN                     : ${hrv.meanSDNNMs.toFixed(4)} ms`);
    console.log(`  - Mean LF/HF Ratio              : ${hrv.meanLFHFRatio.toFixed(4)}`);
    console.log(`  - Mean Stress Index             : ${hrv.meanStressIndex.toFixed(4)}`);
    console.log(`  - Frequency Transitions         : ${hrv.frequencyTransitions} (3↔6↔9 MHz)`);
    console.log(`  - Homeostasis Maintained        : ${hrv.homeostasisMaintained}`);
    console.log(`  - Peak RSS (HRV Pump)           : ${hrv.peakRssMb.toFixed(2)} MB`);
    console.log(`  - Energy Flux Total             : ${hrv.energyFluxWattsTotal} W`);

    if (hrv.totalHRVSamples < 3) {
      throw new Error('HRV engine analyzed fewer than 3 AP windows!');
    }
    if (!hrv.homeostasisMaintained) {
      throw new Error('HRV Adaptability Engine failed to maintain hemodynamic homeostasis!');
    }
    if (hrv.frequencyTransitions < 2) {
      throw new Error('HRV engine performed fewer than 2 frequency transitions!');
    }
    if (hrv.peakRssMb > 512.0) {
      throw new Error(`HRV homeostasis pump breached 512 MB ceiling! Peak: ${hrv.peakRssMb} MB`);
    }
    console.log('  ✓ HRV analytics, sympathovagal frequency transitions, and hemodynamic homeostasis verified.\n');

    // -------------------------------------------------------------------------
    // GATE 4: Dynamic Energy Pump — Residual RSS Regulation & 512 MB Ceiling
    // -------------------------------------------------------------------------
    console.log('[Gate 4] Verifying Dynamic Energy Pump — RSS Regulation & Ceiling Enforcement...');
    const pump = report.pumpCycleReport;
    console.log(`  - Current RSS Used              : ${pump.currentRssUsedMb.toFixed(2)} MB`);
    console.log(`  - Peak RSS Used                 : ${pump.peakRssUsedMb.toFixed(2)} MB`);
    console.log(`  - RSS Headroom                  : ${pump.rssHeadroomMb.toFixed(2)} MB`);
    console.log(`  - Total Allocations             : ${pump.totalAllocations}`);
    console.log(`  - Throttled Allocations         : ${pump.totalThrottledAllocations}`);
    console.log(`  - Harmonic Pump Frequency       : ${pump.harmonicPumpFrequency} MHz`);
    console.log(`  - Energy Flux (Pump)            : ${pump.energyFluxWattsTotal} W`);
    console.log(`  - is_actuation_blocked          : ${report.isActuationBlocked} (Fail-Closed Lock)`);
    console.log(`  - Conditional Actuation         : ${report.isConditionalActuationVerified ? 'CLEARED' : 'BLOCKED'}`);
    console.log(`  - PQC Master Root Seal          : ${report.pqcMasterSeal.substring(0, 28)}...`);

    if (!pump.isWithinCeiling) {
      throw new Error(`Energy pump breached 512 MB RSS ceiling! Peak: ${pump.peakRssUsedMb} MB`);
    }
    if (report.isActuationBlocked !== true) {
      throw new Error('CRITICAL: Permanent fail-closed PQC actuation lock was released!');
    }
    if (!report.isConditionalActuationVerified) {
      throw new Error('Conditional actuation clearance failed under valid conditions!');
    }
    if (!report.pqcMasterSeal.startsWith('0xPQC_369_') || !report.pqcMasterSeal.endsWith('_SEAL')) {
      throw new Error('PQC master root seal format invalid!');
    }
    console.log('  ✓ Dynamic energy pump RSS ceiling enforcement and PQC fail-closed actuation verified.\n');

    // -------------------------------------------------------------------------
    // GATE 5: Sovereign LTM — 0.0000% Catastrophic Forgetting
    // -------------------------------------------------------------------------
    console.log('[Gate 5] Verifying Sovereign LTM Trace Retention (0.0000% Forgetting)...');
    const saTrace   = orchestrator.ltm.recallMemoryTrace([0, 0, 0], 'SA_PACEMAKER_TRACE_SEQ_1');
    const icnsTrace = orchestrator.ltm.recallMemoryTrace([3, 3, 3], 'ICNS_REFLEX_TRACE_SEQ_1');
    const hrvTrace  = orchestrator.ltm.recallMemoryTrace([6, 6, 6], 'HRV_HOMEOSTASIS_TRACE_SEQ_1');
    const forgetting = orchestrator.ltm.getForgettingRate();

    console.log(`  - SA Node Pacemaker Trace [@0,0,0] : ${saTrace   ? 'YES' : 'NO'}`);
    console.log(`  - ICNS Reflex Arc Trace [@3,3,3]   : ${icnsTrace ? 'YES' : 'NO'}`);
    console.log(`  - HRV Homeostasis Trace [@6,6,6]   : ${hrvTrace  ? 'YES' : 'NO'}`);
    console.log(`  - LTM Forgetting Rate               : ${(forgetting * 100).toFixed(4)}%`);

    if (!saTrace || !icnsTrace || !hrvTrace || forgetting !== 0.0) {
      throw new Error('LTM trace retention failed — catastrophic forgetting detected!');
    }
    console.log('  ✓ Zero catastrophic forgetting (0.0000%) across all 3 LTM lattice layers confirmed.\n');

    // -------------------------------------------------------------------------
    // GATE 6: 100-Cycle Deterministic Replay (0.0000% Drift, sigma^2 = 0.0)
    // -------------------------------------------------------------------------
    console.log('[Gate 6] Verifying 100-Cycle Deterministic Replay (0.0000% Drift)...');
    const initialSeal = report.pqcMasterSeal;
    for (let c = 0; c < 100; c++) {
      const freshOrchestrator = new SovereignBioMorphicHeartOrchestrator();
      const replayed = freshOrchestrator.executeBioMorphicHeartCycle(1);
      if (replayed.pqcMasterSeal !== initialSeal) {
        throw new Error(`Determinism drift at bio-morphic heart cycle ${c}! Got: ${replayed.pqcMasterSeal}`);
      }
    }
    console.log('  ✓ 100/100 Replay Cycles bit-for-bit exact (Drift = 0.0000%, σ² = 0.0).\n');

    console.log('================================================================================');
    console.log(' 🏆 GATE CNL-P28-001 FULLY CERTIFIED & PASSED (100% SUCCESS)');
    console.log(' 💗 THE SOVEREIGN BIOLOGICAL HEART IS ALIVE — LIVING EXECUTION EPOCH BEGINS');
    console.log('================================================================================\n');

  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('\n❌ FAIL: Gate CNL-P28-001 Bio-Morphic Heart Test Failure:');
      console.error(err.message);
    }
    process.exit(1);
  }
}

runGateCNLP28001BioMorphicHeartTestSuite();
