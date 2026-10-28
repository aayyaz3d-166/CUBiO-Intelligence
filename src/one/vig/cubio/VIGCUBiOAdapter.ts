/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/cubio/VIGCUBiOAdapter
 * Specification: VIG Phase 10 — CUBiO AI Integration Preparation
 *
 * Sovereign, read-only integration adapter providing versioned protocol
 * negotiation, non-competing verified context descriptors, fail-closed
 * verification enforcement, circuit-breaking, and instant rollback.
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
  VIG_CUBIO_PROTOCOL_VERSION,
  CUBiOServiceStatus,
  CUBiORolloutMode,
  CUBiOHandshakeRequest,
  CUBiOHandshakeResponse,
  CUBiOVerifiedContextRequest,
  CUBiOVerifiedContextResponse,
  CUBiOVerifiedContextDescriptor,
  CUBiODependencyImpactRequest,
  CUBiODependencyImpactResponse,
  CUBiOProvenanceAnchorRequest,
  CUBiOProvenanceAnchorResponse,
  CUBiOAuditEvent,
  CUBiOAuditStatus,
  VIGCUBiOValidationError,
  VIGCUBiOIncompatibleVersionError,
  VIGCUBiOUnverifiedError,
  VIGCUBiOStaleEvidenceError,
  VIGCUBiOTimeoutError,
  VIGCUBiODisabledError,
  VIGCUBiOUnavailableError,
} from './cubioTypes';

export interface VIGCUBiOAdapterOptions {
  /** Execution timeout in milliseconds for all queries (default: 2000ms) */
  readonly timeoutMs?: number;
  /** Maximum number of records retained in the append-only audit log (default: 1000) */
  readonly maxAuditLogSize?: number;
  /** Initial rollout mode (default: 'ACTIVE') */
  readonly rolloutMode?: CUBiORolloutMode;
  /** Consecutive failure count before circuit breaker trips (default: 5) */
  readonly circuitBreakerThreshold?: number;
}

export class VIGCUBiOAdapter {
  public static readonly SERVER_IDENTIFIER = 'one-language-vig-cubio-host';
  public static readonly SUPPORTED_QUERIES: readonly string[] = Object.freeze([
    'handshake',
    'queryVerifiedContext',
    'queryDependencyImpact',
    'getProvenanceAnchor',
  ]);

  private readonly vig: VerifiableIntelligenceGraph | null;
  private readonly timeoutMs: number;
  private readonly maxAuditLogSize: number;
  private readonly circuitBreakerThreshold: number;

  private rolloutMode: CUBiORolloutMode;
  private consecutiveFailures: number = 0;
  private circuitTripped: boolean = false;
  private readonly auditLogs: CUBiOAuditEvent[] = [];

  constructor(
    vig: VerifiableIntelligenceGraph | null,
    options: VIGCUBiOAdapterOptions = {}
  ) {
    this.vig = vig;
    this.timeoutMs = options.timeoutMs ?? 2000;
    this.maxAuditLogSize = options.maxAuditLogSize ?? 1000;
    this.rolloutMode = options.rolloutMode ?? 'ACTIVE';
    this.circuitBreakerThreshold = options.circuitBreakerThreshold ?? 5;
  }

  // ── Rollout, Circuit Breaker & Rollback Controls ───────────────────────────

  public getRolloutMode(): CUBiORolloutMode {
    return this.rolloutMode;
  }

  public setRolloutMode(mode: CUBiORolloutMode): void {
    const previous = this.rolloutMode;
    this.rolloutMode = mode;
    if (mode !== 'DISABLED') {
      this.resetCircuitBreaker();
    }
    this.recordAudit({
      timestamp: Date.now(),
      agentId: 'system-operator',
      role: 'SYSTEM_CORE',
      operation: 'setRolloutMode',
      status: 'SUCCESS',
      statusCode: 200,
      durationMs: 0,
      queryParams: { previousMode: previous, newMode: mode },
    });
  }

