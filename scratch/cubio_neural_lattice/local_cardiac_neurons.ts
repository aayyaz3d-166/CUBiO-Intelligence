/**
 * CUBiO Local Cardiac Neurons — Intrinsic Cardiac Nervous System (ICNS)
 * Gate: CNL-P28-001 | Sovereign Architecture ("one-heart")
 *
 * Models the human Intrinsic Cardiac Nervous System:
 * — ~40,000 intrinsic neurons embedded directly in the cardiac wall.
 * — These neurons process sensory afferent signals and fire reflex arcs
 *   LOCALLY within the heart — without waiting for brain (cortex) routing.
 * — They handle mechanical stretch, chemical gradients, pressure, ischemia,
 *   and thermal stress in sub-millisecond local loops.
 *
 * Our sovereign implementation places 40,000 reflex neuron slots directly
 * at each edge node's sensor frontier — they react to sensor anomalies
 * before any central cognitive AI is consulted.
 */

import { PQCLatticeSealEngine } from '../../src/core/crypto/pqc_lattice_seal';
import { PacemakerRhythmState, HeartPacemakerCore, SA_HARMONIC_FREQ_MAP } from './heart_pacemaker_core';

// ── ICNS Sensor Afferent Types (cardiac mechanosensor/chemosensor analogs) ───
export type ICNSSensorType =
  | 'THERMAL_OVERLOAD'         // Thermal runaway (> 330 K hardware temp)
  | 'MECHANICAL_PRESSURE'      // Memory RSS nearing 512 MB ceiling
  | 'ISCHEMIC_SIGNAL'          // Starved resource: CPU/IO stall detected
  | 'CHEMICAL_IMBALANCE'       // Sensor data corruption / NaN/Inf anomaly
  | 'STRETCH_REFLEX'           // Inference queue overloaded (> 128 depth)
  | 'ELECTRICAL_DESYNC';       // Harmonic oscillator phase drift detected

export interface ICNSSensorAfferent {
  neuronId: string;
  sensorType: ICNSSensorType;
  rawMeasurement: number;      // Raw hardware measurement
  safeThreshold: number;       // Normal operating threshold
  spatialVoxel: [number, number, number];
  timestamp: number;
}

export interface ICNSReflexArcEvent {
  reflexEventId: string;
  neuronType: ICNSSensorType;
  firedAt: number;
  afferentSignal: ICNSSensorAfferent;
  reflexResponseMode: PacemakerRhythmState;   // Mode recommended to pacemaker
  requiresCorticalEscalation: boolean;         // False = local ICNS handled it; True = escalate to cognitive AI
  reflexLatencyMs: number;                     // <1ms = local arc; >1ms = cortical escalation path
  neuronsFiredCount: number;                   // Number of neurons activated by this event
  pqcReflexSeal: string;
}

export interface ICNSSystemReport {
  totalNeuronPool: number;
  neuronsStillAvailable: number;
  totalReflexEventsFired: number;
  currentAutonomicBalance: 'PARASYMPATHETIC_DOMINANT' | 'BALANCED_TONE' | 'SYMPATHETIC_DOMINANT';
  reflexLog: ICNSReflexArcEvent[];
  pqcICNSSeal: string;
}

// ── ICNS Threshold Map — matched to human cardiac baroreceptor limits ─────────
const ICNS_THRESHOLDS: Record<ICNSSensorType, number> = {
  THERMAL_OVERLOAD:    330.0,   // K — hardware thermal limit
  MECHANICAL_PRESSURE: 460.0,   // MB — warn before 512 MB ceiling
  ISCHEMIC_SIGNAL:     85.0,    // % CPU stall utilization
  CHEMICAL_IMBALANCE:  3.5,     // σ standard deviations from baseline
  STRETCH_REFLEX:      128.0,   // inference queue depth saturation
  ELECTRICAL_DESYNC:   0.15,    // phase drift coefficient (0 = locked, 1 = chaotic)
};

// ── Post-reflex recommended pacemaker state ──────────────────────────────────
const ICNS_REFLEX_MODE_MAP: Record<ICNSSensorType, PacemakerRhythmState> = {
  THERMAL_OVERLOAD:    'DIASTOLIC_REST',    // Cool down → reduce freq to 3 MHz
  MECHANICAL_PRESSURE: 'SYSTOLIC_ACTIVE',   // Moderate pressure → 6 MHz + GC
  ISCHEMIC_SIGNAL:     'DIASTOLIC_REST',    // Starved → reduce load immediately
  CHEMICAL_IMBALANCE:  'TACHYCARDIC_LOAD', // Alert AI cortex → 9 MHz escalation
  STRETCH_REFLEX:      'SYSTOLIC_ACTIVE',   // Throttle inference pipeline → 6 MHz
  ELECTRICAL_DESYNC:   'DIASTOLIC_REST',    // Re-lock oscillator at base 3 MHz
};

// ── Neurons consumed per reflex type (from the 40,000-pool) ─────────────────
const NEURONS_CONSUMED: Record<ICNSSensorType, number> = {
  THERMAL_OVERLOAD:    12,    // Thermal sensing neuron cluster
  MECHANICAL_PRESSURE: 8,     // Baroreceptor stretch cluster
  ISCHEMIC_SIGNAL:     20,    // Ischemia detection cluster (most neurons)
  CHEMICAL_IMBALANCE:  15,    // Chemoreceptor cluster
  STRETCH_REFLEX:      6,     // Mechanoreceptor cluster
  ELECTRICAL_DESYNC:   10,    // Electrosensory cluster
};

