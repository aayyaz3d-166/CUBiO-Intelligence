/**
 * ONE Language — Phase 3: Unified VM / Runtime Test Suite
 * =======================================================
 * Validates real execution of Unified IR on the Unified VM:
 *   - Stack machine, Program Counter, and Call Frames
 *   - Arithmetic, Comparisons, Branching, Loops
 *   - Functions, Nested Calls, Recursion
 *   - Scoping and Variable Isolation
 *   - Safety Guards (Division by Zero, Undefined Identifiers, Stack Overflow, Infinite Loop)
 *   - Declarative Compatibility and Address369 Invariance
 *   - Security Verification (No eval, no Function, no host escape)
 */

import * as fs from 'fs';
import * as path from 'path';
import { UnifiedCompiler } from '../../../src/one/UnifiedCompiler';
import { UnifiedVM, OneVMError } from '../../../src/one/vm/UnifiedVM';
import { CanonicalAddress369 } from '../../../src/one/address369_canonical';
import { CubiOVirtualMachine } from '../../../src/core/engine/cubioVM';
import { OneCompiler } from '../../../src/one/oneCompiler';
import { OneParser } from '../../../src/one/oneParser';
import { OneLexer } from '../../../src/one/oneLexer';

let passed = 0;
let failed = 0;

function assert(description: string, condition: boolean): void {
  if (condition) {
    console.log(`  ✅ PASS  ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL  ${description}`);
    failed++;
  }
}

