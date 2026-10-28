/**
 * ONE Binary 0/1 Reasoning Intelligence
 * Module: End-to-End Integration & Binary Bridge Test Suite (tests/integration/bridge_e2e.test.ts)
 */

import {
  ReasoningEngine,
  ReasoningRule,
  ReasoningStatus,
} from '../../src/reasoning';
import {
  BinaryReasoningBridge,
  ReasoningSession,
} from '../../src/integration';
import {
  BinaryDecoder,
  BinaryEncoder,
  TriangleOpcode,
  BinaryError,
} from '../../src/binary';
import { CanonicalAddress369 } from '../../src/shared/address369';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

export function runIntegrationE2ETests(): void {
  console.log('='.repeat(80));
  console.log('  ONE BINARY 0/1 REASONING INTELLIGENCE — INTEGRATION & E2E TEST SUITE');
  console.log('='.repeat(80));

  // ── Test 1: Full Reasoning Trajectory Serialization ────────────────────────
  console.log('\n[Test 1] Full Reasoning Trajectory to Binary Bitstream...');

  const decRule: ReasoningRule<number> = {
    id: 'dec_1',
    description: 'Subtract 1',
    priority: 10,
    isApplicable: (n) => n > 0,
    apply: (n) => [n - 1],
  };

  const halveRule: ReasoningRule<number> = {
    id: 'halve_even',
    description: 'Divide even by 2',
    priority: 25,
    isApplicable: (n) => n > 0 && n % 2 === 0,
    apply: (n) => [n / 2],
  };

  const engine = new ReasoningEngine<number>();
  engine.getRegistry().register(decRule).register(halveRule);

  const result = engine.solve({
    input: 16,
    goal: (n) => n === 1,
    maxSteps: 20,
  });

  assert(result.isSolved, 'Engine must solve 16 -> 1');
  assert(result.status === ReasoningStatus.SOLVED, 'Status must be SOLVED');

  // Convert each event in trace containing a numeric state to a binary envelope
  const traceEnvelopes = result.trace
    .filter((t) => typeof t.score === 'number')
    .map((t) => BinaryReasoningBridge.serializeToken(t.score as number));

  assert(traceEnvelopes.length > 0, 'Must produce binary envelopes for score telemetry');
  for (const env of traceEnvelopes) {
    assert(env.typeTag === '010' || env.typeTag === '011', 'Tag must be integer or float');
    const recovered = BinaryReasoningBridge.deserializeToken(env.rawBits);
    assert(typeof recovered === 'number', 'Recovered value must match type');
  }
  console.log(`  ✓ Successfully serialized ${traceEnvelopes.length} trace telemetry tokens to binary envelopes.`);

  // ── Test 2: Address369 Spatial Reasoning Bridge ───────────────────────────
  console.log('\n[Test 2] Address369 Spatial Memory Coordinates Roundtrip...');

  // Center voxel (3, 3, 3) in 7x7x7 grid
  const centerAddr = CanonicalAddress369.spatialCoordToCanonicalAddress(3, 3, 3);
  assert(centerAddr === 26 + 3 + 21 + 147, `Center voxel address is ${centerAddr}`);

  const addrEnv = BinaryReasoningBridge.serializeToken({
    kind: 'address369',
    address: centerAddr,
  });

  assert(addrEnv.typeTag === '101', 'Address369 envelope must use 101 prefix');
  assert(addrEnv.bitLength === 12, 'Address369 envelope must be exactly 12 bits');

  const recoveredAddr = BinaryReasoningBridge.deserializeToken(addrEnv.rawBits);
  assert(
    typeof recoveredAddr === 'object' && recoveredAddr !== null && 'address' in recoveredAddr && (recoveredAddr as any).address === centerAddr,
    'Recovered address must match center voxel address',
  );
  console.log('  ✓ Address369 spatial coordinate verified bit-exact through binary bridge.');

  // ── Test 3: Triangle Opcode Instruction Token Encoding ────────────────────
  console.log('\n[Test 3] Triangle Opcode Token Encoding & Rejection...');

  const validOpcode = TriangleOpcode.OP_LOCK_CHECK;
  const opEnv = BinaryReasoningBridge.serializeToken({
    kind: 'opcode',
    opcode: validOpcode,
  });

  assert(opEnv.typeTag === '110', 'Opcode envelope must use 110 prefix');
  assert(opEnv.bitLength === 9, 'Opcode envelope must be exactly 9 bits (3 prefix + 6 opcode)');

  const recoveredOp = BinaryReasoningBridge.deserializeToken(opEnv.rawBits);
  assert(
    typeof recoveredOp === 'object' && recoveredOp !== null && 'opcode' in recoveredOp && (recoveredOp as any).opcode === validOpcode,
    'Recovered opcode must match OP_LOCK_CHECK',
  );

  // Reserved opcode fail-closed rejection
  const reservedBitstring = '110' + (0x19).toString(2).padStart(6, '0');
  let threwReserved = false;
  try {
    BinaryReasoningBridge.deserializeToken(reservedBitstring);
  } catch (e: any) {
    threwReserved = e instanceof BinaryError && e.code === 'RESERVED_OPCODE';
  }
  assert(threwReserved, 'Reserved opcode must throw RESERVED_OPCODE fail-closed');
  console.log('  ✓ Triangle opcodes and fail-closed reserved opcode rejection verified.');

  // ── Test 4: ReasoningSession High-Level Coordinator ───────────────────────
  console.log('\n[Test 4] ReasoningSession High-Level Coordinator...');

  const session = new ReasoningSession<number>({
    rules: [decRule, halveRule],
  });

  const bundle = session.solveWithBinaryTrace({
    input: 10,
    goal: (n) => n === 1,
    maxSteps: 15,
  });

  assert(bundle.result.isSolved, 'Session must solve 10 -> 1');
  assert(bundle.isBitExact, 'Session binary trace must be 100% bit-exact');
  assert(bundle.solutionEnvelopes.length > 0, 'Session must emit solution envelopes');
  console.log(`  ✓ ReasoningSession solved 10 -> 1 with bit-exact binary trace verified.`);

  // ── Test 5: End-to-End Stream Serialization & Exact Equivalence Roundtrip ─
  console.log('\n[Test 5] Bounded Reasoning Problem -> Stream Serialization -> Full Stream Decode...');

  // 1. Solve a bounded problem: 24 -> 1 with step budget 20
  const streamProblemEngine = new ReasoningEngine<number>();
  streamProblemEngine.getRegistry().register(decRule).register(halveRule);

  const streamResult = streamProblemEngine.solve({
    input: 24,
    goal: (n) => n === 1,
    maxSteps: 20,
    constraints: [(n) => n >= 0],
  });

  assert(streamResult.isSolved, 'Must solve 24 -> 1');
  assert(streamResult.bestCandidate?.value === 1, 'Best candidate must be 1');

  // 2. Reconstruct the winning derivation path from leaf back to root
  const solutionTrajectoryValues: number[] = [];
  let curr: typeof streamResult.bestCandidate | undefined = streamResult.bestCandidate;
  while (curr) {
    solutionTrajectoryValues.unshift(curr.value);
    if (curr.parentId) {
      const parentId = curr.parentId;
      curr = streamResult.rankedCandidates.find((c) => c.candidate.id === parentId)?.candidate;
    } else {
      break;
    }
  }

  assert(solutionTrajectoryValues.length > 1, 'Trajectory must contain multiple steps');
  assert(solutionTrajectoryValues[0] === 24, 'Trajectory must start at input 24');
  assert(solutionTrajectoryValues[solutionTrajectoryValues.length - 1] === 1, 'Trajectory must end at goal 1');

  // 3. Assemble heterogeneous supported reasoning tokens:
  //    - Candidate states along the derivation path
  //    - String event classifications
  //    - Canonical Address369 spatial coordinate
  //    - Triangle opcode instruction (OP_HALT)
  const tokensToSerialize: Array<
    | number
    | string
    | { kind: 'address369'; address: number }
    | { kind: 'opcode'; opcode: TriangleOpcode }
  > = [
    ...solutionTrajectoryValues,
    'GOAL_REACHED',
    { kind: 'address369', address: centerAddr },
    { kind: 'opcode', opcode: TriangleOpcode.OP_HALT },
  ];

  // 4. Serialize each token through BinaryReasoningBridge
  const streamEnvelopes = tokensToSerialize.map((token) =>
    BinaryReasoningBridge.serializeToken(token),
  );
  assert(streamEnvelopes.length === tokensToSerialize.length, 'Envelope count must match token count');

  // 5. Concatenate all envelope bitstrings into a continuous multi-unit binary stream
  const continuousBitstream = streamEnvelopes.map((env) => env.rawBits).join('');
  assert(continuousBitstream.length > 0, 'Bitstream must not be empty');

  // 6. Decode the continuous stream using BinaryDecoder.decodeStream
  const decodedTokens = BinaryDecoder.decodeStream(continuousBitstream);
  assert(decodedTokens.length === tokensToSerialize.length, 'Decoded token count must match original count');

  // 7. Verify 100% exact equivalence for every decoded token
  for (let i = 0; i < tokensToSerialize.length; i++) {
    const expected = tokensToSerialize[i];
    const actual = decodedTokens[i];

    if (typeof expected === 'object' && expected !== null) {
      assert(
        JSON.stringify(actual) === JSON.stringify(expected),
        `Token [${i}] mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
      );
    } else {
      assert(actual === expected, `Token [${i}] mismatch: expected ${expected}, got ${actual}`);
    }
  }

  console.log(`  ✓ Derivation trajectory reconstructed: [${solutionTrajectoryValues.join(' -> ')}]`);
  console.log(`  ✓ Serialized ${tokensToSerialize.length} reasoning tokens to continuous bitstream (${continuousBitstream.length} bits).`);
  console.log('  ✓ Continuous stream decoded with 100% exact equivalence to original reasoning tokens.');

  console.log('\n' + '='.repeat(80));
  console.log('  ALL INTEGRATION E2E TESTS PASSED (100%)');
  console.log('='.repeat(80) + '\n');
}

if (require.main === module) {
  runIntegrationE2ETests();
}
