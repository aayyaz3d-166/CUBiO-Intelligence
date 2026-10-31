/**
 * ONE LANGUAGE — SPECIFICATION CONFORMANCE TEST SUITE v0.1
 * Module: Phase 1 Specification Lock Conformance
 * Path: scratch/cubio_neural_lattice/tests/test_phase1_specification_conformance.ts
 *
 * Verifies the canonical contracts established in docs/ONE_LANGUAGE_SPEC_v0.1.md:
 *  - C01..C05: Lexer Token Conformance & Keyword Mapping
 *  - C06..C10: Parser Grammar Conformance (Directives, Nodes, Streams, Slices)
 *  - C11..C15: AST Structure & Semantic Invariant Enforcement (Duplicate IDs, Undefined Targets)
 *  - C16..C20: Spatial Bounds Normalization & Discrete Voxel Quantization
 *  - C21..C25: Memory Ceiling Enforcement & Fail-Closed Static Rejection
 *  - C26..C30: Virtual Machine Execution, Zero-Copy Buffers & Deterministic Snapshot Sealing
 *  - C31..C35: Canonical Address369 Bijective Mapping & Actuation Lock Invariance
 */

import { OneLexer, TokenType } from '../../../src/one/oneLexer';
import { OneParser } from '../../../src/one/oneParser';
import { OneCompiler } from '../../../src/one/oneCompiler';
import { CubiOVirtualMachine } from '../../../src/core/engine/cubioVM';
import { CanonicalAddress369 } from '../../../src/one/address369_canonical';

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

