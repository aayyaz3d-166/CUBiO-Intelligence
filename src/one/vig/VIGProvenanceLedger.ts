/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/VIGProvenanceLedger
 * Specification: VIG Phase 5 Provenance & Verification Evidence
 *
 * Implements Git commit anchoring, deterministic verification evidence records,
 * multi-tier status evaluation (VERIFIED_PASS, STALE, FAILED, UNVERIFIED),
 * and tamper-resistant evidence ledger persistence.
 */

import { execSync, ExecSyncOptionsWithStringEncoding } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import {
  VIGCommitAnchor,
  VIGTestSuiteRecord,
  VIGVerificationEvidence,
  VIGVerificationStatus,
  VIGEvidenceLedger,
  VIGIntegrityError,
  VIGValidationError,
} from './types';
import { VIGManifestManager } from './VIGManifestManager';

export class VIGProvenanceLedger {
  public static readonly DEFAULT_EVIDENCE_FILE = '.vig/evidence.json';
  public static readonly DEFAULT_WAL_FILE = '.vig/provenance.wal.json';
  public static readonly CURRENT_SCHEMA_VERSION = 1;

  // ── 1. Git Commit Anchoring ─────────────────────────────────────────────────

  /**
   * Resolves the actual current Git commit anchor for the working tree.
   * Never fabricates clean status: inspects `git status --porcelain`.
   */
  public static resolveGitCommitAnchor(repoRoot?: string): VIGCommitAnchor {
    const cwd = repoRoot ?? process.cwd();

    try {
      const execOpts: ExecSyncOptionsWithStringEncoding = {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      };
      const commitSha = execSync('git rev-parse HEAD', execOpts).trim();
      let parentSha = '';
      try {
        parentSha = execSync('git rev-parse HEAD^', execOpts).trim();
      } catch {
        // Initial commit has no parent
      }

      const branch = execSync('git rev-parse --abbrev-ref HEAD', execOpts).trim();

      let baselineTag = 'v0.1.0-baseline';
      try {
        baselineTag = execSync('git describe --tags --abbrev=0', execOpts).trim();
      } catch {
        // Tag describe failed, fallback to baseline constant
      }

      const statusOutput = execSync('git status --porcelain', execOpts);
      const isWorkingTreeClean = statusOutput.trim().length === 0;

      const committedAtStr = execSync('git log -1 --format=%ct', execOpts).trim();
      const committedAt = parseInt(committedAtStr, 10) || Math.floor(Date.now() / 1000);

      return Object.freeze({
        commitSha,
        parentSha,
        branch,
        baselineTag,
        isWorkingTreeClean,
        committedAt,
      });
    } catch (err: any) {
      throw new VIGIntegrityError(`Failed to resolve Git commit anchor: ${err.message}`);
    }
  }

  // ── 2. Evidence Record Creation ─────────────────────────────────────────────

  /**
   * Computes the deterministic SHA-256 evidence identity.
   * Timestamps are strictly metadata and NEVER included in content identity!
   */
  public static computeEvidenceId(
    commitSha: string,
    graphRootSeal: string,
    isWorkingTreeClean: boolean,
    typecheckPassed: boolean,
    typecheckErrorCount: number,
    testSuites: readonly VIGTestSuiteRecord[]
  ): string {
    const sortedSuites = testSuites
      .slice()
      .sort((a, b) => a.suitePath.localeCompare(b.suitePath));

    const suiteSummary = sortedSuites
      .map((s) => {
        const skipped = s.skippedChecks ?? 0;
        const blocked = s.blockedChecks ?? 0;
        return `${s.suitePath}:${s.exitCode}:${s.passedChecks}:${s.failedChecks}:${skipped}:${blocked}:${s.totalChecks}`;
      })
      .join(';');

    const payload = `${commitSha}|${graphRootSeal}|${isWorkingTreeClean ? 1 : 0}|${typecheckPassed ? 1 : 0}|${typecheckErrorCount}|${suiteSummary}`;
    return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
  }

