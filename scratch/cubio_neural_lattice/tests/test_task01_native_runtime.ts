/**
 * CUBiO AI — ONE LANGUAGE — TASK 01
 * =================================
 * Foundational Native Runtime Verification Suite
 *
 * 7 Verification Gates:
 *   Gate 1: Execution Model & Lifecycle Transitions
 *   Gate 2: Native Values Domain & Structural Equality
 *   Gate 3: State Management, RSS Memory Ceilings & Snapshots
 *   Gate 4: Formal Error Catalog (E7001-E7014) & Fail-Closed Guards
 *   Gate 5: Sandboxed Native Core Modules (Math, String, Array, Crypto, System)
 *   Gate 6: CUBiO Spatial & Canonical Address369 Integration
 *   Gate 7: End-to-End Program Execution & 100-Cycle Replay (sigma^2 = 0.0)
 */

import {
  NativeExecutionModel,
  NativeRuntimeState,
  NativeModuleRegistry,
  NativeRuntime,
  OneNativeRuntimeError,
  createNull,
  createBool,
  createInt,
  createFloat,
  createString,
  createArray,
  createRecord,
  createSpatialCoord,
  createCanonicalAddress,
  isEqual,
  isTruthy,
  compare,
  formatNativeValue,
  toRaw,
  fromRaw,
  CanonicalAddress369,
  SpatialBridge,
} from '../../../src/one';

let passedAssertions = 0;
let totalAssertions = 0;

function assert(condition: boolean, message: string): void {
  totalAssertions++;
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedAssertions++;
  console.log(`  ✓ ${message}`);
}

