/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/agentic/VIGAgenticAdapter
 * Specification: VIG Phase 11 — Agentic AI Integration
 *
 * Least-privilege query gateway, 4-tier verification policy enforcement,
 * fail-closed timeout guards, circuit breaking, and audit trail ledger.
 */

import {
  VIGSecurityContext,
  VIGNode,
  VIGVerificationStatus,
} from '../types';
import { VIGSecurityGuard } from '../VIGSecurityGuard';
import { VerifiableIntelligenceGraph } from '../VerifiableIntelligenceGraph';
import { VIGProvenanceLedger } from '../VIGProvenanceLedger';
import {
  VIG_AGENTIC_PROTOCOL_VERSION,
  AgenticRolloutMode,
  AgenticAuditOutcome,
  AgenticAuditRecord,
  VIGAgenticValidationError,
  VIGAgenticSecurityError,
  VIGAgenticUnverifiedError,
  VIGAgenticStaleEvidenceError,
  VIGAgenticTimeoutError,
  VIGAgenticDisabledError,
  VIGAgenticUnavailableError,
  VIGAgenticRateLimitError,
} from './agenticTypes';

export interface VIGAgenticAdapterOptions {
  readonly timeoutMs?: number;
  readonly maxAuditLogSize?: number;
  readonly rolloutMode?: AgenticRolloutMode;
  readonly circuitBreakerThreshold?: number;
  /** Maximum concurrent active queries allowed (default: 50) */
  readonly maxConcurrentQueries?: number;
  /** Maximum queries allowed per rate limit window (default: 500) */
  readonly maxRequestsPerWindow?: number;
  /** Rate limit window in milliseconds (default: 60000ms) */
  readonly rateLimitWindowMs?: number;
}

export interface AgenticContextResult {
  readonly node: VIGNode | null;
  readonly dependencies: readonly VIGNode[];
  readonly dependents: readonly VIGNode[];
  readonly boundCommitSha: string;
  readonly graphRootSeal: string;
  readonly verificationStatus: VIGVerificationStatus;
  readonly isStale: boolean;
  readonly evidenceId?: string;
  readonly warnings: readonly string[];
  readonly durationMs: number;
}

export interface AgenticImpactResult {
  readonly isNoOp: boolean;
  readonly isPublicApiBreached: boolean;
  readonly changedNodes: readonly VIGNode[];
  readonly affectedModules: readonly VIGNode[];
  readonly requiredTestSuites: readonly string[];
  readonly boundCommitSha: string;
  readonly graphRootSeal: string;
  readonly verificationStatus: VIGVerificationStatus;
  readonly durationMs: number;
}

export class VIGAgenticAdapter {
  private readonly vig: VerifiableIntelligenceGraph | null;
  private readonly timeoutMs: number;
  private readonly maxAuditLogSize: number;
  private readonly circuitBreakerThreshold: number;
  private readonly maxConcurrentQueries: number;
  private readonly maxRequestsPerWindow: number;
  private readonly rateLimitWindowMs: number;

  private activeQueriesCount: number = 0;
  private readonly requestTimestamps: number[] = [];
  private rolloutMode: AgenticRolloutMode;
  private consecutiveFailures: number = 0;
  private circuitTripped: boolean = false;
  private readonly auditLogs: AgenticAuditRecord[] = [];

  constructor(
    vig: VerifiableIntelligenceGraph | null,
    options: VIGAgenticAdapterOptions = {}
  ) {
    this.vig = vig;
    this.timeoutMs = options.timeoutMs ?? 2000;
    this.maxAuditLogSize = options.maxAuditLogSize ?? 1000;
    this.rolloutMode = options.rolloutMode ?? 'ACTIVE';
    this.circuitBreakerThreshold = options.circuitBreakerThreshold ?? 3;
    this.maxConcurrentQueries = options.maxConcurrentQueries ?? 50;
    this.maxRequestsPerWindow = options.maxRequestsPerWindow ?? 500;
    this.rateLimitWindowMs = options.rateLimitWindowMs ?? 60000;
  }

  // ── Rollout, Emergency Rollback & Circuit Breaker ──────────────────────────

  public getRolloutMode(): AgenticRolloutMode {
    return this.rolloutMode;
  }