  /**
   * Creates an immutable VIGVerificationEvidence record.
   * Enforces meaningful verification evidence (BUG-A01):
   * - Zero test suites or zero passed checks CANNOT yield overallPassed = true.
   * - Missing cleanliness information fails closed (BUG-A02).
   */
  public static createEvidenceRecord(params: {
    commitSha: string;
    graphRootSeal: string;
    isWorkingTreeClean: boolean;
    typecheckPassed: boolean;
    typecheckErrorCount: number;
    testSuites: readonly VIGTestSuiteRecord[];
    overallPassed?: boolean;
    provenanceSeal?: string;
    evaluatedAt?: number;
  }): VIGVerificationEvidence {
    if (!params.commitSha || !/^[a-f0-9]{40}$/.test(params.commitSha)) {
      throw new VIGValidationError(`Invalid 40-character commit SHA: "${params.commitSha}"`);
    }
    if (!params.graphRootSeal || !/^[a-f0-9]{64}$/.test(params.graphRootSeal)) {
      throw new VIGValidationError(`Invalid 64-character graph Merkle seal: "${params.graphRootSeal}"`);
    }
    if (typeof params.isWorkingTreeClean !== 'boolean') {
      throw new VIGValidationError(
        `isWorkingTreeClean must be a boolean, got: "${String(params.isWorkingTreeClean)}"`
      );
    }
    if (!Array.isArray(params.testSuites)) {
      throw new VIGValidationError('testSuites must be an array');
    }

    // Validate each suite and compute totals
    let totalPassedChecks = 0;
    let totalFailedChecks = 0;
    let totalSkippedChecks = 0;
    let totalBlockedChecks = 0;

    const validatedSuites: VIGTestSuiteRecord[] = [];
    for (const s of params.testSuites) {
      if (!s || typeof s.suitePath !== 'string' || s.suitePath.trim().length === 0) {
        throw new VIGValidationError('Test suite record must include a valid suitePath');
      }
      const passed = s.passedChecks ?? 0;
      const failed = s.failedChecks ?? 0;
      const skipped = s.skippedChecks ?? 0;
      const blocked = s.blockedChecks ?? 0;
      const total = s.totalChecks ?? (passed + failed + skipped + blocked);

      if (passed < 0 || failed < 0 || skipped < 0 || blocked < 0 || total < 0) {
        throw new VIGValidationError(`Test suite check counts cannot be negative: ${s.suitePath}`);
      }
      if (total < passed + failed + skipped + blocked) {
        throw new VIGValidationError(
          `Test suite totalChecks (${total}) cannot be less than sum of components (${passed + failed + skipped + blocked}): ${s.suitePath}`
        );
      }

      totalPassedChecks += passed;
      totalFailedChecks += failed;
      totalSkippedChecks += skipped;
      totalBlockedChecks += blocked;

      validatedSuites.push(
        Object.freeze({
          suitePath: s.suitePath.trim(),
          totalChecks: total,
          passedChecks: passed,
          failedChecks: failed,
          skippedChecks: skipped,
          blockedChecks: blocked,
          exitCode: s.exitCode ?? 0,
          durationMs: s.durationMs ?? 0,
        })
      );
    }

    const sortedSuites = Object.freeze(
      validatedSuites.sort((a, b) => a.suitePath.localeCompare(b.suitePath))
    );

    // BUG-A01 FIX: Empty or entirely skipped test evidence must never become VERIFIED_PASS!
    const computedOverallPassed =
      sortedSuites.length > 0 &&
      totalPassedChecks > 0 &&
      totalFailedChecks === 0 &&
      totalBlockedChecks === 0 &&
      sortedSuites.every((s) => s.exitCode === 0) &&
      params.typecheckPassed === true &&
      params.typecheckErrorCount === 0;

    // Fail closed: Caller cannot override overallPassed to true if actual conditions are not met
    let overallPassed = computedOverallPassed;
    if (params.overallPassed !== undefined) {
      if (params.overallPassed && !computedOverallPassed) {
        throw new VIGValidationError(
          `Cannot mark overallPassed=true when verification criteria failed: suites=${sortedSuites.length}, passedChecks=${totalPassedChecks}, failedChecks=${totalFailedChecks}, blockedChecks=${totalBlockedChecks}, typecheckPassed=${params.typecheckPassed}, typecheckErrors=${params.typecheckErrorCount}`
        );
      }
      overallPassed = params.overallPassed && computedOverallPassed;
    }

    const evidenceId = this.computeEvidenceId(
      params.commitSha,
      params.graphRootSeal,
      params.isWorkingTreeClean,
      params.typecheckPassed,
      params.typecheckErrorCount,
      sortedSuites
    );

    return Object.freeze({
      evidenceId,
      commitSha: params.commitSha,
      graphRootSeal: params.graphRootSeal,
      isWorkingTreeClean: params.isWorkingTreeClean,
      evaluatedAt: params.evaluatedAt ?? Date.now(),
      typecheckPassed: params.typecheckPassed,
      typecheckErrorCount: params.typecheckErrorCount,
      testSuites: sortedSuites,
      totalPassedChecks,
      totalFailedChecks,
      totalSkippedChecks,
      totalBlockedChecks,
      overallPassed,
      provenanceSeal: params.provenanceSeal,
    });
  }

