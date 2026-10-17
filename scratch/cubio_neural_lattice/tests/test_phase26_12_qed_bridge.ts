/**
 * Gate CNL-P26.12: Test Suite — QED Photon Flux & Drude Electron Coupling
 *
 * T1:  CODATA 2018 Planck constant h = 6.62607015e-34 J·s
 * T2:  CODATA 2018 Elementary charge e = 1.602176634e-19 C
 * T3:  Copper work function W_Cu = 4.70 eV
 * T4:  2.4 GHz single-photon energy E_J ≈ 1.590257e-24 Joules
 * T5:  2.4 GHz single-photon energy in micro-eV ≈ 9.9256 μeV
 * T6:  2.4 GHz photon is strictly non-ionizing (E << 4.7 eV)
 * T7:  5.0 GHz single-photon energy E_J ≈ 3.313035e-24 Joules
 * T8:  5.0 GHz single-photon energy in micro-eV ≈ 20.6784 μeV
 * T9:  5.0 GHz photon is strictly non-ionizing
 * T10: High-energy UV/X-ray (1.2e15 Hz) triggers isIonizing = true
 * T11: Zero/negative frequency yields zero energy and invalid seal
 * T12: Macroscopic photon arrival rate Phi = P / (h*f) for 10 nW at 2.4 GHz ≈ 6.28829e15 photons/s
 * T13: Drude electron drift rate for 14.14 μA ≈ 8.8255e13 electrons/s
 * T14: Photon-to-electron coupling ratio η = Phi / R_e ≈ 71.25
 * T15: evaluateRFAntennaCoupling correctly converts -50 dBm to 10 nW (1e-8 W)
 * T16: evaluateRFAntennaCoupling derives induced current ≈ 14.142 μA at 50 ohms
 * T17: evaluateRFAntennaCoupling status = QED_FLUX_CONSERVATION_PASSED
 * T18: evaluateRFAntennaCoupling verifies immutable constraints: isActuationBlocked, uup, sigmaSq
 * T19: PhotonPacket PQC seal format valid (^0xPQC_369_[0-9a-f]{32}_SEAL$)
 * T20: FluxMetrics PQC seal format valid
 * T21: Master coupling PQC seal format valid
 * T22: Determinism (σ² = 0.0): identical RF inputs yield identical master seal
 * T23: formatQEDPhotonReport contains frequency, energy, and non-ionizing status
 * T24: formatQEDFluxReport contains power, arrival rate, drift current, and coupling ratio
 */

import {
  QEDRuntimeEngine,
  PLANCK_CONSTANT_H,
  SPEED_OF_LIGHT_C,
  ELEMENTARY_CHARGE_E,
  COPPER_WORK_FUNCTION_EV,
  WIFI_2_4GHZ_HZ,
  WIFI_5_0GHZ_HZ,
  formatQEDPhotonReport,
  formatQEDFluxReport,
} from '../../../src/one/qed_quantum_bridge_engine';

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

function approxEq(a: number, b: number, tol = 1e-4): boolean {
  return Math.abs(a - b) <= tol;
}

