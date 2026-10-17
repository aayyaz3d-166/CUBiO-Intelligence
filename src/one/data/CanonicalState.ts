/**
 * ONE Language — Canonical State Data Structure
 * =============================================
 * Module: @one/data/CanonicalState
 *
 * Revision-tracked state entity supporting transactional commit, rollback,
 * zero-variance delta diffing, and CUBiO Address369 provenance binding.
 *
 * Invariants:
 *   - Monotonically increasing revision sequence ID
 *   - Checkpoints are cryptographically anchored by SHA-256 state hashes
 *   - Diffing produces bit-exact deterministic diff reports
 */

import * as crypto from 'crypto';
import { CanonicalObject } from './CanonicalObject';
import { NativeValue, isEqual, formatNativeValue } from '../runtime/NativeValues';

export interface StateRevision {
  revisionId: number;
  timestamp: number;
  stateHash: string;
  snapshot: Record<string, NativeValue>;
}

export interface StateDiff {
  revisionFrom: number;
  revisionTo: number;
  addedKeys: string[];
  removedKeys: string[];
  modifiedKeys: Array<{ key: string; oldValue: string; newValue: string }>;
  isIdentical: boolean;
}

export class CanonicalState {
  public readonly stateId: string;
  public readonly canonicalAddress?: number; // Optional Address369 binding [0..368]
  private revisionId: number = 0;
  private currentData: CanonicalObject;
  private history: Map<number, StateRevision> = new Map();
  private readonly maxHistoryLength: number = 64;

  constructor(stateId: string, initialData?: Record<string, NativeValue>, canonicalAddress?: number) {
    this.stateId = stateId;
    this.canonicalAddress = canonicalAddress;
    this.currentData = new CanonicalObject(initialData);
    this.commit(); // Initial revision 0
  }

  public getRevisionId(): number {
    return this.revisionId;
  }

  public get(key: string): NativeValue | undefined {
    return this.currentData.get(key);
  }

  public set(key: string, value: NativeValue): this {
    this.currentData.set(key, value);
    return this;
  }

  public has(key: string): boolean {
    return this.currentData.has(key);
  }

  public delete(key: string): boolean {
    return this.currentData.delete(key);
  }

  public getData(): CanonicalObject {
    return this.currentData;
  }

  /**
   * Commits current state, increments revision ID, and records snapshot in history.
   */
  public commit(): StateRevision {
    this.revisionId++;
    const stateHash = this.computeHash();
    const snapshot: Record<string, NativeValue> = {};
    for (const [k, v] of this.currentData.entries()) {
      snapshot[k] = v;
    }

    const revision: StateRevision = {
      revisionId: this.revisionId,
      timestamp: Date.now(),
      stateHash,
      snapshot,
    };

    this.history.set(this.revisionId, revision);

    // Prune oldest revisions if exceeding maxHistoryLength
    if (this.history.size > this.maxHistoryLength) {
      const oldestKey = Math.min(...Array.from(this.history.keys()));
      this.history.delete(oldestKey);
    }

    return revision;
  }

  /**
   * Rolls back state to a specific revision in history.
   */
  public rollback(targetRevisionId: number): boolean {
    const historical = this.history.get(targetRevisionId);
    if (!historical) {
      throw new Error(
        `[CanonicalState E7004] Target revision ${targetRevisionId} not found in history for state '${this.stateId}'`
      );
    }

    this.currentData = new CanonicalObject(historical.snapshot);
    this.revisionId = targetRevisionId;
    return true;
  }

  public getRevision(revisionId: number): StateRevision | undefined {
    return this.history.get(revisionId);
  }

  public getHistoryRevisions(): number[] {
    return Array.from(this.history.keys()).sort((a, b) => a - b);
  }

  /**
   * Computes SHA-256 state hash binding stateId, revisionId, and sorted data.
   */
  public computeHash(): string {
    const dataHash = this.currentData.computeHash();
    const payload = `${this.stateId}:${this.revisionId}:${this.canonicalAddress ?? 'NONE'}:${dataHash}`;
    const hash = crypto.createHash('sha256').update(payload).digest('hex');
    return `0xSTATE_${hash.substring(0, 16).toUpperCase()}`;
  }

  /**
   * Computes deterministic diff between current state and another state.
   */
  public diff(other: CanonicalState): StateDiff {
    const myKeys = new Set(this.currentData.keys());
    const otherKeys = new Set(other.currentData.keys());

    const addedKeys: string[] = [];
    const removedKeys: string[] = [];
    const modifiedKeys: Array<{ key: string; oldValue: string; newValue: string }> = [];

    // Check additions and modifications
    for (const k of otherKeys) {
      if (!myKeys.has(k)) {
        addedKeys.push(k);
      } else {
        const vMy = this.currentData.get(k)!;
        const vOther = other.currentData.get(k)!;
        if (!isEqual(vMy, vOther)) {
          modifiedKeys.push({
            key: k,
            oldValue: formatNativeValue(vMy),
            newValue: formatNativeValue(vOther),
          });
        }
      }
    }

    // Check removals
    for (const k of myKeys) {
      if (!otherKeys.has(k)) {
        removedKeys.push(k);
      }
    }

    addedKeys.sort();
    removedKeys.sort();
    modifiedKeys.sort((a, b) => a.key.localeCompare(b.key));

    const isIdentical =
      addedKeys.length === 0 &&
      removedKeys.length === 0 &&
      modifiedKeys.length === 0;

    return {
      revisionFrom: this.revisionId,
      revisionTo: other.revisionId,
      addedKeys,
      removedKeys,
      modifiedKeys,
      isIdentical,
    };
  }

  public estimateMemoryBytes(): number {
    let bytes = 128; // State overhead
    bytes += this.currentData.estimateMemoryBytes();
    for (const rev of this.history.values()) {
      bytes += 64 + Object.keys(rev.snapshot).length * 16;
    }
    return bytes;
  }
}
