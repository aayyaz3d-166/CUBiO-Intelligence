/**
 * CUBiO Attention Gating Matrix — Top-Down Salience & Noise Suppression Filter
 * Gate: CNL-P30-001 | Sovereign Architecture ("one-cortex")
 *
 * Implements prefrontal cortex top-down sensory gating:
 * — Distinguishes high-salience operational signals from low-priority background noise.
 * — Suppresses redundant sensor fluctuations, heartbeat chatter, and trivial swarm pings
 *   before they consume compute, preventing SA Node tachycardia and energy pump exhaustion.
 * — High-priority security alerts and critical anomalies bypass suppression via attentional pop-out.
 */

import { PQCLatticeSealEngine } from '../../src/core/crypto/pqc_lattice_seal';

export type CognitiveModality = 'SENSORY_TELEMETRY' | 'SWARM_BROADCAST' | 'CARDIAC_AUTONOMIC' | 'SECURITY_THREAT';

export interface AttentionInputSignal {
  signalId: string;
  modality: CognitiveModality;
  sourceNode: string;
  magnitude: number;
  priorityLevel: 1 | 2 | 3; // 1 = Critical, 2 = Standard, 3 = Background
  isAnomaly: boolean;
  timestamp: number;
}

export interface GatedSignalOutput {
  signalId: string;
  modality: CognitiveModality;
  salienceScore: number;    // Computed salience [0.0..1.0]
  isGatedThrough: boolean;  // True = allowed to working memory/cortex; False = suppressed
  suppressionReason?: string;
  pqcGatingReceipt: string;
}

export interface AttentionGatingReport {
  totalSignalsProcessed: number;
  signalsGatedThrough: number;
  signalsSuppressed: number;
  noiseSuppressionRatePct: number;
  modalitySalienceMap: Record<CognitiveModality, number>;
  pqcAttentionFocusVector: string;
}

export class AttentionGatingMatrix {
  private noiseFloorThreshold: number = 0.45;
  private totalProcessed: number = 0;
  private totalSuppressed: number = 0;
  private totalGated: number = 0;

  // Modality salience running weights
  private modalityWeights: Record<CognitiveModality, number> = {
    SECURITY_THREAT: 1.0,
    CARDIAC_AUTONOMIC: 0.75,
    SENSORY_TELEMETRY: 0.60,
    SWARM_BROADCAST: 0.40,
  };

  constructor(customNoiseFloor: number = 0.45) {
    this.noiseFloorThreshold = customNoiseFloor;
  }

  /**
   * Computes the top-down salience score of an incoming signal [0.0..1.0].
   */
  public computeSalience(signal: AttentionInputSignal): number {
    // Critical security alerts or physical anomalies immediately achieve maximum salience (pop-out effect)
    if (signal.modality === 'SECURITY_THREAT' || signal.isAnomaly || signal.priorityLevel === 1) {
      return 1.0;
    }

    const modalityWeight = this.modalityWeights[signal.modality] || 0.5;
    const priorityFactor = signal.priorityLevel === 2 ? 0.6 : 0.2;
    const magnitudeFactor = Math.min(1.0, Math.max(0.0, signal.magnitude / 100.0));

    // Salience composite: weighted combination
    const salience = modalityWeight * 0.4 + priorityFactor * 0.4 + magnitudeFactor * 0.2;
    return Number(Math.min(1.0, Math.max(0.0, salience)).toFixed(4));
  }

  /**
   * Gates a single signal: passes if salience >= noiseFloorThreshold, suppresses otherwise.
   */
  public gateSignal(signal: AttentionInputSignal): GatedSignalOutput {
    this.totalProcessed++;
    const salience = this.computeSalience(signal);
    const isGatedThrough = salience >= this.noiseFloorThreshold;

    if (isGatedThrough) {
      this.totalGated++;
    } else {
      this.totalSuppressed++;
    }

    const reason = isGatedThrough
      ? undefined
      : `Noise floor suppression: salience ${salience} < threshold ${this.noiseFloorThreshold}`;

    const receiptPayload = `GATE:${signal.signalId}|MOD:${signal.modality}|SAL:${salience}|PASS:${isGatedThrough}`;
    const pqcGatingReceipt = PQCLatticeSealEngine.generatePQCSeal(Buffer.from(receiptPayload, 'utf-8'));

    return {
      signalId: signal.signalId,
      modality: signal.modality,
      salienceScore: salience,
      isGatedThrough,
      suppressionReason: reason,
      pqcGatingReceipt,
    };
  }

  /**
   * Batch gates an array of input signals, returning only those that pass the attention threshold.
   */
  public filterBatch(signals: AttentionInputSignal[]): {
    passedSignals: AttentionInputSignal[];
    gatedOutputs: GatedSignalOutput[];
  } {
    const passedSignals: AttentionInputSignal[] = [];
    const gatedOutputs: GatedSignalOutput[] = [];

    for (const sig of signals) {
      const output = this.gateSignal(sig);
      gatedOutputs.push(output);
      if (output.isGatedThrough) {
        passedSignals.push(sig);
      }
    }

    return { passedSignals, gatedOutputs };
  }

  /**
   * Generates a PQC-sealed Attention Gating & Focus Report.
   */
  public generateAttentionReport(): AttentionGatingReport {
    const suppressionRate =
      this.totalProcessed > 0 ? (this.totalSuppressed / this.totalProcessed) * 100.0 : 0.0;

    const payload = JSON.stringify({
      gate: 'CNL-P30-001',
      total: this.totalProcessed,
      gated: this.totalGated,
      suppressed: this.totalSuppressed,
      suppressionRate,
      modalityWeights: this.modalityWeights,
    });
    const pqcAttentionFocusVector = PQCLatticeSealEngine.generatePQCSeal(Buffer.from(payload, 'utf-8'));

    return {
      totalSignalsProcessed: this.totalProcessed,
      signalsGatedThrough: this.totalGated,
      signalsSuppressed: this.totalSuppressed,
      noiseSuppressionRatePct: Number(suppressionRate.toFixed(4)),
      modalitySalienceMap: { ...this.modalityWeights },
      pqcAttentionFocusVector,
    };
  }

  public getNoiseFloorThreshold(): number {
    return this.noiseFloorThreshold;
  }

  public setNoiseFloorThreshold(threshold: number): void {
    this.noiseFloorThreshold = threshold;
  }
}
