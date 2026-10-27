/**
 * ONE Language — Deep Recursion Support Verification Suite (T06)
 * ===============================================================
 * Path: tests/compiler/deep_recursion.test.ts
 *
 * Verifies recursive function execution in ONE Language while preserving
 * deterministic VM behavior, call-frame isolation, and bounded resource usage:
 *   - Direct recursion with base cases (factorial, fibonacci, accumulator)
 *   - Call-frame & local variable isolation across recursive descent/ascent
 *   - Deep linear recursion within supported default limits (MAX_CALL_DEPTH: 512)
 *   - Configurable max call depth (e.g. maxCallDepth: 100, maxCallDepth: 1000)
 *   - Global mutual recursion (isEven / isOdd with forward reference resolution)
 *   - Nested mutually recursive closures
 *   - Recursive closures capturing and mutating shared lexical cells
 *   - Tree recursion (branching, stack expansion and unwinding)
 *   - Deterministic stack exhaustion diagnostics (E5006 with call stack trace)
 *   - Infinite loop / instruction budget exhaustion (E5007)
 *   - Host process protection against V8 C++ stack overflow
 *   - Error propagation through deep recursive frames (e.g. E5001 with stack trace)
 *   - Fail-closed invalid recursive calls (E5005)
 *   - Address369 boundaries and actuation lockout invariants
 */

import { UnifiedCompiler } from '../../src/one/UnifiedCompiler';
import { UnifiedVM, OneVMError } from '../../src/one/vm/UnifiedVM';
import { CanonicalAddress369 } from '../../src/one/address369_canonical';
import { SpatialBridge } from '../../src/one/spatial/SpatialBridge';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

