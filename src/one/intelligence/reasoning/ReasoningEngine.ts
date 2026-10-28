/**
 * ONE Language — Phase 3: 0/1 Reasoning Intelligence Engine
 * Module: Bounded Reasoning Engine (src/one/intelligence/reasoning/ReasoningEngine.ts)
 */

import {
  Candidate,
  CandidateEvaluation,
  DecisionOutcome,
  ReasoningInput,
  ReasoningPolicy,
  ReasoningResult,
  ReasoningStatus,
  ReasoningTraceEvent,
} from './types';
import { RuleRegistry } from './RuleRegistry';
import { StateExplorer } from './StateExplorer';
import { CandidateEvaluator } from './CandidateEvaluator';

export class ReasoningEngine<T = unknown> {
  private readonly ruleRegistry: RuleRegistry<T>;
  private readonly evaluator: CandidateEvaluator<T>;

  constructor(ruleRegistry?: RuleRegistry<T>) {
    this.ruleRegistry = ruleRegistry ?? new RuleRegistry<T>();
    this.evaluator = new CandidateEvaluator<T>();
  }

  /**
   * Returns the underlying rule registry for dynamic rule configuration.
   */
  public getRegistry(): RuleRegistry<T> {
    return this.ruleRegistry;
  }

  /**
   * Executes a bounded, deterministic reasoning loop given an input specification.
   */
  public solve(spec: ReasoningInput<T>): ReasoningResult<T> {
    const startTime = performance.now();
    const trace: ReasoningTraceEvent<T>[] = [];

    // 1. Validate Input & Goal
    if (spec.input === undefined || typeof spec.goal !== 'function') {
      return {
        status: ReasoningStatus.INVALID_INPUT,
        isSolved: false,
        rankedCandidates: [],
        trace,
        metrics: {
          stepsUsed: 0,
          candidatesGenerated: 0,
          candidatesEvaluated: 0,
          depthReached: 0,
          elapsedMs: performance.now() - startTime,
        },
        stopReason: 'Invalid input state or missing goal predicate',
      };
    }

    // Default configuration budgets
    const maxSteps = spec.maxSteps ?? 100;
    const maxCandidates = spec.maxCandidates ?? 250;
    const maxDepth = spec.maxDepth ?? 20;
    const policy = spec.policy ?? ReasoningPolicy.BREADTH_FIRST;

    // Zero-budget guard
    if (maxSteps <= 0) {
      return {
        status: ReasoningStatus.STEP_LIMIT,
        isSolved: false,
        rankedCandidates: [],
        trace,
        metrics: {
          stepsUsed: 0,
          candidatesGenerated: 0,
          candidatesEvaluated: 0,
          depthReached: 0,
          elapsedMs: performance.now() - startTime,
        },
        stopReason: 'Zero step budget configured',
      };
    }

    // Pre-flight cancellation guard
    if (spec.isCancelled && spec.isCancelled()) {
      return {
        status: ReasoningStatus.CANCELLED,
        isSolved: false,
        rankedCandidates: [],
        trace,
        metrics: {
          stepsUsed: 0,
          candidatesGenerated: 0,
          candidatesEvaluated: 0,
          depthReached: 0,
          elapsedMs: performance.now() - startTime,
        },
        stopReason: 'Reasoning execution cancelled prior to start',
      };
    }

    // Initialize State Explorer with a real trace recorder
    const explorer = new StateExplorer<T>(
      this.ruleRegistry,
      policy,
      (v) => JSON.stringify(v), // JSON-based state hasher (default)
      (eventType, reasonCode, candId, ruleId, stateBefore, stateAfter) => {
        if (eventType === 'RULE_APPLIED') {
          // The explorer's tracer emits structured RULE_APPLIED events with
          // before/after state; route them directly into the engine's trace buffer.
          recordTrace(
            'RULE_APPLIED',
            reasonCode,
            candId,
            ruleId,
            undefined,
            undefined,
            undefined,
            stateBefore,
            stateAfter,
            undefined,
            undefined,
          );
        }
      },
    );
    const root = explorer.initRoot(spec.input);

    const evaluatedList: Array<{
      candidate: Candidate<T>;
      evaluation: CandidateEvaluation<T>;
    }> = [];

    let stepsUsed = 0;
    let candidatesEvaluated = 0;
    let depthReached = 0;
    let isSolved = false;
    let bestCandidate: Candidate<T> | undefined;
    let stopReason = '';
    let finalStatus = ReasoningStatus.EXHAUSTED;

    const recordTrace = (
      eventType: ReasoningTraceEvent['eventType'],
      reasonCode: string,
      candId?: string,
      ruleId?: string,
      decision?: DecisionOutcome,
      signal?: 0 | 1,
      score?: number,
      stateBefore?: T,
      stateAfter?: T,
      goalSatisfied?: boolean,
      isOnSolutionPath?: boolean,
    ) => {
      trace.push({
        step: stepsUsed,
        eventType,
        candidateId: candId,
        ruleId,
        decision,
        signal,
        score,
        stateBefore,
        stateAfter,
        goalSatisfied,
        isOnSolutionPath,
        reasonCode,
        remainingSteps: maxSteps - stepsUsed,
        timestamp: performance.now() - startTime,
      });
    };

    recordTrace('TASK_INIT', `Started reasoning loop with policy ${policy}`);

    // Initial check on root candidate
    const rootEval = this.evaluator.evaluate(root, spec);
    candidatesEvaluated++;
    evaluatedList.push({ candidate: root, evaluation: rootEval });
    recordTrace(
      'GOAL_CHECK',
      rootEval.goalSatisfied ? 'GOAL_SATISFIED_AT_ROOT' : 'GOAL_NOT_SATISFIED_AT_ROOT',
      root.id,
      root.ruleId,
      rootEval.decision,
      rootEval.decisionSignal,
      rootEval.score,
    );

    if (rootEval.goalSatisfied) {
      isSolved = true;
      bestCandidate = root;
      finalStatus = ReasoningStatus.SOLVED;
      stopReason = 'Goal satisfied at root state';
    }

    // Main Bounded Reasoning Loop
    while (!isSolved && stepsUsed < maxSteps) {
      // Check cancellation and timeout limits
      if (
        (spec.isCancelled && spec.isCancelled()) ||
        (spec.timeoutMs !== undefined && (performance.now() - startTime) >= spec.timeoutMs)
      ) {
        finalStatus = ReasoningStatus.CANCELLED;
        stopReason = spec.isCancelled && spec.isCancelled()
          ? 'Reasoning execution cancelled by caller'
          : `Execution timed out (${spec.timeoutMs}ms limit exceeded)`;
        break;
      }

      // Step budget check
      stepsUsed++;

      // Next candidate from exploration frontier
      const current = explorer.nextCandidate();
      if (!current) {
        finalStatus = ReasoningStatus.EXHAUSTED;
        stopReason = 'Frontier exhausted: no further transitions available';
        break;
      }

      if (current.depth > depthReached) {
        depthReached = current.depth;
      }

      // Check depth limit
      if (current.depth >= maxDepth) {
        recordTrace('RULE_EVALUATED', 'DEPTH_LIMIT_REACHED', current.id);
        continue;
      }

      // Expand candidate via applicable rules
      const children = explorer.expand(current, spec.context, maxDepth);

      for (const child of children) {
        // Enforce max candidates budget
        if (explorer.totalGenerated() > maxCandidates) {
          finalStatus = ReasoningStatus.CANDIDATE_LIMIT;
          stopReason = `Candidate budget limit (${maxCandidates}) reached`;
          break;
        }

        recordTrace('CANDIDATE_GENERATED', 'NEW_CANDIDATE', child.id, child.ruleId);

        // Evaluate child
        const evaluation = this.evaluator.evaluate(child, spec);
        candidatesEvaluated++;

        recordTrace(
          'DECISION_RECORDED',
          evaluation.goalSatisfied ? 'GOAL_MATCH' : evaluation.valid ? 'VALID_STEP' : 'REJECTED_STEP',
          child.id,
          child.ruleId,
          evaluation.decision,
          evaluation.decisionSignal,
          evaluation.score,
        );

        if (evaluation.valid) {
          child.status = evaluation.decision === DecisionOutcome.ACCEPT ? 'ACCEPTED' : 'REJECTED';
          evaluatedList.push({ candidate: child, evaluation });

          if (evaluation.goalSatisfied) {
            isSolved = true;
            bestCandidate = child;
            finalStatus = ReasoningStatus.SOLVED;
            stopReason = `Goal predicate satisfied by candidate ${child.id}`;
            break;
          }
        } else {
          child.status = 'INVALID';
        }
      }

      if (finalStatus === ReasoningStatus.CANDIDATE_LIMIT) {
        break;
      }
    }

    if (!isSolved && stepsUsed >= maxSteps && finalStatus !== ReasoningStatus.CANDIDATE_LIMIT && finalStatus !== ReasoningStatus.CANCELLED) {
      finalStatus = ReasoningStatus.STEP_LIMIT;
      stopReason = `Step budget limit (${maxSteps}) reached`;
    }

    // Rank all evaluated candidates deterministically
    const rankedCandidates = this.evaluator.rank(evaluatedList);

    if (!bestCandidate && rankedCandidates.length > 0 && rankedCandidates[0].evaluation.valid) {
      bestCandidate = rankedCandidates[0].candidate;
    }

    recordTrace('TERMINATION', stopReason);

    const result: ReasoningResult<T> = {
      status: finalStatus,
      isSolved,
      bestCandidate,
      rankedCandidates,
      trace,
      metrics: {
        stepsUsed,
        candidatesGenerated: explorer.totalGenerated(),
        candidatesEvaluated,
        depthReached,
        elapsedMs: performance.now() - startTime,
      },
      stopReason,
    };

    // Expose whether the goal predicate was satisfied by the best ranked candidate
    result.goalSatisfied = result.rankedCandidates.some((rc) => rc.evaluation.goalSatisfied);

    return result;
  }
}
