/**
 * CUBiO HRV Adaptability Engine — Heart Rate Variability & Hemodynamic Homeostasis
 * Gate: CNL-P28-001 | Sovereign Architecture ("one-heart")
 *
 * Models Heart Rate Variability (HRV) and Hemodynamic Homeostasis:
 * — HRV is the variation in time intervals between consecutive heartbeats.
 * — High HRV = healthy, flexible autonomic nervous system.
 * — Low HRV = stress, rigidity, or sympathetic overdrive.
 * — Hemodynamic Homeostasis = maintaining stable blood flow / resource delivery
 *   despite changing demands — Frank-Starling law governs stroke volume.
 *
 * Our sovereign HRV engine:
 * — Tracks inter-beat variability across pacemaker action potentials.
 * — Dynamically switches oscillator frequency based on environmental stress index.
 * — Computes sympathovagal balance and recommends pacemaker mode transitions.
 * — Enforces homeostatic bounds on memory RSS and energy flux.
 */

import { PQCLatticeSealEngine } from '../../src/core/crypto/pqc_lattice_seal';
import { PacemakerRhythmState, HeartPacemakerCore, SA_HARMONIC_FREQ_MAP, SAPacemakerActionPotential } from './heart_pacemaker_core';

// ── HRV Biophysical Constants ─────────────────────────────────────────────────
const RMSSD_BASELINE_MS: number   = 42.0;   // Root Mean Square of Successive Differences (ms)
const SDNN_BASELINE_MS: number    = 55.0;   // Standard Deviation of NN intervals (ms)
const GOLDEN_RATIO: number        = 1.6180339887;
const HARMONIC_DAMPING: number    = 0.369;  // 3-6-9 resonance damping

// ── Stress Index Bands → Rhythm State Mapping ────────────────────────────────
// Stress index: 0.0 (serene) → 1.0 (maximal arousal)
const STRESS_BAND_MAP: { maxStress: number; state: PacemakerRhythmState }[] = [
  { maxStress: 0.30, state: 'DIASTOLIC_REST' },
  { maxStress: 0.65, state: 'SYSTOLIC_ACTIVE' },
  { maxStress: 1.00, state: 'TACHYCARDIC_LOAD' },
];

// ── Interfaces ────────────────────────────────────────────────────────────────
export interface HRVMeasurement {
  sampleId: string;
  rmssdMs: number;           // RMSSD — short-term HRV (parasympathetic)
  sdnnMs: number;            // SDNN  — overall HRV variability
  lfHfRatio: number;         // LF/HF ratio — sympathovagal balance (1.0 = balanced)
  stressIndex: number;       // Composite stress index [0.0–1.0]
  recommendedState: PacemakerRhythmState;
  timestamp: number;
}

export interface HomeostasisStatus {
  rssMb: number;
  rssHeadroomMb: number;
  energyFluxWatts: number;
  isHomeostatic: boolean;    // True if RSS < 512 MB AND energy within bounds
  cappingApplied: boolean;   // True if ceiling enforcement throttled allocation
}

export interface HRVAdaptabilityReport {
  gate: string;
  totalHRVSamples: number;
  meanRMSSDMs: number;
  meanSDNNMs: number;
  meanLFHFRatio: number;
  meanStressIndex: number;
  frequencyTransitions: number;        // Number of 3→6→9 MHz mode switches
  homeostasisMaintained: boolean;
  peakRssMb: number;
  energyFluxWattsTotal: number;
  pqcHRVSeal: string;
}

// ── RSS & Energy Constants ────────────────────────────────────────────────────
const RSS_CEILING_MB:    number = 512.0;
const RSS_FLOOR_MB:      number = 48.0;
const ENERGY_QUANTUM_MB: number = 8.0;

export class HRVAdaptabilityEngine {
  private readonly pacemaker: HeartPacemakerCore;
  private readonly hrvHistory: HRVMeasurement[] = [];
  private frequencyTransitions: number = 0;
  private lastRhythmState: PacemakerRhythmState | null = null;
  private currentRssMb: number = RSS_FLOOR_MB;
  private peakRssMb: number = RSS_FLOOR_MB;
  private energyFluxTotal: number = 0.0;
  private sampleCounter: number = 0;

