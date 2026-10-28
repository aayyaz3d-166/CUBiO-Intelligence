/**
 * Phase 4 — Bridge + Mock LLM + VM Inspector End-to-End Test
 *
 * Simulates the full pipeline: a mock LLM generates ONE source code from a
 * natural-language prompt → the bridge validates and compiles it → the VM
 * executes it → the inspector returns deep runtime state → assertions verify
 * everything worked correctly.
 */

import { inspectRun } from './oneBridge';
import { mockGenerate, listMockPrompts } from './oneLLMMock';

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

function runBridgeTestSuite(): void {
  console.log('══════════════════════════════════════════════════════');
  console.log('  ONE Language — Phase 4: Mock LLM Bridge + VM Inspector');
  console.log('══════════════════════════════════════════════════════\n');

  let passCount = 0;
  let failCount = 0;

  const prompts = listMockPrompts();
  for (const prompt of prompts) {
    const mock = mockGenerate(prompt);
    console.log(`─── Test: "${prompt}" ───────────────────────────────`);
    console.log(`  Prompt: ${mock.description}`);
    console.log(`  ONE Code:\n${mock.oneCode}\n`);

    const result = inspectRun(mock.oneCode);

    if ('error' in result) {
      // Expected for 'invalid code' — bridge should catch it safely
      if (prompt === 'invalid code') {
        console.log(`  ✓ Bridge caught the error safely:`);
        console.log(`      Phase:  ${result.phase}`);
        console.log(`      Error:  ${result.error}`);
        console.log(`      ✅ PASS (expected failure handled gracefully)\n`);
        passCount++;
      } else {
        console.log(`  ❌ FAIL: Unexpected error in "${prompt}":`);
        console.log(`      Phase:  ${result.phase}`);
        console.log(`      Error:  ${result.error}\n`);
        failCount++;
      }
      continue;
    }

    // Success case — inspect the VM state
    const state = result;
    console.log(`  ✓ Compilation + Execution succeeded.`);
    console.log(`    Variables: ${Object.keys(state.variables).length} declared`);
    console.log(`    Eval Stack: ${state.evalStack.length} items`);
    console.log(`    Call Stack: ${state.callStack.length} frames`);
    console.log(`    Functions:  ${state.funcRegistry.size} registered`);
    console.log(`    RSS Used:   ${state.rssUsedMb.toFixed(2)} MB / ${state.rssLimitMb} MB`);

    // Print variable details
    if (Object.keys(state.variables).length > 0) {
      console.log(`    Variable details:`);
      for (const [key, val] of Object.entries(state.variables)) {
        console.log(`      ${key.padEnd(14)} = ${JSON.stringify(val)}`);
      }
    }
    console.log();

    // Per-prompt assertions
    let passed = true;

    switch (prompt) {
      case 'hello world':
        if (state.variables.message !== 'Hello from Cubío ONE Language!') {
          console.log(`  ❌ FAIL: message expected "Hello from Cubío ONE Language!"`);
          passed = false;
        }
        if (state.variables.version !== 'Phase4 Mock') {
          console.log(`  ❌ FAIL: version expected "Phase4 Mock"`);
          passed = false;
        }
        break;

      case 'variable declaration':
        if (state.variables.count !== 42) { console.log(`  ❌ FAIL: count != 42`); passed = false; }
        if (state.variables.name !== 'MockLLM') { console.log(`  ❌ FAIL: name != "MockLLM"`); passed = false; }
        if (state.variables.active !== true) { console.log(`  ❌ FAIL: active != true`); passed = false; }
        if (!Array.isArray(state.variables.tags) || state.variables.tags.length !== 3) {
          console.log(`  ❌ FAIL: tags invalid`); passed = false;
        }
        if (typeof state.variables.meta !== 'object' || state.variables.meta.version !== 1) {
          console.log(`  ❌ FAIL: meta invalid`); passed = false;
        }
        break;

      case 'sum function': {
        const vars = state.variables;
        if (vars.s !== 30) { console.log(`  ❌ FAIL: s (add(10,20)) expected 30, got ${vars.s}`); passed = false; }
        // Check function was registered
        if (state.funcRegistry.size === 0) { console.log(`  ❌ FAIL: no functions registered`); passed = false; }
        if (!state.funcRegistry.has('add')) { console.log(`  ❌ FAIL: 'add' function not in registry`); passed = false; }
        break;
      }

      case 'multiply function': {
        const vars = state.variables;
        if (vars.p !== 42) { console.log(`  ❌ FAIL: p (multiply(6,7)) expected 42, got ${vars.p}`); passed = false; }
        if (!state.funcRegistry.has('multiply')) { console.log(`  ❌ FAIL: 'multiply' not in registry`); passed = false; }
        break;
      }

      case 'factorial function': {
        const vars = state.variables;
        if (vars.fact5 !== 120) { console.log(`  ❌ FAIL: fact5 (factorial(5)) expected 120, got ${vars.fact5}`); passed = false; }
        if (!state.funcRegistry.has('factorial')) { console.log(`  ❌ FAIL: 'factorial' not in registry`); passed = false; }
        break;
      }

      case 'array loop': {
        const vars = state.variables;
        if (!Array.isArray(vars.items) || vars.items.length !== 3) {
          console.log(`  ❌ FAIL: items array invalid`); passed = false;
        }
        break;
      }

      default:
        // No specific assertions for other prompts — just check execution succeeded
        break;
    }

    if (passed) {
      console.log(`  ✅ PASS: "${prompt}" — all assertions met.\n`);
      passCount++;
    } else {
      console.log(`  ❌ FAIL: "${prompt}" — see errors above.\n`);
      failCount++;
    }
  }

  // ── Bridge error-handling test ──────────────────────────────────────
  console.log('─── Test: Bridge Safety (invalid code) ─────────────────');
  const badMock = mockGenerate('invalid code');
  const badResult = inspectRun(badMock.oneCode);
  if ('error' in badResult) {
    console.log(`  ✓ Bridge correctly caught invalid code:`);
    console.log(`      Phase:  ${badResult.phase}`);
    console.log(`      Error:  ${badResult.error}`);
    console.log(`  ✅ PASS: Safety bridge prevents crashes.\n`);
    passCount++;
  } else {
    console.log(`  ❌ FAIL: Bridge should have caught the error but succeeded.\n`);
    failCount++;
  }

  // ── Summary ─────────────────────────────────────────────────────────
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Phase 4 Test Results: ${passCount} passed, ${failCount} failed (out of ${passCount + failCount} tests)`);
  if (failCount === 0) {
    console.log('✅ PASS: Phase 4 Mock Bridge + VM Inspector — Fully Operational.');
  } else {
    console.log(`❌ FAIL: ${failCount} test(s) failed.`);
    process.exit(1);
  }
  console.log('══════════════════════════════════════════════════════');
}

runBridgeTestSuite();
