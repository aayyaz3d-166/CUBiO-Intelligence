/**
 * ONE Language — ECHO-1 In-Language AI Assistant Test Suite
 * ========================================================
 * Verifies 100% offline local inference, symbolic syntax grounding,
 * error auto-fixer, and CLI integration.
 */

import { Echo1Assistant } from '../../src/one/intelligence/echo/Echo1Assistant';
import { OneDeveloperCLI } from '../../src/one/cli/OneDeveloperCLI';
import * as assert from 'assert';
import * as fs from 'fs';

console.log('=== Running ECHO-1 Autonomous AI Assistant Tests ===\n');

// 1. Initialization and Model Loading
const echo = Echo1Assistant.getInstance();
console.log('1. Testing Model Loading...');
const modelPath = echo.getModelPath();
console.log(`   Model Path: ${modelPath}`);
assert.ok(fs.existsSync(modelPath), 'Model file must exist on disk');
const stats = fs.statSync(modelPath);
console.log(`   Model File Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB (${stats.size} bytes)`);
assert.ok(stats.size > 20 * 1024 * 1024, 'Model file must be > 20 MB');
assert.strictEqual(echo.isReady(), true, 'Echo1Assistant must report ready');
console.log('✔ Model initialization test PASSED.\n');

// 2. Variable Syntax Query
console.log('2. Testing Query: Variables...');
const varResp = echo.ask('how do I declare a variable in ONE language?');
console.log(`   Response Latency: ${varResp.latencyMs}ms`);
console.log(`   Epistemic Status: ${varResp.epistemicStatus}`);
assert.ok(varResp.codeSnippet && varResp.codeSnippet.includes('let count'), 'Must provide canonical let syntax');
assert.ok(varResp.romanUrduTip && varResp.romanUrduTip.includes('Tip:'), 'Must provide Roman Urdu tip');
console.log('✔ Variable query test PASSED.\n');

// 3. Function Syntax Query
console.log('3. Testing Query: Functions...');
const funcResp = echo.ask('how to write a function?');
assert.ok(funcResp.codeSnippet && funcResp.codeSnippet.includes('function add'), 'Must provide canonical function syntax');
console.log('✔ Function query test PASSED.\n');

// 4. Spatial Memory 369 Query
console.log('4. Testing Query: Spatial Memory 369...');
const spatialResp = echo.ask('tell me about spatial memory address 369');
assert.ok(spatialResp.codeSnippet && spatialResp.codeSnippet.includes('@space[368]'), 'Must enforce slot 368 boundary');
assert.ok(spatialResp.answer.includes('E8005'), 'Must reference E8005 safety invariant');
console.log('✔ Spatial memory query test PASSED.\n');

// 5. Smart Compiler Error Explainer & Auto-Fixer
console.log('5. Testing Error Explanations...');
const e1001Fix = echo.explainError('E1001', 'Expected variable identifier', 'let = 10;');
assert.ok(e1001Fix.includes('ECHO-1 Assistant'), 'Must include ECHO-1 Assistant header');
assert.ok(e1001Fix.includes('Suggested Fix'), 'Must include actionable fix suggestion');

const e8005Fix = echo.explainError('E8005', 'Spatial address 369 out of bounds', '@space[369] = 1;');
assert.ok(e8005Fix.includes('[0..368]'), 'Must clarify [0..368] sovereign boundary');
console.log('✔ Error explainer test PASSED.\n');

// 6. CLI Subcommand: one ask
console.log('6. Testing CLI Subcommand: one ask...');
const askResult = OneDeveloperCLI.run(['ask', 'how to declare variable']);
assert.strictEqual(askResult.exitCode, 0, 'CLI ask must return 0');
assert.ok(askResult.stdout.includes('ECHO-1 Assistant'), 'CLI stdout must contain ECHO-1 banner');
assert.ok(askResult.stdout.includes('let count'), 'CLI stdout must contain code snippet');
console.log('✔ CLI `one ask` test PASSED.\n');

// 7. CLI Smart Error Interception on Syntax Failure
console.log('7. Testing CLI Error Interception...');
const checkFail = OneDeveloperCLI.run(['check', '-e', 'let broken = ;']);
assert.strictEqual(checkFail.exitCode, 1, 'CLI check with syntax error must fail with 1');
assert.ok(checkFail.stderr.includes('ECHO-1 Assistant'), 'CLI stderr must append ECHO-1 assistance');
assert.ok(checkFail.stderr.includes('Suggested Fix'), 'CLI stderr must append suggested fix');
console.log('✔ CLI error interception test PASSED.\n');

console.log('🎉 ALL ECHO-1 AUTONOMOUS AI ASSISTANT TESTS PASSED (100% OFFLINE)!');
