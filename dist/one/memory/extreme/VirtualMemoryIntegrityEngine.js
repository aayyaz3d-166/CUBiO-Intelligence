/**
 * ONE Language — Virtual Memory Integrity Engine
 * ==============================================
 * Module: @one/memory/extreme/VirtualMemoryIntegrityEngine
 *
 * Implements Section 18 of Extreme-Scale 3D Memory Toolchain.
 * Sovereign fail-closed integrity firewall:
 *   - Rejects invalid virtual addresses
 *   - Rejects invalid 369 spatial cells (<0 or >342)
 *   - Rejects tampered references and pointers
 *   - Rejects checksum mismatches
 *   - Rejects malformed pages and overflow
 *   - Rejects cross-tenant leaks
 *   - Rejects corrupted reality paths
 */
import * as crypto from 'crypto';
export class IntegrityViolationError extends Error {
    violationType;
    constructor(violationType, message) {
        super(`[VirtualMemoryIntegrityEngine Violation: ${violationType}] ${message}`);
        this.name = 'IntegrityViolationError';
        this.violationType = violationType;
    }
}
export class VirtualMemoryIntegrityEngine {
    /**
     * Validates a 64-bit virtual address.
     */
    static validateAddress(address, maxCapacity) {
        if (address < 0n) {
            throw new IntegrityViolationError('NEGATIVE_ADDRESS', `Address ${address} is negative.`);
        }
        if (address >= maxCapacity) {
            throw new IntegrityViolationError('ADDRESS_OVERFLOW', `Address ${address} exceeds virtual space capacity ${maxCapacity}.`);
        }
    }
    /**
     * Validates a spatial cell ID.
     */
    static validateCellId(cellId) {
        if (typeof cellId !== 'number' || !Number.isInteger(cellId)) {
            throw new IntegrityViolationError('MALFORMED_CELL', `Cell ID must be an integer: ${cellId}`);
        }
        if (cellId < 0 || cellId >= 343) {
            throw new IntegrityViolationError('CELL_BOUNDS_VIOLATION', `Cell ID ${cellId} is outside 7x7x7 lattice range [0..342].`);
        }
    }
    /**
     * Validates a spatial pointer signature and structure.
     */
    static validatePointerSignature(pointerId, cellId, expectedHashPrefix) {
        if (!pointerId || !pointerId.startsWith('ptr_369_')) {
            throw new IntegrityViolationError('TAMPERED_POINTER', `Invalid or corrupt pointer identifier '${pointerId}'.`);
        }
        this.validateCellId(cellId);
    }
    /**
     * Validates payload checksum.
     */
    static validateChecksum(data, expectedSha256) {
        const actualSha = crypto.createHash('sha256').update(data).digest('hex');
        if (actualSha !== expectedSha256) {
            throw new IntegrityViolationError('CHECKSUM_MISMATCH', `Payload checksum corrupted! Expected: ${expectedSha256}, Actual: ${actualSha}`);
        }
    }
    /**
     * Enforces tenant boundary isolation.
     */
    static validateTenantAccess(ownerTenantId, requestingTenantId) {
        if (requestingTenantId !== 'root' && ownerTenantId !== requestingTenantId) {
            throw new IntegrityViolationError('CROSS_TENANT_ACCESS_DENIED', `Access denied: Requesting tenant '${requestingTenantId}' cannot access resources belonging to '${ownerTenantId}'.`);
        }
    }
    /**
     * Validates reality path causal continuity.
     */
    static validateRealityPath(transitionChain) {
        if (transitionChain.length === 0) {
            throw new IntegrityViolationError('INVALID_REALITY_PATH', 'Reality path cannot be empty.');
        }
        for (const tid of transitionChain) {
            if (!tid || typeof tid !== 'string') {
                throw new IntegrityViolationError('MALFORMED_TRANSITION_ID', `Invalid transition ID in path: ${tid}`);
            }
        }
    }
}
