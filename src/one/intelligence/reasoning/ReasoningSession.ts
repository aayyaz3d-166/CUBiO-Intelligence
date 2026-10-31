/**
 * ONE Language — Phase 3: 0/1 Reasoning Intelligence Engine
 * Module: Bounded Reasoning Session & Binary Envelope Coordinator (src/one/intelligence/reasoning/ReasoningSession.ts)
 */

import { ReasoningEngine } from './ReasoningEngine';
import { RuleRegistry } from './RuleRegistry';
import {
  Candidate,
  ReasoningInput,
  ReasoningResult,
  ReasoningRule,
  BinaryReasoningEnvelope,
} from './types';
import { BinaryReasoningBridge } from './BinaryReasoningBridge';
import { SupportedBinaryValue } from '../../../../src/binary/types';
import { ModelReasoningAdapter } from './ModelReasoningAdapter';

export interface ReasoningSessionOptions<T = unknown> {
  registry?: RuleRegistry<T>;
  rules?: ReasoningRule<T>[];
  modelAdapter?: ModelReasoningAdapter<T>;
}

export interface SolvedBinaryBundle<T = unknown> {
  result: ReasoningResult<T>;
  solutionEnvelopes: BinaryReasoningEnvelope[];
  isBitExact: boolean;
}

export class ReasoningSession<T = unknown> {
  private readonly engine: ReasoningEngine<T>;
  private readonly registry: RuleRegistry<T>;
  private modelAdapter?: ModelReasoningAdapter<T>;
  private cancelled: boolean = false;

  constructor(options: ReasoningSessionOptions<T> = {}) {
    this.registry = options.registry ?? new RuleRegistry<T>();
    if (options.rules) {
      for (const rule of options.rules) {
        this.registry.register(rule);
      }
    }
    this.engine = new ReasoningEngine<T>(this.registry);
    this.modelAdapter = options.modelAdapter;
  }

  /**
   * Sets the model reasoning adapter for model-assisted scoring.
   */
  public setModelAdapter(adapter: ModelReasoningAdapter<T>): this {
    this.modelAdapter = adapter;
    return this;
  }

  /**
   * Returns the current model reasoning adapter if configured.
   */
  public getModelAdapter(): ModelReasoningAdapter<T> | undefined {
    return this.modelAdapter;
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
   * Signals cancellation for all subsequent or in-flight reasoning tasks in this session.
   */
  public cancel(): void {
    this.cancelled = true;
  }

  /**
   * Resets the session cancellation signal.
   */
  public resetCancellation(): void {
    this.cancelled = false;
  }

  /**
   * Solves a bounded reasoning specification.
   */
  public solve(spec: ReasoningInput<T>): ReasoningResult<T> {
    const effectiveSpec: ReasoningInput<T> = {
      ...spec,
      isCancelled: () => (spec.isCancelled ? spec.isCancelled() : false) || this.cancelled,
    };
    return this.engine.solve(effectiveSpec);
  }

  /**
   * Solves a task and encodes each candidate on the solution trajectory into
   * a canonical 3/6/9-bit binary envelope, verifying bit-exact roundtrip.
   */
  public solveWithBinaryTrace(spec: ReasoningInput<T>): SolvedBinaryBundle<T> {
    const effectiveSpec: ReasoningInput<T> = {
      ...spec,
      isCancelled: () => (spec.isCancelled ? spec.isCancelled() : false) || this.cancelled,
    };
    const result = this.engine.solve(effectiveSpec);
    const solutionEnvelopes: BinaryReasoningEnvelope[] = [];
    let isBitExact = true;

    if (result.isSolved && result.bestCandidate) {
      // Reconstruct full trajectory path from root to goal candidate
      const trajectory = this.reconstructPath(result.bestCandidate, result);

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
   * Solves a bounded reasoning specification and re-ranks candidate evaluations with
   * model-assisted scoring if a model adapter is configured.
   */
  public solveWithModelAssistance(spec: ReasoningInput<T>): ReasoningResult<T> {
    const result = this.solve(spec);
    if (this.modelAdapter && result.rankedCandidates.length > 0) {
      const modelRanked = this.modelAdapter.rankCandidatesWithModel(
        result.rankedCandidates,
        spec.goalDescription
      );
      result.rankedCandidates = modelRanked.map((mr) => ({
        candidate: mr.candidate,
        evaluation: mr.evaluation,
      }));
      if (result.rankedCandidates.length > 0 && result.rankedCandidates[0].evaluation.valid) {
        result.bestCandidate = result.rankedCandidates[0].candidate;
      }
    }
    return result;
  }

  /**
   * Reconstructs candidate list in root-to-leaf order along derivation tree.
   */
  private reconstructPath(goalCandidate: Candidate<T>, result?: ReasoningResult<T>): Candidate<T>[] {
    if (!result || !result.rankedCandidates || result.rankedCandidates.length === 0) {
      return [goalCandidate];
    }
    const path: Candidate<T>[] = [goalCandidate];
    let curr: Candidate<T> | undefined = goalCandidate;
    const visited = new Set<string>([goalCandidate.id]);

    while (curr && curr.parentId) {
      const parentId: string = curr.parentId;
      if (visited.has(parentId)) break;
      visited.add(parentId);
      const parentCand: Candidate<T> | undefined = result.rankedCandidates.find((c) => c.candidate.id === parentId)?.candidate;
      if (parentCand) {
        path.unshift(parentCand);
        curr = parentCand;
      } else {
        break;
      }
    }
    return path;
  }
}
