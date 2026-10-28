/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/types
 * Specification: VIG Phase 1 Minimal Architecture Design (Gate VIG-01)
 *
 * Core type definitions, node schemas, edge relations, and error classes
 * for native content-addressed intelligence graph operations.
 */
// ── Error Classes ───────────────────────────────────────────────────────────
export class VIGError extends Error {
    constructor(message) {
        super(message);
        this.name = 'VIGError';
    }
}
export class VIGValidationError extends VIGError {
    constructor(message) {
        super(`[VIG Validation Error] ${message}`);
        this.name = 'VIGValidationError';
    }
}
export class VIGConflictError extends VIGError {
    constructor(message) {
        super(`[VIG Conflict Error] ${message}`);
        this.name = 'VIGConflictError';
    }
}
export class VIGIntegrityError extends VIGError {
    constructor(message) {
        super(`[VIG Integrity Error] ${message}`);
        this.name = 'VIGIntegrityError';
    }
}
export class VIGAccessDeniedError extends VIGError {
    constructor(message) {
        super(`[VIG Access Denied Error] ${message}`);
        this.name = 'VIGAccessDeniedError';
    }
}
export class VIGSecurityError extends VIGError {
    constructor(message) {
        super(`[VIG Security Error] ${message}`);
        this.name = 'VIGSecurityError';
    }
}
export class VIGLockError extends VIGConflictError {
    constructor(message) {
        super(`[VIG Lock Error] ${message}`);
        this.name = 'VIGLockError';
    }
}
