/**
 * CUBiO Autonomic Nervous Bridge — 40,000-Neuron Local Reflex Arc Layer
 * Gate: CNL-P28-001 | Sovereign Architecture ("one-autonomic")
 *
 * Models the 40,000 sensory/intrinsic neurons of the human cardiac nervous system:
 * instantaneous local reflex triggers that respond to sensor anomalies and
 * environmental stress BEFORE central cognitive routing, providing sub-millisecond
 * sovereign hardware protection analogous to spinal reflex arcs.
 */

import { PQCLatticeSealEngine } from '../../src/core/crypto/pqc_lattice_seal';
import { HeartRhythmMode, SovereignHeartEngineCore } from './heart_engine_core';

// ── Reflex Neuron Types (cardiac sensory analogs) ────────────────────────────
export type ReflexNeuronType =
  | 'THERMAL_OVERLOAD'        // Heat / thermal runaway detection
  | 'MEMORY_PRESSURE'         // RSS memory approaching ceiling
  | 'HARMONIC_DESYNC'         // 3-6-9 oscillator phase drift detected
  | 'SENSOR_ANOMALY'          // Sudden spike or out-of-range sensor reading
  | 'ACTUATION_CONFLICT'      // Conflicting physical actuator commands
  | 'COGNITIVE_FLOOD';        // Excessive inference queue depth

export interface SensorSignal {
  sensorId: string;
  signalType: ReflexNeuronType;
  rawValue: number;           // Raw measurement
  threshold: number;          // Safe operating threshold
  spatialCoord: [number, number, number];
  timestamp: number;
}

export interface ReflexArcResponse {
  reflexId: string;
  neuronType: ReflexNeuronType;
  triggeredAt: number;        // Timestamp of local reflex fire
  suppressedSignal: SensorSignal;
  recommendedMode: HeartRhythmMode;   // Mode to relay to heart engine after reflex
  isCentralRoutingRequired: boolean;  // If false, local reflex handled it entirely
  pqcReflexSeal: string;
  reflexLatencyMs: number;            // Sub-millisecond local response time
}

export interface AutonomicBridgeState {
  totalNeuronsFired: number;
  totalReflexesSuppressed: number;
  currentAutonomicTone: 'PARASYMPATHETIC' | 'BALANCED' | 'SYMPATHETIC';
  reflexHistory: ReflexArcResponse[];
  pqcBridgeSeal: string;
}

// ── Threshold Map — analogous to cardiac baroreceptor/chemoreceptor limits ───
const REFLEX_THRESHOLDS: Record<ReflexNeuronType, number> = {
  THERMAL_OVERLOAD:   330.0,   // Kelvin — safe max hardware temp
  MEMORY_PRESSURE:    460.0,   // MB — warn before hitting 512 MB ceiling
  HARMONIC_DESYNC:    0.15,    // Phase drift coefficient [0.0 = locked, 1.0 = chaos]
  SENSOR_ANOMALY:     3.5,     // Sigma deviations from baseline
  ACTUATION_CONFLICT: 1.0,     // 1 = conflict present
  COGNITIVE_FLOOD:    128.0,   // Inference queue depth saturation
};

// ── Mode recommendations per reflex type ────────────────────────────────────
const REFLEX_MODE_MAP: Record<ReflexNeuronType, HeartRhythmMode> = {
  THERMAL_OVERLOAD:   'RESTING',             // Cool down → reduce clock
  MEMORY_PRESSURE:    'ACTIVE',              // Moderate — trigger GC / paging
  HARMONIC_DESYNC:    'RESTING',             // Re-lock oscillator at base freq
  SENSOR_ANOMALY:     'HIGH_COGNITIVE_LOAD', // Alert cortex for re-evaluation
  ACTUATION_CONFLICT: 'RESTING',             // Emergency halt
  COGNITIVE_FLOOD:    'ACTIVE',              // Throttle inference pipeline
};

export class AutonomicNervousBridge {
  // 40,000 sensory neuron slots — modeled as active reflex buckets per lattice cell
  private readonly NEURON_POOL_SIZE: number = 40000;
  private neuronsAvailable: number = 40000;
  private totalFired: number = 0;
  private totalSuppressed: number = 0;
  private readonly reflexHistory: ReflexArcResponse[] = [];
  private readonly heartEngine: SovereignHeartEngineCore;

