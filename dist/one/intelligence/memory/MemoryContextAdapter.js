/**
 * ONE Language — Phase 4: Concept Understanding & Selective Memory Layer
 * Module: Memory-Augmented Reasoning Context Provider (src/one/intelligence/memory/MemoryContextAdapter.ts)
 */
export class MemoryContextAdapter {
    memory;
    constructor(memory) {
        this.memory = memory;
    }
    /**
     * Retrieves relevant conceptual and relational context for a given task specification.
     */
    prepareContextForTask(targetConceptId, inferredDepth = 2) {
        const context = {
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
        const props = [];
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
    solveWithMemory(engine, spec, targetConceptId) {
        // 1. Retrieve & prepare memory context
        const augmentedContext = this.prepareContextForTask(targetConceptId);
        // Set working memory context
        this.memory.setWorkingContext('CURRENT_TASK_SPEC', {
            input: spec.input,
            targetConceptId,
            augmentedContext,
        });
        // Merge augmented context into spec context
        const enrichedSpec = {
            ...spec,
            context: {
                ...(spec.context ?? {}),
                memoryContext: augmentedContext,
            },
        };
        // 2. Execute Bounded Reasoning
        const result = engine.solve(enrichedSpec);
        // 3. Record in Episodic Memory
        const rulesApplied = Array.from(new Set(result.trace.map((t) => t.ruleId).filter(Boolean)));
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
