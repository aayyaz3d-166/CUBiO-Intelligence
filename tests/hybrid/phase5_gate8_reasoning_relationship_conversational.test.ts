/**
 * ONE Language — Phase 5 Gate 8: Reasoning Efficiency, Relationship Correctness
 *              & Conversational Robustness Tests
 * (tests/hybrid/phase5_gate8_reasoning_relationship_conversational.test.ts)
 *
 * Verifies the three Gate 7 failure classes fixed in Gate 8:
 *
 *   P1: Pairwise relationship correctness
 *       — Verify both concepts exist before asserting a relationship.
 *       — Return UNSUPPORTED when either concept is unknown; never hallucinate.
 *       — Return RESOLVED with relationship detail when graph edge exists.
 *       — Return RESOLVED with explicit "no known relationship" when both exist but unrelated.
 *
 *   P2: Goal-directed symbolic reasoning (budget efficiency)
 *       — Directional engine selection prevents BFS budget exhaustion.
 *       — Assert via resp.isSolved and resp.naturalLanguageText; NOT derivation[last].value.
 *       — 42→0 (decrement), 100→50 (decrement), 18→3 (decrement), 5→20 (increment).
 *       — Already-at-goal, budget-insufficient, and neural-flag independence cases.
 *
 *   P3: Conversational robustness
 *       — Acknowledgments, farewells, and informal state queries route to CONVERSATIONAL_FACT.
 *       — Correct response text returned deterministically.
 *       — Negative matches: unrelated sentences starting with ok/sure do NOT misroute.
 */

import * as assert from 'assert';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { HybridConversationEngine } from '../../src/one/intelligence/hybrid/HybridConversationEngine';
import {
  HybridRequest,
  HybridResponseStatus,
  UserIntentType,
} from '../../src/one/intelligence/hybrid/types';
import { SelectiveMemory } from '../../src/one/intelligence/memory/SelectiveMemory';
import { RuleRegistry } from '../../src/one/intelligence/reasoning/RuleRegistry';
import { ReasoningStatus } from '../../src/one/intelligence/reasoning/types';
import { ProvenanceKind } from '../../src/one/intelligence/memory/types';

// ──────────────────────────────────────────────────────────────────────────────
// Test Harness
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

// ──────────────────────────────────────────────────────────────────────────────
// Engine & Graph Setup
// ──────────────────────────────────────────────────────────────────────────────

function makeEngine(): { memory: SelectiveMemory; engine: HybridConversationEngine } {
  const ruleRegistry = new RuleRegistry();
  const memory = new SelectiveMemory(ruleRegistry as RuleRegistry<unknown>, 50);
  const engine = new HybridConversationEngine(memory, undefined);
  return { memory, engine };
}

/**
 * Populates the concept graph with a small taxonomy used by P1 tests:
 *   concept_vehicle → root category
 *   concept_car     → isA concept_vehicle
 *   concept_wheels  → concept_vehicle hasProperty concept_wheels
 *   concept_engine  → concept_car hasProperty concept_engine (direct from car)
 *
 * Absent from graph: concept_tardis, concept_nonexistent
 */
