/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/cubio/cubioTypes
 * Specification: VIG Phase 10 — CUBiO AI Integration Preparation
 *
 * Sovereign, versioned integration protocol, schemas, and fault-tolerant
 * error hierarchy enabling CUBiO AI reasoning agents to consume verified
 * context, dependency impact, and cryptographic provenance records.
 */

import {
  VIGNode,
  VIGVerificationStatus,
  VIGError,
  VIGAgentRole,
} from '../types';

export const VIG_CUBIO_PROTOCOL_VERSION = '1.0.0';

export type CUBiOServiceStatus = 'READY' | 'DEGRADED' | 'DISABLED' | 'UNAVAILABLE';

export type CUBiORolloutMode = 'ACTIVE' | 'SHADOW' | 'DISABLED';

// ── 1. Protocol Handshake & Capability Discovery ─────────────────────────────

export interface CUBiOHandshakeRequest {
  /** Identifier of the calling CUBiO agent or subsystem */
  readonly agentId: string;
  /** Role classification of the caller */
  readonly role: VIGAgentRole;
  /** Semantic version string of the CUBiO client */
  readonly clientVersion: string;
  /** Requested VIG protocol version (e.g. '1.0.0') */
  readonly requestedProtocolVersion: string;
  /** Optional session authentication token */
  readonly sessionToken?: string;
}

export interface CUBiOHandshakeResponse {
  /** Negotiated protocol version */
  readonly protocolVersion: string;
  /** High-level operational readiness of the adapter */
  readonly serviceStatus: CUBiOServiceStatus;
  /** Current rollout mode ('ACTIVE' | 'SHADOW' | 'DISABLED') */
  readonly rolloutMode: CUBiORolloutMode;
  /** Server identifier */
  readonly serverIdentifier: string;
  /** Supported query capabilities */
  readonly supportedQueries: readonly string[];
  /** Bound Git commit SHA of the current repository */
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

// ── 2. Read-Only Verified Context Query ──────────────────────────────────────

export interface CUBiOVerifiedContextRequest {
  /** Relative repository path to query (e.g. 'src/one/tensor/Tensor.ts') */
  readonly targetPath?: string;
  /** Specific symbol or function name within the target path */
  readonly symbolName?: string;
  /**
   * Whether to strictly require VERIFIED_PASS evidence.
   * If true (default), queries on STALE, FAILED, or UNVERIFIED data fail-closed.
   * If false, queries return advisory results with explicit warning flags.
   */
  readonly requireVerified?: boolean;
  /** Maximum traversal depth for forward/backward dependencies */
  readonly maxDepth?: number;
}

/**
 * Non-competing context descriptor summarizing code structures for CUBiO reasoning.
 * Does NOT duplicate the code graph inside ConceptGraph.
 */
export interface CUBiOVerifiedContextDescriptor {
  /** Target node if resolved */
  readonly node: VIGNode | null;
  /** Direct forward dependencies of the target */
  readonly dependencies: readonly VIGNode[];
  /** Direct backward dependents of the target */
  readonly dependents: readonly VIGNode[];
  /** 40-character Git commit hash anchoring this context */
  readonly boundCommitSha: string;
  /** Cryptographic Merkle DAG seal of the underlying code graph */
  readonly graphRootSeal: string;
  /** Provenance verification status: VERIFIED_PASS, STALE, FAILED, UNVERIFIED */
  readonly verificationStatus: VIGVerificationStatus;
  /** True if working tree has uncommitted edits or commit SHA differs from evidence */
  readonly isStale: boolean;
  /** Deterministic SHA-256 evidence identity if available */
  readonly lastEvidenceId?: string;
  /** Non-authoritative advisory warnings when running unverified */
  readonly warnings: readonly string[];
}

export interface CUBiOVerifiedContextResponse {
  readonly success: boolean;
  readonly protocolVersion: string;
  readonly descriptor: CUBiOVerifiedContextDescriptor;
  readonly rolloutMode: CUBiORolloutMode;
  readonly queryDurationMs: number;
}

// ── 3. Read-Only Dependency Impact Query ─────────────────────────────────────

export interface CUBiODependencyImpactRequest {
  /** List of repository-relative paths modified or being evaluated */
  readonly changedPaths: readonly string[];
  /** Maximum traversal depth for reverse incoming impact edges */
  readonly maxTraversalDepth?: number;
  /**
   * Whether to require that the base graph has VERIFIED_PASS evidence.
   * If true, evaluation on unverified code fails-closed.
   */
  readonly requireVerified?: boolean;
}

export interface CUBiODependencyImpactResponse {
  readonly success: boolean;
  readonly protocolVersion: string;
  readonly isNoOp: boolean;
  readonly isPublicApiBreached: boolean;
  readonly changedNodes: readonly VIGNode[];
  readonly affectedModules: readonly VIGNode[];
  readonly requiredTestSuites: readonly string[];
  readonly boundCommitSha: string;
  readonly graphRootSeal: string;
  readonly verificationStatus: VIGVerificationStatus;
  readonly rolloutMode: CUBiORolloutMode;
  readonly queryDurationMs: number;
  readonly warnings: readonly string[];
}

// ── 4. Provenance Anchor Query ───────────────────────────────────────────────

export interface CUBiOProvenanceAnchorRequest {
  readonly includeEvidenceSummary?: boolean;
}

export interface CUBiOProvenanceAnchorResponse {
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
  readonly rolloutMode: CUBiORolloutMode;
}

// ── 5. Audit Logging Types ───────────────────────────────────────────────────

export type CUBiOAuditStatus =
  | 'SUCCESS'
  | 'REJECTED_UNVERIFIED'
  | 'REJECTED_STALE'
  | 'REJECTED_UNAUTHORIZED'
  | 'TIMEOUT'
  | 'CIRCUIT_TRIPPED'
  | 'ROLLOUT_DISABLED'
  | 'ERROR';

export interface CUBiOAuditEvent {
  readonly timestamp: number;
  readonly agentId: string;
  readonly role: VIGAgentRole;
  readonly operation: string;
  readonly status: CUBiOAuditStatus;
  readonly statusCode: number;
  readonly durationMs: number;
  readonly queryParams: Record<string, unknown>;
  readonly evidenceStatus?: VIGVerificationStatus;
  readonly boundCommitSha?: string;
  readonly error?: string;
}

// ── 6. Error Hierarchy ───────────────────────────────────────────────────────

export class VIGCUBiOError extends VIGError {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(`[VIG CUBiO Integration Error] ${message}`);
    this.name = 'VIGCUBiOError';
    this.statusCode = statusCode;
  }
}

