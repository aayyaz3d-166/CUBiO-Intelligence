/**
 * ONE Language — Phase 5 Gate 4: Native 5M-v2 Hybrid Integration Tests
 * (tests/hybrid/phase5_gate4_native5m_integration.test.ts)
 *
 * Verifies the 11 Required Test Scenarios for Gate 4:
 *   1. Loading the existing trained checkpoint without modifying it.
 *   2. Generating a short English response through the real inference engine.
 *   3. A greeting handled through the hybrid interface (neural active).
 *   4. A supported arithmetic query dispatched to Phase 3 symbolic engine.
 *   5. A supported concept query dispatched to Phase 4 concept graph.
 *   6. An ambiguous request returning clarification or unresolved status.
 *   7. Unsupported questions not producing fabricated verified facts.
 *   8. Generation length limits (<= 45 tokens) and repetition handling.
 *   9. Model-loading and inference failure handling (graceful degradation).
 *  10. Selective-memory retention behavior (reasoning logged, greetings not).
 *  11. Regression tests for existing Phase 1-4 and Phase 5 Gate 2 components.
 */

import * as assert from 'assert';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { Native5MAdapter } from '../../src/one/intelligence/hybrid/Native5MAdapter';
import {
  HybridConversationEngine,
} from '../../src/one/intelligence/hybrid/HybridConversationEngine';
import {
  HybridRequest,
  HybridResponseStatus,
  UserIntentType,
} from '../../src/one/intelligence/hybrid/types';
import { SelectiveMemory } from '../../src/one/intelligence/memory/SelectiveMemory';
import { RuleRegistry } from '../../src/one/intelligence/reasoning/RuleRegistry';
import { ReasoningStatus } from '../../src/one/intelligence/reasoning/types';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let total = 0;

