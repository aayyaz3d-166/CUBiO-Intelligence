/**
 * ONE Language — Phase 4: Developer Experience Test Suite
 * =======================================================
 * Validates the complete developer ergonomics and tooling ecosystem:
 *   - Simple, clean syntax (semicolon-free, untyped & typed functions)
 *   - Human-friendly compiler diagnostics (DiagnosticFormatter, code frames, hints)
 *   - Standard Library Foundation (String, Number, Boolean, Array, Object, Math, JSON, DateTime, IO)
 *   - Deterministic Source Formatter (OneFormatter, idempotency, DSL preservation)
 *   - Developer CLI (OneDeveloperCLI: init, run, check, build, format, test)
 *   - Language Server Protocol Foundation (diagnostics, completions, hover, definition)
 *   - Zero Regressions & Security Guarantees (No eval, no Function, Address369 preserved)
 */

import * as fs from 'fs';
import * as path from 'path';
import { UnifiedCompiler } from '../../../src/one/UnifiedCompiler';
import { GrammarKind } from '../../../src/one/router/GrammarRouter';
import { DiagnosticFormatter } from '../../../src/one/diagnostics/DiagnosticFormatter';
import {
  StdString,
  StdNumber,
  StdBoolean,
  StdArray,
  StdObject,
  StdMath,
  StdJSON,
  StdDateTime,
  StdIO,
} from '../../../src/one/stdlib/OneStdLib';
import { OneFormatter } from '../../../src/one/formatter/OneFormatter';
import { OneDeveloperCLI } from '../../../src/one/cli/OneDeveloperCLI';
import { OneLanguageServer } from '../../../src/one/lsp/OneLanguageServer';
import { CanonicalAddress369 } from '../../../src/one/address369_canonical';

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

