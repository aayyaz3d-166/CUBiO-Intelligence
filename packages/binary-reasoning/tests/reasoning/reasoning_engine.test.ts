/**
 * ONE Language — Phase 3 Verification Suite
 * Module: 0/1 Reasoning Intelligence Engine Comprehensive Test Suite
 * Path: tests/reasoning/phase3_reasoning_engine.test.ts
 */

import {
  ReasoningEngine,
  RuleRegistry,
  ReasoningRule,
  ReasoningStatus,
  ReasoningPolicy,

  DecisionOutcome,
} from '../../src/reasoning';
import { BinaryReasoningBridge } from '../../src/integration';
import { TriangleOpcode, BinaryError } from '../../src/binary';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

export function runPhase3ReasoningTests(): void {
  console.log('='.repeat(80));
  console.log('  ONE LANGUAGE — PHASE 3: 0/1 REASONING INTELLIGENCE ENGINE VERIFICATION');
  console.log('='.repeat(80));

  // ──────────────────────────────────────────────────────────────────────────
  // Suite A: Basic Reasoning & Candidate Acceptance/Rejection
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite A] Basic Reasoning & Candidate Acceptance/Rejection...');

  const decRule: ReasoningRule<number> = {
    id: 'decrement_by_one',
    description: 'Decrements integer by 1 if greater than 0',
    priority: 10,
    isApplicable: (n) => n > 0,
    apply: (n) => [n - 1],
  };

  const engineA = new ReasoningEngine<number>();
  engineA.getRegistry().register(decRule);

  // Test A1: Input 5 -> Goal: find smaller non-negative integers (specifically target 0)
  const resA1 = engineA.solve({
    input: 5,
    goal: (n) => n === 0,
    constraints: [(n) => n >= 0],
  });

  assert(resA1.isSolved === true, 'Test A1: Should successfully reach goal 0');
  assert(resA1.bestCandidate?.value === 0, 'Test A1: Best candidate value must be 0');
  assert(resA1.status === ReasoningStatus.SOLVED, 'Test A1: Status must be SOLVED');
  assert(resA1.metrics.stepsUsed > 0, 'Test A1: Steps must be greater than 0');
  console.log('  ✓ Test A1 passed: Input 5 successfully derived 0 via decrement_by_one');

  // Test A2: Constraint rejection: candidate 7 rejected when goal requires smaller numbers
  const incRule: ReasoningRule<number> = {
    id: 'add_two',
    description: 'Adds 2 to integer',
    priority: 5,
    isApplicable: () => true,
    apply: (n) => [n + 2],
  };
  const engineA2 = new ReasoningEngine<number>();
  engineA2.getRegistry().register(decRule).register(incRule);

  const resA2 = engineA2.solve({
    input: 5,
    goal: (n) => n === 3,
    constraints: [(n) => n < 5], // 7 violates this constraint
  });

  assert(resA2.isSolved === true, 'Test A2: Should solve target 3');
  assert(resA2.bestCandidate?.value === 3, 'Test A2: Best candidate must be 3');
  // Check trace to verify that candidate with value 7 was evaluated and rejected
  const rejectedTrace = resA2.trace.find(
    (t) => t.decision === DecisionOutcome.REJECT || t.reasonCode.includes('FAIL_CONSTRAINT'),
  );
  assert(rejectedTrace !== undefined, 'Test A2: Trace must record constraint violation rejection');
  console.log('  ✓ Test A2 passed: Candidate violating constraint (< 5) explicitly rejected');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite B: Rule Reuse & Extensibility
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite B] Rule Reuse & Extensibility...');

  // Same rule operating on distinct inputs
  const resB1 = engineA.solve({ input: 10, goal: (n) => n === 7 });
  const resB2 = engineA.solve({ input: 3, goal: (n) => n === 1 });
  assert(resB1.isSolved && resB1.bestCandidate?.value === 7, 'Test B1: Input 10 -> 7 solved');
  assert(resB2.isSolved && resB2.bestCandidate?.value === 1, 'Test B2: Input 3 -> 1 solved');
  console.log('  ✓ Test B1 passed: Same rule applied across multiple distinct inputs');

  // Dynamic registration of a new domain rule
  const divRule: ReasoningRule<number> = {
    id: 'halve_even',
    description: 'Divides even number by 2',
    priority: 20,
    isApplicable: (n) => n > 0 && n % 2 === 0,
    apply: (n) => [n / 2],
  };
  engineA.getRegistry().register(divRule);
  const resB3 = engineA.solve({ input: 16, goal: (n) => n === 1 });
  assert(resB3.isSolved && resB3.bestCandidate?.value === 1, 'Test B3: Halving rule solved 16 -> 1');
  assert(Boolean(resB3.bestCandidate?.derivation.includes('halve_even')), 'Test B3: Used halve_even rule');
  console.log('  ✓ Test B2 passed: Dynamically registered rule integrated into search path');

  // Inapplicable rules
  const negRule: ReasoningRule<number> = {
    id: 'never_applicable',
    description: 'Applies only to negative numbers',
    isApplicable: (n) => n < 0,
    apply: (n) => [n * 2],
  };
  engineA.getRegistry().register(negRule);
  const resB4 = engineA.solve({ input: 4, goal: (n) => n === 2 });
  assert(!resB4.trace.some((t) => t.ruleId === 'never_applicable'), 'Inapplicable rule was never run');
  console.log('  ✓ Test B3 passed: Inapplicable rules cleanly ignored');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite C: Candidate Handling, Duplication & Deterministic Ranking
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite C] Candidate Handling, Duplication & Deterministic Ranking...');

  // Diamond graph rule producing duplicate values
  const engineC = new ReasoningEngine<number>();
  engineC.getRegistry().register({
    id: 'branch_a',
    description: 'Subtract 1',
    isApplicable: (n) => n > 0,
    apply: (n) => [n - 1],
  });
  engineC.getRegistry().register({
    id: 'branch_b',
    description: 'Subtract 1 alternate',
    isApplicable: (n) => n > 0,
    apply: (n) => [n - 1],
  });

  const resC1 = engineC.solve({ input: 2, goal: (n) => n === 0 });
  assert(resC1.isSolved, 'Test C1: Solved diamond graph');
  // State explorer must prevent duplicate expansion of same numeric value
  assert(resC1.metrics.candidatesGenerated <= 5, 'Duplicate state values not re-expanded');
  console.log('  ✓ Test C1 passed: State deduplication prevented redundant branching');

  // Candidate budget limit
  const infiniteRule: ReasoningRule<number> = {
    id: 'increment',
    description: 'Always increment',
    isApplicable: () => true,
    apply: (n) => [n + 1],
  };
  const engineC2 = new ReasoningEngine<number>();
  engineC2.getRegistry().register(infiniteRule);
  const resC2 = engineC2.solve({
    input: 1,
    goal: (n) => n === 1000,
    maxCandidates: 15,
  });
  assert(resC2.status === ReasoningStatus.CANDIDATE_LIMIT, 'Must stop on CANDIDATE_LIMIT');
  assert(resC2.isSolved === false, 'Cannot be solved');
  console.log('  ✓ Test C2 passed: Candidate limit strictly enforced');

  // Deterministic Ranking
  const ranked = resC2.rankedCandidates;
  for (let i = 0; i < ranked.length - 1; i++) {
    const cur = ranked[i].evaluation;
    const next = ranked[i + 1].evaluation;
    if (cur.valid === next.valid && cur.goalSatisfied === next.goalSatisfied) {
      assert(cur.score >= next.score, 'Ranked list must be in non-increasing score order');
    }
  }
  console.log('  ✓ Test C3 passed: Evaluated candidates ranked deterministically');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite D: Loop Safety & Termination Conditions
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite D] Loop Safety & Termination Conditions...');

  // D1: Zero step budget
  const resD1 = engineA.solve({ input: 5, goal: (n) => n === 0, maxSteps: 0 });
  assert(resD1.status === ReasoningStatus.STEP_LIMIT, 'Zero budget must return STEP_LIMIT');

  // D2: Step limit hit before goal
  const resD2 = engineA.solve({ input: 20, goal: (n) => n === 0, maxSteps: 5 });
  assert(resD2.status === ReasoningStatus.STEP_LIMIT, 'Must stop with STEP_LIMIT');
  assert(resD2.metrics.stepsUsed === 5, 'Must consume exactly 5 steps');

  // D3: Depth limit hit
  const resD3 = engineA.solve({ input: 10, goal: (n) => n === 0, maxDepth: 3 });
  assert(!resD3.isSolved, 'Depth limit prevented reaching goal');

  // D4: Goal already satisfied at root
  const resD4 = engineA.solve({ input: 0, goal: (n) => n === 0 });
  assert(resD4.isSolved && resD4.status === ReasoningStatus.SOLVED, 'Solved immediately at root');
  assert(resD4.metrics.stepsUsed === 0, 'No steps required for root solution');

  // D5: Invalid input
  const resD5 = engineA.solve({ input: undefined as any, goal: (n) => n === 0 });
  assert(resD5.status === ReasoningStatus.INVALID_INPUT, 'Undefined input rejected');

  console.log('  ✓ Suite D passed: All boundary, depth, step, and invalid input conditions verified');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite E: Binary Language Protocol v1 Integration
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite E] Binary Language Protocol v1 Integration...');

  // Token serialization & deserialization
  const intEnv = BinaryReasoningBridge.serializeToken(42);
  assert(intEnv.typeTag === '010', 'Integer token has 010 tag');
  assert(intEnv.decodedValue === 42, 'Integer token roundtrips bit-exact');

  const addrEnv = BinaryReasoningBridge.serializeToken({ kind: 'address369', address: 197 });
  assert(addrEnv.typeTag === '101', 'Address token has 101 tag');

  const opEnv = BinaryReasoningBridge.serializeToken({
    kind: 'opcode',
    opcode: TriangleOpcode.OP_ADD,
  });
  assert(opEnv.typeTag === '110', 'Opcode token has 110 tag');

  // Explicit Float64 serialization contract (FIND-H2)
  const floatEnv = BinaryReasoningBridge.serializeFloatToken(3.0);
  assert(floatEnv.typeTag === '011', 'Explicit float token has 011 tag');
  assert(floatEnv.bitLength === 67, 'Explicit float token is 67 bits');
  assert(floatEnv.decodedValue === 3.0, 'Explicit float token decodes as 3.0');

  // Fail-closed verification: reserved opcodes must fail
  let reservedCaught = false;
  try {
    BinaryReasoningBridge.deserializeToken('110' + (0x18).toString(2).padStart(6, '0'));
  } catch (err: any) {
    reservedCaught = err instanceof BinaryError && err.code === 'RESERVED_OPCODE';
  }
  assert(reservedCaught, 'Reserved opcode deserialization must throw RESERVED_OPCODE');

  console.log('  ✓ Suite E passed: Binary protocol v1 integration bit-exact and fail-closed');

  console.log('\n' + '='.repeat(80));
  console.log('  PHASE 3 VERIFICATION: ALL REASONING ENGINE SUITES PASSED (100%)');
  console.log('='.repeat(80) + '\n');
}

if (require.main === module) {
  runPhase3ReasoningTests();
}
