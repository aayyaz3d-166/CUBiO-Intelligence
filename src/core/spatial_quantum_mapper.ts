/**
 * CUBiO / AGI ONE — GATE CNL-P26.3
 * SPATIAL QUANTUM MAPPING ENGINE
 * MATHEMATICAL STATE SIMULATOR — NATIVE ONE LANGUAGE
 *
 * File: f:\ONE language\src\core\spatial_quantum_mapper.ts
 * Module: @one/core/spatial-quantum-mapper
 * Specification: Gate CNL-P26.3 Execution Specification v1.0
 *
 * EPISTEMIC LOCK (UUP = 1.0):
 * CUBIO_WORLD_MODEL_COMPUTATIONAL_REPRESENTATION_NOT_OBJECTIVE_REALITY_OR_AGI
 *
 * This module is a pure mathematical spatial-state simulator for the 3D Memory Studio.
 * It produces COMPUTED / SIMULATED states. It does NOT produce experimentally measured
 * quantum states, physical quantum fields, or physical space-charge measurements.
 *
 * HARD TECHNOLOGY LOCK:
 * - NO React, Tailwind, CSS, HTML, DOM, Three.js, WebGL, Browser APIs, Canvas APIs
 * - NO Node.js runtime built-in dependencies (self-contained pure TypeScript / ONE AST)
 * - NO remote APIs, cloud inference, external models, external AI
 * - ZERO Math.random() usage — all generation is strictly reproducible and deterministic
 */

// ============================================================================
// 1. EVIDENCE & STATUS TYPES
// ============================================================================

export type EvidenceClass =
  | 'SIMULATED'
  | 'COMPUTED'
  | 'MEASURED'
  | 'EXPERIMENTALLY_VALIDATED';

export type SimulationStatus =
  | 'COMPUTED'
  | 'UNVERIFIED'
  | 'FAILED';

export type PhysicalSignalStatus =
  | 'UNAVAILABLE'
  | 'AVAILABLE'
  | 'DEGRADED';

// ============================================================================
// 2. ERROR CLASSES (FAIL CLOSED)
// ============================================================================

export class NumericalInstabilityError extends Error {
  constructor(message: string) {
    super(`[P26.3 Numerical Instability Error] ${message}`);
    this.name = 'NumericalInstabilityError';
  }
}

export class LatticeValidationError extends Error {
  constructor(message: string) {
    super(`[P26.3 Lattice Validation Error] ${message}`);
    this.name = 'LatticeValidationError';
  }
}

export class StateDimensionError extends Error {
  constructor(message: string) {
    super(`[P26.3 State Dimension Error] ${message}`);
    this.name = 'StateDimensionError';
  }
}

export class IntegrityVerificationError extends Error {
  constructor(message: string) {
    super(`[P26.3 Integrity Verification Error] ${message}`);
    this.name = 'IntegrityVerificationError';
  }
}

// ============================================================================
// 3. COMPLEX NUMBER & HILBERT SPACE FORMULATION
// ============================================================================

/**
 * Explicit representation of a complex number in the state vector space.
 * Complex numbers are represented via explicit real and imaginary components.
 */
export interface ComplexNumber {
  readonly real: number;
  readonly imag: number;
}

export class ComplexMath {
  public static create(real: number, imag: number): ComplexNumber {
    if (!Number.isFinite(real) || !Number.isFinite(imag)) {
      throw new NumericalInstabilityError(`Non-finite complex values: real=${real}, imag=${imag}`);
    }
    return { real, imag };
  }

  public static magnitudeSq(c: ComplexNumber): number {
    return c.real * c.real + c.imag * c.imag;
  }

  public static magnitude(c: ComplexNumber): number {
    return Math.sqrt(this.magnitudeSq(c));
  }

  public static add(a: ComplexNumber, b: ComplexNumber): ComplexNumber {
    return this.create(a.real + b.real, a.imag + b.imag);
  }

