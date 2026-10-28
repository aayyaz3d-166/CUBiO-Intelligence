/**
 * ONE Language — State Transition
 * ================================
 * Module: @one/reality/Transition
 *
 * Implements the TRANSITION primitive representing a directed causal delta
 * from an origin state to a successor state within a worldline.
 */

import * as crypto from 'crypto';
import { NativeValue, toRaw } from '../runtime/NativeValues';
import { CanonicalSerializer } from '../data/CanonicalSerializer';

export interface TransitionOptions {
  transitionId: string;
  fromStateId: string;
  toStateId: string;
  action: string;
  params?: Record<string, NativeValue>;
  cost?: number;
  tick: number;
}

export class StateTransition {
  public readonly transitionId: string;
  public readonly fromStateId: string;
  public readonly toStateId: string;
  public readonly action: string;
  public readonly params: Record<string, NativeValue>;
  public readonly cost: number;
  public readonly tick: number;
  public readonly signature: string;

  constructor(options: TransitionOptions) {
    this.transitionId = options.transitionId;
    this.fromStateId = options.fromStateId;
    this.toStateId = options.toStateId;
    this.action = options.action;
    this.params = options.params ?? {};
    this.cost = options.cost ?? 1.0;
    this.tick = options.tick;
    this.signature = StateTransition.computeSignature(
      this.fromStateId,
      this.toStateId,
      this.action,
      this.params,
      this.tick
    );
  }

  /**
   * Deterministically computes a cryptographic signature for this transition.
   */
  public static computeSignature(
    fromStateId: string,
    toStateId: string,
    action: string,
    params: Record<string, NativeValue>,
    tick: number
  ): string {
    const rawParams: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params)) {
      rawParams[k] = toRaw(v);
    }
    const paramsJSON = CanonicalSerializer.serializeCanonicalJSON(rawParams);

    return `0xTRANS_${crypto
      .createHash('sha256')
      .update(fromStateId)
      .update(toStateId)
      .update(action)
      .update(paramsJSON)
      .update(String(tick))
      .digest('hex')
      .substring(0, 16)
      .toUpperCase()}`;
  }

  /**
   * Checks whether this transition connects state A to state B.
   */
  public connects(from: string, to: string): boolean {
    return this.fromStateId === from && this.toStateId === to;
  }

  /**
   * Estimates memory footprint in bytes.
   */
  public estimateMemoryBytes(): number {
    return 192 + this.action.length + Object.keys(this.params).length * 48;
  }
}
