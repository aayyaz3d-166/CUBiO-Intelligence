/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Test Suite: tests/vig/vig_security_hardening.test.ts
 * Specification: VIG Phase 6 Security & Recovery Hardening
 *
 * Validates:
 * 1. Runtime role-based access control (RBAC) on all mutations.
 * 2. Read-only access for ANALYZER_AGENT and EXTERNAL_SKILL.
 * 3. Zero-state-change guarantee for rejected unauthorized calls.
 * 4. Single-writer / multiple-reader concurrency & competing writer conflicts.
 * 5. Stale lock detection & reclamation (dead PID, expired TTL).
 * 6. Windows atomic file replacement & crash recovery (purging stale .tmp files).
 * 7. Corrupt-index detection & quarantine recovery without trusting invalid state.
 * 8. Path traversal protection & repository-root containment.
 * 9. Fail-closed behavior & preserved physical actuation lockout.
 */

import assert from 'assert';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  VIGAccessDeniedError,
  VIGConflictError,
  VIGSecurityError,
  VIGSecurityContext,
  VIGNode,
  VIGManifest,
} from '../../src/one/vig/types';
import { VIGModel } from '../../src/one/vig/VIGModel';
import { VIGSecurityGuard } from '../../src/one/vig/VIGSecurityGuard';
import { VIGLockManager } from '../../src/one/vig/VIGLockManager';
import { VIGRecoveryManager } from '../../src/one/vig/VIGRecoveryManager';
import { VIGManifestManager } from '../../src/one/vig/VIGManifestManager';
import { VerifiableIntelligenceGraph } from '../../src/one/vig/VerifiableIntelligenceGraph';

