/**
 * ONE Language — Task ONE-01: Typed Numeric Values Verification Suite
 * ===================================================================
 * Validates:
 *   - Numeric runtime types: f32, i32, bool
 *   - Type checking & diagnostics (E2001, E2002, E2003, E2004, E2005)
 *   - Conversion rules (i32(), f32(), bool(), widening, narrowing restrictions)
 *   - Runtime validation & deterministic arithmetic (two's complement i32, IEEE-754 f32)
 *   - Division & modulo by zero handling (E5001)
 *   - Backward compatibility: unannotated programs & declarative spatial DSL
 *   - 100-cycle deterministic replay (sigma^2 = 0.0)
 */

import { UnifiedCompiler } from '../../../src/one/UnifiedCompiler';
import { UnifiedVM, OneVMError } from '../../../src/one/vm/UnifiedVM';
import {
  TypeI32,
  TypeF32,
  TypeBool,
  TypeNumber,
  TypeString,
  TypeBoolean,
  parseTypeString,
  isTypeAssignable,
  isNumericType,
  isBooleanType,
} from '../../../src/one/types/TypeSystem';
import {
  toI32,
  toF32,
  toBool,
  validateI32,
  validateF32,
  validateBool,
  DeterministicNumericOps,
  I32_MIN,
  I32_MAX,
} from '../../../src/one/types/TypedNumeric';
import {
  createI32,
  createF32,
  createBool,
  createInt,
  createFloat,
  isEqual,
  compare,
} from '../../../src/one/runtime/NativeValues';
import { NativeRuntime } from '../../../src/one/runtime/NativeRuntime';

let passed = 0;
let failed = 0;

function assert(description: string, condition: boolean): void {
  if (condition) {
    console.log(`  ✓ PASS [ONE01] ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL [ONE01] ${description}`);
    failed++;
  }
}

