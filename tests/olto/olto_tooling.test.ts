/**
 * OLTO Frontend Subsystem — Tooling & CLI Integration Verification Suite
 * ======================================================================
 * Tests:
 *   1. OltoWebBundler: Standalone Zero-Dependency HTML Generation
 *   2. OltoWebBundler: Bundle to File Output & Assets
 *   3. OltoDevServer: HTTP Lifecycle, Live Reload & Health Endpoint
 *   4. OltoDevServer: Compilation Error Overlay Handling
 *   5. OneDeveloperCLI: `one olto check` Validation & Diagnostics
 *   6. OneDeveloperCLI: `one olto build` & `one olto dev` Command Workflow
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { OltoWebBundler } from '../../src/olto/tooling/OltoWebBundler';
import { OltoDevServer } from '../../src/olto/tooling/OltoDevServer';
import { OneDeveloperCLI } from '../../src/one/cli/OneDeveloperCLI';

async function fetchHttp(url: string): Promise<{ statusCode: number; headers: any; body: string }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: data,
        });
      });
    }).on('error', reject);
  });
}

async function runTestSuite() {
  console.log('================================================================================');
  console.log('  OLTO FRONTEND SUBSYSTEM — TOOLING & DEV SERVER VERIFICATION');
  console.log('================================================================================\n');

  const counterPath = path.resolve('examples/olto/01_counter/Counter.olto');
  const counterSource = fs.readFileSync(counterPath, 'utf-8');
  const tempDir = path.resolve('temp_olto_test');

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  try {
    // ── Test 1: OltoWebBundler Standalone HTML ─────────────────────────────
    console.log('[Test 1] Testing OltoWebBundler Standalone HTML Generation...');
    const html = OltoWebBundler.bundle(counterSource, {
      title: 'Counter App',
      theme: 'dark',
    });

    assert.ok(html.includes('<!DOCTYPE html>'), 'HTML output must contain doctype');
    assert.ok(html.includes('<title>Counter App</title>'), 'HTML must contain title');
    assert.ok(html.includes('class Signal'), 'HTML must bundle Signal reactive engine');
    assert.ok(html.includes('class Computed'), 'HTML must bundle Computed reactive engine');
    assert.ok(html.includes('function Button('), 'HTML must bundle core Button component');
    assert.ok(html.includes('function Card('), 'HTML must bundle core Card component');
    assert.ok(!html.includes('<script src='), 'HTML bundle must be zero-dependency (no external script tags)');
    console.log('  ✓ Standalone HTML bundle correctly generated with zero external dependencies.\n');

    // ── Test 2: OltoWebBundler Bundle To File ──────────────────────────────
    console.log('[Test 2] Testing OltoWebBundler.bundleToFile...');
    const outHtmlPath = path.join(tempDir, 'bundled_counter.html');
    OltoWebBundler.bundleToFile(counterPath, outHtmlPath, { theme: 'light' });

    assert.ok(fs.existsSync(outHtmlPath), 'Target output file must exist');
    const fileContent = fs.readFileSync(outHtmlPath, 'utf-8');
    assert.ok(fileContent.length > 5000, 'HTML file size should contain full runtime bundle');
    assert.ok(fileContent.includes('#f8fafc'), 'Light theme background color must be applied');
    console.log(`  ✓ File successfully bundled to disk: ${path.basename(outHtmlPath)} (${(fileContent.length / 1024).toFixed(2)} KB).\n`);

    // ── Test 3: OltoDevServer Lifecycle & Endpoints ────────────────────────
    console.log('[Test 3] Testing OltoDevServer Lifecycle & Endpoints...');
    const testPort = 49152 + Math.floor(Math.random() * 1000);
    const devServer = new OltoDevServer({
      entryFile: counterPath,
      port: testPort,
      theme: 'dark',
    });

    const boundPort = await devServer.start();
    assert.strictEqual(boundPort, testPort, 'Server should bind to specified port');
    assert.strictEqual(devServer.isListening(), true, 'Server isListening should be true');

    // Test GET /
    const rootRes = await fetchHttp(`http://localhost:${testPort}/`);
    assert.strictEqual(rootRes.statusCode, 200, 'GET / should return 200 OK');
    assert.ok(rootRes.headers['content-type'].includes('text/html'), 'Content-Type should be text/html');
    assert.ok(rootRes.body.includes('Counter'), 'Root page should contain component name');

    // Test GET /api/health
    const healthRes = await fetchHttp(`http://localhost:${testPort}/api/health`);
    assert.strictEqual(healthRes.statusCode, 200, 'GET /api/health should return 200 OK');
    const healthData = JSON.parse(healthRes.body);
    assert.strictEqual(healthData.status, 'ok', 'Health status should be ok');
    assert.ok(typeof healthData.updatedAt === 'number', 'Health status must include timestamp');

    await devServer.stop();
    assert.strictEqual(devServer.isListening(), false, 'Server isListening should be false after stop');
    console.log('  ✓ DevServer started, served application & health endpoints, and stopped cleanly.\n');

    // ── Test 4: DevServer Error Overlay Handling ──────────────────────────
    console.log('[Test 4] Testing DevServer Diagnostic Error Overlay...');
    const brokenFilePath = path.join(tempDir, 'broken.olto');
    fs.writeFileSync(brokenFilePath, 'component Broken { state x = 10; // missing closing bracket', 'utf-8');

    const errServer = new OltoDevServer({
      entryFile: brokenFilePath,
      port: testPort + 1,
    });
    await errServer.start();

    const errRes = await fetchHttp(`http://localhost:${testPort + 1}/`);
    assert.strictEqual(errRes.statusCode, 200);
    assert.ok(errRes.body.includes('OLTO Compiler Diagnostic Error'), 'Page should display error overlay');

    const errHealth = await fetchHttp(`http://localhost:${testPort + 1}/api/health`);
    const errHealthData = JSON.parse(errHealth.body);
    assert.strictEqual(errHealthData.status, 'error', 'Health endpoint reports compilation error');

    await errServer.stop();
    console.log('  ✓ Error overlay accurately rendered with compilation diagnostics.\n');

    // ── Test 5: OneDeveloperCLI `one olto check` ───────────────────────────
    console.log('[Test 5] Testing OneDeveloperCLI: one olto check...');
    // Valid check
    const checkValid = OneDeveloperCLI.run(['olto', 'check', counterPath]);
    assert.strictEqual(checkValid.exitCode, 0, 'Valid olto check must return exitCode 0');
    assert.ok(checkValid.stdout.includes('checks passed for: Counter.olto'), 'Output confirms check success');

    // Invalid check (missing file)
    const checkMissing = OneDeveloperCLI.run(['olto', 'check', 'non_existent_widget.olto']);
    assert.strictEqual(checkMissing.exitCode, 1, 'Missing file check must return exitCode 1');
    assert.ok(checkMissing.stderr.includes('OLTO source file not found'), 'Stderr contains missing file error');

    // Invalid syntax check
    const checkBroken = OneDeveloperCLI.run(['olto', 'check', brokenFilePath]);
    assert.strictEqual(checkBroken.exitCode, 1, 'Broken syntax check must return exitCode 1');
    assert.ok(checkBroken.stderr.includes('OLTO Diagnostic Check Failed'), 'Stderr reports diagnostics');
    console.log('  ✓ CLI static check command correctly validated valid and invalid OLTO components.\n');

    // ── Test 6: OneDeveloperCLI `one olto build` and help ─────────────────
    console.log('[Test 6] Testing OneDeveloperCLI: one olto build & help...');
    const cliBuildDest = path.join(tempDir, 'cli_output.html');
    const buildRes = OneDeveloperCLI.run([
      'olto',
      'build',
      counterPath,
      '--out',
      cliBuildDest,
      '--theme',
      'dark',
    ]);
    assert.strictEqual(buildRes.exitCode, 0, 'Build command must return exitCode 0');
    assert.ok(buildRes.stdout.includes('Standalone web application bundled successfully!'));
    assert.ok(fs.existsSync(cliBuildDest), 'CLI build must generate destination file');

    // Help command
    const helpRes = OneDeveloperCLI.run(['olto', '--help']);
    assert.strictEqual(helpRes.exitCode, 0, 'Help command must return exitCode 0');
    assert.ok(helpRes.stdout.includes('OLTO Frontend CLI — Developer Commands'));
    assert.ok(helpRes.stdout.includes('check <file.olto>'));
    assert.ok(helpRes.stdout.includes('build <file.olto>'));
    assert.ok(helpRes.stdout.includes('dev   <file.olto>'));

    console.log('  ✓ CLI build, bundle output, and developer help validated.\n');

    console.log('================================================================================');
    console.log('  ALL 6 OLTO TOOLING & DEV SERVER TEST SUITES PASSED (100%)');
    console.log('================================================================================');
  } finally {
    // Cleanup temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

runTestSuite().catch((err) => {
  console.error('\n❌ OLTO Tooling Test Suite Failed:');
  console.error(err);
  process.exit(1);
});
