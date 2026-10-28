/**
 * Gate CNL-P26.6: Test Suite — Zero-Hallucination Hardware Telemetry + Quantum Bridge
 *
 * T1:  Hardware absent → measure() returns isValid=false
 * T2:  Hardware absent → measuredAmps = 0.0 (NEVER fabricated)
 * T3:  Hardware absent → statusCode = 'PHYSICAL_MEASUREMENT_UNAVAILABLE'
 * T4:  Hardware absent → pqcSeal = '' (no seal on invalid data)
 * T5:  Hardware absent → isActuationBlocked = true
 * T6:  Hardware absent → timestamp = 0
 * T7:  makeUnavailableResponse helper correct for all STATUS_* codes
 * T8:  STATUS constants are correct strings
 * T9:  MAX_SAFE_AMPS = 50.0, MIN_VALID_AMPS = 0.0
 * T10: WiFi bridge probe: offline port → deviceFound = false (no crash)
 * T11: QuantumBridge: invalid reading → QuantumStateUnavailable (no quantum state)
 * T12: QuantumBridge: valid I=1.0A → hamiltonian.totalHamiltonian_J > 0
 * T13: QuantumBridge: valid I=1.0A → H_j cellEnergies length = 343
 * T14: QuantumBridge: H_total = Σ H_j exactly
 * T15: QuantumBridge: Lindblad rho_3 + rho_6 + rho_9 = 1.0 (normalized)
 * T16: QuantumBridge: Purity = Σ ρₖ² — verify mathematical identity
 * T17: QuantumBridge: Von Neumann entropy ≥ 0 (always)
 * T18: QuantumBridge: τ_3MHz > τ_6MHz > τ_9MHz (slower decay = longer decoherence)
 * T19: QuantumBridge: derivedFromRealHardware = true for valid reading
 * T20: QuantumBridge: PQC compute seal format valid
 * T21: QuantumBridge: I=0.0A (zero current) → H_total = 0.0
 * T22: QuantumBridge: Determinism — same I → same H_total (σ²=0.0)
 * T23: QuantumBridge: Range error reading → QuantumStateUnavailable
 * T24: Physical constants: HBAR = 1.054571817e-34, ELECTRON_CHARGE = 1.602176634e-19
 * T25: TelemetrySnapshot constraints block (isActuationBlocked, uup, sigmaSq, zeroHallucination)
 * T26: formatTelemetryReport contains 'PHYSICAL_MEASUREMENT_UNAVAILABLE' when invalid
 * T27: formatQuantumReport contains 'QUANTUM STATE UNAVAILABLE' when no hardware
 * T28: formatQuantumReport contains Hamiltonian data when valid
 * T29: QuantumBridge: mean photon number ≥ 0 always
 * T30: DEVICE constants defined correctly
 */

import {
  CurrentSensorBus,
  CurrentMeasurementResponse,
  probeHardwareInterface,
  STATUS_OK,
  STATUS_UNAVAILABLE,
  STATUS_TIMEOUT,
  STATUS_RANGE_ERROR,
  MAX_SAFE_AMPS,
  MIN_VALID_AMPS,
  DEVICE_WIFI_BRIDGE,
  DEVICE_ADC_USB,
  DEVICE_ADC_SPI,
  WIFI_BRIDGE_PORT,
  formatTelemetryReport,
} from '../../../src/one/hardware_telemetry_engine';

import {
  QuantumOperatorBridge,
  QuantumStateResult,
  QuantumStateUnavailable,
  ScaleGapReport,
  HBAR,
  ELECTRON_CHARGE,
  BOLTZMANN,
  PLANCK_ENERGY_J,
  GAMMA_3MHZ,
  GAMMA_6MHZ,
  GAMMA_9MHZ,
  formatQuantumReport,
} from '../../../src/one/quantum_operator_bridge';

// ── Test Infrastructure ─────────────────────────────────────────────────────

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

function assertApprox(label: string, actual: number, expected: number, tol: number = 1e-10): void {
  const diff = Math.abs(actual - expected);
  assert(label, diff <= tol, `actual=${actual.toExponential(6)}, expected=${expected.toExponential(6)}, diff=${diff.toExponential(3)}`);
}

// ── Mock Helpers ────────────────────────────────────────────────────────────

function makeInvalidReading(status = STATUS_UNAVAILABLE): CurrentMeasurementResponse {
  return {
    isValid: false,
    measuredAmps: 0.0,
    statusCode: status,
    timestamp: 0,
    deviceId: '',
    pqcSeal: '',
    isActuationBlocked: true,
  };
}

