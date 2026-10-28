/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/agentic/VIGRepresentativeAgent
 * Specification: VIG Phase 11 — Agentic AI Integration
 *
 * Representative Code Intelligence & Verification Agent operating under
 * strict least-privilege, prompt-injection defense, 4-tier verification,
 * and declarative proposal separation.
 */

import * as crypto from 'crypto';
import { VIGSecurityContext } from '../types';
import {
  AgenticConclusion,
  AgenticProposal,
  ProposedTestPlan,
  DeclarativeAction,
  ProposedTestSuite,
} from './agenticTypes';
import { VIGAgenticAdapter } from './VIGAgenticAdapter';
import { VIGPromptSanitizer } from './VIGPromptSanitizer';

export interface AgentOptions {
  readonly agentId?: string;
}

export class VIGRepresentativeAgent {
  public readonly agentId: string;
  public readonly securityContext: VIGSecurityContext;

  private readonly adapter: VIGAgenticAdapter;

  constructor(adapter: VIGAgenticAdapter, options: AgentOptions = {}) {
    this.adapter = adapter;
    this.agentId = options.agentId ?? 'representative-vig-agent-01';
    this.securityContext = Object.freeze({
      role: 'ANALYZER_AGENT',
      agentId: this.agentId,
    });
  }

  // ── 1. Target Module Analysis & Bound Conclusion ───────────────────────────

  /**
   * Evaluates a target module or symbol, returning a cryptographically bound conclusion.
   * Strictly distinguishes VERIFIED_PASS, STALE, FAILED, and UNVERIFIED.
   */
  public async analyzeModule(
    targetPath: string,
    rawSource?: string,
    requireVerified: boolean = false
  ): Promise<AgenticConclusion> {
    const contextResult = await this.adapter.queryVerifiedContextForAgent(
      targetPath,
      undefined,
      requireVerified,
      this.securityContext
    );

    // Sanitize source text to defend against prompt injection
    const sanitized = rawSource ? VIGPromptSanitizer.sanitizeSourceContent(rawSource, contextResult.node?.cid) : null;

    const findings: string[] = [];
    const warnings: string[] = [...contextResult.warnings];
    let confidence: 'HIGH' | 'LOW' | 'UNVERIFIED' = 'HIGH';
    let summary = '';

    // Enforce 4-tier verification distinction
    switch (contextResult.verificationStatus) {
      case 'VERIFIED_PASS':
        confidence = 'HIGH';
        summary = `Module "${targetPath}" is cryptographically verified (VERIFIED_PASS) at commit ${contextResult.boundCommitSha.substring(0, 8)}.`;
        findings.push('All unit test suites and TypeScript typechecks passed with 0 errors.');
        findings.push(`Direct forward dependencies verified: ${contextResult.dependencies.length}.`);
        findings.push(`Direct backward dependents verified: ${contextResult.dependents.length}.`);
        break;

      case 'STALE':
        confidence = 'LOW';
        summary = `Module "${targetPath}" has STALE verification evidence at commit ${contextResult.boundCommitSha.substring(0, 8)}.`;
        findings.push('Evidence is STALE: uncommitted working-tree modifications detected or evidence commit does not match Git HEAD.');
        findings.push('Recommendations based on this module are advisory and require re-running tests.');
        warnings.push('STALE EVIDENCE: Working tree or commit differs from test verification snapshot.');
        break;

      case 'FAILED':
        confidence = 'LOW';
        summary = `Module "${targetPath}" has FAILED verification evidence.`;
        findings.push('Underlying test suite or TypeScript compilation failed during the last verification evaluation.');
        findings.push('Action required: resolve failing checks before making consequential decisions.');
        warnings.push('FAILED VERIFICATION: Regressions or syntax errors present in last test run.');
        break;

      case 'UNVERIFIED':
      default:
        confidence = 'UNVERIFIED';
        summary = `Module "${targetPath}" is currently UNVERIFIED.`;
        findings.push('Zero verification evidence exists for this module or snapshot.');
        findings.push('No tests or typechecks have been registered for this commit anchor.');
        warnings.push('UNVERIFIED: No test execution evidence exists.');
        break;
    }

    if (sanitized?.injectionAttemptDetected) {
      warnings.push(`PROMPT INJECTION DEFENSE: Detected adversarial signatures (${sanitized.detectedSignatures.join(', ')}). Content was neutralized.`);
      findings.push('Untrusted source code contained prompt injection payloads which were safely neutralized.');
    }

    const payload = `${this.agentId}:${targetPath}:${contextResult.boundCommitSha}:${contextResult.graphRootSeal}:${contextResult.verificationStatus}`;
    const conclusionId = crypto.createHash('sha256').update(payload).digest('hex').substring(0, 16);

    const conclusion: AgenticConclusion = Object.freeze({
      conclusionId,
      agentId: this.agentId,
      targetPath,
      symbolName: undefined,
      boundCommitSha: contextResult.boundCommitSha,
      graphRootSeal: contextResult.graphRootSeal,
      evidenceId: contextResult.evidenceId,
      verificationStatus: contextResult.verificationStatus,
      isStale: contextResult.isStale,
      confidence,
      summary,
      findings: Object.freeze(findings),
      warnings: Object.freeze(warnings),
      timestamp: Date.now(),
    });

    return conclusion;
  }

  // ── 2. Change Impact Evaluation & Test Plan Proposal ───────────────────────

