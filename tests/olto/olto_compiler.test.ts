/**
 * OLTO Frontend Subsystem — Compiler & Semantic Verification Suite (Phase 2)
 * ==========================================================================
 * Tests Lexer tokenization, AST generation, semantic validation,
 * security invariant enforcement (E9001), and reference canonical programs.
 */

import { OltoLexer, OltoTokenType } from '../../src/olto/compiler/OltoLexer';
import { OltoParser } from '../../src/olto/compiler/OltoParser';
import { OltoCompiler } from '../../src/olto/compiler/index';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

console.log('================================================================================');
console.log('  OLTO FRONTEND SUBSYSTEM — COMPILER & AST VERIFICATION SUITE');
console.log('================================================================================\n');

// ── Test 1: Lexer Tokenization ──────────────────────────────────────────────
console.log('[Test 1] Lexer Tokenization of Core Keywords & Operators...');
const sampleCode = `component Header(title: String = "Welcome") { state count: Number = 42 }`;
const lexer = new OltoLexer(sampleCode);
const tokens = lexer.tokenize();

assert.strictEqual(tokens[0].type, OltoTokenType.KEYWORD_COMPONENT);
assert.strictEqual(tokens[1].type, OltoTokenType.IDENTIFIER);
assert.strictEqual(tokens[1].value, 'Header');
assert.strictEqual(tokens[2].type, OltoTokenType.LPAREN);
assert.strictEqual(tokens[3].type, OltoTokenType.IDENTIFIER);
assert.strictEqual(tokens[3].value, 'title');
console.log('  ✓ Lexer correctly tokenized keywords, identifiers, and literals.\n');

// ── Test 2: Counter Reference Example AST Parsing ────────────────────────────
console.log('[Test 2] Parsing Canonical Reference: Counter.olto...');
const counterPath = path.resolve('examples/olto/01_counter/Counter.olto');
assert.ok(fs.existsSync(counterPath), 'Counter.olto must exist');
const counterSource = fs.readFileSync(counterPath, 'utf-8');

const counterRes = OltoCompiler.compile(counterSource);
assert.strictEqual(counterRes.success, true, 'Counter.olto must compile with zero errors');
assert.ok(counterRes.ast, 'Must produce valid AST');
assert.strictEqual(counterRes.ast.declarations.length, 1);

const counterComp = counterRes.ast.declarations[0];
assert.strictEqual(counterComp.kind, 'Component');
assert.strictEqual(counterComp.name, 'Counter');
assert.strictEqual(counterComp.state.length, 2); // count, step
assert.strictEqual(counterComp.computed.length, 1); // isPositive
assert.strictEqual(counterComp.view.rootNode.kind, 'ElementNode');
console.log(`  ✓ Counter.olto successfully lowered to AST (State: ${counterComp.state.length}, Computed: ${counterComp.computed.length}).\n`);

// ── Test 3: Store Reference Example AST Parsing ──────────────────────────────
console.log('[Test 3] Parsing Canonical Reference: Store.olto (E-Commerce)...');
const storePath = path.resolve('examples/olto/02_store/Store.olto');
assert.ok(fs.existsSync(storePath), 'Store.olto must exist');
const storeSource = fs.readFileSync(storePath, 'utf-8');

const storeRes = OltoCompiler.compile(storeSource);
if (!storeRes.success) {
  console.error('Store compilation errors:', storeRes.diagnostics);
}
assert.strictEqual(storeRes.success, true, 'Store.olto must compile with zero errors');
assert.ok(storeRes.ast, 'Must produce valid AST');
assert.strictEqual(storeRes.ast.imports.length, 1);
assert.strictEqual(storeRes.ast.imports[0].specifiers[0], 'Course');

const storePage = storeRes.ast.declarations[0];
assert.strictEqual(storePage.kind, 'Page');
assert.strictEqual(storePage.name, 'StorePage');
assert.strictEqual(storePage.hooks.length, 1); // onMount
assert.strictEqual(storePage.actions.length, 1); // enroll
console.log(`  ✓ Store.olto successfully verified with ONE struct import and onMount hook.\n`);

// ── Test 4: Security Invariant E9001 (Secret Key Leakage Prevention) ────────
console.log('[Test 4] Security Invariant: E9001 Client Secret Exposure Guard...');
const insecureSource = `
component PaymentForm() {
    state STRIPE_SECRET_KEY: String = "sk_live_secret_998877"
    view { Text("Payment Ready") }
}
`;
const insecureRes = OltoCompiler.compile(insecureSource);
assert.strictEqual(insecureRes.success, false, 'Insecure code must fail compilation');
const secretDiag = insecureRes.diagnostics.find((d) => d.code === 'E9001');
assert.ok(secretDiag, 'Must emit E9001 diagnostic on client secret exposure');
console.log(`  ✓ Invariant E9001 confirmed: ${secretDiag.message}\n`);

// ── Test 5: Unrecognized Component Guard E9002 ──────────────────────────────
console.log('[Test 5] Component Registry: E9002 Unrecognized Component Error...');
const invalidComponentSource = `
component Dashboard() {
    view {
        UnknownWidget(foo: "bar") {
            Text("Hi")
        }
    }
}
`;
const invalidCompRes = OltoCompiler.compile(invalidComponentSource);
assert.strictEqual(invalidCompRes.success, false, 'Unknown component must fail semantic analysis');
const compDiag = invalidCompRes.diagnostics.find((d) => d.code === 'E9002');
assert.ok(compDiag, 'Must emit E9002 diagnostic on unknown component');
console.log(`  ✓ Component check confirmed: ${compDiag.message}\n`);

// ── Test 6: Computed State Immutability Guard E9003 ──────────────────────────
console.log('[Test 6] Reactivity Safety: E9003 Invalid State Mutation Error...');
const invalidMutationSource = `
component ScoreBoard() {
    state score: Number = 10
    computed doubled: Number = { return score * 2 }

    action cheat() {
        doubled = 100 // ILLEGAL: computed property is read-only
    }

    view { Text("Score") }
}
`;
const invalidMutRes = OltoCompiler.compile(invalidMutationSource);
assert.strictEqual(invalidMutRes.success, false, 'Mutating computed state must fail semantic analysis');
const mutDiag = invalidMutRes.diagnostics.find((d) => d.code === 'E9003');
assert.ok(mutDiag, 'Must emit E9003 diagnostic on computed state mutation');
console.log(`  ✓ Reactivity check confirmed: ${mutDiag.message}\n`);

console.log('================================================================================');
console.log('  ALL 6 OLTO COMPILER & PARSER TEST SUITES PASSED (100%)');
console.log('================================================================================');