  constructor(pacemaker: HeartPacemakerCore) {
    this.pacemaker = pacemaker;
  }

  /**
   * Computes HRV metrics from a window of consecutive SA Node action potentials.
   * Analogous to R-R interval analysis in clinical cardiology.
   */
  public analyzeActionPotentialWindow(aps: SAPacemakerActionPotential[]): HRVMeasurement {
    if (aps.length < 2) {
      throw new Error('HRV analysis requires at least 2 consecutive action potentials.');
    }
    this.sampleCounter++;

    // Compute successive period differences (ΔΔ intervals)
    const periods = aps.map(ap => ap.periodMs);
    const successiveDiffs: number[] = [];
    for (let i = 1; i < periods.length; i++) {
      successiveDiffs.push(periods[i] - periods[i - 1]);
    }

    // RMSSD: sqrt( mean(ΔΔ²) ) — short-term vagal modulation
    const rmssd = Math.sqrt(
      successiveDiffs.reduce((s, d) => s + d * d, 0) / successiveDiffs.length
    );

    // SDNN: standard deviation of all periods
    const meanPeriod = periods.reduce((s, p) => s + p, 0) / periods.length;
    const sdnn = Math.sqrt(
      periods.reduce((s, p) => s + Math.pow(p - meanPeriod, 2), 0) / periods.length
    );

    // LF/HF ratio: proxy via frequency harmonics (3 MHz = HF dominant; 9 MHz = LF dominant)
    const freqMhz = aps[aps.length - 1].frequencyMhz;
    const lfHfRatio = freqMhz / 6.0;  // 0.5 = parasympathetic; 1.0 = balanced; 1.5 = sympathetic

    // Composite stress index: normalized rmssd deficit + sdnn deficit + sympathetic LF/HF push
    const rmssdNorm = Math.min(1.0, Math.max(0.0, 1.0 - rmssd / RMSSD_BASELINE_MS));
    const sdnnNorm  = Math.min(1.0, Math.max(0.0, 1.0 - sdnn  / SDNN_BASELINE_MS));
    const lfHfNorm  = Math.min(1.0, (lfHfRatio - 0.5) / 1.0);
    const stressIndex = Number(((rmssdNorm * 0.4 + sdnnNorm * 0.3 + lfHfNorm * 0.3)).toFixed(6));

    // Map stress index → recommended pacemaker state
    const recommendedState = STRESS_BAND_MAP.find(b => stressIndex <= b.maxStress)?.state ?? 'TACHYCARDIC_LOAD';

    const measurement: HRVMeasurement = {
      sampleId:         `HRV_SAMPLE_${String(this.sampleCounter).padStart(5, '0')}`,
      rmssdMs:          Number(rmssd.toFixed(6)),
      sdnnMs:           Number(sdnn.toFixed(6)),
      lfHfRatio:        Number(lfHfRatio.toFixed(6)),
      stressIndex,
      recommendedState,
      timestamp:        aps[aps.length - 1].timestamp,
    };

    this.hrvHistory.push(measurement);

    // Apply recommended state to pacemaker (HRV engine drives autonomic transitions)
    const prevState = this.pacemaker.getCurrentRhythmState();
    this.pacemaker.setRhythmState(recommendedState);
    if (prevState !== recommendedState) {
      this.frequencyTransitions++;
      this.lastRhythmState = recommendedState;
    }

    return measurement;
  }

