/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/agentic/agenticTypes
 * Specification: VIG Phase 11 — Agentic AI Integration
 *
 * Least-privilege agentic integration schemas, conclusion models,
 * declarative proposals, approval tokens, and security error hierarchy.
 */

import {
  VIGNode,
  VIGVerificationStatus,
  VIGError,
  VIGAgentRole,
} from '../types';

export const VIG_AGENTIC_PROTOCOL_VERSION = '1.0.0';

export type AgenticRolloutMode = 'ACTIVE' | 'SHADOW' | 'DISABLED';

export type AgenticAuditOutcome =
  | 'SUCCESS'
  | 'REJECTED_UNVERIFIED'
  | 'REJECTED_STALE'
  | 'APPROVAL_DENIED'
  | 'INJECTION_DEFENDED'
  | 'TIMEOUT'
  | 'CIRCUIT_TRIPPED'
  | 'ROLLOUT_DISABLED'
  | 'RATE_LIMITED'
  | 'ERROR';

// ── 1. Bound Agent Conclusion Model ──────────────────────────────────────────

export interface AgenticConclusion {
  /** Unique deterministic conclusion identity */
  readonly conclusionId: string;
  /** Identifier of the evaluating agent instance */
  readonly agentId: string;
  /** Repository-relative path of the target code */
  readonly targetPath: string;
  /** Specific symbol name if queried */
  readonly symbolName?: string;
  /** Bound 40-character Git commit hash at time of analysis */
  readonly boundCommitSha: string;
  /** Cryptographic Merkle DAG seal of the code graph at analysis */
  readonly graphRootSeal: string;
  /** Deterministic evidence identifier if verification evidence exists */
  readonly evidenceId?: string;
  /** Evaluated status: VERIFIED_PASS, STALE, FAILED, or UNVERIFIED */
  readonly verificationStatus: VIGVerificationStatus;
  /** Whether the active working tree was dirty or evidence was stale */
  readonly isStale: boolean;
  /** Analytical confidence level derived from verification evidence */
  readonly confidence: 'HIGH' | 'LOW' | 'UNVERIFIED';
  /** Human-readable analytical summary */
  readonly summary: string;
  /** Granular analytical findings */
  readonly findings: readonly string[];
  /** Warning notices if unverified or stale */
  readonly warnings: readonly string[];
  /** Analysis completion timestamp in epoch milliseconds */
  readonly timestamp: number;
}

// ── 2. Declarative Proposals & Consequential Actions ─────────────────────────

export type DeclarativeActionType =
  | 'RUN_TEST_SUITE'
  | 'UPDATE_SOURCE'
  | 'TRIGGER_COMPILATION'
  | 'UPDATE_DEPENDENCY'
  | 'DEPLOY_ARTIFACT';

export interface DeclarativeAction {
  /** Type classification of the prospective action */
  readonly actionType: DeclarativeActionType;
  /** Target file, suite, or symbol path */
  readonly target: string;
  /** Action description and intended outcome */
  readonly description: string;
  /** Typed parameters for the proposed action */
  readonly parameters: Readonly<Record<string, unknown>>;
  /** Whether this action alters external state or filesystem */
  readonly isMutating: boolean;
}

export type ProposalStatus = 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'EXECUTED';

export interface AgenticProposal {
  /** Unique proposal identity */
  readonly proposalId: string;
  /** Identifier of the proposing agent */
  readonly agentId: string;
  /** Proposal classification */
  readonly proposalType: 'TEST_PLAN' | 'REFACTOR_RECOMMENDATION' | 'API_BREAKAGE_WARNING';
  /** Proposal title */
  readonly title: string;
  /** Analytical description and rationale */
  readonly description: string;
  /** High-level recommendations (advisory only) */
  readonly recommendations: readonly string[];
  /** Declarative actions proposed (non-executable by agent) */
  readonly suggestedActions: readonly DeclarativeAction[];
  /** Strict invariant: true for all proposals */
  readonly requiresApproval: true;
  /** Lifecycle state of the proposal */
  readonly status: ProposalStatus;
  /** Bound Git commit SHA when proposed */
  readonly boundCommitSha: string;
  /** Associated verification status */
  readonly verificationStatus: VIGVerificationStatus;
  /** Creation timestamp */
  readonly createdAt: number;
}

// ── 3. Test Plan Proposal Model ──────────────────────────────────────────────

export interface ProposedTestSuite {
  /** Repository-relative path to the required test suite */
  readonly suitePath: string;
  /** Strict invariant: Always PENDING_EXECUTION when proposed by impact */
  readonly executionStatus: 'PENDING_EXECUTION';
  /** Rationale explaining why this test is required based on dependency impact */
  readonly reason: string;
}

export interface ProposedTestPlan {
  readonly planId: string;
  readonly changedPaths: readonly string[];
  readonly affectedModuleCount: number;
  readonly isPublicApiBreached: boolean;
  readonly requiredTestSuites: readonly ProposedTestSuite[];
  readonly rationale: string;
  readonly boundCommitSha: string;
  readonly graphRootSeal: string;
}

// ── 4. Consequential Action Approval Token ───────────────────────────────────

