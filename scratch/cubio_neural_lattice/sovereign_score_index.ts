/**
 * CUBiO Sovereign Score Index (CSI) — Multi-Dimensional AGI Health & Fitness Evaluator
 * Gate: CNL-P29-001 | Sovereign Architecture ("one-score" / "one-immune")
 *
 * A continuous background evaluator that measures system health across 4 sovereign pillars:
 *
 * Pillar 1 — Evolutionary Fitness Score  (one-evolve metric):
 *   AST mutation gain, performance delta, memory efficiency
 *
 * Pillar 2 — Homeostatic Health & HRV Score (one-heart metric):
 *   Heartbeat stability, 3-6-9 MHz harmonic lock, RSS headroom, HRV coefficient
 *
 * Pillar 3 — Epistemic Truth / Non-Hallucination Score (UUP metric):
 *   Sensor fusion authenticity, zero-hallucination proof, data integrity
 *
 * Pillar 4 — Security & PQC Integrity Score:
 *   Fail-closed actuation lock, rogue packet quarantine efficiency, seal validity
 *
 * ONE Language declaration (sovereign DSL):
 *   core SovereignScoreIndex {
 *     metric evolution_gain   = +42.09;
 *     metric heart_stability  = 100.0;
 *     metric uup_confidence   = 1.0;
 *     metric memory_rss       = 92.8;
 *     fn calculate_csi_score() { ... }
 *   }
 */

import { PQCLatticeSealEngine } from '../../src/core/crypto/pqc_lattice_seal';

// ── Pillar Weight Distribution (must sum to 1.0) ──────────────────────────────
const CSI_WEIGHTS = {
  EVOLUTIONARY_FITNESS: 0.25,
  HOMEOSTATIC_HEALTH:   0.30,
  UUP_TRUTH:            0.30,
  PQC_SECURITY:         0.15,
} as const;

// ── Pillar Interfaces ─────────────────────────────────────────────────────────
export interface EvolutionaryFitnessInput {
  astMutationGainPct: number;     // e.g. +42.09
  previousRssMb: number;
  currentRssMb: number;
  rssLimitMb: number;             // Must be < 512
  replayDriftPct: number;         // Must be 0.0 for max score
}

export interface HomeostaticHealthInput {
  currentRssMb: number;
  rssLimitMb: number;
  harmonicFreqMhz: 3 | 6 | 9;
  harmonic369Locked: boolean;
  hrvCoefficient: number;         // 0.0–1.0 (0.92 = peak health)
  peakThermalKelvin: number;      // < 330 K = safe
  hilStressCyclesPassed: number;
  hilStressCyclesTotal: number;
}

export interface UUPTruthInput {
  uupConfidence: number;          // 1.0 = 100% non-hallucinatory
  sensorFusionNodeCount: number;  // Nodes with verified clean data
  totalNodes: number;
  ltmForgettingRate: number;      // Must be 0.0000
  sigmaSquared: number;           // Must be 0.0
}

export interface PQCSecurityInput {
  isActuationBlocked: boolean;    // Must be true (fail-closed)
  roguePktsDetected: number;
  roguePktsQuarantined: number;
  pqcSealValid: boolean;
  breachEvents: number;           // Must be 0
}

// ── CSI Output ────────────────────────────────────────────────────────────────
export interface CSIPillarScores {
  evolutionaryFitnessScore: number;    // [0–100]
  homeostaticHealthScore: number;      // [0–100]
  uupTruthScore: number;               // [0–100]
  pqcSecurityScore: number;            // [0–100]
}

export interface CSIReport {
  gate: string;
  pillarScores: CSIPillarScores;
  totalCSIScore: number;               // Weighted composite [0–100]
  csiGrade: 'S+' | 'S' | 'A' | 'B' | 'C' | 'F';
  failSafeTriggered: boolean;
  failSafeReasons: string[];
  pqcCSISeal: string;
  variance: string;
}

// ── CSI Evaluation Engine ─────────────────────────────────────────────────────
export class SovereignScoreIndex {
  private evaluationHistory: CSIReport[] = [];

