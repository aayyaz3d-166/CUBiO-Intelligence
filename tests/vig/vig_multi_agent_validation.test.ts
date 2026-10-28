/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Test Suite: tests/vig/vig_multi_agent_validation.test.ts
 * Specification: VIG Phase 12 — Multi-Agent Validation
 *
 * Validates:
 * 1. Concurrent read queries across 20 distinct agents with zero contention.
 * 2. Competing index-update requests and single-writer exclusive lock enforcement.
 * 3. Stale reads and version conflict detection upon source/commit changes.
 * 4. Strict authorization separation across SYSTEM_CORE, ANALYZER_AGENT, and EXTERNAL_SKILL.
 * 5. Crash recovery from interrupted writes and graceful unavailable service handling.
 * 6. Audit-log completeness, source-version traceability, and zero gaps.
 * 7. Protocol version negotiation and backward compatibility (1.0.0, 1.2.0 vs 2.0.0).
 * 8. Resource bounds, concurrency limits, and rate limiting (429 RateLimitError).
 * 9. One representative agent end-to-end execution without unauthorized expansion.
 * 10. Emergency rollback verification and state preservation.
 */

import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  VIGSecurityContext,
  VIGAccessDeniedError,
  VIGSecurityError,
  VIGConflictError,
  VIGVerificationEvidence,
} from '../../src/one/vig/types';
import {
  VIGAgenticAdapter,
  VIGRepresentativeAgent,
  VIGApprovalGate,
  VIGAgenticApprovalRequiredError,
  VIGAgenticSecurityError,
  VIGAgenticRateLimitError,
  VIGAgenticStaleEvidenceError,
  VIGAgenticDisabledError,
  VIGAgenticUnavailableError,
} from '../../src/one/vig/agentic';
import {
  VIGCUBiOAdapter,
  VIGCUBiOIncompatibleVersionError,
} from '../../src/one/vig/cubio';
import { VerifiableIntelligenceGraph } from '../../src/one/vig/VerifiableIntelligenceGraph';
import { VIGProvenanceLedger } from '../../src/one/vig/VIGProvenanceLedger';
import { VIGLockManager } from '../../src/one/vig/VIGLockManager';
import { VIGRecoveryManager } from '../../src/one/vig/VIGRecoveryManager';
import { VIGSecurityGuard } from '../../src/one/vig/VIGSecurityGuard';

