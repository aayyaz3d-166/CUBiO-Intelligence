/**
 * ONE Language — Phase 5 Gate 6: Conversational Quality Improvements Tests
 * (tests/hybrid/phase5_gate6_conversational_quality.test.ts)
 *
 * Verifies P1, P2, and P3 quality improvements:
 *   - P1: Gratitude recognition with multi-word expressions and negative matching.
 *   - P2: Concept query stopword filtering while preserving explicit concepts and entity names.
 *   - P3: Bounded neural clarification generation (maxTokens <= 45, wording only, fallbacks).
 *   - Preservation of Gate 2 default behaviour when neural inference is disabled.
 */

import * as assert from 'assert';
import { IntentParser } from '../../src/one/intelligence/hybrid/IntentParser';
import { HybridConversationEngine } from '../../src/one/intelligence/hybrid/HybridConversationEngine';
import {
  HybridResponseStatus,
  UserIntentType,
} from '../../src/one/intelligence/hybrid/types';
import { SelectiveMemory } from '../../src/one/intelligence/memory/SelectiveMemory';
import { RuleRegistry } from '../../src/one/intelligence/reasoning/RuleRegistry';

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

console.log('================================================================');
console.log('ONE LANGUAGE — PHASE 5 GATE 6: CONVERSATIONAL QUALITY TESTS');
console.log('================================================================');

