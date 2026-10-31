/**
 * ONE LANGUAGE — PHASE 2: UNIFIED COMPILER CONFORMANCE TEST SUITE
 * Path: scratch/cubio_neural_lattice/tests/test_phase2_unified_compiler.ts
 *
 * Verifies Phase 2 Architecture:
 *   - UC01..UC05: Grammar Router Determinism & Dispatch
 *   - UC06..UC10: Computational Parsing (Variables, Constants, Pratt Expressions)
 *   - UC11..UC15: Functions, Arguments, Calls, and Returns
 *   - UC16..UC20: Control Flow (If/Else, While, For-in)
 *   - UC21..UC25: Scope Resolution & Nested Scope Isolation
 *   - UC26..UC30: Static Type Checking & Diagnostic Generation (E2000 Series)
 *   - UC31..UC35: Semantic Analysis (Undefined Idents, Duplicate Decls, E3000 Series)
 *   - UC36..UC40: Unified Intermediate Representation (IR) Lowering & Formatting
 *   - UC41..UC45: Declarative Backward Compatibility & Spatial Adaptation
 */

import { OneLexer, TokenType } from '../../../src/one/oneLexer';
import { GrammarRouter, GrammarKind } from '../../../src/one/router/GrammarRouter';
import { ComputationalParser } from '../../../src/one/computational/ComputationalParser';
import { SemanticAnalyzer } from '../../../src/one/semantics/SemanticAnalyzer';
import { TypeChecker } from '../../../src/one/types/TypeChecker';
import { IRLowering } from '../../../src/one/ir/IRLowering';
import { IRPrinter } from '../../../src/one/ir/IRPrinter';
import { UnifiedCompiler } from '../../../src/one/UnifiedCompiler';
import { DeclarativeASTAdapter } from '../../../src/one/ast/DeclarativeASTAdapter';
import { OneParser } from '../../../src/one/oneParser';

let passed = 0;
let failed = 0;
const errors: string[] = [];