export interface ApprovalToken {
  /** Protocol schema version (version 2 binds complete canonical proposal hash) */
  readonly tokenVersion?: number;
  /** Cryptographically derived approval token ID */
  readonly tokenId: string;
  /** Cryptographically unpredictable single-use nonce (BUG-D03) */
  readonly nonce: string;
  /** Proposal ID this token authorizes */
  readonly proposalId: string;
  /** Approving entity ID (e.g. 'human-operator-pma') */
  readonly approverId: string;
  /** Approver role: strictly SYSTEM_CORE required */
  readonly approverRole: 'SYSTEM_CORE';
  /** Deterministic SHA-256 hash of the complete canonical proposal (BUG-D02) */
  readonly proposalHash: string;
  /** Permitted action type scope (optional limit) */
  readonly permittedActionType?: string;
  /** Permitted target scope (optional limit) */
  readonly scope?: string;
  /** Intended consuming subsystem / audience */
  readonly intendedAudience?: string;
  /** Associated evidence ID bound at approval time */
  readonly evidenceId?: string;
  /** Associated evidence seal bound at approval time */
  readonly evidenceSeal?: string;
  /** Timestamp when approval was granted */
  readonly authorizedAt: number;
  /** Expiration timestamp for this token */
  readonly expiresAt: number;
  /** SHA-256 HMAC authenticating the complete approval payload */
  readonly signature: string;
}

export interface TokenRedemptionRecord {
  readonly tokenId: string;
  readonly proposalId: string;
  readonly approverId: string;
  readonly redeemedAt: number;
  readonly status: 'RESERVED' | 'CONSUMED' | 'FAILED_EXECUTION';
  readonly error?: string;
}

// ── 5. Prompt Injection Defense Types ────────────────────────────────────────

export interface SanitizedContentResult {
  /** Sanitized text safe for LLM context inclusion */
  readonly sanitizedContent: string;
  /** Source CID if available */
  readonly sourceCid?: string;
  /** Delimiter opening tag */
  readonly openingTag: string;
  /** Delimiter closing tag */
  readonly closingTag: string;
  /** Whether prompt injection patterns were detected and neutralized */
  readonly injectionAttemptDetected: boolean;
  /** Detected injection signatures if any */
  readonly detectedSignatures: readonly string[];
}

// ── 6. Audit Logging Schema ──────────────────────────────────────────────────

export interface AgenticAuditRecord {
  readonly recordId: string;
  readonly timestamp: number;
  readonly agentId: string;
  readonly role: VIGAgentRole;
  readonly operation: string;
  readonly outcome: AgenticAuditOutcome;
  readonly statusCode: number;
  readonly durationMs: number;
  readonly boundCommitSha?: string;
  readonly evidenceId?: string;
  readonly verificationStatus?: VIGVerificationStatus;
  readonly proposalId?: string;
  readonly approvalId?: string;
  readonly approverId?: string;
  readonly details: Record<string, unknown>;
  readonly error?: string;
}

// ── 7. Error Hierarchy ───────────────────────────────────────────────────────

export class VIGAgenticError extends VIGError {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(`[VIG Agentic Integration Error] ${message}`);
    this.name = 'VIGAgenticError';
    this.statusCode = statusCode;
  }
}

export class VIGAgenticValidationError extends VIGAgenticError {
  constructor(message: string) {
    super(`Validation failed: ${message}`, 400);
    this.name = 'VIGAgenticValidationError';
  }
}

export class VIGAgenticApprovalRequiredError extends VIGAgenticError {
  constructor(proposalId: string, reason: string = 'Consequential action requires explicit approval token') {
    super(`Approval required for proposal "${proposalId}": ${reason}`, 403);
    this.name = 'VIGAgenticApprovalRequiredError';
  }
}

export class VIGAgenticSecurityError extends VIGAgenticError {
  constructor(message: string) {
    super(`Security policy violation: ${message}`, 403);
    this.name = 'VIGAgenticSecurityError';
  }
}

export class VIGAgenticUnverifiedError extends VIGAgenticError {
  constructor(status: VIGVerificationStatus, target: string) {
    super(`Agent context rejected: verification status is "${status}" for "${target}".`, 412);
    this.name = 'VIGAgenticUnverifiedError';
  }
}

export class VIGAgenticStaleEvidenceError extends VIGAgenticError {
  constructor(reason: string) {
    super(`Agent context rejected because evidence is STALE: ${reason}`, 409);
    this.name = 'VIGAgenticStaleEvidenceError';
  }
}

export class VIGAgenticTimeoutError extends VIGAgenticError {
  constructor(operation: string, timeoutMs: number) {
    super(`Agent operation "${operation}" exceeded execution budget of ${timeoutMs}ms`, 504);
    this.name = 'VIGAgenticTimeoutError';
  }
}

export class VIGAgenticDisabledError extends VIGAgenticError {
  constructor(reason: string = 'Agentic integration is currently DISABLED or rolled back') {
    super(reason, 503);
    this.name = 'VIGAgenticDisabledError';
  }
}

export class VIGAgenticUnavailableError extends VIGAgenticError {
  constructor(message: string = 'VIG service is uninitialized or unavailable') {
    super(message, 503);
    this.name = 'VIGAgenticUnavailableError';
  }
}

export class VIGAgenticRateLimitError extends VIGAgenticError {
  constructor(message: string = 'Agent request rate limit or concurrency quota exceeded') {
    super(message, 429);
    this.name = 'VIGAgenticRateLimitError';
  }
}