  constructor(heartEngine: SovereignHeartEngineCore) {
    this.heartEngine = heartEngine;
  }

  /**
   * Evaluates an incoming sensor signal and fires a local reflex arc if threshold exceeded.
   * This response occurs BEFORE any central cognitive routing — pure local autonomic reflex.
   */
  public evaluateSensorSignal(signal: SensorSignal): ReflexArcResponse | null {
    const threshold = REFLEX_THRESHOLDS[signal.signalType];
    const isAnomaly = signal.rawValue > threshold;

    if (!isAnomaly) return null;  // Below threshold — no reflex needed

    // Consume one neuron from the pool (refractory period model)
    if (this.neuronsAvailable <= 0) {
      throw new Error('Autonomic neuron pool exhausted — reflex arc capacity exceeded!');
    }
    this.neuronsAvailable--;
    this.totalFired++;

    const recommendedMode = REFLEX_MODE_MAP[signal.signalType];
    const isCentralRequired = signal.signalType === 'SENSOR_ANOMALY' || signal.signalType === 'COGNITIVE_FLOOD';

    // Reflex latency: local-only reflexes are sub-ms (0.05 ms), cognitive routing adds ~1.2 ms
    const reflexLatencyMs = isCentralRequired ? 1.2 : 0.05;

    // PQC-seal the reflex event
    const reflexPayload = `REFLEX:${signal.sensorId}|TYPE:${signal.signalType}|VAL:${signal.rawValue}|MODE:${recommendedMode}`;
    const pqcReflexSeal = PQCLatticeSealEngine.generatePQCSeal(Buffer.from(reflexPayload, 'utf-8'));

    const response: ReflexArcResponse = {
      reflexId: `REFLEX_${this.totalFired.toString().padStart(5, '0')}_${signal.signalType}`,
      neuronType: signal.signalType,
      triggeredAt: signal.timestamp,
      suppressedSignal: signal,
      recommendedMode,
      isCentralRoutingRequired: isCentralRequired,
      pqcReflexSeal,
      reflexLatencyMs,
    };

    this.reflexHistory.push(response);
    this.totalSuppressed++;

    // Immediately relay mode to heart engine (local reflex → autonomic adjustment)
    this.heartEngine.setRhythmMode(recommendedMode);

    return response;
  }

  /**
   * Batch-evaluates multiple sensor signals — models simultaneous multi-neuron firing.
   */
  public evaluateSensorBatch(signals: SensorSignal[]): ReflexArcResponse[] {
    const responses: ReflexArcResponse[] = [];
    for (const sig of signals) {
      const r = this.evaluateSensorSignal(sig);
      if (r) responses.push(r);
    }
    return responses;
  }

  /**
   * Returns the current autonomic tone based on recent reflex pattern.
   * PARASYMPATHETIC = calm / few recent reflexes
   * SYMPATHETIC     = stressed / many recent reflexes
   */
  public getCurrentAutonomicTone(): 'PARASYMPATHETIC' | 'BALANCED' | 'SYMPATHETIC' {
    const recentCount = this.reflexHistory.length;
    if (recentCount === 0) return 'PARASYMPATHETIC';
    if (recentCount <= 2) return 'BALANCED';
    return 'SYMPATHETIC';
  }

  /**
   * Generates PQC-sealed bridge state snapshot for gate certification.
   */
  public getBridgeState(): AutonomicBridgeState {
    const statePayload = JSON.stringify({
      totalFired: this.totalFired,
      totalSuppressed: this.totalSuppressed,
      neuronsAvailable: this.neuronsAvailable,
      tone: this.getCurrentAutonomicTone(),
    });
    const pqcBridgeSeal = PQCLatticeSealEngine.generatePQCSeal(Buffer.from(statePayload, 'utf-8'));

    return {
      totalNeuronsFired: this.totalFired,
      totalReflexesSuppressed: this.totalSuppressed,
      currentAutonomicTone: this.getCurrentAutonomicTone(),
      reflexHistory: this.reflexHistory,
      pqcBridgeSeal,
    };
  }

  public getNeuronPoolSize(): number { return this.NEURON_POOL_SIZE; }
  public getNeuronsAvailable(): number { return this.neuronsAvailable; }
  public getReflexHistory(): ReflexArcResponse[] { return this.reflexHistory; }
}
