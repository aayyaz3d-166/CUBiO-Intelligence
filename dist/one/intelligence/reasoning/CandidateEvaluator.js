/**
 * ONE Language — Phase 3: 0/1 Reasoning Intelligence Engine
 * Module: Candidate Evaluator (src/one/intelligence/reasoning/CandidateEvaluator.ts)
 */
import { DecisionOutcome, } from './types';
export class CandidateEvaluator {
    /**
     * Evaluates a single candidate against task constraints, domain bounds, and goal predicate.
     * Produces an explicit breakdown of 0/1 signals, reasons, and a numerical score.
     */
    evaluate(candidate, spec) {
        const reasons = [];
        let valid = true;
        // 1. Structural / Domain Validity Check
        if (candidate.value === undefined) {
            valid = false;
            reasons.push('FAIL_STRUCTURAL: Candidate value is undefined');
        }
        // 2. Constraints Evaluation
        if (valid && spec.constraints && spec.constraints.length > 0) {
            for (let i = 0; i < spec.constraints.length; i++) {
                const constraintFn = spec.constraints[i];
                try {
                    const pass = constraintFn(candidate.value);
                    if (!pass) {
                        valid = false;
                        reasons.push(`FAIL_CONSTRAINT_${i}: Violated invariant constraint`);
                        break;
                    }
                    else {
                        reasons.push(`PASS_CONSTRAINT_${i}: Invariant satisfied`);
                    }
                }
                catch (err) {
                    valid = false;
                    reasons.push(`ERROR_CONSTRAINT_${i}: Exception during check (${err?.message})`);
                    break;
                }
            }
        }
        // 3. Goal Predicate Evaluation
        let goalSatisfied = false;
        if (valid) {
            try {
                goalSatisfied = spec.goal(candidate.value);
                if (goalSatisfied) {
                    reasons.push('PASS_GOAL: Target predicate successfully satisfied');
                }
                else {
                    reasons.push('FAIL_GOAL: Target predicate not yet reached');
                }
            }
            catch (err) {
                goalSatisfied = false;
                reasons.push(`ERROR_GOAL: Exception during goal evaluation (${err?.message})`);
            }
        }
        // 4. Determine 0/1 Decision Signal & Categorical Outcome
        // Signal: 1 if candidate is valid AND satisfies goal (or is a valid progression step)
        // Here: 1 = ACCEPT (valid progression or goal match), 0 = REJECT (constraint/domain violation)
        let decisionSignal;
        let decision;
        if (!valid) {
            decisionSignal = 0;
            decision = DecisionOutcome.REJECT;
        }
        else if (goalSatisfied) {
            decisionSignal = 1;
            decision = DecisionOutcome.ACCEPT;
        }
        else {
            // Valid progression candidate that does not yet solve the entire goal
            decisionSignal = 1;
            decision = DecisionOutcome.ACCEPT;
        }
        // 5. Deterministic Score Calculation
        // Base score: 100 for goal match, 10 for passing constraints, penalty for depth
        let score = 0;
        if (!valid) {
            score = -1000.0;
        }
        else {
            score += 10.0;
            if (goalSatisfied) {
                score += 100.0;
            }
            // Favor shallower/cleaner derivations deterministically
            score -= candidate.depth * 0.1;
        }
        return {
            candidateId: candidate.id,
            candidateValue: candidate.value,
            valid,
            goalSatisfied,
            decisionSignal,
            score,
            reasons,
            decision,
        };
    }
    /**
     * Sorts candidate evaluation pairs deterministically:
     * 1. Validity (valid before invalid)
     * 2. Goal satisfaction (solved before unsolved)
     * 3. Score (higher score first)
     * 4. Tie-breaker: candidate ID (lexicographical)
     */
    rank(evaluations) {
        return [...evaluations].sort((a, b) => {
            // 1. Valid vs Invalid
            if (a.evaluation.valid !== b.evaluation.valid) {
                return a.evaluation.valid ? -1 : 1;
            }
            // 2. Goal Satisfied vs Not
            if (a.evaluation.goalSatisfied !== b.evaluation.goalSatisfied) {
                return a.evaluation.goalSatisfied ? -1 : 1;
            }
            // 3. Score
            if (a.evaluation.score !== b.evaluation.score) {
                return b.evaluation.score - a.evaluation.score;
            }
            // 4. Deterministic tie-breaker: candidate ID
            return a.candidate.id.localeCompare(b.candidate.id);
        });
    }
}
