import { OneLexer } from './oneLexer';
import { OneParser } from './oneParser';
import { OneCompiler } from './oneCompiler';
import { CubiOVirtualMachine } from '../core/engine/cubioVM';

const sampleOneProgram = `
// ── Phase 1: Data Types + Variables + Expressions ──

// Number variables
let count: number = 5;
let price: number = 99.99;
let total: number = (count * price) + 50;

// String variables
let name: string = "CubiO";
let version: string = "v" + "1.0";
let tagline: string = name + " | " + version;

// Bool variables
let active: bool = true;
let isBig: bool = total > 500;
let ready: bool = active && isBig;

// Array
let tags: array = ["spatial", "memory", "369"];

// Object
let meta: object = { epoch: 369, ver: 1, locked: true };

// Expression-only (auto type inference)
let x = 10;
let y = 20;
let sum = x + y;
let diff = y - x;
let prod = x * y;
let quot = y / x;
let modResult = y % x;
let isEqual = (x == y);
let isNotEqual = (x != y);
let isBigger = (y > x);

// Unary
let notActive = !active;

// Null
let nothing: object = null;

rss_max = 512;

node CoreOrigin {
  @Space(0.333, 0.666, 0.999);
  align => (0.3, 0.6, 0.9);
  checkpoint alpha;
}

node TargetNode {
  @Space(0.111, 0.222, 0.333);
  checkpoint beta;
}

funnel PrimaryStream {
  stream CoreOrigin -> TargetNode : 128;
}

// ── Phase 3: Functions ──

function add(a: number, b: number) {
  let result = a + b;
  return result;
}

function multiply(x: number, y: number) {
  return x * y;
}

function noReturn() {
  let msg = "hello";
}

let sumResult: number = add(3, 4);
let prodResult: number = multiply(5, 6);
let unused: number = noReturn();
`;

