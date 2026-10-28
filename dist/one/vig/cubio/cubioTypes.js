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
import { VIGError, } from '../types';
export const VIG_CUBIO_PROTOCOL_VERSION = '1.0.0';
// ── 6. Error Hierarchy ───────────────────────────────────────────────────────
export class VIGCUBiOError extends VIGError {
    statusCode;
    constructor(message, statusCode = 500) {
        super(`[VIG CUBiO Integration Error] ${message}`);
        this.name = 'VIGCUBiOError';
        this.statusCode = statusCode;
    }
}
export class VIGCUBiOValidationError extends VIGCUBiOError {
    constructor(message) {
        super(`Validation failed: ${message}`, 400);
        this.name = 'VIGCUBiOValidationError';
    }
}
export class VIGCUBiOIncompatibleVersionError extends VIGCUBiOError {
    constructor(clientVersion, expectedVersion) {
        super(`Client requested incompatible protocol version "${clientVersion}". Expected "${expectedVersion}".`, 400);
        this.name = 'VIGCUBiOIncompatibleVersionError';
    }
}
export class VIGCUBiOUnverifiedError extends VIGCUBiOError {
    constructor(status, target) {
        super(`Context verification required but verification status is "${status}" for target "${target}".`, 412);
        this.name = 'VIGCUBiOUnverifiedError';
    }
}
export class VIGCUBiOStaleEvidenceError extends VIGCUBiOError {
    constructor(reason) {
        super(`Context rejected because verification evidence is STALE: ${reason}`, 409);
        this.name = 'VIGCUBiOStaleEvidenceError';
    }
}
export class VIGCUBiOCorruptedDataError extends VIGCUBiOError {
    constructor(message) {
        super(`Integrity verification failed: ${message}`, 500);
        this.name = 'VIGCUBiOCorruptedDataError';
    }
}
export class VIGCUBiOTimeoutError extends VIGCUBiOError {
    constructor(operation, timeoutMs) {
        super(`Operation "${operation}" exceeded execution timeout of ${timeoutMs}ms`, 504);
        this.name = 'VIGCUBiOTimeoutError';
    }
}
export class VIGCUBiODisabledError extends VIGCUBiOError {
    constructor(reason = 'VIG CUBiO adapter is currently DISABLED or rolled back') {
        super(reason, 503);
        this.name = 'VIGCUBiODisabledError';
    }
}
export class VIGCUBiOUnavailableError extends VIGCUBiOError {
    constructor(message = 'VIG service is uninitialized or unavailable') {
        super(message, 503);
        this.name = 'VIGCUBiOUnavailableError';
    }
}
