/**
 * ONE Language — Phase 3: 0/1 Reasoning Intelligence Engine
 * Module: State Explorer & Candidate Expansion (src/one/intelligence/reasoning/StateExplorer.ts)
 */
import { ReasoningPolicy } from './types';
export class StateExplorer {
    ruleRegistry;
    recordTrace;
    candidateCounter = 0;
    seenSignatures = new Set();
    frontier = [];
    policy;
    stateHasher;
    /**
     * Construct a bounded state explorer with trace capture capability.
     * The trace recorder is REQUIRED — the engine always provides a real tracer
     * so every rule application emits a structured trace event with before/after state.
     * @param ruleRegistry - Rule registry supplying applicable transition rules
     * @param policy - Exploration policy (breadth-first by default)
     * @param stateHasher - Hash function for cycle/duplicate detection (JSON-based default)
     * @param recordTrace - Trace recorder; must be provided by the caller
     */
    constructor(ruleRegistry, policy = ReasoningPolicy.BREADTH_FIRST, stateHasher = (v) => JSON.stringify(v), recordTrace) {
        this.ruleRegistry = ruleRegistry;
        this.recordTrace = recordTrace;
        this.policy = policy;
        this.stateHasher = stateHasher;
    }
    /**
     * Initializes the root candidate from starting input.
     */
    initRoot(initialValue) {
        const rootId = `cand_${this.candidateCounter++}`;
        const sig = this.stateHasher(initialValue);
        this.seenSignatures.add(sig);
        const rootCandidate = {
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
    nextCandidate() {
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
    expand(parent, context, maxDepth, recordTrace) {
        if (maxDepth !== undefined && parent.depth >= maxDepth) {
            return [];
        }
        const applicableRules = this.ruleRegistry.getApplicable(parent.value, context);
        const newCandidates = [];
        const tracer = recordTrace ?? this.recordTrace;
        for (const rule of applicableRules) {
            let results = [];
            try {
                results = rule.apply(parent.value, context);
            }
            catch {
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
                const childCandidate = {
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
    frontierSize() {
        return this.frontier.length;
    }
    /**
     * Total candidates instantiated.
     */
    totalGenerated() {
        return this.candidateCounter;
    }
    /**
     * Clears all exploration state.
     */
    reset() {
        this.candidateCounter = 0;
        this.seenSignatures.clear();
        this.frontier.length = 0;
    }
}
