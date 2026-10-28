/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/studio/VIGStudioAdapter
 * Specification: VIG Phase 9 — 3D Memory Studio Integration Preparation
 *
 * Sovereign, read-only integration adapter providing versioned protocol
 * negotiation, provenance exchange, audit logging, and fail-closed timeout
 * protection for external Studio integration.
 */

import {
  VIGSecurityContext,
  VIGNode,
} from '../types';
import { VIGSecurityGuard } from '../VIGSecurityGuard';
import { VerifiableIntelligenceGraph } from '../VerifiableIntelligenceGraph';
import { VIGProvenanceLedger } from '../VIGProvenanceLedger';
import {
  VIG_STUDIO_PROTOCOL_VERSION,
  StudioHandshakeRequest,
  StudioHandshakeResponse,
  StudioContextQueryRequest,
  StudioContextQueryResponse,
  StudioImpactQueryRequest,
  StudioImpactQueryResponse,
  StudioProvenanceAnchorRequest,
  StudioProvenanceAnchorResponse,
  StudioAuditRecord,
  VIGStudioValidationError,
  VIGStudioTimeoutError,
  VIGStudioUnavailableError,
} from './studioTypes';

export interface VIGStudioAdapterOptions {
  /** Execution timeout in milliseconds for all queries (default: 2000ms) */
  readonly timeoutMs?: number;
  /** Maximum number of records retained in the append-only audit log (default: 1000) */
  readonly maxAuditLogSize?: number;
  /** Whether to allow queries on stale working-tree states with explicit flags (default: true) */
  readonly allowStaleQueries?: boolean;
}

export class VIGStudioAdapter {
  public static readonly SERVER_IDENTIFIER = 'one-language-vig-host';
  public static readonly SUPPORTED_QUERIES: readonly string[] = Object.freeze([
    'handshake',
    'queryVerifiedContext',
    'queryDependencyImpact',
    'getProvenanceAnchor',
  ]);

  private readonly vig: VerifiableIntelligenceGraph | null;
  private readonly timeoutMs: number;
  private readonly maxAuditLogSize: number;
  private readonly allowStaleQueries: boolean;

  private readonly auditLogs: StudioAuditRecord[] = [];

  constructor(
    vig: VerifiableIntelligenceGraph | null,
    options: VIGStudioAdapterOptions = {}
  ) {
    this.vig = vig;
    this.timeoutMs = options.timeoutMs ?? 2000;
    this.maxAuditLogSize = options.maxAuditLogSize ?? 1000;
    this.allowStaleQueries = options.allowStaleQueries ?? true;
  }

  // ── 1. Protocol Handshake & Capability Discovery ──────────────────────────

  /**
   * Performs version negotiation, capability discovery, and service readiness verification.
   */
  public async handshake(
    request: StudioHandshakeRequest,
    context: VIGSecurityContext
  ): Promise<StudioHandshakeResponse> {
    const startTime = performance.now();
    VIGSecurityGuard.assertCanRead(context, 'handshake');

    if (!request || typeof request !== 'object') {
      throw new VIGStudioValidationError('Handshake request must be a valid object');
    }

    if (!request.clientIdentifier || typeof request.clientIdentifier !== 'string') {
      throw new VIGStudioValidationError('Handshake request requires a valid "clientIdentifier"');
    }

    if (!request.requestedProtocolVersion || typeof request.requestedProtocolVersion !== 'string') {
      throw new VIGStudioValidationError('Handshake request requires "requestedProtocolVersion"');
    }

    const isCompatible = this.isProtocolCompatible(request.requestedProtocolVersion);

    if (!this.vig) {
      const response: StudioHandshakeResponse = Object.freeze({
        protocolVersion: VIG_STUDIO_PROTOCOL_VERSION,
        serviceStatus: 'UNAVAILABLE',
        serverIdentifier: VIGStudioAdapter.SERVER_IDENTIFIER,
        supportedQueries: VIGStudioAdapter.SUPPORTED_QUERIES,
        boundCommitSha: '0000000000000000000000000000000000000000',
        graphRootSeal: '0'.repeat(64),
        isWorkingTreeClean: false,
        totalNodes: 0,
        totalEdges: 0,
        isCompatible,
        serverTimestamp: Date.now(),
      });

      this.logAudit(request.clientIdentifier, 'handshake', true, 200, performance.now() - startTime, request);
      return response;
    }

    const anchor = await this.executeWithTimeout(
      'handshake',
      () => this.vig!.getGraphAnchor(context)
    );

    const response: StudioHandshakeResponse = Object.freeze({
      protocolVersion: VIG_STUDIO_PROTOCOL_VERSION,
      serviceStatus: 'READY',
      serverIdentifier: VIGStudioAdapter.SERVER_IDENTIFIER,
      supportedQueries: VIGStudioAdapter.SUPPORTED_QUERIES,
      boundCommitSha: anchor.commitSha,
      graphRootSeal: anchor.rootCID,
      isWorkingTreeClean: anchor.isClean,
      totalNodes: anchor.totalNodes,
      totalEdges: anchor.totalEdges,
      isCompatible,
      serverTimestamp: Date.now(),
    });

    this.logAudit(request.clientIdentifier, 'handshake', true, 200, performance.now() - startTime, request);
    return response;
  }

