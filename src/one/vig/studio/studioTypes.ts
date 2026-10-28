/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/studio/studioTypes
 * Specification: VIG Phase 9 — 3D Memory Studio Integration Preparation
 *
 * Versioned integration contract, data interchange schemas, and fault-tolerant
 * error models for external Studio integration.
 */

import {
  VIGNode,
  VIGVerificationStatus,
  VIGError,
} from '../types';

export const VIG_STUDIO_PROTOCOL_VERSION = '1.0.0';

export type VIGStudioServiceStatus = 'READY' | 'DEGRADED' | 'UNAVAILABLE';

// ── 1. Handshake & Capability Discovery ─────────────────────────────────────

export interface StudioHandshakeRequest {
  /** Identifier of the calling Studio client */
  readonly clientIdentifier: string;
  /** Semantic version string of the calling client */
  readonly clientVersion: string;
  /** Requested VIG protocol version (e.g. '1.0.0') */
  readonly requestedProtocolVersion: string;
}

export interface StudioHandshakeResponse {
  /** Negotiated protocol version */
  readonly protocolVersion: string;
  /** High-level readiness status of the VIG service */
  readonly serviceStatus: VIGStudioServiceStatus;
  /** Server identifier (e.g. 'one-language-vig-host') */
  readonly serverIdentifier: string;
  /** List of supported query capability tokens */
  readonly supportedQueries: readonly string[];
  /** Currently bound Git commit SHA */
  readonly boundCommitSha: string;
  /** Root Merkle DAG seal of the current code graph */
  readonly graphRootSeal: string;
  /** Whether the active working tree has uncommitted modifications */
  readonly isWorkingTreeClean: boolean;
  /** Total number of indexed nodes */
  readonly totalNodes: number;
  /** Total number of indexed directed edges */
  readonly totalEdges: number;
  /** Whether client and server protocol versions are mutually compatible */
  readonly isCompatible: boolean;
  /** Server epoch timestamp in milliseconds */
  readonly serverTimestamp: number;
}

// ── 2. Read-Only Context Query ──────────────────────────────────────────────

export interface StudioContextQueryRequest {
  /** Relative repository path to query (e.g. 'src/one/tensor/Tensor.ts') */
  readonly targetPath?: string;
  /** Specific symbol or function name within the target path */
  readonly symbolName?: string;
  /** Maximum traversal depth for forward dependencies */
  readonly maxDependencyDepth?: number;
}

export interface StudioContextQueryResponse {
  readonly success: boolean;
  readonly protocolVersion: string;
  readonly node: VIGNode | null;
  readonly dependencies: readonly VIGNode[];
  readonly dependents: readonly VIGNode[];
  readonly boundCommitSha: string;
  readonly graphRootSeal: string;
  readonly verificationStatus: VIGVerificationStatus;
  /** True if working tree has uncommitted edits or commit SHA differs from evidence */
  readonly isStale: boolean;
  readonly lastEvidenceId?: string;
  readonly queryDurationMs: number;
  readonly warnings: readonly string[];
}

// ── 3. Read-Only Dependency Impact Query ────────────────────────────────────

export interface StudioImpactQueryRequest {
  /** List of relative paths modified or being evaluated */
  readonly changedPaths: readonly string[];
  /** Maximum traversal depth for reverse incoming impact edges */
  readonly maxTraversalDepth?: number;
}

export interface StudioImpactQueryResponse {
  readonly success: boolean;
  readonly protocolVersion: string;
  readonly isNoOp: boolean;
  readonly isPublicApiBreached: boolean;
  readonly changedNodes: readonly VIGNode[];
  readonly affectedModules: readonly VIGNode[];
  readonly requiredTestSuites: readonly string[];
  readonly boundCommitSha: string;
  readonly graphRootSeal: string;
  readonly queryDurationMs: number;
}

// ── 4. Provenance Anchor Query ──────────────────────────────────────────────

export interface StudioProvenanceAnchorRequest {
  readonly includeEvidenceSummary?: boolean;
}

export interface StudioProvenanceAnchorResponse {
  readonly success: boolean;
  readonly protocolVersion: string;
  readonly rootCID: string;
  readonly commitSha: string;
  readonly baselineTag: string;
  readonly isWorkingTreeClean: boolean;
  readonly totalNodes: number;
  readonly totalEdges: number;
  readonly latestEvidenceId?: string;
  readonly latestVerificationStatus: VIGVerificationStatus;
}

// ── 5. Audit Logging Types ──────────────────────────────────────────────────

export interface StudioAuditRecord {
  readonly timestamp: number;
  readonly clientIdentifier: string;
  readonly operation: string;
  readonly success: boolean;
  readonly statusCode: number;
  readonly durationMs: number;
  readonly queryParams: Record<string, unknown>;
  readonly isStale?: boolean;
  readonly error?: string;
}

// ── 6. Error Hierarchy ──────────────────────────────────────────────────────

export class VIGStudioError extends VIGError {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(`[VIG Studio Integration Error] ${message}`);
    this.name = 'VIGStudioError';
    this.statusCode = statusCode;
  }
}

export class VIGStudioValidationError extends VIGStudioError {
  constructor(message: string) {
    super(`Validation failed: ${message}`, 400);
    this.name = 'VIGStudioValidationError';
  }
}

export class VIGStudioTimeoutError extends VIGStudioError {
  constructor(operation: string, timeoutMs: number) {
    super(`Operation "${operation}" exceeded execution timeout of ${timeoutMs}ms`, 504);
    this.name = 'VIGStudioTimeoutError';
  }
}

export class VIGStudioUnavailableError extends VIGStudioError {
  constructor(message: string = 'VIG service is uninitialized or unavailable') {
    super(message, 503);
    this.name = 'VIGStudioUnavailableError';
  }
}