  /**
   * Instantly trips emergency rollback, disabling all subsequent CUBiO requests.
   */
  public rollback(reason: string): void {
    this.rolloutMode = 'DISABLED';
    this.recordAudit({
      timestamp: Date.now(),
      agentId: 'emergency-operator',
      role: 'SYSTEM_CORE',
      operation: 'rollback',
      status: 'ROLLOUT_DISABLED',
      statusCode: 503,
      durationMs: 0,
      queryParams: { reason },
      error: `Adapter rolled back: ${reason}`,
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

  // ── 1. Protocol Handshake & Capability Discovery ────────────────────────────

  public async handshake(
    request: CUBiOHandshakeRequest,
    context: VIGSecurityContext
  ): Promise<CUBiOHandshakeResponse> {
    const startTime = performance.now();
    VIGSecurityGuard.assertCanRead(context, 'handshake');

    if (!request || typeof request !== 'object') {
      throw new VIGCUBiOValidationError('Handshake request must be a valid object');
    }

    if (!request.agentId || typeof request.agentId !== 'string') {
      throw new VIGCUBiOValidationError('Handshake request requires a valid "agentId"');
    }

    if (!request.requestedProtocolVersion || typeof request.requestedProtocolVersion !== 'string') {
      throw new VIGCUBiOValidationError('Handshake request requires "requestedProtocolVersion"');
    }

    const isCompatible = this.isProtocolCompatible(request.requestedProtocolVersion);
    if (!isCompatible) {
      const err = new VIGCUBiOIncompatibleVersionError(
        request.requestedProtocolVersion,
        VIG_CUBIO_PROTOCOL_VERSION
      );
      this.recordAudit({
        timestamp: Date.now(),
        agentId: request.agentId,
        role: context.role,
        operation: 'handshake',
        status: 'ERROR',
        statusCode: 400,
        durationMs: performance.now() - startTime,
        queryParams: { requestedProtocolVersion: request.requestedProtocolVersion },
        error: err.message,
      });
      throw err;
    }

    let serviceStatus: CUBiOServiceStatus = 'READY';
    if (this.rolloutMode === 'DISABLED') {
      serviceStatus = 'DISABLED';
    } else if (this.circuitTripped) {
      serviceStatus = 'DEGRADED';
    } else if (!this.vig) {
      serviceStatus = 'UNAVAILABLE';
    }

    if (!this.vig) {
      const response: CUBiOHandshakeResponse = Object.freeze({
        protocolVersion: VIG_CUBIO_PROTOCOL_VERSION,
        serviceStatus,
        rolloutMode: this.rolloutMode,
        serverIdentifier: VIGCUBiOAdapter.SERVER_IDENTIFIER,
        supportedQueries: VIGCUBiOAdapter.SUPPORTED_QUERIES,
        boundCommitSha: '0000000000000000000000000000000000000000',
        graphRootSeal: '0000000000000000000000000000000000000000000000000000000000000000',
        isWorkingTreeClean: false,
        totalNodes: 0,
        totalEdges: 0,
        isCompatible: true,
        serverTimestamp: Date.now(),
      });

      this.recordAudit({
        timestamp: Date.now(),
        agentId: request.agentId,
        role: context.role,
        operation: 'handshake',
        status: 'SUCCESS',
        statusCode: 200,
        durationMs: performance.now() - startTime,
        queryParams: { requestedVersion: request.requestedProtocolVersion },
      });

      return response;
    }

    // Resolve anchor metadata
    let boundCommitSha = '0000000000000000000000000000000000000000';
    let isWorkingTreeClean = false;
    try {
      const anchor = VIGProvenanceLedger.resolveGitCommitAnchor(this.vig.repoRoot);
      boundCommitSha = anchor.commitSha;
      isWorkingTreeClean = anchor.isWorkingTreeClean;
    } catch {
      // Git metadata resolution fallback
    }

    const graphRootSeal = this.vig.store.computeRootSeal();
    const totalNodes = this.vig.store.getAllNodes().length;
    const totalEdges = this.vig.store.getAllEdges().length;

    const response: CUBiOHandshakeResponse = Object.freeze({
      protocolVersion: VIG_CUBIO_PROTOCOL_VERSION,
      serviceStatus,
      rolloutMode: this.rolloutMode,
      serverIdentifier: VIGCUBiOAdapter.SERVER_IDENTIFIER,
      supportedQueries: VIGCUBiOAdapter.SUPPORTED_QUERIES,
      boundCommitSha,
      graphRootSeal,
      isWorkingTreeClean,
      totalNodes,
      totalEdges,
      isCompatible: true,
      serverTimestamp: Date.now(),
    });

    this.recordAudit({
      timestamp: Date.now(),
      agentId: request.agentId,
      role: context.role,
      operation: 'handshake',
      status: 'SUCCESS',
      statusCode: 200,
      durationMs: performance.now() - startTime,
      queryParams: { requestedVersion: request.requestedProtocolVersion },
      boundCommitSha,
    });

    return response;
  }

  // ── 2. Read-Only Verified Context Query ─────────────────────────────────────

  public async queryVerifiedContext(
    request: CUBiOVerifiedContextRequest,
    context: VIGSecurityContext
  ): Promise<CUBiOVerifiedContextResponse> {
    const startTime = performance.now();
    this.assertOperational('queryVerifiedContext');

    VIGSecurityGuard.assertCanRead(context, 'queryVerifiedContext');
    VIGSecurityGuard.assertNoActuation(request, 'queryVerifiedContext');

    if (!request || typeof request !== 'object') {
      throw new VIGCUBiOValidationError('Request must be a valid object');
    }

    if (!request.targetPath && !request.symbolName) {
      throw new VIGCUBiOValidationError('Query requires either "targetPath" or "symbolName"');
    }

    if (!this.vig) {
      throw new VIGCUBiOUnavailableError();
    }

    const requireVerified = request.requireVerified !== false; // Default true

    try {
      const result = await this.executeWithTimeout(
        () => this.vig!.getVerifiedContext(
          {
            targetPath: request.targetPath,
            symbolName: request.symbolName,
          },
          context
        ),
        'queryVerifiedContext'
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

      const warnings: string[] = [];

      // Verification policy enforcement
      if (requireVerified) {
        if (result.verificationStatus === 'STALE' || (!isWorkingTreeClean && result.verificationStatus === 'VERIFIED_PASS')) {
          const err = new VIGCUBiOStaleEvidenceError(
            `Working tree is uncommitted or evidence commit (${result.lastEvidence?.commitSha ?? 'none'}) does not match bound commit (${result.boundCommitSha})`
          );
          this.recordAudit({
            timestamp: Date.now(),
            agentId: context.agentId,
            role: context.role,
            operation: 'queryVerifiedContext',
            status: 'REJECTED_STALE',
            statusCode: 409,
            durationMs: performance.now() - startTime,
            queryParams: { targetPath: request.targetPath, symbolName: request.symbolName },
            evidenceStatus: 'STALE',
            boundCommitSha: result.boundCommitSha,
            error: err.message,
          });
          throw err;
        }

        if (result.verificationStatus === 'FAILED' || result.verificationStatus === 'UNVERIFIED') {
          const err = new VIGCUBiOUnverifiedError(
            result.verificationStatus,
            request.targetPath || request.symbolName || 'unknown'
          );
          this.recordAudit({
            timestamp: Date.now(),
            agentId: context.agentId,
            role: context.role,
            operation: 'queryVerifiedContext',
            status: 'REJECTED_UNVERIFIED',
            statusCode: 412,
            durationMs: performance.now() - startTime,
            queryParams: { targetPath: request.targetPath, symbolName: request.symbolName },
            evidenceStatus: result.verificationStatus,
            boundCommitSha: result.boundCommitSha,
            error: err.message,
          });
          throw err;
        }
      } else {
        // Non-strict advisory mode
        if (isStale) {
          warnings.push('Advisory warning: Working tree has uncommitted modifications or evidence is stale.');
        }
        if (result.verificationStatus !== 'VERIFIED_PASS') {
          warnings.push(`Advisory warning: Verification status is "${result.verificationStatus}".`);
        }
      }

      const descriptor: CUBiOVerifiedContextDescriptor = Object.freeze({
        node: result.node,
        dependencies: Object.freeze([...result.dependencies]),
        dependents: Object.freeze([...result.dependents]),
        boundCommitSha: result.boundCommitSha,
        graphRootSeal,
        verificationStatus: isStale && result.verificationStatus === 'VERIFIED_PASS' ? 'STALE' : result.verificationStatus,
        isStale,
        lastEvidenceId: result.lastEvidence?.evidenceId,
        warnings: Object.freeze(warnings),
      });

      const response: CUBiOVerifiedContextResponse = Object.freeze({
        success: true,
        protocolVersion: VIG_CUBIO_PROTOCOL_VERSION,
        descriptor,
        rolloutMode: this.rolloutMode,
        queryDurationMs: performance.now() - startTime,
      });

      this.recordSuccess({
        timestamp: Date.now(),
        agentId: context.agentId,
        role: context.role,
        operation: 'queryVerifiedContext',
        status: 'SUCCESS',
        statusCode: 200,
        durationMs: performance.now() - startTime,
        queryParams: { targetPath: request.targetPath, symbolName: request.symbolName },
        evidenceStatus: descriptor.verificationStatus,
        boundCommitSha: result.boundCommitSha,
      });

      return response;
    } catch (err: any) {
      this.handleOperationFailure(err, 'queryVerifiedContext', context, request, startTime);
      throw err;
    }
  }

  // ── 3. Read-Only Dependency Impact Query ────────────────────────────────────

  public async queryDependencyImpact(
    request: CUBiODependencyImpactRequest,
    context: VIGSecurityContext
  ): Promise<CUBiODependencyImpactResponse> {
    const startTime = performance.now();
    this.assertOperational('queryDependencyImpact');

    VIGSecurityGuard.assertCanRead(context, 'queryDependencyImpact');
    VIGSecurityGuard.assertNoActuation(request, 'queryDependencyImpact');

    if (!request || typeof request !== 'object') {
      throw new VIGCUBiOValidationError('Request must be a valid object');
    }

    if (!Array.isArray(request.changedPaths)) {
      throw new VIGCUBiOValidationError('Impact query requires a valid "changedPaths" array');
    }

    if (!this.vig) {
      throw new VIGCUBiOUnavailableError();
    }

    const requireVerified = request.requireVerified !== false;

    try {
      // Check current repository anchor and verification evidence
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

      const warnings: string[] = [];

      if (requireVerified) {
        if (baseStatus === 'STALE') {
          const err = new VIGCUBiOStaleEvidenceError('Base repository graph evidence is STALE');
          this.recordAudit({
            timestamp: Date.now(),
            agentId: context.agentId,
            role: context.role,
            operation: 'queryDependencyImpact',
            status: 'REJECTED_STALE',
            statusCode: 409,
            durationMs: performance.now() - startTime,
            queryParams: { changedPathsCount: request.changedPaths.length },
            evidenceStatus: 'STALE',
            boundCommitSha,
            error: err.message,
          });
          throw err;
        }

        if (baseStatus === 'FAILED' || baseStatus === 'UNVERIFIED') {
          const err = new VIGCUBiOUnverifiedError(baseStatus, request.changedPaths.join(', '));
          this.recordAudit({
            timestamp: Date.now(),
            agentId: context.agentId,
            role: context.role,
            operation: 'queryDependencyImpact',
            status: 'REJECTED_UNVERIFIED',
            statusCode: 412,
            durationMs: performance.now() - startTime,
            queryParams: { changedPathsCount: request.changedPaths.length },
            evidenceStatus: baseStatus,
            boundCommitSha,
            error: err.message,
          });
          throw err;
        }
      } else {
        if (baseStatus !== 'VERIFIED_PASS') {
          warnings.push(`Advisory warning: Baseline graph verification status is "${baseStatus}".`);
        }
      }

      const impact = await this.executeWithTimeout(
        () => this.vig!.queryImpact(
          {
            changedPaths: request.changedPaths,
            maxDepth: request.maxTraversalDepth,
          },
          context
        ),
        'queryDependencyImpact'
      );

      const response: CUBiODependencyImpactResponse = Object.freeze({
        success: true,
        protocolVersion: VIG_CUBIO_PROTOCOL_VERSION,
        isNoOp: impact.isNoOp,
        isPublicApiBreached: impact.isPublicApiBreached,
        changedNodes: Object.freeze([...impact.changedNodes]),
        affectedModules: Object.freeze([...impact.affectedModules]),
        requiredTestSuites: Object.freeze([...impact.requiredTestSuites]),
        boundCommitSha,
        graphRootSeal,
        verificationStatus: baseStatus,
        rolloutMode: this.rolloutMode,
        queryDurationMs: performance.now() - startTime,
        warnings: Object.freeze(warnings),
      });

      this.recordSuccess({
        timestamp: Date.now(),
        agentId: context.agentId,
        role: context.role,
        operation: 'queryDependencyImpact',
        status: 'SUCCESS',
        statusCode: 200,
        durationMs: performance.now() - startTime,
        queryParams: { changedPathsCount: request.changedPaths.length },
        evidenceStatus: baseStatus,
        boundCommitSha,
      });

      return response;
    } catch (err: any) {
      this.handleOperationFailure(err, 'queryDependencyImpact', context, request, startTime);
      throw err;
    }
  }

  // ── 4. Read-Only Provenance Anchor Query ─────────────────────────────────────

  public async getProvenanceAnchor(
    request: CUBiOProvenanceAnchorRequest,
    context: VIGSecurityContext
  ): Promise<CUBiOProvenanceAnchorResponse> {
    const startTime = performance.now();
    this.assertOperational('getProvenanceAnchor');

    VIGSecurityGuard.assertCanRead(context, 'getProvenanceAnchor');

    if (!this.vig) {
      throw new VIGCUBiOUnavailableError();
    }

    try {
      const anchor = await this.executeWithTimeout(
        () => this.vig!.getGraphAnchor(context),
        'getProvenanceAnchor'
      );

      const lastEvidence = VIGProvenanceLedger.getLatestEvidenceRecord(this.vig.currentEvidenceLedger);
      const latestVerificationStatus = VIGProvenanceLedger.evaluateVerificationStatus(
        lastEvidence,
        anchor.commitSha,
        anchor.rootCID,
        anchor.isClean
      );

      const response: CUBiOProvenanceAnchorResponse = Object.freeze({
        success: true,
        protocolVersion: VIG_CUBIO_PROTOCOL_VERSION,
        rootCID: anchor.rootCID,
        commitSha: anchor.commitSha,
        baselineTag: anchor.baselineTag,
        isWorkingTreeClean: anchor.isClean,
        totalNodes: anchor.totalNodes,
        totalEdges: anchor.totalEdges,
        latestEvidenceId: lastEvidence?.evidenceId,
        latestVerificationStatus,
        rolloutMode: this.rolloutMode,
      });

      this.recordSuccess({
        timestamp: Date.now(),
        agentId: context.agentId,
        role: context.role,
        operation: 'getProvenanceAnchor',
        status: 'SUCCESS',
        statusCode: 200,
        durationMs: performance.now() - startTime,
        queryParams: {},
        evidenceStatus: latestVerificationStatus,
        boundCommitSha: anchor.commitSha,
      });

      return response;
    } catch (err: any) {
      this.handleOperationFailure(err, 'getProvenanceAnchor', context, request, startTime);
      throw err;
    }
  }

  // ── Audit Trail Accessors ───────────────────────────────────────────────────

  public getAuditLogs(): readonly CUBiOAuditEvent[] {
    return Object.freeze([...this.auditLogs]);
  }

  public clearAuditLogs(): void {
    this.auditLogs.length = 0;
  }

  // ── Private Helpers ─────────────────────────────────────────────────────────

  private isProtocolCompatible(clientVersion: string): boolean {
    const clientMajor = clientVersion.split('.')[0];
    const serverMajor = VIG_CUBIO_PROTOCOL_VERSION.split('.')[0];
    return clientMajor === serverMajor;
  }

  private assertOperational(operation: string): void {
    if (this.rolloutMode === 'DISABLED') {
      throw new VIGCUBiODisabledError(`Operation "${operation}" rejected: adapter rollout is DISABLED`);
    }

    if (this.circuitTripped) {
      throw new VIGCUBiODisabledError(
        `Operation "${operation}" rejected: Circuit breaker is TRIPPED (${this.consecutiveFailures} consecutive failures)`
      );
    }
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>, operation: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let completed = false;

      const timer = setTimeout(() => {
        if (!completed) {
          completed = true;
          reject(new VIGCUBiOTimeoutError(operation, this.timeoutMs));
        }
      }, this.timeoutMs);

      fn()
        .then((result) => {
          if (!completed) {
            completed = true;
            clearTimeout(timer);
            resolve(result);
          }
        })
        .catch((err) => {
          if (!completed) {
            completed = true;
            clearTimeout(timer);
            reject(err);
          }
        });
    });
  }

  private recordSuccess(event: CUBiOAuditEvent): void {
    this.consecutiveFailures = 0;
    this.recordAudit(event);
  }

  private handleOperationFailure(
    err: any,
    operation: string,
    context: VIGSecurityContext,
    request: any,
    startTime: number
  ): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.circuitBreakerThreshold) {
      this.circuitTripped = true;
    }

    let status: CUBiOAuditStatus = 'ERROR';
    let statusCode = 500;

    if (err instanceof VIGCUBiOTimeoutError) {
      status = 'TIMEOUT';
      statusCode = 504;
    } else if (err.name === 'VIGAccessDeniedError') {
      status = 'REJECTED_UNAUTHORIZED';
      statusCode = 403;
    } else if (err.name === 'VIGSecurityError') {
      status = 'REJECTED_UNAUTHORIZED';
      statusCode = 403;
    } else if (err instanceof VIGCUBiOValidationError) {
      status = 'ERROR';
      statusCode = 400;
    } else if (err instanceof VIGCUBiOUnverifiedError) {
      status = 'REJECTED_UNVERIFIED';
      statusCode = 412;
    } else if (err instanceof VIGCUBiOStaleEvidenceError) {
      status = 'REJECTED_STALE';
      statusCode = 409;
    }

    this.recordAudit({
      timestamp: Date.now(),
      agentId: context.agentId,
      role: context.role,
      operation,
      status: this.circuitTripped ? 'CIRCUIT_TRIPPED' : status,
      statusCode,
      durationMs: performance.now() - startTime,
      queryParams: { rawRequest: typeof request === 'object' ? Object.keys(request) : 'primitive' },
      error: err.message,
    });
  }

  private recordAudit(event: CUBiOAuditEvent): void {
    if (this.auditLogs.length >= this.maxAuditLogSize) {
      this.auditLogs.shift();
    }
    this.auditLogs.push(Object.freeze({ ...event }));
  }
}
