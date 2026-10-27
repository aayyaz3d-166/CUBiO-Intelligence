/**
 * ONE Language — Nested Function Closures Verification Suite (T05)
 * ================================================================
 * Path: tests/compiler/nested_closures.test.ts
 *
 * Verifies end-to-end compilation, scoping, capture analysis, IR lowering,
 * activation frame management, and VM execution for ONE Language closures:
 *   - Ordinary non-nested functions (baseline correctness)
 *   - Nested functions accessing outer scope parameters & locals
 *   - Multi-level nested closures (outer -> middle -> inner)
 *   - Returned closures escaping activation records (first-class closures)
 *   - Captured writes and stateful mutation across calls (capture-by-reference)
 *   - Multiple closures sharing the same mutable variable cell
 *   - Lexical shadowing (inner params & locals shadowing outer bindings)
 *   - Anonymous function expressions and first-class function values
 *   - Recursive closures and interaction with call frames
 *   - Resource limits (MAX_CALL_DEPTH: 512, MAX_INSTRUCTIONS: 1,000,000)
 *   - Fail-closed error handling (calling non-function, undefined identifier)
 *   - Address369 boundaries and actuation lockout preservation
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

export function runNestedClosureTests(): void {
  console.log('='.repeat(80));
  console.log('  ONE LANGUAGE — NESTED FUNCTION CLOSURES VERIFICATION (T05)');
  console.log('='.repeat(80));

  const compiler = new UnifiedCompiler();

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 1: Ordinary Non-Nested Functions (Preserve Baseline)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 1] Ordinary Non-Nested Functions (Preserve Baseline)...');
  {
    const src = `
      fn add(a: Int32, b: Int32): Int32 {
        return a + b;
      }

      fn multiply(x: Int32, y: Int32): Int32 {
        return x * y;
      }

      let sum = add(12, 34);
      let prod = multiply(6, 7);
      print sum;
      print prod;
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'Ordinary functions must compile');
    assert(res.vmResult !== undefined && res.vmResult.success, 'Ordinary functions must execute');
    assert(res.vmResult!.output[0] === '46', `Expected 46, got ${res.vmResult!.output[0]}`);
    assert(res.vmResult!.output[1] === '42', `Expected 42, got ${res.vmResult!.output[1]}`);
    console.log('  ✓ Ordinary functions execute with correct parameters and return values.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 2: Basic Nested Function Accessing Enclosing Scope
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 2] Basic Nested Function Accessing Enclosing Scope...');
  {
    const src = `
      fn outer(x: Int32): Int32 {
        let y = 100;
        fn inner(z: Int32): Int32 {
          return x + y + z;
        }
        return inner(5);
      }

      let res = outer(50);
      print res;
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'Nested function script must compile');
    assert(res.vmResult !== undefined && res.vmResult.success, 'Nested function script must execute');
    assert(res.vmResult!.output[0] === '155', `Expected 155, got ${res.vmResult!.output[0]}`);
    console.log('  ✓ Inner function accesses outer parameter and local variable directly.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 3: Deeply Nested Closures (3 Levels)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 3] Deeply Nested Closures (3 Levels)...');
  {
    const src = `
      fn level1(a: Int32): Int32 {
        let b = 20;
        fn level2(c: Int32): Int32 {
          let d = 30;
          fn level3(e: Int32): Int32 {
            return a + b + c + d + e;
          }
          return level3(5);
        }
        return level2(10);
      }

      let total = level1(1);
      print total;
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, '3-level nested closure must compile');
    assert(res.vmResult !== undefined && res.vmResult.success, '3-level nested closure must execute');
    // 1 + 20 + 10 + 30 + 5 = 66
    assert(res.vmResult!.output[0] === '66', `Expected 66, got ${res.vmResult!.output[0]}`);
    console.log('  ✓ 3-level nested closure captures and evaluates bindings across all frames.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 4: Returned Closures Escaping Activation Frame
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 4] Returned Closures Escaping Activation Frame...');
  {
    const src = `
      fn makeAdder(x: Int32) {
        fn add(y: Int32): Int32 {
          return x + y;
        }
        return add;
      }

      let add10 = makeAdder(10);
      let add50 = makeAdder(50);

      let r1 = add10(3);
      let r2 = add10(7);
      let r3 = add50(5);

      print r1;
      print r2;
      print r3;
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'Returned closure must compile');
    assert(res.vmResult !== undefined && res.vmResult.success, 'Returned closure must execute');
    assert(res.vmResult!.output[0] === '13', `Expected 13, got ${res.vmResult!.output[0]}`);
    assert(res.vmResult!.output[1] === '17', `Expected 17, got ${res.vmResult!.output[1]}`);
    assert(res.vmResult!.output[2] === '55', `Expected 55, got ${res.vmResult!.output[2]}`);
    console.log('  ✓ Returned closures outlive enclosing activation frames with isolated environments.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 5: Captured Writes & Stateful Mutation Across Calls
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 5] Captured Writes & Stateful Mutation Across Calls...');
  {
    const src = `
      fn makeCounter(initial: Int32) {
        let count = initial;
        fn increment(): Int32 {
          count = count + 1;
          return count;
        }
        return increment;
      }

      let c1 = makeCounter(0);
      let c2 = makeCounter(100);

      let a = c1();
      let b = c1();
      let c = c1();

      let x = c2();
      let y = c2();

      print a;
      print b;
      print c;
      print x;
      print y;
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'Stateful counter must compile');
    assert(res.vmResult !== undefined && res.vmResult.success, 'Stateful counter must execute');
    assert(res.vmResult!.output[0] === '1', `Expected 1, got ${res.vmResult!.output[0]}`);
    assert(res.vmResult!.output[1] === '2', `Expected 2, got ${res.vmResult!.output[1]}`);
    assert(res.vmResult!.output[2] === '3', `Expected 3, got ${res.vmResult!.output[2]}`);
    assert(res.vmResult!.output[3] === '101', `Expected 101, got ${res.vmResult!.output[3]}`);
    assert(res.vmResult!.output[4] === '102', `Expected 102, got ${res.vmResult!.output[4]}`);
    console.log('  ✓ Captured writes update shared cell; distinct instances hold independent state.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 6: Multiple Closures Sharing the Same Variable Cell
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 6] Multiple Closures Sharing the Same Variable Cell...');
  {
    const src = `
      fn makeBank(initial: Int32) {
        let balance = initial;
        fn deposit(amount: Int32): Int32 {
          balance = balance + amount;
          return balance;
        }
        fn withdraw(amount: Int32): Int32 {
          balance = balance - amount;
          return balance;
        }
        fn getBalance(): Int32 {
          return balance;
        }
        return { deposit: deposit, withdraw: withdraw, getBalance: getBalance };
      }

      let bank = makeBank(100);
      let d = bank.deposit(50);
      let w = bank.withdraw(30);
      let bal = bank.getBalance();

      print d;
      print w;
      print bal;
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'Shared state closures must compile');
    assert(res.vmResult !== undefined && res.vmResult.success, 'Shared state closures must execute');
    assert(res.vmResult!.output[0] === '150', `Expected 150, got ${res.vmResult!.output[0]}`);
    assert(res.vmResult!.output[1] === '120', `Expected 120, got ${res.vmResult!.output[1]}`);
    assert(res.vmResult!.output[2] === '120', `Expected 120, got ${res.vmResult!.output[2]}`);
    console.log('  ✓ Multiple closures dispatched from struct/record share the same underlying cell.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 7: Outer Function Mutating Variable After Closure Declaration
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 7] Outer Function Mutating Variable After Closure Declaration...');
  {
    const src = `
      fn testLateBinding(): Int32 {
        let x = 10;
        fn getX(): Int32 {
          return x;
        }
        x = 999;
        return getX();
      }

      let res = testLateBinding();
      print res;
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'Late mutation script must compile');
    assert(res.vmResult !== undefined && res.vmResult.success, 'Late mutation script must execute');
    assert(res.vmResult!.output[0] === '999', `Expected 999, got ${res.vmResult!.output[0]}`);
    console.log('  ✓ Closures observe post-declaration mutations made by enclosing function.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 8: Lexical Variable & Parameter Shadowing
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 8] Lexical Variable & Parameter Shadowing...');
  {
    const src = `
      fn outer(x: Int32): Int32 {
        fn innerParam(x: Int32): Int32 {
          return x * 10;
        }
        fn innerLocal(): Int32 {
          let x = 777;
          return x;
        }

        let p = innerParam(5);
        let l = innerLocal();
        return x + p + l;
      }

      let res = outer(3);
      print res;
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'Shadowing script must compile');
    assert(res.vmResult !== undefined && res.vmResult.success, 'Shadowing script must execute');
    // x (3) + p (50) + l (777) = 830
    assert(res.vmResult!.output[0] === '830', `Expected 830, got ${res.vmResult!.output[0]}`);
    console.log('  ✓ Inner parameters and local variables shadow outer variables without leakage.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 9: Anonymous Function Expressions & First-Class Function Values
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 9] Anonymous Function Expressions & First-Class Function Values...');
  {
    const src = `
      let square = fn(n: Int32): Int32 {
        return n * n;
      };

      fn applyTwice(f: any, val: Int32): Int32 {
        return f(f(val));
      }

      let res = applyTwice(square, 3);
      print res;
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'Anonymous function expression must compile');
    assert(res.vmResult !== undefined && res.vmResult.success, 'Anonymous function expression must execute');
    // square(3) = 9; square(9) = 81
    assert(res.vmResult!.output[0] === '81', `Expected 81, got ${res.vmResult!.output[0]}`);
    console.log('  ✓ Anonymous functions passed as first-class values and invoked correctly.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 10: Nested Closure Recursion
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 10] Nested Closure Recursion...');
  {
    const src = `
      fn computeFactorial(n: Int32): Int32 {
        let baseMultiplier = 1;
        fn fact(x: Int32): Int32 {
          if (x <= 1) {
            return baseMultiplier;
          }
          return x * fact(x - 1);
        }
        return fact(n);
      }

      let res5 = computeFactorial(5);
      let res6 = computeFactorial(6);
      print res5;
      print res6;
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'Nested recursive closure must compile');
    assert(res.vmResult !== undefined && res.vmResult.success, 'Nested recursive closure must execute');
    assert(res.vmResult!.output[0] === '120', `Expected 120, got ${res.vmResult!.output[0]}`);
    assert(res.vmResult!.output[1] === '720', `Expected 720, got ${res.vmResult!.output[1]}`);
    console.log('  ✓ Nested recursive closures correctly invoke themselves and access captures.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 11: Call Stack Limit Enforcement (E5006)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 11] Call Stack Limit Enforcement (E5006)...');
  {
    const src = `
      fn infiniteRecursion(n: Int32): Int32 {
        fn recurse(k: Int32): Int32 {
          return recurse(k + 1);
        }
        return recurse(n);
      }

      infiniteRecursion(1);
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'Stack overflow script compiles');
    assert(!res.vmResult?.success, 'VM execution must fail on call stack overflow');
    assert(res.vmResult?.error?.code === 'E5006', `Expected error E5006, got ${res.vmResult?.error?.code}`);
    console.log('  ✓ Exceeding maximum call depth (512 frames) throws OneVMError E5006.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 12: Resource & Infinite Loop Limit (E5007)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 12] Resource & Infinite Loop Limit (E5007)...');
  {
    const src = `
      fn busyClosure(): Int32 {
        let i = 0;
        fn spin() {
          while (true) {
            i = i + 1;
          }
        }
        spin();
        return i;
      }

      busyClosure();
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'Busy closure script compiles');
    assert(!res.vmResult?.success, 'VM execution must fail on instruction limit');
    assert(res.vmResult?.error?.code === 'E5007', `Expected error E5007, got ${res.vmResult?.error?.code}`);
    console.log('  ✓ Exceeding maximum instruction limit (1,000,000 instructions) throws OneVMError E5007.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 13: Fail-Closed Diagnostics (E5005 & E3004)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 13] Fail-Closed Diagnostics (E5005 & E3004)...');
  {
    // Calling non-function value throws E5005
    const nonCallableSrc = `
      fn testBadCall() {
        let notAFn = 42;
        notAFn();
      }
      testBadCall();
    `;
    const res1 = compiler.execute(nonCallableSrc);
    assert(!res1.vmResult?.success, 'Calling non-function must fail');
    assert(res1.vmResult?.error?.code === 'E5005', `Expected E5005, got ${res1.vmResult?.error?.code}`);

    // Calling undefined function throws E5005
    const undefinedFnSrc = `
      fn testUndefined() {
        unknownFunction();
      }
      testUndefined();
    `;
    const res2 = compiler.execute(undefinedFnSrc);
    assert(!res2.compilation.success || !res2.vmResult?.success, 'Undefined function must fail');

    console.log('  ✓ Calling non-function values and undefined functions fails safely with E5005.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 14: Preserving Address369 Boundaries & Actuation Lock
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 14] Preserving Address369 Boundaries & Actuation Lock...');
  {
    // Ensure Address369 boundaries are unchanged
    assert(CanonicalAddress369.TOTAL_ADDRESSES === 369, 'CanonicalAddress369 total must remain 369');
    assert(CanonicalAddress369.SYMBOLIC_START === 0, 'SYMBOLIC_START must be 0');
    assert(CanonicalAddress369.SPATIAL_END === 368, 'SPATIAL_END must be 368');

    // Ensure actuation lock remains secure across closure invocations
    const bridge = new SpatialBridge({ actuationLock: true });
    assert(bridge.isLocked(), 'Actuation lock must be active');

    // Run closure program using spatial bridge
    const src = `
      fn makeMover(dx: f32) {
        fn move(origin: f32): f32 {
          return origin + dx;
        }
        return move;
      }
      let mover = makeMover(0.5);
      let finalPos = mover(1.0);
      print finalPos;
    `;
    const vm = new UnifiedVM();
    const compiled = compiler.compile(src);
    assert(compiled.success && compiled.ir !== undefined, 'Compilation with spatial bridge must succeed');
    const vmRes = vm.execute(compiled.ir!, { spatialBridge: bridge });
    assert(vmRes.success, 'VM execution with spatial bridge must succeed');
    assert(vmRes.output[0] === '1.5', `Expected 1.5, got ${vmRes.output[0]}`);
    assert(bridge.isLocked(), 'Actuation lock must remain intact and secured');

    console.log('  ✓ Address369 canonical boundaries and actuation lock remain 100% intact.');
  }

  console.log('\n' + '='.repeat(80));
  console.log('  ALL 14 NESTED CLOSURE VERIFICATION SUITES PASSED (100%)');
  console.log('='.repeat(80));
}

// Auto-execute if invoked as entrypoint
runNestedClosureTests();