async function runOne01TestSuite(): Promise<void> {
  console.log('\n================================================================================');
  console.log('  ONE LANGUAGE — TASK ONE-01: TYPED NUMERIC VALUES VERIFICATION SUITE');
  console.log('  Types: i32 (32-bit int), f32 (IEEE-754 single float), bool (canonical boolean)');
  console.log('================================================================================\n');

  const compiler = new UnifiedCompiler();

  // ── GATE 1: Static Type System & Annotations ──────────────────────────────
  console.log('[GATE 1/8] Verifying Type System & Annotations...');
  {
    assert('parseTypeString("i32") returns TypeI32', parseTypeString('i32').kind === 'i32');
    assert('parseTypeString("int32") returns TypeI32', parseTypeString('int32').kind === 'i32');
    assert('parseTypeString("int") returns TypeI32', parseTypeString('int').kind === 'i32');
    assert('parseTypeString("f32") returns TypeF32', parseTypeString('f32').kind === 'f32');
    assert('parseTypeString("float32") returns TypeF32', parseTypeString('float32').kind === 'f32');
    assert('parseTypeString("float") returns TypeF32', parseTypeString('float').kind === 'f32');
    assert('parseTypeString("bool") returns TypeBool', parseTypeString('bool').kind === 'bool');
    assert('parseTypeString("boolean") returns TypeBoolean', parseTypeString('boolean').kind === 'boolean');

    assert('isNumericType recognizes i32, f32, number',
      isNumericType(TypeI32) && isNumericType(TypeF32) && isNumericType(TypeNumber));
    assert('isBooleanType recognizes bool and boolean',
      isBooleanType(TypeBool) && isBooleanType(TypeBoolean));
    assert('isNumericType rejects string and bool',
      !isNumericType(TypeString) && !isNumericType(TypeBool));
  }

  // ── GATE 2: Type Checking & Static Diagnostic Enforcement ─────────────────
  console.log('\n[GATE 2/8] Verifying Static Type Checking & Diagnostic Rules...');
  {
    // Valid typed variables
    const validSrc = `
      let count: i32 = 100;
      let ratio: f32 = 0.75f;
      let active: bool = true;
    `;
    const validRes = compiler.compile(validSrc);
    assert('Compiles typed declarations (i32, f32, bool) without diagnostics',
      validRes.success && validRes.diagnostics.length === 0);

    // Mismatched type assignment: string to i32
    const strToI32Src = `
      let x: i32 = "not an integer";
    `;
    const strToI32Res = compiler.compile(strToI32Src);
    assert('Rejects assigning string to i32 (E2001)',
      !strToI32Res.success && strToI32Res.diagnostics.some((d) => d.code === 'E2001'));

    // Mismatched type assignment: bool to i32 without conversion
    const boolToI32Src = `
      let b: bool = true;
      let x: i32 = b;
    `;
    const boolToI32Res = compiler.compile(boolToI32Src);
    assert('Rejects assigning bool to i32 without explicit cast (E2001)',
      !boolToI32Res.success && boolToI32Res.diagnostics.some((d) => d.code === 'E2001'));

    // Narrowing conversion: f32 to i32 without explicit conversion
    const f32ToI32Src = `
      let f: f32 = 3.14f;
      let i: i32 = f;
    `;
    const f32ToI32Res = compiler.compile(f32ToI32Src);
    assert('Rejects implicit narrowing conversion from f32 to i32 (E2001)',
      !f32ToI32Res.success && f32ToI32Res.diagnostics.some((d) => d.code === 'E2001'));

    // Widening conversion: i32 to f32 is permitted
    const i32ToF32Src = `
      let i: i32 = 42;
      let f: f32 = i;
    `;
    const i32ToF32Res = compiler.compile(i32ToF32Src);
    assert('Allows implicit widening conversion from i32 to f32',
      i32ToF32Res.success && i32ToF32Res.diagnostics.length === 0);

    // Enforce boolean on if condition
    const badIfCondSrc = `
      let val: i32 = 10;
      if val {
        print "bad condition";
      }
    `;
    const badIfCondRes = compiler.compile(badIfCondSrc);
    assert('Rejects integer used as if condition (E2005)',
      !badIfCondRes.success && badIfCondRes.diagnostics.some((d) => d.code === 'E2005'));

    // Comparison produces bool which is valid for if condition
    const goodIfCondSrc = `
      let val: i32 = 10;
      if val > 0 {
        print "valid condition";
      }
    `;
    const goodIfCondRes = compiler.compile(goodIfCondSrc);
    assert('Accepts relational comparison expression in if condition',
      goodIfCondRes.success && goodIfCondRes.diagnostics.length === 0);

    // Function parameter type enforcement
    const fnArgMismatchSrc = `
      fn compute(n: i32): i32 {
        return n * 2;
      }
      let r = compute("hello");
    `;
    const fnArgRes = compiler.compile(fnArgMismatchSrc);
    assert('Rejects mismatched argument type for function call (E2003)',
      !fnArgRes.success && fnArgRes.diagnostics.some((d) => d.code === 'E2003'));

    // Function return type enforcement
    const fnReturnMismatchSrc = `
      fn getFlag(): bool {
        return 123;
      }
    `;
    const fnReturnRes = compiler.compile(fnReturnMismatchSrc);
    assert('Rejects mismatched return type for function (E2004)',
      !fnReturnRes.success && fnReturnRes.diagnostics.some((d) => d.code === 'E2004'));
  }

  // ── GATE 3: Explicit Built-in Conversion Functions ─────────────────────────
  console.log('\n[GATE 3/8] Verifying Built-in Conversion Functions...');
  {
    const convSrc = `
      let a = i32(3.85);
      let b = i32(true);
      let c = i32(false);
      let d = f32(100);
      let e = f32(true);
      let f = bool(1);
      let g = bool(0);
      let checkI = is_i32(42);
      let checkF = is_f32(3.14);
      let checkB = is_bool(true);
    `;
    const convRes = compiler.execute(convSrc);
    assert('Conversion program executed successfully',
      convRes.vmResult !== undefined && convRes.vmResult.success);
    const globs = convRes.vmResult!.globals;

    assert('i32(3.85) truncates fractional part to 3', globs['a'] === 3);
    assert('i32(true) converts to 1', globs['b'] === 1);
    assert('i32(false) converts to 0', globs['c'] === 0);
    assert('f32(100) converts to 100.0', globs['d'] === 100);
    assert('f32(true) converts to 1.0', globs['e'] === 1);
    assert('bool(1) converts to true', globs['f'] === true);
    assert('bool(0) converts to false', globs['g'] === false);
    assert('is_i32(42) returns true', globs['checkI'] === true);
    assert('is_f32(3.14) returns true', globs['checkF'] === true);
    assert('is_bool(true) returns true', globs['checkB'] === true);
  }

  // ── GATE 4: Deterministic 32-bit Integer Arithmetic & Wrapping ─────────────
  console.log('\n[GATE 4/8] Verifying Deterministic i32 Arithmetic & Wrapping...');
  {
    assert('Deterministic addI32(10, 20) == 30',
      DeterministicNumericOps.addI32(10, 20) === 30);
    assert('Deterministic subI32(50, 15) == 35',
      DeterministicNumericOps.subI32(50, 15) === 35);
    assert('Deterministic mulI32(6, 7) == 42',
      DeterministicNumericOps.mulI32(6, 7) === 42);
    assert('Deterministic divI32(7, 2) truncates to 3',
      DeterministicNumericOps.divI32(7, 2) === 3);
    assert('Deterministic modI32(14, 5) == 4',
      DeterministicNumericOps.modI32(14, 5) === 4);

    // Two's complement wrapping at bounds
    assert('i32 overflow: I32_MAX + 1 wraps to I32_MIN (-2147483648)',
      DeterministicNumericOps.addI32(I32_MAX, 1) === I32_MIN);
    assert('i32 underflow: I32_MIN - 1 wraps to I32_MAX (2147483647)',
      DeterministicNumericOps.subI32(I32_MIN, 1) === I32_MAX);

    // Division by zero throws E5001
    let divZeroCaught = false;
    try {
      DeterministicNumericOps.divI32(10, 0);
    } catch (e: any) {
      divZeroCaught = e.message.includes('E5001');
    }
    assert('i32 division by zero throws E5001', divZeroCaught);

    // Modulo by zero throws E5001
    let modZeroCaught = false;
    try {
      DeterministicNumericOps.modI32(10, 0);
    } catch (e: any) {
      modZeroCaught = e.message.includes('E5001');
    }
    assert('i32 modulo by zero throws E5001', modZeroCaught);

    // Bitwise operations
    assert('andI32(0xFF, 0x0F) == 0x0F', DeterministicNumericOps.andI32(0xFF, 0x0F) === 0x0F);
    assert('orI32(0xF0, 0x0F) == 0xFF', DeterministicNumericOps.orI32(0xF0, 0x0F) === 0xFF);
    assert('xorI32(0xAA, 0x55) == 0xFF', DeterministicNumericOps.xorI32(0xAA, 0x55) === 0xFF);
    assert('shlI32(1, 4) == 16', DeterministicNumericOps.shlI32(1, 4) === 16);
    assert('shrI32(32, 2) == 8', DeterministicNumericOps.shrI32(32, 2) === 8);
  }

  // ── GATE 5: Deterministic IEEE-754 32-bit Float (Math.fround) ──────────────
  console.log('\n[GATE 5/8] Verifying Deterministic f32 Single-Precision Float...');
  {
    const fVal1 = Math.fround(1.3333333730697632);
    const fVal2 = Math.fround(2.6666667461395264);
    const expectedSum = Math.fround(fVal1 + fVal2);

    assert('f32 addition matches exact Math.fround sum',
      DeterministicNumericOps.addF32(fVal1, fVal2) === expectedSum);

    const fMult = DeterministicNumericOps.mulF32(1.5, 3.0);
    assert('f32 multiplication produces exact 4.5', fMult === 4.5);

    const fDiv = DeterministicNumericOps.divF32(1.0, 3.0);
    assert('f32 division produces exact single-precision 0.3333333432674408',
      fDiv === Math.fround(1.0 / 3.0));

    // f32 division by zero throws E5001
    let fDivZeroCaught = false;
    try {
      DeterministicNumericOps.divF32(1.0, 0.0);
    } catch (e: any) {
      fDivZeroCaught = e.message.includes('E5001');
    }
    assert('f32 division by zero throws E5001', fDivZeroCaught);
  }

  // ── GATE 6: VM Execution with Typed Storage & Coercion ────────────────────
  console.log('\n[GATE 6/8] Verifying UnifiedVM Execution with Typed Storage...');
  {
    const typedProgram = `
      let x: i32 = 25;
      let y: i32 = 17;
      let sum: i32 = x + y;
      let diff: i32 = x - y;
      let prod: i32 = x * y;
      let quot: i32 = x / y;
      let rem: i32 = x % y;

      let fa: f32 = 2.5f;
      let fb: f32 = 1.25f;
      let fsum: f32 = fa + fb;
      let fquot: f32 = fa / fb;

      let isGreater: bool = sum > 40;
      let isLess: bool = diff < 0;
    `;
    const res = compiler.execute(typedProgram);
    assert('Typed program compiles and runs on VM without errors',
      res.vmResult !== undefined && res.vmResult.success);

    const globs = res.vmResult!.globals;
    assert('i32 sum: 25 + 17 == 42', globs['sum'] === 42);
    assert('i32 diff: 25 - 17 == 8', globs['diff'] === 8);
    assert('i32 prod: 25 * 17 == 425', globs['prod'] === 425);
    assert('i32 quot: 25 / 17 == 1 (truncated integer division)', globs['quot'] === 1);
    assert('i32 rem: 25 % 17 == 8', globs['rem'] === 8);

    assert('f32 fsum: 2.5 + 1.25 == 3.75', globs['fsum'] === 3.75);
    assert('f32 fquot: 2.5 / 1.25 == 2.0', globs['fquot'] === 2.0);

    assert('bool isGreater: 42 > 40 is true', globs['isGreater'] === true);
    assert('bool isLess: 8 < 0 is false', globs['isLess'] === false);
  }

  // ── GATE 7: NativeRuntime Typed Values & Deterministic Replay ─────────────
  console.log('\n[GATE 7/8] Verifying NativeRuntime Typed Values & Replay Invariance...');
  {
    const vI32 = createI32(42);
    const vF32 = createF32(3.14159);
    const vBool = createBool(true);

    assert('createI32 returns kind: "i32"', vI32.kind === 'i32' && vI32.value === 42);
    assert('createF32 returns kind: "f32"', vF32.kind === 'f32' && vF32.value === Math.fround(3.14159));
    assert('createBool returns kind: "bool"', vBool.kind === 'bool' && vBool.value === true);

    // Equality between i32 and int
    const vInt = createInt(42);
    assert('isEqual matches i32 and int with identical values', isEqual(vI32, vInt));

    // Equality between f32 and float
    const vFloat = createFloat(Math.fround(3.14159));
    assert('isEqual matches f32 and float with identical values', isEqual(vF32, vFloat));

    // NativeRuntime execution with 100-cycle bit-exact replay
    const nativeRuntime = new NativeRuntime();
    const testCode = `
      let a: i32 = 10;
      let b: i32 = 20;
      let c: i32 = a + b * 2;
      print c;
    `;
    const replayReport = nativeRuntime.verifyDeterminism(testCode, 100);
    assert('NativeRuntime 100-cycle replay certified: sigma^2 = 0.0',
      replayReport.certified && replayReport.sigmaSqVariance === 0.0);
    assert('All 100 replays match bit-for-bit', replayReport.replaysMatch);
    assert('Actuation lock is permanently engaged', replayReport.invariantActuationBlocked);
  }

  // ── GATE 8: Non-Regression & Backwards Compatibility ──────────────────────
  console.log('\n[GATE 8/8] Verifying Backward Compatibility (Zero Regressions)...');
  {
    // Unannotated legacy computational program
    const legacyComp = `
      let x = 10;
      let y = 20;
      let total = x + y;
      let msg = "result: ";
    `;
    const legacyRes = compiler.execute(legacyComp);
    assert('Legacy unannotated variables execute normally',
      legacyRes.vmResult !== undefined &&
      legacyRes.vmResult.success &&
      legacyRes.vmResult.globals['total'] === 30);

    // Spatial DSL program
    const spatialSrc = `
      rss_max = 512;
      node AlphaNode {
        @Space(0.1, 0.2, 0.3);
        checkpoint chk1;
      }
    `;
    const spatialRes = compiler.compile(spatialSrc);
    assert('Spatial declarative DSL continues to compile without regressions',
      spatialRes.success && spatialRes.routing.grammar === 'DECLARATIVE');
  }

  // ── Final Conformance Results ─────────────────────────────────────────────
  console.log('\n================================================================================');
  console.log(`  FINAL RESULTS: ${passed} / ${passed + failed} ASSERTIONS PASSED (${failed === 0 ? '100%' : 'FAILED'})`);
  if (failed === 0) {
    console.log('  TASK ONE-01: TYPED NUMERIC VALUES (f32, i32, bool) FULLY CERTIFIED');
  } else {
    console.error(`  TASK ONE-01 FAILED WITH ${failed} ERRORS`);
  }
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runOne01TestSuite();
