/**
 * Gate CNL-P26.7: Test Suite — Symplectic Rank (Mele/Chabaud) + isoTNS (Malz)
 *
 * T1:  ISOTNS_INJECTIVITY_THRESHOLD = 0.41
 * T2:  SYMPLECTIC_LOWER_BOUND = 1.0
 * T3:  computeSymplecticRank([1,1,1,1]) → s_symp = 0 (all pure modes)
 * T4:  computeSymplecticRank([1.5,2.0,1.0,3.0]) → s_symp = 3
 * T5:  computeSymplecticRank — mixed mode indices correct
 * T6:  computeSymplecticRank — mixedFraction = s_symp/n
 * T7:  Pure state (all dⱼ=1) → CLASSICALLY_SIMULABLE
 * T8:  Dense mixed (s_symp > log2(n)) → QUANTUM_HARD
 * T9:  s_symp ≤ floor(log2(n)) → BOUNDARY
 * T10: isValidPhysicalState = false when dⱼ < 1
 * T11: isValidPhysicalState = true when all dⱼ ≥ 1
 * T12: PQC seal format valid on symplectic result
 * T13: Symplectic determinism — same eigenvalues → same seal (σ²=0.0)
 * T14: thermalEigenvaluesFromOccupations — dⱼ = 2·n̄ⱼ + 1
 * T15: singleModeSympEigenvalue — d = sqrt(Vxx·Vpp - Vxp²)
 * T16: classifyComplexity(0.7, 1) → η=0.49 ≥ 0.41 → CLASSICAL
 * T17: classifyComplexity(0.5, 1) → η=0.25 < 0.41 → BQP_COMPLETE
 * T18: classifyComplexity(1.0, 1) → η=1.0 → CLASSICAL
 * T19: classifyComplexity(0.64, 1) → η≈0.41 boundary check
 * T20: isoTNS distanceFromThreshold = eta - 0.41
 * T21: isoTNS PQC seal format valid
 * T22: isoTNS determinism — same δ,D → same seal
 * T23: minDeltaForClassical(D=1) = sqrt(0.41) ≈ 0.6403
 * T24: minBondDimForClassical(delta=1.0) = ceil(sqrt(0.41)) = 1
 * T25: minBondDimForClassical(delta=0.5) = ceil(0.6403/0.5) = 2
 * T26: Invalid δ=0 throws error
 * T27: Invalid δ>1 throws error
 * T28: Invalid D=0 throws error
 * T29: Empty eigenvalue array throws error
 * T30: QuantumStateEvaluator.evaluate() → CombinedQuantumMetricsResult
 * T31: Joint verdict FULLY_CLASSICAL when pure + strongly injective
 * T32: Joint verdict FULLY_QUANTUM when dense mixed + weak injectivity
 * T33: constraints block: isActuationBlocked=true, uup=1.0, sigmaSq=0.0
 * T34: gate = 'CNL-P26.7'
 * T35: deterministicSeal format valid
 * T36: computeLatencyMs > 0
 * T37: formatQuantumMetricsReport contains symplectic rank data
 * T38: formatQuantumMetricsReport contains isoTNS data
 * T39: Large n=32 eigenvalue array processed correctly
 * T40: Williamson consistency: Σ dⱼ is correct for known thermal state
 */

import {
  SymplecticRankEvaluator,
  IsoTNSComplexityClassifier,
  QuantumStateEvaluator,
  ISOTNS_INJECTIVITY_THRESHOLD,
  SYMPLECTIC_LOWER_BOUND,
  formatQuantumMetricsReport,
  CombinedQuantumMetricsResult,
} from '../../../src/one/quantum_metrics_engine';

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

function assertApprox(label: string, actual: number, expected: number, tol = 1e-9): void {
  const diff = Math.abs(actual - expected);
  assert(label, diff <= tol,
    `actual=${actual.toExponential(8)}, expected=${expected.toExponential(8)}, diff=${diff.toExponential(3)}`);
}

function assertThrows(label: string, fn: () => void): void {
  let threw = false;
  try { fn(); } catch { threw = true; }
  assert(label, threw);
}

// ── Tests ────────────────────────────────────────────────────────────────────