  // ── 3. Multi-Tier Status Evaluation ─────────────────────────────────────────

  /**
   * Evaluates the verification state of an evidence record against current repository state:
   * - VERIFIED_PASS: Evidence is fresh, overallPassed is true, commit & graph seals match,
   *                  evidence was recorded on a clean working tree, AND current working tree is clean.
   * - STALE: Commit SHA or graph root seal differs, OR evidence was recorded on a dirty tree,
   *          OR current working tree has uncommitted modifications, OR cleanliness info is missing.
   * - FAILED: Evidence is current and clean, but typecheck or one or more test suites failed.
   * - UNVERIFIED: No evidence record exists, or evidence contains 0 test suites or 0 passed checks.
   */
  public static evaluateVerificationStatus(
    evidence: VIGVerificationEvidence | null | undefined,
    currentCommitSha: string,
    currentGraphRootSeal: string,
    isWorkingTreeClean: boolean
  ): VIGVerificationStatus {
    if (!evidence) {
      return 'UNVERIFIED';
    }

    // Fail closed: Missing or non-boolean cleanliness information must fail closed to STALE (BUG-A02)
    if (typeof isWorkingTreeClean !== 'boolean') {
      return 'STALE';
    }

    // 1. Stale Check: Commit identity change
    if (evidence.commitSha !== currentCommitSha) {
      return 'STALE';
    }

    // 2. Stale Check: Source graph content change
    if (evidence.graphRootSeal !== currentGraphRootSeal) {
      return 'STALE';
    }

    // 3. Stale Check: Evidence was recorded on a dirty working tree
    if (evidence.isWorkingTreeClean !== true) {
      return 'STALE';
    }

    // 4. Stale Check: Current working tree has uncommitted modifications
    if (!isWorkingTreeClean) {
      return 'STALE';
    }

    // 5. Explicit Failure Check: Typecheck or test execution failure
    const hasTypecheckFailure = !evidence.typecheckPassed || evidence.typecheckErrorCount > 0;
    const hasCheckFailures =
      (evidence.totalFailedChecks !== undefined && evidence.totalFailedChecks > 0) ||
      (evidence.totalBlockedChecks !== undefined && evidence.totalBlockedChecks > 0);
    const hasSuiteFailures =
      evidence.testSuites &&
      evidence.testSuites.some(
        (s) => s.exitCode !== 0 || s.failedChecks > 0 || ((s.blockedChecks ?? 0) > 0)
      );

    if (hasTypecheckFailure || hasCheckFailures || hasSuiteFailures) {
      return 'FAILED';
    }

    // 6. Unverified Check: Empty or unexecuted test suites (BUG-A01)
    const totalPassed =
      evidence.totalPassedChecks !== undefined
        ? evidence.totalPassedChecks
        : evidence.testSuites
        ? evidence.testSuites.reduce((sum, s) => sum + s.passedChecks, 0)
        : 0;

    if (!evidence.testSuites || evidence.testSuites.length === 0 || totalPassed <= 0) {
      return 'UNVERIFIED';
    }

    // 7. Overall pass check (if marked not passed despite no explicit errors above)
    if (!evidence.overallPassed) {
      return 'FAILED';
    }

    return 'VERIFIED_PASS';
  }

  // ── 4. Evidence Ledger Persistence & Sealing ────────────────────────────────