async function runPhase4Tests(): Promise<void> {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  ONE LANGUAGE — PHASE 4 DEVELOPER EXPERIENCE TEST SUITE');
  console.log('════════════════════════════════════════════════════════════════\n');

  const compiler = new UnifiedCompiler();
  const lsp = new OneLanguageServer();
  const tempDir = path.resolve(__dirname, '../../temp_phase4_dx');

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // ── 1. Simple, Clean Syntax ───────────────────────────────────────────────
  {
    const src = `
      let name = "Ayyaz"
      let age = 29
    `;
    const res = compiler.execute(src);
    assert('DX01: Semicolon-free variable declarations compile and execute',
      res.vmResult !== undefined &&
      res.vmResult.success &&
      res.vmResult.globals['name'] === 'Ayyaz' &&
      res.vmResult.globals['age'] === 29);
  }

  {
    const src = `
      let age = 29
      let eligible = false
      if age >= 18 {
        eligible = true
      }
    `;
    const res = compiler.execute(src);
    assert('DX02: Semicolon-free if conditional evaluates and mutates state',
      res.vmResult !== undefined &&
      res.vmResult.globals['eligible'] === true);
  }

  {
    const src = `
      function add(a, b) {
        return a + b
      }
      let sum = add(15, 25)
    `;
    const res = compiler.execute(src);
    assert('DX03: Semicolon-free function declaration and return statement',
      res.vmResult !== undefined &&
      res.vmResult.globals['sum'] === 40);
  }

  {
    const src = `
      function multiply(x, y) {
        return x * y
      }
      let product = multiply(7, 8)
    `;
    const res = compiler.execute(src);
    assert('DX04: Clean untyped parameters and return in function',
      res.vmResult !== undefined &&
      res.vmResult.globals['product'] === 56);
  }

  {
    const src = `
      let name = "Ayyaz"
      let age = 29
      if age >= 18 {
        print name
      }
    `;
    const res = compiler.execute(src);
    assert('DX05: Concise developer example from specification executes with output',
      res.vmResult !== undefined &&
      res.vmResult.output.length === 1 &&
      res.vmResult.output[0] === 'Ayyaz');
  }

  // ── 2. Human-Friendly Compiler Diagnostics ────────────────────────────────
  {
    const report = DiagnosticFormatter.format({
      code: 'E2001',
      message: 'Type mismatch',
      expected: 'number',
      actual: 'string',
      line: 4,
      column: 10,
    });
    assert('DX06: DiagnosticFormatter formats type mismatch error (E2001) with Expected/Received',
      report.includes('[E2001]') &&
      report.includes('Expected: number') &&
      report.includes('Received: string') &&
      report.includes('Line 4, Column 10'));
  }

  {
    const src = `let x = 10\nlet y = "wrong"\nlet z = x + y`;
    const codeFrame = DiagnosticFormatter.extractCodeFrame(src, 2, 9);
    assert('DX07: Code frame generation extracts source line and renders caret pointer',
      codeFrame.includes('2 | let y = "wrong"') &&
      codeFrame.includes('^'));
  }

  {
    const hint = DiagnosticFormatter.getHintForCode('E2001');
    assert('DX08: Actionable hints provided for type mismatch (E2001)',
      hint.length > 10 && hint.includes('type'));
  }

  {
    const hint = DiagnosticFormatter.getHintForCode('E3008');
    assert('DX09: Actionable hints provided for const reassignment (E3008)',
      hint.includes('const') && hint.includes('let'));
  }

  {
    const hint = DiagnosticFormatter.getHintForCode('E3004');
    assert('DX10: Actionable hints provided for undefined identifier (E3004)',
      hint.includes('identifier') || hint.includes('declared'));
  }

  {
    const hint = DiagnosticFormatter.getHintForCode('E3003');
    assert('DX11: Actionable hints provided for top-level return (E3003)',
      hint.includes('function'));
  }

  {
    const hint = DiagnosticFormatter.getHintForCode('E5001');
    assert('DX12: Actionable hints provided for division-by-zero (E5001)',
      hint.includes('zero'));
  }

  {
    const multi = DiagnosticFormatter.formatAll([
      { code: 'E2001', message: 'Type error 1', line: 1 },
      { code: 'E3004', message: 'Undefined var', line: 5 },
    ]);
    assert('DX13: Composite formatAll generates clean delimited multi-error reports',
      multi.includes('[E2001]') && multi.includes('[E3004]') && multi.includes('─────'));
  }

  // ── 3. Standard Library Foundation ────────────────────────────────────────
  {
    assert('DX14: StdString basic functions: length, toLowerCase, toUpperCase, trim',
      StdString.length('hello') === 5 &&
      StdString.toLowerCase('ONE') === 'one' &&
      StdString.toUpperCase('one') === 'ONE' &&
      StdString.trim('  sovereign  ') === 'sovereign');
  }

  {
    const splitArr = StdString.split('a,b,c', ',');
    assert('DX15: StdString advanced functions: split, slice, replace, includes, charAt',
      splitArr.length === 3 &&
      StdString.slice('sovereign', 0, 4) === 'sove' &&
      StdString.replace('hello world', 'world', 'ONE') === 'hello ONE' &&
      StdString.includes('apple pie', 'pie') === true &&
      StdString.charAt('code', 2) === 'd');
  }

  {
    assert('DX16: StdNumber functions: parseInt, parseFloat, toFixed, isNaN, isFinite',
      StdNumber.parseInt('42') === 42 &&
      StdNumber.parseFloat('3.14') === 3.14 &&
      StdNumber.toFixed(3.14159, 2) === '3.14' &&
      StdNumber.isNaN('not-a-number') === true &&
      StdNumber.isFinite(100) === true);
  }

  {
    assert('DX17: StdBoolean functions: parse and toString',
      StdBoolean.parse('true') === true &&
      StdBoolean.parse('0') === false &&
      StdBoolean.toString(true) === 'true' &&
      StdBoolean.toString(false) === 'false');
  }

  {
    const arr = [1, 2, 3];
    assert('DX18: StdArray mutations: length, push, pop, shift, unshift',
      StdArray.length(arr) === 3 &&
      StdArray.push(arr, 4) === 4 &&
      StdArray.pop(arr) === 4 &&
      StdArray.shift(arr) === 1 &&
      StdArray.unshift(arr, 0) === 3);
  }

  {
    const arr = ['a', 'b', 'c'];
    assert('DX19: StdArray utilities: join, slice, indexOf, reverse',
      StdArray.join(arr, '-') === 'a-b-c' &&
      StdArray.slice(arr, 1).length === 2 &&
      StdArray.indexOf(arr, 'b') === 1 &&
      StdArray.reverse(arr)[0] === 'c');
  }

  {
    const obj = { x: 10, y: 20 };
    assert('DX20: StdObject introspection: keys, values, entries, hasKey',
      StdObject.keys(obj).length === 2 &&
      StdObject.values(obj).includes(10) &&
      StdObject.entries(obj).length === 2 &&
      StdObject.hasKey(obj, 'x') === true &&
      StdObject.hasKey(obj, 'z') === false);
  }

  {
    assert('DX21: StdMath arithmetic operations: abs, sqrt, pow, min, max, floor, ceil, round',
      StdMath.abs(-50) === 50 &&
      StdMath.sqrt(64) === 8 &&
      StdMath.pow(2, 3) === 8 &&
      StdMath.min(10, 5) === 5 &&
      StdMath.max(10, 5) === 10 &&
      StdMath.floor(4.9) === 4 &&
      StdMath.ceil(4.1) === 5 &&
      StdMath.round(4.5) === 5);
  }

  {
    assert('DX22: StdMath trigonometric functions & constants: sin, cos, tan, PI, E',
      StdMath.sin(0) === 0 &&
      StdMath.cos(0) === 1 &&
      StdMath.PI > 3.14 &&
      StdMath.E > 2.71);
  }

  {
    const original = { title: 'ONE', count: 369 };
    const serialized = StdJSON.stringify(original);
    const parsed = StdJSON.parse(serialized) as any;
    assert('DX23: StdJSON stringify and parse roundtrip fidelity',
      typeof serialized === 'string' &&
      parsed.title === 'ONE' &&
      parsed.count === 369);
  }

  {
    assert('DX24: StdDateTime timestamp and ISO string generation',
      StdDateTime.now() > 0 &&
      StdDateTime.timestamp() > 0 &&
      StdDateTime.iso().includes('T'));
  }

  {
    const testFile = path.join(tempDir, 'sample_io.txt');
    const writeOk = StdIO.writeText(testFile, 'ONE Sovereign Content');
    const exists = StdIO.exists(testFile);
    const content = StdIO.readText(testFile);
    assert('DX25: StdIO: safe file writeText, exists, and readText cycle',
      writeOk === true && exists === true && content === 'ONE Sovereign Content');
  }

  {
    const src = `
      let root = sqrt(25)
    `;
    const res = compiler.execute(src);
    assert('DX26: VM Built-in Integration: calling sqrt(25) executes and returns 5',
      res.vmResult !== undefined &&
      res.vmResult.globals['root'] === 5);
  }

  {
    const src = `
      let positive = abs(-42)
    `;
    const res = compiler.execute(src);
    assert('DX27: VM Built-in Integration: calling abs(-42) executes and returns 42',
      res.vmResult !== undefined &&
      res.vmResult.globals['positive'] === 42);
  }

  {
    const src = `
      let smaller = min(10, 20)
      let larger = max(10, 20)
    `;
    const res = compiler.execute(src);
    assert('DX28: VM Built-in Integration: calling min and max evaluates accurately',
      res.vmResult !== undefined &&
      res.vmResult.globals['smaller'] === 10 &&
      res.vmResult.globals['larger'] === 20);
  }

  {
    const src = `
      let list = [1, 2, 3, 4]
      let count = len(list)
    `;
    const res = compiler.execute(src);
    assert('DX29: VM Built-in Integration: calling len on array literal returns length',
      res.vmResult !== undefined &&
      res.vmResult.globals['count'] === 4);
  }

  {
    const src = `
      let items = [10, 20]
      let newLen = push(items, 30)
    `;
    const res = compiler.execute(src);
    assert('DX30: VM Built-in Integration: calling push appends element to array',
      res.vmResult !== undefined &&
      res.vmResult.globals['newLen'] === 3);
  }

  // ── 4. Deterministic Source Formatter ──────────────────────────────────────
  {
    const unformatted = 'function add(a,b){return a+b}';
    const formatted = OneFormatter.format(unformatted);
    assert('DX31: Formatter standardizes function signature spacing',
      formatted.includes('function add(a, b) {'));
  }

  {
    const unformatted = `function test() {\nlet x = 1\nreturn x\n}`;
    const formatted = OneFormatter.format(unformatted);
    assert('DX32: Formatter adds 4-space block indentation',
      formatted.includes('    let x = 1') &&
      formatted.includes('    return x'));
  }

  {
    const unformatted = 'let x=10+20*30';
    const formatted = OneFormatter.format(unformatted);
    assert('DX33: Formatter standardizes binary operators with single spaces',
      formatted.includes('let x = 10 + 20 * 30'));
  }

  {
    const unformatted = 'if x>=10&&y!=20{print x}';
    const formatted = OneFormatter.format(unformatted);
    assert('DX34: Formatter standardizes comparison and equality operators (>=, &&, !=)',
      formatted.includes('x >= 10 && y != 20 {'));
  }

  {
    const unformatted = `if x > 0 {\nprint 1\n}\nelse if x < 0 {\nprint -1\n}\nelse {\nprint 0\n}`;
    const formatted = OneFormatter.format(unformatted);
    assert('DX35: Formatter normalizes else-if and else block placement',
      formatted.includes('} else if x < 0 {') &&
      formatted.includes('} else {'));
  }

  {
    const unformatted = 'let msg = "Hello + world == test"';
    const formatted = OneFormatter.format(unformatted);
    assert('DX36: Formatter preserves string literals with internal operators untouched',
      formatted.includes('"Hello + world == test"'));
  }

  {
    const sample = `function add(a, b) {\n    return a + b\n}\n`;
    const pass1 = OneFormatter.format(sample);
    const pass2 = OneFormatter.format(pass1);
    assert('DX37: Formatter idempotency: format(format(src)) === format(src)',
      pass1 === pass2);
  }

  {
    const spatial = `node Core {\n@Space(0.1, 0.2, 0.3);\ncheckpoint alpha;\n}`;
    const formatted = OneFormatter.format(spatial);
    assert('DX38: Formatter preserves declarative DSL directives (@Space, node, checkpoint)',
      formatted.includes('node Core {') &&
      formatted.includes('@Space(0.1, 0.2, 0.3)'));
  }

  // ── 5. Developer CLI Workflow ─────────────────────────────────────────────
  {
    const helpRes = OneDeveloperCLI.run(['--help']);
    assert('DX39: CLI help output displays available commands (init, run, check, build, format, test)',
      helpRes.exitCode === 0 &&
      helpRes.stdout.includes('init') &&
      helpRes.stdout.includes('run') &&
      helpRes.stdout.includes('check') &&
      helpRes.stdout.includes('build') &&
      helpRes.stdout.includes('format') &&
      helpRes.stdout.includes('test'));
  }

  {
    const projectDir = path.join(tempDir, 'demo_app');
    const initRes = OneDeveloperCLI.run(['init', projectDir]);
    const manifestExists = fs.existsSync(path.join(projectDir, 'one.json'));
    const mainExists = fs.existsSync(path.join(projectDir, 'src', 'main.one'));
    assert('DX40: one init scaffolds valid one.json manifest and src/main.one entry',
      initRes.exitCode === 0 && manifestExists && mainExists);
  }

  {
    const validFile = path.join(tempDir, 'valid.one');
    fs.writeFileSync(validFile, 'let x = 10\nlet y = x + 5\n', 'utf-8');
    const checkRes = OneDeveloperCLI.run(['check', validFile]);
    assert('DX41: one check validates valid ONE source file with zero errors',
      checkRes.exitCode === 0);
  }

  {
    const invalidFile = path.join(tempDir, 'invalid.one');
    fs.writeFileSync(invalidFile, 'let num: number = "string mismatch"\n', 'utf-8');
    const checkRes = OneDeveloperCLI.run(['check', invalidFile]);
    assert('DX42: one check reports human-friendly formatted diagnostic on invalid source',
      checkRes.exitCode === 1 && checkRes.stderr.includes('[E2001]'));
  }

  {
    const runFile = path.join(tempDir, 'runner.one');
    fs.writeFileSync(runFile, 'let a = 20\nlet b = 30\nprint a + b\n', 'utf-8');
    const runRes = OneDeveloperCLI.run(['run', runFile]);
    assert('DX43: one run compiles and executes valid ONE file capturing stdout output',
      runRes.exitCode === 0 && runRes.stdout.includes('50'));
  }

  {
    const faultFile = path.join(tempDir, 'fault.one');
    fs.writeFileSync(faultFile, 'let a = 10\nlet b = 0\nlet c = a / b\n', 'utf-8');
    const runRes = OneDeveloperCLI.run(['run', faultFile]);
    assert('DX44: one run intercepts runtime error and returns error code',
      runRes.exitCode === 1 && runRes.stderr.includes('E5001'));
  }

  {
    const buildFile = path.join(tempDir, 'build_target.one');
    fs.writeFileSync(buildFile, 'let count = 100\nprint count\n', 'utf-8');
    const buildRes = OneDeveloperCLI.run(['build', buildFile]);
    const irFile = buildFile.replace(/\.one$/, '.one.ir');
    assert('DX45: one build compiles source into .one.ir intermediate representation artifact',
      buildRes.exitCode === 0 && fs.existsSync(irFile));
  }

  {
    const rawFile = path.join(tempDir, 'raw.one');
    fs.writeFileSync(rawFile, 'function add(a,b){return a+b}', 'utf-8');
    const fmtRes = OneDeveloperCLI.run(['format', rawFile, '--write']);
    const formattedContent = fs.readFileSync(rawFile, 'utf-8');
    assert('DX46: one format --write formats file in-place deterministically',
      fmtRes.exitCode === 0 && formattedContent.includes('function add(a, b) {'));
  }

  {
    const testDir = path.join(tempDir, 'tests');
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, 'math.test.one'), 'let x = 1 + 1\n', 'utf-8');
    const testRes = OneDeveloperCLI.run(['test', testDir]);
    assert('DX47: one test discovers and executes *.test.one test suites',
      testRes.exitCode === 0 && testRes.stdout.includes('PASS'));
  }

  // ── 6. Language Server Protocol (LSP) Foundation ──────────────────────────
  {
    const diags = lsp.getDiagnostics('let x = 10\n');
    assert('DX48: LSP getDiagnostics returns zero errors on valid code',
      diags.length === 0);
  }

  {
    const diags = lsp.getDiagnostics('let num: number = "not a number"\n');
    assert('DX49: LSP getDiagnostics returns accurate error code and position on type mismatch',
      diags.length > 0 && diags[0].code === 'E2001' && diags[0].range.start.line === 1);
  }

  {
    const completions = lsp.getCompletions('let a = 1', { line: 1, column: 1 });
    const labels = completions.map((c) => c.label);
    assert('DX50: LSP getCompletions returns language keywords and standard library functions',
      labels.includes('function') &&
      labels.includes('while') &&
      labels.includes('sqrt') &&
      labels.includes('abs'));
  }

  {
    const completions = lsp.getCompletions('let mySpecialVariable = 42\n', { line: 2, column: 1 });
    const labels = completions.map((c) => c.label);
    assert('DX51: LSP getCompletions includes in-scope declared identifiers',
      labels.includes('mySpecialVariable'));
  }

  {
    const hover = lsp.getHover('function compute() {}', { line: 1, column: 3 });
    assert('DX52: LSP getHover returns markdown documentation for keywords',
      hover !== null && hover.contents[0].includes('keyword function'));
  }

  {
    const hover = lsp.getHover('let x = sqrt(16)', { line: 1, column: 10 });
    assert('DX53: LSP getHover returns documentation for standard library built-ins',
      hover !== null && hover.contents[0].includes('builtin'));
  }

  {
    const hover = lsp.getHover('let score: number = 95', { line: 1, column: 6 });
    assert('DX54: LSP getHover returns declaration signature and inferred type',
      hover !== null && hover.contents[0].includes('let score: number'));
  }

  {
    const src = `let targetSymbol = 100\nlet y = targetSymbol + 1`;
    const def = lsp.getDefinition(src, { line: 2, column: 12 });
    assert('DX55: LSP getDefinition returns exact declaration span for identifier',
      def !== null && def.range.start.line === 1);
  }

  // ── 7. Compatibility, Invariants & Security ───────────────────────────────
  {
    const spatialDSL = `
      rss_max = 512;
      node CoreAlpha {
        @Space(0.1, 0.2, 0.3);
        checkpoint start;
      }
    `;
    const checkRes = compiler.compile(spatialDSL);
    assert('DX56: Declarative Spatial DSL routes through compiler with zero regression',
      checkRes.success && checkRes.routing.grammar === GrammarKind.DECLARATIVE);
  }

  {
    assert('DX57: Address369 369-cell mapping remains preserved and invariant',
      CanonicalAddress369.TOTAL_ADDRESSES === 369 &&
      CanonicalAddress369.canonicalAddressToSpatialCoord(197).i === 3);
  }

  {
    const diagFile = fs.readFileSync(path.resolve(__dirname, '../../../src/one/diagnostics/DiagnosticFormatter.ts'), 'utf-8');
    const stdFile = fs.readFileSync(path.resolve(__dirname, '../../../src/one/stdlib/OneStdLib.ts'), 'utf-8');
    const fmtFile = fs.readFileSync(path.resolve(__dirname, '../../../src/one/formatter/OneFormatter.ts'), 'utf-8');
    const lspFile = fs.readFileSync(path.resolve(__dirname, '../../../src/one/lsp/OneLanguageServer.ts'), 'utf-8');
    const cliFile = fs.readFileSync(path.resolve(__dirname, '../../../src/one/cli/OneDeveloperCLI.ts'), 'utf-8');

    const allCode = diagFile + stdFile + fmtFile + lspFile + cliFile;
    const hasEval = /\beval\s*\(/.test(allCode);
    assert('DX58: Zero usage of eval() across all new Phase 4 DX modules', !hasEval);
  }

  {
    const diagFile = fs.readFileSync(path.resolve(__dirname, '../../../src/one/diagnostics/DiagnosticFormatter.ts'), 'utf-8');
    const stdFile = fs.readFileSync(path.resolve(__dirname, '../../../src/one/stdlib/OneStdLib.ts'), 'utf-8');
    const fmtFile = fs.readFileSync(path.resolve(__dirname, '../../../src/one/formatter/OneFormatter.ts'), 'utf-8');
    const lspFile = fs.readFileSync(path.resolve(__dirname, '../../../src/one/lsp/OneLanguageServer.ts'), 'utf-8');
    const cliFile = fs.readFileSync(path.resolve(__dirname, '../../../src/one/cli/OneDeveloperCLI.ts'), 'utf-8');

    const allCode = diagFile + stdFile + fmtFile + lspFile + cliFile;
    const hasFunctionCtor = /new\s+Function\s*\(/.test(allCode);
    assert('DX59: Zero usage of new Function() across all new Phase 4 DX modules', !hasFunctionCtor);
  }

  {
    // End-to-end DX: format raw code, check it, run it, verify result
    const rawApp = 'function square(x){return x*x}\nlet res=square(9)';
    const formattedApp = OneFormatter.format(rawApp);
    const runRes = compiler.execute(formattedApp);
    assert('DX60: End-to-end developer cycle: format raw code, compile, and execute with square(9) === 81',
      formattedApp.includes('function square(x) {') &&
      runRes.vmResult !== undefined &&
      runRes.vmResult.success &&
      runRes.vmResult.globals['res'] === 81);
  }

  // Cleanup temp files
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore temp cleanup errors
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(`  PHASE 4 CONFORMANCE RESULTS: ${passed}/${passed + failed} PASS`);
  console.log('════════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase4Tests().catch((err) => {
  console.error('[FATAL PHASE 4 TEST RUNNER ERROR]', err);
  process.exit(1);
});
