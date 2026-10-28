/**
 * ONE Language — Native Runtime Error Catalog
 * ===========================================
 * Module: @one/runtime/NativeErrors
 *
 * Formal error catalog, diagnostic reporting, and fail-closed panic handling.
 *
 * Invariants:
 *   - Error codes mapped deterministically (E7000 series with legacy E5000 aliases)
 *   - Fail-closed invariant: execution terminates with PC attribution
 *   - Zero undefined behavior
 */
export const ERROR_CATALOG = {
    E7001: {
        code: 'E7001',
        category: 'ARITHMETIC',
        description: 'Division or modulo by zero is undefined',
    },
    E7002: {
        code: 'E7002',
        category: 'RESOURCE',
        description: 'Unknown opcode or corrupted instruction encountered in bytecode stream',
    },
    E7003: {
        code: 'E7003',
        category: 'TYPE',
        description: 'Operand type does not match expected signature for operation',
    },
    E7004: {
        code: 'E7004',
        category: 'LOOKUP',
        description: 'Attempt to read an uninitialized or undeclared identifier/register',
    },
    E7005: {
        code: 'E7005',
        category: 'LOOKUP',
        description: 'Target symbol is undefined or cannot be invoked as a callable function',
    },
    E7006: {
        code: 'E7006',
        category: 'RESOURCE',
        description: 'Call stack depth exceeded runtime limit (maximum 512 frames)',
    },
    E7007: {
        code: 'E7007',
        category: 'RESOURCE',
        description: 'Instruction execution quota exceeded (maximum 1,000,000 instructions)',
    },
    E7008: {
        code: 'E7008',
        category: 'LOOKUP',
        description: 'Array index is out of bounds',
    },
    E7009: {
        code: 'E7009',
        category: 'LOOKUP',
        description: 'Requested property or field does not exist on target record',
    },
    E7010: {
        code: 'E7010',
        category: 'SECURITY',
        description: 'Hardware mutation attempted while fail-closed actuation lock is active',
    },
    E7011: {
        code: 'E7011',
        category: 'RESOURCE',
        description: 'Memory allocation exceeded configured RSS Guard ceiling (< 512 MB)',
    },
    E7012: {
        code: 'E7012',
        category: 'SPATIAL',
        description: 'Spatial coordinates exceed 7x7x7 lattice discrete grid bounds [0..6]',
    },
    E7013: {
        code: 'E7013',
        category: 'SPATIAL',
        description: 'Address exceeds canonical Address369 boundary range [0..368]',
    },
    E7014: {
        code: 'E7014',
        category: 'SECURITY',
        description: 'Unauthorized host escape or unsandboxed I/O access attempted',
    },
};
export class OneNativeRuntimeError extends Error {
    code;
    pc;
    callStack;
    timestamp;
    failClosed = true;
    details;
    constructor(code, message, pc = 0, callStack = [], details) {
        super(`[${code}] at PC ${pc}: ${message}`);
        this.name = 'OneNativeRuntimeError';
        this.code = code;
        this.pc = pc;
        this.callStack = [...callStack];
        this.timestamp = Date.now();
        this.details = details;
    }
    getDescriptor() {
        return ERROR_CATALOG[this.code];
    }
    toJSON() {
        return {
            error: this.name,
            code: this.code,
            message: this.message,
            pc: this.pc,
            callStack: this.callStack,
            failClosed: this.failClosed,
            details: this.details,
        };
    }
}