  /**
   * Proposes relevant test suites for prospective changes without claiming unrun tests passed.
   */
  public async evaluateChangeImpact(
    changedPaths: readonly string[],
    requireVerified: boolean = false
  ): Promise<{ testPlan: ProposedTestPlan; proposal: AgenticProposal }> {
    const impactResult = await this.adapter.queryDependencyImpactForAgent(
      changedPaths,
      undefined,
      requireVerified,
      this.securityContext
    );

    // Formulate proposed test suites with strict PENDING_EXECUTION invariant
    const proposedSuites: ProposedTestSuite[] = impactResult.requiredTestSuites.map((suitePath) => ({
      suitePath,
      executionStatus: 'PENDING_EXECUTION', // INVARIANT: Never claimed to have passed
      reason: `Direct or transitive dependency impacted by changes in [${changedPaths.join(', ')}]`,
    }));

    const planPayload = `${this.agentId}:${changedPaths.join(',')}:${impactResult.boundCommitSha}`;
    const planId = crypto.createHash('sha256').update(planPayload).digest('hex').substring(0, 16);

    const testPlan: ProposedTestPlan = Object.freeze({
      planId,
      changedPaths: Object.freeze([...changedPaths]),
      affectedModuleCount: impactResult.affectedModules.length,
      isPublicApiBreached: impactResult.isPublicApiBreached,
      requiredTestSuites: Object.freeze(proposedSuites),
      rationale: `Dependency impact traversal identified ${impactResult.affectedModules.length} affected modules requiring ${proposedSuites.length} test suites.`,
      boundCommitSha: impactResult.boundCommitSha,
      graphRootSeal: impactResult.graphRootSeal,
    });

    // Construct non-executable declarative actions
    const suggestedActions: DeclarativeAction[] = proposedSuites.map((s) => ({
      actionType: 'RUN_TEST_SUITE',
      target: s.suitePath,
      description: `Execute required test suite ${s.suitePath} to verify prospective changes`,
      parameters: { changedPaths, requireCleanExit: true },
      isMutating: false,
    }));

    if (suggestedActions.length === 0) {
      suggestedActions.push({
        actionType: 'TRIGGER_COMPILATION',
        target: changedPaths[0] ?? 'repo',
        description: 'Verify compilation integrity for prospective changes',
        parameters: { changedPaths },
        isMutating: false,
      });
    }

    const proposalPayload = `proposal:${planId}:${Date.now()}`;
    const proposalId = crypto.createHash('sha256').update(proposalPayload).digest('hex').substring(0, 16);

    const proposal: AgenticProposal = Object.freeze({
      proposalId,
      agentId: this.agentId,
      proposalType: 'TEST_PLAN',
      title: `Required Test Execution Plan for [${changedPaths.join(', ')}]`,
      description: `Impact evaluation identified ${proposedSuites.length} test suites that MUST be executed before changes can be accepted.`,
      recommendations: Object.freeze([
        `Execute all ${proposedSuites.length} proposed test suites.`,
        impactResult.isPublicApiBreached
          ? 'PUBLIC API BREACH: Public contracts were modified; coordinate with downstream consumers.'
          : 'Changes are isolated to private implementations.',
      ]),
      suggestedActions: Object.freeze(suggestedActions),
      requiresApproval: true,
      status: 'PROPOSED',
      boundCommitSha: impactResult.boundCommitSha,
      verificationStatus: impactResult.verificationStatus,
      createdAt: Date.now(),
    });

    // Record proposal submission in audit ledger
    this.adapter.recordAuditManual({
      recordId: `prop-${Date.now()}`,
      timestamp: Date.now(),
      agentId: this.agentId,
      role: this.securityContext.role,
      operation: 'submitProposal',
      outcome: 'SUCCESS',
      statusCode: 200,
      durationMs: 0,
      boundCommitSha: impactResult.boundCommitSha,
      proposalId,
      details: { changedPathsCount: changedPaths.length, requiredSuitesCount: proposedSuites.length },
    });

    return { testPlan, proposal };
  }

  // ── 3. Propose Refactoring or Consequential Action ──────────────────────────

  /**
   * Generates a declarative proposal for code modifications.
   * Does NOT execute the modifications; requires explicit approval gate authorization.
   */
  public async proposeRemediation(
    targetPath: string,
    rationale: string,
    proposedModifications: string
  ): Promise<AgenticProposal> {
    // Sanitize proposed modifications for prompt injection
    const sanitized = VIGPromptSanitizer.sanitizeSourceContent(proposedModifications);

    const anchor = await this.adapter.getProvenanceAnchorForAgent(this.securityContext);

    const action: DeclarativeAction = {
      actionType: 'UPDATE_SOURCE',
      target: targetPath,
      description: `Apply proposed remediation: ${rationale}`,
      parameters: {
        targetPath,
        contentHash: crypto.createHash('sha256').update(proposedModifications).digest('hex'),
        injectionWarning: sanitized.injectionAttemptDetected,
      },
      isMutating: true,
    };

    const payload = `remediation:${targetPath}:${anchor.commitSha}:${Date.now()}`;
    const proposalId = crypto.createHash('sha256').update(payload).digest('hex').substring(0, 16);

    const proposal: AgenticProposal = Object.freeze({
      proposalId,
      agentId: this.agentId,
      proposalType: 'REFACTOR_RECOMMENDATION',
      title: `Proposed Code Remediation for ${targetPath}`,
      description: rationale,
      recommendations: Object.freeze([
        'Review declarative action parameters prior to granting approval token.',
        sanitized.injectionAttemptDetected
          ? 'CAUTION: Proposed content contained neutralized injection patterns.'
          : 'Content verified clean of known injection patterns.',
      ]),
      suggestedActions: Object.freeze([action]),
      requiresApproval: true,
      status: 'PROPOSED',
      boundCommitSha: anchor.commitSha,
      verificationStatus: 'UNVERIFIED',
      createdAt: Date.now(),
    });

    return proposal;
  }
}