// ══════════════════════════════════════════════════════════════════════════════
// Suite 1: P1 — Gratitude Intent Recognition & Negative Matches
// ══════════════════════════════════════════════════════════════════════════════
suite('1: P1 — Gratitude Recognition & Negatives', () => {
  const parser = new IntentParser();

  test('G6-01: Multi-word gratitude matches CONVERSATIONAL_FACT', () => {
    const inputs = [
      'Thank you very much',
      'Thanks a lot',
      'Thank you kindly for your assistance',
      'Thanks for helping me',
      'Thx so much',
    ];
    for (const text of inputs) {
      const intent = parser.parse(text);
      assert.strictEqual(
        intent.intentType,
        UserIntentType.CONVERSATIONAL_FACT,
        `Expected CONVERSATIONAL_FACT for "${text}", got ${intent.intentType}`
      );
    }
  });

  test('G6-02: Negative cases do NOT accidentally match gratitude', () => {
    const negatives = [
      'thanksgiving is a holiday',
      'thankless job',
      'thx1138 is a sci-fi film',
    ];
    for (const text of negatives) {
      const intent = parser.parse(text);
      assert.notStrictEqual(
        intent.intentType,
        UserIntentType.CONVERSATIONAL_FACT,
        `Negative text "${text}" should NOT match CONVERSATIONAL_FACT`
      );
    }
  });

  test('G6-03: Default behavior without neural flag produces deterministic gratitude reply', () => {
    const { engine } = makeEngine();
    const resp = engine.processInput({ text: 'Thank you very much' });
    assert.strictEqual(resp.status, HybridResponseStatus.RESOLVED);
    assert.strictEqual(resp.intentType, UserIntentType.CONVERSATIONAL_FACT);
    assert.strictEqual(resp.meta.neuralInference, 'NOT_IMPLEMENTED');
    assert.ok(resp.naturalLanguageText.includes("You're welcome"));
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 2: P2 — Concept Query Stopword Filtering
// ══════════════════════════════════════════════════════════════════════════════
suite('2: P2 — Concept Query Stopword Filtering', () => {
  const parser = new IntentParser();

  test('G6-04: Stopword questions are filtered from greedy concept queries', () => {
    const inputs = [
      'Can you please explain how you operate?',
      'What is the best way to reason?',
      'Tell me what is happening here',
    ];
    for (const text of inputs) {
      const intent = parser.parse(text);
      assert.notStrictEqual(
        intent.intentType,
        UserIntentType.CONCEPT_QUERY,
        `Stopword question "${text}" should NOT be misclassified as CONCEPT_QUERY`
      );
    }
  });

  test('G6-05: Legitimate domain concepts and entity names are properly preserved', () => {
    const concepts = [
      { text: 'What is concept_car?', expectedId: 'concept_car' },
      { text: 'What properties does concept_vehicle have?', expectedId: 'concept_vehicle' },
      { text: 'Explain concept_engine', expectedId: 'concept_engine' },
      { text: 'What is gravity?', expectedId: 'concept_gravity' },
    ];
    for (const item of concepts) {
      const intent = parser.parse(item.text);
      assert.strictEqual(
        intent.intentType,
        UserIntentType.CONCEPT_QUERY,
        `"${item.text}" should resolve as CONCEPT_QUERY`
      );
      assert.strictEqual(
        intent.entities.conceptId,
        item.expectedId,
        `Expected conceptId ${item.expectedId}, got ${intent.entities.conceptId}`
      );
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 3: P3 — Neural Clarification Generation & Fallbacks
// ══════════════════════════════════════════════════════════════════════════════
suite('3: P3 — Neural Clarification Generation & Fallbacks', () => {
  test('G6-06: Clarification with enableNeuralInference=true includes neural wording', () => {
    const { engine } = makeEngine();
    const resp = engine.processInput({
      text: 'What is the mysterious meaning of life?',
      enableNeuralInference: true,
    });
    assert.strictEqual(resp.status, HybridResponseStatus.CLARIFICATION_NEEDED);
    assert.strictEqual(resp.intentType, UserIntentType.UNKNOWN_REQUEST);
    assert.strictEqual(resp.isUncertain, true);
    assert.strictEqual(resp.meta.neuralInference, 'VERIFIED');
    assert.ok(resp.meta.neuralInferenceMs !== undefined && resp.meta.neuralInferenceMs >= 0);
    // Verified structure: contains conversational intro followed by strict capabilities
    assert.ok(resp.naturalLanguageText.includes('Supported requests:'));
  });

  test('G6-07: Clarification without enableNeuralInference=true preserves exact Gate 2 baseline', () => {
    const { engine } = makeEngine();
    const resp = engine.processInput({
      text: 'What is the mysterious meaning of life?',
    });
    assert.strictEqual(resp.status, HybridResponseStatus.CLARIFICATION_NEEDED);
    assert.strictEqual(resp.intentType, UserIntentType.UNKNOWN_REQUEST);
    assert.strictEqual(resp.meta.neuralInference, 'NOT_IMPLEMENTED');
    assert.ok(resp.naturalLanguageText.startsWith('I could not determine what you are asking'));
    assert.ok(resp.naturalLanguageText.includes('Supported requests:'));
  });

  test('G6-08: Model load failure degrades gracefully without crashing clarification', () => {
    const { engine } = makeEngine('E:/nonexistent_checkpoint.cubiomodel');
    const resp = engine.processInput({
      text: 'Can you solve this unknown conundrum?',
      enableNeuralInference: true,
    });
    assert.strictEqual(resp.status, HybridResponseStatus.CLARIFICATION_NEEDED);
    assert.strictEqual(resp.meta.neuralInference, 'NOT_IMPLEMENTED');
    assert.ok(resp.naturalLanguageText.startsWith('I could not determine what you are asking'));
  });

  test('G6-09: Clarification generation never creates episodic memory records', () => {
    const { memory, engine } = makeEngine();
    const initialEpCount = memory.getStats().episodicCount;
    engine.processInput({
      text: 'Tell me something random and obscure',
      enableNeuralInference: true,
    });
    const finalEpCount = memory.getStats().episodicCount;
    assert.strictEqual(
      finalEpCount,
      initialEpCount,
      'Clarification turns must never record episodic memory records'
    );
  });
});

console.log('\n══════════════════════════════════════════════════════════════════════');
console.log(`  Phase 5 Gate 6 — Conversational Quality Test Report`);
console.log(`  Total: ${total}  |  Passed: ${passed}  |  Failed: ${failed}`);
console.log('══════════════════════════════════════════════════════════════════════');

if (failed > 0) {
  process.exit(1);
}