  // ── 2. Read-Only Context Query ────────────────────────────────────────────

  /**
   * Retrieves verified code context, dependencies, and evidence for a target symbol or path.
   */
  public async queryVerifiedContext(
    request: StudioContextQueryRequest,
    context: VIGSecurityContext
  ): Promise<StudioContextQueryResponse> {
    const startTime = performance.now();
    VIGSecurityGuard.assertCanRead(context, 'queryVerifiedContext');

    if (!request || (!request.targetPath && !request.symbolName)) {
      throw new VIGStudioValidationError(
        'queryVerifiedContext requires either "targetPath" or "symbolName"'
      );
    }

    if (!this.vig) {
      throw new VIGStudioUnavailableError('VIG service is not available for context queries');
    }

    if (request.targetPath) {
      VIGSecurityGuard.assertSafeRepositoryPath(request.targetPath, this.vig.repoRoot);
    }

    try {
      const result = await this.executeWithTimeout(
        'queryVerifiedContext',
        () => this.vig!.getVerifiedContext(
          {
            targetPath: request.targetPath,
            symbolName: request.symbolName,
          },
          context
        )
      );

      const anchor = await this.vig.getGraphAnchor(context);
      const isStale = !anchor.isClean || result.verificationStatus === 'STALE';

      const warnings: string[] = [];
      if (isStale) {
        warnings.push('Working tree has uncommitted modifications or commit identity changed since evaluation.');
      }
      if (result.verificationStatus === 'FAILED') {
        warnings.push('Verification evidence indicates test suite or typecheck failure.');
      } else if (result.verificationStatus === 'UNVERIFIED') {
        warnings.push('No verification evidence recorded for this entity.');
      }

      const durationMs = performance.now() - startTime;
      const response: StudioContextQueryResponse = Object.freeze({
        success: true,
        protocolVersion: VIG_STUDIO_PROTOCOL_VERSION,
        node: result.node,
        dependencies: result.dependencies,
        dependents: result.dependents,
        boundCommitSha: anchor.commitSha,
        graphRootSeal: anchor.rootCID,
        verificationStatus: result.verificationStatus,
        isStale,
        lastEvidenceId: result.lastEvidence?.evidenceId,
        queryDurationMs: durationMs,
        warnings: Object.freeze(warnings),
      });

      this.logAudit(context.agentId, 'queryVerifiedContext', true, 200, durationMs, request, isStale);
      return response;
    } catch (err: any) {
      this.logAudit(context.agentId, 'queryVerifiedContext', false, err.statusCode ?? 500, performance.now() - startTime, request, false, err.message);
      throw err;
    }
  }

  // ── 3. Read-Only Dependency Impact Query ──────────────────────────────────

  /**
   * Queries downstream impact of file modifications.
   */
  public async queryDependencyImpact(
    request: StudioImpactQueryRequest,
    context: VIGSecurityContext
  ): Promise<StudioImpactQueryResponse> {
    const startTime = performance.now();
    VIGSecurityGuard.assertCanRead(context, 'queryDependencyImpact');

    if (!request || !Array.isArray(request.changedPaths)) {
      throw new VIGStudioValidationError('queryDependencyImpact requires a valid "changedPaths" array');
    }

    if (!this.vig) {
      throw new VIGStudioUnavailableError('VIG service is not available for impact queries');
    }

    for (const p of request.changedPaths) {
      VIGSecurityGuard.assertSafeRepositoryPath(p, this.vig.repoRoot);
    }

    try {
      const result = await this.executeWithTimeout(
        'queryDependencyImpact',
        () => this.vig!.queryImpact(
          {
            changedPaths: request.changedPaths,
            maxDepth: request.maxTraversalDepth ?? 50,
            includeTests: true,
          },
          context
        )
      );

      const anchor = await this.vig.getGraphAnchor(context);
      const durationMs = performance.now() - startTime;

      const response: StudioImpactQueryResponse = Object.freeze({
        success: true,
        protocolVersion: VIG_STUDIO_PROTOCOL_VERSION,
        isNoOp: result.isNoOp,
        isPublicApiBreached: result.isPublicApiBreached,
        changedNodes: result.changedNodes,
        affectedModules: result.affectedModules,
        requiredTestSuites: result.requiredTestSuites,
        boundCommitSha: anchor.commitSha,
        graphRootSeal: anchor.rootCID,
        queryDurationMs: durationMs,
      });

      this.logAudit(context.agentId, 'queryDependencyImpact', true, 200, durationMs, request);
      return response;
    } catch (err: any) {
      this.logAudit(context.agentId, 'queryDependencyImpact', false, err.statusCode ?? 500, performance.now() - startTime, request, false, err.message);
      throw err;
    }
  }

