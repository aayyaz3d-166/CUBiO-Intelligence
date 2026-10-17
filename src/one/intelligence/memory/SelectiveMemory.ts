/**
 * ONE Language — Phase 4: Concept Understanding & Selective Memory Layer
 * Module: Unified Selective Memory Subsystem (src/one/intelligence/memory/SelectiveMemory.ts)
 */

import {
  ConceptRecord,
  RelationshipRecord,
  MemoryTier,
  WorkingMemoryEntry,
  EpisodicRecord,
  ProceduralRuleEntry,
  PromotionStatus,
  MemoryImportanceSignals,
} from './types';
import { ConceptGraph } from './ConceptGraph';
import { ReasoningRule } from '../reasoning/types';
import { RuleRegistry } from '../reasoning/RuleRegistry';

export class SelectiveMemory {
  // 1. Semantic Memory: Concepts & Multi-Hop Relationships
  public readonly semanticGraph: ConceptGraph = new ConceptGraph();

  // 2. Working Memory: Task-scoped scratchpad with TTL/cleanup
  private readonly workingStore: Map<string, WorkingMemoryEntry> = new Map();

  // 3. Episodic Memory: Compact task history
  private readonly episodicLog: EpisodicRecord[] = [];
  private readonly maxEpisodes: number;

  // 4. Procedural Memory: Validated reusable rules candidate & promotion tracker
  private readonly proceduralStore: Map<string, ProceduralRuleEntry> = new Map();

  constructor(
    private readonly ruleRegistry: RuleRegistry,
    maxEpisodes: number = 200,
  ) {
    this.maxEpisodes = maxEpisodes;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // A. Working Memory Management
  // ──────────────────────────────────────────────────────────────────────────

  public setWorkingContext<T = unknown>(key: string, value: T, ttlMs?: number): void {
    this.workingStore.set(key, {
      key,
      value,
      createdAt: Date.now(),
      ttlMs,
    });
  }

  public getWorkingContext<T = unknown>(key: string): T | undefined {
    const entry = this.workingStore.get(key);
    if (!entry) return undefined;

    // Check expiration
    if (entry.ttlMs && Date.now() - entry.createdAt > entry.ttlMs) {
      this.workingStore.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  public clearWorkingMemory(): void {
    this.workingStore.clear();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // B. Episodic Memory Management
  // ──────────────────────────────────────────────────────────────────────────

  public recordEpisode(episode: EpisodicRecord): void {
    if (this.episodicLog.length >= this.maxEpisodes) {
      // Bounded FIFO eviction for episodic memory
      this.episodicLog.shift();
    }
    this.episodicLog.push({ ...episode });
  }

  public getRecentEpisodes(limit: number = 10): EpisodicRecord[] {
    return this.episodicLog.slice(-limit);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // C. Procedural Memory & Selective Rule Promotion
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Registers a candidate rule observed in a task for potential promotion.
   */
  public registerCandidateRule<T = unknown>(rule: ReasoningRule<T>): ProceduralRuleEntry<T> {
    const existing = this.proceduralStore.get(rule.id);
    if (existing) {
      return existing as ProceduralRuleEntry<T>;
    }

    const entry: ProceduralRuleEntry<T> = {
      rule,
      status: PromotionStatus.CANDIDATE,
      validationCount: 0,
      counterExampleCount: 0,
      utilityScore: 0.0,
    };
    this.proceduralStore.set(rule.id, entry as ProceduralRuleEntry);
    return entry;
  }

  /**
   * Records verification evidence for a candidate rule.
   * If validation threshold is met and no counter-examples occur, promotes the rule
   * directly into the active Phase 3 RuleRegistry.
   */
  public validateAndPromoteRule<T = unknown>(
    ruleId: string,
    success: boolean,
    requiredValidations: number = 2,
  ): PromotionStatus {
    const entry = this.proceduralStore.get(ruleId);
    if (!entry) {
      throw new Error(`[SelectiveMemory] Candidate rule '${ruleId}' not found in procedural store`);
    }

    if (success) {
      entry.validationCount++;
      entry.utilityScore += 1.0;
      entry.lastValidatedAt = Date.now();

      // Rule Promotion Policy: Validated evidence across independent tasks
      if (
        entry.validationCount >= requiredValidations &&
        entry.counterExampleCount === 0 &&
        entry.status !== PromotionStatus.PROMOTED
      ) {
        entry.status = PromotionStatus.PROMOTED;
        entry.promotedAt = Date.now();
        // Promote into active Phase 3 RuleRegistry
        if (!this.ruleRegistry.get(ruleId)) {
          this.ruleRegistry.register(entry.rule);
        }
      } else if (entry.status === PromotionStatus.CANDIDATE) {
        entry.status = PromotionStatus.VALIDATED;
      }
    } else {
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

  public getProceduralRule(ruleId: string): ProceduralRuleEntry | undefined {
    return this.proceduralStore.get(ruleId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // D. Memory Importance Scoring & Selective Retention
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Computes an auditable composite retention score for an entry based on
   * recurrence, utility, confidence, and freshness.
   */
  public computeImportanceScore(signals: MemoryImportanceSignals): number {
    const wRecurrence = 0.3;
    const wUtility = 0.4;
    const wConfidence = 0.2;
    const wFreshness = 0.1;

    return (
      signals.recurrence * wRecurrence +
      signals.utility * wUtility +
      signals.confidence * wConfidence +
      signals.freshness * wFreshness
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // E. Telemetry & Size Auditing
  // ──────────────────────────────────────────────────────────────────────────

  public getStats() {
    return {
      workingCount: this.workingStore.size,
      episodicCount: this.episodicLog.length,
      semanticConcepts: this.semanticGraph.conceptCount(),
      semanticRelationships: this.semanticGraph.relationshipCount(),
      proceduralRules: this.proceduralStore.size,
      activeRegistryRules: this.ruleRegistry.size(),
    };
  }

  public clearAll(): void {
    this.workingStore.clear();
    this.episodicLog.length = 0;
    this.semanticGraph.clear();
    this.proceduralStore.clear();
  }
}