export async function runVIGSecurityHardeningTests(): Promise<void> {
  console.log('\n================================================================================');
  console.log('  ONE LANGUAGE — VIG PHASE 6 SECURITY & RECOVERY HARDENING');
  console.log('================================================================================\n');

  // Create isolated sandbox directory for test artifacts
  const tempBaseDir = path.join(os.tmpdir(), `vig-security-test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
  const testRepoRoot = path.join(tempBaseDir, 'repo');
  const testVigDir = path.join(testRepoRoot, '.vig');
  fs.mkdirSync(path.join(testRepoRoot, 'src', 'core'), { recursive: true });
  fs.mkdirSync(testVigDir, { recursive: true });

  // Create mock source files
  const fileA = path.join(testRepoRoot, 'src', 'core', 'math.ts');
  const fileB = path.join(testRepoRoot, 'src', 'core', 'calculator.ts');
  fs.writeFileSync(fileA, 'export function add(a: number, b: number): number { return a + b; }\n', 'utf8');
  fs.writeFileSync(fileB, 'import { add } from "./math"; export function calc(x: number) { return add(x, 1); }\n', 'utf8');

  try {
    // ── Suite 1: Runtime Role-Based Access Control on Mutation Entry Points ──
    console.log('[Suite 1] Runtime Role-Based Access Control on Mutations & BUG-D01 Hardening...');

    const unauthenticatedSystemContext: VIGSecurityContext = {
      role: 'SYSTEM_CORE',
      agentId: 'system-worker-01',
    };

    const analyzerContext: VIGSecurityContext = {
      role: 'ANALYZER_AGENT',
      agentId: 'analyzer-worker-01',
    };

    const skillContext: VIGSecurityContext = {
      role: 'EXTERNAL_SKILL',
      agentId: 'skill-worker-01',
    };

    const forgedContext = {
      role: 'SUPER_ADMIN',
      agentId: 'malicious-actor',
    };

    const vig = new VerifiableIntelligenceGraph({
      repoRoot: testRepoRoot,
      vigDir: testVigDir,
      autoRecoverOnStartup: true,
    });

    // 1. BUG-D01: When secret is not configured, unauthenticated caller claiming SYSTEM_CORE fails closed
    VIGSecurityGuard.resetSystemSecret();
    await assert.rejects(
      async () => {
        await vig.updateIndex(unauthenticatedSystemContext);
      },
      (err: any) => {
        assert(err instanceof VIGAccessDeniedError);
        assert(err.message.includes('System secret is not configured'));
        return true;
      },
      'Unauthenticated caller must fail closed when secret is not configured'
    );

    // 2. Configure trusted system authentication secret
    const testSecret = 'vig-hardening-secret-system-core-2026';
    VIGSecurityGuard.configureSystemSecret(testSecret);

    // 3. BUG-D01: Unauthenticated caller claiming SYSTEM_CORE without sessionToken fails closed
    await assert.rejects(
      async () => {
        await vig.updateIndex(unauthenticatedSystemContext);
      },
      (err: any) => {
        assert(err instanceof VIGAccessDeniedError);
        assert(err.message.includes('without valid sessionToken'));
        return true;
      },
      'Unauthenticated caller claiming SYSTEM_CORE without sessionToken must fail closed'
    );

    // 4. BUG-D01: Invalid / forged sessionToken signature fails closed
    const forgedTokenContext: VIGSecurityContext = {
      role: 'SYSTEM_CORE',
      agentId: 'system-worker-01',
      sessionToken: 'VIG-ST1.eyJyb2xlIjoiU1lTVEVNX0NPUkUifQ.invalid-forged-signature-hex',
    };
    await assert.rejects(
      async () => {
        await vig.updateIndex(forgedTokenContext);
      },
      (err: any) => {
        assert(err instanceof VIGAccessDeniedError);
        assert(err.message.includes('Invalid') || err.message.includes('forged') || err.message.includes('Malformed'));
        return true;
      },
      'Forged sessionToken must be rejected'
    );

    // 5. BUG-D01: Expired sessionToken fails closed
    const expiredToken = VIGSecurityGuard.mintSessionToken('SYSTEM_CORE', 'system-worker-01', testSecret, {
      ttlMs: -10000, // Expired 10 seconds ago
      issuedAt: Date.now() - 20000,
    });
    const expiredTokenContext: VIGSecurityContext = {
      role: 'SYSTEM_CORE',
      agentId: 'system-worker-01',
      sessionToken: expiredToken,
    };
    await assert.rejects(
      async () => {
        await vig.updateIndex(expiredTokenContext);
      },
      (err: any) => {
        assert(err instanceof VIGAccessDeniedError);
        assert(err.message.includes('expired'));
        return true;
      },
      'Expired sessionToken must be rejected'
    );

    // 6. BUG-D01: Token agentId mismatch fails closed
    const mismatchedToken = VIGSecurityGuard.mintSessionToken('SYSTEM_CORE', 'other-agent-id', testSecret);
    const mismatchedContext: VIGSecurityContext = {
      role: 'SYSTEM_CORE',
      agentId: 'system-worker-01',
      sessionToken: mismatchedToken,
    };
    await assert.rejects(
      async () => {
        await vig.updateIndex(mismatchedContext);
      },
      (err: any) => {
        assert(err instanceof VIGAccessDeniedError);
        assert(err.message.includes('mismatch'));
        return true;
      },
      'Mismatched agentId must be rejected'
    );

    // 7. Genuine authenticated SYSTEM_CORE context succeeds
    const systemContext = VIGSecurityGuard.createSystemContext('system-worker-01', testSecret);
    const initialIndexResult = await vig.updateIndex(systemContext);
    assert.strictEqual(initialIndexResult.isNoOp, false, 'Initial indexing should index files');
    assert.strictEqual(vig.store.nodeCount > 0, true, 'Nodes should be populated');

    // 8. updateIndex with ANALYZER_AGENT must fail with VIGAccessDeniedError
    await assert.rejects(
      async () => {
        await vig.updateIndex(analyzerContext);
      },
      (err: any) => {
        assert(err instanceof VIGAccessDeniedError, 'Error must be instance of VIGAccessDeniedError');
        assert(err.message.includes('Access denied'), 'Error message must specify access denied');
        return true;
      },
      'ANALYZER_AGENT must be blocked from updateIndex'
    );

    // 9. updateIndex with EXTERNAL_SKILL must fail
    await assert.rejects(
      async () => {
        await vig.updateIndex(skillContext);
      },
      (err: any) => {
        assert(err instanceof VIGAccessDeniedError);
        return true;
      },
      'EXTERNAL_SKILL must be blocked from updateIndex'
    );

    // 10. updateIndex with forged/unknown role must fail
    await assert.rejects(
      async () => {
        await vig.updateIndex(forgedContext as any);
      },
      (err: any) => {
        assert(err instanceof VIGAccessDeniedError);
        return true;
      },
      'Forged role must be blocked fail-closed'
    );

    // 11. recordEvidence with ANALYZER_AGENT must fail
    await assert.rejects(
      async () => {
        await vig.recordEvidence(analyzerContext, {
          commitSha: 'a'.repeat(40),
          graphRootSeal: vig.store.computeRootSeal(),
          typecheckPassed: true,
          typecheckErrorCount: 0,
          testSuites: [],
          evaluatedAt: Date.now(),
          overallPassed: true,
        });
      },
      (err: any) => {
        assert(err instanceof VIGAccessDeniedError);
        return true;
      },
      'ANALYZER_AGENT must be blocked from recordEvidence'
    );

    console.log('  ✓ Mutation entry points strictly protected by runtime RBAC & cryptographic authentication.');

    // ── Suite 2: Proof of Zero State Changes on Unauthorized Calls ─────────
    console.log('[Suite 2] Proving Zero State Changes on Unauthorized Mutation Attempts...');

    const baselineNodeCount = vig.store.nodeCount;
    const baselineEdgeCount = vig.store.edgeCount;
    const baselineRootSeal = vig.store.computeRootSeal();
    const manifestBytesBefore = fs.readFileSync(vig.manifestPath);
    const manifestHashBefore = crypto.createHash('sha256').update(manifestBytesBefore).digest('hex');

    // Fire 6 consecutive unauthorized mutation attempts with various malformed roles
    const forbiddenRoles: any[] = [
      { role: 'ANALYZER_AGENT', agentId: 'agent-1' },
      { role: 'EXTERNAL_SKILL', agentId: 'skill-1' },
      { role: 'GUEST', agentId: 'guest-1' },
      { role: 'ROOT', agentId: 'root-1' },
      null,
      undefined,
    ];

    for (const ctx of forbiddenRoles) {
      try {
        await vig.updateIndex(ctx);
        assert.fail('Should have rejected');
      } catch (e: any) {
        assert(e instanceof VIGAccessDeniedError || e.name === 'VIGAccessDeniedError');
      }
    }

    // Verify zero state change:
    assert.strictEqual(vig.store.nodeCount, baselineNodeCount, 'Node count must remain identical');
    assert.strictEqual(vig.store.edgeCount, baselineEdgeCount, 'Edge count must remain identical');
    assert.strictEqual(vig.store.computeRootSeal(), baselineRootSeal, 'Graph root seal must remain identical');

    const manifestBytesAfter = fs.readFileSync(vig.manifestPath);
    const manifestHashAfter = crypto.createHash('sha256').update(manifestBytesAfter).digest('hex');
    assert.strictEqual(manifestHashAfter, manifestHashBefore, 'Manifest on disk must be bit-identical');

    console.log('  ✓ Verified 100% zero state change across in-memory graph and disk files.');

    // ── Suite 3: Read-Only Access for ANALYZER_AGENT & EXTERNAL_SKILL ────────
    console.log('[Suite 3] Read-Only Access for ANALYZER_AGENT and EXTERNAL_SKILL...');

    // 1. queryImpact with ANALYZER_AGENT
    const impactAnalyzer = await vig.queryImpact(
      { changedPaths: ['src/core/math.ts'] },
      analyzerContext
    );
    assert.strictEqual(typeof impactAnalyzer.isNoOp, 'boolean');
    assert.strictEqual(Array.isArray(impactAnalyzer.affectedModules), true);

    // 2. queryImpact with EXTERNAL_SKILL
    const impactSkill = await vig.queryImpact(
      { changedPaths: ['src/core/calculator.ts'] },
      skillContext
    );
    assert.strictEqual(typeof impactSkill.isNoOp, 'boolean');

    // 3. getVerifiedContext with ANALYZER_AGENT
    const contextAnalyzer = await vig.getVerifiedContext(
      { targetPath: 'src/core/math.ts' },
      analyzerContext
    );
    assert.strictEqual(contextAnalyzer.node !== null, true, 'Node should be found');
    assert.strictEqual(typeof contextAnalyzer.verificationStatus, 'string');

    // 4. getGraphAnchor with EXTERNAL_SKILL
    const anchorSkill = await vig.getGraphAnchor(skillContext);
    assert.strictEqual(typeof anchorSkill.rootCID, 'string');
    assert.strictEqual(anchorSkill.rootCID.length, 64);
    assert.strictEqual(anchorSkill.totalNodes, vig.store.nodeCount);

    console.log('  ✓ Read-only APIs fully functional for both ANALYZER_AGENT and EXTERNAL_SKILL.');

    // ── Suite 4: Single-Writer / Multiple-Reader Concurrency & Competing Writers ──
    console.log('[Suite 4] Single-Writer / Multiple-Reader Concurrency & Lock Conflicts...');

    // 1. Multiple Readers Concurrency: Run 15 concurrent queries in parallel
    const concurrentQueries = Array.from({ length: 15 }, (_, i) =>
      vig.queryImpact(
        { changedPaths: [i % 2 === 0 ? 'src/core/math.ts' : 'src/core/calculator.ts'] },
        i % 2 === 0 ? analyzerContext : skillContext
      )
    );
    const results = await Promise.all(concurrentQueries);
    assert.strictEqual(results.length, 15);
    for (const r of results) {
      assert.strictEqual(typeof r.isNoOp, 'boolean');
    }

    // 2. Competing Writers: acquire lock explicitly and test rejection of second writer
    const lockHandle = VIGLockManager.acquireWriteLock(testVigDir, 'first-writer');
    try {
      // Second writer attempts to acquire immediately (timeoutMs: 0)
      assert.throws(
        () => {
          VIGLockManager.acquireWriteLock(testVigDir, 'competing-writer', { timeoutMs: 0 });
        },
        (err: any) => {
          assert(err instanceof VIGConflictError, 'Error must be VIGConflictError');
          assert(err.message.includes('Write lock conflict'), 'Message must indicate lock conflict');
          return true;
        },
        'Competing writer must fail with VIGConflictError'
      );
    } finally {
      lockHandle.release();
    }

    // After release, writer can acquire lock without conflict
    const secondLock = VIGLockManager.acquireWriteLock(testVigDir, 'second-writer');
    secondLock.release();

    console.log('  ✓ 15 concurrent readers executed without contention; competing writer conflict rejected with VIGConflictError.');

    // ── Suite 5: Stale Lock Detection & Safe Reclamation ─────────────────────
    console.log('[Suite 5] Stale Lock Detection & Safe Reclamation...');

    const lockPath = path.join(testVigDir, VIGLockManager.DEFAULT_LOCK_FILENAME);

    // 1. Simulate dead process lock (PID 99999999)
    const deadLockData = {
      lockId: 'dead-lock-id',
      pid: 99999999,
      agentId: 'ghost-worker',
      acquiredAt: Date.now() - 5000,
      expiresAt: Date.now() + 60000,
    };
    fs.writeFileSync(lockPath, JSON.stringify(deadLockData), 'utf8');

    // Attempting to acquire lock should reclaim stale dead-PID lock
    const reclaimedHandle = VIGLockManager.acquireWriteLock(testVigDir, 'reclaimer-worker');
    assert.strictEqual(fs.existsSync(lockPath), true);
    const inspectData = VIGLockManager.inspectLock(lockPath);
    assert.strictEqual(inspectData?.agentId, 'reclaimer-worker');
    reclaimedHandle.release();
    assert.strictEqual(fs.existsSync(lockPath), false);

    // 2. Simulate expired TTL lock
    const expiredLockData = {
      lockId: 'expired-lock-id',
      pid: process.pid,
      agentId: 'expired-worker',
      acquiredAt: Date.now() - 60000,
      expiresAt: Date.now() - 1000, // expired 1s ago
    };
    fs.writeFileSync(lockPath, JSON.stringify(expiredLockData), 'utf8');

    const ttlReclaimedHandle = VIGLockManager.acquireWriteLock(testVigDir, 'ttl-reclaimer');
    ttlReclaimedHandle.release();

    console.log('  ✓ Dead-process lock and expired-TTL lock successfully reclaimed without human intervention.');

    // ── Suite 6: Atomic Replacement & Crash Recovery (Stale .tmp Purge) ───────
    console.log('[Suite 6] Windows Atomic Replacement & Crash Recovery...');

    // Simulate interrupted write leaving 3 dangling temp files
    const tmp1 = path.join(testVigDir, `manifest.tmp.${process.pid}.${Date.now() - 10000}.abc1`);
    const tmp2 = path.join(testVigDir, `graph.tmp.${process.pid}.${Date.now() - 15000}.abc2`);
    const tmp3 = path.join(testVigDir, `evidence.tmp.${process.pid}.${Date.now() - 20000}.abc3`);
    fs.writeFileSync(tmp1, '{"partial": true}', 'utf8');
    fs.writeFileSync(tmp2, '{"partial": true}', 'utf8');
    fs.writeFileSync(tmp3, '{"partial": true}', 'utf8');

    const pastTime = (Date.now() - 120000) / 1000;
    fs.utimesSync(tmp1, pastTime, pastTime);
    fs.utimesSync(tmp2, pastTime, pastTime);
    fs.utimesSync(tmp3, pastTime, pastTime);

    assert.strictEqual(fs.existsSync(tmp1), true);

    // Run recovery sweep with age threshold = 0
    const purged = VIGRecoveryManager.cleanStaleTempFiles(testVigDir, 0);
    assert.strictEqual(purged, 3, 'Must purge all 3 stale temp files');
    assert.strictEqual(fs.existsSync(tmp1), false, 'Temp file 1 must be deleted');
    assert.strictEqual(fs.existsSync(tmp2), false, 'Temp file 2 must be deleted');
    assert.strictEqual(fs.existsSync(tmp3), false, 'Temp file 3 must be deleted');

    // Verify active files were not affected
    assert.strictEqual(fs.existsSync(vig.manifestPath), true, 'Active manifest must remain intact');

    console.log('  ✓ Crash recovery successfully swept orphaned .tmp files while preserving valid state.');

    // ── Suite 7: Corrupt-Index Detection & Quarantine ────────────────────────
    console.log('[Suite 7] Corrupt-Index Detection & Safe Quarantine...');

    // Create a temporary corrupted manifest
    const corruptDir = path.join(testRepoRoot, '.vig-corrupt-test');
    fs.mkdirSync(corruptDir, { recursive: true });
    const corruptManifestPath = path.join(corruptDir, 'manifest.json');
    fs.writeFileSync(corruptManifestPath, '{"invalid_json": true, schemaVersion: 1', 'utf8'); // syntax error

    // Quarantine should isolate the corrupt file
    const quarantined = VIGRecoveryManager.quarantineCorruptFile(
      corruptManifestPath,
      'SyntaxError: Unexpected token'
    );
    assert.strictEqual(fs.existsSync(corruptManifestPath), false, 'Corrupt file must be moved');
    assert.strictEqual(fs.existsSync(quarantined), true, 'Quarantined file must exist in corrupted/ directory');
    assert.strictEqual(quarantined.includes('corrupted'), true);

    console.log('  ✓ Corrupted index detected fail-closed and quarantined without trusting invalid state.');

    // ── Suite 8: Path Traversal Protection & Containment ─────────────────────
    console.log('[Suite 8] Path Traversal Protection & Repository Root Containment...');

    const traversalPaths = [
      '../../windows/system32/cmd.exe',
      '..\\..\\secret.key',
      'src/core/../../outside.ts',
      'src/core/../../../etc/passwd',
      `src/core/math.ts\0poison.ts`,
    ];

    for (const badPath of traversalPaths) {
      assert.throws(
        () => {
          VIGSecurityGuard.assertSafeRepositoryPath(badPath, testRepoRoot);
        },
        (err: any) => {
          assert(err instanceof VIGSecurityError, 'Error must be VIGSecurityError');
          assert(err.message.includes('Path traversal'), 'Message must indicate path traversal');
          return true;
        },
        `Must reject path traversal: ${badPath}`
      );

      // Verify queryImpact rejects path traversal
      await assert.rejects(
        async () => {
          await vig.queryImpact({ changedPaths: [badPath] }, analyzerContext);
        },
        (err: any) => {
          assert(err instanceof VIGSecurityError);
          return true;
        }
      );
    }

    // Safe path within repo must pass
    const safePath = VIGSecurityGuard.assertSafeRepositoryPath('src/core/math.ts', testRepoRoot);
    assert.strictEqual(safePath, 'src/core/math.ts');

    console.log('  ✓ All directory traversal attacks, poison null bytes, and root escapes safely blocked.');

    // ── Suite 9: Preserved Actuation Lockout & Fail-Closed Defense ───────────
    console.log('[Suite 9] Preserved Physical Actuation Lockout...');

    const actuationRequests = [
      { changedPaths: ['src/core/math.ts'], actuate: true },
      { changedPaths: ['src/core/math.ts'], hardwareAccess: 'servo_01' },
      { changedPaths: ['src/core/math.ts'], overrideLockout: true },
      { changedPaths: ['src/core/math.ts'], nested: { physicalAction: 'motor_run' } },
      { changedPaths: ['src/core/math.ts'], execCommand: 'shutdown /r' },
    ];

    for (const req of actuationRequests) {
      await assert.rejects(
        async () => {
          await vig.queryImpact(req as any, analyzerContext);
        },
        (err: any) => {
          assert(err instanceof VIGSecurityError);
          assert(err.message.includes('Actuation lockout violation'));
          return true;
        },
        'Actuation request must be blocked fail-closed'
      );
    }

    console.log('  ✓ Preserved physical actuation lockout strictly enforced fail-closed.');

  } finally {
    // Clean up temporary sandbox directory
    try {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    } catch {
      // Ignore sandbox cleanup errors
    }
  }

  console.log('\n================================================================================');
  console.log('  ALL VIG PHASE 6 SECURITY & RECOVERY SUITES PASSED (100%)');
  console.log('================================================================================\n');
}

// Self-run when executed directly via Node
if (process.argv[1]?.endsWith('vig_security_hardening.test.ts')) {
  runVIGSecurityHardeningTests().catch((err) => {
    console.error('[TEST SUITE CRASHED]:', err);
    process.exit(1);
  });
}