function runTask01VerificationSuite(): void {
  console.log('================================================================================');
  console.log(' 🌐 CUBiO AI — ONE LANGUAGE — TASK 01: FOUNDATIONAL NATIVE RUNTIME');
  console.log('================================================================================\n');

  // ===========================================================================
  // GATE 1: Execution Model & Lifecycle Transitions
  // ===========================================================================
  console.log('[Gate 1] Verifying Native Execution Model & Lifecycle Transitions...');
  const execModel = new NativeExecutionModel({ maxInstructions: 100, maxCallDepth: 10 });
  assert(execModel.getState() === 'INITIALIZING', 'Initial state is INITIALIZING');

  execModel.transition('READY');
  assert(execModel.getState() === 'READY', 'Transition to READY succeeded');

  execModel.transition('RUNNING');
  assert(execModel.getState() === 'RUNNING', 'Transition to RUNNING succeeded');

  // Test illegal transition
  let illegalCaught = false;
  try {
    execModel.transition('INITIALIZING'); // Cannot jump from RUNNING to INITIALIZING
  } catch {
    illegalCaught = true;
  }
  assert(illegalCaught, 'Illegal state transition from RUNNING to INITIALIZING blocked');

  execModel.advanceCycle(5);
  assert(execModel.getCycleCount() === 1, 'Cycle count incremented to 1');
  assert(execModel.getInstructionsExecuted() === 5, 'Instructions executed advanced to 5');
  assert(execModel.getVirtualTimestamp() === 10, 'Virtual timestamp advanced to 10 ticks');

  // Test instruction quota exhaustion
  let quotaCaught = false;
  try {
    execModel.advanceCycle(100); // 5 + 100 > 100 max
  } catch (err: any) {
    quotaCaught = true;
    assert(err.message.includes('E7007'), 'Instruction quota error includes code E7007');
  }
  assert(quotaCaught, 'Instruction quota exhaustion triggers fail-closed error');
  assert(execModel.getState() === 'ERRORED', 'Runtime transitioned to ERRORED state');

  // Test call depth check
  let depthCaught = false;
  try {
    execModel.checkCallDepth(15); // > 10 max
  } catch (err: any) {
    depthCaught = true;
    assert(err.message.includes('E7006'), 'Call depth error includes code E7006');
  }
  assert(depthCaught, 'Call depth exceeded check throws E7006');

  console.log('  Gate 1 Passed: Execution model & lifecycle transitions verified.\n');

  // ===========================================================================
  // GATE 2: Native Values Domain & Structural Equality
  // ===========================================================================
  console.log('[Gate 2] Verifying Native Values Domain & Structural Equality...');
  const vNull = createNull();
  const vBool = createBool(true);
  const vInt = createInt(42);
  const vFloat = createFloat(3.14159);
  const vStr = createString('CUBiO');
  const vArr = createArray([createInt(1), createInt(2), createInt(3)]);
  const vRec = createRecord({
    name: createString('Core'),
    active: createBool(true),
    metric: createFloat(0.369),
  });
  const vCoord = createSpatialCoord(3, 4, 5);
  const vAddr = createCanonicalAddress(197);

  assert(vNull.kind === 'null' && vNull.value === null, 'createNull creates valid null value');
  assert(vBool.kind === 'bool' && vBool.value === true, 'createBool creates valid boolean');
  assert(vInt.kind === 'int' && vInt.value === 42, 'createInt creates integer');
  assert(vFloat.kind === 'float' && vFloat.value === 3.14159, 'createFloat creates float');
  assert(vStr.kind === 'string' && vStr.value === 'CUBiO', 'createString creates string');
  assert(vArr.kind === 'array' && (vArr.value as any[]).length === 3, 'createArray creates array');
  assert(vRec.kind === 'record' && 'name' in (vRec.value as any), 'createRecord creates record');
  assert(vCoord.kind === 'spatial_coord', 'createSpatialCoord creates spatial_coord');
  assert(vAddr.kind === 'canonical_address' && vAddr.value === 197, 'createCanonicalAddress creates address');

  // Spatial boundaries
  let coordErrorCaught = false;
  try {
    createSpatialCoord(7, 0, 0); // Out of bounds > 6
  } catch (err: any) {
    coordErrorCaught = true;
    assert(err.message.includes('E7012'), 'Spatial coord error includes E7012');
  }
  assert(coordErrorCaught, 'Spatial coord > 6 rejected');

  let addrErrorCaught = false;
  try {
    createCanonicalAddress(400); // Out of bounds > 368
  } catch (err: any) {
    addrErrorCaught = true;
    assert(err.message.includes('E7013'), 'Canonical address error includes E7013');
  }
  assert(addrErrorCaught, 'Canonical address > 368 rejected');

  // Structural Deep Equality
  const vArrCopy = createArray([createInt(1), createInt(2), createInt(3)]);
  const vArrDiff = createArray([createInt(1), createInt(2), createInt(4)]);
  assert(isEqual(vArr, vArrCopy), 'Deep equality matches identical arrays');
  assert(!isEqual(vArr, vArrDiff), 'Deep equality detects differing elements');

  const vRecCopy = createRecord({
    name: createString('Core'),
    active: createBool(true),
    metric: createFloat(0.369),
  });
  assert(isEqual(vRec, vRecCopy), 'Deep equality matches identical records');

  // Truthiness
  assert(!isTruthy(vNull), 'Null is falsy');
  assert(!isTruthy(createBool(false)), 'false is falsy');
  assert(!isTruthy(createInt(0)), '0 is falsy');
  assert(!isTruthy(createString('')), 'Empty string is falsy');
  assert(isTruthy(vInt), '42 is truthy');
  assert(isTruthy(vStr), 'Non-empty string is truthy');

  // Formatting & Raw Conversion
  assert(formatNativeValue(vInt) === '42', 'formatNativeValue formats int');
  assert(formatNativeValue(vCoord) === '@Coord(3, 4, 5)', 'formatNativeValue formats coord');
  assert(formatNativeValue(vAddr) === 'Address369[197]', 'formatNativeValue formats address');

  const rawRoundtrip = toRaw(vRec);
  const packedBack = fromRaw(rawRoundtrip);
  assert(isEqual(vRec, packedBack), 'toRaw -> fromRaw roundtrip preserves structural integrity');

  console.log('  Gate 2 Passed: Native values domain & structural equality verified.\n');

  // ===========================================================================
  // GATE 3: State Management, RSS Memory Ceilings & Snapshots
  // ===========================================================================
  console.log('[Gate 3] Verifying State Management, RSS Memory Ceilings & Snapshots...');
  const state = new NativeRuntimeState(512); // 512 MB ceiling

  // Variables & registers
  state.setVariable('alpha', createInt(100));
  assert(isEqual(state.getVariable('alpha'), createInt(100)), 'Global variable stored & retrieved');

  state.setRegister('r1', createFloat(0.5));
  assert(isEqual(state.getRegister('r1'), createFloat(0.5)), 'Global register stored & retrieved');

  // Call Frame Scoping
  state.pushCallFrame('testFn', 42, 'r0');
  assert(state.getCallDepth() === 1, 'Call depth is 1 after pushCallFrame');

  state.setVariable('localVal', createString('insideFrame'));
  assert(state.hasVariable('localVal'), 'Local variable exists in active frame');
  assert(state.hasVariable('alpha'), 'Global variable still accessible in active frame');

  state.setRegister('r1', createFloat(9.99)); // Shadows global r1
  assert(isEqual(state.getRegister('r1'), createFloat(9.99)), 'Frame register shadows global register');

  const popped = state.popCallFrame();
  assert(popped.fnName === 'testFn' && popped.returnPC === 42, 'Popped frame matches expectations');
  assert(state.getCallDepth() === 0, 'Call depth is 0 after popCallFrame');
  assert(!state.hasVariable('localVal'), 'Local variable out of scope after frame pop');
  assert(isEqual(state.getRegister('r1'), createFloat(0.5)), 'Global register value preserved');

  // RSS Memory Allocation & Bounding
  state.allocateMemory(16 * 1024 * 1024, 'TestTensor1');
  assert(state.getRssAllocatedMb() === 16, 'Allocated 16 MB tracked by state');

  let oomCaught = false;
  try {
    state.allocateMemory(500 * 1024 * 1024, 'OOM_Attempt'); // 16 + 500 > 512 MB ceiling
  } catch (err: any) {
    oomCaught = true;
    assert(err.message.includes('E7011'), 'OOM error includes code E7011');
  }
  assert(oomCaught, 'Allocation exceeding 512 MB ceiling rejected fail-closed');

  // Cryptographic State Snapshot & Bit-Exact Restore
  state.setVariable('beta', createString('snapshotPayload'));
  const snap1 = state.captureSnapshot(10);
  assert(snap1.snapshotHash.startsWith('0xSTATE_'), 'Snapshot hash generated');

  state.setVariable('beta', createString('mutatedPayload'));
  const snap2 = state.captureSnapshot(11);
  assert(snap1.snapshotHash !== snap2.snapshotHash, 'Mutated state produces distinct SHA-256 hash');

  state.restoreSnapshot(snap1);
  assert(
    isEqual(state.getVariable('beta'), createString('snapshotPayload')),
    'State restore recovered original variable value'
  );

  const snapRestored = state.captureSnapshot(10);
  assert(
    snapRestored.snapshotHash === snap1.snapshotHash,
    'Restored state produces bit-exact identical snapshot hash'
  );

  console.log('  Gate 3 Passed: State management, RSS memory ceilings & snapshots verified.\n');

  // ===========================================================================
  // GATE 4: Formal Error Catalog (E7001-E7014) & Fail-Closed Guards
  // ===========================================================================
  console.log('[Gate 4] Verifying Formal Error Catalog & Fail-Closed Guards...');
  const err1 = new OneNativeRuntimeError('E7001', 'Division by zero', 12, ['main()']);
  assert(err1.code === 'E7001' && err1.pc === 12, 'OneNativeRuntimeError captures code & pc');
  assert(err1.failClosed === true, 'OneNativeRuntimeError defaults failClosed to true');
  assert(err1.getDescriptor().category === 'ARITHMETIC', 'E7001 category is ARITHMETIC');

  const err10 = new OneNativeRuntimeError('E7010', 'Actuation locked', 50);
  assert(err10.getDescriptor().category === 'SECURITY', 'E7010 category is SECURITY');

  const err12 = new OneNativeRuntimeError('E7012', 'Coordinate out of bounds', 3);
  assert(err12.getDescriptor().category === 'SPATIAL', 'E7012 category is SPATIAL');

  // Test runtime interception of arithmetic division by zero
  const runtime = new NativeRuntime();
  const resDivZero = runtime.execute(`
    let a = 10;
    let b = 0;
    let c = a / b;
  `);
  assert(!resDivZero.success, 'Division by zero execution failed');
  assert(resDivZero.error?.code === 'E7001', 'Division by zero returned error code E7001');

  // Test undefined variable lookup
  const resUndefVar = runtime.execute(`
    let x = undeclaredVariable + 5;
  `);
  assert(!resUndefVar.success, 'Undefined variable lookup failed');
  assert(
    resUndefVar.error?.code === 'E7004' || resUndefVar.error?.code === 'E3004',
    'Undefined variable returned expected error code'
  );

  // Test out-of-bounds array access
  const resOOB = runtime.execute(`
    let arr = [10, 20];
    let bad = arr[5];
  `);
  assert(!resOOB.success, 'Out-of-bounds array access failed');
  assert(resOOB.error?.code === 'E7008', 'Out-of-bounds array access returned error code E7008');

  console.log('  Gate 4 Passed: Error catalog & fail-closed error handling verified.\n');

  // ===========================================================================
  // GATE 5: Sandboxed Native Core Modules
  // ===========================================================================
  console.log('[Gate 5] Verifying Sandboxed Native Core Modules...');
  const registry = new NativeModuleRegistry();

  assert(registry.hasModule('std:math'), 'Module std:math is registered');
  assert(registry.hasModule('std:string'), 'Module std:string is registered');
  assert(registry.hasModule('std:array'), 'Module std:array is registered');
  assert(registry.hasModule('std:spatial'), 'Module std:spatial is registered');
  assert(registry.hasModule('std:crypto'), 'Module std:crypto is registered');
  assert(registry.hasModule('std:system'), 'Module std:system is registered');

  // Math module tests
  const mathMod = registry.getModule('std:math')!;
  const fnSqrt = (mathMod.exports.sqrt.value as any).fn;
  assert(isEqual(fnSqrt(createFloat(25)), createFloat(5)), 'Math.sqrt(25) == 5');

  const fnClamp = (mathMod.exports.clamp.value as any).fn;
  assert(
    isEqual(fnClamp(createFloat(15), createFloat(0), createFloat(10)), createFloat(10)),
    'Math.clamp(15, 0, 10) == 10'
  );

  // String module tests
  const strMod = registry.getModule('std:string')!;
  const fnSplit = (strMod.exports.split.value as any).fn;
  const parts = fnSplit(createString('a,b,c'), createString(','));
  assert(parts.kind === 'array' && (parts.value as any[]).length === 3, 'String.split returns 3 elements');

  // Crypto module tests
  const cryptoMod = registry.getModule('std:crypto')!;
  const fnSha256 = (cryptoMod.exports.sha256.value as any).fn;
  const hash = fnSha256(createString('ONE_LANGUAGE'));
  assert(
    hash.kind === 'string' && (hash.value as string).length === 64,
    'Crypto.sha256 produces 64-char hex hash'
  );

  const fnPqcSeal = (cryptoMod.exports.pqcSeal.value as any).fn;
  const seal = fnPqcSeal(createString('SOVEREIGN_PAYLOAD'));
  assert(
    (seal.value as string).startsWith('0xPQC_369_') && (seal.value as string).endsWith('_SEAL'),
    'Crypto.pqcSeal produces 0xPQC_369_..._SEAL format'
  );

  const fnPqcVerify = (cryptoMod.exports.pqcVerify.value as any).fn;
  assert(
    isEqual(fnPqcVerify(seal), createBool(true)),
    'Crypto.pqcVerify verifies valid PQC seal'
  );

  console.log('  Gate 5 Passed: Native sandboxed modules verified.\n');

  // ===========================================================================
  // GATE 6: CUBiO Spatial & Canonical Address369 Integration
  // ===========================================================================
  console.log('[Gate 6] Verifying CUBiO Spatial & Canonical Address369 Integration...');
  const spatialBridge = new SpatialBridge({ actuationLock: true });
  assert(spatialBridge.isLocked() === true, 'SpatialBridge actuation lock defaults to true');

  // Canonical address 369 bijection tests
  assert(
    CanonicalAddress369.spatialCoordToCanonicalAddress(0, 0, 0) === 26,
    'Spatial origin (0,0,0) maps to canonical address 26'
  );
  assert(
    CanonicalAddress369.spatialCoordToCanonicalAddress(6, 6, 6) === 368,
    'Spatial corner (6,6,6) maps to canonical address 368'
  );
  assert(
    CanonicalAddress369.toDisplayIndex(26) === 27,
    'Canonical address 26 maps to UI Display Index 27'
  );
  assert(
    CanonicalAddress369.toDisplayIndex(368) === 369,
    'Canonical address 368 maps to UI Display Index 369'
  );

  const coord = CanonicalAddress369.canonicalAddressToSpatialCoord(197);
  assert(
    CanonicalAddress369.spatialCoordToCanonicalAddress(coord.i, coord.j, coord.k) === 197,
    'Address 197 coordinates roundtrip with 100% bijection'
  );

  // Read / Write under Actuation Lock
  assert(spatialBridge.get(3, 3, 3) === null, 'Uninitialized voxel reads null');

  let lockViolationCaught = false;
  try {
    spatialBridge.set(3, 3, 3, 99); // Blocked under lock
  } catch (err: any) {
    lockViolationCaught = true;
    assert(err.message.includes('Actuation lock is engaged'), 'Error states actuation lock is engaged');
  }
  assert(lockViolationCaught, 'Actuation lock prevents voxel write');

  // Inspect cell without triggering actuation lock
  const cellInfo = spatialBridge.inspect(3, 3, 3);
  assert(cellInfo.address === CanonicalAddress369.spatialCoordToCanonicalAddress(3, 3, 3), 'Inspected address matches');
  assert(cellInfo.displayIndex === CanonicalAddress369.toDisplayIndex(cellInfo.address), 'Inspected displayIndex matches');

  console.log('  Gate 6 Passed: CUBiO spatial & Address369 integration verified.\n');

  // ===========================================================================
  // GATE 7: End-to-End Program Execution & 100-Cycle Deterministic Replay (sigma^2 = 0.0)
  // ===========================================================================
  console.log('[Gate 7] Verifying End-to-End Execution & 100-Cycle Bit-Exact Replay...');
  const testProgram = `
    let base = 10;
    let factor = 3;
    let total = base * factor;

    function computeHarmonic(x, y) {
      let temp = x + y;
      return temp * 2;
    }

    let result = computeHarmonic(total, 6);
    print result;
  `;

  const runRes = runtime.execute(testProgram);
  assert(runRes.success, 'Program compiled and executed successfully');
  assert(runRes.output.length === 1 && runRes.output[0] === '72', 'Output matches expected: 72');
  assert(runRes.isActuationBlocked === true, 'Actuation lock remained blocked throughout execution');
  assert(runRes.rssAllocatedMb < 512, 'RSS memory consumption strictly within 512 MB ceiling');

  console.log('  Running 100-Cycle Deterministic Replay Validator...');
  const replayReport = runtime.verifyDeterminism(testProgram, 100);
  console.log(`    - Cycles Evaluated        : ${replayReport.cyclesEvaluated}`);
  console.log(`    - Baseline State Hash     : ${replayReport.baselineHash}`);
  console.log(`    - Replays Match Bit-Exact : ${replayReport.replaysMatch}`);
  console.log(`    - Stdout Output Matches   : ${replayReport.outputMatch}`);
  console.log(`    - Determinism Variance    : σ² = ${replayReport.sigmaSqVariance}`);
  console.log(`    - Actuation Lock Status   : ${replayReport.invariantActuationBlocked}`);

  assert(replayReport.certified === true, 'Replay certification passed');
  assert(replayReport.sigmaSqVariance === 0.0, 'Determinism variance is strictly σ² = 0.0');
  assert(replayReport.replaysMatch === true, 'All 100 snapshots matched with bit-for-bit identity');
  assert(replayReport.outputMatch === true, 'All 100 stdout streams matched bit-for-bit');
  assert(replayReport.invariantActuationBlocked === true, 'Fail-closed actuation lock preserved');

  console.log('  Gate 7 Passed: End-to-end execution & 100-cycle bit-exact replay certified.\n');

  // ===========================================================================
  // FINAL VERDICT
  // ===========================================================================
  console.log('================================================================================');
  console.log(` 🏆 TASK 01 FOUNDATIONAL NATIVE RUNTIME: 100% CERTIFIED & PASSED`);
  console.log(` 📊 Total Assertions Passed: ${passedAssertions} / ${totalAssertions}`);
  console.log(` 🔒 Safety Invariant        : FAIL-CLOSED ACTUATION LOCK VERIFIED`);
  console.log(` ⚡ Determinism            : σ² = 0.0 (BIT-EXACT DETERMINISTIC REPLAY)`);
  console.log('================================================================================\n');
}

runTask01VerificationSuite();
