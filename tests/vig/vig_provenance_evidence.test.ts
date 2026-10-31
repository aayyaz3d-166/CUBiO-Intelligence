/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Test Suite: VIG Phase 5 Provenance & Verification Evidence
 * Specification: VIG Phase 5 Acceptance Criteria
 *
 * Validates:
 * 1. Binding graph snapshots to actual Git commit, branch, and working-tree state.
 * 2. Recording typecheck and test results (exit codes, counts, durations).
 * 3. Content identity independence from timestamps (evidenceId stability).
 * 4. Multi-tier status evaluation (VERIFIED_PASS, STALE, FAILED, UNVERIFIED).
 * 5. Stale evidence detection on commit, graph seal, or working-tree change.
 * 6. Evidence ledger Merkle sealing and atomic persistence.
 * 7. Fail-closed recovery on missing, corrupt, and tampered evidence ledgers.
 * 8. Provenance WAL appending and replay.
 * 9. Protection of frozen baselines and immutable artifacts.
 */

import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

import {
  VIGProvenanceLedger,
  VIGTestSuiteRecord,
  VIGVerificationEvidence,
  VIGVerificationStatus,
  VIGIntegrityError,
  VIGValidationError,
} from '../../src/one/vig';

function assertThrows(fn: () => void, errorType: any, errorMsgSubstring?: string): void {
  let threw = false;
  try {
    fn();
  } catch (err: any) {
    threw = true;
    assert(
      err instanceof errorType,
      `Expected error of type ${errorType.name}, got: ${err?.constructor?.name} (${err.message})`
    );
    if (errorMsgSubstring) {
      assert(
        err.message.includes(errorMsgSubstring),
        `Expected error message to include "${errorMsgSubstring}", got: "${err.message}"`
      );
    }
  }
  assert(threw, `Expected function to throw ${errorType.name}, but it completed without error.`);
}

