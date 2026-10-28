/**
 * Gate CNL-P26.9: Test Suite — Power Grid Physics (All 4 Equations)
 *
 * Swing Equation (Hantao Cui):
 * T1:  OMEGA_50HZ = 2π·50 ≈ 314.159 rad/s
 * T2:  H_eq=1, Pm=1, Pe=1, D=0 → dω/dt = 0 (balanced system)
 * T3:  H_eq=5, Pm=1.1, Pe=1, D=0.01 → dω/dt = (0.1 - 0.01·Δω) / 10
 * T4:  Euler integration: omega_next correct
 * T5:  delta_next = delta + omega·dt
 * T6:  frequencyHz = omega_next / (2π)
 * T7:  isStable = true when |omega_next - omega0| < π
 * T8:  isStable = false when frequency deviation > 0.5 Hz
 * T9:  H_eq ≤ 0 → isValid = false
 * T10: dt ≤ 0 → isValid = false
 * T11: multi-step simulate() runs without crash
 * T12: PQC seal format valid on swing result
 * T13: Determinism — same inputs → same seal (σ²=0.0)
 *
 * MPPT Inc-Cond (Sangeetha Manickam):
 * T14: V=20, I=5, dV=0.1, dI=-0.05 → ε = dI/dV + I/V
 * T15: At MPP: dI/dV = -I/V → ε = 0 → AT_MPP
 * T16: ε > 0 → INCREASE_V (left of MPP)
 * T17: ε < 0 → DECREASE_V (right of MPP)
 * T18: Power P = V·I correctly computed
 * T19: dP/dV = I + V·(dI/dV) = 0 at MPP
 * T20: V ≤ 0 → isValid = false
 * T21: dV ≈ 0 → isValid = false (steady state)
 * T22: PQC seal format valid on MPPT result
 *
 * DAB Power Formula (Dongsheng Yu):
 * T23: phi=0 → P_DAB = 0, direction=ZERO
 * T24: phi=π/4 → P_DAB = K·(π/4)·(3/4) (forward)
 * T25: phi=-π/4 → P_DAB < 0, direction=REVERSE
 * T26: phi=π/2 → P_DAB = P_max (maximum power)
 * T27: P_max = n·V1·V2·π / (4·ω·L)
 * T28: efficiencyRatio = P_DAB / P_max
 * T29: phi > π/2 → isValid = false (out of range)
 * T30: optimalPhi gives P_DAB ≈ pTarget (round-trip)
 * T31: PQC seal format valid on DAB result
 *
 * Ripple Optimization (Guidong Zhang):
 * T32: N=1 → deltaVoOptimal = deltaVoSingle (no reduction)
 * T33: N=4 → deltaVoOptimal = deltaVoSingle / 4
 * T34: rippleReductionFactor = 1/N
 * T35: optimalPhaseShifts length = N
 * T36: phi_0 = 0 always (reference module)
 * T37: phi_1 = 2π/N for N modules
 * T38: N=3 → phase shifts = [0°, 120°, 240°]
 * T39: N ≤ 0 → isValid = false
 * T40: deltaVoSingle < 0 → isValid = false
 *
 * Combined:
 * T41: PowerGridEvaluator.evaluate() returns all 4 results
 * T42: gate = 'CNL-P26.9'
 * T43: isActuationBlocked = true, uup = 1.0, sigmaSq = 0.0
 * T44: masterSeal format valid
 * T45: formatPowerGridReport contains all 4 equation headers
 */

import {
  SwingEquationEngine,
  MPPTEngine,
  DABPowerEngine,
  RippleOptimizationEngine,
  PowerGridEvaluator,
  formatPowerGridReport,
  OMEGA_50HZ,
  OMEGA_60HZ,
  TWO_PI,
  STABILITY_BAND,
} from '../../../src/one/power_grid_engine';

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

function approxEq(a: number, b: number, tol = 1e-9): boolean {
  return Math.abs(a - b) <= tol;
}