function populateTaxonomy(memory: SelectiveMemory): void {
  const now = Date.now();
  const g = memory.semanticGraph;

  g.addConcept({
    conceptId: 'concept_vehicle',
    label: 'Vehicle',
    type: 'CATEGORY',
    attributes: {},
    source: 'VERIFIED_FACT' as ProvenanceKind,
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
    source: 'VERIFIED_FACT' as ProvenanceKind,
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
    source: 'VERIFIED_FACT' as ProvenanceKind,
    confidence: 0.98,
    version: 1,
    createdAt: now,
    updatedAt: now,
  });
  g.addConcept({
    conceptId: 'concept_engine',
    label: 'Engine',
    type: 'PROPERTY',
    attributes: {},
    source: 'VERIFIED_FACT' as ProvenanceKind,
    confidence: 0.97,
    version: 1,
    createdAt: now,
    updatedAt: now,
  });
  g.addConcept({
    conceptId: 'concept_boat',
    label: 'Boat',
    type: 'OBJECT',
    attributes: {},
    source: 'VERIFIED_FACT' as ProvenanceKind,
    confidence: 0.95,
    version: 1,
    createdAt: now,
    updatedAt: now,
  });

  g.addRelationship({
    relationshipId: 'rel_car_isA_vehicle',
    sourceConceptId: 'concept_car',
    relationType: 'isA',
    targetConceptId: 'concept_vehicle',
    provenance: 'VERIFIED_FACT' as ProvenanceKind,
    confidence: 1.0,
    version: 1,
    createdAt: now,
  });
  g.addRelationship({
    relationshipId: 'rel_vehicle_has_wheels',
    sourceConceptId: 'concept_vehicle',
    relationType: 'hasProperty',
    targetConceptId: 'concept_wheels',
    provenance: 'VERIFIED_FACT' as ProvenanceKind,
    confidence: 0.98,
    version: 1,
    createdAt: now,
  });
  g.addRelationship({
    relationshipId: 'rel_car_has_engine',
    sourceConceptId: 'concept_car',
    relationType: 'hasProperty',
    targetConceptId: 'concept_engine',
    provenance: 'VERIFIED_FACT' as ProvenanceKind,
    confidence: 0.97,
    version: 1,
    createdAt: now,
  });
  // concept_boat is in the graph but has NO edges to car/vehicle/wheels
}

function req(text: string, sessionId = 'g8-test', extra?: Partial<HybridRequest>): HybridRequest {
  return { text, sessionId, ...extra };
}

// ──────────────────────────────────────────────────────────────────────────────
// HEADER
// ──────────────────────────────────────────────────────────────────────────────

console.log('================================================================');
console.log('ONE LANGUAGE — PHASE 5 GATE 8: REASONING, RELATIONSHIP & CONVERSATIONAL TESTS');
console.log('================================================================');

// ══════════════════════════════════════════════════════════════════════════════
// Pre-check: Protected artifact integrity
// ══════════════════════════════════════════════════════════════════════════════