function runConformanceTests(): void {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  ONE LANGUAGE v0.1 — SPECIFICATION CONFORMANCE TEST SUITE');
  console.log('════════════════════════════════════════════════════════════════\n');

  // ── C01..C05: Lexer Token Conformance ──────────────────────────────────────
  const sampleTokens = new OneLexer('node Alpha { @Space(0.1, 0.2, 0.3); @Grid777(1, 2, 3); }').tokenize();
  assert('C01: Lexer tokenizes node keyword and identifiers',
    sampleTokens[0].type === TokenType.KEYWORD_NODE && sampleTokens[1].value === 'Alpha');

  const directiveTokens = new OneLexer('rss_max = 512; @assert_rss(256); @actuation_lock(true);').tokenize();
  assert('C02: Lexer recognizes memory and actuation lock directives',
    directiveTokens.some(t => t.type === TokenType.KEYWORD_RSS_MAX) &&
    directiveTokens.some(t => t.type === TokenType.KEYWORD_ASSERT_RSS) &&
    directiveTokens.some(t => t.type === TokenType.KEYWORD_ACTUATION_LOCK));

  const plannedKeywords = new OneLexer('module struct let const function if else for Int32 Float32').tokenize();
  assert('C03: Lexer recognizes specified future computational keywords',
    plannedKeywords.some(t => t.type === TokenType.KEYWORD_MODULE) &&
    plannedKeywords.some(t => t.type === TokenType.KEYWORD_STRUCT) &&
    plannedKeywords.some(t => t.type === TokenType.KEYWORD_LET) &&
    plannedKeywords.some(t => t.type === TokenType.TYPE_INT32));

  const commentStripping = new OneLexer('// Single line comment\nrss_max = 512;').tokenize();
  assert('C04: Lexer correctly strips single-line comments',
    commentStripping[0].type === TokenType.KEYWORD_RSS_MAX && commentStripping[0].line === 2);

  const literalsTokens = new OneLexer('0.618f "snapshot.3dmemory" true false').tokenize();
  assert('C05: Lexer correctly identifies float, string, and boolean literals',
    literalsTokens[0].type === TokenType.NUMBER_LITERAL &&
    literalsTokens[1].type === TokenType.STRING_LITERAL &&
    literalsTokens[2].type === TokenType.KEYWORD_TRUE);

  // ── C06..C10: Parser Grammar Conformance ───────────────────────────────────
  const validDsl = `
    rss_max = 512;
    @assert_rss(256);
    @actuation_lock(true);
    seal "root.3dmemory";
    @Slice ([0.0..0.5, 0.1..0.6, 0.2..0.7]);
    node CoreAlpha {
      @Space(0.1, 0.2, 0.3);
      @Grid777(0, 1, 2);
      @memview(32);
      align => (0.15, 0.25, 0.35);
      checkpoint cp1;
      seal "node_alpha.3dmemory";
    }
    node CoreBeta {
      @Space(0.8, 0.8, 0.8);
      checkpoint cp2;
    }
    funnel StreamAB {
      stream CoreAlpha -> CoreBeta : 64;
      @gossip(9);
    }
    channel BroadcastChannel {
      stream CoreAlpha -> CoreBeta : 16;
      @gossip(3);
    }
  `;

  const ast = new OneParser(new OneLexer(validDsl).tokenize()).parse();
  assert('C06: Parser constructs ProgramNode with memory limits',
    ast.type === 'Program' && ast.rssMaxLimitMB === 512 && ast.assertRssLimitMB === 256);

  assert('C07: Parser captures actuation lock boolean state',
    ast.actuationLock === true);

  assert('C08: Parser constructs NodeDeclarationNode with properties',
    ast.nodes.length === 2 &&
    ast.nodes[0].id === 'CoreAlpha' &&
    ast.nodes[0].coordinate.x === 0.0 &&
    ast.nodes[0].grid777?.cellIndex === 105 &&
    ast.nodes[0].memViewBytes === 32 * 1024 * 1024);

  assert('C09: Parser constructs FunnelDeclarationNode and ChannelDeclarationNode',
    ast.funnels.length === 1 && ast.channels.length === 1 &&
    ast.funnels[0].sourceNode === 'CoreAlpha' && ast.funnels[0].bufferMb === 64 &&
    ast.channels[0].priority === 3);

  assert('C10: Parser constructs SpatialSliceNode with range tuples',
    ast.slices.length === 1 &&
    ast.slices[0].xRange.min === 0.0 && ast.slices[0].xRange.max === 0.5);

  // ── C11..C15: AST & Semantic Invariants ────────────────────────────────────
  let duplicateRejected = false;
  try {
    const dupSrc = 'node DuplicateNode { @Space(0.1, 0.2, 0.3); } node DuplicateNode { @Space(0.4, 0.5, 0.6); }';
    new OneCompiler(new OneParser(new OneLexer(dupSrc).tokenize()).parse()).compile();
  } catch (e: any) {
    if (e.message.includes('Duplicate spatial node identifier')) duplicateRejected = true;
  }
  assert('C11: Compiler rejects duplicate node identifiers', duplicateRejected);

  let undefinedEndpointRejected = false;
  try {
    const unresSrc = 'node ValidNode { @Space(0.1, 0.2, 0.3); } funnel Pipe { stream ValidNode -> NonExistent : 32; }';
    new OneCompiler(new OneParser(new OneLexer(unresSrc).tokenize()).parse()).compile();
  } catch (e: any) {
    if (e.message.includes('references undefined target node')) undefinedEndpointRejected = true;
  }
  assert('C12: Compiler rejects unresolved stream endpoints', undefinedEndpointRejected);

  let syntaxErrorThrown = false;
  try {
    new OneParser(new OneLexer('node BrokenNode { @Space(0.1, 0.2); }').tokenize()).parse();
  } catch (e: any) {
    if (e.message.includes('[Parser Error]')) syntaxErrorThrown = true;
  }
  assert('C13: Parser throws diagnostic error on malformed coordinate', syntaxErrorThrown);

  let unclosedBraceRejected = false;
  try {
    new OneParser(new OneLexer('node UnclosedNode { @Space(0.1, 0.2, 0.3);').tokenize()).parse();
  } catch (e: any) {
    if (e.message.includes('[Parser Error]')) unclosedBraceRejected = true;
  }
  assert('C14: Parser throws diagnostic error on unclosed block delimiter', unclosedBraceRejected);

  const compiler = new OneCompiler(ast);
  const executableAST = compiler.compile();
  assert('C15: Compiler lowers valid AST into ExecutableCubiOAST package',
    executableAST.instructions.length > 0 && executableAST.spatialNodesCount === 2);

  // ── C16..C20: Spatial Bounds Normalization & Discrete Voxel Quantization ───
  let outOfBoundsRejected = false;
  try {
    const oobSrc = 'node InvalidNode { @Space(1.5, 0.2, 0.3); }';
    new OneCompiler(new OneParser(new OneLexer(oobSrc).tokenize()).parse()).compile();
  } catch (e: any) {
    if (e.message.includes('Spatial Bound Violation')) outOfBoundsRejected = true;
  }
  assert('C16: Compiler enforces spatial bounds normalization ([0.0, 1.0])', outOfBoundsRejected);

  let gridOobRejected = false;
  try {
    new OneParser(new OneLexer('node BadGrid { @Grid777(7, 0, 0); }').tokenize()).parse();
  } catch (e: any) {
    if (e.message.includes('0..6 discrete lattice')) gridOobRejected = true;
  }
  assert('C17: Parser enforces discrete 7x7x7 voxel bounds ([0..6])', gridOobRejected);

  const quantized = OneCompiler.quantize777(0.5, 1.0, 0.333);
  assert('C18: Quantization quantize777 maps continuous coord to discrete voxel',
    quantized.i === 3 && quantized.j === 6 && quantized.k === 2 && quantized.cellIndex === 143);

  const unquantized = OneCompiler.unquantize777(143);
  assert('C19: Unquantization unquantize777 restores normalized coordinates',
    unquantized.x === 0.5 && unquantized.y === 1.0 && Math.abs(unquantized.z - 0.333333) < 1e-5);

  let invalidCellIndexRejected = false;
  try {
    OneCompiler.unquantize777(343);
  } catch (e: any) {
    if (e.message.includes('outside 0..342 bounds')) invalidCellIndexRejected = true;
  }
  assert('C20: unquantize777 rejects cell index >= 343', invalidCellIndexRejected);

  // ── C21..C25: Memory Ceiling Enforcement & Fail-Closed Static Rejection ────
  let hardRssExceededRejected = false;
  try {
    const overRss = 'rss_max = 1024; node A { @Space(0.1, 0.2, 0.3); }';
    new OneCompiler(new OneParser(new OneLexer(overRss).tokenize()).parse()).compile();
  } catch (e: any) {
    if (e.message.includes('exceeding hard physical threshold of 512 MB')) hardRssExceededRejected = true;
  }
  assert('C21: Compiler rejects rss_max > 512 MB hard physical limit', hardRssExceededRejected);

  let staticBudgetExceededRejected = false;
  try {
    const bigBuffer = 'rss_max = 64; node A { @Space(0.1, 0.2, 0.3); } node B { @Space(0.4, 0.5, 0.6); } funnel F { stream A -> B : 128; }';
    new OneCompiler(new OneParser(new OneLexer(bigBuffer).tokenize()).parse()).compile();
  } catch (e: any) {
    if (e.message.includes('exceed declared memory constraint')) staticBudgetExceededRejected = true;
  }
  assert('C22: Compiler rejects static allocations exceeding declared budget', staticBudgetExceededRejected);

  assert('C23: Executable AST contains SET_RSS_GUARD instruction',
    executableAST.instructions.some(i => i.op === 'SET_RSS_GUARD'));

  assert('C24: Executable AST contains MAP_ZERO_COPY_VIEW instruction',
    executableAST.instructions.some(i => i.op === 'MAP_ZERO_COPY_VIEW'));

  assert('C25: Executable AST contains SEAL_CRYPTOGRAPHIC_SNAPSHOT instruction',
    executableAST.instructions.some(i => i.op === 'SEAL_CRYPTOGRAPHIC_SNAPSHOT'));

  // ── C26..C30: VM Execution, Zero-Copy Buffers & Deterministic Snapshot Sealing ──
  const vm = new CubiOVirtualMachine();
  vm.execute(executableAST);
  const vmState = vm.getVMState();

  assert('C26: VM executes instruction stream and registers active nodes',
    vmState.nodesCount === 2);

  assert('C27: VM executes streaming funnels and records memory allocations',
    vmState.streamsCount === 2 && vmState.allocatedMemoryMb > 0 && vmState.allocatedMemoryMb <= 512);

  assert('C28: VM execution exhibits zero determinism variance (sigma^2 = 0.0)',
    vmState.determinismSigmaSq === 0.0);

  assert('C29: VM spatial slice queries match expected count in bounding box',
    vmState.slicesCount === 1);

  const sealedSnapshots = vm.getSealedSnapshots();
  assert('C30: VM generates deterministic 0x369_*_SEAL cryptographic snapshot hashes',
    sealedSnapshots.size >= 2 && Array.from(sealedSnapshots.values()).every(h => /^0x369_[0-9a-f]{8}_SEAL$/.test(h)));

  // ── C31..C35: Canonical Address369 Bijective Mapping & Actuation Lock ─────
  assert('C31: CanonicalAddress369 defines 369 total slots (26 symbolic + 343 spatial)',
    CanonicalAddress369.TOTAL_ADDRESSES === 369 &&
    CanonicalAddress369.SYMBOLIC_COUNT === 26 &&
    CanonicalAddress369.SPATIAL_COUNT === 343);

  assert('C32: CanonicalAddress369 converts internal [0..368] to UI Display Index [1..369]',
    CanonicalAddress369.toDisplayIndex(0) === 1 &&
    CanonicalAddress369.toDisplayIndex(368) === 369 &&
    CanonicalAddress369.fromDisplayIndex(369) === 368);

  const originVoxelAddr = CanonicalAddress369.spatialCoordToCanonicalAddress(3, 3, 3);
  assert('C33: Center voxel (3, 3, 3) maps to canonical spatial address 197',
    originVoxelAddr === 197);

  const originCoords = CanonicalAddress369.canonicalAddressToSpatialCoord(197);
  assert('C34: Canonical address 197 maps back to center voxel (3, 3, 3)',
    originCoords.i === 3 && originCoords.j === 3 && originCoords.k === 3);

  const addrInspection = CanonicalAddress369.inspectAddress(0);
  assert('C35: Address 0 inspects as SYMBOLIC register A with correct display tag',
    addrInspection.layer === 'SYMBOLIC' &&
    addrInspection.symbolicKey === 'SYM_A_00' &&
    addrInspection.displayIndex === 1);

  printSummary();
}

function printSummary(): void {
  const total = passed + failed;
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(`  PHASE 1 SPECIFICATION CONFORMANCE RESULTS: ${passed}/${total} PASS`);
  if (failed > 0) {
    console.log('\n  Failed Assertions:');
    errors.forEach(e => console.log(`    ❌ ${e}`));
  }
  console.log('════════════════════════════════════════════════════════════════\n');
  if (failed > 0) process.exit(1);
}

runConformanceTests();
