/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/agentic/agenticTypes
 * Specification: VIG Phase 11 — Agentic AI Integration
 *
 * Least-privilege agentic integration schemas, conclusion models,
 * declarative proposals, approval tokens, and security error hierarchy.
 */
import { VIGError, } from '../types';
export const VIG_AGENTIC_PROTOCOL_VERSION = '1.0.0';
// ── 7. Error Hierarchy ───────────────────────────────────────────────────────
export class VIGAgenticError extends VIGError {
    statusCode;
    constructor(message, statusCode = 500) {
        super(`[VIG Agentic Integration Error] ${message}`);
        this.name = 'VIGAgenticError';
        this.statusCode = statusCode;
    }
}
export class VIGAgenticValidationError extends VIGAgenticError {
    constructor(message) {
        super(`Validation failed: ${message}`, 400);
        this.name = 'VIGAgenticValidationError';
    }
}
export class VIGAgenticApprovalRequiredError extends VIGAgenticError {
    constructor(proposalId, reason = 'Consequential action requires explicit approval token') {
        super(`Approval required for proposal "${proposalId}": ${reason}`, 403);
        this.name = 'VIGAgenticApprovalRequiredError';
    }
}
export class VIGAgenticSecurityError extends VIGAgenticError {
    constructor(message) {
        super(`Security policy violation: ${message}`, 403);
        this.name = 'VIGAgenticSecurityError';
    }
}
export class VIGAgenticUnverifiedError extends VIGAgenticError {
    constructor(status, target) {
        super(`Agent context rejected: verification status is "${status}" for "${target}".`, 412);
        this.name = 'VIGAgenticUnverifiedError';
    }
}
export class VIGAgenticStaleEvidenceError extends VIGAgenticError {
    constructor(reason) {
        super(`Agent context rejected because evidence is STALE: ${reason}`, 409);
        this.name = 'VIGAgenticStaleEvidenceError';
    }
}
export class VIGAgenticTimeoutError extends VIGAgenticError {
    constructor(operation, timeoutMs) {
        super(`Agent operation "${operation}" exceeded execution budget of ${timeoutMs}ms`, 504);
        this.name = 'VIGAgenticTimeoutError';
    }
}
export class VIGAgenticDisabledError extends VIGAgenticError {
    constructor(reason = 'Agentic integration is currently DISABLED or rolled back') {
        super(reason, 503);
        this.name = 'VIGAgenticDisabledError';
    }
}
export class VIGAgenticUnavailableError extends VIGAgenticError {
    constructor(message = 'VIG service is uninitialized or unavailable') {
        super(message, 503);
        this.name = 'VIGAgenticUnavailableError';
    }
}
export class VIGAgenticRateLimitError extends VIGAgenticError {
    constructor(message = 'Agent request rate limit or concurrency quota exceeded') {
        super(message, 429);
        this.name = 'VIGAgenticRateLimitError';
    }
}