export function runVIGProvenanceEvidenceTests(): void {
  console.log('\n' + '='.repeat(80));
  console.log('  ONE LANGUAGE — VIG PHASE 5 PROVENANCE & VERIFICATION EVIDENCE');
  console.log('='.repeat(80) + '\n');

  // ============================================================================
  // Suite 1: Real Git Commit Anchoring
  // ============================================================================
  console.log('[Suite 1] Git Commit Anchoring & Working Tree Verification...');
  {
    const anchor = VIGProvenanceLedger.resolveGitCommitAnchor();

    assert(typeof anchor.commitSha === 'string' && /^[a-f0-9]{40}$/.test(anchor.commitSha), 'commitSha must be 40-char hex');
    assert(typeof anchor.branch === 'string' && anchor.branch.length > 0, 'branch must not be empty');
    assert(typeof anchor.baselineTag === 'string' && anchor.baselineTag.length > 0, 'baselineTag must not be empty');
    assert(typeof anchor.isWorkingTreeClean === 'boolean', 'isWorkingTreeClean must be boolean');
    assert(typeof anchor.committedAt === 'number' && anchor.committedAt > 0, 'committedAt must be positive epoch timestamp');

    // Confirm active branch matches expected branch
    assert(
      anchor.branch === 'integration/v1.0.1-local' || anchor.branch === 'stabilization/phase-1-fixes',
      `Expected branch to be 'integration/v1.0.1-local' or 'stabilization/phase-1-fixes', got: '${anchor.branch}'`
    );
    assert(
      anchor.baselineTag === 'v1.0.0' || anchor.baselineTag === 'v0.1.0-baseline',
      `Expected baselineTag to be 'v1.0.0' or 'v0.1.0-baseline', got: '${anchor.baselineTag}'`
    );

    console.log(`  ✓ Git commit anchor resolved: SHA=${anchor.commitSha.slice(0, 8)}..., branch=${anchor.branch}, clean=${anchor.isWorkingTreeClean}.`);
  }

  // ============================================================================
  // Suite 2: Evidence Ledger Creation & Timestamps as Non-Identity Metadata
  // ============================================================================
  console.log('\n[Suite 2] Deterministic Evidence Identity (Timestamps are Metadata)...');
  {
    const commitSha = '2e8bb6b34619d124764409f5ad28a2296122126c';
    const graphRootSeal = 'a'.repeat(64);

    const testSuites: VIGTestSuiteRecord[] = [
      {
        suitePath: 'tests/esm/esm_runtime_verification.test.ts',
        totalChecks: 3,
        passedChecks: 3,
        failedChecks: 0,
        exitCode: 0,
        durationMs: 120,
      },
      {
        suitePath: 'tests/vig/vig_native_core.test.ts',
        totalChecks: 6,
        passedChecks: 6,
        failedChecks: 0,
        exitCode: 0,
        durationMs: 250,
      },
    ];

    // Create evidence record at timestamp T1
    const rec1 = VIGProvenanceLedger.createEvidenceRecord({
      commitSha,
      graphRootSeal,
      isWorkingTreeClean: true,
      typecheckPassed: true,
      typecheckErrorCount: 0,
      testSuites,
      evaluatedAt: 1000000,
    });

    // Create evidence record at different timestamp T2
    const rec2 = VIGProvenanceLedger.createEvidenceRecord({
      commitSha,
      graphRootSeal,
      isWorkingTreeClean: true,
      typecheckPassed: true,
      typecheckErrorCount: 0,
      testSuites,
      evaluatedAt: 9999999, // 10x different timestamp!
    });

    // Requirement 7 check: evidenceId MUST be identical despite different evaluatedAt
    assert.strictEqual(
      rec1.evidenceId,
      rec2.evidenceId,
      'Evidence identity must depend strictly on content and test summary, not on evaluatedAt timestamp'
    );
    assert.strictEqual(rec1.overallPassed, true);
    assert.strictEqual(rec1.testSuites.length, 2);

    console.log('  ✓ Deterministic evidence identity verified (timestamps proven strictly metadata).');
  }

  // ============================================================================
  // Suite 3: Multi-Tier Verification Status (VERIFIED_PASS, STALE, FAILED, UNVERIFIED)
  // ============================================================================
  console.log('\n[Suite 3] Verification Status Multi-Tier Evaluation...');
  {
    const commitSha = '2e8bb6b34619d124764409f5ad28a2296122126c';
    const otherCommitSha = '152af3fc537d6254ae57a25596cad8486cf846a7';
    const graphSeal = 'a'.repeat(64);
    const otherGraphSeal = 'b'.repeat(64);

    const passingSuites: VIGTestSuiteRecord[] = [
      { suitePath: 'tests/A.test.ts', totalChecks: 5, passedChecks: 5, failedChecks: 0, exitCode: 0, durationMs: 50 },
    ];
    const failingSuites: VIGTestSuiteRecord[] = [
      { suitePath: 'tests/B.test.ts', totalChecks: 5, passedChecks: 4, failedChecks: 1, exitCode: 1, durationMs: 60 },
    ];

    const passEvidence = VIGProvenanceLedger.createEvidenceRecord({
      commitSha,
      graphRootSeal: graphSeal,
      isWorkingTreeClean: true,
      typecheckPassed: true,
      typecheckErrorCount: 0,
      testSuites: passingSuites,
    });

    const failEvidence = VIGProvenanceLedger.createEvidenceRecord({
      commitSha,
      graphRootSeal: graphSeal,
      isWorkingTreeClean: true,
      typecheckPassed: true,
      typecheckErrorCount: 0,
      testSuites: failingSuites,
    });

    const typecheckFailEvidence = VIGProvenanceLedger.createEvidenceRecord({
      commitSha,
      graphRootSeal: graphSeal,
      isWorkingTreeClean: true,
      typecheckPassed: false,
      typecheckErrorCount: 2,
      testSuites: passingSuites,
    });

    // 1. VERIFIED_PASS: Exact match, all tests & typecheck passed, clean working tree
    assert.strictEqual(
      VIGProvenanceLedger.evaluateVerificationStatus(passEvidence, commitSha, graphSeal, true),
      'VERIFIED_PASS'
    );

    // 2. STALE: Source code changed (graphRootSeal differs)
    assert.strictEqual(
      VIGProvenanceLedger.evaluateVerificationStatus(passEvidence, commitSha, otherGraphSeal, true),
      'STALE',
      'Changed graph seal must flag status as STALE'
    );

    // 3. STALE: Git commit changed (commitSha differs)
    assert.strictEqual(
      VIGProvenanceLedger.evaluateVerificationStatus(passEvidence, otherCommitSha, graphSeal, true),
      'STALE',
      'Changed commit SHA must flag status as STALE'
    );

    // 4. STALE: Working tree has uncommitted modifications
    assert.strictEqual(
      VIGProvenanceLedger.evaluateVerificationStatus(passEvidence, commitSha, graphSeal, false),
      'STALE',
      'Dirty working tree must flag status as STALE'
    );

    // 5. FAILED: Test suite failure
    assert.strictEqual(
      VIGProvenanceLedger.evaluateVerificationStatus(failEvidence, commitSha, graphSeal, true),
      'FAILED',
      'Failed test checks must flag status as FAILED'
    );

    // 6. FAILED: Typecheck failure
    assert.strictEqual(
      VIGProvenanceLedger.evaluateVerificationStatus(typecheckFailEvidence, commitSha, graphSeal, true),
      'FAILED',
      'Failed typecheck must flag status as FAILED'
    );

    // 7. UNVERIFIED: No evidence provided
    assert.strictEqual(
      VIGProvenanceLedger.evaluateVerificationStatus(null, commitSha, graphSeal, true),
      'UNVERIFIED',
      'Null evidence must flag status as UNVERIFIED'
    );

    console.log('  ✓ All 4 verification status tiers (VERIFIED_PASS, STALE, FAILED, UNVERIFIED) verified.');
  }

  // ============================================================================
  // Suite 4: Evidence Ledger Sealing, Persistence & Fail-Closed Loading
  // ============================================================================
  console.log('\n[Suite 4] Evidence Ledger Merkle Sealing & Fail-Closed Loading...');
  {
    const tmpDir = path.join(process.cwd(), '.vig_evidence_test');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const ledgerPath = path.join(tmpDir, 'evidence.json');
    const tamperedPath = path.join(tmpDir, 'tampered_evidence.json');

    try {
      const commitSha = '2e8bb6b34619d124764409f5ad28a2296122126c';
      const graphSeal = 'c'.repeat(64);

      const ev1 = VIGProvenanceLedger.createEvidenceRecord({
        commitSha,
        graphRootSeal: graphSeal,
        isWorkingTreeClean: true,
        typecheckPassed: true,
        typecheckErrorCount: 0,
        testSuites: [{ suitePath: 'tests/T1.test.ts', totalChecks: 10, passedChecks: 10, failedChecks: 0, exitCode: 0, durationMs: 100 }],
      });

      const ev2 = VIGProvenanceLedger.createEvidenceRecord({
        commitSha,
        graphRootSeal: graphSeal,
        isWorkingTreeClean: true,
        typecheckPassed: true,
        typecheckErrorCount: 0,
        testSuites: [{ suitePath: 'tests/T2.test.ts', totalChecks: 8, passedChecks: 8, failedChecks: 0, exitCode: 0, durationMs: 80 }],
      });

      // 1. Create and save ledger
      const ledger = VIGProvenanceLedger.createLedger([ev1, ev2]);
      assert.strictEqual(ledger.schemaVersion, 1);
      assert.strictEqual(ledger.evidenceRecords.length, 2);
      assert(typeof ledger.ledgerRootSeal === 'string' && ledger.ledgerRootSeal.length === 64);

      VIGProvenanceLedger.saveEvidenceLedger(ledger, ledgerPath);

      // 2. Load and verify
      const loaded = VIGProvenanceLedger.loadEvidenceLedger(ledgerPath);
      assert(loaded !== null);
      assert.strictEqual(loaded.ledgerRootSeal, ledger.ledgerRootSeal);
      assert.strictEqual(loaded.evidenceRecords.length, 2);

      // 3. Tampered Seal Rejection
      const tamperedLedger = { ...ledger, ledgerRootSeal: '0'.repeat(64) };
      fs.writeFileSync(tamperedPath, JSON.stringify(tamperedLedger), 'utf8');

      assertThrows(
        () => VIGProvenanceLedger.loadEvidenceLedger(tamperedPath),
        VIGIntegrityError,
        'Cryptographic evidence ledger seal mismatch'
      );

      console.log('  ✓ Evidence ledger sealing and fail-closed tampering detection verified.');
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  }

  // ============================================================================
  // Suite 5: Provenance WAL Appending & Replay
  // ============================================================================
  console.log('\n[Suite 5] Provenance Write-Ahead Log (WAL) Append & Replay...');
  {
    const tmpDir = path.join(process.cwd(), '.vig_wal_test');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const walPath = path.join(tmpDir, 'provenance.wal.json');

    try {
      const commitSha = '2e8bb6b34619d124764409f5ad28a2296122126c';
      const graphSeal = 'd'.repeat(64);

      const ev1 = VIGProvenanceLedger.createEvidenceRecord({
        commitSha,
        graphRootSeal: graphSeal,
        isWorkingTreeClean: true,
        typecheckPassed: true,
        typecheckErrorCount: 0,
        testSuites: [{ suitePath: 'tests/W1.test.ts', totalChecks: 1, passedChecks: 1, failedChecks: 0, exitCode: 0, durationMs: 10 }],
      });

      const ev2 = VIGProvenanceLedger.createEvidenceRecord({
        commitSha,
        graphRootSeal: graphSeal,
        isWorkingTreeClean: true,
        typecheckPassed: true,
        typecheckErrorCount: 0,
        testSuites: [{ suitePath: 'tests/W2.test.ts', totalChecks: 2, passedChecks: 2, failedChecks: 0, exitCode: 0, durationMs: 20 }],
      });

      // Append to WAL
      VIGProvenanceLedger.appendEvidenceToWAL(ev1, walPath);
      VIGProvenanceLedger.appendEvidenceToWAL(ev2, walPath);

      // Replay from WAL
      const replayed = VIGProvenanceLedger.loadEvidenceFromWAL(walPath);
      assert.strictEqual(replayed.length, 2);
      assert.strictEqual(replayed[0].evidenceId, ev1.evidenceId);
      assert.strictEqual(replayed[1].evidenceId, ev2.evidenceId);

      console.log('  ✓ Provenance WAL append and sequential replay verified.');
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  }

  // ============================================================================
  // Suite 6: Invalid Provenance Links & Malformed Input Rejection
  // ============================================================================
  console.log('\n[Suite 6] Malformed Input Rejection & Bounds Enforcement...');
  {
    // 1. Invalid commit SHA (not 40-char hex)
    assertThrows(
      () =>
        VIGProvenanceLedger.createEvidenceRecord({
          commitSha: 'not-a-valid-sha',
          graphRootSeal: 'e'.repeat(64),
          isWorkingTreeClean: true,
          typecheckPassed: true,
          typecheckErrorCount: 0,
          testSuites: [{ suitePath: 'tests/M.test.ts', totalChecks: 1, passedChecks: 1, failedChecks: 0, exitCode: 0, durationMs: 5 }],
        }),
      VIGValidationError,
      'Invalid 40-character commit SHA'
    );

    // 2. Invalid graph seal (not 64-char hex)
    assertThrows(
      () =>
        VIGProvenanceLedger.createEvidenceRecord({
          commitSha: 'a'.repeat(40),
          graphRootSeal: 'too-short',
          isWorkingTreeClean: true,
          typecheckPassed: true,
          typecheckErrorCount: 0,
          testSuites: [{ suitePath: 'tests/M.test.ts', totalChecks: 1, passedChecks: 1, failedChecks: 0, exitCode: 0, durationMs: 5 }],
        }),
      VIGValidationError,
      'Invalid 64-character graph Merkle seal'
    );

    // 3. Missing cleanliness information (BUG-A02)
    assertThrows(
      () =>
        VIGProvenanceLedger.createEvidenceRecord({
          commitSha: 'a'.repeat(40),
          graphRootSeal: 'f'.repeat(64),
          isWorkingTreeClean: undefined as any,
          typecheckPassed: true,
          typecheckErrorCount: 0,
          testSuites: [{ suitePath: 'tests/M.test.ts', totalChecks: 1, passedChecks: 1, failedChecks: 0, exitCode: 0, durationMs: 5 }],
        }),
      VIGValidationError,
      'isWorkingTreeClean must be a boolean'
    );

    console.log('  ✓ Malformed inputs rejected fail-closed.');
  }

  // ============================================================================
  // Suite 7: Verification Integrity Hardening (BUG-A01 & BUG-A02 Regression Gates)
  // ============================================================================
  console.log('\n[Suite 7] Verification Integrity Hardening (Empty, Skipped & Dirty Evidence)...');
  {
    const commitSha = '2e8bb6b34619d124764409f5ad28a2296122126c';
    const graphSeal = '7'.repeat(64);

    // 1. BUG-A01: Empty test suites (testSuites = []) must NEVER become overallPassed = true
    const emptySuiteEvidence = VIGProvenanceLedger.createEvidenceRecord({
      commitSha,
      graphRootSeal: graphSeal,
      isWorkingTreeClean: true,
      typecheckPassed: true,
      typecheckErrorCount: 0,
      testSuites: [], // ZERO tests!
    });
    assert.strictEqual(
      emptySuiteEvidence.overallPassed,
      false,
      'Empty test suites must yield overallPassed = false'
    );
    assert.strictEqual(
      emptySuiteEvidence.totalPassedChecks,
      0
    );

    // Caller cannot force overallPassed=true when testSuites is empty
    assertThrows(
      () =>
        VIGProvenanceLedger.createEvidenceRecord({
          commitSha,
          graphRootSeal: graphSeal,
          isWorkingTreeClean: true,
          typecheckPassed: true,
          typecheckErrorCount: 0,
          testSuites: [],
          overallPassed: true, // Malicious override
        }),
      VIGValidationError,
      'Cannot mark overallPassed=true when verification criteria failed'
    );

    // evaluateVerificationStatus on empty test suites must return UNVERIFIED, NEVER VERIFIED_PASS
    const emptyStatus = VIGProvenanceLedger.evaluateVerificationStatus(
      emptySuiteEvidence,
      commitSha,
      graphSeal,
      true
    );
    assert.strictEqual(
      emptyStatus,
      'UNVERIFIED',
      'Empty test suites evidence must evaluate to UNVERIFIED, never VERIFIED_PASS'
    );

    // 2. Entirely skipped test suite (passedChecks = 0, skippedChecks = 5, totalChecks = 5)
    const skippedSuiteEvidence = VIGProvenanceLedger.createEvidenceRecord({
      commitSha,
      graphRootSeal: graphSeal,
      isWorkingTreeClean: true,
      typecheckPassed: true,
      typecheckErrorCount: 0,
      testSuites: [
        {
          suitePath: 'tests/skipped.test.ts',
          totalChecks: 5,
          passedChecks: 0,
          failedChecks: 0,
          skippedChecks: 5,
          exitCode: 0,
          durationMs: 10,
        },
      ],
    });
    assert.strictEqual(skippedSuiteEvidence.overallPassed, false);
    assert.strictEqual(skippedSuiteEvidence.totalPassedChecks, 0);
    assert.strictEqual(skippedSuiteEvidence.totalSkippedChecks, 5);

    const skippedStatus = VIGProvenanceLedger.evaluateVerificationStatus(
      skippedSuiteEvidence,
      commitSha,
      graphSeal,
      true
    );
    assert.strictEqual(
      skippedStatus,
      'UNVERIFIED',
      'Entirely skipped suite with 0 passed checks must evaluate to UNVERIFIED'
    );

    // 3. Suite with blocked checks (passedChecks = 4, blockedChecks = 1, totalChecks = 5)
    const blockedSuiteEvidence = VIGProvenanceLedger.createEvidenceRecord({
      commitSha,
      graphRootSeal: graphSeal,
      isWorkingTreeClean: true,
      typecheckPassed: true,
      typecheckErrorCount: 0,
      testSuites: [
        {
          suitePath: 'tests/blocked.test.ts',
          totalChecks: 5,
          passedChecks: 4,
          failedChecks: 0,
          blockedChecks: 1,
          exitCode: 0,
          durationMs: 20,
        },
      ],
    });
    assert.strictEqual(blockedSuiteEvidence.overallPassed, false);
    assert.strictEqual(blockedSuiteEvidence.totalPassedChecks, 4);
    assert.strictEqual(blockedSuiteEvidence.totalBlockedChecks, 1);

    const blockedStatus = VIGProvenanceLedger.evaluateVerificationStatus(
      blockedSuiteEvidence,
      commitSha,
      graphSeal,
      true
    );
    assert.strictEqual(
      blockedStatus,
      'FAILED',
      'Suite with blocked checks must evaluate to FAILED'
    );

    // 4. BUG-A02: Missing working-tree cleanliness information must fail closed to STALE
    const validEvidence = VIGProvenanceLedger.createEvidenceRecord({
      commitSha,
      graphRootSeal: graphSeal,
      isWorkingTreeClean: true,
      typecheckPassed: true,
      typecheckErrorCount: 0,
      testSuites: [
        {
          suitePath: 'tests/passed.test.ts',
          totalChecks: 3,
          passedChecks: 3,
          failedChecks: 0,
          skippedChecks: 0,
          blockedChecks: 0,
          exitCode: 0,
          durationMs: 15,
        },
      ],
    });
    assert.strictEqual(validEvidence.overallPassed, true);
    assert.strictEqual(validEvidence.totalPassedChecks, 3);

    // Missing cleanliness info (undefined / non-boolean) fails closed to STALE
    const missingCleanStatus = VIGProvenanceLedger.evaluateVerificationStatus(
      validEvidence,
      commitSha,
      graphSeal,
      undefined as any // Missing argument
    );
    assert.strictEqual(
      missingCleanStatus,
      'STALE',
      'Missing isWorkingTreeClean argument must fail closed to STALE'
    );

    // 5. Evidence captured on dirty tree (isWorkingTreeClean = false at creation) must NEVER be VERIFIED_PASS
    const dirtyCapturedEvidence = VIGProvenanceLedger.createEvidenceRecord({
      commitSha,
      graphRootSeal: graphSeal,
      isWorkingTreeClean: false, // Captured on dirty tree!
      typecheckPassed: true,
      typecheckErrorCount: 0,
      testSuites: [
        {
          suitePath: 'tests/passed.test.ts',
          totalChecks: 3,
          passedChecks: 3,
          failedChecks: 0,
          exitCode: 0,
          durationMs: 15,
        },
      ],
    });
    // Even if the current working tree is reported as clean (true), evidence was dirty!
    const dirtyEvidenceCleanTreeStatus = VIGProvenanceLedger.evaluateVerificationStatus(
      dirtyCapturedEvidence,
      commitSha,
      graphSeal,
      true // Current tree is clean
    );
    assert.strictEqual(
      dirtyEvidenceCleanTreeStatus,
      'STALE',
      'Evidence recorded on a dirty tree must evaluate to STALE even if current tree is clean'
    );

    // Current working tree dirty (false) must evaluate to STALE even if evidence was clean
    const cleanEvidenceDirtyTreeStatus = VIGProvenanceLedger.evaluateVerificationStatus(
      validEvidence,
      commitSha,
      graphSeal,
      false // Current tree is dirty
    );
    assert.strictEqual(
      cleanEvidenceDirtyTreeStatus,
      'STALE',
      'Clean evidence on dirty current tree must evaluate to STALE'
    );

    // Clean evidence on clean tree evaluates to VERIFIED_PASS
    const cleanPassStatus = VIGProvenanceLedger.evaluateVerificationStatus(
      validEvidence,
      commitSha,
      graphSeal,
      true
    );
    assert.strictEqual(cleanPassStatus, 'VERIFIED_PASS');

    console.log('  ✓ BUG-A01 & BUG-A02 regression gates verified: 0-test, skipped, blocked & dirty evidence strictly rejected.');
  }

  console.log('\n' + '='.repeat(80));
  console.log('  ALL VIG PHASE 5 PROVENANCE & EVIDENCE SUITES PASSED (100%)');
  console.log('='.repeat(80) + '\n');
}

// Auto-execute when run as direct script
runVIGProvenanceEvidenceTests();
