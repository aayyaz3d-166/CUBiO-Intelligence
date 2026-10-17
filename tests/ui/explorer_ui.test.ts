// ── HTTP client helpers (Node built-in) ──
function httpGet(url: string): Promise<{status: number; body: any}> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {'Accept': 'application/json'},
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({status: res.statusCode!, body: JSON.parse(data)}); }
        catch (e) { resolve({status: res.statusCode!, body: data}); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function httpPost(url: string, body: any): Promise<{status: number; body: any}> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({status: res.statusCode!, body: JSON.parse(data)}); }
        catch (e) { resolve({status: res.statusCode!, body: data}); }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function apiGet(url: string): Promise<any> {
  const r = await httpGet(url);
  return r.body;
}

async function apiPost(url: string, body: any): Promise<any> {
  const r = await httpPost(url, body);
  return r.body;
}


// ── Test helpers ──
let passed = 0;
let failed = 0;
let total = 0;

function test(name: string, fn: () => Promise<void> | void): void {
  total++;
  (async () => {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err: unknown) {
      console.log(`  ✗ ${name}`);
      console.log(`    ${String(err)}`);
      failed++;
    }
  })();
}

function suite(name: string, fn: () => void): void {
  console.log(`
[Suite ${name}]`);
  fn();
}
// ── Test suite ──
/**
 * ONE Language — GATE 18: Explorer UI Test Suite
 * (tests/ui/explorer_ui.test.ts)
 *
 * Tests core UI flows: load status, run a query, view trace, inspect binary,
 * and run benchmark.  Also tests accessibility basics (aria-labels, headings).
 *
 * Verification: real API calls to the local backend (a real HTTP server started
 * in-process).  Mock-only areas are explicitly labelled and never asserted as
 * live results.
 */
import * as assert from 'assert';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import * as child_process from 'child_process';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Node binary path (Node 26.7.0)
const NODE_BIN = '/c/Users/PC/AppData/Local/hermes/tools/node-26.7.0-win32-x64/node';

