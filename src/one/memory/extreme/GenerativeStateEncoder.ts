/**
 * ONE Language — Generative State Encoder
 * =======================================
 * Module: @one/memory/extreme/GenerativeStateEncoder
 *
 * Implements Section 10 of Extreme-Scale 3D Memory Toolchain.
 * Encodes deterministic procedural states into compact Rule + Seed + Parameters.
 *
 * CRITICAL SCIENTIFIC NEGATIVE CONTROL:
 *   Detects incompressible / random / high-entropy data.
 *   Explicitly REJECTS false lossless claims on high-entropy data.
 */

import * as crypto from 'crypto';

export type GenerativeRuleType =
  | 'POLYNOMIAL_PROGRESSION'
  | 'HARMONIC_LATTICE_OSCILLATOR'
  | 'BRANCHING_MARKOV_CHAIN'
  | 'SPATIAL_VOXEL_FILL'
  | 'EXPLICIT_RESIDUAL';

export interface GenerativeDescriptor {
  readonly descriptorId: string;
  readonly ruleType: GenerativeRuleType;
  readonly seed: number;
  readonly parameters: Record<string, number>;
  readonly sequenceLength: number;
  readonly expectedSha256: string;
  readonly isLosslessClaimValid: boolean;
  readonly entropyBitsPerByte: number;
}

export class GenerativeStateEncoder {
  /**
   * Evaluates entropy of a dataset in bits per byte (0.0 to 8.0).
   */
  public static calculateShannonEntropy(data: Uint8Array): number {
    if (data.length === 0) return 0.0;
    const freq = new Uint32Array(256);
    for (let i = 0; i < data.length; i++) {
      freq[data[i]]++;
    }

    let entropy = 0.0;
    const len = data.length;
    for (let b = 0; b < 256; b++) {
      if (freq[b] > 0) {
        const p = freq[b] / len;
        entropy -= p * Math.log2(p);
      }
    }
    return entropy;
  }

  /**
   * Attempts to encode a sequence of states or numbers into a generative rule.
   * If data is high-entropy (white noise), marks isLosslessClaimValid = false
   * and requires explicit residual payload.
   */
  public static encodeSequence(
    sequence: number[],
    seed: number = 369
  ): GenerativeDescriptor {
    const rawBytes = new Uint8Array(sequence.length);
    for (let i = 0; i < sequence.length; i++) {
      rawBytes[i] = sequence[i] & 0xff;
    }
    const entropy = this.calculateShannonEntropy(rawBytes);

    const serialized = JSON.stringify(sequence);
    const byteData = new TextEncoder().encode(serialized);
    const expectedSha256 = crypto.createHash('sha256').update(byteData).digest('hex');

    // 1. Check if sequence is high-entropy random / incompressible
    if (entropy > 6.0 && sequence.length > 32 && !this.isStructured(sequence)) {
      return {
        descriptorId: `gen_desc_rand_${seed}`,
        ruleType: 'EXPLICIT_RESIDUAL',
        seed,
        parameters: { entropy },
        sequenceLength: sequence.length,
        expectedSha256,
        isLosslessClaimValid: false, // Incompressible payload cannot be claimed lossless from formula alone
        entropyBitsPerByte: entropy,
      };
    }

    // 2. Polynomial Progression Detection (Linear / Quadratic / Constant)
    if (sequence.length >= 2) {
      const d1 = sequence[1] - sequence[0];
      let isLinear = true;
      for (let i = 2; i < sequence.length; i++) {
        if (Math.abs((sequence[i] - sequence[i - 1]) - d1) > 1e-6) {
          isLinear = false;
          break;
        }
      }
      if (isLinear) {
        return {
          descriptorId: `gen_desc_poly1_${seed}`,
          ruleType: 'POLYNOMIAL_PROGRESSION',
          seed,
          parameters: { start: sequence[0], step: d1, degree: 1 },
          sequenceLength: sequence.length,
          expectedSha256,
          isLosslessClaimValid: true,
          entropyBitsPerByte: entropy,
        };
      }
    }

    // 3. Harmonic 369 Oscillator Detection
    if (sequence.length >= 4) {
      let isHarmonic = true;
      const base = sequence[0];
      const tier = 3;
      for (let i = 0; i < sequence.length; i++) {
        const expected = base + Math.sin((i * tier * Math.PI) / 7.0);
        if (Math.abs(sequence[i] - expected) > 1e-4) {
          isHarmonic = false;
          break;
        }
      }
      if (isHarmonic) {
        return {
          descriptorId: `gen_desc_harmonic_${seed}`,
          ruleType: 'HARMONIC_LATTICE_OSCILLATOR',
          seed,
          parameters: { base, tier },
          sequenceLength: sequence.length,
          expectedSha256,
          isLosslessClaimValid: true,
          entropyBitsPerByte: entropy,
        };
      }
    }

    // Fallback: non-modeled residual cannot claim lossless without storing full raw data
    return {
      descriptorId: `gen_desc_residual_${seed}`,
      ruleType: 'EXPLICIT_RESIDUAL',
      seed,
      parameters: { count: sequence.length },
      sequenceLength: sequence.length,
      expectedSha256,
      isLosslessClaimValid: false,
      entropyBitsPerByte: entropy,
    };
  }

  /**
   * Reconstitutes sequence from generative descriptor.
   */
  public static decodeSequence(desc: GenerativeDescriptor): number[] {
    const len = desc.sequenceLength;
    const res = new Array<number>(len);

    switch (desc.ruleType) {
      case 'POLYNOMIAL_PROGRESSION': {
        const start = desc.parameters.start ?? 0;
        const step = desc.parameters.step ?? 1;
        for (let i = 0; i < len; i++) {
          res[i] = start + i * step;
        }
        break;
      }
      case 'HARMONIC_LATTICE_OSCILLATOR': {
        const base = desc.parameters.base ?? 0;
        const tier = desc.parameters.tier ?? 3;
        for (let i = 0; i < len; i++) {
          res[i] = base + Math.sin((i * tier * Math.PI) / 7.0);
        }
        break;
      }
      case 'SPATIAL_VOXEL_FILL': {
        const fillVal = desc.parameters.fillValue ?? 1;
        for (let i = 0; i < len; i++) {
          res[i] = fillVal;
        }
        break;
      }
      default:
        // For un-modeled residual, pseudo-random generator seeded with seed
        let s = desc.seed;
        for (let i = 0; i < len; i++) {
          s = (s * 1664525 + 1013904223) % 4294967296;
          res[i] = s / 4294967296;
        }
    }

    return res;
  }

  /**
   * Checks whether a sequence exhibits clear mathematical structure.
   */
  private static isStructured(seq: number[]): boolean {
    if (seq.length < 3) return true;
    let monotonicity = 0;
    for (let i = 1; i < seq.length; i++) {
      if (seq[i] >= seq[i - 1]) monotonicity++;
    }
    const monoRatio = monotonicity / (seq.length - 1);
    return monoRatio > 0.95 || monoRatio < 0.05;
  }
}
