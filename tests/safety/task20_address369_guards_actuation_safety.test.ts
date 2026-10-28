/**
 * ONE Intelligence — Task 20 Verification Suite
 * ===============================================
 * Tests: Address369, Resource Guards & Actuation Safety
 * Module: tests/safety/task20_address369_guards_actuation_safety.test.ts
 */

import * as assert from 'assert';
import { CanonicalAddress369 } from '../../src/one/address369_canonical';
import { BinaryCodebook } from '../../src/binary/binaryCodebook';
import { BinaryDecoder } from '../../src/binary/binaryDecoder';
import { BinaryError, BitCategory } from '../../src/binary/types';
import { BinaryEncoder } from '../../src/binary/binaryEncoder';
import { ExecutableValidator } from '../../src/one/packer/ExecutableValidator';
import { ExecutablePacker } from '../../src/one/packer/ExecutablePacker';
import { UnifiedIRProgram, createVariable } from '../../src/one/ir/UnifiedIR';
import { VIGSecurityGuard } from '../../src/one/vig/VIGSecurityGuard';
import { VIGSecurityError, VIGAccessDeniedError, VIGValidationError } from '../../src/one/vig/types';
import { UnifiedVM, OneVMError } from '../../src/one/vm/UnifiedVM';
import { UnifiedCompiler } from '../../src/one/UnifiedCompiler';
import { RSSGuard } from '../../src/core/memory/rssGuard';
import {
  BoundedWorkingSetManager,
  MemoryCeilingExceededError,
} from '../../src/one/memory/extreme/BoundedWorkingSetManager';
import { ExtremeMemoryVMAdapter } from '../../src/one/memory/extreme/ExtremeMemoryVMAdapter';
import { UnifiedExtremeMemoryToolchain } from '../../src/one/memory/extreme/UnifiedExtremeMemoryToolchain';
import {
  AgiOneCoreOrchestrator,
  ActuationBlockedError,
} from '../../src/one/agi_one_core_orchestrator';
import { AgiOneIPCBridge } from '../../src/one/agi_one_ipc_bridge';
import { TimeTravelStateManager } from '../../src/one/data/TimeTravelStateManager';
import { ReasoningEngine } from '../../src/one/intelligence/reasoning/ReasoningEngine';
import { ReasoningStatus, Candidate, ReasoningRule } from '../../src/one/intelligence/reasoning/types';
import { RuleRegistry } from '../../src/one/intelligence/reasoning/RuleRegistry';