  public static multiply(a: ComplexNumber, b: ComplexNumber): ComplexNumber {
    return this.create(
      a.real * b.real - a.imag * b.imag,
      a.real * b.imag + a.imag * b.real
    );
  }

  /**
   * Inner product ⟨ψ|ϕ⟩ = ∑ (ψ_c* · ϕ_c) for finite dimensional state vectors in Hilbert space ℂ^343.
   */
  public static innerProduct(psi: readonly ComplexNumber[], phi: readonly ComplexNumber[]): ComplexNumber {
    if (psi.length !== phi.length) {
      throw new StateDimensionError(`Dimension mismatch in inner product: ${psi.length} vs ${phi.length}`);
    }
    let sumReal = 0;
    let sumImag = 0;
    for (let c = 0; c < psi.length; c++) {
      const pr = psi[c].real;
      const pi = psi[c].imag;
      const qr = phi[c].real;
      const qi = phi[c].imag;
      sumReal += pr * qr + pi * qi;
      sumImag += pr * qi - pi * qr;
    }
    return this.create(sumReal, sumImag);
  }
}

// ============================================================================
// 4. CANONICAL DATA STRUCTURES
// ============================================================================

export interface LatticeCoordinate {
  readonly i: number; // 0..6
  readonly j: number; // 0..6
  readonly k: number; // 0..6
}

export interface QuantumCellState {
  readonly cell_id: number;       // 0..342 (canonical cellId = i * 49 + j * 7 + k)
  readonly address369: number;    // 26..368 (canonical address369 = 26 + cellId)
  readonly display_index: number; // 1..343 (for human UI display numbering only: cellId + 1)
  readonly i: number;             // 0..6
  readonly j: number;             // 0..6
  readonly k: number;             // 0..6

  readonly amplitude: number;     // Normalized real amplitude [-1.0, 1.0]
  readonly probability: number;   // Normalized probability [0.0, 1.0]
  readonly phase: number;         // Phase angle in canonical domain [-π, π)
  readonly resonance: number;     // Intent resonance [0.0, 1.0]

  readonly wave_state: ComplexNumber; // Explicit complex amplitude (real + i*imag)
  readonly state_hash: string;    // SHA-256 integrity hash of cell state
}

export interface MathematicalParameters {
  readonly base_frequency: number; // Fundamental harmonic frequency (e.g., 3.0, 6.0, 9.0)
  readonly phase_velocity: number; // Deterministic phase velocity
  readonly decay_constant: number; // Spatial attenuation coefficient
  readonly harmonic_order: number; // Order of harmonic resonance
}

export interface IntentVector {
  readonly direction: readonly [number, number, number];   // Normalized 3D direction vector
  readonly focus_point: readonly [number, number, number]; // Target focus point in lattice [0..6]^3
  readonly intensity: number;                              // Intent scaling [0.0, 1.0]
}

export interface WaveState {
  readonly real: number;
  readonly imag: number;
  readonly probability_amplitude: number;
}

export interface LatticeSnapshot {
  readonly schema_version: string;
  readonly engine_version: string;
  readonly seed: number;
  readonly state_epoch: number;
  readonly lattice_dimensions: readonly [7, 7, 7];
  readonly cell_count: 343;
  readonly lattice_state_matrix: readonly QuantumCellState[];
  readonly simulation_status: 'COMPUTED';
  readonly evidence_class: 'SIMULATED';
  readonly physical_signal: PhysicalSignalStatus;
  readonly canonical_hash: string;
}

// ============================================================================
// 5. SELF-CONTAINED PURE TYPESCRIPT SHA-256 ENGINE (ZERO NODE.JS DEPENDENCIES)
// ============================================================================

export class PureSha256 {
  private static readonly K: Uint32Array = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  private static rotr(x: number, n: number): number {
    return (x >>> n) | (x << (32 - n));
  }

