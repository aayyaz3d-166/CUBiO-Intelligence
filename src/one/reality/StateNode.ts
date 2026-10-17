/**
 * ONE Language — Reality State Node
 * ==================================
 * Module: @one/reality/StateNode
 *
 * Implements the STATE primitive in the PATH ≠ STATE ≠ REALITY ontology.
 * Represents an extensional snapshot of data/memory at a discrete virtual tick.
 * Two distinct paths can arrive at the exact same state (equifinality).
 */

import * as crypto from 'crypto';
import { NativeValue, isEqual, toRaw } from '../runtime/NativeValues';
import { CanonicalSerializer } from '../data/CanonicalSerializer';

export interface StateNodeOptions {
  stateId: string;
  revision: number;
  parentStateIds: string[];
  payload: NativeValue;
  createdAtTick: number;
}

export class StateNode {
  public readonly stateId: string;
  public readonly revision: number;
  public readonly parentStateIds: string[];
  public readonly payload: NativeValue;
  public readonly createdAtTick: number;
  public readonly stateHash: string;

  constructor(options: StateNodeOptions) {
    this.stateId = options.stateId;
    this.revision = options.revision;
    this.parentStateIds = [...options.parentStateIds];
    this.payload = options.payload;
    this.createdAtTick = options.createdAtTick;
    this.stateHash = StateNode.computeHash(this.payload);
  }

  /**
   * Deterministically computes cryptographic state hash from extensional payload.
   * Extensional identity: States with identical data configurations share the same hash,
   * preserving PATH != STATE (equifinality).
   */
  public static computeHash(payload: NativeValue, _revision?: number): string {
    const raw = CanonicalSerializer.serializeCanonicalJSON(toRaw(payload));
    return `0xSTATE_${crypto
      .createHash('sha256')
      .update(raw)
      .digest('hex')
      .substring(0, 16)
      .toUpperCase()}`;
  }

  /**
   * Structural equality: Two states are equal if their hashes and payloads are identical,
   * regardless of the paths taken to reach them.
   */
  public equals(other: StateNode): boolean {
    if (this.stateHash !== other.stateHash) return false;
    return isEqual(this.payload, other.payload);
  }

  /**
   * Checks if this state is a root state (no parents).
   */
  public isRoot(): boolean {
    return this.parentStateIds.length === 0;
  }

  /**
   * Checks if this state is a merge state (multiple parents).
   */
  public isMerge(): boolean {
    return this.parentStateIds.length > 1;
  }

  /**
   * Estimates memory footprint in bytes.
   */
  public estimateMemoryBytes(): number {
    const jsonLen = CanonicalSerializer.serializeCanonicalJSON(toRaw(this.payload)).length;
    return jsonLen + 128 + this.parentStateIds.length * 32;
  }
}