function assertApprox(label: string, actual: number, expected: number, tol = 1e-9): void {
  assert(label, approxEq(actual, expected, tol),
    `actual=${actual.toExponential(8)}, expected=${expected.toExponential(8)}`);
}

// ── Tests ────────────────────────────────────────────────────────────────────

function runTests(): void {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  Gate CNL-P26.9: Power Grid Physics — All 4 Equations');
  console.log('════════════════════════════════════════════════════════════════\n');

  const swing  = new SwingEquationEngine();
  const mppt   = new MPPTEngine();
  const dab    = new DABPowerEngine();
  const ripple = new RippleOptimizationEngine();
  const omega0 = OMEGA_50HZ;  // 2π·50

  // ══════════════════════════════════════════════════════════════
  // SWING EQUATION TESTS (T1-T13)
  // ══════════════════════════════════════════════════════════════
  console.log('\n  ── Swing Equation (Hantao Cui) ─────────────────────────────\n');

  // T1: OMEGA_50HZ
  assertApprox('T1:  OMEGA_50HZ = 2π·50',
    OMEGA_50HZ, TWO_PI * 50, 1e-10);

  // T2: Balanced system: Pm=Pe, D=0 → dω/dt = 0
  const r2 = swing.compute(1, 1.0, 1.0, 0, omega0, 0, omega0, 0.01);
  assertApprox('T2:  Balanced (Pm=Pe, D=0) → dω/dt = 0',
    r2.dOmegaDt, 0.0, 1e-12);
  assert('T2:  Balanced → isValid = true', r2.isValid);

  // T3: H_eq=5, Pm=1.1, Pe=1.0, D=0.01, omega=omega0 → dω/dt
  // Δω = 0 → dω/dt = (1.1 - 1.0 - 0) / (2·5) = 0.1/10 = 0.01
  const r3 = swing.compute(5, 1.1, 1.0, 0.01, omega0, 0, omega0, 0.01);
  const expected_dOmega = (1.1 - 1.0 - 0.01 * 0) / (2 * 5);  // = 0.01 exactly
  assertApprox('T3:  H=5, Pm=1.1, Pe=1, D=0.01 → dω/dt = 0.01',
    r3.dOmegaDt, expected_dOmega, 1e-12);

  // T4: Euler: omega_next = omega + dω/dt · dt
  const omegaExpected = omega0 + expected_dOmega * 0.01;
  assertApprox('T4:  Euler omega_next = omega0 + dω/dt·dt',
    r3.omegaNext, omegaExpected, 1e-12);

  // T5: delta_next = delta + omega·dt
  assertApprox('T5:  delta_next = 0 + omega0 · 0.01',
    r3.deltaNext, omega0 * 0.01, 1e-10);

  // T6: frequencyHz = omega_next / (2π)
  assertApprox('T6:  frequencyHz = omegaNext / 2π',
    r3.frequencyHz, omegaExpected / TWO_PI, 1e-12);

  // T7: Small deviation → isStable = true
  assert('T7:  Small deviation → isStable = true', r3.isStable);

  // T8: Large disturbance → isStable = false
  const r8 = swing.compute(1, 2.0, 0.0, 0, omega0 + 4 * Math.PI, 0, omega0, 0.01);
  // Δω = 4π → very large deviation
  assert('T8:  Large disturbance → isStable = false', !r8.isStable,
    `isStable=${r8.isStable}, Δω=${Math.abs(r8.omegaNext - omega0).toFixed(3)}`);

  // T9: H_eq ≤ 0 → isValid = false
  const r9 = swing.compute(0, 1, 1, 0, omega0, 0, omega0, 0.01);
  assert('T9:  H_eq=0 → isValid = false', !r9.isValid);

  // T10: dt ≤ 0 → isValid = false
  const r10 = swing.compute(1, 1, 1, 0, omega0, 0, omega0, 0);
  assert('T10: dt=0 → isValid = false', !r10.isValid);

  // T11: multi-step simulate
  const pm = Array(10).fill(1.05);
  const pe = Array(10).fill(1.0);
  const sims = swing.simulate(5, 0.01, omega0, 0.01, pm, pe);
  assert('T11: simulate() returns N results',
    sims.length === 10 && sims.every(s => s.isValid));

  // T12: PQC seal format
  assert('T12: Swing PQC seal format valid',
    /^0xPQC_369_[0-9a-f]{32}_SEAL$/.test(r3.pqcSeal));

  // T13: Determinism
  const ra = swing.compute(5, 1.1, 1.0, 0.01, omega0, 0, omega0, 0.01);
  const rb = swing.compute(5, 1.1, 1.0, 0.01, omega0, 0, omega0, 0.01);
  assert('T13: Swing determinism — same inputs → same seal (σ²=0.0)',
    ra.pqcSeal === rb.pqcSeal);

  // ══════════════════════════════════════════════════════════════
  // MPPT TESTS (T14-T22)
  // ══════════════════════════════════════════════════════════════
  console.log('\n  ── Inc-Cond MPPT (Sangeetha Manickam) ───────────────────────\n');

  // T14: ε = dI/dV + I/V for V=20, I=5, dV=0.1, dI=-0.05
  // dI/dV = -0.5, I/V = 0.25 → ε = -0.25 → DECREASE_V
  const m14 = mppt.compute(20, 5, 0.1, -0.05);
  const expectedErr = (-0.05 / 0.1) + (5 / 20);  // = -0.5 + 0.25 = -0.25
  assertApprox('T14: ε = dI/dV + I/V computed correctly',
    m14.mpptError, expectedErr, 1e-12);

  // T15: At MPP: dI = -I·dV/V → dI/dV = -I/V → ε = 0
  // V=20, I=5, dV=0.1 → at MPP: dI = -(5/20)·0.1 = -0.025
  const m15 = mppt.compute(20, 5, 0.1, -0.025);
  assertApprox('T15: At MPP: ε = 0', m15.mpptError, 0.0, 1e-10);
  assert('T15: AT_MPP direction', m15.direction === 'AT_MPP');
  assert('T15: isAtMPP = true', m15.isAtMPP);

  // T16: ε > 0 → INCREASE_V
  // Need dI/dV > -I/V: say dI = 0 (I not decreasing with V) → ε = I/V > 0
  const m16 = mppt.compute(20, 5, 0.1, 0);  // dI=0 → ε = 0 + 5/20 = 0.25 > 0
  assert('T16: ε > 0 → INCREASE_V', m16.direction === 'INCREASE_V');

  // T17: ε < 0 → DECREASE_V (from T14)
  assert('T17: ε < 0 → DECREASE_V', m14.direction === 'DECREASE_V');

  // T18: Power P = V·I
  assertApprox('T18: powerW = V·I = 20·5 = 100 W', m14.powerW, 100.0, 1e-10);

  // T19: dP/dV = I + V·(dI/dV) = 0 at MPP
  assertApprox('T19: dP/dV = 0 at MPP', m15.dPdV, 0.0, 1e-10);

  // T20: V ≤ 0 → isValid = false
  const m20 = mppt.compute(0, 5, 0.1, -0.025);
  assert('T20: V=0 → isValid = false', !m20.isValid);

  // T21: dV ≈ 0 → isValid = false
  const m21 = mppt.compute(20, 5, 0, -0.025);
  assert('T21: dV=0 → isValid = false', !m21.isValid);

  // T22: PQC seal format
  assert('T22: MPPT PQC seal format valid',
    /^0xPQC_369_[0-9a-f]{32}_SEAL$/.test(m15.pqcSeal));

  // ══════════════════════════════════════════════════════════════
  // DAB POWER TESTS (T23-T31)
  // ══════════════════════════════════════════════════════════════
  console.log('\n  ── DAB Power Formula (Dongsheng Yu) ─────────────────────────\n');

  const n=1, V1=400, V2=400, fs=100e3, omegaSw=TWO_PI*fs, L=100e-6;
  const K_dab = (n * V1 * V2) / (omegaSw * L);

  // T23: phi=0 → P_DAB = 0
  const d23 = dab.compute(n, V1, V2, omegaSw, L, 0);
  assertApprox('T23: phi=0 → P_DAB = 0', d23.pDab_W, 0.0, 1e-6);
  assert('T23: phi=0 → direction = ZERO', d23.direction === 'ZERO');

  // T24: phi=π/4 → P_DAB = K·(π/4)·(1 - 1/4) = K·(π/4)·(3/4)
  const phi4 = Math.PI / 4;
  const d24 = dab.compute(n, V1, V2, omegaSw, L, phi4);
  const expectedP24 = K_dab * phi4 * (1 - phi4 / Math.PI);
  assertApprox('T24: phi=π/4 → P_DAB correct', d24.pDab_W, expectedP24, 0.001);
  assert('T24: phi=π/4 → direction = FORWARD', d24.direction === 'FORWARD');

  // T25: phi=-π/4 → P_DAB < 0, direction=REVERSE
  const d25 = dab.compute(n, V1, V2, omegaSw, L, -phi4);
  assert('T25: phi=-π/4 → P_DAB < 0', d25.pDab_W < 0);
  assert('T25: phi=-π/4 → direction = REVERSE', d25.direction === 'REVERSE');

  // T26: phi=π/2 → P_DAB should equal P_max
  const phi2 = Math.PI / 2;
  const d26 = dab.compute(n, V1, V2, omegaSw, L, phi2);
  const expectedPmax = K_dab * Math.PI / 4;
  assertApprox('T26: phi=π/2 → P_DAB = P_max', d26.pDab_W, expectedPmax, 0.001);

  // T27: P_max = n·V1·V2·π / (4·ω·L)
  assertApprox('T27: P_max = n·V1·V2·π/(4·ω·L)',
    d26.pMax_W, expectedPmax, 0.001);

  // T28: efficiencyRatio = P_DAB / P_max
  assertApprox('T28: efficiencyRatio = P_DAB/P_max at φ=π/2 ≈ 1.0',
    d26.efficiencyRatio, 1.0, 0.001);

  // T29: phi > π/2 → isValid = false
  const d29 = dab.compute(n, V1, V2, omegaSw, L, Math.PI);
  assert('T29: phi=π > π/2 → isValid = false', !d29.isValid);

  // T30: optimalPhi round-trip
  const pTarget = expectedPmax * 0.7;
  const optPhi = dab.optimalPhi(pTarget, n, V1, V2, omegaSw, L);
  const d30 = dab.compute(n, V1, V2, omegaSw, L, optPhi);
  assert('T30: optimalPhi round-trip: P_DAB ≈ pTarget',
    approxEq(d30.pDab_W, pTarget, pTarget * 0.01),
    `P_DAB=${d30.pDab_W.toFixed(2)}, pTarget=${pTarget.toFixed(2)}`);

  // T31: PQC seal format
  assert('T31: DAB PQC seal format valid',
    /^0xPQC_369_[0-9a-f]{32}_SEAL$/.test(d24.pqcSeal));

  // ══════════════════════════════════════════════════════════════
  // RIPPLE OPTIMIZATION TESTS (T32-T40)
  // ══════════════════════════════════════════════════════════════
  console.log('\n  ── Ripple Optimization (Guidong Zhang) ──────────────────────\n');

  const deltaVo1 = 0.5;  // 500 mV single-module ripple

  // T32: N=1 → no reduction
  const rp32 = ripple.compute(deltaVo1, 1);
  assertApprox('T32: N=1 → deltaVoOptimal = deltaVoSingle',
    rp32.deltaVoOptimal, deltaVo1, 1e-12);

  // T33: N=4 → ripple / 4
  const rp33 = ripple.compute(deltaVo1, 4);
  assertApprox('T33: N=4 → deltaVoOptimal = deltaVoSingle/4',
    rp33.deltaVoOptimal, deltaVo1 / 4, 1e-12);

  // T34: rippleReductionFactor = 1/N
  assertApprox('T34: rippleReductionFactor = 1/4',
    rp33.rippleReductionFactor, 0.25, 1e-12);

  // T35: phase shifts array length = N
  assert('T35: optimalPhaseShifts.length = N=4',
    rp33.optimalPhaseShifts.length === 4);

  // T36: phi_0 = 0 always
  assertApprox('T36: phi_0 = 0 (reference module)',
    rp33.optimalPhaseShifts[0], 0.0, 1e-12);

  // T37: phi_1 = 2π/N
  assertApprox('T37: phi_1 = 2π/4 = π/2',
    rp33.optimalPhaseShifts[1], TWO_PI / 4, 1e-12);

  // T38: N=3 → phase shifts [0°, 120°, 240°]
  const rp38 = ripple.compute(1.0, 3);
  assertApprox('T38: N=3 phi_0 = 0',   rp38.optimalPhaseShifts[0], 0, 1e-12);
  assertApprox('T38: N=3 phi_1 = 2π/3', rp38.optimalPhaseShifts[1], TWO_PI / 3, 1e-10);
  assertApprox('T38: N=3 phi_2 = 4π/3', rp38.optimalPhaseShifts[2], 4 * Math.PI / 3, 1e-10);

  // T39: N ≤ 0 → isValid = false
  const rp39 = ripple.compute(1.0, 0);
  assert('T39: N=0 → isValid = false', !rp39.isValid);

  // T40: deltaVoSingle < 0 → isValid = false
  const rp40 = ripple.compute(-1.0, 4);
  assert('T40: deltaVoSingle<0 → isValid = false', !rp40.isValid);

  // ══════════════════════════════════════════════════════════════
  // COMBINED EVALUATOR (T41-T45)
  // ══════════════════════════════════════════════════════════════
  console.log('\n  ── Combined PowerGridEvaluator (T41-T45) ────────────────────\n');

  const evaluator = new PowerGridEvaluator();
  const report = evaluator.evaluate({
    H_eq: 5, P_m: 1.05, P_e: 1.0, D: 0.01,
    omega: omega0, delta: 0, omega0, dt: 0.01,
    V: 20, I: 5, dV: 0.1, dI: -0.025,  // at MPP
    n: 1, V1: 400, V2: 400, omegaSw, L,
    phi: Math.PI / 4,
    deltaVoSingle: 0.5, numModules: 4,
  });

  assert('T41: PowerGridEvaluator returns all 4 results',
    'swing' in report && 'mppt' in report && 'dab' in report && 'ripple' in report);
  assert('T42: gate = CNL-P26.9', report.gate === 'CNL-P26.9');
  assert('T43: constraints block correct',
    report.constraints.isActuationBlocked === true &&
    report.constraints.uup === 1.0 &&
    report.constraints.sigmaSq === 0.0 &&
    report.constraints.zeroHallucination === true);
  assert('T44: masterSeal format valid',
    /^0xPQC_369_[0-9a-f]{32}_SEAL$/.test(report.masterSeal));

  const fmt = formatPowerGridReport(report);
  assert('T45: formatPowerGridReport contains all 4 equation headers',
    fmt.includes('Swing Equation') && fmt.includes('MPPT') &&
    fmt.includes('DAB Power') && fmt.includes('Ripple'));

  // ── Sample report ──────────────────────────────────────────────────────────
  console.log('\n  === Sample Power Grid Report ===');
  console.log(formatPowerGridReport(report));

  printSummary();
}

function printSummary(): void {
  const total = passed + failed;
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(`  GATE CNL-P26.9 TEST RESULTS: ${passed}/${total} PASS`);
  if (failed > 0) {
    console.log('\n  Failed:');
    errors.forEach(e => console.log(`    ❌ ${e}`));
  }
  console.log('════════════════════════════════════════════════════════════════\n');
  if (failed > 0) process.exit(1);
}

runTests();