  public static hashString(str: string): string {
    const bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
      let code = str.charCodeAt(i);
      if (code < 0x80) {
        bytes.push(code);
      } else if (code < 0x800) {
        bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else if (code < 0xd800 || code >= 0xe000) {
        bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      } else {
        i++;
        code = 0x10000 + (((code & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
        bytes.push(
          0xf0 | (code >> 18),
          0x80 | ((code >> 12) & 0x3f),
          0x80 | ((code >> 6) & 0x3f),
          0x80 | (code & 0x3f)
        );
      }
    }

    const byteLen = bytes.length;
    const bitLen = byteLen * 8;

    bytes.push(0x80);

    while ((bytes.length % 64) !== 56) {
      bytes.push(0);
    }

    const upperBits = Math.floor(bitLen / 0x100000000);
    bytes.push(
      (upperBits >>> 24) & 0xff,
      (upperBits >>> 16) & 0xff,
      (upperBits >>> 8) & 0xff,
      upperBits & 0xff
    );
    bytes.push(
      (bitLen >>> 24) & 0xff,
      (bitLen >>> 16) & 0xff,
      (bitLen >>> 8) & 0xff,
      bitLen & 0xff
    );

    let h0 = 0x6a09e667;
    let h1 = 0xbb67ae85;
    let h2 = 0x3c6ef372;
    let h3 = 0xa54ff53a;
    let h4 = 0x510e527f;
    let h5 = 0x9b05688c;
    let h6 = 0x1f83d9ab;
    let h7 = 0x5be0cd19;

    const w = new Uint32Array(64);

    for (let chunk = 0; chunk < bytes.length; chunk += 64) {
      for (let i = 0; i < 16; i++) {
        const offset = chunk + i * 4;
        w[i] =
          (bytes[offset] << 24) |
          (bytes[offset + 1] << 16) |
          (bytes[offset + 2] << 8) |
          bytes[offset + 3];
      }

      for (let i = 16; i < 64; i++) {
        const s0 = this.rotr(w[i - 15], 7) ^ this.rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = this.rotr(w[i - 2], 17) ^ this.rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }

      let a = h0;
      let b = h1;
      let c = h2;
      let d = h3;
      let e = h4;
      let f = h5;
      let g = h6;
      let h = h7;

      for (let i = 0; i < 64; i++) {
        const S1 = this.rotr(e, 6) ^ this.rotr(e, 11) ^ this.rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + this.K[i] + w[i]) | 0;
        const S0 = this.rotr(a, 2) ^ this.rotr(a, 13) ^ this.rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) | 0;

        h = g;
        g = f;
        f = e;
        e = (d + temp1) | 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) | 0;
      }

      h0 = (h0 + a) | 0;
      h1 = (h1 + b) | 0;
      h2 = (h2 + c) | 0;
      h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0;
      h5 = (h5 + f) | 0;
      h6 = (h6 + g) | 0;
      h7 = (h7 + h) | 0;
    }

    const toHex = (n: number): string => (n >>> 0).toString(16).padStart(8, '0');
    return `${toHex(h0)}${toHex(h1)}${toHex(h2)}${toHex(h3)}${toHex(h4)}${toHex(h5)}${toHex(h6)}${toHex(h7)}`;
  }
}

// ============================================================================
// 6. DETERMINISTIC PRNG ENGINE (MULBERRY32 / SPLITMIX32)
// ============================================================================

export class DeterministicPrng {
  private state: number;

  constructor(seed: number) {
    if (!Number.isFinite(seed) || Number.isNaN(seed)) {
      throw new NumericalInstabilityError(`Invalid PRNG seed: ${seed}`);
    }
    this.state = (Math.floor(seed) ^ 0x36936936) >>> 0;
    if (this.state === 0) {
      this.state = 0xdeadbeef;
    }
  }

