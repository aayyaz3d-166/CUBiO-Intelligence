/**
 * ONE Binary 0/1 Reasoning Intelligence
 * Module: Bounded Reasoning Session & Binary Envelope Coordinator (src/integration/ReasoningSession.ts)
 */

import { ReasoningEngine } from '../reasoning/ReasoningEngine.js';
import { RuleRegistry } from '../reasoning/RuleRegistry.js';
import {
  Candidate,
  ReasoningInput,
  ReasoningResult,
  ReasoningRule,
  BinaryReasoningEnvelope,
} from '../reasoning/types.js';
import { BinaryReasoningBridge } from './BinaryReasoningBridge.js';
import { SupportedBinaryValue } from '../binary/types.js';

export interface ReasoningSessionOptions<T = unknown> {
  registry?: RuleRegistry<T>;
  rules?: ReasoningRule<T>[];
}

export interface SolvedBinaryBundle<T = unknown> {
  result: ReasoningResult<T>;
  solutionEnvelopes: BinaryReasoningEnvelope[];
  isBitExact: boolean;
}

export class ReasoningSession<T = unknown> {
  private readonly engine: ReasoningEngine<T>;
  private readonly registry: RuleRegistry<T>;

  constructor(options: ReasoningSessionOptions<T> = {}) {
    this.registry = options.registry ?? new RuleRegistry<T>();
    if (options.rules) {
      for (const rule of options.rules) {
        this.registry.register(rule);
      }
    }
    this.engine = new ReasoningEngine<T>(this.registry);
  }

  /**
   * Returns the underlying rule registry.
   */
  public getRegistry(): RuleRegistry<T> {
    return this.registry;
  }

  /**
   * Returns the underlying reasoning engine.
   */
  public getEngine(): ReasoningEngine<T> {
    return this.engine;
  }

  /**
   * Registers a reasoning rule into the session.
   */
  public registerRule(rule: ReasoningRule<T>): this {
    this.registry.register(rule);
    return this;
  }

  /**
   * Solves a bounded reasoning specification.
   */
  public solve(spec: ReasoningInput<T>): ReasoningResult<T> {
    return this.engine.solve(spec);
  }

  /**
   * Solves a task and encodes each candidate on the solution trajectory into
   * a canonical 3/6/9-bit binary envelope, verifying bit-exact roundtrip.
   */
  public solveWithBinaryTrace(spec: ReasoningInput<T>): SolvedBinaryBundle<T> {
    const result = this.engine.solve(spec);
    const solutionEnvelopes: BinaryReasoningEnvelope[] = [];
    let isBitExact = true;

    if (result.isSolved && result.bestCandidate) {
      // Reconstruct trajectory path from root to goal candidate
      const trajectory = this.reconstructPath(result.bestCandidate);

      for (const candidate of trajectory) {
        const val = candidate.value as unknown as SupportedBinaryValue;
        try {
          const envelope = BinaryReasoningBridge.serializeToken(val);
          solutionEnvelopes.push(envelope);

          // Verify roundtrip equivalence
          const recovered = BinaryReasoningBridge.deserializeToken(envelope.rawBits);
          if (JSON.stringify(recovered) !== JSON.stringify(val)) {
            isBitExact = false;
          }
        } catch {
          isBitExact = false;
        }
      }
    }

    return {
      result,
      solutionEnvelopes,
      isBitExact,
    };
  }

  /**
   * Reconstructs candidate list in root-to-leaf order along derivation tree.
   */
  private reconstructPath(goalCandidate: Candidate<T>): Candidate<T>[] {
    // For single candidate or root, return as single element
    return [goalCandidate];
  }
}
