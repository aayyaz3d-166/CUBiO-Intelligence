/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/studio/studioTypes
 * Specification: VIG Phase 9 — 3D Memory Studio Integration Preparation
 *
 * Versioned integration contract, data interchange schemas, and fault-tolerant
 * error models for external Studio integration.
 */
import { VIGError, } from '../types';
export const VIG_STUDIO_PROTOCOL_VERSION = '1.0.0';
// ── 6. Error Hierarchy ──────────────────────────────────────────────────────
export class VIGStudioError extends VIGError {
    statusCode;
    constructor(message, statusCode = 500) {
        super(`[VIG Studio Integration Error] ${message}`);
        this.name = 'VIGStudioError';
        this.statusCode = statusCode;
    }
}
export class VIGStudioValidationError extends VIGStudioError {
    constructor(message) {
        super(`Validation failed: ${message}`, 400);
        this.name = 'VIGStudioValidationError';
    }
}
export class VIGStudioTimeoutError extends VIGStudioError {
    constructor(operation, timeoutMs) {
        super(`Operation "${operation}" exceeded execution timeout of ${timeoutMs}ms`, 504);
        this.name = 'VIGStudioTimeoutError';
    }
}
export class VIGStudioUnavailableError extends VIGStudioError {
    constructor(message = 'VIG service is uninitialized or unavailable') {
        super(message, 503);
        this.name = 'VIGStudioUnavailableError';
    }
}
