/**
 * ONE Language — Phase 3: 0/1 Reasoning Intelligence Engine
 * Module: State Explorer & Candidate Expansion (src/one/intelligence/reasoning/StateExplorer.ts)
 */

import { Candidate, ReasoningPolicy, ReasoningRule } from './types';
import { RuleRegistry } from './RuleRegistry';

export interface StateExplorerRecordTraceFn<T> {
  (eventType: 'RULE_APPLIED', reasonCode: string, candidateId: string, ruleId: string, stateBefore: T, stateAfter: T): void;
}

export class StateExplorer<T = unknown> {
  private candidateCounter = 0;
  private readonly seenSignatures: Set<string> = new Set();
  private readonly frontier: Candidate<T>[] = [];
  private readonly policy: ReasoningPolicy;
  private readonly stateHasher: (val: T) => string;

  /**
   * Construct a bounded state explorer with trace capture capability.
   * The trace recorder is REQUIRED — the engine always provides a real tracer
   * so every rule application emits a structured trace event with before/after state.
   * @param ruleRegistry - Rule registry supplying applicable transition rules
   * @param policy - Exploration policy (breadth-first by default)
   * @param stateHasher - Hash function for cycle/duplicate detection (JSON-based default)
   * @param recordTrace - Trace recorder; must be provided by the caller
   */
  constructor(
    private readonly ruleRegistry: RuleRegistry<T>,
    policy: ReasoningPolicy = ReasoningPolicy.BREADTH_FIRST,
    stateHasher: (val: T) => string = (v) => JSON.stringify(v),
    private readonly recordTrace: StateExplorerRecordTraceFn<T>,
  ) {
    this.policy = policy;
    this.stateHasher = stateHasher;
  }

  /**
   * Initializes the root candidate from starting input.
   */
  public initRoot(initialValue: T): Candidate<T> {
    const rootId = `cand_${this.candidateCounter++}`;
    const sig = this.stateHasher(initialValue);
    this.seenSignatures.add(sig);

    const rootCandidate: Candidate<T> = {
      id: rootId,
      value: initialValue,
      ruleId: 'INIT_STATE',
      derivation: 'root',
      depth: 0,
      status: 'GENERATED',
      stepIndex: 0,
    };

    this.frontier.push(rootCandidate);
    return rootCandidate;
  }

  /**
   * Selects the next candidate for exploration based on the exploration policy.
   */
  public nextCandidate(): Candidate<T> | undefined {
    if (this.frontier.length === 0) {
      return undefined;
    }
    if (this.policy === ReasoningPolicy.DEPTH_FIRST) {
      return this.frontier.pop(); // LIFO
    }
    // Default: BREADTH_FIRST (FIFO)
    return this.frontier.shift();
  }

  /**
   * Expands a candidate by applying all applicable rules.
   * Enforces duplicate rejection and creates deterministic candidate descriptors.
   */
  public expand(
    parent: Candidate<T>,
    context?: Record<string, unknown>,
    maxDepth?: number,
    recordTrace?: StateExplorerRecordTraceFn<T>,
  ): Candidate<T>[] {
    if (maxDepth !== undefined && parent.depth >= maxDepth) {
      return [];
    }

    const applicableRules = this.ruleRegistry.getApplicable(parent.value, context);
    const newCandidates: Candidate<T>[] = [];
    const tracer = recordTrace ?? this.recordTrace;

    for (const rule of applicableRules) {
      let results: T[] = [];
      try {
        results = rule.apply(parent.value, context as any);
      } catch {
        // Fail-closed on rule failure
        continue;
      }

      for (let i = 0; i < results.length; i++) {
        const resultVal = results[i];
        const sig = this.stateHasher(resultVal);

        // Cycle / duplicate detection
        if (this.seenSignatures.has(sig)) {
          continue;
        }
        this.seenSignatures.add(sig);

        const candId = `cand_${this.candidateCounter++}`;
        const derivation = `${parent.id} -> [${rule.id}] -> ${candId}`;

        // Record structured derivation trace: state before, rule applied, state after
        tracer('RULE_APPLIED', 'SUCCESS', candId, rule.id, parent.value, resultVal);

        const childCandidate: Candidate<T> = {
          id: candId,
          value: resultVal,
          parentId: parent.id,
          ruleId: rule.id,
          derivation,
          depth: parent.depth + 1,
          status: 'GENERATED',
          stepIndex: parent.stepIndex + 1,
        };

        newCandidates.push(childCandidate);
        this.frontier.push(childCandidate);
      }
    }

    return newCandidates;
  }

  /**
   * Frontier remaining size.
   */
  public frontierSize(): number {
    return this.frontier.length;
  }

  /**
   * Total candidates instantiated.
   */
  public totalGenerated(): number {
    return this.candidateCounter;
  }

  /**
   * Clears all exploration state.
   */
  public reset(): void {
    this.candidateCounter = 0;
    this.seenSignatures.clear();
    this.frontier.length = 0;
  }
}