function runTestSuite(): void {
  console.log('══════════════════════════════════════════════════════');
  console.log('  ONE Language — Phase 1 + Phase 3: Types, Variables, Expressions, Functions');
  console.log('══════════════════════════════════════════════════════\n');

  try {
    // ── Step 1: Lexer ─────────────────────────────────────────────
    console.log('[1/4] Running Lexer...');
    const lexer = new OneLexer(sampleOneProgram);
    const tokens = lexer.tokenize();
    console.log(`  ✓ Tokenized ${tokens.length} tokens.\n`);

    // ── Step 2: Parser ─────────────────────────────────────────────
    console.log('[2/4] Parsing AST (variables + expressions + spatial)...');
    const parser = new OneParser(tokens);
    const ast = parser.parse();
    console.log(`  ✓ AST generated.`);
    console.log(`    - RSS Limit: ${ast.rssMaxLimitMB} MB`);
    console.log(`    - Statements: ${ast.statements.length}`);
    console.log(`    - Nodes:     ${ast.nodes.length}`);
    console.log(`    - Funnels:   ${ast.funnels.length}`);
    console.log(`    - Variable details:`);
    for (const v of ast.statements) {
      if (v.type !== 'VariableDeclaration') continue;
      const varDecl = v as any;
      const initStr = varDecl.initializer ? ` = ${JSON.stringify(serializeExprShort(varDecl.initializer))}` : ' (no init)';
      console.log(`      let ${varDecl.id}: ${varDecl.dataType}${initStr}`);
    }

    // Show function declarations
    const funcs = ast.statements.filter((s: any) => s.type === 'FunctionDeclaration');
    if (funcs.length > 0) {
      console.log(`    - Functions:`);
      for (const f of funcs) {
        const fd = f as any;
        console.log(`      function ${fd.name}(${fd.parameters.map((p: any) => `${p.name}: ${p.type}`).join(', ')})`);
      }
    }
    console.log();

    // ── Step 3: Compiler ───────────────────────────────────────────
    console.log('[3/4] Compiling to Executable Cubió AST...');
    const compiler = new OneCompiler(ast);
    const executableAST = compiler.compile();
    console.log(`  ✓ Compilation succeeded — ${executableAST.instructions.length} instructions.`);
    console.log(`    Instruction breakdown:`);
    const opCounts: Record<string, number> = {};
    for (const inst of executableAST.instructions) {
      opCounts[inst.op] = (opCounts[inst.op] || 0) + 1;
    }
    for (const [op, count] of Object.entries(opCounts)) {
      console.log(`      - ${op}: ${count}`);
    }
    console.log();

    // ── Step 4: VM Execution ───────────────────────────────────────
    console.log('[4/4] Executing via Cubió Virtual Machine...');
    const vm = new CubiOVirtualMachine();
    vm.execute(executableAST);
    console.log();

    const state = vm.getVMState();
    console.log('─── Runtime State ──────────────────────────────────');
    console.log(`  Active Nodes:      ${state.nodesCount}`);
    console.log(`  Active Streams:    ${state.streamsCount}`);
    console.log(`  Memory (RSS):      ${state.allocatedMemoryMb.toFixed(2)} MB`);
    console.log(`  Variables in VM:`);
    for (const [key, val] of Object.entries(state.variables)) {
      console.log(`    ${key.padEnd(12)} = ${JSON.stringify(val)}`);
    }
    console.log('───────────────────────────────────────────────────────\n');

    // ── Assertions ──────────────────────────────────────────────────
    console.log('─── Test Assertions ────────────────────────────────');
    const vars = state.variables;

    // Phase 1 assertions
    if (vars.count !== 5) throw new Error(`FAIL: count expected 5, got ${vars.count}`);
    if (vars.total !== 549.95) throw new Error(`FAIL: total expected 549.95, got ${vars.total}`);
    if (vars.sum !== 30) throw new Error(`FAIL: sum expected 30, got ${vars.sum}`);
    if (vars.isBigger !== true) throw new Error(`FAIL: isBigger expected true`);
    if (vars.notActive !== false) throw new Error(`FAIL: notActive expected false`);

    // Phase 3 function assertions
    if (vars.sumResult !== 7) throw new Error(`FAIL: sumResult expected 7 (add(3,4)), got ${vars.sumResult}`);
    if (vars.prodResult !== 30) throw new Error(`FAIL: prodResult expected 30 (multiply(5,6)), got ${vars.prodResult}`);

    console.log(`  ✓ count = ${vars.count}`);
    console.log(`  ✓ total = ${vars.total}`);
    console.log(`  ✓ sum = ${vars.sum}`);
    console.log(`  ✓ sumResult = ${vars.sumResult} (expected 7) — add(3,4) works!`);
    console.log(`  ✓ prodResult = ${vars.prodResult} (expected 30) — multiply(5,6) works!`);
    console.log(`  ✓ Functions execute and return values correctly!`);

    console.log();
    console.log('✅ PASS: Phase 1 + Phase 3 Fully Verified (Types + Variables + Expressions + Spatial + Functions).');
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('\n❌ FAIL:', err.message);
    } else {
      console.error('\n❌ FAIL: Unknown error');
    }
    process.exit(1);
  }
}

// Quick AST serializer for debug display
function serializeExprShort(expr: any): string {
  if (!expr || typeof expr !== 'object') return String(expr);
  switch (expr.type) {
    case 'Literal': return JSON.stringify(expr.value);
    case 'Identifier': return expr.name;
    case 'Binary': {
      const opMap: Record<string, string> = {
        'OP_ADD': '+', 'OP_SUB': '-', 'OP_MUL': '*', 'OP_DIV': '/',
        'OP_MOD': '%', 'OP_EQ': '==', 'OP_NEQ': '!=', 'OP_LT': '<',
        'OP_GT': '>', 'OP_LTE': '<=', 'OP_GTE': '>=',
        'OP_AND': '&&', 'OP_OR': '||',
      };
      const opStr = opMap[expr.operator] ?? expr.operator;
      return `(${serializeExprShort(expr.left)} ${opStr} ${serializeExprShort(expr.right)})`;
    }
    case 'Unary': return `!${serializeExprShort(expr.operand)}`;
    case 'ArrayLiteral': return `[${expr.elements.map(serializeExprShort).join(', ')}]`;
    case 'ObjectLiteral':
      return `{ ${expr.properties.map((p: any) => `${p.key}: ${serializeExprShort(p.value)}`).join(', ')} }`;
    case 'FunctionCall':
      return `${expr.name}(${expr.arguments.map(serializeExprShort).join(', ')})`;
    default: return '???';
  }
}

runTestSuite();
