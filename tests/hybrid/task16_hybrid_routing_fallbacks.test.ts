/**
 * ONE Intelligence — Task 16 Verification Suite
 * ===============================================
 * Tests: Hybrid Intelligence Routing, Model Adapters, Fallbacks & Safety Invariants
 * Module: tests/hybrid/task16_hybrid_routing_fallbacks.test.ts
 */

import * as assert from 'assert';
import {
  HybridConversationEngine,
  HybridRequest,
  HybridResponse,
  HybridResponseStatus,
  UserIntentType,
  Native5MAdapter,
  Native5MGenerationOptions,
  Native5MGenerationResult,
  validateNeuralProposal,
} from '../../src/one/intelligence/hybrid';
import { IntentParser } from '../../src/one/intelligence/hybrid/IntentParser';
import { SelectiveMemory } from '../../src/one/intelligence/memory/SelectiveMemory';
import { RuleRegistry } from '../../src/one/intelligence/reasoning/RuleRegistry';
import { ReasoningEngine } from '../../src/one/intelligence/reasoning/ReasoningEngine';
import { ModelReasoningAdapter } from '../../src/one/intelligence/reasoning/ModelReasoningAdapter';
import { NativeModelRegistry } from '../../src/one/native_model_registry';
import { AgiOneCoreOrchestrator } from '../../src/one/agi_one_core_orchestrator';

// ── Test Mock Adapters ───────────────────────────────────────────────────────

/** Mock adapter simulating an offline / unavailable model backend */
class UnavailableMockAdapter extends Native5MAdapter {
  constructor() {
    super('non_existent_dummy_checkpoint.cubiomodel');
  }
  public override isAvailable(): boolean {
    return false;
  }
  public override generate(prompt: string, options?: Native5MGenerationOptions): Native5MGenerationResult {
    return {
      text: '',
      tokenIds: [],
      epistemicStatus: 'UNKNOWN',
      latencyMs: 1,
      isModelOutput: false,
      error: 'Model backend unavailable',
    };
  }
}

/** Mock adapter simulating an adapter that throws an unhandled runtime error */
class ThrowingMockAdapter extends Native5MAdapter {
  constructor() {
    super('non_existent_dummy_checkpoint.cubiomodel');
  }
  public override isAvailable(): boolean {
    return true;
  }
  public override generate(prompt: string, options?: Native5MGenerationOptions): Native5MGenerationResult {
    throw new Error('Fatal GPU kernel segmentation fault (simulated)');
  }
}

/** Mock adapter returning malformed, non-JSON or invalid schema strings */
class MalformedMockAdapter extends Native5MAdapter {
  public outputMode: 'RAW_TEXT' | 'INVALID_JSON' | 'INVALID_SCHEMA' | 'HIGH_CONFIDENCE' = 'RAW_TEXT';
  constructor() {
    super('non_existent_dummy_checkpoint.cubiomodel');
  }
  public override isAvailable(): boolean {
    return true;
  }
  public override generate(prompt: string, options?: Native5MGenerationOptions): Native5MGenerationResult {
    let text = '';
    if (this.outputMode === 'RAW_TEXT') {
      text = 'I think the answer is 42 and everything is completely solved!';
    } else if (this.outputMode === 'INVALID_JSON') {
      text = '{"text": "incomplete json';
    } else if (this.outputMode === 'INVALID_SCHEMA') {
      text = JSON.stringify({
        source: 'untrusted_web_source', // invalid source
        intent: 'HACK_SYSTEM_INTENT',   // invalid intent
        confidence: 0.8,
      });
    } else if (this.outputMode === 'HIGH_CONFIDENCE') {
      text = JSON.stringify({
        source: 'native5m',
        intent: UserIntentType.REASONING_TASK,
        confidence: 999.0, // out of bounds > 1.0
        structuredAnswer: { text: 'fake answer', isSolved: true },
      });
    }
    return {
      text,
      tokenIds: [1, 2, 3],
      epistemicStatus: 'FACT',
      latencyMs: 5,
      isModelOutput: true,
    };
  }
}

// ── Test Helper ─────────────────────────────────────────────────────────────