  public setRolloutMode(mode: AgenticRolloutMode): void {
    const prev = this.rolloutMode;
    this.rolloutMode = mode;
    if (mode !== 'DISABLED') {
      this.resetCircuitBreaker();
    }
    this.recordAudit({
      recordId: `audit-mode-${Date.now()}`,
      timestamp: Date.now(),
      agentId: 'system-operator',
      role: 'SYSTEM_CORE',
      operation: 'setRolloutMode',
      outcome: 'SUCCESS',
      statusCode: 200,
      durationMs: 0,
      details: { previousMode: prev, newMode: mode },
    });
  }

  public rollback(reason: string): void {
    this.rolloutMode = 'DISABLED';
    this.recordAudit({
      recordId: `audit-rollback-${Date.now()}`,
      timestamp: Date.now(),
      agentId: 'emergency-operator',
      role: 'SYSTEM_CORE',
      operation: 'rollback',
      outcome: 'ROLLOUT_DISABLED',
      statusCode: 503,
      durationMs: 0,
      details: { reason },
      error: `Agentic adapter rolled back: ${reason}`,
    });
  }

  public getCircuitBreakerStatus(): { isTripped: boolean; consecutiveFailures: number } {
    return {
      isTripped: this.circuitTripped,
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  public resetCircuitBreaker(): void {
    this.consecutiveFailures = 0;
    this.circuitTripped = false;
  }

  // ── Read-Only Verified Context Query ───────────────────────────────────────

  public async queryVerifiedContextForAgent(
    targetPath?: string,
    symbolName?: string,
    requireVerified: boolean = true,
    context?: VIGSecurityContext
  ): Promise<AgenticContextResult> {
    const startTime = performance.now();
    this.assertOperational('queryVerifiedContextForAgent');

    const agentContext = context ?? { role: 'ANALYZER_AGENT', agentId: 'representative-agent-01' };
    VIGSecurityGuard.assertCanRead(agentContext, 'queryVerifiedContextForAgent');

    if (!targetPath && !symbolName) {
      throw new VIGAgenticValidationError('Query requires either targetPath or symbolName');
    }

    if (!this.vig) {
      throw new VIGAgenticUnavailableError();
    }

    try {
      const result = await this.executeWithTimeout(
        () => this.vig!.getVerifiedContext({ targetPath, symbolName }, agentContext),
        'queryVerifiedContextForAgent'
      );

      // Check Git working tree clean status
      let isWorkingTreeClean = false;
      try {
        const anchor = VIGProvenanceLedger.resolveGitCommitAnchor(this.vig.repoRoot);
        isWorkingTreeClean = anchor.isWorkingTreeClean;
      } catch {
        // Fallback
      }

      const graphRootSeal = this.vig.store.computeRootSeal();
      const isStale =
        !isWorkingTreeClean ||
        result.verificationStatus === 'STALE' ||
        (result.lastEvidence !== undefined && result.lastEvidence.commitSha !== result.boundCommitSha);

      const evaluatedStatus: VIGVerificationStatus =
        isStale && result.verificationStatus === 'VERIFIED_PASS' ? 'STALE' : result.verificationStatus;

      const warnings: string[] = [];

      // Strict verification enforcement
      if (requireVerified) {
        if (evaluatedStatus === 'STALE') {
          const err = new VIGAgenticStaleEvidenceError(
            `Working tree is uncommitted or evidence commit does not match bound commit (${result.boundCommitSha})`
          );
          this.recordAudit({
            recordId: `ctx-${Date.now()}`,
            timestamp: Date.now(),
            agentId: agentContext.agentId,
            role: agentContext.role,
            operation: 'queryVerifiedContextForAgent',
            outcome: 'REJECTED_STALE',
            statusCode: 409,
            durationMs: performance.now() - startTime,
            boundCommitSha: result.boundCommitSha,
            evidenceId: result.lastEvidence?.evidenceId,
            verificationStatus: 'STALE',
            details: { targetPath, symbolName },
            error: err.message,
          });
          throw err;
        }

        if (evaluatedStatus === 'FAILED' || evaluatedStatus === 'UNVERIFIED') {
          const err = new VIGAgenticUnverifiedError(evaluatedStatus, targetPath || symbolName || 'unknown');
          this.recordAudit({
            recordId: `ctx-${Date.now()}`,
            timestamp: Date.now(),
            agentId: agentContext.agentId,
            role: agentContext.role,
            operation: 'queryVerifiedContextForAgent',
            outcome: 'REJECTED_UNVERIFIED',
            statusCode: 412,
            durationMs: performance.now() - startTime,
            boundCommitSha: result.boundCommitSha,
            evidenceId: result.lastEvidence?.evidenceId,
            verificationStatus: evaluatedStatus,
            details: { targetPath, symbolName },
            error: err.message,
          });
          throw err;
        }
      } else {
        if (evaluatedStatus !== 'VERIFIED_PASS') {
          warnings.push(`Advisory notice: Verification status is "${evaluatedStatus}".`);
        }
        if (isStale) {
          warnings.push('Advisory notice: Evidence is STALE (uncommitted working tree changes detected).');
        }
      }

      const response: AgenticContextResult = Object.freeze({
        node: result.node,
        dependencies: Object.freeze([...result.dependencies]),
        dependents: Object.freeze([...result.dependents]),
        boundCommitSha: result.boundCommitSha,
        graphRootSeal,
        verificationStatus: evaluatedStatus,
        isStale,
        evidenceId: result.lastEvidence?.evidenceId,
        warnings: Object.freeze(warnings),
        durationMs: performance.now() - startTime,
      });

      this.recordSuccess({
        recordId: `ctx-${Date.now()}`,
        timestamp: Date.now(),
        agentId: agentContext.agentId,
        role: agentContext.role,
        operation: 'queryVerifiedContextForAgent',
        outcome: 'SUCCESS',
        statusCode: 200,
        durationMs: performance.now() - startTime,
        boundCommitSha: result.boundCommitSha,
        evidenceId: result.lastEvidence?.evidenceId,
        verificationStatus: evaluatedStatus,
        details: { targetPath, symbolName },
      });

      return response;
    } catch (err: any) {
      this.handleOperationFailure(err, 'queryVerifiedContextForAgent', agentContext, startTime, { targetPath, symbolName });
      throw err;
    }
  }

  // ── Read-Only Dependency Impact Query ──────────────────────────────────────

  public async queryDependencyImpactForAgent(
    changedPaths: readonly string[],
    maxTraversalDepth?: number,
    requireVerified: boolean = true,
    context?: VIGSecurityContext
  ): Promise<AgenticImpactResult> {
    const startTime = performance.now();
    this.assertOperational('queryDependencyImpactForAgent');

    const agentContext = context ?? { role: 'ANALYZER_AGENT', agentId: 'representative-agent-01' };
    VIGSecurityGuard.assertCanRead(agentContext, 'queryDependencyImpactForAgent');

    if (!Array.isArray(changedPaths)) {
      throw new VIGAgenticValidationError('Impact query requires changedPaths array');
    }

    if (!this.vig) {
      throw new VIGAgenticUnavailableError();
    }

    try {
      // Evaluate base repository verification status
      let boundCommitSha = '0000000000000000000000000000000000000000';
      let isWorkingTreeClean = false;
      try {
        const anchor = VIGProvenanceLedger.resolveGitCommitAnchor(this.vig.repoRoot);
        boundCommitSha = anchor.commitSha;
        isWorkingTreeClean = anchor.isWorkingTreeClean;
      } catch {
        // Fallback
      }

      const graphRootSeal = this.vig.store.computeRootSeal();
      const lastEvidence = VIGProvenanceLedger.getLatestEvidenceRecord(this.vig.currentEvidenceLedger);
      const baseStatus = VIGProvenanceLedger.evaluateVerificationStatus(
        lastEvidence,
        boundCommitSha,
        graphRootSeal,
        isWorkingTreeClean
      );

      if (requireVerified) {
        if (baseStatus === 'STALE') {
          const err = new VIGAgenticStaleEvidenceError('Base repository graph evidence is STALE');
          this.recordAudit({
            recordId: `impact-${Date.now()}`,
            timestamp: Date.now(),
            agentId: agentContext.agentId,
            role: agentContext.role,
            operation: 'queryDependencyImpactForAgent',
            outcome: 'REJECTED_STALE',
            statusCode: 409,
            durationMs: performance.now() - startTime,
            boundCommitSha,
            evidenceId: lastEvidence?.evidenceId,
            verificationStatus: 'STALE',
            details: { changedPathsCount: changedPaths.length },
            error: err.message,
          });
          throw err;
        }

        if (baseStatus === 'FAILED' || baseStatus === 'UNVERIFIED') {
          const err = new VIGAgenticUnverifiedError(baseStatus, changedPaths.join(', '));
          this.recordAudit({
            recordId: `impact-${Date.now()}`,
            timestamp: Date.now(),
            agentId: agentContext.agentId,
            role: agentContext.role,
            operation: 'queryDependencyImpactForAgent',
            outcome: 'REJECTED_UNVERIFIED',
            statusCode: 412,
            durationMs: performance.now() - startTime,
            boundCommitSha,
            evidenceId: lastEvidence?.evidenceId,
            verificationStatus: baseStatus,
            details: { changedPathsCount: changedPaths.length },
            error: err.message,
          });
          throw err;
        }
      }

      const impact = await this.executeWithTimeout(
        () => this.vig!.queryImpact({ changedPaths, maxDepth: maxTraversalDepth }, agentContext),
        'queryDependencyImpactForAgent'
      );

      const response: AgenticImpactResult = Object.freeze({
        isNoOp: impact.isNoOp,
        isPublicApiBreached: impact.isPublicApiBreached,
        changedNodes: Object.freeze([...impact.changedNodes]),
        affectedModules: Object.freeze([...impact.affectedModules]),
        requiredTestSuites: Object.freeze([...impact.requiredTestSuites]),
        boundCommitSha,
        graphRootSeal,
        verificationStatus: baseStatus,
        durationMs: performance.now() - startTime,
      });

      this.recordSuccess({
        recordId: `impact-${Date.now()}`,
        timestamp: Date.now(),
        agentId: agentContext.agentId,
        role: agentContext.role,
        operation: 'queryDependencyImpactForAgent',
        outcome: 'SUCCESS',
        statusCode: 200,
        durationMs: performance.now() - startTime,
        boundCommitSha,
        evidenceId: lastEvidence?.evidenceId,
        verificationStatus: baseStatus,
        details: { changedPathsCount: changedPaths.length, requiredSuitesCount: impact.requiredTestSuites.length },
      });

      return response;
    } catch (err: any) {
      this.handleOperationFailure(err, 'queryDependencyImpactForAgent', agentContext, startTime, { changedPathsCount: changedPaths.length });
      throw err;
    }
  }

  // ── Provenance Anchor Query ────────────────────────────────────────────────

  public async getProvenanceAnchorForAgent(context?: VIGSecurityContext): Promise<{
    rootCID: string;
    commitSha: string;
    baselineTag: string;
    isClean: boolean;
    totalNodes: number;
    totalEdges: number;
  }> {
    const startTime = performance.now();
    this.assertOperational('getProvenanceAnchorForAgent');

    const agentContext = context ?? { role: 'ANALYZER_AGENT', agentId: 'representative-agent-01' };
    VIGSecurityGuard.assertCanRead(agentContext, 'getProvenanceAnchorForAgent');

    if (!this.vig) {
      throw new VIGAgenticUnavailableError();
    }

    try {
      const anchor = await this.executeWithTimeout(
        () => this.vig!.getGraphAnchor(agentContext),
        'getProvenanceAnchorForAgent'
      );

      this.recordSuccess({
        recordId: `anchor-${Date.now()}`,
        timestamp: Date.now(),
        agentId: agentContext.agentId,
        role: agentContext.role,
        operation: 'getProvenanceAnchorForAgent',
        outcome: 'SUCCESS',
        statusCode: 200,
        durationMs: performance.now() - startTime,
        boundCommitSha: anchor.commitSha,
        details: { totalNodes: anchor.totalNodes, totalEdges: anchor.totalEdges },
      });

      return anchor;
    } catch (err: any) {
      this.handleOperationFailure(err, 'getProvenanceAnchorForAgent', agentContext, startTime, {});
      throw err;
    }
  }

  // ── Audit Trail Accessors ───────────────────────────────────────────────────

  public getAuditLogs(): readonly AgenticAuditRecord[] {
    return Object.freeze([...this.auditLogs]);
  }

  public recordAuditManual(record: AgenticAuditRecord): void {
    this.recordAudit(record);
  }

  public clearAuditLogs(): void {
    this.auditLogs.length = 0;
  }

  public getActiveQueriesCount(): number {
    return this.activeQueriesCount;
  }

  // ── Private Guard & Execution Helpers ───────────────────────────────────────

  private assertOperational(operation: string): void {
    if (this.rolloutMode === 'DISABLED') {
      throw new VIGAgenticDisabledError(`Operation "${operation}" rejected: Agentic adapter is DISABLED`);
    }

    if (this.circuitTripped) {
      throw new VIGAgenticDisabledError(
        `Operation "${operation}" rejected: Circuit breaker is TRIPPED (${this.consecutiveFailures} consecutive errors)`
      );
    }

    // Concurrency limit check
    if (this.activeQueriesCount >= this.maxConcurrentQueries) {
      throw new VIGAgenticRateLimitError(
        `Operation "${operation}" rejected: Max concurrent queries limit (${this.maxConcurrentQueries}) reached`
      );
    }

    // Window rate limit check
    const now = Date.now();
    const windowStart = now - this.rateLimitWindowMs;
    while (this.requestTimestamps.length > 0 && this.requestTimestamps[0] < windowStart) {
      this.requestTimestamps.shift();
    }
    if (this.requestTimestamps.length >= this.maxRequestsPerWindow) {
      throw new VIGAgenticRateLimitError(
        `Operation "${operation}" rejected: Rate limit (${this.maxRequestsPerWindow} req / ${this.rateLimitWindowMs}ms) exceeded`
      );
    }
    this.requestTimestamps.push(now);
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>, operation: string): Promise<T> {
    this.activeQueriesCount++;
    return new Promise<T>((resolve, reject) => {
      let completed = false;

      const timer = setTimeout(() => {
        if (!completed) {
          completed = true;
          this.activeQueriesCount--;
          reject(new VIGAgenticTimeoutError(operation, this.timeoutMs));
        }
      }, this.timeoutMs);

      fn()
        .then((result) => {
          if (!completed) {
            completed = true;
            this.activeQueriesCount--;
            clearTimeout(timer);
            resolve(result);
          }
        })
        .catch((err) => {
          if (!completed) {
            completed = true;
            this.activeQueriesCount--;
            clearTimeout(timer);
            reject(err);
          }
        });
    });
  }

  private recordSuccess(record: AgenticAuditRecord): void {
    this.consecutiveFailures = 0;
    this.recordAudit(record);
  }

  private handleOperationFailure(
    err: any,
    operation: string,
    context: VIGSecurityContext,
    startTime: number,
    details: Record<string, unknown>
  ): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.circuitBreakerThreshold) {
      this.circuitTripped = true;
    }

    let outcome: AgenticAuditOutcome = 'ERROR';
    let statusCode = 500;

    if (err instanceof VIGAgenticTimeoutError) {
      outcome = 'TIMEOUT';
      statusCode = 504;
    } else if (err instanceof VIGAgenticRateLimitError) {
      outcome = 'RATE_LIMITED';
      statusCode = 429;
    } else if (err.name === 'VIGAccessDeniedError' || err instanceof VIGAgenticSecurityError) {
      outcome = 'APPROVAL_DENIED';
      statusCode = 403;
    } else if (err instanceof VIGAgenticUnverifiedError) {
      outcome = 'REJECTED_UNVERIFIED';
      statusCode = 412;
    } else if (err instanceof VIGAgenticStaleEvidenceError) {
      outcome = 'REJECTED_STALE';
      statusCode = 409;
    }

    this.recordAudit({
      recordId: `err-${Date.now()}`,
      timestamp: Date.now(),
      agentId: context.agentId,
      role: context.role,
      operation,
      outcome: this.circuitTripped ? 'CIRCUIT_TRIPPED' : outcome,
      statusCode,
      durationMs: performance.now() - startTime,
      details,
      error: err.message,
    });
  }

  private recordAudit(record: AgenticAuditRecord): void {
    if (this.auditLogs.length >= this.maxAuditLogSize) {
      this.auditLogs.shift();
    }
    this.auditLogs.push(Object.freeze({ ...record }));
  }
}
