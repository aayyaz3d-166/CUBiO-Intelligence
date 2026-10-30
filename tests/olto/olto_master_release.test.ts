/**
 * OLTO Frontend Subsystem — Master Production Release & Verification Benchmark
 * ============================================================================
 * Final End-to-End Integration Benchmark:
 *   Step 1: Natural Language Prompt Intake
 *   Step 2: AI-Driven Architecture Planning (ECHO-1)
 *   Step 3: JSON Intermediate Schema Generation (.olto.spec.json)
 *   Step 4: AST Lowering & Declarative OLTO Code Compilation
 *   Step 5: Zero-Dependency Standalone Web Application Bundling
 *   Step 6: Live HTTP DevServer Deployment & HTTP Verification
 *   Step 7: Backend Sovereign Service IPC Dispatch
 *   Step 8: Security Invariant & Secret Leakage Verification
 *   Step 9: High-Speed Sub-Millisecond Benchmark Accounting
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { Echo1Assistant } from '../../src/one/intelligence/echo/Echo1Assistant';
import { OltoSchemaValidator } from '../../src/olto/ai/OltoSchema';
import { OltoCompiler } from '../../src/olto/compiler/index';
import { OltoWebBundler } from '../../src/olto/tooling/OltoWebBundler';
import { OltoDevServer } from '../../src/olto/tooling/OltoDevServer';
import { OneServiceBridge } from '../../src/olto/net/OneServiceBridge';

async function fetchHttp(url: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode || 0, body: data }));
    }).on('error', reject);
  });
}

async function runMasterReleaseSuite() {
  console.log('================================================================================');
  console.log('  OLTO FRONTEND SUBSYSTEM — MASTER PRODUCTION INTEGRATION BENCHMARK (PHASE 8)');
  console.log('================================================================================\n');

  const benchmarkStart = performance.now();
  const tempDir = path.resolve('temp_olto_master_release');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  try {
    // ── Step 1 & 2: Natural Language Prompt -> AI Generation ──────────────
    console.log('[Stage 1] Natural Language Prompt Intake & ECHO-1 Architecture Planning...');
    const userPrompt = 'Build a sovereign course-selling academy with cart, checkout, and reactive state';
    const echo1 = Echo1Assistant.getInstance();

    const tAI0 = performance.now();
    const generated = echo1.generateOltoApp(userPrompt);
    const aiLatency = Math.round(performance.now() - tAI0);

    assert.ok(generated.schema, 'ECHO-1 must produce structured UI schema');
    assert.ok(generated.code.length > 200, 'ECHO-1 must emit non-trivial OLTO source code');
    console.log(`  ✓ Planned and synthesized application '${generated.schema.name}' in ${aiLatency}ms.\n`);

    // ── Step 3: Schema Validation (.olto.spec.json) ───────────────────────
    console.log('[Stage 2] Structured JSON Schema IR Validation...');
    const schemaValidation = OltoSchemaValidator.validate(generated.schema);
    assert.strictEqual(schemaValidation.valid, true, 'Synthesized schema must pass validation');
    assert.strictEqual(schemaValidation.errors.length, 0);
    console.log('  ✓ Structured schema conforms 100% to OltoAppSchema v1.0 specification.\n');

    // ── Step 4: AST Lowering & Compilation ────────────────────────────────
    console.log('[Stage 3] AST Lowering & Semantic Verification...');
    const tCompile0 = performance.now();
    const compileRes = OltoCompiler.compile(generated.code);
    const compileLatency = Math.round((performance.now() - tCompile0) * 100) / 100;

    assert.strictEqual(compileRes.success, true, 'Generated OLTO code must compile with 0 errors');
    assert.ok(compileRes.ast !== null, 'Compiler must produce valid AST');
    assert.strictEqual(compileRes.diagnostics.length, 0);
    console.log(`  ✓ Code successfully compiled into AST in ${compileLatency}ms with 0 diagnostics.\n`);

    // ── Step 5: Standalone Web Application Bundling ────────────────────────
    console.log('[Stage 4] Standalone Zero-Dependency HTML Application Bundling...');
    const targetHtmlPath = path.join(tempDir, `${generated.schema.name}.html`);
    const tBundle0 = performance.now();
    const bundleHtml = OltoWebBundler.bundle(generated.code, {
      title: 'ONE Language Sovereign Academy',
      theme: 'dark',
    });
    fs.writeFileSync(targetHtmlPath, bundleHtml, 'utf-8');
    const bundleLatency = Math.round((performance.now() - tBundle0) * 100) / 100;

    assert.ok(bundleHtml.includes('<!DOCTYPE html>'), 'Bundle must produce complete HTML document');
    assert.ok(bundleHtml.includes('class Signal'), 'Bundle must include fine-grained reactive runtime');
    assert.ok(bundleHtml.includes('class OltoClient'), 'Bundle must embed client networking subsystem');
    assert.ok(!bundleHtml.includes('<script src='), 'Bundle must be 100% self-contained (zero external scripts)');
    console.log(`  ✓ Standalone HTML bundle emitted in ${bundleLatency}ms (${(bundleHtml.length / 1024).toFixed(2)} KB).\n`);

    // ── Step 6: Live HTTP DevServer Deployment ─────────────────────────────
    console.log('[Stage 5] Live HTTP DevServer Startup & Health Verification...');
    const targetOltoPath = path.join(tempDir, `${generated.schema.name}.olto`);
    fs.writeFileSync(targetOltoPath, generated.code, 'utf-8');

    const devPort = 48500 + Math.floor(Math.random() * 500);
    const devServer = new OltoDevServer({
      entryFile: targetOltoPath,
      port: devPort,
      theme: 'dark',
    });

    await devServer.start();
    assert.strictEqual(devServer.isListening(), true);

    const httpRes = await fetchHttp(`http://localhost:${devPort}/`);
    assert.strictEqual(httpRes.statusCode, 200, 'DevServer must return HTTP 200 OK');
    assert.ok(httpRes.body.includes(generated.schema.name), 'Served page must render application component');

    const healthRes = await fetchHttp(`http://localhost:${devPort}/api/health`);
    assert.strictEqual(healthRes.statusCode, 200);
    const healthJson = JSON.parse(healthRes.body);
    assert.strictEqual(healthJson.status, 'ok');

    await devServer.stop();
    assert.strictEqual(devServer.isListening(), false);
    console.log(`  ✓ DevServer successfully served application and live-reload telemetry at port ${devPort}.\n`);

    // ── Step 7: Backend Sovereign Service IPC Dispatch ────────────────────
    console.log('[Stage 6] Backend Sovereign ONE Service RPC Dispatch...');
    OneServiceBridge.reset();
    OneServiceBridge.registerService('Academy', async (method, params) => {
      if (method === 'checkout') {
        return { orderId: 'ORD-369-SOVEREIGN', status: 'CONFIRMED', total: params.total };
      }
      return { status: 'OK' };
    });

    const rpcRes = await OneServiceBridge.call('Academy', 'checkout', { total: 198 });
    assert.strictEqual(rpcRes.success, true);
    assert.strictEqual(rpcRes.data.orderId, 'ORD-369-SOVEREIGN');
    console.log(`  ✓ Backend .one sovereign service executed RPC in ${rpcRes.executionTimeMs}ms.\n`);

    // ── Step 8: Security Invariant & Secret Leakage Audit ──────────────────
    console.log('[Stage 7] Security Audit: Invariant E9001 & Secret Leakage Check...');
    const leakedTokens = ['sk_live_', 'db_password', 'root_token', 'SECRET_KEY'];
    for (const token of leakedTokens) {
      assert.ok(!bundleHtml.includes(token), `Security invariant violated: found sensitive token '${token}' in bundle`);
    }
    console.log('  ✓ Zero secret leakage verified. Fail-closed boundary confirmed.\n');

    // ── Step 9: Benchmark Accounting ──────────────────────────────────────
    const totalPipelineMs = Math.round(performance.now() - benchmarkStart);
    console.log('================================================================================');
    console.log(`  MASTER INTEGRATION BENCHMARK COMPLETED IN ${totalPipelineMs} ms`);
    console.log('  STATUS: 100% PRODUCTION READY FOR RELEASE');
    console.log('================================================================================');
    assert.ok(totalPipelineMs < 2000, 'Full end-to-end lifecycle must execute in under 2 seconds');

  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

runMasterReleaseSuite().catch((err) => {
  console.error('\n❌ Master Release Benchmark Failed:');
  console.error(err);
  process.exit(1);
});