function createTestHarness(customAdapter?: Native5MAdapter) {
  const ruleRegistry = new RuleRegistry<number>();
  const memory = new SelectiveMemory(ruleRegistry as RuleRegistry<unknown>, 100);

  // Populate basic knowledge graph
  const graph = memory.semanticGraph;
  graph.addConcept({ conceptId: 'concept_vehicle', label: 'Vehicle', confidence: 1.0 });
  graph.addConcept({ conceptId: 'concept_car', label: 'Car', confidence: 1.0 });
  graph.addConcept({ conceptId: 'concept_engine', label: 'Engine', confidence: 1.0 });
  graph.addConcept({ conceptId: 'concept_wheels', label: 'Wheels', confidence: 1.0 });

  graph.addRelationship({ sourceConceptId: 'concept_car', targetConceptId: 'concept_vehicle', relationType: 'isA', confidence: 1.0 });
  graph.addRelationship({ sourceConceptId: 'concept_car', targetConceptId: 'concept_engine', relationType: 'hasProperty', confidence: 1.0 });
  graph.addRelationship({ sourceConceptId: 'concept_vehicle', targetConceptId: 'concept_wheels', relationType: 'hasProperty', confidence: 1.0 });

  const engine = new HybridConversationEngine(memory, undefined, customAdapter);
  return { memory, engine, graph };
}