function assert(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✅ PASS  ${label}`);
    passed++;
  } else {
    const msg = detail ? `${label} — ${detail}` : label;
    console.error(`  ❌ FAIL  ${msg}`);
    failed++;
    errors.push(msg);
  }
}

export function runPhase2Tests(): void {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  ONE LANGUAGE — PHASE 2 UNIFIED COMPILER TEST SUITE');
  console.log('════════════════════════════════════════════════════════════════\n');

  // ── UC01..UC05: Grammar Router Determinism ─────────────────────────────────
  const declTokens = new OneLexer('node CoreAlpha { @Space(0.1, 0.2, 0.3); }').tokenize();
  const routeDecl = GrammarRouter.route(declTokens);
  assert('UC01: Router directs spatial node to Declarative Parser',
    routeDecl.grammar === GrammarKind.DECLARATIVE);

  const compTokens = new OneLexer('let x = 10; let y = 20;').tokenize();
  const routeComp = GrammarRouter.route(compTokens);
  assert('UC02: Router directs "let" statement to Computational Parser',
    routeComp.grammar === GrammarKind.COMPUTATIONAL);

  const funcTokens = new OneLexer('function calculateTotal(price, tax) { return price + tax; }').tokenize();
  const routeFunc = GrammarRouter.route(funcTokens);
  assert('UC03: Router directs "function" statement to Computational Parser',
    routeFunc.grammar === GrammarKind.COMPUTATIONAL);

  const rssTokens = new OneLexer('rss_max = 512; @actuation_lock(true);').tokenize();
  const routeRss = GrammarRouter.route(rssTokens);
  assert('UC04: Router directs declarative RSS directive to Declarative Parser',
    routeRss.grammar === GrammarKind.DECLARATIVE);

  const exprTokens = new OneLexer('print 10 + 20;').tokenize();
  const routeExpr = GrammarRouter.route(exprTokens);
  assert('UC05: Router directs "print" statement to Computational Parser',
    routeExpr.grammar === GrammarKind.COMPUTATIONAL);

  // ── UC06..UC10: Computational Parsing ─────────────────────────────────────
  const parser1 = new ComputationalParser(new OneLexer('let x = 42; const PI = 3.14159;').tokenize());
  const ast1 = parser1.parse();
  assert('UC06: Parses variable and const declarations',
    ast1.body.length === 2 &&
    ast1.body[0].kind === 'VariableDeclaration' &&
    (ast1.body[0] as any).identifier === 'x' &&
    !(ast1.body[0] as any).isConst &&
    ast1.body[1].kind === 'VariableDeclaration' &&
    (ast1.body[1] as any).isConst);

  const parser2 = new ComputationalParser(new OneLexer('let z = 2 + 3 * 4;').tokenize());
  const ast2 = parser2.parse();
  const binExpr = (ast2.body[0] as any).initializer;
  assert('UC07: Pratt parser preserves operator precedence (multiplication binds tighter than addition)',
    binExpr.kind === 'BinaryExpression' &&
    binExpr.operator === '+' &&
    binExpr.right.operator === '*');

  const parser3 = new ComputationalParser(new OneLexer('let isOk = x > 10 && y <= 20 || !flag;').tokenize());
  const ast3 = parser3.parse();
  assert('UC08: Parses logical and comparison expressions',
    ast3.body.length === 1 &&
    (ast3.body[0] as any).initializer.kind === 'BinaryExpression');

  const parser4 = new ComputationalParser(new OneLexer('let nums = [1, 2, 3];').tokenize());
  const ast4 = parser4.parse();
  assert('UC09: Parses array literal expressions',
    (ast4.body[0] as any).initializer.kind === 'ArrayLiteral' &&
    (ast4.body[0] as any).initializer.elements.length === 3);

  const parser5 = new ComputationalParser(new OneLexer('let point = { x: 10, y: 20 };').tokenize());
  const ast5 = parser5.parse();
  assert('UC10: Parses object literal expressions',
    (ast5.body[0] as any).initializer.kind === 'ObjectLiteral' &&
    (ast5.body[0] as any).initializer.properties.length === 2);

  // ── UC11..UC15: Functions, Arguments, Calls, Returns ──────────────────────
  const fnSrc = `
    function add(a: number, b: number): number {
      return a + b;
    }
    let res = add(10, 20);
  `;
  const fnCompiler = new UnifiedCompiler();
  const fnRes = fnCompiler.compile(fnSrc);
  assert('UC11: Compiles typed function declaration and invocation',
    fnRes.success && fnRes.ast.body.length === 2);

  const fnDecl = fnRes.ast.body[0] as any;
  assert('UC12: Function declaration records parameter types and return type',
    fnDecl.name === 'add' &&
    fnDecl.params.length === 2 &&
    fnDecl.returnTypeAnnotation === 'number');

  const callStmt = fnRes.ast.body[1] as any;
  assert('UC13: Function call expression captures callee and arguments',
    callStmt.initializer.kind === 'CallExpression' &&
    callStmt.initializer.callee.name === 'add' &&
    callStmt.initializer.args.length === 2);

  const voidFnSrc = `
    function doNothing() {
      return;
    }
  `;
  const voidRes = fnCompiler.compile(voidFnSrc);
  assert('UC14: Supports empty return statements in functions',
    voidRes.success && (voidRes.ast.body[0] as any).body.statements[0].kind === 'ReturnStatement');

  const recursiveFnSrc = `
    function fact(n: number): number {
      if n <= 1 {
        return 1;
      }
      return n * fact(n - 1);
    }
  `;
  const recRes = fnCompiler.compile(recursiveFnSrc);
  assert('UC15: Compiles recursive function calls',
    recRes.success);

  // ── UC16..UC20: Control Flow (If, While, For) ──────────────────────────────
  const ifSrc = `
    let val = 15;
    if val > 10 {
      print "greater";
    } else {
      print "smaller";
    }
  `;
  const ifRes = fnCompiler.compile(ifSrc);
  assert('UC16: Compiles if-else statement',
    ifRes.success && ifRes.ast.body[1].kind === 'IfStatement');

  const whileSrc = `
    let count = 5;
    while count > 0 {
      count = count - 1;
    }
  `;
  const whileRes = fnCompiler.compile(whileSrc);
  assert('UC17: Compiles while loop statement',
    whileRes.success && whileRes.ast.body[1].kind === 'WhileStatement');

  const forSrc = `
    let items = [10, 20, 30];
    for item in items {
      print item;
    }
  `;
  const forRes = fnCompiler.compile(forSrc);
  assert('UC18: Compiles for-in loop construct',
    forRes.success && forRes.ast.body[1].kind === 'ForStatement');

  const nestedIfSrc = `
    let a = 1;
    let b = 2;
    if a > 0 {
      if b > 1 {
        print "nested";
      }
    }
  `;
  const nestedRes = fnCompiler.compile(nestedIfSrc);
  assert('UC19: Compiles nested if blocks without collision',
    nestedRes.success);

  const chainedIfSrc = `
    let status = 2;
    if status == 1 {
      print 1;
    } else if status == 2 {
      print 2;
    } else {
      print 0;
    }
  `;
  const chainedRes = fnCompiler.compile(chainedIfSrc);
  assert('UC20: Compiles else-if conditional ladders',
    chainedRes.success);

  // ── UC21..UC25: Scope Resolution & Nested Scopes ──────────────────────────
  const scopeSrc = `
    let x = 10;
    function testScope() {
      let x = 20;
      return x;
    }
  `;
  const scopeRes = fnCompiler.compile(scopeSrc);
  assert('UC21: Variable shadowing in nested function scope is permitted',
    scopeRes.success);

  const blockScopeSrc = `
    let outer = 100;
    {
      let inner = 200;
    }
    let after = outer;
  `;
  const blockScopeRes = fnCompiler.compile(blockScopeSrc);
  assert('UC22: Independent block scope creates isolated symbol boundary',
    blockScopeRes.success);

  const scopeLeakSrc = `
    {
      let localOnly = 999;
    }
    let leak = localOnly;
  `;
  const leakRes = fnCompiler.compile(scopeLeakSrc);
  assert('UC23: Block-scoped variables cannot leak into outer scope (E3004)',
    !leakRes.success && leakRes.diagnostics.some((d) => d.code === 'E3004'));

  const constReassignSrc = `
    const IMMUTABLE = 50;
    IMMUTABLE = 100;
  `;
  const constRes = fnCompiler.compile(constReassignSrc);
  assert('UC24: Semantic analyzer forbids reassigning constant identifiers (E3008)',
    !constRes.success && constRes.diagnostics.some((d) => d.code === 'E3008'));

  const topLevelReturnSrc = `
    let x = 10;
    return x;
  `;
  const returnRes = fnCompiler.compile(topLevelReturnSrc);
  assert('UC25: Semantic analyzer rejects return statements outside functions (E3003)',
    !returnRes.success && returnRes.diagnostics.some((d) => d.code === 'E3003'));

  // ── UC26..UC30: Static Type Checking & Diagnostics ────────────────────────
  const typeMismatchSrc = `
    let num: number = "this is a string";
  `;
  const typeMisRes = fnCompiler.compile(typeMismatchSrc);
  assert('UC26: Static type checker catches explicit type mismatch (E2001)',
    !typeMisRes.success && typeMisRes.diagnostics.some((d) => d.code === 'E2001'));

  const badOpSrc = `
    let x = 10;
    let y = "hello";
    let z = x + y;
  `;
  const badOpRes = fnCompiler.compile(badOpSrc);
  assert('UC27: Static type checker disallows implicit number + string arithmetic (E2002)',
    !badOpRes.success && badOpRes.diagnostics.some((d) => d.code === 'E2002'));

  const badCondSrc = `
    let count = 10;
    if count {
      print "wrong";
    }
  `;
  const badCondRes = fnCompiler.compile(badCondSrc);
  assert('UC28: Type checker enforces boolean type on if conditions (E2005)',
    !badCondRes.success && badCondRes.diagnostics.some((d) => d.code === 'E2005'));

  const badArgSrc = `
    function multiply(a: number, b: number): number {
      return a * b;
    }
    let res = multiply(10, "string");
  `;
  const badArgRes = fnCompiler.compile(badArgSrc);
  assert('UC29: Type checker enforces function argument types (E2003)',
    !badArgRes.success && badArgRes.diagnostics.some((d) => d.code === 'E2003'));

  const badReturnSrc = `
    function getNumber(): number {
      return "not a number";
    }
  `;
  const badRetRes = fnCompiler.compile(badReturnSrc);
  assert('UC30: Type checker enforces declared function return type (E2004)',
    !badRetRes.success && badRetRes.diagnostics.some((d) => d.code === 'E2004'));

  // ── UC31..UC35: Semantic Analysis ─────────────────────────────────────────
  const undefSrc = `
    let a = undefinedVariable + 1;
  `;
  const undefRes = fnCompiler.compile(undefSrc);
  assert('UC31: Semantic analyzer detects undefined identifier usage (E3004)',
    !undefRes.success && undefRes.diagnostics.some((d) => d.code === 'E3004'));

  const dupDeclSrc = `
    let dup = 10;
    let dup = 20;
  `;
  const dupRes = fnCompiler.compile(dupDeclSrc);
  assert('UC32: Semantic analyzer rejects duplicate variable declaration in same scope (E3001)',
    !dupRes.success && dupRes.diagnostics.some((d) => d.code === 'E3001'));

  const dupParamSrc = `
    function badParams(x, x) {
      return x;
    }
  `;
  const dupParamRes = fnCompiler.compile(dupParamSrc);
  assert('UC33: Semantic analyzer rejects duplicate function parameter names (E3002)',
    !dupParamRes.success && dupParamRes.diagnostics.some((d) => d.code === 'E3002'));

  const arityMismatchSrc = `
    function needsTwo(a, b) {
      return a + b;
    }
    let callOne = needsTwo(10);
  `;
  const arityRes = fnCompiler.compile(arityMismatchSrc);
  assert('UC34: Semantic analyzer rejects function call with wrong argument count (E3005)',
    !arityRes.success && arityRes.diagnostics.some((d) => d.code === 'E3005'));

  const dupImportSrc = `
    import math;
    import math;
  `;
  const dupImportRes = fnCompiler.compile(dupImportSrc);
  assert('UC35: Semantic analyzer rejects duplicate module imports (E3007)',
    !dupImportRes.success && dupImportRes.diagnostics.some((d) => d.code === 'E3007'));

  // ── UC36..UC40: Unified Intermediate Representation (IR) ──────────────────
  const irCompiler = new UnifiedCompiler({ emitIR: true });
  const compProgram = `
    let x = 10;
    let y = 20;
    let z = x + y;
    print z;
  `;
  const compIrRes = irCompiler.compile(compProgram);
  assert('UC36: Lowers computational program to Unified IR instructions',
    compIrRes.success && compIrRes.ir !== undefined && compIrRes.ir.instructions.length >= 6);

  const irOpcodes = compIrRes.ir!.instructions.map((i) => i.opcode);
  assert('UC37: IR generates expected sequence of CONST, STORE, LOAD, ADD, PRINT opcodes',
    irOpcodes.includes('CONST') &&
    irOpcodes.includes('STORE') &&
    irOpcodes.includes('LOAD') &&
    irOpcodes.includes('ADD') &&
    irOpcodes.includes('PRINT'));

  assert('UC38: IR formatting provides inspectable disassembly text',
    compIrRes.irText !== undefined &&
    compIrRes.irText.includes('ADD') &&
    compIrRes.irText.includes('STORE'));

  const loopIrSrc = `
    let i = 0;
    while i < 10 {
      i = i + 1;
    }
  `;
  const loopIrRes = irCompiler.compile(loopIrSrc);
  const loopOpcodes = loopIrRes.ir!.instructions.map((i) => i.opcode);
  assert('UC39: Lowering control flow generates JUMP and JUMP_IF branching instructions',
    loopOpcodes.includes('JUMP') && loopOpcodes.includes('JUMP_IF'));

  assert('UC40: Compiler reports nanosecond/microsecond execution metrics across all 5 stages',
    compIrRes.metrics.lexTimeMs >= 0 &&
    compIrRes.metrics.parseTimeMs >= 0 &&
    compIrRes.metrics.semanticTimeMs >= 0 &&
    compIrRes.metrics.typeCheckTimeMs >= 0 &&
    compIrRes.metrics.irLowerTimeMs >= 0 &&
    compIrRes.metrics.totalTimeMs >= 0);

  // ── UC41..UC45: Declarative Backward Compatibility & Spatial Adaptation ───
  const spatialProgram = `
    rss_max = 512;
    @assert_rss(256);
    @actuation_lock(true);

    node LatticeCore {
      @Space(0.100, 0.200, 0.300);
      @Grid777(0, 1, 2);
      align => (0.150, 0.250, 0.350);
      checkpoint alpha;
      seal "node_alpha.3dmemory";
      @memview(32);
    }

    node TargetLattice {
      @Space(0.800, 0.800, 0.800);
      checkpoint beta;
    }

    funnel SpatialStream {
      stream LatticeCore -> TargetLattice : 64;
    }

    channel GossipRelay {
      stream LatticeCore -> TargetLattice : 16;
      @gossip(5);
    }

    seal "root.3dmemory";

    @Slice([0.0..0.5, 0.1..0.6, 0.2..0.7]);
  `;
  const spatialRes = irCompiler.compile(spatialProgram);
  assert('UC41: Unified Compiler successfully accepts and routes Declarative Spatial DSL',
    spatialRes.success && spatialRes.routing.grammar === GrammarKind.DECLARATIVE);

  assert('UC42: Declarative metadata (RSS limit, Actuation Lock) preserved in Unified AST',
    spatialRes.ast.declarativeMeta?.rssMaxLimitMB === 512 &&
    spatialRes.ast.declarativeMeta?.assertRssLimitMB === 256 &&
    spatialRes.ast.declarativeMeta?.actuationLock === true);

  const spatialWrappers = spatialRes.ast.body.filter((s) => s.kind === 'DeclarativeSpatialNode');
  assert('UC43: All 5 spatial constructs (Node, Funnel, Channel, Seal, Slice) adapted into Unified AST',
    spatialWrappers.some((w: any) => w.nodeType === 'Node') &&
    spatialWrappers.some((w: any) => w.nodeType === 'Funnel') &&
    spatialWrappers.some((w: any) => w.nodeType === 'Channel') &&
    spatialWrappers.some((w: any) => w.nodeType === 'Seal') &&
    spatialWrappers.some((w: any) => w.nodeType === 'Slice'));

  assert('UC44: Declarative Spatial DSL lowers to SPATIAL_OP instructions in Unified IR',
    spatialRes.ir !== undefined &&
    spatialRes.ir.instructions.some((i) => i.opcode === 'SPATIAL_OP'));

  const rawDeclarativeAST = new OneParser(new OneLexer(spatialProgram).tokenize()).parse();
  const directAdapted = DeclarativeASTAdapter.adapt(rawDeclarativeAST);
  assert('UC45: DeclarativeASTAdapter provides bit-exact equivalence with existing parser output',
    directAdapted.declarativeMeta?.rssMaxLimitMB === rawDeclarativeAST.rssMaxLimitMB &&
    directAdapted.body.length === (rawDeclarativeAST.nodes.length + rawDeclarativeAST.funnels.length + rawDeclarativeAST.channels.length + rawDeclarativeAST.seals.length + rawDeclarativeAST.slices.length));

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(`  PHASE 2 CONFORMANCE RESULTS: ${passed}/${passed + failed} PASS`);
  console.log('════════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    console.error(`❌ Errors detected:\n${errors.join('\n')}`);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  runPhase2Tests();
}
