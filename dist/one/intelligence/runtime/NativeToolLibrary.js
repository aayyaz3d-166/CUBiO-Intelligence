/**
 * CUBiO AI — ONE LANGUAGE — NATIVE INTELLIGENCE TOOLING
 * =====================================================
 * Module: @one/intelligence/runtime/NativeToolLibrary
 *
 * Implements Capability 59: Native Tool Library
 * Standard library catalog registering all core intelligence capabilities
 * as first-class sovereign tools in the NativeToolRegistry.
 */
import { NativeToolBuilder } from './UniversalToolSDK';
import { toRaw } from '../../runtime/NativeValues';
export class NativeToolLibrary {
    static isInitialized = false;
    static initializeAllTools(queryEngine, resolver, contextEngine, counterfactualEngine, invariantEngine, planningEngine, researchEngine, computeOptimizer, scheduler) {
        if (this.isInitialized)
            return;
        // 1. Tool: Fast Query
        NativeToolBuilder.create('cubio:query:fast')
            .category('MEMORY')
            .description('Executes sub-millisecond multi-attribute fast queries')
            .param('attributes', 'RECORD', true)
            .handler((params) => {
            const rawAttrs = (toRaw(params.attributes) ?? {});
            return queryEngine.queryByAttributes(rawAttrs);
        })
            .build();
        // 2. Tool: Cross-Domain Federated Search
        NativeToolBuilder.create('cubio:query:cross_domain')
            .category('KNOWLEDGE')
            .description('Federated search across Memory, 369 Spatial, and Knowledge domains')
            .param('query', 'STRING', true)
            .handler((params) => {
            const q = String(toRaw(params.query));
            return queryEngine.crossDomainSearch(q);
        })
            .build();
        // 3. Tool: Universal Reference Resolver
        NativeToolBuilder.create('cubio:resolver:universal')
            .category('MEMORY')
            .description('Resolves any one:// URI into its target entity with zero-copy caching')
            .param('uri', 'STRING', true)
            .handler((params) => {
            const uri = String(toRaw(params.uri));
            return resolver.resolve(uri);
        })
            .build();
        // 4. Tool: Context Builder & Compressor
        NativeToolBuilder.create('cubio:context:build')
            .category('REASONING')
            .description('Dynamically builds and compresses optimal context within byte limits')
            .param('candidates', 'ARRAY', true)
            .param('maxBytes', 'NUMBER', false, 16384)
            .handler((params) => {
            const rawCandidates = (toRaw(params.candidates) ?? []);
            const maxB = Number(toRaw(params.maxBytes) ?? 16384);
            const built = contextEngine.buildContext(rawCandidates, maxB);
            return contextEngine.compressContext(built);
        })
            .build();
        // 5. Tool: Counterfactual Speculative Evaluator
        NativeToolBuilder.create('cubio:counterfactual:whatif')
            .category('SIMULATION')
            .description('Evaluates what-if counterfactual scenario without mutating baseline branches')
            .param('scenarioName', 'STRING', true)
            .param('branchId', 'STRING', true)
            .param('actions', 'ARRAY', true)
            .handler((params) => {
            const scenario = {
                scenarioName: String(toRaw(params.scenarioName)),
                forkFromBranchId: String(toRaw(params.branchId)),
                actions: (toRaw(params.actions) ?? []),
            };
            return counterfactualEngine.evaluateWhatIf(scenario);
        })
            .build();
        // 6. Tool: Invariant Discovery
        NativeToolBuilder.create('cubio:invariants:discover')
            .category('REASONING')
            .description('Discovers empirical conservation, bounds, and key invariants across states')
            .param('states', 'ARRAY', true)
            .handler((params) => {
            const statesList = (toRaw(params.states) ?? []);
            return invariantEngine.discoverInvariants(statesList);
        })
            .build();
        // 7. Tool: HTN Planning & Decomposition
        NativeToolBuilder.create('cubio:planning:generate')
            .category('REASONING')
            .description('Generates structured hierarchical task plans for intents')
            .param('goal', 'STRING', true)
            .handler((params) => {
            const goal = String(toRaw(params.goal));
            return planningEngine.generatePlan(goal, {});
        })
            .build();
        // 8. Tool: Autonomous Research Loop
        NativeToolBuilder.create('cubio:research:cycle')
            .category('KNOWLEDGE')
            .description('Executes closed-loop discovery: data acquisition, hypothesis, and knowledge consolidation')
            .param('topic', 'STRING', true)
            .param('samples', 'ARRAY', true)
            .handler((params) => {
            const topic = String(toRaw(params.topic));
            const samples = (toRaw(params.samples) ?? []);
            return researchEngine.executeResearchCycle(topic, samples);
        })
            .build();
        // 9. Tool: Resource Prediction
        NativeToolBuilder.create('cubio:scheduler:predict')
            .category('SIMULATION')
            .description('Predicts pre-flight memory and tick costs for proposed workloads')
            .param('states', 'NUMBER', true)
            .param('transitions', 'NUMBER', true)
            .handler((params) => {
            const s = Number(toRaw(params.states));
            const t = Number(toRaw(params.transitions));
            return scheduler.predictResources(s, t);
        })
            .build();
        this.isInitialized = true;
    }
}