  /**
   * Computes the cryptographic Merkle root seal across sorted evidence records.
   */
  public static computeLedgerSeal(records: readonly VIGVerificationEvidence[]): string {
    const sorted = records.slice().sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));
    const payload = sorted
      .map((r) => `${r.evidenceId}:${r.commitSha}:${r.graphRootSeal}:${r.isWorkingTreeClean ? 1 : 0}:${r.overallPassed ? 1 : 0}`)
      .join('\n');
    return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
  }

  /**
   * Constructs an immutable VIGEvidenceLedger.
   */
  public static createLedger(
    records: readonly VIGVerificationEvidence[],
    lastUpdated: number = Date.now()
  ): VIGEvidenceLedger {
    const sorted = records.slice().sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));
    const ledgerRootSeal = this.computeLedgerSeal(sorted);
    return Object.freeze({
      schemaVersion: this.CURRENT_SCHEMA_VERSION,
      ledgerRootSeal,
      evidenceRecords: Object.freeze(sorted),
      lastUpdated,
    });
  }

  /**
   * Retrieves the most recent verification evidence record by evaluatedAt timestamp.
   */
  public static getLatestEvidenceRecord(
    ledger: VIGEvidenceLedger | null | undefined
  ): VIGVerificationEvidence | undefined {
    if (!ledger || !ledger.evidenceRecords || ledger.evidenceRecords.length === 0) {
      return undefined;
    }
    return ledger.evidenceRecords.slice().sort((a, b) => b.evaluatedAt - a.evaluatedAt)[0];
  }

  /**
   * Loads the evidence ledger from disk with fail-closed integrity checks.
   */
  public static loadEvidenceLedger(filePath?: string): VIGEvidenceLedger | null {
    const targetPath = filePath ?? this.DEFAULT_EVIDENCE_FILE;
    if (!fs.existsSync(targetPath)) {
      return null;
    }

    let raw: string;
    try {
      raw = fs.readFileSync(targetPath, 'utf8');
    } catch (err: any) {
      throw new VIGIntegrityError(`Failed to read evidence ledger at "${targetPath}": ${err.message}`);
    }

    let payload: VIGEvidenceLedger;
    try {
      payload = JSON.parse(raw);
    } catch (err: any) {
      throw new VIGIntegrityError(`Corrupted evidence ledger JSON at "${targetPath}": ${err.message}`);
    }

    if (!payload || payload.schemaVersion !== this.CURRENT_SCHEMA_VERSION) {
      throw new VIGIntegrityError(
        `Unsupported evidence ledger schema version: ${payload?.schemaVersion} (expected ${this.CURRENT_SCHEMA_VERSION})`
      );
    }

    if (!Array.isArray(payload.evidenceRecords)) {
      throw new VIGIntegrityError(`Corrupted evidence ledger at "${targetPath}": missing evidenceRecords array`);
    }

    const expectedSeal = this.computeLedgerSeal(payload.evidenceRecords);
    if (payload.ledgerRootSeal !== expectedSeal) {
      throw new VIGIntegrityError(
        `Cryptographic evidence ledger seal mismatch! Expected: "${expectedSeal}", got: "${payload.ledgerRootSeal}". Evidence ledger is corrupted or tampered.`
      );
    }

    return Object.freeze(payload);
  }

  /**
   * Atomically saves the evidence ledger to disk.
   */
  public static saveEvidenceLedger(ledger: VIGEvidenceLedger, filePath?: string): void {
    const targetPath = filePath ?? this.DEFAULT_EVIDENCE_FILE;
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const tempPath = path.join(
      targetDir,
      `evidence.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).substring(2, 8)}`
    );

    const serialized = JSON.stringify(ledger, null, 2);
    fs.writeFileSync(tempPath, serialized, 'utf8');
    VIGManifestManager.atomicReplaceFileSync(tempPath, targetPath);
  }

  /**
   * Appends an evidence entry to an append-only WAL stream.
   */
  public static appendEvidenceToWAL(
    evidence: VIGVerificationEvidence,
    walPath?: string
  ): void {
    const targetPath = walPath ?? this.DEFAULT_WAL_FILE;
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const entryLine = JSON.stringify(evidence) + '\n';
    fs.appendFileSync(targetPath, entryLine, 'utf8');
  }

  /**
   * Loads all historical evidence entries from an append-only WAL file.
   */
  public static loadEvidenceFromWAL(walPath?: string): VIGVerificationEvidence[] {
    const targetPath = walPath ?? this.DEFAULT_WAL_FILE;
    if (!fs.existsSync(targetPath)) return [];

    const raw = fs.readFileSync(targetPath, 'utf8');
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);
    const results: VIGVerificationEvidence[] = [];

    for (const line of lines) {
      try {
        const item = JSON.parse(line) as VIGVerificationEvidence;
        results.push(item);
      } catch {}
    }

    return results;
  }
}