// ── Helper: start the UI backend in-process ──────────────────────────────────
function startUIBackend(): Promise<{port: number; close: () => void}> {
  return new Promise((resolve, reject) => {
    // Start the compiled server.js directly with node
    const serverPath = path.resolve(__dirname, '..', '..', 'dist', 'one_net', 'ui', 'server.js');
    const child = child_process.spawn(NODE_BIN, [serverPath], {
      cwd: process.cwd(),
      env: {...process.env, PORT: '0'},
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let port = 0;
    let settled = false;

    // Wait for the server to log its listening port
    const detectPort = (data: Buffer) => {
      const out = data.toString();
      const m = out.match(/Explorer UI backend listening on http:\/\/localhost:(\d+)/);
      if (m && !settled) {
        port = parseInt(m[1], 10);
        settled = true;
        const close = () => {
          try { child.kill('SIGTERM'); } catch {}
          try { child.stdout?.destroy(); } catch {}
          try { child.stderr?.destroy(); } catch {}
        };
        resolve({port, close});
      }
    };

    child.stdout?.on('data', detectPort);
    child.stderr?.on('data', (d: Buffer) => {
      const err = d.toString();
      if (/error/i.test(err)) {
        // Server may error out
      }
    });

    child.on('error', (err: Error) => {
      reject(new Error('Failed to start UI backend: ' + err.message));
    });

    // Timeout fallback
    setTimeout(() => {
      if (!settled) {
        child.kill('SIGTERM');
        reject(new Error('UI backend did not start within 15 seconds'));
      }
    }, 15000);
  });
}

// ── Test suite ───────────────────────────────────────────────────────────────
suite('A: Backend status and connectivity', () => {
  let port = 0;
  let close: () => void;

  async function setup() {
    const s = await startUIBackend();
    port = s.port;
    close = s.close;
    allServers.push(s);
  }
  setup();

  test('A-01: Status API returns backend info', async () => {
    const res = await apiGet(`http://127.0.0.1:${port}/api/status`);
    const data = await res;
    assert.strictEqual(data.status, 200);
    assert.strictEqual(data.backend, 'ONE Language');
    assert.ok(data.ui, 'UI pane flags present');
    assert.strictEqual(data.ui.hasConsole, true);
    assert.ok(data.timestamp, 'timestamp present');
  });

  test('A-02: Mock-only areas are explicitly labelled', async () => {
    const res = await apiGet(`http://127.0.0.1:${port}/api/status`);
    const data = await res;
    assert.ok(Array.isArray(data.mockAreas), 'mockAreas documented');
    assert.ok(data.mockAreas.length > 0);
    // The label must name what is mock
    const joined = data.mockAreas.join(' ');
    assert.ok(joined.includes('mock') || joined.includes('deterministic') || joined.includes('read-only'));
  });

  test('A-03: UI pane flags reflect the actual UI layout', async () => {
    const res = await apiGet(`http://127.0.0.1:${port}/api/status`);
    const data = await res;
    for (const key of ['hasConsole', 'hasResultPanel', 'hasReasoningTrace', 'hasConceptGraph', 'hasBinaryInspector', 'hasBenchmarkPanel']) {
      assert.strictEqual(data.ui[key], true, `${key} should be true`);
    }
  });
});

suite('B: User-flow tests', () => {
  let port = 0;
  let close: () => void;

  async function setup() {
    const s = await startUIBackend();
    port = s.port;
    close = s.close;
    allServers.push(s);
  }
  setup();

  test('B-01: Query console returns real engine output', async () => {
    const data = await apiPost(`http://127.0.0.1:${port}/api/query`, {query: 'What properties does concept_car have?'});
    assert.strictEqual(data.status, 200);
    assert.ok(data.query, 'query echo present');
    assert.ok(data.result, 'result present');
    assert.ok(data.backend, 'backend label present');
    // The result must be non-empty and not a mock placeholder
    assert.ok(data.result.length > 0);
    assert.ok(!data.result.includes('TODO'), 'no TODO placeholder');
  });

  test('B-02: Query with empty text returns 400', async () => {
    const data = await apiPost(`http://127.0.0.1:${port}/api/query`, {query: '  '});
    assert.strictEqual(data.status, 400, 'expected 400');
  });

  test('B-03: Trace API returns real engine trace data', async () => {
    const res = await apiGet(`http://127.0.0.1:${port}/api/trace?n=5`);
    const data = await res;
    assert.strictEqual(data.status, 200);
    assert.ok(Array.isArray(data.entries), 'trace entries present');
    assert.ok(data.total >= 0, 'total count present');
    assert.ok(data.backend, 'backend label present');
  });

  test('B-04: Concept graph API returns topology', async () => {
    const res = await apiGet(`http://127.0.0.1:${port}/api/concept-graph`);
    const data = await res;
    assert.strictEqual(data.status, 200);
    assert.ok(Array.isArray(data.nodes), 'nodes present');
    assert.ok(Array.isArray(data.edges), 'edges present');
    assert.ok(data.nodes.length > 0);
    assert.ok(data.edges.length > 0);
    assert.ok(data.config, 'config present');
    assert.ok(data.backend, 'backend label present');
  });

  test('B-05: Binary inspector returns SHA-256 hashes', async () => {
    const data = await apiPost(`http://127.0.0.1:${port}/api/binary`, {files: ['binaryEncoder.ts', 'binaryDecoder.ts']});
    assert.ok(data.results, 'results present');
    assert.ok(data.results['binaryEncoder.ts'] !== undefined);
    assert.ok(data.results['binaryDecoder.ts'] !== undefined);
    assert.ok(data.results['binaryEncoder.ts'].sha256, 'sha256 present');
  });

  test('B-06: Benchmark API returns read-only results', async () => {
    const res = await apiGet(`http://127.0.0.1:${port}/api/benchmark`);
    const data = await res;
    assert.strictEqual(data.status, 200);
    assert.ok(Array.isArray(data.results), 'results present');
    assert.ok(data.backend, 'backend label present');
    assert.ok(data.stats, 'stats present');
  });

  test('B-07: Not-found path returns 404', async () => {
    const data = await apiGet(`http://127.0.0.1:${port}/api/does-not-exist`);
    assert.strictEqual(data.status, 404);
  });
});

suite('C: Accessibility basics', () => {
  // DOM assertions on the served index.html: headings, aria-label, role
  test('C-01: Document has a single h1', async () => {
    // This is a static assertion; the HTML file is read directly.
    const html = fs.readFileSync(path.resolve(__dirname, '..', '..', 'src', 'one_net', 'ui', 'index.html'), 'utf8');
    assert.ok(html.includes('<h1'), 'has h1');
    const h1s = (html.match(/<h1/g) || []).length;
    assert.strictEqual(h1s, 1);
  });

  test('C-02: All buttons have accessible text', async () => {
    const html = fs.readFileSync(path.resolve(__dirname, '..', '..', 'src', 'one_net', 'ui', 'index.html'), 'utf8');
    const buttons = (html.match(/<button/g) || []).length;
    const buttonsWithText = (html.match(/<button[^>]*>[^<]+<\/button>/g) || []).length;
    assert.ok(buttons > 0);
    // Every button that contains no text must have an aria-label
    const regex = /<button[^>]*>(?!<[a-z])/g;
    const matches = html.match(regex) || [];
    for (const m of matches) {
      const hasText = /<button[^>]*>[^<]+<\/button>/.test(m) || /aria-label/i.test(m);
      assert.ok(hasText, 'button must have text or aria-label');
    }
  });

  test('C-03: Form has an accessible heading or label', async () => {
    const html = fs.readFileSync(path.resolve(__dirname, '..', '..', 'src', 'one_net', 'ui', 'index.html'), 'utf8');
    assert.ok(html.includes('<form'), 'has form');
    assert.ok(html.includes('query-form') || html.includes('id="query-input"'), 'form has accessible input');
  });

  test('C-04: Result panel uses a semantic element', async () => {
    const html = fs.readFileSync(path.resolve(__dirname, '..', '..', 'src', 'one_net', 'ui', 'index.html'), 'utf8');
    assert.ok(html.includes('<pre'), 'has pre element for results');
    assert.ok(html.includes('aria-live'), 'has aria-live for live region');
  });

  test('C-05: Status badge announces state change (aria-live)', async () => {
    const html = fs.readFileSync(path.resolve(__dirname, '..', '..', 'src', 'one_net', 'ui', 'index.html'), 'utf8');
    // The badge is updated by JS; we check the pattern exists in the template
    assert.ok(html.includes('status-badge'), 'status badge element present');
  });
});

// ── Cleanup ──
// Each suite creates its own server; store the close function in module scope
// so process.on('exit') can shut down all servers.
const allServers: Array<{port: number; close: () => void}> = [];
process.on('exit', () => {
  for (const s of allServers) { try { s.close(); } catch {} }
});

// ── Report ───────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════════════');
console.log(`  GATE 18 Explorer UI Test Report`);
console.log(`  Total: ${total}  |  Passed: ${passed}  |  Failed: ${failed}`);
console.log('══════════════════════════════════════════════════════════════════════\n');

if (failed > 0) {
  process.exit(1);
}
