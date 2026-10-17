/**
 * ONE Language — Phase 3: 0/1 Reasoning Intelligence Engine
 * Module: Reasoning Types & Data Structures (src/one/intelligence/reasoning/types.ts)
 */

import { SupportedBinaryValue } from '../../../../src/binary/types';

/**
 * 0/1 Decision Signal
 * 1: Accept/continue under current rule/predicate
 * 0: Reject/stop under current rule/predicate
 */
export type DecisionSignal = 0 | 1;

/**
 * Categorical Decision Outcome
 */
export enum DecisionOutcome {
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
  DEFER = 'DEFER',
}

/**
 * High-Level Status of the Reasoning Result
 */
export enum ReasoningStatus {
  SOLVED = 'SOLVED',
  PARTIAL = 'PARTIAL',
  EXHAUSTED = 'EXHAUSTED',
  STEP_LIMIT = 'STEP_LIMIT',
  CANDIDATE_LIMIT = 'CANDIDATE_LIMIT',
  DEPTH_LIMIT = 'DEPTH_LIMIT',
  CANCELLED = 'CANCELLED',
  INVALID_INPUT = 'INVALID_INPUT',
  ERROR = 'ERROR',
}

/**
 * Reasoning Policy Strategy
 */
export enum ReasoningPolicy {
  BREADTH_FIRST = 'BREADTH_FIRST',
  DEPTH_FIRST = 'DEPTH_FIRST',
  GREEDY_BEST_FIRST = 'GREEDY_BEST_FIRST',
}

/**
 * Input & Specification of a Reasoning Task
 */
export interface ReasoningInput<T = unknown> {
  /** Initial starting value or state representation */
  input: T;
  /** Goal predicate or desired outcome target */
  goal: (candidate: T) => boolean;
  /** Optional human-readable goal description */
  goalDescription?: string;
  /** Invariant constraints that every valid candidate must satisfy */
  constraints?: Array<(candidate: T) => boolean>;
  /** Optional contextual facts or environmental state */
  context?: Record<string, unknown>;
  /** Execution budget limits */
  maxSteps?: number;
  maxCandidates?: number;
  maxDepth?: number;
  /** Exploration strategy policy */
  policy?: ReasoningPolicy;
  /** Optional timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Candidate Solution Node in the Reasoning Exploration Tree
 */
export interface Candidate<T = unknown> {
  /** Deterministic identifier (e.g., 'cand_0', 'cand_1') */
  id: string;
  /** The concrete proposed value or state */
  value: T;
  /** Identifier of parent candidate if derived from another candidate */
  parentId?: string;
  /** Identifier of rule applied to generate this candidate */
  ruleId: string;
  /** Concise, machine-readable derivation history */
  derivation: string;
  /** Depth level in the exploration tree (initial input = 0) */
  depth: number;
  /** Evaluation status */
  status: 'GENERATED' | 'ACCEPTED' | 'REJECTED' | 'INVALID' | 'UNEVALUATED';
  /** Creation step index */
  stepIndex: number;
  /** Whether this candidate is on the winning solution path */
  onSolutionPath?: boolean;
}

/**
 * Evaluation Breakdown for a Specific Candidate
 */
export interface CandidateEvaluation<T = unknown> {
  candidateId: string;
  candidateValue: T;
  /** Did the candidate pass all structural and domain constraints? */
  valid: boolean;
  /** Did the candidate satisfy the goal predicate? */
  goalSatisfied: boolean;
  /** 0/1 binary decision signal: 1 = ACCEPT/GOAL_MET, 0 = REJECT */
  decisionSignal: DecisionSignal;
  /** Numeric ranking score (higher is better; tie-breakers applied deterministically) */
  score: number;
  /** Detailed audit reasons for constraint passes, violations, or goal achievement */
  reasons: string[];
  /** Categorical decision */
  decision: DecisionOutcome;
}

/**
 * Structured Operational Event in the Reasoning Trace
 */
export interface ReasoningTraceEvent<T = unknown> {
  step: number;
  eventType:
    | 'TASK_INIT'
    | 'RULE_EVALUATED'
    | 'CANDIDATE_GENERATED'
    | 'CONSTRAINT_CHECK'
    | 'GOAL_CHECK'
    | 'DECISION_RECORDED'
    | 'RANKING_UPDATED'
    | 'RULE_APPLIED'
    | 'TERMINATION';
  /** The candidate under evaluation, if any */
  candidateId?: string;
  /** Rule identifier applied, if any */
  ruleId?: string;
  /** Decision outcome, if any */
  decision?: DecisionOutcome;
  /** 0/1 decision signal */
  signal?: 0 | 1;
  /** Numeric ranking score */
  score?: number;
  /** State before rule application (if root or state transition captured) */
  stateBefore?: T;
  /** State after rule application (if rule applied and state observed) */
  stateAfter?: T;
  /** Goal predicate result when evaluated */
  goalSatisfied?: boolean;
  /** Whether this candidate is on the successful solution path */
  isOnSolutionPath?: boolean;
  /** Reason code for termination or event classification */
  reasonCode: string;
  /** Remaining steps in budget */
  remainingSteps: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Final Deliverable from the Reasoning Engine
 */
export interface ReasoningResult<T = unknown> {
  /** Execution outcome status */
  status: ReasoningStatus;
  /** Whether a valid solution satisfying the goal was found */
  isSolved: boolean;
  /** The primary best candidate if solved or highest ranked partial */
  bestCandidate?: Candidate<T>;
  /** All ranked evaluated candidates that satisfied constraints */
  rankedCandidates: Array<{
    candidate: Candidate<T>;
    evaluation: CandidateEvaluation<T>;
  }>;
  /** Audit trail trace events */
  trace: ReasoningTraceEvent<T>[];
  /** Metric telemetry */
  metrics: {
    stepsUsed: number;
    candidatesGenerated: number;
    candidatesEvaluated: number;
    depthReached: number;
    elapsedMs: number;
  };
  /** Explicit reason for stopping */
  stopReason: string;
  /** Whether the goal predicate was satisfied by the best candidate */
  goalSatisfied?: boolean;
}

/**
 * Reusable Rule Contract
 */
export interface ReasoningRule<T = unknown, C = Record<string, unknown>> {
  /** Globally unique rule identifier */
  readonly id: string;
  /** Human-readable description */
  readonly description: string;
  /** Priority or cost weight for deterministic tie-breaking */
  readonly priority?: number;

  /**
   * Evaluates if this rule is applicable to the given value & context.
   * Returns binary signal: 1 if applicable, 0 if not.
   */
  isApplicable(value: T, context?: C): boolean;

  /**
   * Applies the rule to generate one or more candidate transitions.
   * Must be deterministic and side-effect free.
   */
  apply(value: T, context?: C): T[];
}

/**
 * Binary Serialization Envelope for Reasoning State Tokens
 */
export interface BinaryReasoningEnvelope {
  typeTag: string;
  rawBits: string;
  bitLength: number;
  decodedValue: SupportedBinaryValue;
}
