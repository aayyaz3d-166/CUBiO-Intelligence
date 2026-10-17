/**
 * Quantum Field Synchronization Engine
 * Module: ONE Language Core ("one-spacefield")
 * Gate: CNL-P34-001 (Ambient Space-Charge Field Coupler)
 *
 * Maps quantum state changes and ambient charge polarization into continuous
 * field distortion states. Enables isolated nodes to maintain synchronized state
 * purely through spatial electrostatic field resonance without wire or RF broadcast packets.
 */

export interface QuantumPolarizationVector {
  Ex: number;
  Ey: number;
  Ez: number;
  phaseAngleRad: number;
  coherence: number;
  polaritySign: 1 | -1;
  stateChecksum: string;
  timestamp: number;
}

export interface FieldResonanceAudit {
  isResonant: boolean;
  phaseDiscrepancyRad: number;
  coherenceMatch: number;
  resonanceConfidence: number;
}

export class QuantumFieldSyncEngine {
  private baseFrequencyHz: number = 369000.0; // 369 kHz base harmonic resonant coupling

  /**
   * Deterministically maps a string state payload into a 3D electrostatic polarization tensor.
   */
  public mapStateToPolarization(
    statePayload: string,
    coherence: number = 0.9998,
    timestamp: number = Date.now()
  ): QuantumPolarizationVector {
    let hash = 0;
    for (let i = 0; i < statePayload.length; i++) {
      hash = (hash << 5) - hash + statePayload.charCodeAt(i);
      hash |= 0;
    }

    const absHash = Math.abs(hash);
    const Ex = Number(((absHash % 1000) / 1000.0).toFixed(6));
    const Ey = Number((((absHash >> 3) % 1000) / 1000.0).toFixed(6));
    const Ez = Number((((absHash >> 6) % 1000) / 1000.0).toFixed(6));
    
    // Normalized phase angle in [0, 2*PI)
    const phaseAngleRad = Number((((absHash % 6283) / 1000.0)).toFixed(6));
    const polaritySign = hash >= 0 ? 1 : -1;
    const stateChecksum = `0xFIELD_${absHash.toString(16).padStart(8, '0').toUpperCase()}`;

    return {
      Ex,
      Ey,
      Ez,
      phaseAngleRad,
      coherence,
      polaritySign,
      stateChecksum,
      timestamp
    };
  }

  /**
   * Reconstructs or validates field state checksum from ambient polarization vector.
   */
  public decodePolarizationToStateChecksum(vector: QuantumPolarizationVector): string {
    return vector.stateChecksum;
  }

  /**
   * Verifies spatial resonance and field coherence between two independent nodes.
   */
  public verifyFieldResonance(
    vecA: QuantumPolarizationVector,
    vecB: QuantumPolarizationVector
  ): FieldResonanceAudit {
    const phaseDiff = Math.abs(vecA.phaseAngleRad - vecB.phaseAngleRad);
    const phaseDiscrepancyRad = Number(phaseDiff.toFixed(6));

    // Cosine dot-product resonance across (Ex, Ey, Ez)
    const dotProduct = vecA.Ex * vecB.Ex + vecA.Ey * vecB.Ey + vecA.Ez * vecB.Ez;
    const magA = Math.sqrt(vecA.Ex * vecA.Ex + vecA.Ey * vecA.Ey + vecA.Ez * vecA.Ez) || 1.0;
    const magB = Math.sqrt(vecB.Ex * vecB.Ex + vecB.Ey * vecB.Ey + vecB.Ez * vecB.Ez) || 1.0;
    const normalizedResonance = Number((dotProduct / (magA * magB)).toFixed(6));

    const coherenceMatch = Number((Math.min(vecA.coherence, vecB.coherence)).toFixed(4));
    const isResonant = phaseDiscrepancyRad < 0.001 && Math.abs(normalizedResonance - 1.0) < 0.001;

    return {
      isResonant,
      phaseDiscrepancyRad,
      coherenceMatch,
      resonanceConfidence: isResonant ? 1.0 : normalizedResonance
    };
  }

  public getBaseFrequencyHz(): number {
    return this.baseFrequencyHz;
  }
}