  public nextFloat(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public nextSignedFloat(): number {
    return this.nextFloat() * 2.0 - 1.0;
  }
}

// ============================================================================
// 7. SOVEREIGN SPATIAL QUANTUM MAPPING ENGINE
// ============================================================================

export class SpatialQuantumMapper {
  public static readonly ENGINE_VERSION: string = '1.0.0-ONE-NATIVE';
  public static readonly SCHEMA_VERSION: string = 'CNL-P26.3-V1';
  public static readonly CANONICAL_CELL_COUNT: 343 = 343; // 7 x 7 x 7
  public static readonly LATTICE_DIMENSIONS: readonly [number, number, number] = [7, 7, 7];

  public static readonly SPATIAL_START_ADDRESS369: number = 26;
  public static readonly SPATIAL_END_ADDRESS369: number = 368;
  public static readonly TOTAL_ADDRESS369_REGISTERS: number = 369;

  public static readonly PROBABILITY_SUM_TOLERANCE: number = 1e-6;

  // ==========================================================================
  // FUNCTION 1: initialize_lattice()
  // ==========================================================================

  public static initialize_lattice(): QuantumCellState[] {
    const cells: QuantumCellState[] = [];
    const seenIds = new Set<number>();
    const seenCoords = new Set<string>();
    const seenAddresses = new Set<number>();

    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        for (let k = 0; k < 7; k++) {
          const cellId = i * 49 + j * 7 + k;
          const address369 = this.SPATIAL_START_ADDRESS369 + cellId;
          const displayIndex = cellId + 1;

          if (seenIds.has(cellId)) {
            throw new LatticeValidationError(`Duplicate canonical cell_id: ${cellId}`);
          }
          const coordKey = `${i},${j},${k}`;
          if (seenCoords.has(coordKey)) {
            throw new LatticeValidationError(`Duplicate coordinate key: ${coordKey}`);
          }
          if (seenAddresses.has(address369)) {
            throw new LatticeValidationError(`Duplicate address369: ${address369}`);
          }

          seenIds.add(cellId);
          seenCoords.add(coordKey);
          seenAddresses.add(address369);

          const initialCell: QuantumCellState = {
            cell_id: cellId,
            address369: address369,
            display_index: displayIndex,
            i,
            j,
            k,
            amplitude: 0.0,
            probability: 1.0 / this.CANONICAL_CELL_COUNT,
            phase: 0.0,
            resonance: 0.5,
            wave_state: { real: 0.0, imag: 0.0 },
            state_hash: ''
          };

          const hash = this.compute_cell_hash(initialCell);
          cells.push({
            ...initialCell,
            state_hash: hash
          });
        }
      }
    }

    if (cells.length !== this.CANONICAL_CELL_COUNT) {
      throw new LatticeValidationError(
        `Lattice cell count mismatch: expected ${this.CANONICAL_CELL_COUNT}, got ${cells.length}`
      );
    }
    if (seenIds.size !== this.CANONICAL_CELL_COUNT) {
      throw new LatticeValidationError(`Unique cell ID count mismatch: got ${seenIds.size}`);
    }
    if (seenAddresses.size !== this.CANONICAL_CELL_COUNT) {
      throw new LatticeValidationError(`Unique Address369 count mismatch: got ${seenAddresses.size}`);
    }

