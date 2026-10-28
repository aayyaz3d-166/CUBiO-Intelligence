/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/agentic/VIGApprovalGate
 * Specification: VIG Phase 11 — Agentic AI Integration
 *
 * Consequential action authorization gate, cryptographic approval tokens,
 * canonical proposal hashing (BUG-D02), and single-use replay prevention (BUG-D03).
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { VIGSecurityContext } from '../types';
import {
  AgenticProposal,
  ApprovalToken,
  DeclarativeActionType,
  TokenRedemptionRecord,
  VIGAgenticApprovalRequiredError,
  VIGAgenticSecurityError,
  VIGAgenticValidationError,
} from './agenticTypes';

/**
 * Recursively sorts all keys in an object/array to ensure bit-exact canonical JSON serialization.
 */
function sortObjectKeys(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortObjectKeys(obj[key]);
  }
  return sorted;
}

export interface ApprovalTokenOptions {
  ttlMs?: number;
  proposal?: AgenticProposal;
  permittedActionType?: DeclarativeActionType | string;
  scope?: string;
  intendedAudience?: string;
  evidenceId?: string;
  evidenceSeal?: string;
  nonce?: string;
}

export interface TokenVerificationOptions {
  permittedActionType?: string;
  scope?: string;
  intendedAudience?: string;
}

export class VIGApprovalGate {
  private static configuredSecret: string | null = null;
  private static storageWalPath: string | null = null;

  // Single-use token tracking (BUG-D03)
  private static readonly redeemedTokens: Map<string, TokenRedemptionRecord> = new Map();
  private static readonly activeReservations: Set<string> = new Set();
  private static readonly revokedTokens: Map<string, string> = new Map();

  // ── Key & Storage Configuration ──────────────────────────────────────────

  /**
   * Configures the trusted HMAC secret key for approval tokens.
   * Fail-closed: Must be at least 16 characters.
   */
  public static configureApprovalSecret(secret: string | null): void {
    if (secret === null) {
      this.configuredSecret = null;
      return;
    }
    if (typeof secret !== 'string' || secret.trim().length < 16) {
      throw new VIGAgenticValidationError('Approval secret must be a string of at least 16 characters');
    }
    this.configuredSecret = secret.trim();
  }

  public static getApprovalSecret(): string | null {
    return this.configuredSecret;
  }

  public static resetApprovalSecret(): void {
    this.configuredSecret = null;
  }