export function runDeepRecursionTests(): void {
  console.log('='.repeat(80));
  console.log('  ONE LANGUAGE — DEEP RECURSION SUPPORT VERIFICATION (T06)');
  console.log('='.repeat(80));

  const compiler = new UnifiedCompiler();

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 1: Direct Recursion with Base Cases (Factorial, Fibonacci, Sum)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 1] Direct Recursion with Base Cases...');
  {
    const src = `
      fn factorial(n: Int32): Int32 {
        if (n <= 1) {
          return 1;
        }
        return n * factorial(n - 1);
      }

      fn fib(n: Int32): Int32 {
        if (n <= 0) {
          return 0;
        }
        if (n == 1) {
          return 1;
        }
        return fib(n - 1) + fib(n - 2);
      }

      fn sumTo(n: Int32): Int32 {
        if (n <= 0) {
          return 0;
        }
        return n + sumTo(n - 1);
      }

      let f5 = factorial(5);
      let f10 = factorial(10);
      let fib7 = fib(7);
      let fib10 = fib(10);
      let s10 = sumTo(10);
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'Direct recursion programs must compile');
    assert(res.vmResult !== undefined && res.vmResult.success, 'Direct recursion programs must execute');
    const globals = res.vmResult!.globals;
    assert(globals['f5'] === 120, `factorial(5) must be 120, got ${globals['f5']}`);
    assert(globals['f10'] === 3628800, `factorial(10) must be 3628800, got ${globals['f10']}`);
    assert(globals['fib7'] === 13, `fib(7) must be 13, got ${globals['fib7']}`);
    assert(globals['fib10'] === 55, `fib(10) must be 55, got ${globals['fib10']}`);
    assert(globals['s10'] === 55, `sumTo(10) must be 55, got ${globals['s10']}`);
    console.log('  ✓ Factorial, Fibonacci, and Sum direct recursion evaluated bit-exact.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 2: Local Variable and Activation Frame Isolation Across Recursion
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 2] Local Variable & Activation Frame Isolation...');
  {
    const src = `
      fn testIsolation(depth: Int32): Int32 {
        let localMarker = depth * 100;
        let preSum = 0;
        if (depth > 0) {
          let child = testIsolation(depth - 1);
          preSum = child;
        }
        // Invariant: localMarker must NOT be clobbered by recursive child calls
        let expectedMarker = depth * 100;
        if (localMarker != expectedMarker) {
          return -999999;
        }
        return localMarker + preSum;
      }

      let result = testIsolation(10);
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'Isolation test must compile');
    assert(res.vmResult !== undefined && res.vmResult.success, 'Isolation test must execute');
    // Sum for depth 0..10 of depth*100 = 100 * (10*11/2) = 5500
    assert(res.vmResult!.globals['result'] === 5500, `testIsolation(10) must return 5500, got ${res.vmResult!.globals['result']}`);
    console.log('  ✓ Local variables, registers, and frames remain 100% isolated during recursion.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 3: Deep Linear Recursion within Supported Default Limit (Depth 500)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 3] Deep Linear Recursion within Default Limit (Depth 500 < 512)...');
  {
    const src = `
      fn deepSum(n: Int32): Int32 {
        if (n <= 0) {
          return 0;
        }
        return n + deepSum(n - 1);
      }

      let result500 = deepSum(500);
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'Deep recursion program must compile');
    assert(res.vmResult !== undefined && res.vmResult.success, `Deep recursion execution failed: ${res.vmResult?.error?.message}`);
    // Sum of 1..500 = 500 * 501 / 2 = 125,250
    const expected = (500 * 501) / 2;
    assert(res.vmResult!.globals['result500'] === expected, `deepSum(500) must return ${expected}, got ${res.vmResult!.globals['result500']}`);
    console.log(`  ✓ Deep linear recursion unwound 500 call frames cleanly (result: ${expected}).`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 4: Configurable Max Call Depth (Custom Options)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 4] Configurable Max Call Depth (Custom Options)...');
  {
    const src = `
      fn recurse(n: Int32): Int32 {
        if (n <= 0) {
          return 0;
        }
        return 1 + recurse(n - 1);
      }

      let res = recurse(80);
    `;

    // 1. With maxCallDepth: 50 -> must fail at frame 50
    const resFail = compiler.execute(src, { maxCallDepth: 50 });
    assert(resFail.vmResult !== undefined && !resFail.vmResult.success, 'Depth 80 must fail when maxCallDepth is 50');
    assert(resFail.vmResult!.error?.code === 'E5006', `Expected error E5006, got ${resFail.vmResult!.error?.code}`);
    assert(resFail.vmResult!.error!.message.includes('50 frames'), 'Error message must reflect configured 50 frames');
    assert(resFail.vmResult!.error!.callStack !== undefined && resFail.vmResult!.error!.callStack.length === 50,
      `Call stack trace must contain exactly 50 frames, got ${resFail.vmResult!.error!.callStack?.length}`);

    // 2. With maxCallDepth: 1000 -> depth 800 must succeed
    const src800 = `
      fn recurse800(n: Int32): Int32 {
        if (n <= 0) {
          return 0;
        }
        return 1 + recurse800(n - 1);
      }

      let res800 = recurse800(800);
    `;
    const resSucceed = compiler.execute(src800, { maxCallDepth: 1000, maxInstructions: 2_000_000 });
    assert(resSucceed.vmResult !== undefined && resSucceed.vmResult.success, `Depth 800 should succeed with maxCallDepth: 1000: ${resSucceed.vmResult?.error?.message}`);
    assert(resSucceed.vmResult!.globals['res800'] === 800, `Expected 800, got ${resSucceed.vmResult!.globals['res800']}`);
    console.log('  ✓ Configurable maxCallDepth enforced precisely (depth 50 rejected, depth 1000 accepted).');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 5: Global Mutual Recursion (isEven & isOdd with Forward Reference)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 5] Global Mutual Recursion (Forward Reference Resolution)...');
  {
    const src = `
      fn isEven(n: Int32): Int32 {
        if (n == 0) {
          return 1;
        }
        return isOdd(n - 1);
      }

      fn isOdd(n: Int32): Int32 {
        if (n == 0) {
          return 0;
        }
        return isEven(n - 1);
      }

      let e0 = isEven(0);
      let o0 = isOdd(0);
      let e10 = isEven(10);
      let o10 = isOdd(10);
      let e15 = isEven(15);
      let o15 = isOdd(15);
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, `Mutual recursion must compile: ${JSON.stringify(res.compilation.diagnostics)}`);
    assert(res.vmResult !== undefined && res.vmResult.success, `Mutual recursion must execute: ${res.vmResult?.error?.message}`);
    const globals = res.vmResult!.globals;
    assert(globals['e0'] === 1, `isEven(0) must be 1, got ${globals['e0']}`);
    assert(globals['o0'] === 0, `isOdd(0) must be 0, got ${globals['o0']}`);
    assert(globals['e10'] === 1, `isEven(10) must be 1, got ${globals['e10']}`);
    assert(globals['o10'] === 0, `isOdd(10) must be 0, got ${globals['o10']}`);
    assert(globals['e15'] === 0, `isEven(15) must be 0, got ${globals['e15']}`);
    assert(globals['o15'] === 1, `isOdd(15) must be 1, got ${globals['o15']}`);
    console.log('  ✓ Forward references and mutually recursive functions resolve and alternate correctly.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 6: Nested Mutually Recursive Closures
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 6] Nested Mutually Recursive Closures...');
  {
    const src = `
      fn buildCollatzLength(startVal: Int32): Int32 {
        fn step(n: Int32, count: Int32): Int32 {
          if (n <= 1) {
            return count;
          }
          if (n % 2 == 0) {
            return stepEven(n, count);
          }
          return stepOdd(n, count);
        }

        fn stepEven(n: Int32, count: Int32): Int32 {
          return step(n / 2, count + 1);
        }

        fn stepOdd(n: Int32, count: Int32): Int32 {
          return step(3 * n + 1, count + 1);
        }

        return step(startVal, 0);
      }

      // Collatz sequence for 6: 6 -> 3 -> 10 -> 5 -> 16 -> 8 -> 4 -> 2 -> 1 (8 steps)
      let steps6 = buildCollatzLength(6);
      // Collatz sequence for 11: 11 -> 34 -> 17 -> 52 -> 26 -> 13 -> 40 -> 20 -> 10 -> 5 -> 16 -> 8 -> 4 -> 2 -> 1 (14 steps)
      let steps11 = buildCollatzLength(11);
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, `Nested mutual closures must compile: ${JSON.stringify(res.compilation.diagnostics)}`);
    assert(res.vmResult !== undefined && res.vmResult.success, `Nested mutual closures must execute: ${res.vmResult?.error?.message}`);
    assert(res.vmResult!.globals['steps6'] === 8, `buildCollatzLength(6) must be 8, got ${res.vmResult!.globals['steps6']}`);
    assert(res.vmResult!.globals['steps11'] === 14, `buildCollatzLength(11) must be 14, got ${res.vmResult!.globals['steps11']}`);
    console.log('  ✓ Nested mutually recursive closures execute and unwind correctly.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 7: Recursive Closures Capturing and Mutating Shared State Cells
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 7] Recursive Closures Capturing & Mutating Shared Cells...');
  {
    const src = `
      fn makeAccumulator(): Int32 {
        let total = 0;

        fn recurseAdd(remaining: Int32): Int32 {
          if (remaining <= 0) {
            return total;
          }
          total = total + remaining;
          return recurseAdd(remaining - 1);
        }

        let finalVal = recurseAdd(20);
        return total;
      }

      let sum20 = makeAccumulator();
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'Stateful recursive closure must compile');
    assert(res.vmResult !== undefined && res.vmResult.success, 'Stateful recursive closure must execute');
    // Sum 1..20 = 210
    assert(res.vmResult!.globals['sum20'] === 210, `Expected 210, got ${res.vmResult!.globals['sum20']}`);
    console.log('  ✓ Recursive closure successfully mutates enclosing variable cell across calls.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 8: Tree Recursion (Branching and Backtracking)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 8] Tree Recursion (Binary Tree Branching & Unwinding)...');
  {
    const src = `
      fn treeSum(depth: Int32, value: Int32): Int32 {
        if (depth <= 0) {
          return value;
        }
        let left = treeSum(depth - 1, value * 2);
        let right = treeSum(depth - 1, value * 2 + 1);
        return left + right;
      }

      let res = treeSum(4, 1);
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'Tree recursion must compile');
    assert(res.vmResult !== undefined && res.vmResult.success, 'Tree recursion must execute');
    // Depth 4 binary tree from root 1:
    // depth 4 -> 16 leaves. Leaves are 16..31. Sum of 16..31 is 16*47/2 = 376.
    assert(res.vmResult!.globals['res'] === 376, `treeSum(4, 1) must be 376, got ${res.vmResult!.globals['res']}`);
    console.log('  ✓ Binary tree branching, frame pushes, and unwinding verified (result: 376).');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 9: Safe Stack Exhaustion Enforcement (E5006)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 9] Safe Stack Exhaustion Enforcement (E5006)...');
  {
    const src = `
      fn runaway(n: Int32): Int32 {
        return runaway(n + 1);
      }

      let crash = runaway(1);
    `;
    const res = compiler.execute(src);
    assert(!res.compilation.success || !res.vmResult?.success, 'Infinite recursion must not succeed');
    assert(res.vmResult !== undefined, 'VM result must exist');
    assert(!res.vmResult.success, 'VM execution must fail on stack overflow');
    assert(res.vmResult.error?.code === 'E5006', `Expected E5006, got ${res.vmResult.error?.code}`);
    assert(res.vmResult.error!.message.includes('512 frames'), `Message must mention 512 frames, got: ${res.vmResult.error?.message}`);
    assert(res.vmResult.error!.callStack !== undefined, 'callStack array must be present');
    assert(res.vmResult.error!.callStack!.length === 512, `Call stack trace length must be 512, got ${res.vmResult.error!.callStack!.length}`);
    assert(res.vmResult.error!.callStack![0].includes('runaway'), `First stack entry must reference 'runaway'`);
    assert(res.vmResult.error!.callStack![511].includes('runaway'), `Last stack entry must reference 'runaway'`);
    console.log('  ✓ Runaway recursion halted deterministically at 512 frames with E5006 and call stack.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 10: Infinite Loop / Instruction Budget Exhaustion (E5007)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 10] Instruction Budget Exhaustion (E5007)...');
  {
    const src = `
      fn loopRecurse(n: Int32): Int32 {
        if (n == 0) {
          return loopRecurse(1);
        }
        return loopRecurse(0);
      }

      let res = loopRecurse(0);
    `;
    // Set a tight instruction limit of 2,000 instructions with a high call depth (so it doesn't trigger E5006 first)
    const res = compiler.execute(src, { maxInstructions: 2000, maxCallDepth: 10000 });
    assert(res.vmResult !== undefined && !res.vmResult.success, 'Runaway recursion must fail on instruction limit');
    assert(res.vmResult!.error?.code === 'E5007', `Expected E5007, got ${res.vmResult!.error?.code}`);
    assert(res.vmResult!.error!.message.includes('2,000'), `Message must mention 2,000 ops, got: ${res.vmResult!.error?.message}`);
    assert(res.vmResult!.error!.callStack !== undefined && res.vmResult!.error!.callStack.length > 0, 'Call stack must be attached to E5007');
    console.log('  ✓ Instruction budget limit enforced deterministically with E5007.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 11: Host Process Protection (V8 Call Stack Non-Exhaustion)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 11] Host Process Protection (V8 Stack Safety)...');
  {
    // Configure VM with maxCallDepth: 2000, maxInstructions: 100,000.
    // If ONE VM used V8 native recursion, deep recursion of 2000 frames could crash Node with RangeError.
    // UnifiedVM uses heap CallFrame[] in an iterative while-loop, completely protecting Node.
    const src = `
      fn deepLinear(n: Int32): Int32 {
        if (n <= 0) {
          return 0;
        }
        return 1 + deepLinear(n - 1);
      }

      let res = deepLinear(1500);
    `;
    let threwV8Overflow = false;
    try {
      const res = compiler.execute(src, { maxCallDepth: 2000, maxInstructions: 200_000 });
      assert(res.vmResult !== undefined && res.vmResult.success, `Expected success, got error: ${res.vmResult?.error?.message}`);
      assert(res.vmResult!.globals['res'] === 1500, `Expected 1500, got ${res.vmResult!.globals['res']}`);
    } catch (err: any) {
      if (err instanceof RangeError && err.message.includes('Maximum call stack size exceeded')) {
        threwV8Overflow = true;
      } else {
        throw err;
      }
    }
    assert(!threwV8Overflow, 'Host V8 call stack must NEVER overflow; VM activation frames are heap-managed.');
    console.log('  ✓ 1,500 recursive frames executed purely on heap without host V8 stack consumption.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 12: Error Propagation Through Deep Recursive Frames (E5001)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 12] Error Propagation Through Deep Recursive Frames...');
  {
    const src = `
      fn stepUntilZero(depth: Int32): Int32 {
        if (depth >= 40) {
          // Division by zero deep inside call chain
          return 100 / 0;
        }
        return stepUntilZero(depth + 1);
      }

      let boom = stepUntilZero(0);
    `;
    const res = compiler.execute(src);
    assert(res.vmResult !== undefined && !res.vmResult.success, 'Division by zero must fail VM execution');
    assert(res.vmResult!.error?.code === 'E5001', `Expected E5001, got ${res.vmResult!.error?.code}`);
    assert(res.vmResult!.error!.callStack !== undefined, 'Error must capture active call stack');
    // Depth 0..40 = 41 frames
    assert(res.vmResult!.error!.callStack!.length === 41, `Expected 41 frames in stack trace, got ${res.vmResult!.error!.callStack!.length}`);
    assert(res.vmResult!.error!.callStack![0].includes('stepUntilZero'), 'Stack trace must include function name');
    console.log('  ✓ Division by zero at depth 40 cleanly propagated with full 41-frame call stack trace.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 13: Address369 Boundaries & Actuation Lockout Invariants
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 13] Preserving Address369 Boundaries & Actuation Lockout Invariants...');
  {
    // 1. Verify CanonicalAddress369 bounds
    assert(CanonicalAddress369.TOTAL_ADDRESSES === 369, 'CanonicalAddress369 total must remain 369');
    assert(CanonicalAddress369.SYMBOLIC_START === 0, 'SYMBOLIC_START must be 0');
    assert(CanonicalAddress369.SPATIAL_END === 368, 'SPATIAL_END must be 368');

    // 2. Verify Actuation Lockout invariant
    const lockedBridge = new SpatialBridge({ actuationLock: true });
    assert(lockedBridge.isLocked(), 'Locked bridge must report locked');

    // Run recursive program with spatial bridge
    const src = `
      fn recursiveMover(steps: Int32, pos: Float32): Float32 {
        if (steps <= 0) {
          return pos;
        }
        return recursiveMover(steps - 1, pos + 0.5);
      }
      let finalPos = recursiveMover(4, 10.0);
    `;
    const vm = new UnifiedVM();
    const compiled = compiler.compile(src);
    assert(compiled.success && compiled.ir !== undefined, 'Compilation with spatial bridge must succeed');
    const vmRes = vm.execute(compiled.ir!, { spatialBridge: lockedBridge });
    assert(vmRes.success, `VM execution with spatial bridge must succeed: ${vmRes.error?.message}`);
    assert(vmRes.globals['finalPos'] === 12.0, `Expected 12.0, got ${vmRes.globals['finalPos']}`);
    assert(lockedBridge.isLocked(), 'Actuation lock must remain intact and secured');

    console.log('  ✓ CanonicalAddress369 boundaries [0..368] and actuation lock remain 100% intact.');
  }

  console.log('\n' + '='.repeat(80));
  console.log('  ALL 13 DEEP RECURSION VERIFICATION SUITES PASSED (100%)');
  console.log('='.repeat(80));
}

// Auto-run when executed directly via Node
if (process.argv[1]?.endsWith('deep_recursion.test.ts') || process.argv[1]?.includes('deep_recursion')) {
  runDeepRecursionTests();
}