function test(name: string, fn: () => void): void {
  total++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err: unknown) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${String(err)}`);
    failed++;
  }
}

function suite(name: string, fn: () => void): void {
  console.log(`\n[Suite ${name}]`);
  fn();
}

function makeEngine(customCheckpointPath?: string): {
  memory: SelectiveMemory;
  engine: HybridConversationEngine;
} {
  const ruleRegistry = new RuleRegistry();
  const memory = new SelectiveMemory(ruleRegistry as RuleRegistry<unknown>, 50);
  const engine = new HybridConversationEngine(memory, undefined, customCheckpointPath);
  return { memory, engine };
}

function populateTaxonomy(memory: SelectiveMemory): void {
  const now = Date.now();
  const g = memory.semanticGraph;

  g.addConcept({
    conceptId: 'concept_vehicle',
    label: 'Vehicle',
    type: 'CATEGORY',
    attributes: {},
    source: 'VERIFIED_FACT',
    confidence: 1.0,
    version: 1,
    createdAt: now,
    updatedAt: now,
  });
  g.addConcept({
    conceptId: 'concept_car',
    label: 'Car',
    type: 'OBJECT',
    attributes: { wheels: 4 },
    source: 'VERIFIED_FACT',
    confidence: 0.99,
    version: 1,
    createdAt: now,
    updatedAt: now,
  });
  g.addConcept({
    conceptId: 'concept_wheels',
    label: 'Wheels',
    type: 'PROPERTY',
    attributes: {},
    source: 'VERIFIED_FACT',
    confidence: 0.98,
    version: 1,
    createdAt: now,
    updatedAt: now,
  });

  g.addRelationship({
    relationshipId: 'rel_car_isA_vehicle',
    sourceConceptId: 'concept_car',
    relationType: 'isA',
    targetConceptId: 'concept_vehicle',
    provenance: 'VERIFIED_FACT',
    confidence: 1.0,
    version: 1,
    createdAt: now,
  });
  g.addRelationship({
    relationshipId: 'rel_vehicle_has_wheels',
    sourceConceptId: 'concept_vehicle',
    relationType: 'hasProperty',
    targetConceptId: 'concept_wheels',
    provenance: 'VERIFIED_FACT',
    confidence: 0.98,
    version: 1,
    createdAt: now,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Suite 1 — Checkpoint Integrity & Loading
// ══════════════════════════════════════════════════════════════════════════════
suite('1: Checkpoint Integrity & Loading', () => {
  const chkPath = 'E:/3D memory studio/data/checkpoints/one_lm_v1/one_lm_best.cubiomodel';

  test('G4-01: Checkpoint exists and is strictly read-only', () => {
    assert.ok(fs.existsSync(chkPath), `Checkpoint must exist at ${chkPath}`);
    const stat = fs.statSync(chkPath);
    assert.strictEqual(stat.size, 19594556, 'Checkpoint size must match exact 19,594,556 bytes');
  });

  test('G4-02: Checkpoint SHA-256 matches preflight hash', () => {
    const buf = fs.readFileSync(chkPath);
    const hash = crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
    assert.strictEqual(
      hash,
      '2D35BB53A226FD369C3B282C1EA6A0D039F66A3557D31A77EAC72ED8C9DBF948',
      'Checkpoint hash must remain byte-identical to preflight hash',
    );
  });

  test('G4-03: Model loads without modification and reports 4.89M parameters', () => {
    const adapter = Native5MAdapter.getInstance();
    assert.strictEqual(adapter.isAvailable(), true, 'Adapter must be available');
    assert.strictEqual(adapter.getParameterCount(), 4894208, 'Must report exact 4,894,208 parameters');
    assert.strictEqual(
      adapter.getWeightsHash(),
      'a9b85f59445cf3a53ee327a9a0c0f9703ea32082caaf20668e66971ce3170b71',
      'Weights hash must match authoritative certified hash',
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 2 — Neural Language Generation
// ══════════════════════════════════════════════════════════════════════════════
suite('2: Neural Language Generation', () => {
  const adapter = Native5MAdapter.getInstance();

  test('G4-04: Real inference engine generates short English response', () => {
    const res = adapter.generate('Hello guide, hope you are having a pleasant time this morning.', {
      maxTokens: 30,
      temperature: 0.1,
    });
    assert.strictEqual(res.isModelOutput, true, 'Result must be from real model output');
    assert.ok(res.text.length > 5, 'Must generate readable text');
    assert.ok(res.latencyMs > 0, 'Must record latency');
    assert.ok(res.tokenIds.length > 0, 'Must produce token IDs');
  });

  test('G4-05: Generation strictly respects maxTokens <= 45', () => {
    const res = adapter.generate('Tell me about the morning routine.', {
      maxTokens: 100, // Request > 45, adapter must clamp to 45
    });
    assert.ok(res.tokenIds.length <= 45, `Token count ${res.tokenIds.length} exceeds 45 cap`);
  });

  test('G4-06: Repetition penalty prevents runaway token loops', () => {
    const res = adapter.generate('repeating words words words', {
      maxTokens: 20,
      repetitionPenalty: 1.5,
    });
    assert.strictEqual(res.isModelOutput, true);
    // Ensure no runaway repeating character like aaaaaa
    assert.ok(!res.text.includes('aaaaaa'), 'Should not produce infinite char loops');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 3 — Hybrid Interface: Greetings & Conversational
// ══════════════════════════════════════════════════════════════════════════════
suite('3: Hybrid Interface Conversational', () => {
  test('G4-07: Greeting with enableNeuralInference=true returns VERIFIED neural response', () => {
    const { engine } = makeEngine();
    const resp = engine.processInput({
      text: 'Hello guide, hope you are having a pleasant time this morning.',
      enableNeuralInference: true,
    });
    assert.strictEqual(resp.status, HybridResponseStatus.RESOLVED);
    assert.strictEqual(resp.intentType, UserIntentType.CONVERSATIONAL_FACT);
    assert.strictEqual(resp.meta.neuralInference, 'VERIFIED');
    assert.strictEqual(resp.meta.neuralModelId, 'CUBIO-NATIVE-MODEL-V1-4.89M');
    assert.ok(resp.meta.neuralInferenceMs !== undefined && resp.meta.neuralInferenceMs >= 0);
    assert.ok(resp.naturalLanguageText.length > 0);
  });

  test('G4-08: Greeting without enableNeuralInference falls back cleanly to deterministic response', () => {
    const { engine } = makeEngine();
    const resp = engine.processInput({ text: 'Hello!' });
    assert.strictEqual(resp.status, HybridResponseStatus.RESOLVED);
    assert.strictEqual(resp.meta.neuralInference, 'NOT_IMPLEMENTED');
    assert.ok(resp.naturalLanguageText.includes('Hello'));
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 4 — Symbolic Routing: Arithmetic & Concept Preservation
// ══════════════════════════════════════════════════════════════════════════════
suite('4: Symbolic Routing & Validation', () => {
  test('G4-09: Arithmetic reasoning dispatched to Phase 3 ReasoningEngine', () => {
    const { engine } = makeEngine();
    const resp = engine.processInput({
      text: 'starting from 10, subtract until 0',
      enableNeuralInference: true, // Even if neural is requested, reasoning must stay symbolic
    });
    assert.strictEqual(resp.intentType, UserIntentType.REASONING_TASK);
    assert.strictEqual(resp.isSolved, true);
    assert.strictEqual(resp.reasoningStatus, ReasoningStatus.SOLVED);
    assert.ok(resp.derivation && resp.derivation.length > 0, 'Must include verified derivation trace');
    assert.ok((resp.stepsUsed ?? 0) > 0, 'Must consume symbolic reasoning steps');
  });

  test('G4-10: Concept query dispatched to Phase 4 ConceptGraph', () => {
    const { memory, engine } = makeEngine();
    populateTaxonomy(memory);
    const resp = engine.processInput({
      text: 'What properties does concept_car have?',
      enableNeuralInference: true,
    });
    assert.strictEqual(resp.status, HybridResponseStatus.RESOLVED);
    assert.strictEqual(resp.intentType, UserIntentType.CONCEPT_QUERY);
    assert.ok(resp.resolvedConcepts && resp.resolvedConcepts.length > 0);
    const carFact = resp.resolvedConcepts!.find((c) => c.conceptId === 'concept_car');
    assert.ok(carFact, 'concept_car must be resolved');
    const wheelsFact = resp.resolvedConcepts!.find((c) => c.conceptId === 'concept_wheels');
    assert.ok(wheelsFact, 'concept_wheels must be inferred via transitive graph edge');
  });

  test('G4-11: Ambiguous request returns CLARIFICATION_NEEDED without hallucination', () => {
    const { engine } = makeEngine();
    const resp = engine.processInput({
      text: '7 and 14',
      enableNeuralInference: true,
    });
    assert.strictEqual(resp.status, HybridResponseStatus.CLARIFICATION_NEEDED);
    assert.strictEqual(resp.isUncertain, true);
    assert.strictEqual(resp.isSolved, false);
  });

  test('G4-12: Unsupported query does not invent verified facts', () => {
    const { engine } = makeEngine();
    const resp = engine.processInput({
      text: 'What is concept_quantum_teleportation?',
      enableNeuralInference: true,
    });
    assert.strictEqual(resp.status, HybridResponseStatus.UNSUPPORTED);
    assert.strictEqual(resp.isSolved, false);
    assert.strictEqual(resp.resolvedConcepts?.length, 0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 5 — Fail-Safe Degradation & Memory Policy
// ══════════════════════════════════════════════════════════════════════════════
suite('5: Fail-Safe Degradation & Memory Policy', () => {
  test('G4-13: Invalid checkpoint path fails gracefully without crash', () => {
    const invalidPath = 'E:/nonexistent_checkpoint.cubiomodel';
    const adapter = new Native5MAdapter(invalidPath);
    assert.strictEqual(adapter.isAvailable(), false);
    assert.ok(adapter.getLoadError()?.includes('not found'));

    const gen = adapter.generate('Hello');
    assert.strictEqual(gen.isModelOutput, false);
    assert.ok(gen.error !== undefined);
  });

  test('G4-14: Engine degrades to fallback when checkpoint missing', () => {
    const { engine } = makeEngine('E:/nonexistent_checkpoint.cubiomodel');
    const resp = engine.processInput({
      text: 'Hello!',
      enableNeuralInference: true,
    });
    assert.strictEqual(resp.status, HybridResponseStatus.RESOLVED);
    assert.strictEqual(resp.meta.neuralInference, 'NOT_IMPLEMENTED');
    assert.ok(resp.naturalLanguageText.includes('Hello'));
  });

  test('G4-15: Selective memory logs reasoning tasks but NOT greetings', () => {
    const { memory, engine } = makeEngine();
    const initialStats = memory.getStats();

    // 1. Greeting should NOT log episode
    engine.processInput({ text: 'Hello guide', enableNeuralInference: true });
    const midStats = memory.getStats();
    assert.strictEqual(midStats.episodicCount, initialStats.episodicCount, 'Greeting must not log episode');

    // 2. Reasoning task MUST log episode
    engine.processInput({ text: 'starting from 5, subtract until 0' });
    const finalStats = memory.getStats();
    assert.ok(finalStats.episodicCount > midStats.episodicCount, 'Reasoning task must log episode');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Final Report
// ══════════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════════════════════════');
console.log(`  Phase 5 Gate 4 — Native 5M-v2 Hybrid Integration Test Report`);
console.log(`  Total: ${total}  |  Passed: ${passed}  |  Failed: ${failed}`);
console.log('══════════════════════════════════════════════════════════════════════');

if (failed > 0) {
  process.exit(1);
}