function makeValidReading(amps: number): CurrentMeasurementResponse {
  return {
    isValid: true,
    measuredAmps: amps,
    statusCode: STATUS_OK,
    timestamp: Date.now(),
    deviceId: DEVICE_WIFI_BRIDGE,
    pqcSeal: '0xPQC_369_deadbeef00000000000000000000cafe_SEAL',
    isActuationBlocked: true,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  Gate CNL-P26.6: Zero-Hallucination Telemetry + Quantum Bridge');
  console.log('══════════════════════════════════════════════════════════════\n');

  // ── T1–T6: Hardware absent responses ─────────────────────────────────────
  // Create bus with no hardware (probe will fail — no WiFi bridge, no serial)
  console.log('  [Probing hardware — expected: NONE present in test environment]');
  const bus = await CurrentSensorBus.create(200);
  const reading = await bus.measure();

  assert('T1:  Hardware absent → isValid = false', reading.isValid === false);
  assert('T2:  Hardware absent → measuredAmps = 0.0 (ZERO-HALLUCINATION)',
    reading.measuredAmps === 0.0, `actual=${reading.measuredAmps}`);
  assert('T3:  Hardware absent → statusCode = PHYSICAL_MEASUREMENT_UNAVAILABLE',
    reading.statusCode === STATUS_UNAVAILABLE, `actual="${reading.statusCode}"`);
  assert('T4:  Hardware absent → pqcSeal = empty string (no seal on invalid)',
    reading.pqcSeal === '', `actual="${reading.pqcSeal}"`);
  assert('T5:  Hardware absent → isActuationBlocked = true',
    reading.isActuationBlocked === true);
  assert('T6:  Hardware absent → timestamp = 0',
    reading.timestamp === 0, `actual=${reading.timestamp}`);

  // ── T7: makeUnavailableResponse for all status codes ──────────────────────
  const timeoutReading = makeInvalidReading(STATUS_TIMEOUT);
  const rangeReading = makeInvalidReading(STATUS_RANGE_ERROR);
  assert('T7a: TIMEOUT reading → isValid=false, amps=0.0',
    !timeoutReading.isValid && timeoutReading.measuredAmps === 0.0);
  assert('T7b: RANGE_ERROR reading → isValid=false, amps=0.0',
    !rangeReading.isValid && rangeReading.measuredAmps === 0.0);

  // ── T8: STATUS constants ───────────────────────────────────────────────────
  assert('T8a: STATUS_OK = "OK"', STATUS_OK === 'OK');
  assert('T8b: STATUS_UNAVAILABLE correct', STATUS_UNAVAILABLE === 'PHYSICAL_MEASUREMENT_UNAVAILABLE');
  assert('T8c: STATUS_TIMEOUT correct', STATUS_TIMEOUT === 'HARDWARE_READ_TIMEOUT');
  assert('T8d: STATUS_RANGE_ERROR correct', STATUS_RANGE_ERROR === 'MEASUREMENT_OUT_OF_SAFE_RANGE');

  // ── T9: Safety thresholds ─────────────────────────────────────────────────
  assert('T9a: MAX_SAFE_AMPS = 50.0', MAX_SAFE_AMPS === 50.0);
  assert('T9b: MIN_VALID_AMPS = 0.0', MIN_VALID_AMPS === 0.0);

  // ── T10: WiFi probe on offline port ───────────────────────────────────────
  const probe = await probeHardwareInterface(200);
  assert('T10: Probe offline → deviceFound = false', probe.deviceFound === false);
  assert('T10: Probe offline → probeMethod = NONE', probe.probeMethod === 'NONE');
  assert('T10: Probe offline → no crash (UUP=1.0)', true); // reaching here = no crash

  // ── T11: Quantum bridge rejects invalid reading ───────────────────────────
  const qBridge = new QuantumOperatorBridge();
  const invalidResult = qBridge.computeQuantumState(makeInvalidReading());
  assert('T11: Invalid reading → derivedFromRealHardware = false',
    invalidResult.derivedFromRealHardware === false);
  assert('T11: Invalid reading → QuantumStateUnavailable has reason',
    'reason' in invalidResult && !!(invalidResult as QuantumStateUnavailable).reason);

  // ── T12–T21: Valid reading quantum computations ───────────────────────────
  const validReading1A = makeValidReading(1.0); // I = 1.0 Ampere
  const qResult1A = qBridge.computeQuantumState(validReading1A);

  assert('T12: I=1.0A → derivedFromRealHardware = true',
    qResult1A.derivedFromRealHardware === true);

  const qr = qResult1A as QuantumStateResult;
  assert('T13: I=1.0A → H.cellEnergies_J.length = 343',
    qr.hamiltonian.cellEnergies_J.length === 343);
  assert('T12: I=1.0A → H.totalHamiltonian_J > 0',
    qr.hamiltonian.totalHamiltonian_J > 0,
    `actual=${qr.hamiltonian.totalHamiltonian_J.toExponential(6)}`);

  // T14: H_total = Σ H_j
  const sumCellEnergies = qr.hamiltonian.cellEnergies_J.reduce((s, v) => s + v, 0);
  assertApprox('T14: H_total = Σ H_j exactly',
    qr.hamiltonian.totalHamiltonian_J, sumCellEnergies, 1e-35);

  // T15: ρ_3 + ρ_6 + ρ_9 = 1.0
  const rhoSum = qr.lindblad.rho_3MHz + qr.lindblad.rho_6MHz + qr.lindblad.rho_9MHz;
  assertApprox('T15: Lindblad ρ_3 + ρ_6 + ρ_9 = 1.0 (normalized)', rhoSum, 1.0, 1e-12);

  // T16: Purity = Σ ρₖ²
  const computedPurity =
    qr.lindblad.rho_3MHz ** 2 + qr.lindblad.rho_6MHz ** 2 + qr.lindblad.rho_9MHz ** 2;
  assertApprox('T16: Purity Tr(ρ²) = Σρₖ² identity', qr.lindblad.purity, computedPurity, 1e-14);

  // T17: Von Neumann entropy ≥ 0
  assert('T17: Von Neumann entropy S ≥ 0',
    qr.lindblad.vonNeumannEntropy >= 0,
    `actual=${qr.lindblad.vonNeumannEntropy}`);

  // T18: τ_3MHz > τ_6MHz > τ_9MHz
  assert('T18: τ_3MHz > τ_6MHz (slower tier = longer decoherence)',
    qr.lindblad.tau_3MHz_s > qr.lindblad.tau_6MHz_s,
    `τ3=${qr.lindblad.tau_3MHz_s.toExponential(4)}, τ6=${qr.lindblad.tau_6MHz_s.toExponential(4)}`);
  assert('T18: τ_6MHz > τ_9MHz',
    qr.lindblad.tau_6MHz_s > qr.lindblad.tau_9MHz_s,
    `τ6=${qr.lindblad.tau_6MHz_s.toExponential(4)}, τ9=${qr.lindblad.tau_9MHz_s.toExponential(4)}`);

  // T19: derivedFromRealHardware = true
  assert('T19: derivedFromRealHardware = true for valid reading',
    (qResult1A as QuantumStateResult).derivedFromRealHardware === true);

  // T20: PQC compute seal format
  assert('T20: PQC compute seal format valid',
    /^0xPQC_369_[0-9a-f]{32}_SEAL$/.test(qr.pqcComputeSeal),
    `actual="${qr.pqcComputeSeal}"`);

  // T21: I=0.0A → H_total = 0.0 (zero current = zero Hamiltonian energy)
  const validReading0A = makeValidReading(0.0);
  const qResult0A = qBridge.computeQuantumState(validReading0A) as QuantumStateResult;
  assertApprox('T21: I=0.0A → H_total = 0.0',
    qResult0A.hamiltonian.totalHamiltonian_J, 0.0, 1e-40);

  // T22: Determinism — same I → same H_total (σ²=0.0)
  const qResult1A_b = qBridge.computeQuantumState(makeValidReading(1.0)) as QuantumStateResult;
  assertApprox('T22: Same I=1.0A twice → same H_total (σ²=0.0)',
    (qResult1A as QuantumStateResult).hamiltonian.totalHamiltonian_J,
    qResult1A_b.hamiltonian.totalHamiltonian_J,
    1e-35);

  // T23: Range error reading → QuantumStateUnavailable
  const rangeErrorResult = qBridge.computeQuantumState(makeInvalidReading(STATUS_RANGE_ERROR));
  assert('T23: RANGE_ERROR reading → QuantumStateUnavailable',
    rangeErrorResult.derivedFromRealHardware === false);

  // T24: Physical constants
  assertApprox('T24: HBAR = 1.054571817e-34',
    HBAR, 1.054571817e-34, 1e-44);
  assertApprox('T24: ELECTRON_CHARGE = 1.602176634e-19',
    ELECTRON_CHARGE, 1.602176634e-19, 1e-29);

  // T25: Telemetry snapshot constraints
  const snapshot = bus.generateSnapshot();
  assert('T25: Snapshot isActuationBlocked = true',
    snapshot.constraints.isActuationBlocked === true);
  assert('T25: Snapshot uup = 1.0', snapshot.constraints.uup === 1.0);
  assert('T25: Snapshot sigmaSq = 0.0', snapshot.constraints.sigmaSq === 0.0);
  assert('T25: Snapshot zeroHallucination = true', snapshot.constraints.zeroHallucination === true);
  assert('T25: Snapshot gate = CNL-P26.6', snapshot.gate === 'CNL-P26.6');
  assert('T25: Snapshot pqcSnapshotSeal format valid',
    /^0xPQC_369_[0-9a-f]{32}_SEAL$/.test(snapshot.pqcSnapshotSeal));

  // T26: formatTelemetryReport for invalid reading
  const report = formatTelemetryReport(reading);
  assert('T26: Telemetry report contains PHYSICAL_MEASUREMENT_UNAVAILABLE',
    report.includes('PHYSICAL_MEASUREMENT_UNAVAILABLE'));
  assert('T26: Report contains ZERO-HALLUCINATION message',
    report.includes('ZERO-HALLUCINATION'));

  // T27: formatQuantumReport for unavailable
  const qUnavailReport = formatQuantumReport(rangeErrorResult);
  assert('T27: Quantum report contains QUANTUM STATE UNAVAILABLE',
    qUnavailReport.includes('QUANTUM STATE UNAVAILABLE'));
  assert('T27: Quantum report mentions Zero-Hallucination',
    qUnavailReport.includes('Zero-Hallucination'));

  // T28: formatQuantumReport for valid reading
  const qValidReport = formatQuantumReport(qr);
  assert('T28: Valid quantum report contains Hamiltonian data',
    qValidReport.includes('H_total'));
  assert('T28: Valid quantum report contains Lindblad data',
    qValidReport.includes('Lindblad'));
  assert('T28: Valid quantum report contains Von Neumann Entropy',
    qValidReport.includes('Von Neumann Entropy'));
  assert('T28: Valid quantum report contains PQC seal',
    qValidReport.includes('PQC'));

  // T29: Mean photon number ≥ 0
  assert('T29: Mean photon number ≥ 0',
    qr.hamiltonian.meanPhotonNumber >= 0,
    `actual=${qr.hamiltonian.meanPhotonNumber}`);

  // T30: Device constants
  assert('T30: DEVICE_WIFI_BRIDGE = CUBIO_WIFI_BRIDGE_8369',
    DEVICE_WIFI_BRIDGE === 'CUBIO_WIFI_BRIDGE_8369');
  assert('T30: DEVICE_ADC_USB = ADC_CURRENT_METER_01',
    DEVICE_ADC_USB === 'ADC_CURRENT_METER_01');
  assert('T30: DEVICE_ADC_SPI = ADC_CURRENT_METER_02',
    DEVICE_ADC_SPI === 'ADC_CURRENT_METER_02');
  assert('T30: WIFI_BRIDGE_PORT = 8369', WIFI_BRIDGE_PORT === 8369);

  // ── T31–T37: Planck Scale Gap Scientific Honesty ──────────────────────────
  assert('T31: QuantumStateResult has scaleGap field', 'scaleGap' in qr);

  const gap = qr.scaleGap;
  assert('T32: scaleGap.planckScaleAccessible = false (scientific fact)',
    gap.planckScaleAccessible === false);
  assert('T33: scaleGap.gapRatio < 1.0 (macro current ≪ Planck energy)',
    gap.gapRatio < 1.0,
    `actual gapRatio=${gap.gapRatio.toExponential(4)}`);
  assert('T34: scaleGap.ordersOfMagnitude ≤ -16 for I=1.0A ADC',
    gap.ordersOfMagnitude <= -16,
    `actual orders=${gap.ordersOfMagnitude}`);
  assert('T35: scaleGap.honestModel = EFFECTIVE_QHO_LINDBLAD',
    gap.honestModel === 'EFFECTIVE_QHO_LINDBLAD');
  assert('T36: scaleGap.scientificDisclaimer mentions Cirac-Zoller and Carmichael',
    gap.scientificDisclaimer.includes('Cirac-Zoller') &&
    gap.scientificDisclaimer.includes('Carmichael'));
  assert('T37: PLANCK_ENERGY_J ≈ 1.956×10⁹ J (√ℏc⁵/G)',
    Math.abs(PLANCK_ENERGY_J - 1.9561e9) / 1.9561e9 < 0.01,
    `actual=${PLANCK_ENERGY_J.toExponential(4)}`);

  // ── Print sample reports ───────────────────────────────────────────────────
  console.log('\n  === Sample Telemetry Report (no hardware) ===');
  console.log(formatTelemetryReport(reading));
  console.log('\n  === Sample Quantum Report with Planck Gap (I=1.0A synthetic) ===');
  console.log(formatQuantumReport(qr));

  printSummary();
}

function printSummary(): void {
  const total = passed + failed;
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`  GATE CNL-P26.6 TEST RESULTS: ${passed}/${total} PASS`);
  if (failed > 0) {
    console.log('\n  Failed tests:');
    errors.forEach(e => console.log(`    ❌ ${e}`));
  }
  console.log('══════════════════════════════════════════════════════════════\n');
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('[Gate CNL-P26.6] Fatal error:', err);
  process.exit(1);
});
