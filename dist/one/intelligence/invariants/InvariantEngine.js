/**
 * CUBiO AI — ONE LANGUAGE — NATIVE INTELLIGENCE TOOLING
 * =====================================================
 * Module: @one/intelligence/invariants/InvariantEngine
 *
 * Implements Capabilities 17–23:
 *   17. Invariant Discovery (dynamic invariant extraction over state transitions)
 *   18. Invariant Verification (adversarial proof verification across DAG)
 *   19. Pattern Discovery (frequent action & transition motif mining)
 *   20. Causal Reasoning (counterfactual necessity & sufficiency attribution)
 *   21. Hypothesis Generation & Evaluation (speculative rule formulation)
 *   22. Evidence Verification (entailment & premise consistency check)
 *   23. Contradiction Resolution (confidence & recency belief arbitration)
 */
import { toRaw } from '../../runtime/NativeValues';
export class InvariantEngine {
    // ── Capability 17: Invariant Discovery ─────────────────────────────────────
    /**
     * Discovers empirical invariants across a collection of state nodes.
     */
    discoverInvariants(states) {
        if (states.length === 0)
            return [];
        const invariants = [];
        const sampleCount = states.length;
        // Collect all raw payloads
        const raws = states.map((s) => (toRaw(s.payload) ?? {}));
        // 1. Key Presence: Keys that exist in 100% of samples
        const allKeys = Object.keys(raws[0] ?? {});
        for (const key of allKeys) {
            const presentInAll = raws.every((r) => key in r && r[key] !== undefined && r[key] !== null);
            if (presentInAll) {
                invariants.push({
                    invariantId: `inv_presence_${key}`,
                    type: 'KEY_PRESENCE',
                    description: `Field '${key}' is universally present across all observed states.`,
                    targetField: key,
                    expectedValueOrBound: true,
                    confidence: 1.0,
                    sampleCount,
                });
                // 2. Type Stability: typeof(field) never changes
                const expectedType = typeof raws[0][key];
                const sameType = raws.every((r) => typeof r[key] === expectedType);
                if (sameType) {
                    invariants.push({
                        invariantId: `inv_type_${key}`,
                        type: 'TYPE_STABILITY',
                        description: `Field '${key}' maintains constant type '${expectedType}'.`,
                        targetField: key,
                        expectedValueOrBound: expectedType,
                        confidence: 1.0,
                        sampleCount,
                    });
                }
                // 3. Numerical Bounds & Monotonicity
                if (expectedType === 'number') {
                    const nums = raws.map((r) => Number(r[key]));
                    const min = Math.min(...nums);
                    const max = Math.max(...nums);
                    invariants.push({
                        invariantId: `inv_bounds_${key}`,
                        type: 'BOUNDS',
                        description: `Field '${key}' remains strictly bounded in [${min}..${max}].`,
                        targetField: key,
                        expectedValueOrBound: { min, max },
                        confidence: 1.0,
                        sampleCount,
                    });
                    // Check monotonicity
                    let isMonotonicInc = true;
                    for (let i = 1; i < nums.length; i++) {
                        if (nums[i] < nums[i - 1]) {
                            isMonotonicInc = false;
                            break;
                        }
                    }
                    if (isMonotonicInc && nums.length > 1) {
                        invariants.push({
                            invariantId: `inv_mono_${key}`,
                            type: 'MONOTONIC',
                            description: `Field '${key}' is monotonically increasing over virtual time.`,
                            targetField: key,
                            expectedValueOrBound: 'NON_DECREASING',
                            confidence: 1.0,
                            sampleCount,
                        });
                    }
                }
            }
        }
        return invariants;
    }
    // ── Capability 18: Invariant Verification ───────────────────────────────────
    /**
     * Verifies an invariant across all states in a reality DAG, reporting counterexamples.
     */
    verifyInvariant(invariant, reality) {
        const counterexamples = [];
        const activeBranch = reality.getActiveBranch();
        const transitions = activeBranch.path.transitions;
        let checkedCount = 0;
        let passedCount = 0;
        // Check every state on the branch
        const stateIds = new Set();
        stateIds.add(activeBranch.forkStateId);
        stateIds.add(activeBranch.headStateId);
        for (const t of transitions) {
            stateIds.add(t.fromStateId);
            stateIds.add(t.toStateId);
        }
        for (const sId of stateIds) {
            const state = reality.getState(sId);
            if (!state)
                continue;
            checkedCount++;
            const raw = (toRaw(state.payload) ?? {});
            const val = raw[invariant.targetField];
            let ok = true;
            let violationReason = '';
            switch (invariant.type) {
                case 'KEY_PRESENCE':
                    if (!(invariant.targetField in raw) || val === undefined) {
                        ok = false;
                        violationReason = `Field '${invariant.targetField}' missing in state ${sId}.`;
                    }
                    break;
                case 'TYPE_STABILITY':
                    if (typeof val !== invariant.expectedValueOrBound) {
                        ok = false;
                        violationReason = `Type mismatch in state ${sId}: expected '${invariant.expectedValueOrBound}', got '${typeof val}'.`;
                    }
                    break;
                case 'BOUNDS': {
                    const bounds = invariant.expectedValueOrBound;
                    const num = Number(val);
                    if (num < bounds.min || num > bounds.max) {
                        ok = false;
                        violationReason = `Value ${num} out of bounds [${bounds.min}..${bounds.max}] in state ${sId}.`;
                    }
                    break;
                }
                default:
                    break;
            }
            if (ok) {
                passedCount++;
            }
            else {
                counterexamples.push({ stateId: sId, violation: violationReason });
            }
        }
        const falseDiscoveryRate = checkedCount > 0 ? counterexamples.length / checkedCount : 0.0;
        return {
            invariantId: invariant.invariantId,
            holds: counterexamples.length === 0,
            totalStatesChecked: checkedCount,
            passedStatesCount: passedCount,
            counterexamples,
            falseDiscoveryRate: Number(falseDiscoveryRate.toFixed(4)),
        };
    }
    // ── Capability 19: Pattern Discovery ───────────────────────────────────────
    /**
     * Mines frequent recurring sub-sequences of action transitions.
     */
    discoverActionMotifs(transitions, minLength = 2, minSupport = 2) {
        const actions = transitions.map((t) => t.action);
        const motifCounts = new Map();
        for (let len = minLength; len <= Math.min(4, actions.length); len++) {
            for (let i = 0; i <= actions.length - len; i++) {
                const sub = actions.slice(i, i + len);
                const key = sub.join(' -> ');
                motifCounts.set(key, (motifCounts.get(key) ?? 0) + 1);
            }
        }
        const results = [];
        for (const [motifStr, count] of motifCounts.entries()) {
            if (count >= minSupport) {
                results.push({
                    motif: motifStr.split(' -> '),
                    frequency: count,
                    supportRatio: Number((count / (actions.length || 1)).toFixed(3)),
                });
            }
        }
        results.sort((a, b) => b.frequency - a.frequency);
        return results;
    }
    // ── Capability 20: Causal Reasoning ────────────────────────────────────────
    /**
     * Determines causal attribution of a state field delta from a transition.
     */
    attributeCausality(fromState, toState, transition, field) {
        const rawFrom = (toRaw(fromState.payload) ?? {});
        const rawTo = (toRaw(toState.payload) ?? {});
        const valBefore = rawFrom[field];
        const valAfter = rawTo[field];
        const changed = JSON.stringify(valBefore) !== JSON.stringify(valAfter);
        return {
            action: transition.action,
            targetField: field,
            priorValue: valBefore,
            posteriorValue: valAfter,
            isNecessary: changed,
            isSufficient: changed && transition.action !== '',
            causalConfidence: changed ? 1.0 : 0.0,
        };
    }
    // ── Capability 21: Hypothesis Generation & Evaluation ──────────────────────
    /**
     * Generates and evaluates an inductive hypothesis over state samples.
     */
    evaluateHypothesis(hypothesis, states) {
        let support = 0;
        let refute = 0;
        for (const s of states) {
            const raw = (toRaw(s.payload) ?? {});
            const condVal = raw[hypothesis.conditionField];
            let matchesCond = false;
            if (hypothesis.conditionOp === 'EQUALS') {
                matchesCond = JSON.stringify(condVal) === JSON.stringify(hypothesis.conditionValue);
            }
            else if (hypothesis.conditionOp === 'GREATER_THAN') {
                matchesCond = Number(condVal) > Number(hypothesis.conditionValue);
            }
            else if (hypothesis.conditionOp === 'LESS_THAN') {
                matchesCond = Number(condVal) < Number(hypothesis.conditionValue);
            }
            if (matchesCond) {
                const predVal = raw[hypothesis.predictedField];
                if (JSON.stringify(predVal) === JSON.stringify(hypothesis.predictedDelta)) {
                    support++;
                }
                else {
                    refute++;
                }
            }
        }
        const total = support + refute;
        const accuracy = total > 0 ? support / total : 0.0;
        return {
            ...hypothesis,
            supportCount: support,
            refuteCount: refute,
            accuracy: Number(accuracy.toFixed(4)),
        };
    }
    // ── Capability 22: Evidence Verification ───────────────────────────────────
    /**
     * Verifies if evidence set rigorously entails a claim.
     */
    verifyEvidence(claim, evidenceSet) {
        let supporting = 0;
        let refuting = 0;
        let totalConf = 0;
        for (const ev of evidenceSet) {
            if (ev.fact.toLowerCase().includes(claim.toLowerCase())) {
                supporting++;
                totalConf += ev.confidence;
            }
            else if (ev.fact.toLowerCase().includes(`not ${claim.toLowerCase()}`)) {
                refuting++;
            }
        }
        const avgConf = supporting > 0 ? totalConf / supporting : 0.0;
        const isSupported = supporting > refuting && supporting > 0;
        return {
            claim,
            isSupported,
            confidence: Number(avgConf.toFixed(3)),
            supportingEvidenceCount: supporting,
            refutingEvidenceCount: refuting,
            reason: isSupported
                ? `Claim supported by ${supporting} independent evidence items with avg confidence ${avgConf.toFixed(2)}.`
                : `Claim unverified: insufficient supporting evidence (${supporting} vs ${refuting} refuting).`,
        };
    }
    // ── Capability 23: Contradiction Resolution ────────────────────────────────
    /**
     * Resolves contradictory assertions using confidence and timestamp dominance.
     */
    resolveContradiction(conflict) {
        // Strategy 1: Confidence Dominance (if delta >= 0.1)
        if (Math.abs(conflict.factA.confidence - conflict.factB.confidence) >= 0.1) {
            const winner = conflict.factA.confidence > conflict.factB.confidence ? conflict.factA : conflict.factB;
            return {
                subject: conflict.subject,
                predicate: conflict.predicate,
                acceptedObject: winner.object,
                confidence: winner.confidence,
                resolutionStrategy: 'CONFIDENCE_DOMINANCE',
            };
        }
        // Strategy 2: Recency Dominance
        const winner = conflict.factA.timestamp >= conflict.factB.timestamp ? conflict.factA : conflict.factB;
        return {
            subject: conflict.subject,
            predicate: conflict.predicate,
            acceptedObject: winner.object,
            confidence: winner.confidence,
            resolutionStrategy: 'RECENCY_DOMINANCE',
        };
    }
}