// ── ICNS Engine ──────────────────────────────────────────────────────────────
export class LocalCardiacNeurons {
  public readonly TOTAL_NEURON_POOL: number = 40000;
  private neuronsAvailable: number = 40000;
  private totalReflexesFired: number = 0;
  private readonly reflexLog: ICNSReflexArcEvent[] = [];
  private readonly pacemaker: HeartPacemakerCore;

  constructor(pacemaker: HeartPacemakerCore) {
    this.pacemaker = pacemaker;
  }

  /**
   * Evaluate one afferent sensor signal against the ICNS threshold.
   * If threshold exceeded → fire a local reflex arc BEFORE any central cognitive routing.
   * Returns the reflex event, or null if the signal is within safe bounds.
   */
  public evaluateAfferentSignal(signal: ICNSSensorAfferent): ICNSReflexArcEvent | null {
    const threshold = ICNS_THRESHOLDS[signal.sensorType];
    if (signal.rawMeasurement <= threshold) return null;   // Below threshold — no reflex needed

    const neuronsNeeded = NEURONS_CONSUMED[signal.sensorType];
    if (this.neuronsAvailable < neuronsNeeded) {
      throw new Error(`ICNS neuron pool insufficient! Available: ${this.neuronsAvailable}, Required: ${neuronsNeeded}`);
    }

    // Consume neurons from pool (refractory window model)
    this.neuronsAvailable -= neuronsNeeded;
    this.totalReflexesFired++;

    const responseMode = ICNS_REFLEX_MODE_MAP[signal.sensorType];

    // Cortical escalation only needed for CHEMICAL_IMBALANCE (requires AI re-evaluation)
    const requiresCorticalEscalation = signal.sensorType === 'CHEMICAL_IMBALANCE';

    // Local ICNS arcs: 0.05 ms. Cortical escalation adds ~1.5 ms.
    const reflexLatencyMs = requiresCorticalEscalation ? 1.5 : 0.05;

    // PQC-seal the reflex event
    const reflexPayload = `ICNS_REFLEX:${signal.neuronId}|TYPE:${signal.sensorType}|VAL:${signal.rawMeasurement}|MODE:${responseMode}|NEURONS:${neuronsNeeded}`;
    const pqcReflexSeal = PQCLatticeSealEngine.generatePQCSeal(Buffer.from(reflexPayload, 'utf-8'));

    const event: ICNSReflexArcEvent = {
      reflexEventId:             `ICNS_EVENT_${String(this.totalReflexesFired).padStart(5, '0')}_${signal.sensorType}`,
      neuronType:                signal.sensorType,
      firedAt:                   signal.timestamp,
      afferentSignal:            signal,
      reflexResponseMode:        responseMode,
      requiresCorticalEscalation,
      reflexLatencyMs,
      neuronsFiredCount:         neuronsNeeded,
      pqcReflexSeal,
    };

    this.reflexLog.push(event);

    // Immediately relay recommended mode to pacemaker core (ICNS → SA Node efferent pathway)
    this.pacemaker.setRhythmState(responseMode);

    return event;
  }

  /**
   * Batch evaluation of multiple afferent signals — simultaneous multi-neuron firing.
   */
  public evaluateAfferentBatch(signals: ICNSSensorAfferent[]): ICNSReflexArcEvent[] {
    const events: ICNSReflexArcEvent[] = [];
    for (const sig of signals) {
      const ev = this.evaluateAfferentSignal(sig);
      if (ev) events.push(ev);
    }
    return events;
  }

  /**
   * Autonomic balance based on pattern of recent reflex events.
   * PARASYMPATHETIC_DOMINANT = calm; SYMPATHETIC_DOMINANT = high-stress response.
   */
  public getAutonomicBalance(): 'PARASYMPATHETIC_DOMINANT' | 'BALANCED_TONE' | 'SYMPATHETIC_DOMINANT' {
    const n = this.totalReflexesFired;
    if (n === 0) return 'PARASYMPATHETIC_DOMINANT';
    if (n <= 2) return 'BALANCED_TONE';
    return 'SYMPATHETIC_DOMINANT';
  }

  /**
   * Generates PQC-sealed ICNS system report for gate certification.
   */
  public getICNSReport(): ICNSSystemReport {
    const balance = this.getAutonomicBalance();
    const payload = JSON.stringify({
      totalNeurons: this.TOTAL_NEURON_POOL,
      available: this.neuronsAvailable,
      fired: this.totalReflexesFired,
      balance,
    });
    const pqcICNSSeal = PQCLatticeSealEngine.generatePQCSeal(Buffer.from(payload, 'utf-8'));
    return {
      totalNeuronPool:         this.TOTAL_NEURON_POOL,
      neuronsStillAvailable:   this.neuronsAvailable,
      totalReflexEventsFired:  this.totalReflexesFired,
      currentAutonomicBalance: balance,
      reflexLog:               this.reflexLog,
      pqcICNSSeal,
    };
  }

  public getNeuronsAvailable(): number { return this.neuronsAvailable; }
  public getTotalReflexesFired(): number { return this.totalReflexesFired; }
}
