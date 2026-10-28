/**
 * ONE Language & CubiO Spatial VM - Phase 1 Prototype
 * Module 1: Bitstream Intelligence Agent (bitAgent.ts)
 *
 * Operates directly on raw binary bitstreams (0/1 or Uint8Array)
 * Computes Bit Density, sliding-window Hamming weight, and classifies streams.
 */

export type StreamClassification = 'LOW_ENTROPY_PATTERN' | 'HIGH_DENSITY_STREAM' | 'UNSTRUCTURED_NOISE';

export interface BitAgentAnalysis {
  totalBits: number;
  onesCount: number;
  zerosCount: number;
  bitDensity: number; // D = ones / (zeros + ones)
  slidingHammingWeights: number[]; // Windowed Hamming weights (default: 64-bit blocks)
  classification: StreamClassification;
  transitions: number; // 0->1 or 1->0 transition count
  transitionRate: number; // transitions / (totalBits - 1)
  fastPathEligible: boolean; // Zero-copy fast-path dispatch eligibility
}

export class BitAgent {
  private windowSize: number;

  constructor(windowSize: number = 64) {
    this.windowSize = windowSize;
  }

  /**
   * Normalize input into a string of '0' and '1' or array of bit numbers (0 or 1).
   */
  public static toBitString(input: Uint8Array | string): string {
    if (typeof input === 'string') {
      // If already binary digits
      if (/^[01]+$/.test(input)) {
        return input;
      }
      // Otherwise convert UTF-8 string to binary bits
      const encoder = new TextEncoder();
      const bytes = encoder.encode(input);
      return BitAgent.bytesToBitString(bytes);
    }
    return BitAgent.bytesToBitString(input);
  }

  /**
   * Convert byte array to continuous bit string (MSB to LSB).
   */
  public static bytesToBitString(bytes: Uint8Array): string {
    let bits = '';
    for (let i = 0; i < bytes.length; i++) {
      bits += bytes[i].toString(2).padStart(8, '0');
    }
    return bits;
  }

  /**
   * Convert binary bit string back to byte array.
   */
  public static bitStringToBytes(bitString: string): Uint8Array {
    const padLen = (8 - (bitString.length % 8)) % 8;
    const padded = bitString + '0'.repeat(padLen);
    const bytes = new Uint8Array(padded.length / 8);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(padded.slice(i * 8, (i + 1) * 8), 2);
    }
    return bytes;
  }

  /**
   * Analyze raw binary stream (string of '0'/'1' or Uint8Array)
   */
  public analyze(input: Uint8Array | string): BitAgentAnalysis {
    const bitStr = BitAgent.toBitString(input);
    const totalBits = bitStr.length;

    if (totalBits === 0) {
      return {
        totalBits: 0,
        onesCount: 0,
        zerosCount: 0,
        bitDensity: 0,
        slidingHammingWeights: [],
        classification: 'LOW_ENTROPY_PATTERN',
        transitions: 0,
        transitionRate: 0,
        fastPathEligible: true,
      };
    }

    let onesCount = 0;
    let transitions = 0;

    for (let i = 0; i < totalBits; i++) {
      if (bitStr[i] === '1') {
        onesCount++;
      }
      if (i > 0 && bitStr[i] !== bitStr[i - 1]) {
        transitions++;
      }
    }

    const zerosCount = totalBits - onesCount;
    const bitDensity = onesCount / totalBits;
    const transitionRate = totalBits > 1 ? transitions / (totalBits - 1) : 0;

    // Sliding window Hamming weights
    const slidingHammingWeights: number[] = [];
    const wSize = Math.max(1, this.windowSize);

    for (let i = 0; i < totalBits; i += wSize) {
      const chunk = bitStr.slice(i, Math.min(i + wSize, totalBits));
      let weight = 0;
      for (let j = 0; j < chunk.length; j++) {
        if (chunk[j] === '1') weight++;
      }
      slidingHammingWeights.push(weight);
    }

    // Classification Logic:
    // 1. LOW_ENTROPY_PATTERN: highly skewed density (D < 0.25 or D > 0.75) or very low transition rate (< 0.15)
    // 2. HIGH_DENSITY_STREAM: balanced density (0.4 <= D <= 0.6) and high transition rate (>= 0.45)
    // 3. UNSTRUCTURED_NOISE: intermediate or erratic patterns
    let classification: StreamClassification;
    let fastPathEligible = false;

    if (bitDensity < 0.25 || bitDensity > 0.75 || transitionRate < 0.15) {
      classification = 'LOW_ENTROPY_PATTERN';
      fastPathEligible = true; // Highly predictable, eligible for compression/fast-path
    } else if (bitDensity >= 0.4 && bitDensity <= 0.6 && transitionRate >= 0.45) {
      classification = 'HIGH_DENSITY_STREAM';
      fastPathEligible = true; // Structured balanced stream
    } else {
      classification = 'UNSTRUCTURED_NOISE';
      fastPathEligible = false;
    }

    return {
      totalBits,
      onesCount,
      zerosCount,
      bitDensity,
      slidingHammingWeights,
      classification,
      transitions,
      transitionRate,
      fastPathEligible,
    };
  }
}
