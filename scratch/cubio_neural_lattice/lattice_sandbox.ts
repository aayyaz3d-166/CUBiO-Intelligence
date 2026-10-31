/**
 * CUBiO Lattice-Secured Variable Sandboxing & PQC Memory Guard
 * Target: Tamper-Proof Memory Slots & Fail-Closed Boundary Sandboxing
 */

import { PQCLatticeSealEngine } from '../../src/core/crypto/pqc_lattice_seal';

export interface SandboxedVariable<T> {
  name: string;
  type: 'number' | 'string' | 'tensor' | 'coordinate';
  value: T;
  bounds?: { min: number; max: number };
  pqcSeal: string;
  version: number;
  isQuarantined: boolean;
}

export class LatticeMemorySandbox {
  private variables: Map<string, SandboxedVariable<unknown>> = new Map();
  public is_actuation_blocked: boolean = true;

  /**
   * Allocates a PQC lattice-sealed variable in the secure sandbox.
   */
  public allocate<T>(
    name: string,
    type: 'number' | 'string' | 'tensor' | 'coordinate',
    initialValue: T,
    bounds?: { min: number; max: number }
  ): SandboxedVariable<T> {
    if (this.variables.has(name)) {
      throw new Error(`[Sandbox Error] Variable '${name}' already allocated in sandbox.`);
    }

    this.validateBounds(initialValue, bounds);

    const stateBuf = Buffer.from(`${name}:${type}:${JSON.stringify(initialValue)}:v1`, 'utf-8');
    const pqcSeal = PQCLatticeSealEngine.generatePQCSeal(stateBuf);

    const sandboxedVar: SandboxedVariable<T> = {
      name,
      type,
      value: initialValue,
      bounds,
      pqcSeal,
      version: 1,
      isQuarantined: false,
    };

    this.variables.set(name, sandboxedVar as SandboxedVariable<unknown>);
    return sandboxedVar;
  }

  /**
   * Securely reads a variable and validates its cryptographic lattice integrity.
   */
  public read<T>(name: string): T {
    const v = this.variables.get(name) as SandboxedVariable<T> | undefined;
    if (!v) {
      throw new Error(`[Sandbox Fault] Variable '${name}' not found.`);
    }

    if (v.isQuarantined) {
      throw new Error(`[Security Violation] Variable '${name}' is QUARANTINED due to memory tampering.`);
    }

    // Verify PQC seal integrity
    const stateBuf = Buffer.from(`${v.name}:${v.type}:${JSON.stringify(v.value)}:v${v.version}`, 'utf-8');
    const computedSeal = PQCLatticeSealEngine.generatePQCSeal(stateBuf);

    if (computedSeal !== v.pqcSeal) {
      v.isQuarantined = true;
      throw new Error(`[Cryptographic Integrity Breach] PQC Seal mismatch on '${name}'! Variable quarantined.`);
    }

    return v.value;
  }

  /**
   * Securely writes a value into the variable, validating bounds and updating the PQC seal.
   */
  public write<T>(name: string, newValue: T): SandboxedVariable<T> {
    const v = this.variables.get(name) as SandboxedVariable<T> | undefined;
    if (!v) {
      throw new Error(`[Sandbox Fault] Variable '${name}' not found.`);
    }

    if (v.isQuarantined) {
      throw new Error(`[Security Violation] Variable '${name}' is QUARANTINED.`);
    }

    // 1. Boundary & Type Validation
    this.validateBounds(newValue, v.bounds);

    // 2. Increment version and re-seal with PQC lattice hash
    const nextVersion = v.version + 1;
    const stateBuf = Buffer.from(`${v.name}:${v.type}:${JSON.stringify(newValue)}:v${nextVersion}`, 'utf-8');
    const nextPqcSeal = PQCLatticeSealEngine.generatePQCSeal(stateBuf);

    v.value = newValue;
    v.version = nextVersion;
    v.pqcSeal = nextPqcSeal;

    return v;
  }

  /**
   * Simulates an unauthorized external memory tampering attack.
   */
  public simulateTamperAttack(name: string, roguePayload: unknown): void {
    const v = this.variables.get(name);
    if (v) {
      // Bypasses secure write to simulate memory corruption
      (v as { value: unknown }).value = roguePayload;
    }
  }

  private validateBounds(value: unknown, bounds?: { min: number; max: number }): void {
    if (bounds && typeof value === 'number') {
      if (value < bounds.min || value > bounds.max) {
        throw new Error(`[Sandbox Boundary Violation] Value ${value} exceeds allowed range [${bounds.min}, ${bounds.max}].`);
      }
    }
  }

  public getVariablesCount(): number {
    return this.variables.size;
  }
}