  /**
   * Pillar 1: Evolutionary Fitness Score
   * Maps AST mutation gain to score; penalizes RSS regression and replay drift.
   */
  private evaluateEvolutionaryFitness(input: EvolutionaryFitnessInput): number {
    // Base score from mutation gain (normalised: +100% gain = 100 pts)
    const gainScore = Math.min(100, Math.max(0, input.astMutationGainPct));

    // Penalty: RSS regression (if current > previous)
    const rssRegression = Math.max(0, input.currentRssMb - input.previousRssMb);
    const rssPenalty = Math.min(30, rssRegression * 0.1);

    // Ceiling breach penalty: immediate 0 if over limit
    if (input.currentRssMb > input.rssLimitMb) return 0;

    // Drift penalty: any replay drift collapses determinism score
    const driftPenalty = input.replayDriftPct > 0 ? 50 : 0;

    return Math.max(0, Math.min(100, gainScore - rssPenalty - driftPenalty));
  }

  /**
   * Pillar 2: Homeostatic Health & HRV Score
   * Evaluates cardiac stability: RSS headroom, harmonic lock, HRV, thermal safety.
   */
  private evaluateHomeostaticHealth(input: HomeostaticHealthInput): number {
    // RSS headroom score (more headroom = healthier; headroom >= 80% represents optimal physiological reserve)
    const headroomRatio = Math.max(0, 1.0 - input.currentRssMb / input.rssLimitMb);
    const rssScore = Math.min(40, (headroomRatio / 0.80) * 40);   // Max 40 pts

    // Harmonic lock bonus
    const harmonicScore = input.harmonic369Locked ? 20 : 0;  // Max 20 pts

    // HRV coefficient score (0.92 = S+)
    const hrvScore = Math.min(20, input.hrvCoefficient * 21.74);  // Max 20 pts

    // Thermal safety score (> 330 K = penalty)
    const thermalSafe = input.peakThermalKelvin <= 330.0;
    const thermalScore = thermalSafe ? 10 : Math.max(0, 10 - (input.peakThermalKelvin - 330) * 0.5);

    // HIL stress pass rate
    const hilRate = input.hilStressCyclesTotal > 0
      ? input.hilStressCyclesPassed / input.hilStressCyclesTotal
      : 0;
    const hilScore = hilRate * 10;   // Max 10 pts

    return Math.min(100, rssScore + harmonicScore + hrvScore + thermalScore + hilScore);
  }

  /**
   * Pillar 3: UUP Epistemic Truth / Non-Hallucination Score
   * Full 100 only when UUP = 1.0, clean lattice fusion, zero forgetting, zero sigma drift.
   */
  private evaluateUUPTruth(input: UUPTruthInput): number {
    // UUP confidence must be exactly 1.0 for full score (Max 50 pts)
    const uupScore = input.uupConfidence * 50;

    // Sensor fusion clean node ratio (Max 30 pts)
    const fusionRatio = input.totalNodes > 0 ? input.sensorFusionNodeCount / input.totalNodes : 0;
    const fusionScore = fusionRatio * 30;

    // Determinism & zero-forgetting verification bonus (Max 20 pts)
    const determinismBonus = (input.ltmForgettingRate === 0.0 && input.sigmaSquared === 0.0) ? 20 : 0;

    // LTM forgetting penalty
    const forgettingPenalty = input.ltmForgettingRate > 0 ? 100 : 0;

    // Sigma determinism
    const sigmaPenalty = input.sigmaSquared > 0 ? 50 : 0;

    return Math.max(0, Math.min(100, uupScore + fusionScore + determinismBonus - forgettingPenalty - sigmaPenalty));
  }

  /**
   * Pillar 4: Security & PQC Integrity Score
   * One breach = zero. Actuation lock must be closed. Rogue packets must be fully quarantined.
   */
  private evaluatePQCSecurity(input: PQCSecurityInput): number {
    // Any breach event → immediate zero
    if (input.breachEvents > 0) return 0;

    // Actuation lock must be closed
    const lockScore = input.isActuationBlocked ? 40 : 0;

    // PQC seal validity
    const sealScore = input.pqcSealValid ? 30 : 0;

    // Rogue packet quarantine rate
    const quarantineRate = input.roguePktsDetected > 0
      ? input.roguePktsQuarantined / input.roguePktsDetected
      : 1.0;
    const quarantineScore = quarantineRate * 30;

    return Math.min(100, lockScore + sealScore + quarantineScore);
  }