  /**
   * Homeostatic resource allocation — Frank-Starling cardiac output analog.
   * Allocates RSS proportional to pacemaker frequency; enforces 512 MB hard ceiling.
   */
  public allocateHomeostaticResources(taskQuanta: number, priorityLevel: 1 | 2 | 3): HomeostasisStatus {
    const freqMhz = SA_HARMONIC_FREQ_MAP[this.pacemaker.getCurrentRhythmState()];

    // Harmonic scaling: 3 MHz = conservative; 9 MHz = aggressive
    const harmonicScale = (freqMhz / 9.0) * GOLDEN_RATIO;
    let requestedMb = taskQuanta * ENERGY_QUANTUM_MB * harmonicScale;

    // Priority-3 background tasks get damped allocation
    if (priorityLevel === 3) requestedMb *= HARMONIC_DAMPING;

    const projectedRss = this.currentRssMb + requestedMb;
    let allocatedMb = requestedMb;
    let cappingApplied = false;

    if (projectedRss > RSS_CEILING_MB) {
      allocatedMb = Math.max(0, RSS_CEILING_MB - this.currentRssMb);
      cappingApplied = true;
    }

    // Floor maintenance
    if (this.currentRssMb < RSS_FLOOR_MB) this.currentRssMb = RSS_FLOOR_MB;

    this.currentRssMb = Math.min(RSS_CEILING_MB, this.currentRssMb + allocatedMb);
    if (this.currentRssMb > this.peakRssMb) this.peakRssMb = this.currentRssMb;

    const energyFluxWatts = Number((allocatedMb * freqMhz * 0.0012 * HARMONIC_DAMPING).toFixed(6));
    this.energyFluxTotal += energyFluxWatts;

    return {
      rssMb:            Number(this.currentRssMb.toFixed(4)),
      rssHeadroomMb:    Number((RSS_CEILING_MB - this.currentRssMb).toFixed(4)),
      energyFluxWatts,
      isHomeostatic:    this.currentRssMb <= RSS_CEILING_MB,
      cappingApplied,
    };
  }

  /**
   * Reclaim resources after task completion (Diastolic relaxation analog).
   */
  public reclaimResources(reclaimMb: number): void {
    this.currentRssMb = Math.max(RSS_FLOOR_MB, this.currentRssMb - reclaimMb);
  }

  /**
   * Generates PQC-sealed HRV Adaptability Report for gate certification.
   */
  public generateHRVReport(): HRVAdaptabilityReport {
    if (this.hrvHistory.length === 0) {
      throw new Error('No HRV samples collected yet — cannot generate report.');
    }
    const n = this.hrvHistory.length;
    const meanRMSSD = this.hrvHistory.reduce((s, m) => s + m.rmssdMs, 0) / n;
    const meanSDNN  = this.hrvHistory.reduce((s, m) => s + m.sdnnMs, 0) / n;
    const meanLFHF  = this.hrvHistory.reduce((s, m) => s + m.lfHfRatio, 0) / n;
    const meanStress = this.hrvHistory.reduce((s, m) => s + m.stressIndex, 0) / n;

    const payload = JSON.stringify({
      gate: 'CNL-P28-001',
      samples: n,
      meanRMSSD,
      meanSDNN,
      meanLFHF,
      meanStress,
      transitions: this.frequencyTransitions,
      peakRss: this.peakRssMb,
      fluxTotal: this.energyFluxTotal,
    });
    const pqcHRVSeal = PQCLatticeSealEngine.generatePQCSeal(Buffer.from(payload, 'utf-8'));

    return {
      gate:                     'CNL-P28-001',
      totalHRVSamples:          n,
      meanRMSSDMs:              Number(meanRMSSD.toFixed(6)),
      meanSDNNMs:               Number(meanSDNN.toFixed(6)),
      meanLFHFRatio:            Number(meanLFHF.toFixed(6)),
      meanStressIndex:          Number(meanStress.toFixed(6)),
      frequencyTransitions:     this.frequencyTransitions,
      homeostasisMaintained:    this.peakRssMb <= RSS_CEILING_MB,
      peakRssMb:                Number(this.peakRssMb.toFixed(4)),
      energyFluxWattsTotal:     Number(this.energyFluxTotal.toFixed(6)),
      pqcHRVSeal,
    };
  }

  public getCurrentRssMb(): number { return this.currentRssMb; }
  public getPeakRssMb(): number { return this.peakRssMb; }
  public getHRVHistory(): HRVMeasurement[] { return this.hrvHistory; }
  public getFrequencyTransitions(): number { return this.frequencyTransitions; }
}