export class VIGCUBiOValidationError extends VIGCUBiOError {
  constructor(message: string) {
    super(`Validation failed: ${message}`, 400);
    this.name = 'VIGCUBiOValidationError';
  }
}

export class VIGCUBiOIncompatibleVersionError extends VIGCUBiOError {
  constructor(clientVersion: string, expectedVersion: string) {
    super(`Client requested incompatible protocol version "${clientVersion}". Expected "${expectedVersion}".`, 400);
    this.name = 'VIGCUBiOIncompatibleVersionError';
  }
}

export class VIGCUBiOUnverifiedError extends VIGCUBiOError {
  constructor(status: VIGVerificationStatus, target: string) {
    super(`Context verification required but verification status is "${status}" for target "${target}".`, 412);
    this.name = 'VIGCUBiOUnverifiedError';
  }
}

export class VIGCUBiOStaleEvidenceError extends VIGCUBiOError {
  constructor(reason: string) {
    super(`Context rejected because verification evidence is STALE: ${reason}`, 409);
    this.name = 'VIGCUBiOStaleEvidenceError';
  }
}

export class VIGCUBiOCorruptedDataError extends VIGCUBiOError {
  constructor(message: string) {
    super(`Integrity verification failed: ${message}`, 500);
    this.name = 'VIGCUBiOCorruptedDataError';
  }
}

export class VIGCUBiOTimeoutError extends VIGCUBiOError {
  constructor(operation: string, timeoutMs: number) {
    super(`Operation "${operation}" exceeded execution timeout of ${timeoutMs}ms`, 504);
    this.name = 'VIGCUBiOTimeoutError';
  }
}

export class VIGCUBiODisabledError extends VIGCUBiOError {
  constructor(reason: string = 'VIG CUBiO adapter is currently DISABLED or rolled back') {
    super(reason, 503);
    this.name = 'VIGCUBiODisabledError';
  }
}

export class VIGCUBiOUnavailableError extends VIGCUBiOError {
  constructor(message: string = 'VIG service is uninitialized or unavailable') {
    super(message, 503);
    this.name = 'VIGCUBiOUnavailableError';
  }
}