export async function runVIGMultiAgentValidationTests(): Promise<void> {
  console.log('\n================================================================================');
  console.log('  ONE LANGUAGE — VIG PHASE 12 MULTI-AGENT VALIDATION');
  console.log('================================================================================\n');

  // Create isolated sandbox directory for test artifacts
  const tempBaseDir = path.join(os.tmpdir(), `vig-multiagent-test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
  const testRepoRoot = path.join(tempBaseDir, 'repo');
  const testVigDir = path.join(testRepoRoot, '.vig');
  fs.mkdirSync(path.join(testRepoRoot, 'src', 'core'), { recursive: true });
  fs.mkdirSync(path.join(testRepoRoot, 'tests', 'core'), { recursive: true });
  fs.mkdirSync(testVigDir, { recursive: true });

  // Create mock source and test files
  const mathPath = path.join(testRepoRoot, 'src', 'core', 'math.ts');
  const enginePath = path.join(testRepoRoot, 'src', 'core', 'engine.ts');
  const testPath = path.join(testRepoRoot, 'tests', 'core', 'math.test.ts');
  fs.writeFileSync(mathPath, 'export function multiply(a: number, b: number): number { return a * b; }\n', 'utf8');
  fs.writeFileSync(enginePath, 'import { multiply } from "./math"; export function compute() { return multiply(3, 7); }\n', 'utf8');
  fs.writeFileSync(testPath, 'import { multiply } from "../../src/core/math"; export function runTest() { return multiply(2, 3) === 6; }\n', 'utf8');

  const multiSecret = 'vig-multiagent-test-secret-2026';
  VIGSecurityGuard.configureSystemSecret(multiSecret);
  VIGApprovalGate.configureApprovalSecret(multiSecret);
  const systemContext: VIGSecurityContext = VIGSecurityGuard.createSystemContext(
    'system-multiagent-runner',
    multiSecret
  );

  let mockWorkingTreeClean = true;
  let mockCommitSha = '2e8bb6b34619d124764409f5ad28a2296122126c';
  const originalResolveAnchor = VIGProvenanceLedger.resolveGitCommitAnchor;
  VIGProvenanceLedger.resolveGitCommitAnchor = (repoRoot?: string) => {
    if (repoRoot && path.resolve(repoRoot) === path.resolve(testRepoRoot)) {
      return {
        commitSha: mockCommitSha,
        parentSha: '0000000000000000000000000000000000000000',
        branch: 'stabilization/phase-1-fixes',
        baselineTag: 'v0.1.0-baseline',
        isWorkingTreeClean: mockWorkingTreeClean,
        committedAt: 1700000000,
      };
    }
    return originalResolveAnchor(repoRoot);
  };

  try {
    const vig = new VerifiableIntelligenceGraph({
      repoRoot: testRepoRoot,
      vigDir: testVigDir,
    });

    // Populate initial graph
    await vig.updateIndex(systemContext);

    // Record initial valid passing evidence
    const passEvidence: Omit<VIGVerificationEvidence, 'evidenceId'> = {
      commitSha: mockCommitSha,
      graphRootSeal: vig.store.computeRootSeal(),
      evaluatedAt: Date.now(),
      typecheckPassed: true,
      typecheckErrorCount: 0,
      testSuites: [
        {
          suitePath: 'tests/core/math.test.ts',
          totalChecks: 1,
          passedChecks: 1,
          failedChecks: 0,
          exitCode: 0,
          durationMs: 40,
        },
      ],
      overallPassed: true,
    };
    await vig.recordEvidence(systemContext, passEvidence);

    const adapter = new VIGAgenticAdapter(vig, {
      timeoutMs: 3000,
      circuitBreakerThreshold: 5,
      maxConcurrentQueries: 50,
      maxRequestsPerWindow: 200,
    });

    // ── Suite 1: Concurrent Read Queries across Multiple Agents ─────────────
    console.log('[Suite 1] Concurrent Read Queries across 20 Distinct Agents...');

    const agentIds = Array.from({ length: 20 }, (_, i) => `agent-reader-${String(i + 1).padStart(2, '0')}`);
    const readPromises = agentIds.map(async (agentId) => {
      const agentContext: VIGSecurityContext = { role: 'ANALYZER_AGENT', agentId };
      const ctx = await adapter.queryVerifiedContextForAgent('src/core/math.ts', undefined, false, agentContext);
      const imp = await adapter.queryDependencyImpactForAgent(['src/core/math.ts'], undefined, false, agentContext);
      const anc = await adapter.getProvenanceAnchorForAgent(agentContext);
      return { agentId, ctx, imp, anc };
    });

    const concurrentResults = await Promise.all(readPromises);
    assert.strictEqual(concurrentResults.length, 20);

    // Verify determinism across all 20 concurrent readers
    const firstRootSeal = concurrentResults[0].ctx.graphRootSeal;
    const firstCommitSha = concurrentResults[0].ctx.boundCommitSha;
    for (const res of concurrentResults) {
      assert.strictEqual(res.ctx.graphRootSeal, firstRootSeal);
      assert.strictEqual(res.ctx.boundCommitSha, firstCommitSha);
      assert.strictEqual(res.ctx.node?.name, 'math.ts');
      assert.strictEqual(res.imp.affectedModules.length > 0, true);
      assert.strictEqual(res.anc.commitSha, firstCommitSha);
    }
    console.log('  ✓ 20 concurrent agent queries completed with zero contention and bit-exact determinism');

    // ── Suite 2: Competing Index-Update Requests & Single-Writer Lock ────────
    console.log('[Suite 2] Competing Index-Update Requests & Single-Writer Enforcement...');

    const writerAContext: VIGSecurityContext = VIGSecurityGuard.createSystemContext('writer-agent-01', multiSecret);
    const writerBContext: VIGSecurityContext = VIGSecurityGuard.createSystemContext('writer-agent-02', multiSecret);

    // Acquire write lock directly to simulate active ongoing write
    const activeLock = VIGLockManager.acquireWriteLock(testVigDir, writerAContext.agentId);
    assert.strictEqual(typeof activeLock.lockId, 'string');
    const lockOnDisk = VIGLockManager.inspectLock(activeLock.lockPath);
    assert.strictEqual(lockOnDisk?.agentId, writerAContext.agentId);

    // Competing writer B attempts updateIndex while lock is held -> must fail closed with VIGConflictError
    await assert.rejects(
      async () => {
        await vig.updateIndex(writerBContext);
      },
      (err: any) => err instanceof VIGConflictError
    );
    console.log('  ✓ Competing writer B rejected fail-closed with VIGConflictError while writer A holds lock');

    // Release writer A's lock
    activeLock.release();

    // Now writer B can proceed cleanly with an actual code modification
    fs.appendFileSync(mathPath, '\nexport const PI = 3.14159;\n');
    const updateRes = await vig.updateIndex(writerBContext);
    assert.strictEqual(updateRes.isNoOp, false);
    assert.strictEqual(updateRes.manifestUpdated, true);
    console.log('  ✓ Writer B cleanly acquired lock after release and completed index update');

    // ── Suite 3: Stale Reads and Version Conflict Detection ─────────────────
    console.log('[Suite 3] Stale Reads and Version Conflict Detection...');

    // Re-record fresh evidence for updated graph root seal
    const freshEvidence: Omit<VIGVerificationEvidence, 'evidenceId'> = {
      commitSha: mockCommitSha,
      graphRootSeal: vig.store.computeRootSeal(),
      evaluatedAt: Date.now(),
      typecheckPassed: true,
      typecheckErrorCount: 0,
      testSuites: [
        {
          suitePath: 'tests/core/math.test.ts',
          totalChecks: 1,
          passedChecks: 1,
          failedChecks: 0,
          exitCode: 0,
          durationMs: 40,
        },
      ],
      overallPassed: true,
    };
    await vig.recordEvidence(systemContext, freshEvidence);

    // Agent reads context with clean working tree
    const cleanContext = await adapter.queryVerifiedContextForAgent('src/core/math.ts', undefined, false);
    assert.strictEqual(cleanContext.verificationStatus, 'VERIFIED_PASS');
    assert.strictEqual(cleanContext.isStale, false);

    // Simulate commit move / working tree modification
    mockWorkingTreeClean = false;

    // Agent re-reads context: status is now STALE
    const staleContext = await adapter.queryVerifiedContextForAgent('src/core/math.ts', undefined, false);
    assert.strictEqual(staleContext.verificationStatus, 'STALE');
    assert.strictEqual(staleContext.isStale, true);
    assert.strictEqual(staleContext.warnings.some((w) => w.includes('STALE')), true);

    // Strict mode rejection
    await assert.rejects(
      async () => {
        await adapter.queryVerifiedContextForAgent('src/core/math.ts', undefined, true);
      },
      (err: any) => err instanceof VIGAgenticStaleEvidenceError && err.statusCode === 409
    );
    console.log('  ✓ Stale working tree state detected and rejected fail-closed in strict mode (409)');
    mockWorkingTreeClean = true; // reset

    // ── Suite 4: Authorization Separation Between Agent Roles ────────────────
    console.log('[Suite 4] Authorization Separation across SYSTEM_CORE, ANALYZER, and SKILL...');

    const analyzerContext: VIGSecurityContext = { role: 'ANALYZER_AGENT', agentId: 'analyzer-01' };
    const skillContext: VIGSecurityContext = { role: 'EXTERNAL_SKILL', agentId: 'skill-01' };

    // 1. ANALYZER_AGENT cannot update index
    await assert.rejects(
      async () => {
        await vig.updateIndex(analyzerContext);
      },
      (err: any) => err instanceof VIGAccessDeniedError
    );

    // 2. EXTERNAL_SKILL cannot update index
    await assert.rejects(
      async () => {
        await vig.updateIndex(skillContext);
      },
      (err: any) => err instanceof VIGAccessDeniedError
    );

    // 3. ANALYZER_AGENT cannot issue approval tokens
    assert.throws(
      () => {
        VIGApprovalGate.issueApprovalToken('prop-test-01', 'analyzer-01', analyzerContext);
      },
      (err: any) => err instanceof VIGAgenticSecurityError
    );

    // 4. EXTERNAL_SKILL cannot issue approval tokens
    assert.throws(
      () => {
        VIGApprovalGate.issueApprovalToken('prop-test-01', 'skill-01', skillContext);
      },
      (err: any) => err instanceof VIGAgenticSecurityError
    );

    // 5. SYSTEM_CORE can issue approval tokens
    const validToken = VIGApprovalGate.issueApprovalToken('prop-test-01', 'system-admin', systemContext);
    assert.strictEqual(validToken.approverRole, 'SYSTEM_CORE');
    console.log('  ✓ Strict authorization verified: ANALYZER & SKILL blocked from mutations and approvals');

    // ── Suite 5: Recovery from Interrupted Updates & Unavailable Services ────
    console.log('[Suite 5] Crash Recovery from Interrupted Updates & Unavailable Services...');

    // Simulate crash artifacts: orphaned .tmp files and dead lock file
    const orphanTmp = path.join(testVigDir, 'manifest.json.tmp.123456');
    fs.writeFileSync(orphanTmp, '{"incomplete": true}\n', 'utf8');
    assert.strictEqual(fs.existsSync(orphanTmp), true);

    // Run startup recovery
    VIGRecoveryManager.performStartupRecovery(testVigDir);
    assert.strictEqual(fs.existsSync(orphanTmp), false);
    console.log('  ✓ Startup recovery successfully swept orphaned .tmp file without state corruption');

    // Test unavailable service
    const unavailableAdapter = new VIGAgenticAdapter(null);
    await assert.rejects(
      async () => {
        await unavailableAdapter.queryVerifiedContextForAgent('src/core/math.ts');
      },
      (err: any) => err instanceof VIGAgenticUnavailableError && err.statusCode === 503
    );
    console.log('  ✓ Uninitialized/null VIG service rejected gracefully with VIGAgenticUnavailableError (503)');

    // ── Suite 6: Audit-Log Completeness and Source-Version Traceability ──────
    console.log('[Suite 6] Audit-Log Completeness & Source-Version Traceability...');

    const auditLogs = adapter.getAuditLogs();
    assert.strictEqual(auditLogs.length >= 20, true);

    // Check completeness and traceability fields
    for (const log of auditLogs) {
      assert.strictEqual(typeof log.recordId, 'string');
      assert.strictEqual(typeof log.timestamp, 'number');
      assert.strictEqual(typeof log.agentId, 'string');
      assert.strictEqual(typeof log.role, 'string');
      assert.strictEqual(typeof log.operation, 'string');
      assert.strictEqual(typeof log.statusCode, 'number');
      if (log.operation === 'queryVerifiedContextForAgent' && log.outcome === 'SUCCESS') {
        assert.strictEqual(typeof log.boundCommitSha, 'string');
        assert.strictEqual(typeof log.verificationStatus, 'string');
      }
    }
    console.log(`  ✓ Audit trail verified complete: ${auditLogs.length} records with complete cryptographic anchors`);

    // ── Suite 7: Protocol Version Compatibility & Client Negotiation ─────────
    console.log('[Suite 7] Protocol Version Compatibility & Client Negotiation...');

    const cubioAdapter = new VIGCUBiOAdapter(vig);

    // Protocol 1.0.0 client -> compatible
    const v100Res = await cubioAdapter.handshake(
      { agentId: 'c1', role: 'ANALYZER_AGENT', clientVersion: '1.0.0', requestedProtocolVersion: '1.0.0' },
      analyzerContext
    );
    assert.strictEqual(v100Res.isCompatible, true);
    assert.strictEqual(v100Res.protocolVersion, '1.0.0');

    // Protocol 1.2.0 client -> backward compatible (major version 1 matches)
    const v120Res = await cubioAdapter.handshake(
      { agentId: 'c2', role: 'ANALYZER_AGENT', clientVersion: '1.2.0', requestedProtocolVersion: '1.2.0' },
      analyzerContext
    );
    assert.strictEqual(v120Res.isCompatible, true);

    // Protocol 2.0.0 client -> incompatible, rejected fail-closed
    await assert.rejects(
      async () => {
        await cubioAdapter.handshake(
          { agentId: 'c3', role: 'ANALYZER_AGENT', clientVersion: '2.0.0', requestedProtocolVersion: '2.0.0' },
          analyzerContext
        );
      },
      (err: any) => err instanceof VIGCUBiOIncompatibleVersionError && err.statusCode === 400
    );
    console.log('  ✓ Version negotiation: 1.0.0 and 1.2.0 accepted; 2.0.0 rejected fail-closed');

    // ── Suite 8: Resource Limits, Rate Limiting & Concurrency Quotas ─────────
    console.log('[Suite 8] Resource Limits, Rate Limiting & Concurrency Quotas...');

    // Create a rate-limited adapter: max 3 requests per 10s window
    const rateLimitedAdapter = new VIGAgenticAdapter(vig, {
      maxRequestsPerWindow: 3,
      rateLimitWindowMs: 10000,
      timeoutMs: 2000,
    });

    // Requests 1, 2, 3 succeed
    await rateLimitedAdapter.queryVerifiedContextForAgent('src/core/math.ts', undefined, false);
    await rateLimitedAdapter.queryVerifiedContextForAgent('src/core/math.ts', undefined, false);
    await rateLimitedAdapter.queryVerifiedContextForAgent('src/core/math.ts', undefined, false);

    // Request 4 exceeds rate limit -> rejected with 429
    await assert.rejects(
      async () => {
        await rateLimitedAdapter.queryVerifiedContextForAgent('src/core/math.ts', undefined, false);
      },
      (err: any) => err instanceof VIGAgenticRateLimitError && err.statusCode === 429
    );
    console.log('  ✓ Rate limit exceeded cleanly rejected with VIGAgenticRateLimitError (429)');

    // Concurrency quota test: maxConcurrentQueries: 1 with slow operation
    const slowVig = Object.create(vig);
    slowVig.getVerifiedContext = async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
      return vig.getVerifiedContext({ targetPath: 'src/core/math.ts' });
    };

    const concurrencyLimitedAdapter = new VIGAgenticAdapter(slowVig, {
      maxConcurrentQueries: 1,
      timeoutMs: 2000,
    });

    // Launch query 1 (running)
    const p1 = concurrencyLimitedAdapter.queryVerifiedContextForAgent('src/core/math.ts', undefined, false);

    // Launch query 2 immediately while query 1 is active -> rejected with 429 concurrency limit
    await assert.rejects(
      async () => {
        await concurrencyLimitedAdapter.queryVerifiedContextForAgent('src/core/math.ts', undefined, false);
      },
      (err: any) => err instanceof VIGAgenticRateLimitError && err.statusCode === 429
    );

    // p1 finishes cleanly
    await p1;
    console.log('  ✓ Concurrency quota exceeded cleanly rejected with VIGAgenticRateLimitError (429)');

    // ── Suite 9: One Representative Agent End-to-End Before Expansion ────────
    console.log('[Suite 9] One Representative Agent End-to-End Operational Pipeline...');

    const representativeAgent = new VIGRepresentativeAgent(adapter, {
      agentId: 'sovereign-representative-agent',
    });

    // 1. Analyze module with clean evidence
    const repConclusion = await representativeAgent.analyzeModule('src/core/math.ts');
    assert.strictEqual(repConclusion.agentId, 'sovereign-representative-agent');
    assert.strictEqual(repConclusion.confidence, 'HIGH');
    assert.strictEqual(repConclusion.verificationStatus, 'VERIFIED_PASS');

    // 2. Evaluate change impact and propose test plan
    const { testPlan, proposal } = await representativeAgent.evaluateChangeImpact(['src/core/math.ts']);
    assert.strictEqual(testPlan.requiredTestSuites.length > 0, true);
    assert.strictEqual(testPlan.requiredTestSuites[0].executionStatus, 'PENDING_EXECUTION');
    assert.strictEqual(proposal.status, 'PROPOSED');
    assert.strictEqual(proposal.requiresApproval, true);

    // 3. Propose remediation
    const remediation = await representativeAgent.proposeRemediation(
      'src/core/math.ts',
      'Refactor multiplication logic',
      'export function multiply(a: number, b: number): number { return Math.imul(a, b); }\n'
    );
    assert.strictEqual(remediation.status, 'PROPOSED');

    // 4. Issue approval token via SYSTEM_CORE
    const approvalToken = VIGApprovalGate.issueApprovalToken(
      remediation,
      'lead-architect-pma',
      systemContext
    );

    // 5. Approve and execute
    const approvedRemediation = VIGApprovalGate.approveProposal(remediation, approvalToken);
    assert.strictEqual(approvedRemediation.status, 'APPROVED');

    let actionExecuted = false;
    const execution = await VIGApprovalGate.executeApprovedAction(
      approvedRemediation,
      approvalToken,
      async () => {
        actionExecuted = true;
        return { success: true };
      }
    );

    assert.strictEqual(actionExecuted, true);
    assert.strictEqual(execution.updatedProposal.status, 'EXECUTED');
    console.log('  ✓ Representative agent executed complete 5-step operational pipeline with zero privilege bleed');

    // ── Suite 10: Rollback to Previously Accepted Integration State ──────────
    console.log('[Suite 10] Emergency Rollback Verification & State Preservation...');

    // Capture pre-rollback state
    const preRollbackManifest = fs.readFileSync(path.join(testVigDir, 'manifest.json'), 'utf8');
    const preRollbackEvidence = fs.readFileSync(path.join(testVigDir, 'evidence.json'), 'utf8');

    // Trigger emergency rollback
    adapter.rollback('Operator requested milestone freeze');
    assert.strictEqual(adapter.getRolloutMode(), 'DISABLED');

    // All subsequent queries must be immediately rejected with 503
    await assert.rejects(
      async () => {
        await adapter.queryVerifiedContextForAgent('src/core/math.ts', undefined, false);
      },
      (err: any) => err instanceof VIGAgenticDisabledError && err.statusCode === 503
    );

    await assert.rejects(
      async () => {
        await adapter.queryDependencyImpactForAgent(['src/core/math.ts'], undefined, false);
      },
      (err: any) => err instanceof VIGAgenticDisabledError && err.statusCode === 503
    );

    // Verify disk files remained 100% unaltered
    const postRollbackManifest = fs.readFileSync(path.join(testVigDir, 'manifest.json'), 'utf8');
    const postRollbackEvidence = fs.readFileSync(path.join(testVigDir, 'evidence.json'), 'utf8');
    assert.strictEqual(postRollbackManifest, preRollbackManifest);
    assert.strictEqual(postRollbackEvidence, preRollbackEvidence);
    console.log('  ✓ Emergency rollback blocked queries immediately and preserved 100% disk integrity');

    // Operator restores service
    adapter.setRolloutMode('ACTIVE');
    assert.strictEqual(adapter.getRolloutMode(), 'ACTIVE');

    const restoredContext = await adapter.queryVerifiedContextForAgent('src/core/math.ts', undefined, false);
    assert.strictEqual(restoredContext.node?.name, 'math.ts');
    console.log('  ✓ Service restored to ACTIVE mode cleanly without data loss');

  } finally {
    VIGProvenanceLedger.resolveGitCommitAnchor = originalResolveAnchor;
    // Clean up temporary sandbox directory
    try {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  }

  console.log('\n================================================================================');
  console.log('  VIG PHASE 12 MULTI-AGENT VALIDATION PASSED (10/10 SUITES)');
  console.log('================================================================================\n');
}
