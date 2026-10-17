/**
 * ONE Language — Phase 4: Concept Understanding & Selective Memory Layer
 * Module: Memory-Augmented Reasoning Context Provider (src/one/intelligence/memory/MemoryContextAdapter.ts)
 */

import { SelectiveMemory } from './SelectiveMemory';
import { ReasoningInput, ReasoningResult } from '../reasoning/types';
import { ReasoningEngine } from '../reasoning/ReasoningEngine';

export interface AugmentedTaskContext {
  relevantConceptIds: string[];
  inferredProperties: Record<string, string[]>;
  recommendedRules: string[];
  unresolvedRelations: string[];
}

export class MemoryContextAdapter {
  constructor(private readonly memory: SelectiveMemory) {}

  /**
   * Retrieves relevant conceptual and relational context for a given task specification.
   */
  public prepareContextForTask(
    targetConceptId?: string,
    inferredDepth: number = 2,
  ): AugmentedTaskContext {
    const context: AugmentedTaskContext = {
      relevantConceptIds: [],
      inferredProperties: {},
      recommendedRules: [],
      unresolvedRelations: [],
    };

    if (!targetConceptId) {
      return context;
    }

    // 1. Semantic graph concept check
    const concept = this.memory.semanticGraph.getConcept(targetConceptId);
    if (!concept) {
      context.unresolvedRelations.push(`Concept '${targetConceptId}' not found in semantic memory`);
      return context;
    }

    context.relevantConceptIds.push(concept.conceptId);

    // 2. Infer multi-hop inherited properties (e.g. isA -> hasProperty)
    const inherited = this.memory.semanticGraph.inferInheritedProperties(targetConceptId, inferredDepth);
    const props: string[] = [];
    for (const item of inherited) {
      props.push(item.propertyConceptId);
    }
    context.inferredProperties[targetConceptId] = props;

    // 3. Direct outgoing relationships
    const direct = this.memory.semanticGraph.getDirectRelationships(targetConceptId);
    for (const rel of direct) {
      context.relevantConceptIds.push(rel.targetConceptId);
    }

    return context;
  }

  /**
   * Executes a reasoning task augmented with selective memory:
   * 1. Injects relevant conceptual facts into working context.
   * 2. Executes Phase 3 Bounded Reasoning Engine.
   * 3. Records outcome into Episodic Memory.
   * 4. Updates procedural validation statistics for applied rules.
   */
  public solveWithMemory<T = unknown>(
    engine: ReasoningEngine<T>,
    spec: ReasoningInput<T>,
    targetConceptId?: string,
  ): {
    result: ReasoningResult<T>;
    augmentedContext: AugmentedTaskContext;
  } {
    // 1. Retrieve & prepare memory context
    const augmentedContext = this.prepareContextForTask(targetConceptId);

    // Set working memory context
    this.memory.setWorkingContext('CURRENT_TASK_SPEC', {
      input: spec.input,
      targetConceptId,
      augmentedContext,
    });

    // Merge augmented context into spec context
    const enrichedSpec: ReasoningInput<T> = {
      ...spec,
      context: {
        ...(spec.context ?? {}),
        memoryContext: augmentedContext,
      },
    };

    // 2. Execute Bounded Reasoning
    const result = engine.solve(enrichedSpec);

    // 3. Record in Episodic Memory
    const rulesApplied = Array.from(
      new Set(result.trace.map((t) => t.ruleId).filter(Boolean) as string[]),
    );

    this.memory.recordEpisode({
      episodeId: `ep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      taskGoal: spec.goalDescription ?? 'unspecified_goal',
      inputSummary: String(spec.input),
      rulesApplied,
      isSuccess: result.isSolved,
      outcomeSummary: result.stopReason,
      stepsUsed: result.metrics.stepsUsed,
      timestamp: Date.now(),
    });

    // 4. Update procedural validation for candidate rules
    if (result.isSolved && rulesApplied.length > 0) {
      for (const ruleId of rulesApplied) {
        if (this.memory.getProceduralRule(ruleId)) {
          this.memory.validateAndPromoteRule(ruleId, true);
        }
      }
    }

    // Clear temporary working memory
    this.memory.clearWorkingMemory();

    return {
      result,
      augmentedContext,
    };
  }
}