  /**
   * Configures durable file storage for token redemptions to persist across restarts.
   * If not configured, token replay protection is strictly process-local in-memory.
   */
  public static configureStorage(storageDir: string | null): void {
    if (!storageDir) {
      this.storageWalPath = null;
      return;
    }
    const resolvedDir = path.resolve(storageDir);
    if (!fs.existsSync(resolvedDir)) {
      fs.mkdirSync(resolvedDir, { recursive: true });
    }
    this.storageWalPath = path.join(resolvedDir, 'approval_redemptions.wal');

    // Load past redemptions fail-closed to protect across process restarts
    if (fs.existsSync(this.storageWalPath)) {
      try {
        const lines = fs.readFileSync(this.storageWalPath, 'utf8').split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const record = JSON.parse(trimmed) as TokenRedemptionRecord;
          if (record && typeof record.tokenId === 'string') {
            this.redeemedTokens.set(record.tokenId, record);
          }
        }
      } catch {
        // Corrupt redemption WAL must not cause silent replay vulnerability
        throw new VIGAgenticSecurityError('Corrupt approval redemptions WAL detected; startup failed closed');
      }
    }
  }

  /**
   * Clears in-memory redemption records (for test isolation only).
   */
  public static resetRedemptions(): void {
    this.redeemedTokens.clear();
    this.activeReservations.clear();
    this.revokedTokens.clear();
    if (this.storageWalPath && fs.existsSync(this.storageWalPath)) {
      try {
        fs.unlinkSync(this.storageWalPath);
      } catch {}
    }
  }

  /**
   * Explicitly revokes an issued approval token before use.
   */
  public static revokeToken(tokenId: string, reason: string): void {
    if (!tokenId || typeof tokenId !== 'string') {
      throw new VIGAgenticValidationError('Valid tokenId required to revoke token');
    }
    this.revokedTokens.set(tokenId.trim(), reason || 'Revoked by administrator');
  }

  // ── Canonical Proposal Hashing (BUG-D02) ───────────────────────────────────

  /**
   * Computes a deterministic SHA-256 hash of the complete canonical proposal payload.
   * Any change to title, description, recommendations, suggestedActions, target paths,
   * parameters, or verification state produces a completely different hash.
   */
  public static computeProposalHash(
    proposal: AgenticProposal,
    options?: {
      permittedActionType?: string;
      scope?: string;
      intendedAudience?: string;
      evidenceId?: string;
      evidenceSeal?: string;
    }
  ): string {
    if (!proposal || typeof proposal !== 'object') {
      throw new VIGAgenticValidationError('Proposal must be a valid AgenticProposal object');
    }

    const canonicalData = {
      schemaVersion: 2,
      proposalId: String(proposal.proposalId ?? ''),
      agentId: String(proposal.agentId ?? ''),
      proposalType: String(proposal.proposalType ?? ''),
      title: String(proposal.title ?? ''),
      description: String(proposal.description ?? ''),
      recommendations: Array.isArray(proposal.recommendations)
        ? [...proposal.recommendations].map(String)
        : [],
      suggestedActions: Array.isArray(proposal.suggestedActions)
        ? proposal.suggestedActions.map((a) => ({
            actionType: String(a.actionType ?? ''),
            target: String(a.target ?? ''),
            description: String(a.description ?? ''),
            isMutating: Boolean(a.isMutating),
            parameters: a.parameters ? sortObjectKeys(a.parameters) : {},
          }))
        : [],
      boundCommitSha: String(proposal.boundCommitSha ?? ''),
      verificationStatus: String(proposal.verificationStatus ?? ''),
      permittedActionType: String(options?.permittedActionType ?? ''),
      scope: String(options?.scope ?? ''),
      intendedAudience: String(options?.intendedAudience ?? ''),
      evidenceId: String(options?.evidenceId ?? ''),
      evidenceSeal: String(options?.evidenceSeal ?? ''),
    };

    const canonicalJson = JSON.stringify(sortObjectKeys(canonicalData));
    return crypto.createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
  }

  // ── Token Issuance ─────────────────────────────────────────────────────────

  /**
   * Generates a cryptographic approval token binding the complete canonical proposal.
   * Can ONLY be issued by authenticated SYSTEM_CORE.
   */
  public static issueApprovalToken(
    target: AgenticProposal | string,
    approverId: string,
    context: VIGSecurityContext,
    secretKey?: string,
    options?: ApprovalTokenOptions
  ): ApprovalToken {
    if (!target) {
      throw new VIGAgenticValidationError('Valid proposal or proposalId required to issue approval token');
    }

    if (!approverId || typeof approverId !== 'string' || approverId.trim().length === 0) {
      throw new VIGAgenticValidationError('Valid approverId required');
    }

    if (!context || context.role !== 'SYSTEM_CORE') {
      throw new VIGAgenticSecurityError(
        `Unauthorized token issuance: role "${context?.role ?? 'UNKNOWN'}" cannot issue approval tokens. SYSTEM_CORE required.`
      );
    }

    const key = secretKey ?? this.configuredSecret;
    if (!key) {
      throw new VIGAgenticSecurityError(
        'Approval secret is not configured; token issuance rejected fail-closed'
      );
    }

    const authorizedAt = Date.now();
    const ttlMs = options?.ttlMs ?? 300000; // 5 minutes default
    const expiresAt = authorizedAt + ttlMs;

    // Resolve target proposal
    let proposalObj: AgenticProposal;
    if (typeof target === 'object' && target !== null) {
      proposalObj = target;
    } else if (options?.proposal) {
      proposalObj = options.proposal;
    } else {
      // Minimal envelope for backwards compatibility when caller provides string ID
      proposalObj = {
        proposalId: target,
        agentId: approverId,
        proposalType: 'TEST_PLAN',
        title: target,
        description: target,
        recommendations: [],
        suggestedActions: [],
        requiresApproval: true,
        status: 'PROPOSED',
        boundCommitSha: '0'.repeat(40),
        verificationStatus: 'UNVERIFIED',
        createdAt: authorizedAt,
      };
    }

    const proposalHash = this.computeProposalHash(proposalObj, {
      permittedActionType: options?.permittedActionType,
      scope: options?.scope,
      intendedAudience: options?.intendedAudience,
      evidenceId: options?.evidenceId,
      evidenceSeal: options?.evidenceSeal,
    });

    const nonce = options?.nonce ?? crypto.randomBytes(16).toString('hex');
    const tokenId = crypto
      .createHash('sha256')
      .update(`${proposalObj.proposalId}:${approverId}:${nonce}:${authorizedAt}`)
      .digest('hex')
      .substring(0, 24);

    const payload = [
      'VIG-APPROVAL-TOKEN-V2',
      tokenId,
      nonce,
      proposalObj.proposalId,
      proposalHash,
      approverId.trim(),
      'SYSTEM_CORE',
      authorizedAt,
      expiresAt,
      options?.intendedAudience ?? '',
      options?.scope ?? '',
      options?.permittedActionType ?? '',
      options?.evidenceId ?? '',
      options?.evidenceSeal ?? '',
    ].join('|');

    const signature = crypto.createHmac('sha256', key).update(payload, 'utf8').digest('hex');

    return Object.freeze({
      tokenVersion: 2,
      tokenId,
      nonce,
      proposalId: proposalObj.proposalId,
      approverId: approverId.trim(),
      approverRole: 'SYSTEM_CORE',
      proposalHash,
      permittedActionType: options?.permittedActionType,
      scope: options?.scope,
      intendedAudience: options?.intendedAudience,
      evidenceId: options?.evidenceId,
      evidenceSeal: options?.evidenceSeal,
      authorizedAt,
      expiresAt,
      signature,
    });
  }

  // ── Token Verification ─────────────────────────────────────────────────────

  /**
   * Verifies the cryptographic integrity, proposal binding, and freshness of an approval token.
   * Fail-closed: Rejects expired, revoked, tampered, or mismatched tokens.
   */
  public static verifyApprovalToken(
    token: ApprovalToken,
    proposal: AgenticProposal,
    secretKey?: string,
    options?: TokenVerificationOptions
  ): boolean {
    if (!token || !proposal) return false;

    // Fail-closed against legacy weak tokens
    if (token.tokenVersion !== 2 || !token.proposalHash || !token.nonce) {
      return false;
    }

    if (token.proposalId !== proposal.proposalId) return false;
    if (token.approverRole !== 'SYSTEM_CORE') return false;

    // Revocation check
    if (this.revokedTokens.has(token.tokenId)) return false;

    // Timestamp & freshness validation with 5s clock skew tolerance
    const now = Date.now();
    if (now > token.expiresAt) return false;
    if (now < token.authorizedAt - 5000) return false;

    // Audience and scope enforcement if requested
    if (options?.intendedAudience && token.intendedAudience && token.intendedAudience !== options.intendedAudience) {
      return false;
    }
    if (options?.scope && token.scope && token.scope !== options.scope) {
      return false;
    }
    if (options?.permittedActionType && token.permittedActionType && token.permittedActionType !== options.permittedActionType) {
      return false;
    }

    const key = secretKey ?? this.configuredSecret;
    if (!key) {
      throw new VIGAgenticSecurityError(
        'Approval secret is not configured; token verification rejected fail-closed'
      );
    }

    // 1. Recompute and verify canonical proposal hash (detects post-approval mutation)
    const expectedProposalHash = this.computeProposalHash(proposal, {
      permittedActionType: token.permittedActionType,
      scope: token.scope,
      intendedAudience: token.intendedAudience,
      evidenceId: token.evidenceId,
      evidenceSeal: token.evidenceSeal,
    });

    let hashMatches = false;
    try {
      hashMatches = crypto.timingSafeEqual(
        Buffer.from(token.proposalHash, 'hex'),
        Buffer.from(expectedProposalHash, 'hex')
      );
    } catch {
      hashMatches = false;
    }

    if (!hashMatches) {
      return false;
    }

    // 2. Recompute and verify HMAC signature
    const payload = [
      'VIG-APPROVAL-TOKEN-V2',
      token.tokenId,
      token.nonce,
      token.proposalId,
      token.proposalHash,
      token.approverId,
      'SYSTEM_CORE',
      token.authorizedAt,
      token.expiresAt,
      token.intendedAudience ?? '',
      token.scope ?? '',
      token.permittedActionType ?? '',
      token.evidenceId ?? '',
      token.evidenceSeal ?? '',
    ].join('|');

    const expectedSig = crypto.createHmac('sha256', key).update(payload, 'utf8').digest('hex');

    let sigMatches = false;
    try {
      sigMatches = crypto.timingSafeEqual(
        Buffer.from(token.signature, 'hex'),
        Buffer.from(expectedSig, 'hex')
      );
    } catch {
      sigMatches = false;
    }

    return sigMatches;
  }

  // ── Proposal State Transitions ─────────────────────────────────────────────

  /**
   * Approves a proposal using a valid approval token, transitioning its state to 'APPROVED'.
   */
  public static approveProposal(
    proposal: AgenticProposal,
    token: ApprovalToken,
    secretKey?: string
  ): AgenticProposal {
    if (!this.verifyApprovalToken(token, proposal, secretKey)) {
      throw new VIGAgenticApprovalRequiredError(
        proposal.proposalId,
        'Invalid, expired, tampered, or mismatched approval token'
      );
    }

    if (proposal.status !== 'PROPOSED') {
      throw new VIGAgenticValidationError(
        `Cannot approve proposal "${proposal.proposalId}" in status "${proposal.status}". Must be PROPOSED.`
      );
    }

    return Object.freeze({
      ...proposal,
      status: 'APPROVED',
    });
  }

  /**
   * Rejects a proposal, transitioning its state to 'REJECTED'.
   */
  public static rejectProposal(
    proposal: AgenticProposal,
    rejectorId: string,
    reason: string
  ): AgenticProposal {
    if (proposal.status !== 'PROPOSED') {
      throw new VIGAgenticValidationError(
        `Cannot reject proposal in status "${proposal.status}". Must be PROPOSED.`
      );
    }

    return Object.freeze({
      ...proposal,
      status: 'REJECTED',
      recommendations: Object.freeze([...proposal.recommendations, `REJECTED by ${rejectorId}: ${reason}`]),
    });
  }

  // ── Consequential Execution with Replay Prevention (BUG-D03) ───────────────

  /**
   * Authorizes and executes a consequential action against an approved proposal.
   * Enforces atomic single-use token redemption and replay prevention.
   */
  public static async executeApprovedAction<T>(
    proposal: AgenticProposal,
    token: ApprovalToken,
    executor: () => Promise<T>,
    secretKey?: string,
    options?: TokenVerificationOptions
  ): Promise<{ result: T; updatedProposal: AgenticProposal }> {
    if (proposal.status !== 'APPROVED') {
      throw new VIGAgenticApprovalRequiredError(
        proposal.proposalId,
        `Execution forbidden: Proposal status is "${proposal.status}". Must be APPROVED.`
      );
    }

    if (this.revokedTokens.has(token.tokenId)) {
      throw new VIGAgenticSecurityError(
        `Execution forbidden: Approval token "${token.tokenId}" has been revoked: ${this.revokedTokens.get(token.tokenId)}`
      );
    }

    if (!this.verifyApprovalToken(token, proposal, secretKey, options)) {
      throw new VIGAgenticApprovalRequiredError(
        proposal.proposalId,
        'Execution forbidden: Approval token verification failed.'
      );
    }

    // ── BUG-D03: Synchronous Atomic Reservation BEFORE Any Asynchronous Execution ──
    const tokenId = token.tokenId;

    if (this.redeemedTokens.has(tokenId)) {
      const record = this.redeemedTokens.get(tokenId)!;
      throw new VIGAgenticSecurityError(
        `Execution forbidden: Approval token "${tokenId}" has already been redeemed (status: ${record.status}, replay rejected)`
      );
    }

    if (this.activeReservations.has(tokenId)) {
      throw new VIGAgenticSecurityError(
        `Execution forbidden: Approval token "${tokenId}" is currently being redeemed concurrently (replay rejected)`
      );
    }

    // Atomically reserve the token synchronously
    this.activeReservations.add(tokenId);
    const reservationRecord: TokenRedemptionRecord = {
      tokenId,
      proposalId: proposal.proposalId,
      approverId: token.approverId,
      redeemedAt: Date.now(),
      status: 'RESERVED',
    };
    this.redeemedTokens.set(tokenId, reservationRecord);

    if (this.storageWalPath) {
      try {
        fs.appendFileSync(this.storageWalPath, JSON.stringify(reservationRecord) + '\n', 'utf8');
      } catch {}
    }

    try {
      const result = await executor();

      // Successfully consumed
      const consumedRecord: TokenRedemptionRecord = {
        tokenId,
        proposalId: proposal.proposalId,
        approverId: token.approverId,
        redeemedAt: Date.now(),
        status: 'CONSUMED',
      };
      this.redeemedTokens.set(tokenId, consumedRecord);

      if (this.storageWalPath) {
        try {
          fs.appendFileSync(this.storageWalPath, JSON.stringify(consumedRecord) + '\n', 'utf8');
        } catch {}
      }

      const updatedProposal: AgenticProposal = Object.freeze({
        ...proposal,
        status: 'EXECUTED',
      });

      return { result, updatedProposal };
    } catch (err: any) {
      // Safe recovery: failed execution remains consumed, NEVER reopened!
      const failedRecord: TokenRedemptionRecord = {
        tokenId,
        proposalId: proposal.proposalId,
        approverId: token.approverId,
        redeemedAt: Date.now(),
        status: 'FAILED_EXECUTION',
        error: String(err?.message ?? err),
      };
      this.redeemedTokens.set(tokenId, failedRecord);

      if (this.storageWalPath) {
        try {
          fs.appendFileSync(this.storageWalPath, JSON.stringify(failedRecord) + '\n', 'utf8');
        } catch {}
      }

      throw err;
    } finally {
      this.activeReservations.delete(tokenId);
    }
  }
}