    return cells;
  }

  // ==========================================================================
  // FUNCTION 2: generate_state_vector()
  // ==========================================================================

  public static generate_state_vector(
    seed: number,
    epoch: number,
    params: MathematicalParameters,
    dimension: number = this.CANONICAL_CELL_COUNT
  ): Float64Array {
    if (!Number.isFinite(seed) || Number.isNaN(seed)) {
      throw new NumericalInstabilityError(`Invalid seed: ${seed}`);
    }
    if (!Number.isFinite(epoch) || epoch < 0 || !Number.isInteger(epoch)) {
      throw new NumericalInstabilityError(`Invalid epoch: ${epoch}`);
    }
    if (!Number.isFinite(dimension) || dimension <= 0 || !Number.isInteger(dimension)) {
      throw new StateDimensionError(`Invalid vector dimension: ${dimension}`);
    }
    if (!Number.isFinite(params.base_frequency) || params.base_frequency <= 0) {
      throw new NumericalInstabilityError(`Invalid base_frequency: ${params.base_frequency}`);
    }

    const compositeSeed = (
      Math.floor(seed) ^
      (epoch * 31) ^
      Math.floor(params.base_frequency * 1000)
    ) >>> 0;

    const prng = new DeterministicPrng(compositeSeed);
    const vector = new Float64Array(dimension);

    for (let c = 0; c < dimension; c++) {
      const harmonicFactor = Math.sin((c * params.harmonic_order * Math.PI) / dimension);
      const rawVal = prng.nextSignedFloat() + harmonicFactor * 0.5;

      if (!Number.isFinite(rawVal) || Number.isNaN(rawVal)) {
        throw new NumericalInstabilityError(`Generated non-finite value at index ${c}`);
      }

      vector[c] = Math.max(-10.0, Math.min(10.0, rawVal));
    }

    return vector;
  }

  // ==========================================================================
  // FUNCTION 3: normalize_probability_vector()
  // ==========================================================================

  public static normalize_probability_vector(logits: Float64Array | readonly number[]): Float64Array {
    const len = logits.length;
    if (len === 0) {
      throw new StateDimensionError(`Cannot normalize empty probability vector`);
    }

    let maxVal = -Infinity;
    for (let i = 0; i < len; i++) {
      const v = logits[i];
      if (!Number.isFinite(v) || Number.isNaN(v)) {
        throw new NumericalInstabilityError(`Cannot normalize vector containing NaN or Infinity at index ${i}`);
      }
      if (v > maxVal) {
        maxVal = v;
      }
    }

    const expValues = new Float64Array(len);
    let sumExp = 0.0;

    for (let i = 0; i < len; i++) {
      const expVal = Math.exp(logits[i] - maxVal);
      if (!Number.isFinite(expVal) || Number.isNaN(expVal)) {
        throw new NumericalInstabilityError(`Numerical overflow in exp calculation at index ${i}`);
      }
      expValues[i] = expVal;
      sumExp += expVal;
    }

    if (!Number.isFinite(sumExp) || sumExp <= 0.0 || Number.isNaN(sumExp)) {
      throw new NumericalInstabilityError(`Invalid sum of exponentials: ${sumExp}`);
    }

    const probabilities = new Float64Array(len);
    let totalProbability = 0.0;

    for (let i = 0; i < len; i++) {
      const p = expValues[i] / sumExp;
      if (!Number.isFinite(p) || p < 0.0 || p > 1.0) {
        throw new NumericalInstabilityError(`Normalized probability out of bounds: p[${i}]=${p}`);
      }
      probabilities[i] = p;
      totalProbability += p;
    }

    if (Math.abs(totalProbability - 1.0) > this.PROBABILITY_SUM_TOLERANCE) {
      throw new NumericalInstabilityError(
        `Probability sum violation: expected ~1.0, got ${totalProbability} (delta=${Math.abs(totalProbability - 1.0)})`
      );
    }

    return probabilities;
  }

  // ==========================================================================
  // FUNCTION 4: compute_phase()
  // ==========================================================================

  public static compute_phase(
    seed: number,
    coord: LatticeCoordinate,
    frequency: number,
    epoch: number
  ): number {
    if (!Number.isFinite(seed) || Number.isNaN(seed)) {
      throw new NumericalInstabilityError(`Invalid seed for phase computation: ${seed}`);
    }
    if (!Number.isFinite(frequency) || frequency <= 0) {
      throw new NumericalInstabilityError(`Invalid frequency for phase computation: ${frequency}`);
    }
    if (coord.i < 0 || coord.i > 6 || coord.j < 0 || coord.j > 6 || coord.k < 0 || coord.k > 6) {
      throw new LatticeValidationError(`Coordinate out of 7x7x7 bounds: (${coord.i}, ${coord.j}, ${coord.k})`);
    }

    const spatialPhase = (coord.i * 3.0 + coord.j * 6.0 + coord.k * 9.0) / 18.0;
    const temporalPhase = (epoch * frequency * 0.1) % (2.0 * Math.PI);
    const seedOffset = ((seed % 369) / 369.0) * (2.0 * Math.PI);

    const rawPhase = spatialPhase * Math.PI + temporalPhase + seedOffset;

    return this.normalize_phase_domain(rawPhase);
  }

  public static normalize_phase_domain(angle: number): number {
    if (!Number.isFinite(angle) || Number.isNaN(angle)) {
      throw new NumericalInstabilityError(`Cannot normalize non-finite angle: ${angle}`);
    }
    const twoPi = 2.0 * Math.PI;
    let norm = angle % twoPi;
    if (norm >= Math.PI) {
      norm -= twoPi;
    } else if (norm < -Math.PI) {
      norm += twoPi;
    }
    if (norm < -Math.PI || norm >= Math.PI) {
      norm = -Math.PI;
    }
    return norm;
  }

  // ==========================================================================
  // FUNCTION 5: compute_intent_resonance()
  // ==========================================================================

  public static compute_intent_resonance(
    coord: LatticeCoordinate,
    intent: IntentVector,
    phase: number,
    frequency: number,
    seed: number
  ): number {
    if (coord.i < 0 || coord.i > 6 || coord.j < 0 || coord.j > 6 || coord.k < 0 || coord.k > 6) {
      throw new LatticeValidationError(`Coordinate out of 7x7x7 bounds: (${coord.i}, ${coord.j}, ${coord.k})`);
    }
    if (!Number.isFinite(phase) || Number.isNaN(phase)) {
      throw new NumericalInstabilityError(`Invalid phase for intent resonance: ${phase}`);
    }
    if (!Number.isFinite(intent.intensity) || intent.intensity < 0.0 || intent.intensity > 1.0) {
      throw new NumericalInstabilityError(`Intent intensity out of bounds [0.0, 1.0]: ${intent.intensity}`);
    }

    const dx = coord.i - intent.focus_point[0];
    const dy = coord.j - intent.focus_point[1];
    const dz = coord.k - intent.focus_point[2];
    const distSq = dx * dx + dy * dy + dz * dz;
    const distance = Math.sqrt(distSq);

    const dirNorm = Math.sqrt(
      intent.direction[0] * intent.direction[0] +
      intent.direction[1] * intent.direction[1] +
      intent.direction[2] * intent.direction[2]
    );
    const dirAlignment = dirNorm > 0
      ? (dx * intent.direction[0] + dy * intent.direction[1] + dz * intent.direction[2]) / (dirNorm * (distance + 1e-9))
      : 0.0;

    const phaseExpression = phase + frequency * 0.1 * distance + dirAlignment * Math.PI * 0.5;
    const rawResonance = (1.0 + Math.sin(phaseExpression)) / 2.0;
    const modulatedResonance = rawResonance * intent.intensity + 0.5 * (1.0 - intent.intensity);

    if (!Number.isFinite(modulatedResonance) || modulatedResonance < 0.0 || modulatedResonance > 1.0) {
      throw new NumericalInstabilityError(`Resonance calculation out of [0, 1] range: ${modulatedResonance}`);
    }

    return modulatedResonance;
  }

  // ==========================================================================
  // FUNCTION 6: compute_wave_state()
  // ==========================================================================

  public static compute_wave_state(
    coord: LatticeCoordinate,
    phase: number,
    frequency: number,
    amplitude: number
  ): WaveState {
    if (!Number.isFinite(phase) || !Number.isFinite(amplitude)) {
      throw new NumericalInstabilityError(`Invalid phase (${phase}) or amplitude (${amplitude}) in wave state`);
    }

    const real = amplitude * Math.cos(phase);
    const imag = amplitude * Math.sin(phase);
    const probability_amplitude = real * real + imag * imag;

    if (!Number.isFinite(real) || !Number.isFinite(imag) || !Number.isFinite(probability_amplitude)) {
      throw new NumericalInstabilityError(`Numerical error in wave state calculation`);
    }

    return {
      real,
      imag,
      probability_amplitude
    };
  }

  // ==========================================================================
  // FUNCTION 7: canonicalize_lattice_state()
  // ==========================================================================

  public static canonicalize_lattice_state(cells: readonly QuantumCellState[]): QuantumCellState[] {
    if (cells.length !== this.CANONICAL_CELL_COUNT) {
      throw new LatticeValidationError(
        `Canonicalization failed: cell count ${cells.length} != ${this.CANONICAL_CELL_COUNT}`
      );
    }

    const sorted = [...cells].sort((a, b) => a.cell_id - b.cell_id);

    for (let c = 0; c < this.CANONICAL_CELL_COUNT; c++) {
      if (sorted[c].cell_id !== c) {
        throw new LatticeValidationError(
          `Canonicalization failed: cell at index ${c} has unexpected cell_id ${sorted[c].cell_id}`
        );
      }
      if (sorted[c].address369 !== this.SPATIAL_START_ADDRESS369 + c) {
        throw new LatticeValidationError(
          `Canonicalization failed: cell ${c} has mismatched address369 ${sorted[c].address369}`
        );
      }
    }

    return sorted;
  }

  // ==========================================================================
  // FUNCTION 8: verify_lattice_integrity()
  // ==========================================================================

  public static verify_lattice_integrity(snapshot: LatticeSnapshot): boolean {
    if (snapshot.cell_count !== this.CANONICAL_CELL_COUNT) {
      throw new IntegrityVerificationError(`Invalid cell count in snapshot: ${snapshot.cell_count}`);
    }
    if (snapshot.lattice_state_matrix.length !== this.CANONICAL_CELL_COUNT) {
      throw new IntegrityVerificationError(
        `Matrix length mismatch: ${snapshot.lattice_state_matrix.length} != ${this.CANONICAL_CELL_COUNT}`
      );
    }
    if (snapshot.simulation_status !== 'COMPUTED') {
      throw new IntegrityVerificationError(`Simulation status is not COMPUTED: ${snapshot.simulation_status}`);
    }
    if (snapshot.evidence_class !== 'SIMULATED') {
      throw new IntegrityVerificationError(`Evidence class is not SIMULATED: ${snapshot.evidence_class}`);
    }

    let sumProb = 0.0;
    for (let c = 0; c < this.CANONICAL_CELL_COUNT; c++) {
      const cell = snapshot.lattice_state_matrix[c];
      if (cell.cell_id !== c) {
        throw new IntegrityVerificationError(`Cell out of order at index ${c}: cell_id=${cell.cell_id}`);
      }
      if (cell.probability < 0.0 || cell.probability > 1.0) {
        throw new IntegrityVerificationError(`Cell ${c} probability out of bounds: ${cell.probability}`);
      }
      if (cell.resonance < 0.0 || cell.resonance > 1.0) {
        throw new IntegrityVerificationError(`Cell ${c} resonance out of bounds: ${cell.resonance}`);
      }
      if (cell.phase < -Math.PI || cell.phase >= Math.PI) {
        throw new IntegrityVerificationError(`Cell ${c} phase out of canonical domain [-π, π): ${cell.phase}`);
      }
      sumProb += cell.probability;
    }

    if (Math.abs(sumProb - 1.0) > this.PROBABILITY_SUM_TOLERANCE) {
      throw new IntegrityVerificationError(`Total probability sum drift: ${sumProb}`);
    }

    const recomputedHash = this.compute_snapshot_hash(
      snapshot.schema_version,
      snapshot.engine_version,
      snapshot.seed,
      snapshot.state_epoch,
      snapshot.lattice_state_matrix
    );

    if (recomputedHash !== snapshot.canonical_hash) {
      throw new IntegrityVerificationError(
        `Canonical hash mismatch: snapshot=${snapshot.canonical_hash}, computed=${recomputedHash}`
      );
    }

    return true;
  }

  // ==========================================================================
  // FUNCTION 9: compute_lattice_snapshot()
  // ==========================================================================

  public static compute_lattice_snapshot(
    seed: number,
    epoch: number,
    params: MathematicalParameters,
    intent: IntentVector
  ): LatticeSnapshot {
    const baseCells = this.initialize_lattice();
    const stateVector = this.generate_state_vector(seed, epoch, params, this.CANONICAL_CELL_COUNT);
    const probabilities = this.normalize_probability_vector(stateVector);

    const updatedCells: QuantumCellState[] = [];
    for (let c = 0; c < this.CANONICAL_CELL_COUNT; c++) {
      const base = baseCells[c];
      const coord: LatticeCoordinate = { i: base.i, j: base.j, k: base.k };

      const phase = this.compute_phase(seed, coord, params.base_frequency, epoch);
      const resonance = this.compute_intent_resonance(coord, intent, phase, params.base_frequency, seed);
      const amplitude = Math.sin(phase) * Math.cos(coord.i * 0.5);
      const waveState = this.compute_wave_state(coord, phase, params.base_frequency, amplitude);

      const cellData: QuantumCellState = {
        cell_id: base.cell_id,
        address369: base.address369,
        display_index: base.display_index,
        i: base.i,
        j: base.j,
        k: base.k,
        amplitude: Math.max(-1.0, Math.min(1.0, amplitude)),
        probability: probabilities[c],
        phase,
        resonance,
        wave_state: { real: waveState.real, imag: waveState.imag },
        state_hash: ''
      };

      const cellHash = this.compute_cell_hash(cellData);
      updatedCells.push({
        ...cellData,
        state_hash: cellHash
      });
    }

    const canonicalMatrix = this.canonicalize_lattice_state(updatedCells);

    const canonicalHash = this.compute_snapshot_hash(
      this.SCHEMA_VERSION,
      this.ENGINE_VERSION,
      seed,
      epoch,
      canonicalMatrix
    );

    const snapshot: LatticeSnapshot = {
      schema_version: this.SCHEMA_VERSION,
      engine_version: this.ENGINE_VERSION,
      seed,
      state_epoch: epoch,
      lattice_dimensions: [7, 7, 7],
      cell_count: 343,
      lattice_state_matrix: canonicalMatrix,
      simulation_status: 'COMPUTED',
      evidence_class: 'SIMULATED',
      physical_signal: 'UNAVAILABLE',
      canonical_hash: canonicalHash
    };

    return this.deepFreeze(snapshot);
  }

  // ==========================================================================
  // HELPER INTEGRITY & HASHING METHODS
  // ==========================================================================

  public static compute_cell_hash(cell: QuantumCellState): string {
    const serialized = [
      cell.cell_id,
      cell.address369,
      cell.i,
      cell.j,
      cell.k,
      cell.amplitude.toFixed(8),
      cell.probability.toFixed(8),
      cell.phase.toFixed(8),
      cell.resonance.toFixed(8),
      cell.wave_state.real.toFixed(8),
      cell.wave_state.imag.toFixed(8)
    ].join('|');

    return PureSha256.hashString(`CELL_v1:${serialized}`);
  }

  public static compute_snapshot_hash(
    schemaVersion: string,
    engineVersion: string,
    seed: number,
    epoch: number,
    matrix: readonly QuantumCellState[]
  ): string {
    const hashes = matrix.map(c => this.compute_cell_hash(c)).join(',');
    const header = `${schemaVersion}|${engineVersion}|${seed}|${epoch}|343`;
    return PureSha256.hashString(`LATTICE_SNAPSHOT_v1:${header}:${hashes}`);
  }

  private static deepFreeze<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    Object.freeze(obj);
    for (const key of Object.getOwnPropertyNames(obj)) {
      const prop = (obj as Record<string, unknown>)[key];
      if (prop !== null && typeof prop === 'object' && !Object.isFrozen(prop)) {
        this.deepFreeze(prop);
      }
    }
    return obj;
  }
}