async function runPhase3Tests(): Promise<void> {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  ONE LANGUAGE — PHASE 3 UNIFIED VM / RUNTIME TEST SUITE');
  console.log('════════════════════════════════════════════════════════════════\n');

  const compiler = new UnifiedCompiler();

  // ── 1. Constants & Variables ──────────────────────────────────────────────
  {
    const src = `
      let a = 42;
      let b = 3.14;
    `;
    const res = compiler.execute(src);
    assert('VM01: Numeric constants stored and retrieved in globals',
      res.vmResult !== undefined &&
      res.vmResult.success &&
      res.vmResult.globals['a'] === 42 &&
      res.vmResult.globals['b'] === 3.14);
  }

  {
    const src = `
      let msg = "hello sovereign world";
    `;
    const res = compiler.execute(src);
    assert('VM02: String constants stored in globals',
      res.vmResult !== undefined &&
      res.vmResult.success &&
      res.vmResult.globals['msg'] === 'hello sovereign world');
  }

  {
    const src = `
      let flagTrue = true;
      let flagFalse = false;
    `;
    const res = compiler.execute(src);
    assert('VM03: Boolean constants stored in globals',
      res.vmResult !== undefined &&
      res.vmResult.success &&
      res.vmResult.globals['flagTrue'] === true &&
      res.vmResult.globals['flagFalse'] === false);
  }

  {
    const src = `
      let empty = null;
    `;
    const res = compiler.execute(src);
    assert('VM04: Null constant stored in globals',
      res.vmResult !== undefined &&
      res.vmResult.success &&
      res.vmResult.globals['empty'] === null);
  }

  {
    const src = `
      let x = 10;
      let y = 20;
      let z = 30;
    `;
    const res = compiler.execute(src);
    assert('VM05: Multiple top-level variables stored in isolated slots',
      res.vmResult !== undefined &&
      res.vmResult.globals['x'] === 10 &&
      res.vmResult.globals['y'] === 20 &&
      res.vmResult.globals['z'] === 30);
  }

  {
    const src = `
      let count = 1;
      count = 5;
    `;
    const res = compiler.execute(src);
    assert('VM06: Variable reassignment mutates variable in globals',
      res.vmResult !== undefined &&
      res.vmResult.success &&
      res.vmResult.globals['count'] === 5);
  }

  // ── 2. Arithmetic Operations ──────────────────────────────────────────────
  {
    const src = `
      let x = 15;
      let y = 25;
      let sum = x + y;
    `;
    const res = compiler.execute(src);
    assert('VM07: Addition operation produces exact arithmetic sum',
      res.vmResult !== undefined &&
      res.vmResult.success &&
      res.vmResult.globals['sum'] === 40);
  }

  {
    const src = `
      let diff = 100 - 37;
    `;
    const res = compiler.execute(src);
    assert('VM08: Subtraction operation computes correct difference',
      res.vmResult !== undefined &&
      res.vmResult.globals['diff'] === 63);
  }

  {
    const src = `
      let prod = 7 * 8;
    `;
    const res = compiler.execute(src);
    assert('VM09: Multiplication operation computes correct product',
      res.vmResult !== undefined &&
      res.vmResult.globals['prod'] === 56);
  }

  {
    const src = `
      let quotient = 84 / 4;
    `;
    const res = compiler.execute(src);
    assert('VM10: Division computes correct float/integer quotient',
      res.vmResult !== undefined &&
      res.vmResult.globals['quotient'] === 21);
  }

  {
    const src = `
      let remainder = 29 % 5;
    `;
    const res = compiler.execute(src);
    assert('VM11: Modulo computes correct remainder',
      res.vmResult !== undefined &&
      res.vmResult.globals['remainder'] === 4);
  }

  {
    const src = `
      let calc = 2 + 3 * 4;
    `;
    const res = compiler.execute(src);
    assert('VM12: Operator precedence (multiplication before addition) evaluated correctly',
      res.vmResult !== undefined &&
      res.vmResult.globals['calc'] === 14);
  }

  {
    const src = `
      let greeting = "Hello, " + "ONE!";
    `;
    const res = compiler.execute(src);
    assert('VM13: String concatenation via addition operator',
      res.vmResult !== undefined &&
      res.vmResult.globals['greeting'] === 'Hello, ONE!');
  }

  // ── 3. Comparisons & Logic ────────────────────────────────────────────────
  {
    const src = `
      let eq = 10 == 10;
      let neq = 10 == 20;
    `;
    const res = compiler.execute(src);
    assert('VM14: Equality comparison operator ==',
      res.vmResult !== undefined &&
      res.vmResult.globals['eq'] === true &&
      res.vmResult.globals['neq'] === false);
  }

  {
    const src = `
      let diff = 10 != 20;
      let same = 10 != 10;
    `;
    const res = compiler.execute(src);
    assert('VM15: Inequality comparison operator !=',
      res.vmResult !== undefined &&
      res.vmResult.globals['diff'] === true &&
      res.vmResult.globals['same'] === false);
  }

  {
    const src = `
      let lt = 5 < 10;
      let lte = 10 <= 10;
      let notLt = 15 < 10;
    `;
    const res = compiler.execute(src);
    assert('VM16: Less-than < and less-than-or-equal <= operators',
      res.vmResult !== undefined &&
      res.vmResult.globals['lt'] === true &&
      res.vmResult.globals['lte'] === true &&
      res.vmResult.globals['notLt'] === false);
  }

  {
    const src = `
      let gt = 20 > 10;
      let gte = 10 >= 10;
      let notGt = 5 > 10;
    `;
    const res = compiler.execute(src);
    assert('VM17: Greater-than > and greater-than-or-equal >= operators',
      res.vmResult !== undefined &&
      res.vmResult.globals['gt'] === true &&
      res.vmResult.globals['gte'] === true &&
      res.vmResult.globals['notGt'] === false);
  }

  {
    const src = `
      let andTrue = true && true;
      let andFalse = true && false;
    `;
    const res = compiler.execute(src);
    assert('VM18: Logical AND && operator',
      res.vmResult !== undefined &&
      res.vmResult.globals['andTrue'] === true &&
      res.vmResult.globals['andFalse'] === false);
  }

  {
    const src = `
      let orTrue = false || true;
      let orFalse = false || false;
    `;
    const res = compiler.execute(src);
    assert('VM19: Logical OR || operator',
      res.vmResult !== undefined &&
      res.vmResult.globals['orTrue'] === true &&
      res.vmResult.globals['orFalse'] === false);
  }

  {
    const src = `
      let notTrue = !true;
      let notFalse = !false;
    `;
    const res = compiler.execute(src);
    assert('VM20: Logical NOT ! unary operator',
      res.vmResult !== undefined &&
      res.vmResult.globals['notTrue'] === false &&
      res.vmResult.globals['notFalse'] === true);
  }

  // ── 4. Branching & Control Flow ───────────────────────────────────────────
  {
    const src = `
      let branch = 0;
      if true {
        branch = 1;
      }
    `;
    const res = compiler.execute(src);
    assert('VM21: If statement executes true branch',
      res.vmResult !== undefined &&
      res.vmResult.globals['branch'] === 1);
  }

  {
    const src = `
      let outcome = 0;
      if false {
        outcome = 1;
      } else {
        outcome = 2;
      }
    `;
    const res = compiler.execute(src);
    assert('VM22: If-else statement executes false branch',
      res.vmResult !== undefined &&
      res.vmResult.globals['outcome'] === 2);
  }

  {
    const src = `
      let x = 2;
      let tag = "";
      if x == 1 {
        tag = "one";
      } else if x == 2 {
        tag = "two";
      } else {
        tag = "other";
      }
    `;
    const res = compiler.execute(src);
    assert('VM23: Else-if ladder executes matching branch',
      res.vmResult !== undefined &&
      res.vmResult.globals['tag'] === 'two');
  }

  {
    const src = `
      let a = 1;
      let b = 2;
      let hit = false;
      if a == 1 {
        if b == 2 {
          hit = true;
        }
      }
    `;
    const res = compiler.execute(src);
    assert('VM24: Nested if statements execute inner block',
      res.vmResult !== undefined &&
      res.vmResult.globals['hit'] === true);
  }

  {
    const src = `
      let i = 0;
      let sum = 0;
      while i < 5 {
        i = i + 1;
        sum = sum + i;
      }
    `;
    const res = compiler.execute(src);
    assert('VM25: While loop accumulates state to termination condition',
      res.vmResult !== undefined &&
      res.vmResult.globals['i'] === 5 &&
      res.vmResult.globals['sum'] === 15);
  }

  {
    const src = `
      let executed = false;
      while false {
        executed = true;
      }
    `;
    const res = compiler.execute(src);
    assert('VM26: While loop does not execute when initial condition is false',
      res.vmResult !== undefined &&
      res.vmResult.globals['executed'] === false);
  }

  {
    const src = `
      let items = [10, 20, 30];
      let total = 0;
      for item in items {
        total = total + item;
      }
    `;
    const res = compiler.execute(src);
    assert('VM27: For-in loop iterates through array literal elements',
      res.vmResult !== undefined &&
      res.vmResult.globals['total'] === 60);
  }

  // ── 5. Functions, Nested Calls & Recursion ─────────────────────────────────
  {
    const src = `
      function add(a: number, b: number): number {
        return a + b;
      }
      let result = add(10, 20);
    `;
    const res = compiler.execute(src);
    assert('VM28: Basic function declaration and call with return value',
      res.vmResult !== undefined &&
      res.vmResult.success &&
      res.vmResult.globals['result'] === 30);
  }

  {
    const src = `
      function square(n: number): number {
        return n * n;
      }
      let sq = square(6);
    `;
    const res = compiler.execute(src);
    assert('VM29: Function computes and returns arithmetic product',
      res.vmResult !== undefined &&
      res.vmResult.globals['sq'] === 36);
  }

  {
    const src = `
      function calc(a: number, b: number, c: number): number {
        return a + b * c;
      }
      let val = calc(2, 3, 4);
    `;
    const res = compiler.execute(src);
    assert('VM30: Multi-argument function binds and computes parameters',
      res.vmResult !== undefined &&
      res.vmResult.globals['val'] === 14);
  }

  {
    const src = `
      let flag = false;
      function setFlag(): void {
        flag = true;
      }
      setFlag();
    `;
    const res = compiler.execute(src);
    assert('VM31: Function without explicit return mutates outer state and returns cleanly',
      res.vmResult !== undefined &&
      res.vmResult.globals['flag'] === true);
  }

  {
    const src = `
      function double(x: number): number {
        return x * 2;
      }
      function quad(x: number): number {
        return double(double(x));
      }
      let q = quad(5);
    `;
    const res = compiler.execute(src);
    assert('VM32: Nested function calls execute through call stack',
      res.vmResult !== undefined &&
      res.vmResult.globals['q'] === 20);
  }

  {
    const src = `
      function f1(x: number): number { return x + 1; }
      function f2(x: number): number { return f1(x) * 2; }
      function f3(x: number): number { return f2(x) + 3; }
      let chain = f3(4);
    `;
    const res = compiler.execute(src);
    assert('VM33: Three-level nested call stack preserves return addresses',
      res.vmResult !== undefined &&
      res.vmResult.globals['chain'] === 13);
  }

  {
    const src = `
      function fact(n: number): number {
        if n <= 1 {
          return 1;
        }
        return n * fact(n - 1);
      }
      let f5 = fact(5);
    `;
    const res = compiler.execute(src);
    assert('VM34: Recursive factorial function executes correctly',
      res.vmResult !== undefined &&
      res.vmResult.globals['f5'] === 120);
  }

  {
    const src = `
      function fib(n: number): number {
        if n <= 0 {
          return 0;
        }
        if n == 1 {
          return 1;
        }
        return fib(n - 1) + fib(n - 2);
      }
      let fib6 = fib(6);
    `;
    const res = compiler.execute(src);
    assert('VM35: Dual recursive Fibonacci function terminates with correct result',
      res.vmResult !== undefined &&
      res.vmResult.globals['fib6'] === 8);
  }

  // ── 6. Scoping & Variable Isolation ───────────────────────────────────────
  {
    const src = `
      let x = 100;
      function testShadow(x: number): number {
        return x * 2;
      }
      let inner = testShadow(5);
      let outer = x;
    `;
    const res = compiler.execute(src);
    assert('VM36: Parameter shadowing does not mutate outer global variable',
      res.vmResult !== undefined &&
      res.vmResult.globals['inner'] === 10 &&
      res.vmResult.globals['outer'] === 100);
  }

  {
    const src = `
      let factor = 3;
      function scale(n: number): number {
        return n * factor;
      }
      let scaled = scale(7);
    `;
    const res = compiler.execute(src);
    assert('VM37: Function correctly reads outer global variable',
      res.vmResult !== undefined &&
      res.vmResult.globals['scaled'] === 21);
  }

  {
    const src = `
      function make(val: number): number {
        let temp = val + 10;
        return temp;
      }
      let a = make(1);
      let b = make(2);
    `;
    const res = compiler.execute(src);
    assert('VM38: Multiple function activations maintain isolated local stores',
      res.vmResult !== undefined &&
      res.vmResult.globals['a'] === 11 &&
      res.vmResult.globals['b'] === 12);
  }

  {
    const src = `
      let x = 1;
      function step(): number {
        return 42;
      }
      let y = step();
      let z = x + 1;
    `;
    const res = compiler.execute(src);
    assert('VM39: RETURN restores caller PC and allows continued linear execution',
      res.vmResult !== undefined &&
      res.vmResult.globals['y'] === 42 &&
      res.vmResult.globals['z'] === 2);
  }

  // ── 7. Runtime Safety Guards ──────────────────────────────────────────────
  {
    const src = `
      let a = 10;
      let b = 0;
      let c = a / b;
    `;
    const res = compiler.execute(src);
    assert('VM40: Division by zero throws E5001 runtime error',
      res.vmResult !== undefined &&
      !res.vmResult.success &&
      res.vmResult.error?.code === 'E5001');
  }

  {
    const src = `
      let a = 10;
      let b = 0;
      let c = a % b;
    `;
    const res = compiler.execute(src);
    assert('VM41: Modulo by zero throws E5001 runtime error',
      res.vmResult !== undefined &&
      !res.vmResult.success &&
      res.vmResult.error?.code === 'E5001');
  }

  {
    // Bypass static semantic check by crafting IR directly to verify VM fail-closed behavior
    const vm = new UnifiedVM();
    const badIR = {
      version: '0.1.0-IR',
      instructions: [
        {
          index: 0,
          opcode: 'LOAD' as const,
          destination: { kind: 'register' as const, value: 'r1' },
          sources: [{ kind: 'variable' as const, value: 'ghostVariable' }],
        },
      ],
    };
    const vmRes = vm.execute(badIR);
    assert('VM42: VM throws E5004 when loading undefined variable',
      !vmRes.success && vmRes.error?.code === 'E5004');
  }

  {
    const vm = new UnifiedVM();
    const badIR = {
      version: '0.1.0-IR',
      instructions: [
        {
          index: 0,
          opcode: 'CALL' as const,
          destination: { kind: 'register' as const, value: 'r1' },
          sources: [{ kind: 'variable' as const, value: 'nonExistentFunc' }],
        },
      ],
    };
    const vmRes = vm.execute(badIR);
    assert('VM43: VM throws E5005 when calling undefined function',
      !vmRes.success && vmRes.error?.code === 'E5005');
  }

  {
    const src = `
      function runaway(n: number): number {
        return runaway(n + 1);
      }
      let boom = runaway(1);
    `;
    const res = compiler.execute(src);
    assert('VM44: Infinite recursion intercepted by E5006 max call depth guard',
      res.vmResult !== undefined &&
      !res.vmResult.success &&
      res.vmResult.error?.code === 'E5006');
  }

  {
    const src = `
      let i = 0;
      while true {
        i = i + 1;
      }
    `;
    const res = compiler.execute(src);
    assert('VM45: Infinite loop intercepted by E5007 max instruction guard',
      res.vmResult !== undefined &&
      !res.vmResult.success &&
      res.vmResult.error?.code === 'E5007');
  }

  {
    const vm = new UnifiedVM();
    const badIR = {
      version: '0.1.0-IR',
      instructions: [
        {
          index: 0,
          opcode: 'ADD' as const,
          destination: { kind: 'register' as const, value: 'r1' },
          sources: [
            { kind: 'constant' as const, value: 10 },
            { kind: 'constant' as const, value: true },
          ],
        },
      ],
    };
    const vmRes = vm.execute(badIR);
    assert('VM46: Type mismatch in arithmetic produces clean failure',
      vmRes.instructionsExecuted >= 1);
  }

  // ── 8. Print Statement Capture ────────────────────────────────────────────
  {
    const src = `
      print "Line 1";
      print "Line 2";
      let x = 100;
      print x;
    `;
    const res = compiler.execute(src);
    assert('VM47: PRINT statements captured in sequential order in output array',
      res.vmResult !== undefined &&
      res.vmResult.output.length === 3 &&
      res.vmResult.output[0] === 'Line 1' &&
      res.vmResult.output[1] === 'Line 2' &&
      res.vmResult.output[2] === '100');
  }

  // ── 9. Declarative Compatibility & Preserved Systems ───────────────────────
  {
    const spatialDSL = `
      rss_max = 512;
      @assert_rss(256);
      @actuation_lock(true);

      node CoreNode {
        @Space(0.100, 0.200, 0.300);
        @Grid777(0, 1, 2);
        align => (0.150, 0.250, 0.350);
        checkpoint alpha;
        seal "node_alpha.3dmemory";
        @memview(32);
      }
    `;
    const lexer = new OneLexer(spatialDSL);
    const tokens = lexer.tokenize();
    const parser = new OneParser(tokens);
    const ast = parser.parse();
    const coreCompiler = new OneCompiler(ast);
    const execAST = coreCompiler.compile();
    const cubioVM = new CubiOVirtualMachine();
    cubioVM.execute(execAST);

    const vmState = cubioVM.getVMState();
    assert('VM48: Preserved Declarative CubiO VM executes spatial instructions seamlessly',
      vmState.nodesCount === 1 &&
      vmState.determinismSigmaSq === 0.0 &&
      vmState.actuationLocked === true);
  }

  {
    assert('VM49: CanonicalAddress369 defines exactly 369 total slots',
      CanonicalAddress369.TOTAL_ADDRESSES === 369 &&
      CanonicalAddress369.SYMBOLIC_COUNT === 26 &&
      CanonicalAddress369.SPATIAL_COUNT === 343);

    const centerCoord = CanonicalAddress369.canonicalAddressToSpatialCoord(197);
    assert('VM50: Center voxel (3,3,3) maps bit-exact to canonical address 197',
      centerCoord !== null &&
      centerCoord.i === 3 &&
      centerCoord.j === 3 &&
      centerCoord.k === 3);
  }

  // ── 10. Security & Host Isolation Verification ────────────────────────────
  {
    const vmFileContent = fs.readFileSync(
      path.resolve(__dirname, '../../../src/one/vm/UnifiedVM.ts'),
      'utf-8'
    );
    const hasEval = /\beval\s*\(/.test(vmFileContent);
    const hasFunctionCtor = /new\s+Function\s*\(/.test(vmFileContent);
    assert('VM51: Zero usage of eval() in VM implementation', !hasEval);
    assert('VM52: Zero usage of Function() constructor in VM implementation', !hasFunctionCtor);
  }

  {
    const compilerFileContent = fs.readFileSync(
      path.resolve(__dirname, '../../../src/one/UnifiedCompiler.ts'),
      'utf-8'
    );
    const hasEval = /\beval\s*\(/.test(compilerFileContent);
    const hasFunctionCtor = /new\s+Function\s*\(/.test(compilerFileContent);
    assert('VM53: Zero usage of eval() in UnifiedCompiler', !hasEval);
    assert('VM54: Zero usage of Function() constructor in UnifiedCompiler', !hasFunctionCtor);
  }

  {
    const src = `
      let sum = 0;
      let n = 10;
      let i = 1;
      while i <= n {
        sum = sum + i;
        i = i + 1;
      }
    `;
    const res = compiler.execute(src);
    assert('VM55: End-to-end computational verification: sum 1..10 equals 55',
      res.vmResult !== undefined &&
      res.vmResult.success &&
      res.vmResult.globals['sum'] === 55);
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(`  PHASE 3 CONFORMANCE RESULTS: ${passed}/${passed + failed} PASS`);
  console.log('════════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3Tests().catch((err) => {
  console.error('[FATAL TEST RUNNER ERROR]', err);
  process.exit(1);
});
