/**
 * ONE Language — Phase 4: Concept Understanding & Selective Memory Layer
 * Module: Unified Selective Memory Subsystem (src/one/intelligence/memory/SelectiveMemory.ts)
 */
import { PromotionStatus, } from './types';
import { ConceptGraph } from './ConceptGraph';
export class SelectiveMemory {
    ruleRegistry;
    // 1. Semantic Memory: Concepts & Multi-Hop Relationships
    semanticGraph = new ConceptGraph();
    // 2. Working Memory: Task-scoped scratchpad with TTL/cleanup
    workingStore = new Map();
    // 3. Episodic Memory: Compact task history
    episodicLog = [];
    maxEpisodes;
    // 4. Procedural Memory: Validated reusable rules candidate & promotion tracker
    proceduralStore = new Map();
    constructor(ruleRegistry, maxEpisodes = 200) {
        this.ruleRegistry = ruleRegistry;
        this.maxEpisodes = maxEpisodes;
    }
    // ──────────────────────────────────────────────────────────────────────────
    // A. Working Memory Management
    // ──────────────────────────────────────────────────────────────────────────
    setWorkingContext(key, value, ttlMs) {
        this.workingStore.set(key, {
            key,
            value,
            createdAt: Date.now(),
            ttlMs,
        });
    }
    getWorkingContext(key) {
        const entry = this.workingStore.get(key);
        if (!entry)
            return undefined;
        // Check expiration
        if (entry.ttlMs && Date.now() - entry.createdAt > entry.ttlMs) {
            this.workingStore.delete(key);
            return undefined;
        }
        return entry.value;
    }
    clearWorkingMemory() {
        this.workingStore.clear();
    }
    // ──────────────────────────────────────────────────────────────────────────
    // B. Episodic Memory Management
    // ──────────────────────────────────────────────────────────────────────────
    recordEpisode(episode) {
        if (this.episodicLog.length >= this.maxEpisodes) {
            // Bounded FIFO eviction for episodic memory
            this.episodicLog.shift();
        }
        this.episodicLog.push({ ...episode });
    }
    getRecentEpisodes(limit = 10) {
        return this.episodicLog.slice(-limit);
    }
    // ──────────────────────────────────────────────────────────────────────────
    // C. Procedural Memory & Selective Rule Promotion
    // ──────────────────────────────────────────────────────────────────────────
    /**
     * Registers a candidate rule observed in a task for potential promotion.
     */
    registerCandidateRule(rule) {
        const existing = this.proceduralStore.get(rule.id);
        if (existing) {
            return existing;
        }
        const entry = {
            rule,
            status: PromotionStatus.CANDIDATE,
            validationCount: 0,
            counterExampleCount: 0,
            utilityScore: 0.0,
        };
        this.proceduralStore.set(rule.id, entry);
        return entry;
    }
    /**
     * Records verification evidence for a candidate rule.
     * If validation threshold is met and no counter-examples occur, promotes the rule
     * directly into the active Phase 3 RuleRegistry.
     */
    validateAndPromoteRule(ruleId, success, requiredValidations = 2) {
        const entry = this.proceduralStore.get(ruleId);
        if (!entry) {
            throw new Error(`[SelectiveMemory] Candidate rule '${ruleId}' not found in procedural store`);
        }
        if (success) {
            entry.validationCount++;
            entry.utilityScore += 1.0;
            entry.lastValidatedAt = Date.now();
            // Rule Promotion Policy: Validated evidence across independent tasks
            if (entry.validationCount >= requiredValidations &&
                entry.counterExampleCount === 0 &&
                entry.status !== PromotionStatus.PROMOTED) {
                entry.status = PromotionStatus.PROMOTED;
                entry.promotedAt = Date.now();
                // Promote into active Phase 3 RuleRegistry
                if (!this.ruleRegistry.get(ruleId)) {
                    this.ruleRegistry.register(entry.rule);
                }
            }
            else if (entry.status === PromotionStatus.CANDIDATE) {
                entry.status = PromotionStatus.VALIDATED;
            }
        }
        else {
            entry.counterExampleCount++;
            entry.utilityScore -= 2.0;
            // Invalidation Policy: Any verified counterexample demotes/invalidates the rule
            if (entry.status === PromotionStatus.PROMOTED) {
                this.ruleRegistry.unregister(ruleId);
            }
            entry.status = PromotionStatus.INVALIDATED;
        }
        return entry.status;
    }
    getProceduralRule(ruleId) {
        return this.proceduralStore.get(ruleId);
    }
    // ──────────────────────────────────────────────────────────────────────────
    // D. Memory Importance Scoring & Selective Retention
    // ──────────────────────────────────────────────────────────────────────────
    /**
     * Computes an auditable composite retention score for an entry based on
     * recurrence, utility, confidence, and freshness.
     */
    computeImportanceScore(signals) {
        const wRecurrence = 0.3;
        const wUtility = 0.4;
        const wConfidence = 0.2;
        const wFreshness = 0.1;
        return (signals.recurrence * wRecurrence +
            signals.utility * wUtility +
            signals.confidence * wConfidence +
            signals.freshness * wFreshness);
    }
    // ──────────────────────────────────────────────────────────────────────────
    // E. Telemetry & Size Auditing
    // ──────────────────────────────────────────────────────────────────────────
    getStats() {
        return {
            workingCount: this.workingStore.size,
            episodicCount: this.episodicLog.length,
            semanticConcepts: this.semanticGraph.conceptCount(),
            semanticRelationships: this.semanticGraph.relationshipCount(),
            proceduralRules: this.proceduralStore.size,
            activeRegistryRules: this.ruleRegistry.size(),
        };
    }
    clearAll() {
        this.workingStore.clear();
        this.episodicLog.length = 0;
        this.semanticGraph.clear();
        this.proceduralStore.clear();
    }
}