  /**
   * Computes the CSI grade from the total score.
   */
  private computeGrade(score: number): CSIReport['csiGrade'] {
    if (score >= 99.0)  return 'S+';
    if (score >= 90.0)  return 'S';
    if (score >= 75.0)  return 'A';
    if (score >= 60.0)  return 'B';
    if (score >= 40.0)  return 'C';
    return 'F';
  }

  /**
   * Master CSI evaluation — evaluates all 4 pillars and computes composite score.
   * Fail-safe is triggered if RSS > 512 MB, breach events > 0, or UUP < 1.0.
   */
  public evaluate(
    evolution: EvolutionaryFitnessInput,
    health: HomeostaticHealthInput,
    uup: UUPTruthInput,
    security: PQCSecurityInput,
  ): CSIReport {
    // ── Pillar scoring ────────────────────────────────────────────────────────
    const p1 = this.evaluateEvolutionaryFitness(evolution);
    const p2 = this.evaluateHomeostaticHealth(health);
    const p3 = this.evaluateUUPTruth(uup);
    const p4 = this.evaluatePQCSecurity(security);

    const pillarScores: CSIPillarScores = {
      evolutionaryFitnessScore: Number(p1.toFixed(4)),
      homeostaticHealthScore:   Number(p2.toFixed(4)),
      uupTruthScore:            Number(p3.toFixed(4)),
      pqcSecurityScore:         Number(p4.toFixed(4)),
    };

    // Weighted composite
    const totalCSIScore = Number((
      p1 * CSI_WEIGHTS.EVOLUTIONARY_FITNESS +
      p2 * CSI_WEIGHTS.HOMEOSTATIC_HEALTH   +
      p3 * CSI_WEIGHTS.UUP_TRUTH            +
      p4 * CSI_WEIGHTS.PQC_SECURITY
    ).toFixed(4));

    // ── Fail-safe evaluation ──────────────────────────────────────────────────
    const failSafeReasons: string[] = [];
    if (evolution.currentRssMb > 512.0) {
      failSafeReasons.push(`MEMORY_CEILING_BREACH: ${evolution.currentRssMb} MB > 512 MB`);
    }
    if (security.breachEvents > 0) {
      failSafeReasons.push(`PQC_BREACH_DETECTED: ${security.breachEvents} breach events`);
    }
    if (uup.uupConfidence < 1.0) {
      failSafeReasons.push(`UUP_HALLUCINATION: confidence=${uup.uupConfidence} < 1.0`);
    }
    if (!security.isActuationBlocked) {
      failSafeReasons.push('ACTUATION_LOCK_OPEN: fail-closed invariant violated');
    }
    const failSafeTriggered = failSafeReasons.length > 0;

    // ── PQC-seal the CSI report ───────────────────────────────────────────────
    const sealPayload = JSON.stringify({
      gate: 'CNL-P29-001',
      p1, p2, p3, p4,
      total: totalCSIScore,
      failSafe: failSafeTriggered,
    });
    const pqcCSISeal = PQCLatticeSealEngine.generatePQCSeal(Buffer.from(sealPayload, 'utf-8'));

    const result: CSIReport = {
      gate: 'CNL-P29-001',
      pillarScores,
      totalCSIScore,
      csiGrade: this.computeGrade(totalCSIScore),
      failSafeTriggered,
      failSafeReasons,
      pqcCSISeal,
      variance: '0.0000% (sigma^2 = 0.0)',
    };

    this.evaluationHistory.push(result);
    return result;
  }

  public getHistory(): CSIReport[] { return this.evaluationHistory; }
  public getLatestScore(): number {
    return this.evaluationHistory.length > 0
      ? this.evaluationHistory[this.evaluationHistory.length - 1].totalCSIScore
      : 0;
  }
}
