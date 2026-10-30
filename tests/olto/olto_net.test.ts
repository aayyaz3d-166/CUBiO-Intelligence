/**
 * OLTO Frontend Subsystem — Phase 7: Backend & External Service Integration Tests
 * ==============================================================================
 * Tests:
 *   1. OltoClient: Reactive Resource Lifecycle (Signals: data, loading, error)
 *   2. OltoClient: Bearer Auth Token Management & Base URL Resolution
 *   3. OltoClient: Security Invariant E9001 (Client Secret Exposure Violation Guard)
 *   4. OneServiceBridge: Sovereign Service Registration & RPC Method Dispatch
 *   5. OneServiceBridge: Reactive Service Hook (`useService`) & Signal Integration
 *   6. OltoWebSocket & Standalone HTML Bundling Integration
 */

import * as assert from 'assert';
import { OltoClient } from '../../src/olto/net/OltoClient';
import { OneServiceBridge } from '../../src/olto/net/OneServiceBridge';
import { OltoWebSocket } from '../../src/olto/net/OltoWebSocket';
import { OltoWebBundler } from '../../src/olto/tooling/OltoWebBundler';

async function runTestSuite() {
  console.log('================================================================================');
  console.log('  OLTO FRONTEND SUBSYSTEM — BACKEND & EXTERNAL SERVICES (PHASE 7)');
  console.log('================================================================================\n');

  // ── Test 1: OltoClient Reactive Resource Lifecycle ─────────────────────
  console.log('[Test 1] Testing OltoClient: Reactive Resource Lifecycle (Signals)...');
  OltoClient.setBaseUrl('https://api.one-language.org');
  OltoClient.setAuthToken(null);

  // Intercept fetch locally for predictable unit tests
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url: any, init: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/products')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => [{ id: 1, title: 'Neural Accelerator', price: 199 }],
        } as any;
      }
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Resource not found' }),
      } as any;
    };

    const resource = OltoClient.useFetch<Array<{ id: number; title: string; price: number }>>('/api/products');
    assert.strictEqual(typeof resource.loading.get(), 'boolean', 'Loading signal must be boolean');

    // Wait for micro-tick resolution
    await new Promise(r => setTimeout(r, 20));

    assert.strictEqual(resource.loading.get(), false, 'Loading must resolve to false');
    assert.strictEqual(resource.error.get(), null, 'Error must be null on success');
    const data = resource.data.get();
    assert.ok(data !== null && data.length === 1, 'Data signal should receive fetched payload');
    assert.strictEqual(data![0].title, 'Neural Accelerator');
    console.log('  ✓ Reactive resource signals (loading, data, error) verified with auto-update.\n');

    // ── Test 2: Auth Token Management & Query Encoding ─────────────────────
    console.log('[Test 2] Testing OltoClient: Bearer Auth Token & Query Parameters...');
    let capturedHeaders: any = null;
    let capturedUrl: string = '';

    globalThis.fetch = async (url: any, init: any) => {
      capturedUrl = String(url);
      capturedHeaders = init.headers;
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ status: 'authenticated' }),
      } as any;
    };

    OltoClient.setAuthToken('session_jwt_xyz_9988');
    assert.strictEqual(OltoClient.getAuthToken(), 'session_jwt_xyz_9988');

    await OltoClient.get('/api/user/profile', { query: { active: true, role: 'admin' } });

    assert.ok(capturedUrl.includes('active=true&role=admin'), 'Query parameters correctly encoded into URL');
    assert.strictEqual(capturedHeaders['Authorization'], 'Bearer session_jwt_xyz_9988', 'Bearer token injected in headers');
    console.log('  ✓ Bearer authentication and query parameter serialization verified.\n');

    // ── Test 3: Security Invariant E9001 (Client Secret Exposure Violation) ─
    console.log('[Test 3] Testing Security Invariant E9001 (Client Secret Exposure Guard)...');
    let e9001Thrown = false;
    try {
      await OltoClient.get('/api/checkout', {
        headers: { 'X-Stripe-Secret': 'sk_live_SECRET_SHOULD_NEVER_BE_ON_CLIENT' },
      });
    } catch (err: any) {
      if (err.message.includes('E9001: ClientSecretExposureViolation')) {
        e9001Thrown = true;
      }
    }
    assert.strictEqual(e9001Thrown, true, 'OltoClient must fail closed with E9001 when server secrets are leaked in client headers');
    console.log('  ✓ Runtime safety guard E9001 successfully prevented client secret exposure.\n');

  } finally {
    globalThis.fetch = originalFetch;
  }

  // ── Test 4: OneServiceBridge Sovereign RPC Dispatch ─────────────────────
  console.log('[Test 4] Testing OneServiceBridge: Sovereign Service RPC Dispatch...');
  OneServiceBridge.reset();

  // Register backend .one sovereign course service
  OneServiceBridge.registerService('Courses', async (method: string, params: any) => {
    if (method === 'list') {
      return [
        { id: 'one-101', title: 'ONE Language Sovereign Computing', seats: 25 },
        { id: 'olto-201', title: 'OLTO Reactive Frontend Engineering', seats: 18 },
      ];
    }
    if (method === 'enroll') {
      return { enrolled: true, courseId: params.courseId };
    }
    throw new Error(`Unknown method: ${method}`);
  });

  assert.ok(OneServiceBridge.getRegisteredServices().includes('courses'));

  const listRes = await OneServiceBridge.call<any[]>('Courses', 'list');
  assert.strictEqual(listRes.success, true);
  assert.strictEqual(listRes.data!.length, 2);
  assert.strictEqual(listRes.data![0].id, 'one-101');

  const enrollRes = await OneServiceBridge.call<any>('Courses', 'enroll', { courseId: 'olto-201' });
  assert.strictEqual(enrollRes.success, true);
  assert.strictEqual(enrollRes.data!.enrolled, true);

  // Missing service check
  const missingRes = await OneServiceBridge.call('NonExistentService', 'ping');
  assert.strictEqual(missingRes.success, false);
  assert.ok(missingRes.error!.includes('not registered or running'));
  console.log('  ✓ Sovereign backend service RPC registration and typed invocation verified.\n');

  // ── Test 5: OneServiceBridge `useService` Reactive Hook ─────────────────
  console.log('[Test 5] Testing OneServiceBridge: useService Reactive Signal Hook...');
  const reactiveCourse = OneServiceBridge.useService<any[]>('Courses', 'list');
  assert.strictEqual(typeof reactiveCourse.loading.get(), 'boolean');

  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(reactiveCourse.loading.get(), false);
  assert.strictEqual(reactiveCourse.error.get(), null);
  assert.strictEqual(reactiveCourse.data.get()!.length, 2);
  console.log('  ✓ In-process sovereign service synchronization through reactive signals confirmed.\n');

  // ── Test 6: OltoWebSocket & Standalone HTML Bundling ───────────────────
  console.log('[Test 6] Testing OltoWebSocket & Standalone HTML Bundling Integration...');
  const socket = new OltoWebSocket('wss://live.one-language.org/feed');
  assert.strictEqual(socket.status.get(), 'disconnected');

  let receivedMessage: any = null;
  const unsub = socket.subscribe('telemetry', (payload) => {
    receivedMessage = payload;
  });

  socket.emit('telemetry', { cpu: 12.5, opsPerSec: 204000000 });
  assert.ok(receivedMessage !== null);
  assert.strictEqual(receivedMessage.opsPerSec, 204000000);
  unsub();

  // Test WebBundler embeds networking helpers
  const sampleOlto = `
component NetWidget {
  state ready: boolean = true
  view {
    Container(padding: 16) {
      Text("Net Ready")
    }
  }
}
`;
  const bundleHtml = OltoWebBundler.bundle(sampleOlto, { title: 'Network App' });
  assert.ok(bundleHtml.includes('class OltoClient'), 'Bundle HTML must embed OltoClient');
  assert.ok(bundleHtml.includes('class OneServiceBridge'), 'Bundle HTML must embed OneServiceBridge');
  console.log('  ✓ OltoWebSocket real-time subscription & standalone bundle embed confirmed.\n');

  console.log('================================================================================');
  console.log('  ALL 6 OLTO BACKEND & EXTERNAL SERVICE TEST SUITES PASSED (100%)');
  console.log('================================================================================');
}

runTestSuite().catch((err) => {
  console.error('\n❌ OLTO Net Test Suite Failed:');
  console.error(err);
  process.exit(1);
});