  // ── 4. Provenance Anchor Query ────────────────────────────────────────────

  /**
   * Retrieves current repository Merkle anchor and latest verification evidence ID.
   */
  public async getProvenanceAnchor(
    request: StudioProvenanceAnchorRequest,
    context: VIGSecurityContext
  ): Promise<StudioProvenanceAnchorResponse> {
    const startTime = performance.now();
    VIGSecurityGuard.assertCanRead(context, 'getProvenanceAnchor');

    if (!this.vig) {
      throw new VIGStudioUnavailableError('VIG service is not available for provenance queries');
    }

    try {
      const anchor = await this.executeWithTimeout(
        'getProvenanceAnchor',
        () => this.vig!.getGraphAnchor(context)
      );

      const latestEvidence = VIGProvenanceLedger.getLatestEvidenceRecord(this.vig.currentEvidenceLedger);
      const verificationStatus = latestEvidence?.overallPassed ? 'VERIFIED_PASS' : 'UNVERIFIED';

      const durationMs = performance.now() - startTime;
      const response: StudioProvenanceAnchorResponse = Object.freeze({
        success: true,
        protocolVersion: VIG_STUDIO_PROTOCOL_VERSION,
        rootCID: anchor.rootCID,
        commitSha: anchor.commitSha,
        baselineTag: anchor.baselineTag,
        isWorkingTreeClean: anchor.isClean,
        totalNodes: anchor.totalNodes,
        totalEdges: anchor.totalEdges,
        latestEvidenceId: latestEvidence?.evidenceId,
        latestVerificationStatus: verificationStatus,
      });

      this.logAudit(context.agentId, 'getProvenanceAnchor', true, 200, durationMs, request);
      return response;
    } catch (err: any) {
      this.logAudit(context.agentId, 'getProvenanceAnchor', false, err.statusCode ?? 500, performance.now() - startTime, request, false, err.message);
      throw err;
    }
  }

  // ── 5. Audit Log Inspection & Management ──────────────────────────────────

  /**
   * Returns an immutable snapshot of recent audit records.
   */
  public getAuditLogs(): readonly StudioAuditRecord[] {
    return Object.freeze([...this.auditLogs]);
  }

  /**
   * Clears the in-memory audit log.
   */
  public clearAuditLogs(): void {
    this.auditLogs.length = 0;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private isProtocolCompatible(clientVersion: string): boolean {
    const serverMajor = VIG_STUDIO_PROTOCOL_VERSION.split('.')[0];
    const clientMajor = clientVersion.split('.')[0];
    return serverMajor === clientMajor;
  }

  private async executeWithTimeout<T>(
    operationName: string,
    action: () => Promise<T>
  ): Promise<T> {
    let timer: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new VIGStudioTimeoutError(operationName, this.timeoutMs));
      }, this.timeoutMs);
    });

    try {
      return await Promise.race([action(), timeoutPromise]);
    } finally {
      clearTimeout(timer!);
    }
  }

  private logAudit(
    clientIdentifier: string,
    operation: string,
    success: boolean,
    statusCode: number,
    durationMs: number,
    queryParams: any,
    isStale?: boolean,
    error?: string
  ): void {
    if (this.auditLogs.length >= this.maxAuditLogSize) {
      this.auditLogs.shift();
    }

    this.auditLogs.push(
      Object.freeze({
        timestamp: Date.now(),
        clientIdentifier,
        operation,
        success,
        statusCode,
        durationMs,
        queryParams: { ...queryParams },
        isStale,
        error,
      })
    );
  }
}
