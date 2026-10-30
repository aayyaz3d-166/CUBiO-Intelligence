/**
 * OLTO Frontend Subsystem — Phase 6: AI-Native Application Generation Test Suite
 * ==============================================================================
 * Tests:
 *   1. OltoSchema: Validation of structured JSON schemas (.olto.spec.json)
 *   2. OltoGenerator: Schema to Code & Code to Schema two-way generation
 *   3. OltoGenerator: Intent-to-App Generation (Store, Login, Tasks, Counter)
 *   4. OltoAutoRepair: Self-healing compiler loop (E9001 secret removal, E9002 tag mapping)
 *   5. Echo1Assistant: Integrated assistant queries & diagnostic explanations
 *   6. OneDeveloperCLI: `one olto ai "<prompt>" --out <dest>` end-to-end pipeline
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { OltoSchemaValidator, OltoAppSchema } from '../../src/olto/ai/OltoSchema';
import { OltoGenerator } from '../../src/olto/ai/OltoGenerator';
import { OltoAutoRepair } from '../../src/olto/ai/OltoAutoRepair';
import { OltoCompiler } from '../../src/olto/compiler/index';
import { Echo1Assistant } from '../../src/one/intelligence/echo/Echo1Assistant';
import { OneDeveloperCLI } from '../../src/one/cli/OneDeveloperCLI';

async function runTestSuite() {
  console.log('================================================================================');
  console.log('  OLTO FRONTEND SUBSYSTEM — AI-NATIVE GENERATION & ECHO-1 BRIDGE (PHASE 6)');
  console.log('================================================================================\n');

  const tempDir = path.resolve('temp_olto_ai_test');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  try {
    // ── Test 1: OltoSchema Validation ──────────────────────────────────────
    console.log('[Test 1] Testing OltoSchemaValidator on valid and invalid schemas...');
    const validSchema: OltoAppSchema = {
      version: '1.0',
      name: 'TestWidget',
      kind: 'component',
      theme: 'dark',
      state: [{ name: 'count', type: 'number', initial: 0 }],
      layout: {
        component: 'Container',
        props: { padding: 16 },
        children: [{ component: 'Text', props: { text: 'Hello OLTO' } }]
      }
    };

    const validCheck = OltoSchemaValidator.validate(validSchema);
    assert.strictEqual(validCheck.valid, true, 'Valid schema must pass validation');

    const invalidSchema = {
      version: '2.0',
      name: 'lowercaseName',
      state: 'not-an-array',
    };
    const invalidCheck = OltoSchemaValidator.validate(invalidSchema);
    assert.strictEqual(invalidCheck.valid, false, 'Invalid schema must fail validation');
    assert.ok(invalidCheck.errors.length >= 2, 'Validator must catch multiple schema errors');
    console.log('  ✓ Structured JSON Schema validation verified.\n');

    // ── Test 2: Two-Way Transpiler (Schema to Code & Code to Schema) ────────
    console.log('[Test 2] Testing OltoGenerator: Schema to Code & Code to Schema...');
    const generatedCode = OltoGenerator.schemaToCode(validSchema);
    assert.ok(generatedCode.includes('component TestWidget {'), 'Code must declare component TestWidget');
    assert.ok(generatedCode.includes('state count: number = 0;'), 'Code must declare reactive state');
    assert.ok(generatedCode.includes('Container(padding: 16)'), 'Code must render layout tree');

    // Compile generated code through real OLTO compiler
    const compileRes = OltoCompiler.compile(generatedCode);
    assert.strictEqual(compileRes.success, true, 'Generated OLTO code must compile cleanly without errors');
    console.log('  ✓ Schema successfully lowered to valid, compilable .olto source code.\n');

    // ── Test 3: Natural Language Intent Generators ────────────────────────
    console.log('[Test 3] Testing Natural Language Intent Generators (Store, Login, Tasks)...');
    const storeSchema = OltoGenerator.generateFromIntent('Build an online ecommerce store with cart');
    assert.strictEqual(storeSchema.name, 'StoreApp');
    assert.ok(storeSchema.state.some(s => s.name === 'cartCount'));
    const storeCode = OltoGenerator.schemaToCode(storeSchema);
    const storeCompile = OltoCompiler.compile(storeCode);
    assert.strictEqual(storeCompile.success, true, 'Store application code must compile cleanly');

    const loginSchema = OltoGenerator.generateFromIntent('Create a user login form');
    assert.strictEqual(loginSchema.name, 'LoginForm');
    const loginCode = OltoGenerator.schemaToCode(loginSchema);
    const loginCompile = OltoCompiler.compile(loginCode);
    assert.strictEqual(loginCompile.success, true, 'Login form code must compile cleanly');
    console.log('  ✓ Intent-driven schemas & compilable code generated for Store and Login forms.\n');

    // ── Test 4: OltoAutoRepair Self-Healing Loop ───────────────────────────
    console.log('[Test 4] Testing OltoAutoRepair: Self-healing compiler loop...');
    // E9001: Client secret exposure
    const leakingCode = `
component LeakingCard {
  state STRIPE_SECRET_KEY: string = "sk_live_998877";
  view {
    Container(padding: 16) {
      Text("Payment Ready")
    }
  }
}
`;
    const secretRepair = OltoAutoRepair.repair(leakingCode);
    assert.strictEqual(secretRepair.repaired, true, 'Auto-repair must detect issue');
    assert.strictEqual(secretRepair.success, true, 'Repaired code must compile successfully');
    assert.ok(!secretRepair.source.includes('sk_live_998877'), 'Secret key must be purged from client source');
    assert.ok(secretRepair.fixedIssues.some(i => i.includes('E9001')), 'Fixed issues list logs E9001 fix');

    // E9002: Unknown tag replacement (Box -> Container, Btn -> Button)
    const badTagsCode = `
component CustomTags {
  state count: number = 0;
  view {
    Box(padding: 16) {
      Btn(label: "Click")
    }
  }
}
`;
    const tagRepair = OltoAutoRepair.repair(badTagsCode);
    assert.strictEqual(tagRepair.repaired, true);
    assert.strictEqual(tagRepair.success, true, 'Repaired tag code must compile cleanly');
    assert.ok(tagRepair.source.includes('Container('));
    assert.ok(tagRepair.source.includes('Button('));

    console.log('  ✓ Self-healing loop automatically patched E9001 (secret exposure) & E9002 (unrecognized tags).\n');

    // ── Test 5: ECHO-1 Assistant Integration ──────────────────────────────
    console.log('[Test 5] Testing Echo1Assistant integration with OLTO...');
    const echo1 = Echo1Assistant.getInstance();

    // Query about OLTO UI
    const askRes = echo1.ask('How do I build a reactive frontend component in OLTO?');
    assert.strictEqual(askRes.epistemicStatus, 'OLTO_AI_GENERATION');
    assert.ok(askRes.codeSnippet && askRes.codeSnippet.includes('component '));
    assert.ok(askRes.romanUrduTip && askRes.romanUrduTip.includes('one olto dev'));

    // Query for E9001 error explanation
    const errExplanation = echo1.explainError('E9001', 'Sensitive secret in state', 'state STRIPE_KEY = 1;');
    assert.ok(errExplanation.includes('Security Guard Violation (E9001)'));
    assert.ok(errExplanation.includes('backend .one service'));

    console.log('  ✓ ECHO-1 Assistant queries and error explanations confirmed.\n');

    // ── Test 6: CLI `one olto ai` End-to-End Execution ────────────────────
    console.log('[Test 6] Testing OneDeveloperCLI: one olto ai "<prompt>" --out <dest>...');
    const generatedFilePath = path.join(tempDir, 'AiStore.olto');
    const cliRes = OneDeveloperCLI.run([
      'olto',
      'ai',
      'Create an ecommerce store for electronics',
      '--out',
      generatedFilePath,
    ]);

    assert.strictEqual(cliRes.exitCode, 0, 'CLI ai command must return exitCode 0');
    assert.ok(cliRes.stdout.includes('Successfully generated sovereign OLTO application!'));
    assert.ok(fs.existsSync(generatedFilePath), 'Output .olto file must exist on disk');

    // Check with one olto check
    const checkRes = OneDeveloperCLI.run(['olto', 'check', generatedFilePath]);
    assert.strictEqual(checkRes.exitCode, 0, 'AI generated application must pass `one olto check` with 0 errors');
    console.log('  ✓ CLI end-to-end generation and validation workflow PASSED.\n');

    console.log('================================================================================');
    console.log('  ALL 6 OLTO AI-NATIVE GENERATION TEST SUITES PASSED (100%)');
    console.log('================================================================================');
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

runTestSuite().catch((err) => {
  console.error('\n❌ OLTO AI Test Suite Failed:');
  console.error(err);
  process.exit(1);
});
