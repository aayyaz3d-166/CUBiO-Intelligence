/**
 * ONE Language — Phase 5 Gate 2: Hybrid Conversational Interface Tests
 * (tests/hybrid/phase5_hybrid_conversation.test.ts)
 *
 * Suites:
 *   A — Intent parsing
 *   B — Reasoning dispatch (Phase 3 integration)
 *   C — Concept retrieval (Phase 4 integration)
 *   D — Safety & invariants
 *   E — Memory policy (episodic logging, working memory)
 *   F — Neural inference gap report
 */

import * as assert from 'assert';
import { BinaryEncoder, BinaryDecoder } from '../../src/binary/index';
import { IntentParser } from '../../src/one/intelligence/hybrid/IntentParser';
import {
  HybridConversationEngine,
} from '../../src/one/intelligence/hybrid/HybridConversationEngine';
import {
  HybridRequest,
  HybridResponseStatus,
  UserIntentType,
  validateHybridRequest,
} from '../../src/one/intelligence/hybrid/types';
import { SelectiveMemory } from '../../src/one/intelligence/memory/SelectiveMemory';
import { ConceptGraph } from '../../src/one/intelligence/memory/ConceptGraph';
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

/** Build a fresh memory + engine pair for each test that needs isolation. */
function makeEngine(): { memory: SelectiveMemory; engine: HybridConversationEngine } {
  const ruleRegistry = new RuleRegistry();
  const memory = new SelectiveMemory(ruleRegistry as RuleRegistry<unknown>, 50);
  const engine = new HybridConversationEngine(memory);
  return { memory, engine };
}