export function runTask20SafetyGuardsActuationTests(): void {
  console.log('='.repeat(80));
  console.log('  ONE INTELLIGENCE — TASK 20: ADDRESS369, RESOURCE GUARDS & ACTUATION SAFETY');
  console.log('='.repeat(80));

  const compiler = new UnifiedCompiler();

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 1: Address369 Partitioning & Reserved Range Rejection [369..511]
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 1] Address369 Partitioning & Reserved Range Rejection [369..511]...');

  // 1A: Canonical partition verification
  assert.strictEqual(CanonicalAddress369.TOTAL_ADDRESSES, 369, 'Suite 1A: Total addresses is strictly 369');
  assert.strictEqual(CanonicalAddress369.SYMBOLIC_COUNT, 26, 'Suite 1A: Symbolic registers count is 26');
  assert.strictEqual(CanonicalAddress369.SPATIAL_COUNT, 343, 'Suite 1A: Spatial voxel cells count is 343 (7x7x7)');
  assert.strictEqual(CanonicalAddress369.SYMBOLIC_START, 0, 'Suite 1A: Symbolic start is 0');
  assert.strictEqual(CanonicalAddress369.SYMBOLIC_END, 25, 'Suite 1A: Symbolic end is 25');
  assert.strictEqual(CanonicalAddress369.SPATIAL_START, 26, 'Suite 1A: Spatial start is 26');
  assert.strictEqual(CanonicalAddress369.SPATIAL_END, 368, 'Suite 1A: Spatial end is 368');

  // Verify all 26 symbolic registers map to layer SYMBOLIC
  for (let addr = 0; addr <= 25; addr++) {
    const info = CanonicalAddress369.inspectAddress(addr);
    assert.strictEqual(info.layer, 'SYMBOLIC', `Suite 1A: Address ${addr} is SYMBOLIC`);
    assert.strictEqual(info.internalAddress, addr, `Suite 1A: Internal address matches`);
    assert.strictEqual(info.displayIndex, addr + 1, `Suite 1A: Display index is addr + 1`);
  }

  // Verify all 343 spatial cells map to layer SPATIAL with valid (i, j, k) coords in [0..6]
  for (let addr = 26; addr <= 368; addr++) {
    const info = CanonicalAddress369.inspectAddress(addr);
    assert.strictEqual(info.layer, 'SPATIAL', `Suite 1A: Address ${addr} is SPATIAL`);
    assert.ok(info.spatialCoord, `Suite 1A: Address ${addr} has spatial coordinates`);
    const { i, j, k } = info.spatialCoord!;
    assert.ok(i >= 0 && i <= 6, `Suite 1A: Coord i in bounds [0..6] for addr ${addr}`);
    assert.ok(j >= 0 && j <= 6, `Suite 1A: Coord j in bounds [0..6] for addr ${addr}`);
    assert.ok(k >= 0 && k <= 6, `Suite 1A: Coord k in bounds [0..6] for addr ${addr}`);
    const mappedBack = CanonicalAddress369.spatialCoordToCanonicalAddress(i, j, k);
    assert.strictEqual(mappedBack, addr, `Suite 1A: Round-trip coordinate mapping exact for ${addr}`);
  }

  // 1B: Out of bounds rejection in CanonicalAddress369
  const boundaryViolations = [-100, -1, 369, 370, 500, 511, 512, 1024];
  for (const badAddr of boundaryViolations) {
    assert.throws(
      () => CanonicalAddress369.toDisplayIndex(badAddr),
      /outside valid canonical range \[0\.\.368\]/,
      `Suite 1B: Address ${badAddr} rejected fail-closed`
    );
  }

  // 1C: Binary Codebook 9-Bit Table: Reserved range [369..511]
  assert.strictEqual(BinaryCodebook.TABLE_9BIT.length, 512, 'Suite 1C: 9-bit table has 512 entries');
  for (let code = 0; code <= 368; code++) {
    const entry = BinaryCodebook.lookup9Bit(code);
    assert.strictEqual(entry.status, 'ASSIGNED', `Suite 1C: Code ${code} is ASSIGNED`);
  }
  for (let code = 369; code <= 511; code++) {
    const entry = BinaryCodebook.lookup9Bit(code);
    assert.strictEqual(entry.status, 'RESERVED', `Suite 1C: Code ${code} is RESERVED`);
    assert.strictEqual(entry.layer, 'RESERVED', `Suite 1C: Layer is RESERVED`);
  }

  // 1D: BinaryDecoder rejects reserved 9-bit addresses [369..511]
  const reservedTestAddresses = [369, 370, 420, 500, 511];
  for (const reservedAddr of reservedTestAddresses) {
    const bitstring = '101' + reservedAddr.toString(2).padStart(9, '0');
    assert.throws(
      () => BinaryDecoder.decode(bitstring),
      (err: any) => err instanceof BinaryError && err.code === 'ADDRESS_OUT_OF_BOUNDS',
      `Suite 1D: BinaryDecoder rejected reserved address ${reservedAddr} fail-closed`
    );
  }

  // BinaryEncoder rejects addresses outside [0..368]
  for (const badAddr of [-1, 369, 511, 512]) {
    assert.throws(
      () => BinaryEncoder.encodeAddress(badAddr),
      (err: any) => err instanceof BinaryError && err.code === 'ADDRESS_OUT_OF_BOUNDS',
      `Suite 1D: BinaryEncoder rejected out-of-bounds address ${badAddr}`
    );
  }

  console.log('  ✓ Suite 1 passed: Address369 symbolic [0..25], spatial [26..368], and reserved [369..511] certified.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 2: Actuation Lockout & E8005 Fail-Closed Safety
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 2] Actuation Lockout & E8005 Fail-Closed Safety...');

  // 2A: Actuation Lockout invariants across all components
  const orch = new AgiOneCoreOrchestrator();
  assert.strictEqual(orch.is_actuation_blocked, true, 'Suite 2A: AgiOneCoreOrchestrator is_actuation_blocked === true');
  assert.strictEqual(orch.isActuationBlocked, true, 'Suite 2A: AgiOneCoreOrchestrator isActuationBlocked === true');

  const ipc = new AgiOneIPCBridge();
  assert.strictEqual(ipc.is_actuation_blocked, true, 'Suite 2A: AgiOneIPCBridge is_actuation_blocked === true');
  assert.strictEqual(ipc.isActuationBlocked, true, 'Suite 2A: AgiOneIPCBridge isActuationBlocked === true');

  const timeTravelMgr = new TimeTravelStateManager();
  assert.strictEqual(timeTravelMgr.isActuationBlocked, true, 'Suite 2A: TimeTravelStateManager isActuationBlocked === true');

  const extremeToolchain = new UnifiedExtremeMemoryToolchain();
  assert.strictEqual(extremeToolchain.is_actuation_blocked, true, 'Suite 2A: Toolchain is_actuation_blocked === true');

  const extremeVMAdapter = new ExtremeMemoryVMAdapter(extremeToolchain);
  assert.strictEqual(extremeVMAdapter.isActuationBlocked, true, 'Suite 2A: ExtremeMemoryVMAdapter isActuationBlocked === true');

  // 2B: E8005 enforcement in ExecutableValidator
  // Case: Program with actuationLock === false
  const programUnlocked: UnifiedIRProgram = {
    version: '1.0.0',
    declarativeMetadata: {
      rssMaxLimitMB: 512,
      actuationLock: false, // VIOLATION
    },
    instructions: [{ index: 0, opcode: 'CONST', sources: [{ type: 'int', value: 1 }] }],
  };
  const valUnlocked = ExecutableValidator.validate(programUnlocked);
  assert.strictEqual(valUnlocked.valid, false, 'Suite 2B: Unlocked program rejected');
  assert.strictEqual(valUnlocked.errorCode, 'E8005', 'Suite 2B: Error code is E8005');

  // Case: Program with prohibited physical actuation keyword in operand
  const programActuateOperand: UnifiedIRProgram = {
    version: '1.0.0',
    instructions: [
      {
        index: 0,
        opcode: 'SPATIAL_OP',
        sources: [createVariable('actuate_motor_arm')], // VIOLATION
      },
    ],
  };
  const valActuate = ExecutableValidator.validate(programActuateOperand);
  assert.strictEqual(valActuate.valid, false, 'Suite 2B: Actuation operand rejected');
  assert.strictEqual(valActuate.errorCode, 'E8005', 'Suite 2B: Error code is E8005');

  // Case: Artifact with missing ONEX_FLAG_ACTUATION_LOCKED bit (cleared flags)
  const validArtifact = ExecutablePacker.pack({ version: '1.0.0', instructions: [] });
  const strippedArtifact = Buffer.from(validArtifact);
  strippedArtifact.writeUInt16LE(0, 10); // Clear header flags
  const valHeader = ExecutablePacker.validateArtifact(strippedArtifact);
  assert.strictEqual(valHeader.valid, false, 'Suite 2B: Stripped flag rejected');
  assert.strictEqual(valHeader.errorCode, 'E8005', 'Suite 2B: Missing flag error is E8005');

  // 2C: E8005 enforcement in AgiOneCoreOrchestrator
  assert.throws(
    () => orch.requestActuation('ROBOTIC_ARM', 'DEPLOY'),
    (err: any) => err instanceof ActuationBlockedError && err.message.includes('E8005'),
    'Suite 2C: Orchestrator requestActuation throws ActuationBlockedError (E8005)'
  );

  console.log('  ✓ Suite 2 passed: Actuation lockout permanent across all modules; E8005 strictly enforced.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 3: VIG Security Guard & Physical Actuation Containment
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 3] VIG Security Guard & Physical Actuation Containment...');

  // 3A: VIG Security Guard rejects prohibited actuation keys
  const prohibitedKeySamples = [
    { actuate: true },
    { nested: { actuation: 'engage' } },
    { deep: { level: { motorcontrol: 1 } } },
    { physicalaction: 'move_arm' },
    { hardwareaccess: 'gpio_pin' },
    { shellexec: 'reboot' },
    { overridelockout: true },
  ];

  for (const badPayload of prohibitedKeySamples) {
    assert.throws(
      () => VIGSecurityGuard.assertNoActuation(badPayload, 'TEST_OP'),
      (err: any) => err instanceof VIGSecurityError && err.message.includes('Actuation lockout violation'),
      'Suite 3A: Prohibited actuation key rejected fail-closed'
    );
  }

  // Safe payloads pass
  assert.doesNotThrow(() => {
    VIGSecurityGuard.assertNoActuation({ readOnly: true, metric: 42, label: 'state_tensor' }, 'SAFE_OP');
  }, 'Suite 3A: Read-only non-actuating payload passes');

  // 3B: Path Traversal Protection
  const traversalPaths = [
    '../outside_repo',
    '../../etc/passwd',
    'subdir/../../escaped',
    'safe\0poison_null',
  ];

  for (const badPath of traversalPaths) {
    assert.throws(
      () => VIGSecurityGuard.assertSafeRepositoryPath(badPath, process.cwd()),
      (err: any) => err instanceof VIGSecurityError,
      `Suite 3B: Path traversal attempt "${badPath}" rejected with VIGSecurityError`
    );
  }

  // 3C: Role-Based Access Control (RBAC)
  const analyzerContext = {
    role: 'ANALYZER_AGENT' as const,
    agentId: 'analyzer_01',
  };

  assert.throws(
    () => VIGSecurityGuard.assertCanMutate(analyzerContext, 'WRITE_EVIDENCE'),
    (err: any) => err instanceof VIGAccessDeniedError,
    'Suite 3C: Non-mutating role ANALYZER_AGENT denied mutating access'
  );

  console.log('  ✓ Suite 3 passed: VIG Security Guard actuation firewall, path traversal, and RBAC validated.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 4: I/O Input Stream Exhaustion & E5012 Fail-Closed Verification
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 4] I/O Input Stream Exhaustion & E5012 Fail-Closed Verification...');

  // 4A: Normal input consumption with FIFO mock queue
  const srcInput = `
    one in a;
    one in b;
  `;
  const progInput = compiler.compile(srcInput).ir!;

  const vmValid = new UnifiedVM();
  const resValid = vmValid.execute(progInput, { mockInputs: ['first_input', 'second_input'] });
  assert.strictEqual(resValid.success, true, 'Suite 4A: Input consumption succeeds with provided mock inputs');
  assert.strictEqual(resValid.globals['a'], 'first_input', 'Suite 4A: First input read FIFO');
  assert.strictEqual(resValid.globals['b'], 'second_input', 'Suite 4A: Second input read FIFO');

  // 4B: E5012 on completely absent mock inputs & handler
  const vmAbsent = new UnifiedVM();
  const resAbsent = vmAbsent.execute(progInput); // No inputs provided
  assert.strictEqual(resAbsent.success, false, 'Suite 4B: Execution fails when no input available');
  assert.strictEqual(resAbsent.error?.code, 'E5012', 'Suite 4B: Error code is E5012');
  assert.ok(
    resAbsent.error?.message.includes('Input stream exhausted'),
    'Suite 4B: Error message indicates input stream exhausted'
  );

  // 4C: E5012 when queue is exhausted mid-execution (1 provided, 2 requested)
  const vmExhausted = new UnifiedVM();
  const resExhausted = vmExhausted.execute(progInput, { mockInputs: ['only_one_item'] });
  assert.strictEqual(resExhausted.success, false, 'Suite 4C: Execution fails on exhausted queue');
  assert.strictEqual(resExhausted.error?.code, 'E5012', 'Suite 4C: Error code is E5012');
  assert.strictEqual(resExhausted.globals['a'], 'only_one_item', 'Suite 4C: First variable populated before exhaustion');

  console.log('  ✓ Suite 4 passed: E5012 input stream exhaustion verified fail-closed.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 5: VM Resource Ceilings: Instruction Budget (E5007) & Call-Depth (E5006)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 5] VM Resource Ceilings: Instruction Budget (E5007) & Call-Depth (E5006)...');

  // 5A: Infinite loop instruction ceiling guard (E5007)
  const srcInfinite = `
    let count = 0;
    while (true) {
      count = count + 1;
    }
  `;
  const progInfinite = compiler.compile(srcInfinite).ir!;

  const vmLoop = new UnifiedVM();
  const resLoop = vmLoop.execute(progInfinite, { maxInstructions: 250 });
  assert.strictEqual(resLoop.success, false, 'Suite 5A: Infinite loop intercepted by instruction ceiling');
  assert.strictEqual(resLoop.error?.code, 'E5007', 'Suite 5A: Instruction limit error code is E5007');
  assert.ok(
    resLoop.error?.message.includes('Max instruction count exceeded'),
    'Suite 5A: Error message indicates max instruction count exceeded'
  );

  // 5B: Unbounded recursion stack depth guard (E5006)
  const srcRecursion = `
    fn recurse(depth: Int32): Int32 {
      return recurse(depth + 1);
    }
    let res = recurse(1);
  `;
  const progRecursion = compiler.compile(srcRecursion).ir!;

  const vmStack = new UnifiedVM();
  const resStack = vmStack.execute(progRecursion, { maxCallDepth: 20 });
  assert.strictEqual(resStack.success, false, 'Suite 5B: Unbounded recursion intercepted by call-depth ceiling');
  assert.strictEqual(resStack.error?.code, 'E5006', 'Suite 5B: Call depth error code is E5006');
  assert.ok(
    resStack.error?.message.includes('Maximum call depth exceeded'),
    'Suite 5B: Error message indicates maximum call depth exceeded'
  );

  console.log('  ✓ Suite 5 passed: Instruction ceiling (E5007) and call-depth limit (E5006) enforced fail-closed.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 6: Memory Ceilings: RSS Guard & Bounded Working Set Eviction
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 6] Memory Ceilings: RSS Guard & Bounded Working Set Eviction...');

  // 6A: RSSGuard 512 MB physical ceiling
  const rssGuard = new RSSGuard(512);
  assert.strictEqual(rssGuard.getUsedMb(), 0, 'Suite 6A: Initial allocated RSS is 0 MB');

  // Allocate 128 MB -> succeeds
  rssGuard.allocate(128 * 1024 * 1024, 'LatticeBuffer');
  assert.strictEqual(rssGuard.getUsedMb(), 128, 'Suite 6A: Allocated 128 MB verified');

  // Requesting allocation exceeding 512 MB ceiling -> throws RSS Hardware Panic
  assert.throws(
    () => rssGuard.allocate(400 * 1024 * 1024, 'ExcessiveBuffer'),
    /\[RSS Hardware Panic\].*exceeds maximum limit/,
    'Suite 6A: Over-limit allocation request strictly rejected'
  );

  // Freeing memory accounting
  rssGuard.free(64 * 1024 * 1024);
  assert.strictEqual(rssGuard.getUsedMb(), 64, 'Suite 6A: Memory successfully freed');

  // 6B: BoundedWorkingSetManager hard ceiling
  assert.strictEqual(
    BoundedWorkingSetManager.ABSOLUTE_RSS_GUARD_BYTES,
    512 * 1024 * 1024,
    'Suite 6B: Absolute RSS guard is strictly 512 MB'
  );

  const wsManager = new BoundedWorkingSetManager({
    maxHeapBytes: 1, // Enforce immediate ceiling breach for testing
    maxActiveObjects: 100,
  });

  // Enforce memory ceiling on simulated oversized heap
  assert.throws(
    () => wsManager.checkAndEnforcePressure(),
    (err: any) => err instanceof MemoryCeilingExceededError,
    'Suite 6B: Exceeding heap ceiling throws MemoryCeilingExceededError'
  );

  console.log('  ✓ Suite 6 passed: RSS physical guard (512 MB) and Working Set ceiling verified.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 7: Reasoning Engine Budgets: Step Limit, Candidate Ceiling & Timeout
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 7] Reasoning Engine Budgets: Step Limit, Candidate Ceiling & Timeout...');

  const incRule: ReasoningRule<number> = {
    id: 'inc_rule',
    description: 'Increment number indefinitely',
    priority: 10,
    isApplicable: (_n: number) => true,
    apply: (n: number) => [n + 1],
  };

  const ruleRegistry = new RuleRegistry<number>();
  ruleRegistry.register(incRule);
  const reasoningEngine = new ReasoningEngine<number>(ruleRegistry);

  // 7A: Step limit budget enforcement
  const stepBudgetResult = reasoningEngine.solve({
    input: 0,
    goal: (n: number) => n >= 1000,
    maxSteps: 5,
  });

  assert.strictEqual(
    stepBudgetResult.status,
    ReasoningStatus.STEP_LIMIT,
    'Suite 7A: Exceeding step limit returns STEP_LIMIT'
  );
  assert.ok(stepBudgetResult.metrics.stepsUsed <= 5, 'Suite 7A: Steps used does not exceed step limit');

  // 7B: Depth ceiling enforcement
  const depthBudgetResult = reasoningEngine.solve({
    input: 0,
    goal: (n: number) => n >= 1000,
    maxSteps: 50,
    maxDepth: 3,
  });

  assert.ok(
    depthBudgetResult.metrics.depthReached <= 3,
    `Suite 7B: Depth reached (${depthBudgetResult.metrics.depthReached}) does not exceed depth ceiling (3)`
  );

  // 7C: Timeout budget enforcement
  const timeoutResult = reasoningEngine.solve({
    input: 0,
    goal: (_n: number) => {
      // Busy wait to trigger timeout
      const tEnd = performance.now() + 5;
      while (performance.now() < tEnd) {}
      return false;
    },
    maxSteps: 10000,
    timeoutMs: 2, // 2 ms tight timeout
  });

  assert.strictEqual(
    timeoutResult.status,
    ReasoningStatus.CANCELLED,
    'Suite 7C: Exceeding timeout budget returns CANCELLED'
  );
  assert.ok(
    timeoutResult.stopReason?.includes('timed out') ||
    timeoutResult.stopReason?.includes('cancelled'),
    'Suite 7C: Stop reason indicates timeout'
  );

  // 7D: Candidate budget limit enforcement
  const branchingRule: ReasoningRule<number> = {
    id: 'branching_rule',
    description: 'Branch into multiple children',
    priority: 5,
    isApplicable: (_n: number) => true,
    apply: (n: number) => [n * 10 + 1, n * 10 + 2, n * 10 + 3, n * 10 + 4, n * 10 + 5],
  };
  const branchingRegistry = new RuleRegistry<number>();
  branchingRegistry.register(branchingRule);
  const branchingEngine = new ReasoningEngine<number>(branchingRegistry);

  const candidateLimitResult = branchingEngine.solve({
    input: 0,
    goal: (_n: number) => false,
    maxCandidates: 8,
    maxSteps: 100,
  });

  assert.strictEqual(
    candidateLimitResult.status,
    ReasoningStatus.CANDIDATE_LIMIT,
    'Suite 7D: Exceeding candidate limit returns CANDIDATE_LIMIT'
  );

  // 7E: Invalid input fail-closed rejection
  const invalidResult = reasoningEngine.solve({
    input: undefined as any,
    goal: (n: number) => n === 0,
  });

  assert.strictEqual(
    invalidResult.status,
    ReasoningStatus.INVALID_INPUT,
    'Suite 7E: Undefined input returns INVALID_INPUT fail-closed'
  );

  console.log('  ✓ Suite 7 passed: Reasoning step limit, depth ceiling, timeout, candidate limit, and input validation enforced fail-closed.');

  console.log('\n' + '='.repeat(80));
  console.log('  TASK 20 VERIFICATION: ALL 7 SUITES PASSED (100%)');
  console.log('='.repeat(80) + '\n');
}

if (
  typeof process !== 'undefined' &&
  process.argv &&
  process.argv[1] &&
  process.argv[1].includes('task20_address369_guards_actuation_safety')
) {
  runTask20SafetyGuardsActuationTests();
}