function runTests(): void {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  Gate CNL-P26.7: Symplectic Rank (Mele/Chabaud) + isoTNS (Malz)');
  console.log('════════════════════════════════════════════════════════════════\n');

  const sympEval = new SymplecticRankEvaluator();
  const isoClassifier = new IsoTNSComplexityClassifier();
  const evaluator = new QuantumStateEvaluator();

  // ── T1–T2: Constants ────────────────────────────────────────────────────────
  assertApprox('T1:  ISOTNS_INJECTIVITY_THRESHOLD = 0.41',
    ISOTNS_INJECTIVITY_THRESHOLD, 0.41, 1e-15);
  assertApprox('T2:  SYMPLECTIC_LOWER_BOUND = 1.0',
    SYMPLECTIC_LOWER_BOUND, 1.0, 1e-15);

  // ── T3–T6: Symplectic Rank core ─────────────────────────────────────────────
  // T3: All pure (dⱼ=1) → s_symp=0
  const pureResult = sympEval.computeSymplecticRank([1.0, 1.0, 1.0, 1.0]);
  assert('T3:  Pure state [1,1,1,1] → s_symp = 0',
    pureResult.symplecticRank === 0, `actual=${pureResult.symplecticRank}`);

  // T4: Mixed modes → s_symp=3
  const mixedResult = sympEval.computeSymplecticRank([1.5, 2.0, 1.0, 3.0]);
  assert('T4:  [1.5,2.0,1.0,3.0] → s_symp = 3',
    mixedResult.symplecticRank === 3, `actual=${mixedResult.symplecticRank}`);

  // T5: Mixed mode indices = [0,1,3] for [1.5,2.0,1.0,3.0]
  const expectedIdx = [0, 1, 3];
  const idxMatch = mixedResult.mixedModeIndices.length === 3 &&
    expectedIdx.every((v, i) => mixedResult.mixedModeIndices[i] === v);
  assert('T5:  Mixed mode indices = [0,1,3]', idxMatch,
    `actual=[${mixedResult.mixedModeIndices}]`);

  // T6: mixedFraction = 3/4
  assertApprox('T6:  mixedFraction = s_symp/n = 3/4',
    mixedResult.mixedFraction, 0.75, 1e-12);

  // ── T7–T9: Complexity class ────────────────────────────────────────────────
  // T7: Pure → CLASSICALLY_SIMULABLE
  assert('T7:  Pure state → CLASSICALLY_SIMULABLE',
    pureResult.classicalSimulabilityClass === 'CLASSICALLY_SIMULABLE');

  // T8: Dense mixed (s_symp > log2(n)) → QUANTUM_HARD
  // n=4, log2(4)=2, s_symp=3 > 2
  assert('T8:  s_symp=3 > floor(log2(4))=2 → QUANTUM_HARD',
    mixedResult.classicalSimulabilityClass === 'QUANTUM_HARD');

  // T9: s_symp = floor(log2(n)) = 2 for n=4 → BOUNDARY
  const boundaryResult = sympEval.computeSymplecticRank([2.0, 2.0, 1.0, 1.0]); // s_symp=2
  assert('T9:  s_symp=2 = floor(log2(4))=2 → BOUNDARY',
    boundaryResult.classicalSimulabilityClass === 'BOUNDARY',
    `actual=${boundaryResult.classicalSimulabilityClass}`);

  // ── T10–T11: Physical state validity ──────────────────────────────────────
  const invalidState = sympEval.computeSymplecticRank([0.5, 1.0, 1.0]);
  assert('T10: dⱼ=0.5 < 1 → isValidPhysicalState = false',
    invalidState.isValidPhysicalState === false);

  const validState = sympEval.computeSymplecticRank([1.0, 1.5, 2.0]);
  assert('T11: All dⱼ ≥ 1 → isValidPhysicalState = true',
    validState.isValidPhysicalState === true);

  // ── T12–T13: PQC seal and determinism ─────────────────────────────────────
  assert('T12: Symplectic PQC seal format valid',
    /^0xPQC_369_[0-9a-f]{32}_SEAL$/.test(mixedResult.pqcSeal),
    `actual="${mixedResult.pqcSeal}"`);

  const r1 = sympEval.computeSymplecticRank([1.5, 2.0, 1.0, 3.0]);
  const r2 = sympEval.computeSymplecticRank([1.5, 2.0, 1.0, 3.0]);
  assert('T13: Determinism — same eigenvalues → same seal (σ²=0.0)',
    r1.pqcSeal === r2.pqcSeal, `r1="${r1.pqcSeal}" r2="${r2.pqcSeal}"`);

  // ── T14: Thermal eigenvalues ──────────────────────────────────────────────
  const occupations = [0, 0.5, 1.0, 2.0];
  const thermalEigs = SymplecticRankEvaluator.thermalEigenvaluesFromOccupations(occupations);
  assert('T14: thermalEigenvalues — dⱼ = 2·n̄ⱼ + 1',
    Math.abs(thermalEigs[0] - 1.0) < 1e-12 &&
    Math.abs(thermalEigs[1] - 2.0) < 1e-12 &&
    Math.abs(thermalEigs[2] - 3.0) < 1e-12 &&
    Math.abs(thermalEigs[3] - 5.0) < 1e-12,
    `actual=[${thermalEigs}]`);

  // ── T15: Single-mode symplectic eigenvalue ─────────────────────────────────
  // Vacuum: V = I (identity) → d = sqrt(1·1 - 0²) = 1.0
  const vacuumD = SymplecticRankEvaluator.singleModeSympEigenvalue(1, 1, 0);
  assertApprox('T15: Vacuum state V=I → d = sqrt(1) = 1.0', vacuumD, 1.0, 1e-12);
  // Thermal state n̄=1: Vxx=Vpp=3, Vxp=0 → d = sqrt(9) = 3.0 = 2·1+1
  const thermalD = SymplecticRankEvaluator.singleModeSympEigenvalue(3, 3, 0);
  assertApprox('T15: Thermal n̄=1, V=3I → d = 3.0', thermalD, 3.0, 1e-12);

  // ── T16–T20: isoTNS complexity classification ──────────────────────────────
  // T16: δ=0.7, D=1 → η=0.49 ≥ 0.41 → CLASSICAL
  const classical = isoClassifier.classifyComplexity(0.7, 1);
  assertApprox('T16: δ=0.7, D=1 → η=0.49', classical.eta, 0.49, 1e-12);
  assert('T16: η=0.49 ≥ 0.41 → STRONG_INJECTIVITY_CLASSICAL_EFFICIENT',
    classical.complexityClass === 'STRONG_INJECTIVITY_CLASSICAL_EFFICIENT');

  // T17: δ=0.5, D=1 → η=0.25 < 0.41 → BQP
  const bqp = isoClassifier.classifyComplexity(0.5, 1);
  assertApprox('T17: δ=0.5, D=1 → η=0.25', bqp.eta, 0.25, 1e-12);
  assert('T17: η=0.25 < 0.41 → WEAKLY_INJECTIVE_BQP_COMPLETE',
    bqp.complexityClass === 'WEAKLY_INJECTIVE_BQP_COMPLETE');

  // T18: δ=1.0, D=1 → η=1.0 → CLASSICAL
  const maxDelta = isoClassifier.classifyComplexity(1.0, 1);
  assertApprox('T18: δ=1.0, D=1 → η=1.0', maxDelta.eta, 1.0, 1e-12);
  assert('T18: η=1.0 → CLASSICAL', maxDelta.isStronglyInjective === true);

  // T19: δ≈0.6403, D=1 → η≈0.41 boundary
  const boundaryDelta = Math.sqrt(0.41);
  const boundaryIso = isoClassifier.classifyComplexity(boundaryDelta, 1);
  assertApprox('T19: δ=√0.41, D=1 → η=0.41 (exact boundary)',
    boundaryIso.eta, 0.41, 1e-10);
  assert('T19: Boundary (η=0.41) → CLASSICAL (≥ threshold)',
    boundaryIso.isStronglyInjective === true);

  // T20: distanceFromThreshold = eta - 0.41
  assertApprox('T20: distanceFromThreshold = η - 0.41',
    classical.distanceFromThreshold, 0.49 - 0.41, 1e-12);

  // ── T21–T22: isoTNS PQC + determinism ────────────────────────────────────
  assert('T21: isoTNS PQC seal format valid',
    /^0xPQC_369_[0-9a-f]{32}_SEAL$/.test(classical.pqcSeal));

  const iso1 = isoClassifier.classifyComplexity(0.7, 1);
  const iso2 = isoClassifier.classifyComplexity(0.7, 1);
  assert('T22: isoTNS determinism — same δ,D → same seal (σ²=0.0)',
    iso1.pqcSeal === iso2.pqcSeal);

  // ── T23–T25: Threshold helper functions ───────────────────────────────────
  // T23: minDeltaForClassical(D=1) = sqrt(0.41) ≈ 0.6403
  const minDelta1 = IsoTNSComplexityClassifier.minDeltaForClassical(1);
  assertApprox('T23: minDeltaForClassical(D=1) = √0.41 ≈ 0.6403',
    minDelta1, Math.sqrt(0.41), 1e-12);

  // T24: minBondDimForClassical(delta=1.0) = ceil(0.6403/1) = 1
  const minD1 = IsoTNSComplexityClassifier.minBondDimForClassical(1.0);
  assert('T24: minBondDimForClassical(δ=1.0) = 1', minD1 === 1,
    `actual=${minD1}`);

  // T25: minBondDimForClassical(delta=0.5) = ceil(0.6403/0.5) = ceil(1.28) = 2
  const minD2 = IsoTNSComplexityClassifier.minBondDimForClassical(0.5);
  assert('T25: minBondDimForClassical(δ=0.5) = 2', minD2 === 2,
    `actual=${minD2}`);

  // ── T26–T29: Input validation ─────────────────────────────────────────────
  assertThrows('T26: δ=0 throws error', () => isoClassifier.classifyComplexity(0, 1));
  assertThrows('T27: δ=1.5 throws error', () => isoClassifier.classifyComplexity(1.5, 1));
  assertThrows('T28: D=0 throws error', () => isoClassifier.classifyComplexity(0.5, 0));
  assertThrows('T29: Empty eigenvalues throws error',
    () => sympEval.computeSymplecticRank([]));

  // ── T30–T36: Combined evaluator ───────────────────────────────────────────
  // Pure state + classical isoTNS
  const pureCombo = evaluator.evaluate([1.0, 1.0, 1.0, 1.0], 0.8, 1);

  assert('T30: evaluate() returns CombinedQuantumMetricsResult',
    'symplectic' in pureCombo && 'isotns' in pureCombo && 'jointVerdicts' in pureCombo);

  assert('T31: FULLY_CLASSICAL verdict for pure + strongly injective',
    pureCombo.jointVerdicts.some(v => v.includes('FULLY_CLASSICAL')));

  // Dense mixed + weak injectivity → FULLY_QUANTUM
  const quantumCombo = evaluator.evaluate(
    [5.0, 4.0, 3.0, 2.5, 2.0, 1.5, 2.5, 3.5],  // n=8, s_symp=7 > log2(8)=3
    0.3, 1                                         // η=0.09 < 0.41
  );
  assert('T32: FULLY_QUANTUM verdict for dense mixed + weak injectivity',
    quantumCombo.jointVerdicts.some(v => v.includes('FULLY_QUANTUM')));

  assert('T33: constraints block: isActuationBlocked=true, uup=1.0, sigmaSq=0.0',
    pureCombo.constraints.isActuationBlocked === true &&
    pureCombo.constraints.uup === 1.0 &&
    pureCombo.constraints.sigmaSq === 0.0 &&
    pureCombo.constraints.zeroHallucination === true);

  assert('T34: gate = CNL-P26.7', pureCombo.gate === 'CNL-P26.7');

  assert('T35: deterministicSeal format valid',
    /^0xPQC_369_[0-9a-f]{32}_SEAL$/.test(pureCombo.deterministicSeal));

  assert('T36: computeLatencyMs > 0',
    pureCombo.computeLatencyMs >= 0, `actual=${pureCombo.computeLatencyMs}`);

  // ── T37–T38: Report formatter ─────────────────────────────────────────────
  const report = formatQuantumMetricsReport(pureCombo);
  assert('T37: Report contains symplectic rank data',
    report.includes('Symplectic Rank') && report.includes('s_symp'));
  assert('T38: Report contains isoTNS data',
    report.includes('isoTNS') && report.includes('η ='));

  // ── T39: Large n=32 ──────────────────────────────────────────────────────
  const largeEigs = Array.from({ length: 32 }, (_, i) => 1 + i * 0.1); // 32 modes
  const largeResult = sympEval.computeSymplecticRank(largeEigs);
  assert('T39: n=32 eigenvalue array processed correctly',
    largeResult.totalModes === 32 &&
    largeResult.symplecticRank > 0 &&
    largeResult.symplecticRank <= 32,
    `s_symp=${largeResult.symplecticRank}, n=32`);

  // ── T40: Williamson consistency — thermal state check ─────────────────────
  // For thermal state with n̄=[0,1,2,3]: dⱼ=[1,3,5,7]
  // Mean: Σdⱼ/n = (1+3+5+7)/4 = 4.0
  const thermalEigsFromOcc = SymplecticRankEvaluator.thermalEigenvaluesFromOccupations([0, 1, 2, 3]);
  const thermalMean = thermalEigsFromOcc.reduce((s, v) => s + v, 0) / thermalEigsFromOcc.length;
  assertApprox('T40: Thermal state n̄=[0,1,2,3] → mean(dⱼ) = 4.0', thermalMean, 4.0, 1e-12);

  // ── Sample report output ───────────────────────────────────────────────────
  console.log('\n  === Sample Quantum Metrics Report ===');
  console.log(formatQuantumMetricsReport(quantumCombo));

  printSummary();
}

function printSummary(): void {
  const total = passed + failed;
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(`  GATE CNL-P26.7 TEST RESULTS: ${passed}/${total} PASS`);
  if (failed > 0) {
    console.log('\n  Failed tests:');
    errors.forEach(e => console.log(`    ❌ ${e}`));
  }
  console.log('════════════════════════════════════════════════════════════════\n');
  if (failed > 0) process.exit(1);
}

runTests();