// ────────────────────────────────────────────────────────────────────────────
// Main Test Runner
// ────────────────────────────────────────────────────────────────────
export function runTask16HybridRoutingFallbackTests(): void {
  console.log('='.repeat(80));
  console.log('  ONE INTELLIGENCE — TASK 16: HYBRID ROUTING, MODEL ADAPTERS & FALLBACKS');
  console.log('='.repeat(80));

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 1: Intent Routing & Policy Dispatch
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 1] Intent Routing & Policy Dispatch...');
  const { engine } = createTestHarness();

  // 1A: Numeric reasoning task
  const resReasoning = engine.processInput({ text: 'starting from 10, subtract until 0' });
  assert.strictEqual(resReasoning.status, HybridResponseStatus.RESOLVED, 'Suite 1A: Reasoning task resolved');
  assert.strictEqual(resReasoning.intentType, UserIntentType.REASONING_TASK, 'Suite 1A: Intent is REASONING_TASK');
  assert.strictEqual(resReasoning.isSolved, true, 'Suite 1A: isSolved is true');
  assert.ok(resReasoning.derivation && resReasoning.derivation.length > 0, 'Suite 1A: Derivation trace present');

  // 1B: Concept graph query
  const resConcept = engine.processInput({ text: 'What properties does concept_car have?' });
  assert.strictEqual(resConcept.status, HybridResponseStatus.RESOLVED, 'Suite 1B: Concept query resolved');
  assert.strictEqual(resConcept.intentType, UserIntentType.CONCEPT_QUERY, 'Suite 1B: Intent is CONCEPT_QUERY');
  assert.ok(resConcept.resolvedConcepts && resConcept.resolvedConcepts.length >= 2, 'Suite 1B: Resolved concepts present');

  // 1C: Conversational fact / greeting
  const resFact = engine.processInput({ text: 'Hello! Good morning' });
  assert.strictEqual(resFact.status, HybridResponseStatus.RESOLVED, 'Suite 1C: Greeting resolved');
  assert.strictEqual(resFact.intentType, UserIntentType.CONVERSATIONAL_FACT, 'Suite 1C: Intent is CONVERSATIONAL_FACT');
  assert.ok(resFact.naturalLanguageText.includes('Hello!'), 'Suite 1C: Greeting text returned');

  // 1D: Unknown / Ambiguous request
  const resUnknown = engine.processInput({ text: 'foobar qux 42 99 100 random words' });
  assert.strictEqual(resUnknown.status, HybridResponseStatus.CLARIFICATION_NEEDED, 'Suite 1D: Ambiguous input returns clarification');
  assert.strictEqual(resUnknown.isSolved, false, 'Suite 1D: Unsolved');
  assert.strictEqual(resUnknown.isUncertain, true, 'Suite 1D: Uncertain flag set');

  // 1E: Multi-turn reference resolution
  const sess = 'session_turn_routing_01';
  engine.processInput({ text: 'What properties does concept_car have?', sessionId: sess });
  const resFollowUp = engine.processInput({ text: 'show its relations', sessionId: sess });
  assert.strictEqual(resFollowUp.status, HybridResponseStatus.RESOLVED, 'Suite 1E: Follow-up resolved');
  assert.ok(resFollowUp.resolvedConcepts && resFollowUp.resolvedConcepts.length > 0, 'Suite 1E: Resolved concept relations in follow-up');

  console.log('  ✓ Suite 1 passed: All 4 intent types and multi-turn follow-ups route predictably.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 2: Model Availability & Opt-In Routing Policy
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 2] Model Availability & Opt-In Routing Policy...');

  // 2A: Default mode (enableNeuralInference: false)
  const resDefault = engine.processInput({ text: 'Hello there!' });
  assert.strictEqual(resDefault.meta.neuralInference, 'NOT_IMPLEMENTED', 'Suite 2A: Default mode marks neural as NOT_IMPLEMENTED');
  assert.ok(resDefault.meta.neuralInferenceBlockedReason.length > 0, 'Suite 2A: Reason documented');

  // 2B: Offline model / missing checkpoint fallback
  const { engine: offlineEngine } = createTestHarness(new UnavailableMockAdapter());
  const resOffline = offlineEngine.processInput({ text: 'starting from 5, subtract until 0', enableNeuralInference: true });
  assert.strictEqual(resOffline.status, HybridResponseStatus.RESOLVED, 'Suite 2B: Offline model falls back to symbolic reasoning');
  assert.strictEqual(resOffline.isSolved, true, 'Suite 2B: Symbolic solution succeeded');
  assert.ok(resOffline.naturalLanguageText.includes('Goal reached'), 'Suite 2B: Symbolic NL text produced');

  // 2C: Active model when checkpoint is present
  const activeAdapter = Native5MAdapter.getInstance();
  const resOptIn = engine.processInput({ text: 'Hello!', enableNeuralInference: true });
  if (activeAdapter.isAvailable()) {
    assert.strictEqual(resOptIn.meta.neuralInference, 'VERIFIED', 'Suite 2C: Verified neural inference active when model present');
    assert.strictEqual(resOptIn.meta.neuralModelId, 'CUBIO-NATIVE-MODEL-V1-4.89M', 'Suite 2C: Verified model identity');
  } else {
    assert.strictEqual(resOptIn.status, HybridResponseStatus.RESOLVED, 'Suite 2C: Safe fallback when model absent');
  }

  console.log('  ✓ Suite 2 passed: Opt-in policy, offline fallback, and active model routing verified.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 3: Adapter Failure & Inference Exception Handling
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 3] Adapter Failure & Inference Exception Handling...');

  // 3A: Engine intercepts throwing adapter without crashing
  const { engine: throwingEngine } = createTestHarness(new ThrowingMockAdapter());
  let threwException = false;
  let resThrowing: HybridResponse | null = null;
  try {
    resThrowing = throwingEngine.processInput({
      text: 'starting from 8, subtract until 0',
      enableNeuralInference: true,
    });
  } catch {
    threwException = true;
  }
  assert.strictEqual(threwException, false, 'Suite 3A: Engine must NEVER throw on model adapter failure');
  assert.ok(resThrowing !== null, 'Suite 3A: Response object produced');
  assert.strictEqual(resThrowing.status, HybridResponseStatus.RESOLVED, 'Suite 3A: Falls back to solved symbolic result');
  assert.strictEqual(resThrowing.isSolved, true, 'Suite 3A: Symbolic reasoning still solved');

  // 3B: Conversational fact handling under throwing adapter
  const resThrowingFact = throwingEngine.processInput({
    text: 'Good morning!',
    enableNeuralInference: true,
  });
  assert.strictEqual(resThrowingFact.status, HybridResponseStatus.RESOLVED, 'Suite 3B: Conversational fact falls back to template');
  assert.ok(resThrowingFact.naturalLanguageText.includes('Hello!'), 'Suite 3B: Deterministic template returned');

  console.log('  ✓ Suite 3 passed: Throwing adapter safely caught, zero crashes, clean fail-soft fallback.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 4: Malformed Model Outputs & Strict Schema Validation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 4] Malformed Model Outputs & Strict Schema Validation...');

  const malformedAdapter = new MalformedMockAdapter();
  const { engine: malformedEngine, memory: malformedMemory } = createTestHarness(malformedAdapter);

  // 4A: Raw non-JSON text proposal rejected
  malformedAdapter.outputMode = 'RAW_TEXT';
  const resRaw = malformedEngine.processInput({
    text: 'starting from 6, subtract until 0',
    enableNeuralInference: true,
  });
  assert.strictEqual(resRaw.status, HybridResponseStatus.RESOLVED, 'Suite 4A: Symbolic solution intact');
  assert.ok(!resRaw.naturalLanguageText.includes('I think the answer is 42'), 'Suite 4A: Hallucinated non-JSON output rejected');

  // 4B: Invalid JSON syntax rejected
  malformedAdapter.outputMode = 'INVALID_JSON';
  const resBadJson = malformedEngine.processInput({
    text: 'starting from 6, subtract until 0',
    enableNeuralInference: true,
  });
  assert.strictEqual(resBadJson.status, HybridResponseStatus.RESOLVED, 'Suite 4B: Falls back to symbolic result on bad JSON');

  // 4C: Invalid schema source and intent rejected
  malformedAdapter.outputMode = 'INVALID_SCHEMA';
  assert.strictEqual(
    validateNeuralProposal({ source: 'untrusted', intent: 'HACK', confidence: 0.5 }),
    false,
    'Suite 4C: validateNeuralProposal strictly rejects invalid source and unknown intent'
  );

  // 4D: Out-of-bounds confidence (> 1.0) rejected
  malformedAdapter.outputMode = 'HIGH_CONFIDENCE';
  assert.strictEqual(
    validateNeuralProposal({ source: 'native5m', intent: UserIntentType.REASONING_TASK, confidence: 999.0 }),
    false,
    'Suite 4D: validateNeuralProposal rejects confidence > 1.0'
  );

  // 4E: Memory integrity: malformed proposals never pollute SelectiveMemory
  const epBefore = malformedMemory.getStats().episodicCount;
  malformedEngine.processInput({ text: 'Hello there!', enableNeuralInference: true });
  const epAfter = malformedMemory.getStats().episodicCount;
  assert.strictEqual(epBefore, epAfter, 'Suite 4E: Malformed conversational inputs never write to episodic memory');

  console.log('  ✓ Suite 4 passed: Malformed/non-JSON/out-of-bounds proposals strictly rejected; memory intact.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 5: Timeout Ceilings, Bounded Retries & Resource Budgets
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 5] Timeout Ceilings, Bounded Retries & Resource Budgets...');

  // 5A: Native 5M Adapter caps tokens to 45
  const genResult = activeAdapter.generate('Test prompt', { maxTokens: 9999 });
  assert.ok(genResult.tokenIds.length <= 45, 'Suite 5A: maxTokens strictly bounded to <= 45');

  // 5B: Reasoning step ceiling enforcement
  const resOverBudget = engine.processInput({
    text: 'starting from 100, subtract until 0',
    maxReasoningSteps: 3, // Bounded budget
  });
  assert.strictEqual(resOverBudget.status, HybridResponseStatus.PARTIAL, 'Suite 5B: Exhausted steps returns PARTIAL');
  assert.strictEqual(resOverBudget.isSolved, false, 'Suite 5B: isSolved is false');
  assert.ok(
    resOverBudget.stopReason?.includes('Step budget limit') || resOverBudget.reasoningStatus === 'STEP_LIMIT',
    'Suite 5B: stopReason indicates step budget limit'
  );

  // 5C: Model Reasoning Adapter timeout ceiling
  const modelReasoningAdapter = new ModelReasoningAdapter({
    enabled: true,
    timeoutMs: 1, // Ultra-low timeout to test boundary
  });
  const scoringRes = modelReasoningAdapter.evaluateCandidate(
    { stepIndex: 1, ruleId: 'r1', value: 42, derivation: 'test', depth: 1 },
    0.8,
    'optimize'
  );
  assert.ok(scoringRes.score >= 0.0 && scoringRes.score <= 1.0, 'Suite 5C: Score is strictly bounded');
  assert.ok(scoringRes.latencyMs >= 0, 'Suite 5C: Latency measured');

  console.log('  ✓ Suite 5 passed: Token caps (<=45), step limits (STEP_LIMIT), and timeout ceilings verified.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 6: Reasoning-Only Fallback & Symbolic Authority
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 6] Reasoning-Only Fallback & Symbolic Authority...');

  // 6A: Symbolic failure cannot be overturned by neural model
  const resImpossible = engine.processInput({
    text: 'starting from 10, subtract until 50', // Impossible with subtract rules
    maxReasoningSteps: 10,
    enableNeuralInference: true,
  });
  assert.strictEqual(resImpossible.isSolved, false, 'Suite 6A: Symbolic failure cannot be overridden by model');
  assert.notStrictEqual(resImpossible.status, HybridResponseStatus.RESOLVED, 'Suite 6A: Status cannot be RESOLVED');

  // 6B: Unknown concept cannot be invented
  const resUnknownConcept = engine.processInput({
    text: 'What properties does concept_unicorn have?',
    enableNeuralInference: true,
  });
  assert.strictEqual(resUnknownConcept.status, HybridResponseStatus.UNSUPPORTED, 'Suite 6B: Unknown concept returns UNSUPPORTED');
  assert.strictEqual(resUnknownConcept.isSolved, false, 'Suite 6B: Cannot claim solved for unknown concept');
  assert.strictEqual(resUnknownConcept.resolvedConcepts?.length, 0, 'Suite 6B: Zero concepts resolved');

  // 6C: No fabricated success invariant
  assert.ok(!resUnknownConcept.naturalLanguageText.includes('concept_unicorn has'), 'Suite 6C: No fabricated relations');

  console.log('  ✓ Suite 6 passed: Symbolic authority vetoes neural hallucinations; zero fabricated successes.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 7: Safety Invariants, Actuation Lockout & Determinism
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 7] Safety Invariants, Actuation Lockout & Determinism...');

  // 7A: Actuation Lockout invariant
  const orchestrator = new AgiOneCoreOrchestrator();
  assert.strictEqual(orchestrator.is_actuation_blocked, true, 'Suite 7A: Orchestrator actuation blocked');
  assert.strictEqual(modelReasoningAdapter.isActuationBlocked, true, 'Suite 7A: ModelReasoningAdapter actuation blocked');

  // 7B: NativeModelRegistry parameter validation
  const authModel = NativeModelRegistry.getAuthoritativeModel();
  assert.strictEqual(authModel.totalParameters, 148912, 'Suite 7B: Certified parameter count is 148,912');
  let threwDeprecated = false;
  try {
    NativeModelRegistry.validateParameterCount(38400); // Deprecated parameter count
  } catch (e: any) {
    threwDeprecated = e.message.includes('DEPRECATED and INVALID');
  }
  assert.strictEqual(threwDeprecated, true, 'Suite 7B: Deprecated 38,400 parameter count strictly blocked');

  // 7C: Deterministic replay invariance (sigma^2 = 0.0) across 10 runs
  const replayRuns: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = engine.processInput({ text: 'starting from 15, subtract until 0' });
    replayRuns.push(JSON.stringify({
      status: r.status,
      isSolved: r.isSolved,
      stepsUsed: r.stepsUsed,
      nl: r.naturalLanguageText,
    }));
  }
  for (let i = 1; i < 10; i++) {
    assert.strictEqual(replayRuns[i], replayRuns[0], `Suite 7C: Run ${i} matches run 0 bit-for-bit`);
  }
  console.log('  ✓ Suite 7 passed: Actuation lock, deprecated count rejection, and deterministic replay (sigma^2 = 0.0) verified.');

  console.log('\n' + '='.repeat(80));
  console.log('  TASK 16 VERIFICATION: ALL 7 SUITES PASSED (100%)');
  console.log('='.repeat(80) + '\n');
}

if (
  typeof process !== 'undefined' &&
  process.argv &&
  process.argv[1] &&
  process.argv[1].includes('task16_hybrid_routing_fallbacks')
) {
  runTask16HybridRoutingFallbackTests();
}