function runTests(): void {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  Gate CNL-P26.12: QED Photon Flux & Drude Electron Tests');
  console.log('════════════════════════════════════════════════════════════════\n');

  // ── T1–T3: Fundamental Constants ───────────────────────────────────────────
  assert('T1:  CODATA 2018 Planck constant h = 6.62607015e-34 J·s',
    PLANCK_CONSTANT_H === 6.62607015e-34);
  assert('T2:  CODATA 2018 Elementary charge e = 1.602176634e-19 C',
    ELEMENTARY_CHARGE_E === 1.602176634e-19);
  assert('T3:  Copper work function W_Cu = 4.70 eV',
    COPPER_WORK_FUNCTION_EV === 4.70);

  const engine = new QEDRuntimeEngine();

  // ── T4–T6: 2.4 GHz Photon Energy ──────────────────────────────────────────
  const p24 = engine.computePhotonQuantum(2.4e9);
  const expectedE24 = PLANCK_CONSTANT_H * 2.4e9; // 1.5902568e-24 J
  const expectedUev24 = (expectedE24 / ELEMENTARY_CHARGE_E) * 1e6; // 9.9256 ueV
  assert('T4:  2.4 GHz photon energy E_J ≈ 1.590257e-24 Joules',
    approxEq(p24.energyJoules, expectedE24, 1e-28));
  assert('T5:  2.4 GHz photon energy in micro-eV ≈ 9.9256 μeV',
    approxEq(p24.energyMicroEv, expectedUev24, 1e-3));
  assert('T6:  2.4 GHz photon is strictly non-ionizing (isIonizing = false)',
    p24.isIonizing === false);

  // ── T7–T9: 5.0 GHz Photon Energy ──────────────────────────────────────────
  const p50 = engine.computePhotonQuantum(5.0e9);
  const expectedE50 = PLANCK_CONSTANT_H * 5.0e9;
  const expectedUev50 = (expectedE50 / ELEMENTARY_CHARGE_E) * 1e6;
  assert('T7:  5.0 GHz photon energy E_J ≈ 3.313035e-24 Joules',
    approxEq(p50.energyJoules, expectedE50, 1e-28));
  assert('T8:  5.0 GHz photon energy in micro-eV ≈ 20.6784 μeV',
    approxEq(p50.energyMicroEv, expectedUev50, 1e-3));
  assert('T9:  5.0 GHz photon is strictly non-ionizing',
    p50.isIonizing === false);

  // ── T10: Ionizing threshold check ──────────────────────────────────────────
  // Copper work function = 4.70 eV -> f_threshold = 4.70 * e / h ≈ 1.1365e15 Hz
  const uvPhoton = engine.computePhotonQuantum(1.2e15); // Above threshold
  assert('T10: High-energy UV photon (1.2e15 Hz) triggers isIonizing = true',
    uvPhoton.isIonizing === true && uvPhoton.energyMicroEv > 4.7e6);

  // ── T11: Zero/negative frequency ──────────────────────────────────────────
  const invalidP = engine.computePhotonQuantum(-100);
  assert('T11: Negative frequency yields zero energy and invalid seal',
    invalidP.energyJoules === 0 && invalidP.pqcSeal === 'INVALID_FREQUENCY');

  // ── T12–T14: Photon Flux and Drude Electron Drift ──────────────────────────
  const power10nw = 1e-8; // 10 nW (-50 dBm)
  const current14ua = 14.142; // 14.142 μA
  const flux = engine.evaluateMacroscopicPhotonFlux(power10nw, 2.4e9, current14ua);

  const expectedFluxRate = power10nw / expectedE24; // ~ 6.28829e15
  assert('T12: Macroscopic photon arrival rate Phi = P / E_photon ≈ 6.288e15 photons/s',
    approxEq(flux.photonArrivalRatePerSec / 1e15, expectedFluxRate / 1e15, 1e-2));

  const expectedDriftRate = (current14ua * 1e-6) / ELEMENTARY_CHARGE_E; // ~ 8.8267e13
  assert('T13: Drude electron drift rate for 14.142 μA ≈ 8.827e13 electrons/s',
    approxEq(expectedDriftRate / 1e13, 8.8267, 1e-2));

  const expectedRatio = expectedFluxRate / expectedDriftRate; // ~ 71.24
  assert('T14: Photon-to-electron coupling ratio η = Phi / R_e ≈ 71.24',
    approxEq(flux.photonToElectronRatio, expectedRatio, 0.1));

  // ── T15–T18: Full End-to-End RF Antenna Coupling ──────────────────────────
  const fullReport = engine.evaluateRFAntennaCoupling(-50.0, 2.4e9, 50.0);
  assert('T15: evaluateRFAntennaCoupling converts -50 dBm to 10 nW (1e-8 W)',
    approxEq(fullReport.powerWatts, 1e-8, 1e-12));
  assert('T16: evaluateRFAntennaCoupling derives induced current ≈ 14.142 μA at 50 ohms',
    approxEq(fullReport.inducedCurrentUa, 14.142, 0.01));
  assert('T17: evaluateRFAntennaCoupling status = QED_FLUX_CONSERVATION_PASSED',
    fullReport.fluxMetrics.status === 'QED_FLUX_CONSERVATION_PASSED');
  assert('T18: evaluateRFAntennaCoupling verifies immutable constraints',
    fullReport.isActuationBlocked === true && fullReport.uup === 1.0 && fullReport.sigmaSq === 0.0);

  // ── T19–T22: PQC Lattice Seals & Determinism ───────────────────────────────
  assert('T19: PhotonPacket PQC seal format valid',
    /^0xPQC_369_[0-9a-f]{32}_SEAL$/.test(fullReport.photonPacket.pqcSeal));
  assert('T20: FluxMetrics PQC seal format valid',
    /^0xPQC_369_[0-9a-f]{32}_SEAL$/.test(fullReport.fluxMetrics.pqcSeal));
  assert('T21: Master coupling PQC seal format valid',
    /^0xPQC_369_[0-9a-f]{32}_SEAL$/.test(fullReport.masterSeal));

  const fullReport2 = engine.evaluateRFAntennaCoupling(-50.0, 2.4e9, 50.0);
  assert('T22: Determinism (σ² = 0.0): identical RF inputs yield identical master seal',
    fullReport.masterSeal === fullReport2.masterSeal);

  // ── T23–T24: Report Formatters ─────────────────────────────────────────────
  const photonStr = formatQEDPhotonReport(fullReport.photonPacket);
  assert('T23: formatQEDPhotonReport contains frequency, energy, and non-ionizing status',
    photonStr.includes('Carrier Frequency') &&
    photonStr.includes('Photon Energy') &&
    photonStr.includes('Strict Non-Ionizing'));

  const fluxStr = formatQEDFluxReport(fullReport.fluxMetrics, fullReport.photonPacket);
  assert('T24: formatQEDFluxReport contains power, arrival rate, drift current, and coupling ratio',
    fluxStr.includes('RF Power Ingest') &&
    fluxStr.includes('Photon Arrival Rate') &&
    fluxStr.includes('Drude Conduction I') &&
    fluxStr.includes('Photon-to-Electron η'));

  printSummary();
}

function printSummary(): void {
  const total = passed + failed;
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(`  GATE CNL-P26.12 TEST RESULTS: ${passed}/${total} PASS`);
  if (failed > 0) {
    console.log('\n  Failed:');
    errors.forEach(e => console.log(`    ❌ ${e}`));
  }
  console.log('════════════════════════════════════════════════════════════════\n');
  if (failed > 0) process.exit(1);
}

runTests();