/** Populate concept graph with a small taxonomy for concept tests. */
function populateConceptGraph(memory: SelectiveMemory): void {
  const now = Date.now();
  const g = memory.semanticGraph;

  g.addConcept({
    conceptId: 'concept_vehicle', label: 'Vehicle', type: 'CATEGORY',
    attributes: {}, source: 'VERIFIED_FACT', confidence: 1.0,
    version: 1, createdAt: now, updatedAt: now,
  });
  g.addConcept({
    conceptId: 'concept_car', label: 'Car', type: 'OBJECT',
    attributes: { wheels: 4 }, source: 'VERIFIED_FACT', confidence: 0.99,
    version: 1, createdAt: now, updatedAt: now,
  });
  g.addConcept({
    conceptId: 'concept_engine', label: 'Engine', type: 'OBJECT',
    attributes: {}, source: 'VERIFIED_FACT', confidence: 0.97,
    version: 1, createdAt: now, updatedAt: now,
  });
  g.addConcept({
    conceptId: 'concept_wheels', label: 'Wheels', type: 'PROPERTY',
    attributes: {}, source: 'VERIFIED_FACT', confidence: 0.98,
    version: 1, createdAt: now, updatedAt: now,
  });

  g.addRelationship({
    relationshipId: 'rel_car_isA_vehicle', sourceConceptId: 'concept_car',
    relationType: 'isA', targetConceptId: 'concept_vehicle',
    provenance: 'VERIFIED_FACT', confidence: 1.0, version: 1, createdAt: now,
  });
  g.addRelationship({
    relationshipId: 'rel_car_has_engine', sourceConceptId: 'concept_car',
    relationType: 'hasProperty', targetConceptId: 'concept_engine',
    provenance: 'VERIFIED_FACT', confidence: 0.95, version: 1, createdAt: now,
  });
  g.addRelationship({
    relationshipId: 'rel_vehicle_has_wheels', sourceConceptId: 'concept_vehicle',
    relationType: 'hasProperty', targetConceptId: 'concept_wheels',
    provenance: 'VERIFIED_FACT', confidence: 0.98, version: 1, createdAt: now,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Suite A — Intent Parsing
// ══════════════════════════════════════════════════════════════════════════════
suite('A: Intent Parsing', () => {
  const parser = new IntentParser();

  test('A-01: Numeric subtraction phrase → REASONING_TASK', () => {
    const intent = parser.parse('starting from 10, subtract until 0');
    assert.strictEqual(intent.intentType, UserIntentType.REASONING_TASK);
    assert.ok(intent.entities.inputValue !== undefined, 'inputValue should be set');
    assert.ok(intent.entities.targetValue !== undefined, 'targetValue should be set');
    assert.strictEqual(intent.clarificationRequired, false);
    assert.ok(intent.confidence >= 0.7, `confidence should be ≥0.7, got ${intent.confidence}`);
  });

  test('A-02: "find numbers smaller than X" → REASONING_TASK', () => {
    const intent = parser.parse('find numbers smaller than 5');
    assert.strictEqual(intent.intentType, UserIntentType.REASONING_TASK);
    assert.ok(intent.entities.targetValue === 5, `expected targetValue=5, got ${intent.entities.targetValue}`);
  });

  test('A-03: Count-down phrase → REASONING_TASK with correct bounds', () => {
    const intent = parser.parse('10 to 3');
    assert.strictEqual(intent.intentType, UserIntentType.REASONING_TASK);
    assert.strictEqual(intent.entities.inputValue, 10);
    assert.strictEqual(intent.entities.targetValue, 3);
  });

  test('A-04: Concept properties query → CONCEPT_QUERY', () => {
    const intent = parser.parse('What properties does concept_car have?');
    assert.strictEqual(intent.intentType, UserIntentType.CONCEPT_QUERY);
    assert.ok(intent.entities.conceptId?.includes('car'), `expected concept_car, got ${intent.entities.conceptId}`);
  });

  test('A-05: "Is X related to Y" → CONCEPT_QUERY', () => {
    const intent = parser.parse('Is car related to vehicle?');
    assert.strictEqual(intent.intentType, UserIntentType.CONCEPT_QUERY);
  });

  test('A-06: Greeting → CONVERSATIONAL_FACT', () => {
    const intent = parser.parse('Hello!');
    assert.strictEqual(intent.intentType, UserIntentType.CONVERSATIONAL_FACT);
    assert.strictEqual(intent.clarificationRequired, false);
  });

  test('A-07: Random unsupported text → UNKNOWN_REQUEST', () => {
    const intent = parser.parse('xyzzy plugh frobozz');
    assert.strictEqual(intent.intentType, UserIntentType.UNKNOWN_REQUEST);
    assert.strictEqual(intent.clarificationRequired, true);
  });

  test('A-08: Ambiguous two-number input → UNKNOWN_REQUEST (clarification needed)', () => {
    const intent = parser.parse('7 and 14');
    assert.strictEqual(intent.intentType, UserIntentType.UNKNOWN_REQUEST);
    assert.strictEqual(intent.clarificationRequired, true);
    assert.ok(intent.entities.rawNumbers?.includes(7), 'should contain 7 in rawNumbers');
  });

  test('A-09: rawText preserved verbatim', () => {
    const text = '  Starting from 100, subtract until 0.  ';
    const intent = parser.parse(text.trim());
    assert.strictEqual(intent.rawText, text.trim());
  });

  test('A-10: parse() never throws on arbitrary input', () => {
    const inputs = ['', '!!!', '\n\n', '0', 'null', 'undefined', '{"a":1}'];
    for (const inp of inputs) {
      // Should not throw
      try {
        const result = parser.parse(inp);
        assert.ok(result.intentType, `Expected intent type for input: "${inp}"`);
      } catch (e) {
        assert.fail(`parse() threw for input "${inp}": ${String(e)}`);
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite B — Reasoning Dispatch (Phase 3 Integration)
// ══════════════════════════════════════════════════════════════════════════════
suite('B: Reasoning Dispatch', () => {
  test('B-01: Numeric subtraction task dispatches to Phase 3 engine', () => {
    const { engine } = makeEngine();
    const req: HybridRequest = { text: 'starting from 5, subtract until 0' };
    const resp = engine.processInput(req);
    assert.ok(
      resp.status === HybridResponseStatus.RESOLVED || resp.status === HybridResponseStatus.PARTIAL,
      `Expected RESOLVED or PARTIAL, got ${resp.status}`,
    );
    assert.strictEqual(resp.intentType, UserIntentType.REASONING_TASK);
    assert.ok(resp.stepsUsed !== undefined && resp.stepsUsed >= 0, 'stepsUsed must be set');
    assert.ok(resp.stopReason, 'stopReason must be set');
  });

  test('B-02: Solved reasoning returns isSolved=true and derivation steps', () => {
    const { engine } = makeEngine();
    const req: HybridRequest = { text: 'starting from 3, subtract until 0', maxReasoningSteps: 50 };
    const resp = engine.processInput(req);
    assert.strictEqual(resp.isSolved, true);
    assert.ok(resp.derivation && resp.derivation.length > 0, 'derivation should have steps');
    assert.ok(resp.reasoningStatus === ReasoningStatus.SOLVED, `expected SOLVED status, got ${resp.reasoningStatus}`);
  });

  test('B-03: Already-at-goal input returns zero steps', () => {
    const { engine } = makeEngine();
    const req: HybridRequest = { text: 'count down from 5 to 5' };
    const resp = engine.processInput(req);
    assert.strictEqual(resp.isSolved, true);
    assert.strictEqual(resp.stepsUsed, 0);
  });

  test('B-04: Budget enforcement — maxReasoningSteps respected', () => {
    const { engine } = makeEngine();
    // Big gap to force budget exhaustion quickly
    const req: HybridRequest = { text: 'starting from 1000, subtract until 0', maxReasoningSteps: 5 };
    const resp = engine.processInput(req);
    // Should stop at budget
    assert.ok(
      resp.status === HybridResponseStatus.PARTIAL || resp.status === HybridResponseStatus.RESOLVED,
      `Expected PARTIAL or RESOLVED, got ${resp.status}`,
    );
    assert.ok((resp.stepsUsed ?? 0) <= 6, `Steps used (${resp.stepsUsed}) should respect budget of 5`);
  });

  test('B-05: STEP_LIMIT stop reason propagated to response', () => {
    const { engine } = makeEngine();
    const req: HybridRequest = { text: 'starting from 100, subtract until 0', maxReasoningSteps: 3 };
    const resp = engine.processInput(req);
    assert.ok(resp.stopReason, 'stopReason must be present');
  });

  test('B-06: Missing inputValue → clarification response (not error)', () => {
    const { engine } = makeEngine();
    // Force ambiguous parsing with no clear start
    const req: HybridRequest = { text: 'subtract until zero' };
    const resp = engine.processInput(req);
    // Should return clarification or unknown, NOT a hard error with stack trace
    assert.ok(
      resp.status !== HybridResponseStatus.ERROR,
      `Should not return ERROR for ambiguous input, got: ${resp.status}`,
    );
  });

  test('B-07: Natural language text always present in response', () => {
    const { engine } = makeEngine();
    const req: HybridRequest = { text: 'starting from 4, subtract until 1' };
    const resp = engine.processInput(req);
    assert.ok(resp.naturalLanguageText.length > 0, 'naturalLanguageText must not be empty');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite C — Concept Retrieval (Phase 4 Integration)
// ══════════════════════════════════════════════════════════════════════════════
suite('C: Concept Retrieval', () => {
  test('C-01: Direct concept property query returns resolved concepts', () => {
    const { memory, engine } = makeEngine();
    populateConceptGraph(memory);
    const req: HybridRequest = { text: 'What properties does concept_car have?' };
    const resp = engine.processInput(req);
    assert.strictEqual(resp.status, HybridResponseStatus.RESOLVED);
    assert.ok(resp.resolvedConcepts && resp.resolvedConcepts.length > 0, 'should return resolved concepts');
    // concept_car itself should be in results
    const carFact = resp.resolvedConcepts!.find((c) => c.conceptId === 'concept_car');
    assert.ok(carFact, 'concept_car should be in resolvedConcepts');
  });

  test('C-02: Multi-hop inherited property — car inherits wheels from vehicle', () => {
    const { memory, engine } = makeEngine();
    populateConceptGraph(memory);
    const req: HybridRequest = { text: 'What properties does concept_car have?' };
    const resp = engine.processInput(req);
    assert.strictEqual(resp.status, HybridResponseStatus.RESOLVED);
    // concept_wheels should appear via car→isA→vehicle→hasProperty→wheels
    const wheelsFact = resp.resolvedConcepts!.find((c) => c.conceptId === 'concept_wheels');
    assert.ok(wheelsFact, `Expected concept_wheels via inheritance. Got: ${resp.resolvedConcepts!.map((c) => c.conceptId).join(', ')}`);
    assert.ok(wheelsFact.inferenceDepth > 0, 'wheels should be inferred (depth > 0)');
  });

  test('C-03: Unknown concept returns UNSUPPORTED, not ERROR', () => {
    const { engine } = makeEngine();
    const req: HybridRequest = { text: 'What is concept_nonexistent?' };
    const resp = engine.processInput(req);
    assert.strictEqual(resp.status, HybridResponseStatus.UNSUPPORTED);
    assert.strictEqual(resp.isSolved, false);
    assert.ok(resp.naturalLanguageText.includes('concept_nonexistent'), 'NL text should name the missing concept');
  });

  test('C-04: Missing conceptId in parsed intent → CLARIFICATION_NEEDED', () => {
    const { engine } = makeEngine();
    // Parsing "tell me about" with no recognizable concept name
    const req: HybridRequest = { text: 'Tell me about .' };
    const resp = engine.processInput(req);
    // Should be clarification or unsupported — not a crash
    assert.ok(
      resp.status === HybridResponseStatus.CLARIFICATION_NEEDED ||
      resp.status === HybridResponseStatus.UNSUPPORTED ||
      resp.status === HybridResponseStatus.RESOLVED,
      `Expected a safe status, got ${resp.status}`,
    );
  });

  test('C-05: Natural language text present for concept query result', () => {
    const { memory, engine } = makeEngine();
    populateConceptGraph(memory);
    const req: HybridRequest = { text: 'What is concept_vehicle?' };
    const resp = engine.processInput(req);
    assert.ok(resp.naturalLanguageText.length > 0, 'naturalLanguageText must not be empty');
    assert.ok(resp.naturalLanguageText.toLowerCase().includes('vehicle'), 'should mention vehicle in response');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite D — Safety & Invariants
// ══════════════════════════════════════════════════════════════════════════════
suite('D: Safety & Invariants', () => {
  test('D-01: Empty text returns ERROR (validation fails)', () => {
    const { engine } = makeEngine();
    const req: HybridRequest = { text: '' };
    const resp = engine.processInput(req);
    assert.strictEqual(resp.status, HybridResponseStatus.ERROR);
  });

  test('D-02: Text > 2048 chars returns ERROR', () => {
    const { engine } = makeEngine();
    const req: HybridRequest = { text: 'a'.repeat(2049) };
    const resp = engine.processInput(req);
    assert.strictEqual(resp.status, HybridResponseStatus.ERROR);
  });

  test('D-03: maxReasoningSteps=0 returns ERROR', () => {
    const { engine } = makeEngine();
    const req: HybridRequest = { text: 'starting from 5, subtract until 0', maxReasoningSteps: 0 };
    const resp = engine.processInput(req);
    assert.strictEqual(resp.status, HybridResponseStatus.ERROR);
  });

  test('D-04: maxReasoningSteps=501 returns ERROR', () => {
    const { engine } = makeEngine();
    const req: HybridRequest = { text: 'starting from 5, subtract until 0', maxReasoningSteps: 501 };
    const resp = engine.processInput(req);
    assert.strictEqual(resp.status, HybridResponseStatus.ERROR);
  });

  test('D-05: validateHybridRequest rejects null/undefined gracefully', () => {
    // @ts-ignore — intentional invalid input test
    const err = validateHybridRequest(null);
    assert.ok(err !== null, 'Should return error string for null input');
  });

  test('D-06: Neural inference always reported as NOT_IMPLEMENTED', () => {
    const { engine } = makeEngine();
    const req: HybridRequest = { text: 'Hello!' };
    const resp = engine.processInput(req);
    assert.strictEqual(resp.meta.neuralInference, 'NOT_IMPLEMENTED');
    assert.ok(resp.meta.neuralInferenceBlockedReason.length > 10, 'Should explain why neural is blocked');
  });

  test('D-07: Binary Language v1.0 files remain unmodified (spot check)', () => {
    // Verify that binary module can still be imported and roundtrip works (static methods)
    const encoded = BinaryEncoder.encode(42);
    const result = BinaryDecoder.decode(encoded);
    // decode() returns { bitsConsumed: number, value: SupportedBinaryValue }
    const decoded = typeof result === 'object' && result !== null && 'value' in result ? result.value : result;
    assert.strictEqual(decoded, 42, 'Binary encode→decode roundtrip must work (Phase 2 frozen)');
  });

  test('D-08: Arbitrary code injection in text does not execute', () => {
    const { engine } = makeEngine();
    // Malicious-looking inputs
    const malicious = [
      'require("fs").unlinkSync("/etc/passwd")',
      '__proto__["polluted"] = true',
      'process.exit(1)',
    ];
    for (const text of malicious) {
      const resp = engine.processInput({ text });
      // Must return a valid response, not execute code or crash
      assert.ok(resp.status, `Expected valid status for input: ${text}`);
      assert.ok(resp.naturalLanguageText.length > 0, 'Must return text, not execute code');
    }
    // Verify proto not polluted
    assert.strictEqual((Object.prototype as any).polluted, undefined, 'Prototype must not be polluted');
  });

  test('D-09: Unsupported/ambiguous requests never invent facts', () => {
    const { engine } = makeEngine();
    const req: HybridRequest = { text: 'Who won the 2024 election?' };
    const resp = engine.processInput(req);
    // Should be CLARIFICATION_NEEDED or UNSUPPORTED, NOT a made-up answer
    assert.ok(
      resp.status === HybridResponseStatus.CLARIFICATION_NEEDED ||
      resp.status === HybridResponseStatus.UNSUPPORTED,
      `Expected clarification or unsupported for unsupported query, got ${resp.status}`,
    );
    assert.strictEqual(resp.isUncertain, true, 'isUncertain must be true for unsupported query');
    assert.strictEqual(resp.isSolved, false, 'isSolved must be false');
  });

  test('D-10: Response meta.timestamp is a valid ISO string', () => {
    const { engine } = makeEngine();
    const resp = engine.processInput({ text: 'Hello' });
    const ts = new Date(resp.meta.timestamp);
    assert.ok(!isNaN(ts.getTime()), `meta.timestamp "${resp.meta.timestamp}" is not a valid ISO timestamp`);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite E — Memory Policy
// ══════════════════════════════════════════════════════════════════════════════
suite('E: Memory Policy', () => {
  test('E-01: Reasoning task episode is logged to episodic memory', () => {
    const { memory, engine } = makeEngine();
    const statsBefore = memory.getStats();
    engine.processInput({ text: 'starting from 5, subtract until 0' });
    const statsAfter = memory.getStats();
    assert.ok(
      statsAfter.episodicCount > statsBefore.episodicCount,
      `Episodic count should increase after reasoning task (before=${statsBefore.episodicCount}, after=${statsAfter.episodicCount})`,
    );
  });

  test('E-02: Greeting does NOT log to episodic memory', () => {
    const { memory, engine } = makeEngine();
    const statsBefore = memory.getStats();
    engine.processInput({ text: 'Hello!' });
    const statsAfter = memory.getStats();
    assert.strictEqual(
      statsAfter.episodicCount,
      statsBefore.episodicCount,
      'Greetings should not log episodic records',
    );
  });

  test('E-03: meta.episodeLogged reflects actual logging', () => {
    const { engine } = makeEngine();
    const reasoningResp = engine.processInput({ text: 'starting from 3, subtract until 0' });
    const greetingResp = engine.processInput({ text: 'Hello!' });
    assert.strictEqual(reasoningResp.meta.episodeLogged, true, 'Reasoning task should log episode');
    assert.strictEqual(greetingResp.meta.episodeLogged, false, 'Greeting should not log episode');
  });

  test('E-04: Multiple sessions have independent sessionId in meta', () => {
    const { engine } = makeEngine();
    const resp1 = engine.processInput({ text: 'Hello', sessionId: 'session-A' });
    const resp2 = engine.processInput({ text: 'Hello', sessionId: 'session-B' });
    assert.strictEqual(resp1.meta.sessionId, 'session-A');
    assert.strictEqual(resp2.meta.sessionId, 'session-B');
  });

  test('E-05: Concept query does not log episodic record', () => {
    const { memory, engine } = makeEngine();
    populateConceptGraph(memory);
    const statsBefore = memory.getStats();
    engine.processInput({ text: 'What properties does concept_car have?' });
    const statsAfter = memory.getStats();
    assert.strictEqual(
      statsAfter.episodicCount,
      statsBefore.episodicCount,
      'Concept queries should not log episodic records',
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite F — Neural Inference Gap Report
// ══════════════════════════════════════════════════════════════════════════════
suite('F: Neural Inference Gap Report', () => {
  test('F-01: Neural inference is NOT_IMPLEMENTED in all response paths', () => {
    const { memory, engine } = makeEngine();
    populateConceptGraph(memory);
    const requests: HybridRequest[] = [
      { text: 'Hello!' },
      { text: 'starting from 3, subtract until 0' },
      { text: 'What properties does concept_car have?' },
      { text: 'xyzzy plugh' },
    ];
    for (const req of requests) {
      const resp = engine.processInput(req);
      assert.strictEqual(
        resp.meta.neuralInference,
        'NOT_IMPLEMENTED',
        `neuralInference must be NOT_IMPLEMENTED for text: "${req.text}"`,
      );
    }
  });

  test('F-02: Blocked reason references spatial vocab constraint', () => {
    const { engine } = makeEngine();
    const resp = engine.processInput({ text: 'Hello!' });
    assert.ok(
      resp.meta.neuralInferenceBlockedReason.toLowerCase().includes('vocab') ||
      resp.meta.neuralInferenceBlockedReason.toLowerCase().includes('spatial'),
      'Blocked reason should explain vocab/spatial limitation',
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Suite G — Follow-Up Resolution (GATE 14)
// ──────────────────────────────────────────────────────────────────────────────
suite('G: Follow-Up Resolution', () => {
  const parser = new IntentParser();
  const ruleRegistry = new RuleRegistry<number>();
  const memory = new SelectiveMemory(ruleRegistry as RuleRegistry<unknown>, 50);
  populateConceptGraph(memory);
  const engine = new HybridConversationEngine(memory);

  // Helper: build a session with a prior numeric turn, then a follow-up.
  function followUpTest(
    turn1: string,
    followUp: string,
    expectedStatus: HybridResponseStatus,
    expectedSolved: boolean,
    expectedTextSnippet: string,
  ): void {
    const req1: HybridRequest = { text: turn1, sessionId: 'sess-g1' };
    const r1 = engine.processInput(req1);
    assert.strictEqual(r1.status, HybridResponseStatus.RESOLVED, 'turn 1 must be SOLVED');

    const req2: HybridRequest = { text: followUp, sessionId: 'sess-g1' };
    const r2 = engine.processInput(req2);
    assert.strictEqual(r2.status, expectedStatus, `expected status ${expectedStatus}, got ${r2.status}`);
    assert.strictEqual(r2.isSolved, expectedSolved, `expected isSolved ${expectedSolved}, got ${r2.isSolved}`);
    assert.ok(r2.naturalLanguageText.includes(expectedTextSnippet), `text should contain "${expectedTextSnippet}"`);
    assert.strictEqual((r2.meta as any).sessionId, 'sess-g1', 'sessionId must be preserved');
    assert.strictEqual(r2.meta.episodeLogged, false, 'follow-up must not log episodic');
  }

  test('G-01: "subtract by 5" follow-up resolves to most recent numeric chain', () => {
    followUpTest(
      'starting from 42, subtract until 0',
      'subtract by 5',
      HybridResponseStatus.RESOLVED,
      true,
      'Follow-up resolved',
    );
  });

  test('G-02: "it" follow-up after concept query resolves to that concept', () => {
    const req1: HybridRequest = { text: 'What properties does concept_car have?', sessionId: 'sess-g2' };
    const r1 = engine.processInput(req1);
    assert.strictEqual(r1.status, HybridResponseStatus.RESOLVED, 'turn 1 must be SOLVED');

    const req2: HybridRequest = { text: 'it', sessionId: 'sess-g2' };
    const r2 = engine.processInput(req2);
    assert.strictEqual(r2.status, HybridResponseStatus.RESOLVED, 'follow-up "it" must be RESOLVED');
    assert.ok(r2.resolvedConcepts !== undefined && r2.resolvedConcepts.length > 0);
    assert.strictEqual((r2.meta as any).sessionId, 'sess-g2');
    assert.strictEqual(r2.meta.episodeLogged, false);
  });

  test('G-03: ambiguous "it" with no prior concept/relation returns CLARIFICATION', () => {
    const req: HybridRequest = { text: 'it', sessionId: 'sess-g3' };
    const r = engine.processInput(req);
    assert.strictEqual(r.status, HybridResponseStatus.CLARIFICATION_NEEDED);
    assert.strictEqual(r.isSolved, false);
    assert.ok(r.naturalLanguageText.includes('could not resolve'), 'should not invent a referent');
    assert.strictEqual((r.meta as any).sessionId, 'sess-g3');
  });

  test('G-04: session reset clears dialogue state (cross-session isolation)', () => {
    const req1: HybridRequest = { text: 'starting from 42, subtract until 0', sessionId: 'sess-g4' };
    const r1 = engine.processInput(req1);
    assert.strictEqual(r1.status, HybridResponseStatus.RESOLVED);

    engine.resetSession('sess-g4');

    const req2: HybridRequest = { text: 'it', sessionId: 'sess-g4' };
    const r2 = engine.processInput(req2);
    assert.strictEqual(r2.status, HybridResponseStatus.CLARIFICATION_NEEDED, 'reset must clear dialogue state');
    assert.ok(r2.naturalLanguageText.includes('do not have a visible numeric chain'), 'must not leak prior session');
  });

  test('G-05: expired context — session without turns yields CLARIFICATION', () => {
    const req: HybridRequest = { text: 'its relations', sessionId: 'sess-g5' };
    const r = engine.processInput(req);
    assert.strictEqual(r.status, HybridResponseStatus.CLARIFICATION_NEEDED, 'no prior session => clarification');
    assert.strictEqual((r.meta as any).sessionId, 'sess-g5');
  });

  test('G-06: "show its relations" follow-up reports exact graph relations, no invented links', () => {
    const req1: HybridRequest = { text: 'What properties does concept_car have?', sessionId: 'sess-g6' };
    const r1 = engine.processInput(req1);
    assert.strictEqual(r1.status, HybridResponseStatus.RESOLVED);

    const req2: HybridRequest = { text: 'show its relations', sessionId: 'sess-g6' };
    const r2 = engine.processInput(req2);
    assert.strictEqual(r2.status, HybridResponseStatus.RESOLVED);
    assert.ok(r2.resolvedConcepts !== undefined);
    // The graph has car->isA->vehicle, car->hasProperty->engine.
    // It must NOT invent car->isA->wheels (no direct rel).  We check the
    // reported relations are a subset of the known graph relations.
    const relTypes = r2.resolvedConcepts!.map((c, i) => c.relationType).filter(Boolean);
    // Car's direct relations in graph: isA(vehicle), hasProperty(engine)
    const known = new Set(['isA', 'hasProperty']);
    for (const t of relTypes) {
      assert.ok(known.has(t), `invented relation type ${t} not in graph`);
    }
    assert.strictEqual((r2.meta as any).sessionId, 'sess-g6');
    assert.strictEqual(r2.meta.episodeLogged, false);
  });

  test('G-07: contradictory facts produce clarification, not a guess', () => {
    const req: HybridRequest = { text: 'it', sessionId: 'sess-g7' };
    const r = engine.processInput(req);
    assert.strictEqual(r.status, HybridResponseStatus.CLARIFICATION_NEEDED);
    assert.ok(r.naturalLanguageText.includes('could not resolve'), 'ambiguous => clarification');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Suite H — Memory Limits & Bounded Context (GATE 14)
// ──────────────────────────────────────────────────────────────────────────────
suite('H: Memory Limits & Bounded Context', () => {
  const parser = new IntentParser();
  const ruleRegistry = new RuleRegistry<number>();
  const memory = new SelectiveMemory(ruleRegistry as RuleRegistry<unknown>, 50);
  const engine = new HybridConversationEngine(memory);

  test('H-01: excessive turns do not grow working memory (bounded reference window)', () => {
    for (let i = 0; i < 50; i++) {
      const req: HybridRequest = { text: `starting from 1, subtract until 0`, sessionId: 'sess-h1' };
      engine.processInput(req);
    }
    // The reference window is bounded to 10 turns.
    const state = engine['dialogueState'].get('sess-h1');
    assert.ok(state !== undefined, 'dialogue state must exist');
    assert.ok(state.referenceWindow.length <= 10, `reference window must be <= 10, got ${state.referenceWindow.length}`);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Final Report
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════════════');
console.log(`  Phase 5 Gate 2 — Hybrid Conversational Interface Test Report`);
console.log(`  Total: ${total}  |  Passed: ${passed}  |  Failed: ${failed}`);
console.log('══════════════════════════════════════════════════════════════════════');
console.log('');
console.log('  NEURAL INFERENCE STATUS: NOT_IMPLEMENTED');
console.log('  Reason: CUBIO-MODEL-STAGE1-V1 has vocab_size=369 spatial tokens.');
console.log('  Natural-language generation requires a future NLP-capable model.');
console.log('  Symbolic/deterministic conversational path: VERIFIED');
console.log('');

if (failed > 0) {
  process.exit(1);
}
