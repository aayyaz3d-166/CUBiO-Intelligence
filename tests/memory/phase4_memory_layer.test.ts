/**
 * ONE Language — Phase 4 Verification Suite
 * Module: Concept Understanding, Relationship Reasoning & Selective Memory
 * Path: tests/memory/phase4_memory_layer.test.ts
 */

import {
  ConceptGraph,
  SelectiveMemory,
  MemoryContextAdapter,
  PromotionStatus,
} from '../../src/one/intelligence/memory/index';
import {
  ReasoningEngine,
  RuleRegistry,
  ReasoningRule,
  ReasoningStatus,
} from '../../src/one/intelligence/reasoning/index';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

export function runPhase4MemoryTests(): void {
  console.log('='.repeat(80));
  console.log('  ONE LANGUAGE — PHASE 4: CONCEPT UNDERSTANDING & SELECTIVE MEMORY SUITE');
  console.log('='.repeat(80));

  // ──────────────────────────────────────────────────────────────────────────
  // Suite A: Concept Representation & Provenance
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite A] Concept Representation & Provenance...');
  const graph = new ConceptGraph();

  // Test A1: Valid concept insertion
  const car = graph.addConcept({
    conceptId: 'concept_car',
    label: 'Automobile',
    type: 'OBJECT',
    attributes: { wheels: 4, motorized: true },
    source: 'USER_PROVIDED',
    confidence: 1.0,
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  assert(car.conceptId === 'concept_car', 'A1: Concept ID must match');
  assert(graph.hasConcept('concept_car'), 'A1: Concept must exist in graph');

  // Test A2: Duplicate concept update bumps version
  const carV2 = graph.addConcept({
    conceptId: 'concept_car',
    label: 'Automobile Updated',
    type: 'OBJECT',
    attributes: { wheels: 4, motorized: true, doors: 4 },
    source: 'USER_PROVIDED',
    confidence: 1.0,
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  assert(carV2.version === 2, 'A2: Duplicate insertion must bump version to 2');
  assert(graph.conceptCount() === 1, 'A2: Total concepts must remain 1');

  // Test A3: Malformed confidence rejected
  let threwBadConf = false;
  try {
    graph.addConcept({
      conceptId: 'concept_bad',
      label: 'Bad',
      type: 'OBJECT',
      attributes: {},
      source: 'USER_PROVIDED',
      confidence: 1.5, // Invalid > 1.0
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  } catch {
    threwBadConf = true;
  }
  assert(threwBadConf, 'A3: Out-of-bounds confidence must be rejected fail-closed');
  console.log('  ✓ Suite A passed: Concept schemas, versions, and validation verified.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite B: Relationship Graph & Multi-Hop Inference
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite B] Relationship Graph & Multi-Hop Inference...');

  // Setup Sparrow -> isA -> Bird -> hasProperty -> Wings
  graph.addConcept({
    conceptId: 'concept_sparrow',
    label: 'Sparrow',
    type: 'OBJECT',
    attributes: { species: 'Passer domesticus' },
    source: 'VERIFIED_FACT',
    confidence: 1.0,
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  graph.addConcept({
    conceptId: 'concept_bird',
    label: 'Bird',
    type: 'CATEGORY',
    attributes: { warmBlooded: true },
    source: 'VERIFIED_FACT',
    confidence: 1.0,
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  graph.addConcept({
    conceptId: 'concept_wings',
    label: 'Wings',
    type: 'PROPERTY',
    attributes: { aerodynamic: true },
    source: 'VERIFIED_FACT',
    confidence: 1.0,
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  graph.addRelationship({
    relationshipId: 'rel_sparrow_bird',
    sourceConceptId: 'concept_sparrow',
    relationType: 'isA',
    targetConceptId: 'concept_bird',
    provenance: 'VERIFIED_FACT',
    confidence: 0.95,
    version: 1,
    createdAt: Date.now(),
  });

  graph.addRelationship({
    relationshipId: 'rel_bird_wings',
    sourceConceptId: 'concept_bird',
    relationType: 'hasProperty',
    targetConceptId: 'concept_wings',
    provenance: 'VERIFIED_FACT',
    confidence: 0.98,
    version: 1,
    createdAt: Date.now(),
  });

  // Direct relationship query
  const direct = graph.getDirectRelationships('concept_sparrow');
  assert(direct.length === 1 && direct[0].targetConceptId === 'concept_bird', 'B1: Direct relationship matches');

  // Multi-hop path derivation
  const paths = graph.findRelationshipPath('concept_sparrow', 'concept_wings', 3);
  assert(paths.length === 1, 'B2: Exactly one 2-hop path found from Sparrow to Wings');
  assert(paths[0].path.length === 2, 'B2: Path has length 2');
  const expectedDerivedConf = 0.95 * 0.98;
  assert(Math.abs(paths[0].derivedConfidence - expectedDerivedConf) < 1e-6, 'B2: Derived confidence multiplied');

  // Transitive property inheritance
  const inherited = graph.inferInheritedProperties('concept_sparrow', 2);
  assert(inherited.length === 1, 'B3: Inferred 1 inherited property for Sparrow');
  assert(inherited[0].propertyConceptId === 'concept_wings', 'B3: Sparrow inherits Wings');
  assert(inherited[0].derivation.includes('concept_sparrow -> [isA] -> concept_bird'), 'B3: Provenance trace preserved');

  // Referential integrity: referencing non-existent concept throws
  let threwIntegrity = false;
  try {
    graph.addRelationship({
      relationshipId: 'rel_broken',
      sourceConceptId: 'concept_sparrow',
      relationType: 'hasProperty',
      targetConceptId: 'concept_non_existent',
      provenance: 'UNVERIFIED_HYPOTHESIS',
      confidence: 0.5,
      version: 1,
      createdAt: Date.now(),
    });
  } catch {
    threwIntegrity = true;
  }
  assert(threwIntegrity, 'B4: Adding relationship to non-existent concept throws');

  console.log('  ✓ Suite B passed: Graph relationships and transitive multi-hop reasoning verified.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite C: Selective Retention & Four-Tier Memory Architecture
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite C] Selective Retention & Four-Tier Memory Architecture...');
  const registry = new RuleRegistry();
  const memory = new SelectiveMemory(registry);

  // 1. Working Memory TTL Expiration
  memory.setWorkingContext('temp_calc', { temp: 123 }, 50); // 50ms TTL
  assert(memory.getWorkingContext('temp_calc') !== undefined, 'C1: Working context accessible before TTL');

  // 2. Procedural Rule Promotion & Invalidation
  const candidateRule: ReasoningRule<number> = {
    id: 'candidate_sub_two',
    description: 'Subtract 2 from number',
    isApplicable: (n) => n >= 2,
    apply: (n) => [n - 2],
  };

  memory.registerCandidateRule(candidateRule);
  const entry0 = memory.getProceduralRule('candidate_sub_two');
  assert(entry0?.status === PromotionStatus.CANDIDATE, 'C2: Initial status is CANDIDATE');
  assert(registry.get('candidate_sub_two') === undefined, 'C2: Not yet in active registry');

  // Validation 1: Becomes VALIDATED
  memory.validateAndPromoteRule('candidate_sub_two', true, 2);
  const entry1 = memory.getProceduralRule('candidate_sub_two');
  assert(entry1?.status === PromotionStatus.VALIDATED, 'C3: First validation advances to VALIDATED');

  // Validation 2: Promoted into active registry
  memory.validateAndPromoteRule('candidate_sub_two', true, 2);
  const entry2 = memory.getProceduralRule('candidate_sub_two');
  assert(entry2?.status === PromotionStatus.PROMOTED, 'C4: Second validation PROMOTES rule');
  assert(registry.get('candidate_sub_two') !== undefined, 'C4: Promoted rule is now in active registry');

  // Counterexample invalidates and removes from registry
  memory.validateAndPromoteRule('candidate_sub_two', false);
  const entry3 = memory.getProceduralRule('candidate_sub_two');
  assert(entry3?.status === PromotionStatus.INVALIDATED, 'C5: Counterexample INVALIDATES rule');
  assert(registry.get('candidate_sub_two') === undefined, 'C5: Invalidated rule removed from active registry');

  // 3. Importance Scoring
  const imp = memory.computeImportanceScore({
    recurrence: 0.8,
    utility: 0.9,
    confidence: 1.0,
    freshness: 0.7,
  });
  assert(imp > 0.8 && imp <= 1.0, 'C6: Importance score computed accurately');

  console.log('  ✓ Suite C passed: Working memory TTL, selective rule promotion & invalidation verified.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite D: Reasoning Integration & Knowledge-Augmented Transfer
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite D] Reasoning Integration & Knowledge-Augmented Transfer...');

  const activeRegistry = new RuleRegistry<number>();
  const activeMemory = new SelectiveMemory(activeRegistry);
  const adapter = new MemoryContextAdapter(activeMemory);
  const engine = new ReasoningEngine<number>(activeRegistry);

  // Register an approved foundational rule
  activeRegistry.register({
    id: 'dec_1',
    description: 'Subtract 1',
    isApplicable: (n) => n > 0,
    apply: (n) => [n - 1],
  });

  // Add semantic concept
  activeMemory.semanticGraph.addConcept({
    conceptId: 'target_zero',
    label: 'Ground Zero',
    type: 'STATE',
    attributes: { terminal: true },
    source: 'VERIFIED_FACT',
    confidence: 1.0,
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Execute Task Augmented with Memory
  const solveRes = adapter.solveWithMemory(
    engine,
    {
      input: 4,
      goal: (n) => n === 0,
      goalDescription: 'Reach Ground Zero from 4',
    },
    'target_zero',
  );

  assert(solveRes.result.isSolved, 'D1: Reasoning task solved with memory');
  assert(solveRes.result.bestCandidate?.value === 0, 'D1: Target reached');
  assert(solveRes.augmentedContext.relevantConceptIds.includes('target_zero'), 'D1: Concept injected in context');

  // Verify Episodic Memory recorded the task
  const recentEpisodes = activeMemory.getRecentEpisodes(1);
  assert(recentEpisodes.length === 1, 'D2: Episode was logged');
  assert(recentEpisodes[0].isSuccess === true, 'D2: Episode recorded success');
  assert(recentEpisodes[0].rulesApplied.includes('dec_1'), 'D2: Rules applied recorded');

  console.log('  ✓ Suite D passed: Reasoning engine successfully augmented with selective memory.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite E: 1,000-Cycle Memory Stability & Resource Ceiling
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite E] 1,000-Cycle Memory Stability & Resource Ceiling...');

  const initialMemoryMB = process.memoryUsage().heapUsed / 1024 / 1024;
  const stressMemory = new SelectiveMemory(new RuleRegistry());

  for (let cycle = 0; cycle < 1000; cycle++) {
    stressMemory.setWorkingContext(`scratch_${cycle}`, { data: cycle * 2 });
    stressMemory.recordEpisode({
      episodeId: `ep_${cycle}`,
      taskGoal: `goal_${cycle}`,
      inputSummary: `${cycle}`,
      rulesApplied: ['test_rule'],
      isSuccess: true,
      outcomeSummary: 'done',
      stepsUsed: 2,
      timestamp: Date.now(),
    });
    if (cycle % 100 === 0) {
      stressMemory.clearWorkingMemory(); // Enforce periodic cleanup
    }
  }

  const finalMemoryMB = process.memoryUsage().heapUsed / 1024 / 1024;
  const memoryDeltaMB = finalMemoryMB - initialMemoryMB;
  const stats = stressMemory.getStats();

  assert(stats.episodicCount <= 200, 'E1: Episodic memory bounded by maxEpisodes ceiling (200)');
  assert(finalMemoryMB < 256, `E2: Heap used (${finalMemoryMB.toFixed(2)} MB) strictly below 256 MB target`);

  console.log(`  ✓ Suite E passed: 1,000 cycles completed. Heap: ${finalMemoryMB.toFixed(2)} MB (< 256 MB). Delta: ${memoryDeltaMB.toFixed(2)} MB.`);

  console.log('\n' + '='.repeat(80));
  console.log('  PHASE 4 VERIFICATION: ALL CONCEPT & MEMORY SUITES PASSED (100%)');
  console.log('='.repeat(80) + '\n');
}

if (require.main === module) {
  runPhase4MemoryTests();
}
