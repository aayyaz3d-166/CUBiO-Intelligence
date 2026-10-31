/**
 * ONE Language — Task 13 Verification Suite
 * Module: Binary Reasoning, Rule Engine & Planner Integration Test Suite
 * Path: tests/reasoning/task13_reasoning_integration.test.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ReasoningEngine,
  RuleRegistry,
  ReasoningRule,
  ReasoningStatus,
  ReasoningPolicy,
  BinaryReasoningBridge,
  ReasoningSession,
  DecisionOutcome,
} from '../../src/one/intelligence/reasoning';
import {
  BinaryEncoder,
  BinaryDecoder,
  TriangleOpcode,
  BinaryError,
} from '../../src/binary';
import { CanonicalAddress369 } from '../../src/one/address369_canonical';
import { PlanningEngine } from '../../src/one/intelligence/planning/PlanningEngine';
import { ReasoningToolAdapter } from '../../src/one/tools/ToolAdapters';
import { ToolExecutionContext } from '../../src/one/tools/INativeTool';
import { OneDeveloperCLI } from '../../src/one/cli/OneDeveloperCLI';
import { createString, createInt, toRaw } from '../../src/one/runtime/NativeValues';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

export function runTask13IntegrationTests(): void {
  console.log('='.repeat(80));
  console.log('  ONE INTELLIGENCE — TASK 13: REASONING, RULE ENGINE & PLANNER INTEGRATION');
  console.log('='.repeat(80));

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 1: Complete Reasoning Request and Result
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 1] Complete Reasoning Request and Result Lifecycle...');

  const decRule: ReasoningRule<number> = {
    id: 'dec_1',
    description: 'Subtract 1',
    priority: 10,
    isApplicable: (n) => n > 0,
    apply: (n) => [n - 1],
  };

  const halveRule: ReasoningRule<number> = {
    id: 'halve_even',
    description: 'Divide even number by 2',
    priority: 25,
    isApplicable: (n) => n > 0 && n % 2 === 0,
    apply: (n) => [n / 2],
  };

  const session1 = new ReasoningSession<number>({
    rules: [decRule, halveRule],
  });

  const res1 = session1.solve({
    input: 16,
    goal: (n) => n === 1,
    maxSteps: 20,
    maxDepth: 10,
    maxCandidates: 100,
  });

  assert(res1.isSolved === true, 'Suite 1: Must solve target 16 -> 1');
  assert(res1.status === ReasoningStatus.SOLVED, 'Suite 1: Status must be SOLVED');
  assert(res1.bestCandidate !== undefined, 'Suite 1: Best candidate must exist');
  assert(res1.bestCandidate?.value === 1, 'Suite 1: Best candidate value must be 1');
  assert(res1.metrics.stepsUsed > 0, 'Suite 1: Steps used must be > 0');
  assert(res1.metrics.candidatesGenerated > 0, 'Suite 1: Candidates generated > 0');
  assert(res1.metrics.depthReached > 0, 'Suite 1: Depth reached > 0');
  assert(res1.trace.length > 0, 'Suite 1: Audit trace must capture reasoning lifecycle events');
  assert(res1.trace[0].eventType === 'TASK_INIT', 'Suite 1: First event must be TASK_INIT');
  assert(res1.trace[res1.trace.length - 1].eventType === 'TERMINATION', 'Suite 1: Last event must be TERMINATION');
  console.log('  ✓ Suite 1 passed: Full reasoning request solved deterministically with complete telemetry.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 2: Binary Trace Serialization and Round-Trip Decoding
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 2] Binary Trace Serialization & Stream Round-Trip Decoding...');

  const bundle2 = session1.solveWithBinaryTrace({
    input: 24,
    goal: (n) => n === 1,
    maxSteps: 25,
  });

  assert(bundle2.result.isSolved === true, 'Suite 2: Task 24 -> 1 solved');
  assert(bundle2.isBitExact === true, 'Suite 2: Solution trace must be 100% bit-exact');
  assert(bundle2.solutionEnvelopes.length > 1, 'Suite 2: Must emit multi-step solution envelopes');

  // Verify envelopes match derivation path
  for (const env of bundle2.solutionEnvelopes) {
    assert(env.typeTag === '010', 'Suite 2: Candidate envelopes must have integer tag 010');
    assert(typeof env.decodedValue === 'number', 'Suite 2: Decoded value must be integer');
  }

  // Assemble heterogeneous streaming payload
  const centerVoxelAddr = CanonicalAddress369.spatialCoordToCanonicalAddress(3, 3, 3);
  const heterogeneousTokens: Array<
    | number
    | string
    | { kind: 'address369'; address: number }
    | { kind: 'opcode'; opcode: TriangleOpcode }
  > = [
    24,
    12,
    6,
    3,
    2,
    1,
    'TRAJECTORY_COMPLETE',
    { kind: 'address369', address: centerVoxelAddr },
    { kind: 'opcode', opcode: TriangleOpcode.OP_HALT },
  ];

  const streamEnvelopes = heterogeneousTokens.map((t) => BinaryReasoningBridge.serializeToken(t));
  const fullBitstream = streamEnvelopes.map((e) => e.rawBits).join('');
  const decodedTokens = BinaryDecoder.decodeStream(fullBitstream);

  assert(decodedTokens.length === heterogeneousTokens.length, 'Suite 2: Decoded count matches original count');
  for (let i = 0; i < heterogeneousTokens.length; i++) {
    const expected = heterogeneousTokens[i];
    const actual = decodedTokens[i];
    if (typeof expected === 'object' && expected !== null) {
      assert(JSON.stringify(actual) === JSON.stringify(expected), `Token [${i}] mismatch`);
    } else {
      assert(actual === expected, `Token [${i}] scalar mismatch`);
    }
  }
  console.log(`  ✓ Suite 2 passed: Serialized ${streamEnvelopes.length} tokens (${fullBitstream.length} bits) and decoded bit-exact.`);

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 3: Rule Conflicts, Incompatible Invariants & No-Solution Cases
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 3] Rule Conflicts & No-Solution Cases...');

  // 3A: Rule Conflicts & Incompatible Invariants (Constraint Rejection)
  const addTwoRule: ReasoningRule<number> = {
    id: 'add_2',
    description: 'Add 2',
    isApplicable: () => true,
    apply: (n) => [n + 2],
  };

  const engine3A = new ReasoningEngine<number>();
  engine3A.getRegistry().register(decRule).register(addTwoRule);

  // Constraint requires number to be strictly odd; starting at 4 (even)
  const res3A = engine3A.solve({
    input: 4,
    goal: (n) => n === 1,
    constraints: [(n) => n % 2 !== 0], // Rejects even candidates (4 - 1 = 3 is odd, but 4 + 2 = 6 is even)
  });

  assert(res3A.isSolved === true, 'Suite 3A: Should solve by selecting valid path');
  // Confirm that candidate 6 was rejected by constraint
  const rejectedEvent = res3A.trace.find((e) => e.decision === DecisionOutcome.REJECT || e.reasonCode.includes('FAIL_CONSTRAINT'));
  assert(rejectedEvent !== undefined, 'Suite 3A: Contradictory candidates must be recorded as REJECT in trace');

  // 3B: No-Solution Case / Frontier Exhaustion
  const deadEndEngine = new ReasoningEngine<number>();
  deadEndEngine.getRegistry().register(decRule); // Only decrement allowed

  const res3B = deadEndEngine.solve({
    input: 3,
    goal: (n) => n === 100, // Unreachable by decrementing
    maxSteps: 50,
  });

  assert(res3B.isSolved === false, 'Suite 3B: Unreachable goal must not be solved');
  assert(res3B.status === ReasoningStatus.EXHAUSTED, 'Suite 3B: Status must be EXHAUSTED');
  assert(res3B.stopReason.includes('Frontier exhausted'), 'Suite 3B: Stop reason indicates exhausted frontier');

  // 3C: Contradictory Constraints (Immediate No-Solution)
  const res3C = deadEndEngine.solve({
    input: 10,
    goal: (n) => n === 5,
    constraints: [
      (n) => n > 20, // Impossible when input is 10 and only decrement applies
    ],
  });
  assert(res3C.isSolved === false, 'Suite 3C: Contradictory constraints cannot solve');
  assert(res3C.status === ReasoningStatus.EXHAUSTED, 'Suite 3C: Status must be EXHAUSTED');

  console.log('  ✓ Suite 3 passed: Rule conflicts, constraint rejections, and no-solution cases handled fail-closed.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 4: Resource Exhaustion and Cancellation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 4] Resource Exhaustion & Cancellation...');

  // 4A: Step Limit Exhaustion
  const res4A = session1.solve({
    input: 20,
    goal: (n) => n === 1,
    maxSteps: 3, // Needs more than 3 steps
  });
  assert(res4A.isSolved === false, 'Suite 4A: Cannot solve within 3 steps');
  assert(res4A.status === ReasoningStatus.STEP_LIMIT, 'Suite 4A: Status must be STEP_LIMIT');
  assert(res4A.metrics.stepsUsed === 3, 'Suite 4A: Consumed exactly 3 steps');

  // Zero-budget check
  const res4A_zero = session1.solve({
    input: 5,
    goal: (n) => n === 0,
    maxSteps: 0,
  });
  assert(res4A_zero.status === ReasoningStatus.STEP_LIMIT, 'Suite 4A: Zero budget returns STEP_LIMIT');

  // 4B: Candidate Budget Limit
  const branchingRule: ReasoningRule<number> = {
    id: 'branch_three',
    description: 'Generates 3 branches',
    isApplicable: () => true,
    apply: (n) => [n + 1, n + 2, n + 3],
  };
  const branchingEngine = new ReasoningEngine<number>();
  branchingEngine.getRegistry().register(branchingRule);

  const res4B = branchingEngine.solve({
    input: 0,
    goal: (n) => n === 1000,
    maxCandidates: 12,
  });
  assert(res4B.isSolved === false, 'Suite 4B: Cannot solve with tight candidate budget');
  assert(res4B.status === ReasoningStatus.CANDIDATE_LIMIT, 'Suite 4B: Status must be CANDIDATE_LIMIT');

  // 4C: Depth Limit Exhaustion
  const res4C = session1.solve({
    input: 10,
    goal: (n) => n === 0,
    maxDepth: 2,
  });
  assert(res4C.isSolved === false, 'Suite 4C: Depth limit prevented reaching goal');

  // 4D: Explicit Cancellation via isCancelled predicate
  let cancelTriggered = false;
  let checksCount = 0;
  const res4D = session1.solve({
    input: 50,
    goal: (n) => n === 0,
    maxSteps: 100,
    isCancelled: () => {
      checksCount++;
      return checksCount >= 4; // Cancel after 4 checks
    },
  });
  assert(res4D.isSolved === false, 'Suite 4D: Must not solve when cancelled');
  assert(res4D.status === ReasoningStatus.CANCELLED, 'Suite 4D: Status must be CANCELLED');
  assert(res4D.stopReason.includes('cancelled by caller'), 'Suite 4D: Stop reason indicates cancelled');

  // 4E: Session Cancellation Handle
  const session4E = new ReasoningSession<number>({ rules: [decRule] });
  session4E.cancel();
  const res4E = session4E.solve({
    input: 10,
    goal: (n) => n === 0,
  });
  assert(res4E.status === ReasoningStatus.CANCELLED, 'Suite 4E: Pre-cancelled session aborts immediately');

  // Reset cancellation and ensure it works again
  session4E.resetCancellation();
  const res4E_resumed = session4E.solve({
    input: 2,
    goal: (n) => n === 0,
  });
  assert(res4E_resumed.status === ReasoningStatus.SOLVED, 'Suite 4E: Reset cancellation allows subsequent solve');

  console.log('  ✓ Suite 4 passed: Step, candidate, depth ceilings and cancellation semantics verified.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 5: Invalid and Reserved Binary Values
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 5] Invalid & Reserved Binary Values Rejection...');

  // 5A: Reserved Triangle Opcode Rejection (0x18..0x3D are RESERVED)
  const reservedOpcodes = [0x18, 0x19, 0x20, 0x30, 0x3d];
  for (const op of reservedOpcodes) {
    const rawBits = '110' + op.toString(2).padStart(6, '0');
    let rejected = false;
    try {
      BinaryReasoningBridge.deserializeToken(rawBits);
    } catch (e: any) {
      rejected = e instanceof BinaryError && e.code === 'RESERVED_OPCODE';
    }
    assert(rejected, `Suite 5A: Reserved opcode 0x${op.toString(16)} must be rejected`);
  }

  // 5B: Out-of-Bounds Address369 Rejection (address >= 369)
  const outOfBoundsAddrs = [369, 370, 500, 511];
  for (const addr of outOfBoundsAddrs) {
    const rawBits = '101' + addr.toString(2).padStart(9, '0');
    let rejected = false;
    try {
      BinaryReasoningBridge.deserializeToken(rawBits);
    } catch (e: any) {
      rejected = e instanceof BinaryError && (e.code === 'ADDRESS_OUT_OF_BOUNDS' || e.code === 'OUT_OF_RANGE');
    }
    assert(rejected, `Suite 5B: Out-of-bounds address ${addr} must throw error`);
  }

  // 5C: Corrupted / Truncated Bitstreams
  const corruptedBits = [
    '10', // Truncated prefix
    '0100000000000000000000000000001', // 31-bit integer with invalid bitLen
    '110000', // 6-bit opcode token instead of 9 bits
    '10100000000', // 11-bit address token instead of 12 bits
  ];
  for (const bits of corruptedBits) {
    let rejected = false;
    try {
      BinaryReasoningBridge.deserializeToken(bits);
    } catch (e: any) {
      rejected = e instanceof BinaryError;
    }
    assert(rejected, `Suite 5C: Truncated stream '${bits}' must throw BinaryError`);
  }

  // 5D: Unknown / Reserved Type Tags (tag 111 is undefined in protocol v1)
  let tag111Rejected = false;
  try {
    BinaryReasoningBridge.deserializeToken('111000000000');
  } catch (e: any) {
    tag111Rejected = e instanceof BinaryError && e.code === 'INVALID_CODEWORD';
  }
  assert(tag111Rejected, 'Suite 5D: Undefined tag 111 must throw INVALID_CODEWORD');

  console.log('  ✓ Suite 5 passed: All reserved opcodes, addresses, tags, and malformed streams fail-closed.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 6: Planner & Native Tool Adapter Integration
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 6] Planner & Native Tool Adapter Integration...');

  const planner = new PlanningEngine();
  const mockContext: ToolExecutionContext = {
    executionId: 'exec_test_task13',
    callerId: 'test_runner',
    environment: {},
    actuationLock: true,
  };

  // 6A: Execute Bounded Binary Reasoning Plan via PlanningEngine
  const { plan, report } = planner.executeReasoningPlan(
    'Derive target value 10 from initial value 0',
    0,
    10,
    mockContext,
    50
  );

  assert(plan.steps.length === 1, 'Suite 6A: Plan generated 1 step');
  assert(plan.steps[0].toolId === 'cubio:reasoning', 'Suite 6A: Step uses cubio:reasoning tool');
  assert(report.status === 'COMPLETED', 'Suite 6A: Workflow status COMPLETED');
  assert(report.stepsExecuted === 1, 'Suite 6A: 1 step executed');
  assert(report.checkpointsCreated > 0, 'Suite 6A: State checkpoints created');

  const finalOutput = report.finalOutput as any;
  assert(finalOutput.isSolved === true, 'Suite 6A: Planning reasoning solved');
  assert(finalOutput.bestValue === 10, 'Suite 6A: Derived target value 10');
  assert(finalOutput.isBitExact === true, 'Suite 6A: Binary trace is bit-exact');

  // 6B: Direct ReasoningToolAdapter in BINARY mode
  const toolAdapter = new ReasoningToolAdapter();
  const adapterResp = toolAdapter.execute(
    {
      mode: createString('BINARY'),
      input: createInt(8),
      target: createInt(1),
      maxSteps: createInt(20),
    },
    mockContext
  );

  assert(adapterResp.success === true, 'Suite 6B: Tool adapter executed successfully');
  const toolData = toRaw(adapterResp.result) as any;
  assert(toolData.isSolved === true, 'Suite 6B: Tool adapter derived solution');
  assert(toolData.bestValue === 1, 'Suite 6B: Best value is 1');
  assert(toolData.isBitExact === true, 'Suite 6B: Bit-exact binary trace');

  // 6C: Unsupported Mode Rejection
  const invalidModeResp = toolAdapter.execute(
    { mode: createString('NON_EXISTENT_MODE') },
    mockContext
  );
  assert(invalidModeResp.success === false, 'Suite 6C: Unsupported mode must fail');
  assert(invalidModeResp.error?.includes('Unsupported reasoning mode'), 'Suite 6C: Error message clear');

  console.log('  ✓ Suite 6 passed: Planner workflow execution and Tool Adapter BINARY mode verified.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 7: Developer CLI Dispatch (one reason)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 7] Developer CLI Dispatch (one reason)...');

  // 7A: Missing argument usage
  const cliUsage = OneDeveloperCLI.run(['reason']);
  assert(cliUsage.exitCode === 1, 'Suite 7A: Missing arg exits with code 1');
  assert(cliUsage.stderr.includes('Usage: one reason <spec.json>'), 'Suite 7A: Usage displayed');

  // 7B: Missing file error
  const cliMissing = OneDeveloperCLI.run(['reason', 'non_existent_spec_123.json']);
  assert(cliMissing.exitCode === 1, 'Suite 7B: Missing file exits with code 1');
  assert(cliMissing.stderr.includes('not found'), 'Suite 7B: File not found error');

  // 7C: Valid JSON spec execution
  const tmpSpecPath = path.resolve(process.cwd(), 'scratch_reason_task.json');
  fs.writeFileSync(
    tmpSpecPath,
    JSON.stringify({
      input: 16,
      target: 1,
      maxSteps: 20,
    })
  );

  try {
    const cliRun = OneDeveloperCLI.run(['reason', tmpSpecPath]);
    assert(cliRun.exitCode === 0, 'Suite 7C: Valid spec exits with code 0');
    assert(cliRun.stdout.includes('Reasoning Execution Completed'), 'Suite 7C: Completion banner logged');
    assert(cliRun.stdout.includes('Solved:               true'), 'Suite 7C: Solved logged as true');
    assert(cliRun.stdout.includes('Best Candidate Value: 1'), 'Suite 7C: Best value is 1');

    // 7D: JSON Output mode (--json)
    const cliJson = OneDeveloperCLI.run(['reason', tmpSpecPath, '--json']);
    assert(cliJson.exitCode === 0, 'Suite 7D: JSON mode exits with code 0');
    const parsedCliOutput = JSON.parse(cliJson.stdout);
    assert(parsedCliOutput.isSolved === true, 'Suite 7D: JSON output isSolved === true');
    assert(parsedCliOutput.bestValue === 1, 'Suite 7D: JSON output bestValue === 1');
    assert(parsedCliOutput.isBitExact === true, 'Suite 7D: JSON output isBitExact === true');
  } finally {
    if (fs.existsSync(tmpSpecPath)) {
      fs.unlinkSync(tmpSpecPath);
    }
  }

  console.log('  ✓ Suite 7 passed: Developer CLI (one reason) executed cleanly across all CLI flags.');

  console.log('\n' + '='.repeat(80));
  console.log('  TASK 13 INTEGRATION: ALL 7 SUITES PASSED (100%)');
  console.log('='.repeat(80) + '\n');
}

if (require.main === module || (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('task13_reasoning_integration'))) {
  runTask13IntegrationTests();
}