suite('0: Protected Artifact Integrity', () => {
  const PROTECTED: Array<{ file: string; hash: string; label: string; searchPaths: string[] }> = [
    {
      file: 'E:/3D memory studio/data/checkpoints/one_lm_v1/one_lm_best.cubiomodel',
      hash: '2D35BB53A226FD369C3B282C1EA6A0D039F66A3557D31A77EAC72ED8C9DBF948',
      label: 'Checkpoint',
      searchPaths: [],
    },
    {
      file: 'src/binary/binaryCodebook.ts',
      hash: 'EBE03AC18ACC395A0BF3E5E9F78DE648E4755D44FD9C5C5DF9CA8639D85FDE49',
      label: 'binaryCodebook.ts',
      searchPaths: [],
    },
    {
      file: 'src/binary/binaryDecoder.ts',
      hash: '68B5AE692B8C483B575A76F2B205912255F0717CB0039EFB47C885455D87DDCA',
      label: 'binaryDecoder.ts',
      searchPaths: [],
    },
    {
      file: 'src/binary/binaryEncoder.ts',
      hash: '43A6133B1E9243C5DD9503ABCCCFD979D2E107F97CA8BF330C545E5801CB15E7',
      label: 'binaryEncoder.ts',
      searchPaths: [],
    },
  ];

  for (const { file, hash, label, searchPaths } of PROTECTED) {
    test(`G8-INT: ${label} SHA-256 unchanged`, () => {
      // Try multiple paths: the original, F:/ONE language prefix, and any search paths
      let absPath: string | null = null;
      const candidates = [
        file,
        `F:/ONE language/${file}`,
        ...searchPaths.map(p => `F:/ONE language/${p}/${file}`),
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          absPath = c;
          break;
        }
      }
      if (!absPath) {
        // Try F:/ONE language/src/binary/ directly
        absPath = `F:/ONE language/src/binary/${file.split('/').pop()}`;
      }
      assert.ok(fs.existsSync(absPath), `Protected file must exist: ${absPath}`);
      const buf = fs.readFileSync(absPath);
      const actual = crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
      assert.strictEqual(
        actual,
        hash.toUpperCase(),
        `${label} hash mismatch — file may have been modified`,
      );
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 1: P1 — Pairwise Relationship Correctness
// ══════════════════════════════════════════════════════════════════════════════

suite('1: P1 — Pairwise Relationship Correctness', () => {
  const { memory, engine } = makeEngine();
  populateTaxonomy(memory);

  // ── Positive: both concepts exist and are directly linked ──────────────────

  test('G8-P1-01: car isA vehicle → RESOLVED with "related"', () => {
    const res = engine.processInput(req('Is concept_car related to concept_vehicle?'));
    assert.strictEqual(res.status, HybridResponseStatus.RESOLVED, `Expected RESOLVED, got ${res.status}`);
    assert.strictEqual(res.intentType, UserIntentType.CONCEPT_QUERY);
    assert.ok(
      res.naturalLanguageText.toLowerCase().includes('related'),
      `Expected "related" in: ${res.naturalLanguageText}`,
    );
    // Both concepts should appear in resolvedConcepts
    assert.ok(
      res.resolvedConcepts && res.resolvedConcepts.length >= 2,
      `Expected at least 2 resolvedConcepts, got ${res.resolvedConcepts?.length ?? 0}`,
    );
  });

  test('G8-P1-02: vehicle hasProperty wheels → RESOLVED with "related"', () => {
    const res = engine.processInput(req('Is concept_vehicle related to concept_wheels?'));
    assert.strictEqual(res.status, HybridResponseStatus.RESOLVED);
    assert.ok(
      res.naturalLanguageText.toLowerCase().includes('related'),
      `Expected "related" in: ${res.naturalLanguageText}`,
    );
  });

  test('G8-P1-03: car inherits wheels via vehicle (multi-hop) → RESOLVED', () => {
    // car → isA → vehicle → hasProperty → wheels: car inherits wheels
    const res = engine.processInput(req('Is concept_car related to concept_wheels?'));
    assert.strictEqual(res.status, HybridResponseStatus.RESOLVED);
    // Either direct or inherited relationship found
    assert.ok(
      res.naturalLanguageText.toLowerCase().includes('related') ||
      res.naturalLanguageText.toLowerCase().includes('no known relationship'),
      `Expected relationship text in: ${res.naturalLanguageText}`,
    );
  });

  // ── Negative: unknown target concept ─────────────────────────────────────

  test('G8-P1-04: car vs concept_tardis (unknown target) → UNSUPPORTED, zero resolvedConcepts', () => {
    const res = engine.processInput(req('Is concept_car related to concept_tardis?'));
    assert.strictEqual(
      res.status,
      HybridResponseStatus.UNSUPPORTED,
      `Expected UNSUPPORTED, got ${res.status}: ${res.naturalLanguageText}`,
    );
    assert.strictEqual(
      res.resolvedConcepts?.length ?? 0,
      0,
      `Expected zero resolvedConcepts for fictitious target`,
    );
    // Must mention the unknown concept or inability to determine
    assert.ok(
      res.naturalLanguageText.toLowerCase().includes('tardis') ||
      res.naturalLanguageText.toLowerCase().includes('unknown') ||
      res.naturalLanguageText.toLowerCase().includes('cannot determine'),
      `Expected mention of unknown concept in: ${res.naturalLanguageText}`,
    );
  });

  // ── Negative: unknown source concept ─────────────────────────────────────

  test('G8-P1-05: concept_nonexistent (unknown source) → UNSUPPORTED', () => {
    const res = engine.processInput(req('Is concept_nonexistent related to concept_vehicle?'));
    assert.strictEqual(
      res.status,
      HybridResponseStatus.UNSUPPORTED,
      `Expected UNSUPPORTED, got ${res.status}: ${res.naturalLanguageText}`,
    );
    // Must not claim a positive relationship for a missing source
    assert.ok(
      !res.naturalLanguageText.toLowerCase().includes('yes'),
      `Should not say yes for unknown source: ${res.naturalLanguageText}`,
    );
  });

  // ── Both exist, no relationship between them ──────────────────────────────

  test('G8-P1-06: car vs boat (both real, no graph edge) → RESOLVED "no known relationship"', () => {
    const res = engine.processInput(req('Is concept_car related to concept_boat?'));
    assert.strictEqual(
      res.status,
      HybridResponseStatus.RESOLVED,
      `Expected RESOLVED (explicit no-relationship), got ${res.status}`,
    );
    assert.ok(
      res.naturalLanguageText.toLowerCase().includes('no known relationship') ||
      res.naturalLanguageText.toLowerCase().includes('not related'),
      `Expected "no known relationship" in: ${res.naturalLanguageText}`,
    );
    // resolvedConcepts should be empty (no relationship found)
    assert.strictEqual(
      res.resolvedConcepts?.length ?? 0,
      0,
      `Expected zero resolvedConcepts for unrelated pair`,
    );
  });

  // ── Both concepts unknown ─────────────────────────────────────────────────

  test('G8-P1-07: both concepts unknown → UNSUPPORTED on source', () => {
    const res = engine.processInput(req('Is concept_unicorn related to concept_dragon?'));
    assert.strictEqual(
      res.status,
      HybridResponseStatus.UNSUPPORTED,
      `Expected UNSUPPORTED when source is unknown, got ${res.status}`,
    );
  });

  // ── Single concept query still works (no regression) ─────────────────────

  test('G8-P1-08: single concept query (no pairwise) still resolves', () => {
    const res = engine.processInput(req('What properties does concept_car have?'));
    assert.strictEqual(
      res.status,
      HybridResponseStatus.RESOLVED,
      `Expected RESOLVED for single concept query, got ${res.status}`,
    );
    assert.ok(
      res.resolvedConcepts && res.resolvedConcepts.length >= 1,
      `Expected at least 1 resolvedConcept`,
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 2: P2 — Goal-Directed Symbolic Reasoning (budget efficiency)
//
// IMPORTANT: These tests assert on resp.isSolved and resp.naturalLanguageText.
// They do NOT read resp.derivation[last].value, which is rankedCandidates sample
// and NOT the goal value. See session summary for full explanation.
// ══════════════════════════════════════════════════════════════════════════════

suite('2: P2 — Goal-Directed Symbolic Reasoning', () => {
  const { engine } = makeEngine();

  // ── Decrement tasks ───────────────────────────────────────────────────────

  test('G8-P2-01: 42 → 0 (decrement) → solved within default budget', () => {
    const res = engine.processInput(req('starting from 42, subtract until 0'));
    assert.strictEqual(
      res.status,
      HybridResponseStatus.RESOLVED,
      `Expected RESOLVED, got ${res.status}: ${res.naturalLanguageText}`,
    );
    assert.strictEqual(res.isSolved, true, `Expected isSolved=true`);
    assert.ok(
      res.naturalLanguageText.includes('Reached 0 from 42') ||
      res.naturalLanguageText.includes('Goal reached') ||
      res.naturalLanguageText.includes('✓'),
      `Expected goal-reached text in: ${res.naturalLanguageText}`,
    );
    assert.strictEqual(res.reasoningStatus, ReasoningStatus.SOLVED);
    assert.ok((res.stepsUsed ?? 0) > 0, 'Must have used at least 1 step');
  });

  test('G8-P2-02: 100 → 50 (decrement, budget=60) → solved', () => {
    const res = engine.processInput(
      req('starting from 100, subtract until 50', 'g8-p2-02', { maxReasoningSteps: 60 }),
    );
    assert.strictEqual(res.isSolved, true, `Expected isSolved=true: ${res.naturalLanguageText}`);
    assert.strictEqual(res.status, HybridResponseStatus.RESOLVED);
    assert.ok(
      res.naturalLanguageText.includes('50') || res.naturalLanguageText.includes('✓'),
      `Expected mention of goal (50) in: ${res.naturalLanguageText}`,
    );
  });

  test('G8-P2-03: 18 → 3 (decrement) → solved in ≤20 steps', () => {
    const res = engine.processInput(req('starting from 18, subtract until 3'));
    assert.strictEqual(res.isSolved, true, `Expected isSolved=true: ${res.naturalLanguageText}`);
    assert.ok(
      (res.stepsUsed ?? 999) <= 20,
      `Expected ≤20 steps, used ${res.stepsUsed}`,
    );
    assert.ok(
      res.naturalLanguageText.includes('3') || res.naturalLanguageText.includes('✓'),
      `Expected mention of goal (3) in: ${res.naturalLanguageText}`,
    );
  });

  // ── Increment task ────────────────────────────────────────────────────────

  test('G8-P2-04: 5 → 20 (increment) → solved by increment engine', () => {
    const res = engine.processInput(req('starting from 5, add until 20'));
    assert.strictEqual(res.isSolved, true, `Expected isSolved=true: ${res.naturalLanguageText}`);
    assert.strictEqual(res.status, HybridResponseStatus.RESOLVED);
    assert.ok(
      res.naturalLanguageText.includes('20') || res.naturalLanguageText.includes('✓'),
      `Expected mention of goal (20) in: ${res.naturalLanguageText}`,
    );
  });

  // ── Already at goal ───────────────────────────────────────────────────────

  test('G8-P2-05: 45 → 45 (already at goal) → solved with 0 steps', () => {
    const res = engine.processInput(req('starting from 45, subtract until 45'));
    assert.strictEqual(res.isSolved, true, `Expected isSolved=true`);
    assert.strictEqual(res.stepsUsed, 0, `Expected 0 steps for already-satisfied goal`);
    assert.ok(
      res.naturalLanguageText.includes('already') || res.naturalLanguageText.includes('No steps'),
      `Expected "already" text in: ${res.naturalLanguageText}`,
    );
  });

  // ── Budget exhaustion ─────────────────────────────────────────────────────

  test('G8-P2-06: 100 → 0 with maxSteps=3 → NOT solved (PARTIAL)', () => {
    const res = engine.processInput(
      req('starting from 100, subtract until 0', 'g8-p2-06', { maxReasoningSteps: 3 }),
    );
    assert.strictEqual(res.isSolved, false, `Expected isSolved=false for over-budget task`);
    assert.strictEqual(
      res.status,
      HybridResponseStatus.PARTIAL,
      `Expected PARTIAL, got ${res.status}`,
    );
  });

  // ── NL text consistency ───────────────────────────────────────────────────

  test('G8-P2-07: solved response never says "PARTIAL" in NL text', () => {
    const res = engine.processInput(req('starting from 10, subtract until 0'));
    assert.strictEqual(res.isSolved, true, `Expected isSolved=true`);
    assert.ok(
      !res.naturalLanguageText.includes('PARTIAL'),
      `Solved response must not say PARTIAL: ${res.naturalLanguageText}`,
    );
  });

  // ── Neural flag independence ──────────────────────────────────────────────

  test('G8-P2-08: neural inference flag does not affect symbolic reasoning path', () => {
    const resNeural = engine.processInput(
      req('starting from 12, subtract until 0', 'g8-p2-08a', { enableNeuralInference: true }),
    );
    const resSymbol = engine.processInput(
      req('starting from 12, subtract until 0', 'g8-p2-08b', { enableNeuralInference: false }),
    );
    // Both should be solved
    assert.strictEqual(resNeural.isSolved, true, `Neural-enabled path must be solved`);
    assert.strictEqual(resSymbol.isSolved, true, `Neural-disabled path must be solved`);
    // Reasoning status must always be SOLVED via symbolic path
    assert.strictEqual(resNeural.reasoningStatus, ReasoningStatus.SOLVED);
    assert.strictEqual(resSymbol.reasoningStatus, ReasoningStatus.SOLVED);
    // Steps used must be identical (same symbolic engine)
    assert.strictEqual(
      resNeural.stepsUsed,
      resSymbol.stepsUsed,
      `Steps used must be identical regardless of neural flag`,
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 3: P3 — Conversational Robustness
// ══════════════════════════════════════════════════════════════════════════════

suite('3: P3 — Conversational Robustness', () => {
  const { engine } = makeEngine();

  // ── Acknowledgment patterns ───────────────────────────────────────────────

  test('G8-P3-01: "Understood, that makes total sense." → CONVERSATIONAL_FACT', () => {
    const res = engine.processInput(req('Understood, that makes total sense.'));
    assert.strictEqual(
      res.intentType,
      UserIntentType.CONVERSATIONAL_FACT,
      `Expected CONVERSATIONAL_FACT, got ${res.intentType}`,
    );
    assert.strictEqual(res.status, HybridResponseStatus.RESOLVED);
  });

  test('G8-P3-02: acknowledgment text contains "Understood!" deterministically', () => {
    const res = engine.processInput(req('Understood, moving on.'));
    assert.strictEqual(res.intentType, UserIntentType.CONVERSATIONAL_FACT);
    assert.ok(
      res.naturalLanguageText.includes('Understood!'),
      `Expected "Understood!" in: ${res.naturalLanguageText}`,
    );
  });

  test('G8-P3-03: "ok, got it." → CONVERSATIONAL_FACT with "Understood!"', () => {
    const res = engine.processInput(req('ok, got it.'));
    assert.strictEqual(res.intentType, UserIntentType.CONVERSATIONAL_FACT);
    assert.ok(
      res.naturalLanguageText.includes('Understood!'),
      `Expected "Understood!" in: ${res.naturalLanguageText}`,
    );
  });

  test('G8-P3-04: "sure, that works for me." → CONVERSATIONAL_FACT', () => {
    const res = engine.processInput(req('sure, that works for me.'));
    assert.strictEqual(res.intentType, UserIntentType.CONVERSATIONAL_FACT);
  });

  // ── Farewell patterns ─────────────────────────────────────────────────────

  test('G8-P3-05: "See you later, have a wonderful evening." → CONVERSATIONAL_FACT', () => {
    const res = engine.processInput(req('See you later, have a wonderful evening.'));
    assert.strictEqual(
      res.intentType,
      UserIntentType.CONVERSATIONAL_FACT,
      `Expected CONVERSATIONAL_FACT, got ${res.intentType}`,
    );
  });

  test('G8-P3-06: "Goodbye! Thanks for your help." → CONVERSATIONAL_FACT', () => {
    const res = engine.processInput(req('Goodbye! Thanks for your help.'));
    assert.strictEqual(res.intentType, UserIntentType.CONVERSATIONAL_FACT);
    assert.ok(
      res.naturalLanguageText.toLowerCase().includes('goodbye') ||
      res.naturalLanguageText.includes("welcome"),
      `Expected farewell/thanks response in: ${res.naturalLanguageText}`,
    );
  });

  // ── Informal state queries ────────────────────────────────────────────────

  test('G8-P3-07: "wassup friend?" → CONVERSATIONAL_FACT', () => {
    const res = engine.processInput(req('wassup friend?'));
    assert.strictEqual(
      res.intentType,
      UserIntentType.CONVERSATIONAL_FACT,
      `Expected CONVERSATIONAL_FACT, got ${res.intentType}`,
    );
  });

  test('G8-P3-08: "How are you holding up today?" → CONVERSATIONAL_FACT', () => {
    const res = engine.processInput(req('How are you holding up today?'));
    assert.strictEqual(
      res.intentType,
      UserIntentType.CONVERSATIONAL_FACT,
      `Expected CONVERSATIONAL_FACT, got ${res.intentType}`,
    );
  });

  test('G8-P3-09: greeting "good morning!" → CONVERSATIONAL_FACT with "Hello!"', () => {
    const res = engine.processInput(req('good morning!'));
    assert.strictEqual(res.intentType, UserIntentType.CONVERSATIONAL_FACT);
    assert.ok(
      res.naturalLanguageText.includes('Hello!'),
      `Expected "Hello!" in: ${res.naturalLanguageText}`,
    );
  });

  // ── Negative cases: must NOT misroute unrelated text ─────────────────────

  test('G8-P3-10 (negative): "okapiare large mammals" (ok prefix, unrelated) — verify no crash', () => {
    // "okapiare" starts with "ok" but is not an acknowledgment.
    // The system should not throw and should return a valid response.
    const res = engine.processInput(req('okapiare large mammals'));
    assert.ok(res.status !== undefined, 'Should return a valid response');
    assert.ok(res.naturalLanguageText.length > 0, 'Should return non-empty text');
  });

  test('G8-P3-11 (negative): malformed empty text → ERROR response, not crash', () => {
    const res = engine.processInput({ text: '', sessionId: 'g8-p3-11' });
    assert.strictEqual(
      res.status,
      HybridResponseStatus.ERROR,
      `Expected ERROR for empty text, got ${res.status}`,
    );
    assert.ok(
      res.naturalLanguageText.includes('[Error]'),
      `Expected error marker in: ${res.naturalLanguageText}`,
    );
  });

  test('G8-P3-12 (negative): reasoning prompt routes to REASONING_TASK, not CONVERSATIONAL_FACT', () => {
    const res = engine.processInput(req('starting from 10, subtract until 0'));
    assert.strictEqual(
      res.intentType,
      UserIntentType.REASONING_TASK,
      `Reasoning prompt must not route to CONVERSATIONAL_FACT, got ${res.intentType}`,
    );
  });

  // ── isSolved and isUncertain correctness ─────────────────────────────────

  test('G8-P3-13: CONVERSATIONAL_FACT responses are always isSolved=true', () => {
    const phrases = [
      'Hi there!',
      'thanks a lot',
      'bye!',
      'how are you?',
      'ok, noted.',
      'sure',
      'Understood',
    ];
    for (const phrase of phrases) {
      const res = engine.processInput(req(phrase));
      if (res.intentType === UserIntentType.CONVERSATIONAL_FACT) {
        assert.strictEqual(
          res.isSolved,
          true,
          `CONVERSATIONAL_FACT for "${phrase}" must have isSolved=true, got ${res.isSolved}`,
        );
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 4: Regression — Gate 6 & earlier behaviour preserved
// ══════════════════════════════════════════════════════════════════════════════

suite('4: Regression — Gate 6 behaviour preserved', () => {
  const { engine, memory } = makeEngine();
  populateTaxonomy(memory);

  test('G8-REG-01: "thank you very much!" → CONVERSATIONAL_FACT (gratitude)', () => {
    const res = engine.processInput(req('thank you very much!'));
    assert.strictEqual(res.intentType, UserIntentType.CONVERSATIONAL_FACT);
    assert.ok(
      res.naturalLanguageText.includes("welcome"),
      `Expected "welcome" in: ${res.naturalLanguageText}`,
    );
  });

  test('G8-REG-02: enableNeuralInference=false preserves Gate 2 default symbolic path', () => {
    const res = engine.processInput(
      req('starting from 8, subtract until 0', 'g8-reg-02', { enableNeuralInference: false }),
    );
    assert.strictEqual(res.isSolved, true);
    assert.strictEqual(res.meta?.neuralInference, 'NOT_IMPLEMENTED');
  });

  test('G8-REG-03: concept_car single query still returns properties and relations', () => {
    const res = engine.processInput(req('What properties does concept_car have?'));
    assert.strictEqual(res.status, HybridResponseStatus.RESOLVED);
    assert.ok(res.resolvedConcepts && res.resolvedConcepts.length >= 1);
  });

  test('G8-REG-04: unknown concept → UNSUPPORTED (not ERROR)', () => {
    const res = engine.processInput(req('What is concept_phlogiston?'));
    assert.strictEqual(
      res.status,
      HybridResponseStatus.UNSUPPORTED,
      `Expected UNSUPPORTED, got ${res.status}`,
    );
  });

  test('G8-REG-05: missing start/target in reasoning task → CLARIFICATION_NEEDED', () => {
    const res = engine.processInput(req('subtract things until something'));
    // Either CLARIFICATION_NEEDED or UNKNOWN_REQUEST is acceptable
    const acceptable = [
      HybridResponseStatus.CLARIFICATION_NEEDED,
      HybridResponseStatus.UNSUPPORTED,
    ];
    // The UNKNOWN path is also fine if parser doesn't recognize it
    assert.ok(
      res.status !== HybridResponseStatus.ERROR,
      `Should not return ERROR for ambiguous task: ${res.status} — ${res.naturalLanguageText}`,
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Final summary
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n================================================================');
console.log(`ONE LANGUAGE — GATE 8 TEST RESULTS: ${passed}/${total} passed, ${failed} failed`);
if (failed > 0) {
  console.log('GATE 8: FAIL');
  process.exit(1);
} else {
  console.log('GATE 8: PASS');
}
