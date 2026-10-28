import { CanonicalAddress369 } from '../address369_canonical';
import { VIGSecurityGuard } from '../vig/VIGSecurityGuard';
export const KNOWN_OPCODES = new Set([
    'CONST',
    'LOAD',
    'STORE',
    'MOVE',
    'ADD',
    'SUB',
    'MUL',
    'DIV',
    'MOD',
    'CMP',
    'EQ',
    'NE',
    'LT',
    'LTE',
    'GT',
    'GTE',
    'CALL',
    'RETURN',
    'JUMP',
    'JUMP_IF',
    'JUMP_IF_FALSE',
    'PRINT',
    'SPATIAL_OP',
    'FIELD_GET',
    'FIELD_SET',
    'INDEX_GET',
    'INDEX_SET',
    'MAKE_CLOSURE',
    'AWAIT',
]);
export class ExecutableValidator {
    /**
     * Validates a UnifiedIRProgram before packing or after unpacking.
     * Enforces fail-closed opcode integrity, Address369 boundaries, and actuation lockout.
     */
    static validate(program) {
        if (!program || typeof program !== 'object') {
            return {
                valid: false,
                errorCode: 'E8003',
                error: '[E8003: Validation Error] Executable program is null or malformed',
            };
        }
        if (!Array.isArray(program.instructions)) {
            return {
                valid: false,
                errorCode: 'E8003',
                error: '[E8003: Validation Error] Instructions stream is missing or not an array',
            };
        }
        // 1. Actuation Lockout Invariant Check
        if (program.declarativeMetadata?.actuationLock === false) {
            return {
                valid: false,
                errorCode: 'E8005',
                error: '[E8005: Safety Violation] Actuation lockout invariant violated: actuationLock is false',
            };
        }
        // 2. Validate Instructions
        for (let i = 0; i < program.instructions.length; i++) {
            const instr = program.instructions[i];
            // Opcode check
            if (!instr.opcode || !KNOWN_OPCODES.has(instr.opcode)) {
                return {
                    valid: false,
                    errorCode: 'E8007',
                    error: `[E8007: Validation Error] Unknown or corrupted opcode '${String(instr.opcode)}' at instruction index ${i}`,
                };
            }
            // Check for prohibited actuation keys in operands and metadata
            const checkActuation = (val) => {
                if (!val)
                    return false;
                if (typeof val === 'string') {
                    const lower = val.toLowerCase().replace(/[^a-z]/g, '');
                    return VIGSecurityGuard.PROHIBITED_ACTUATION_KEYS.some(k => lower.includes(k));
                }
                if (typeof val === 'object') {
                    for (const k of Object.keys(val)) {
                        const lower = k.toLowerCase().replace(/[^a-z]/g, '');
                        if (VIGSecurityGuard.PROHIBITED_ACTUATION_KEYS.some(pk => lower.includes(pk))) {
                            return true;
                        }
                        if (checkActuation(val[k]))
                            return true;
                    }
                }
                return false;
            };
            if (instr.destination && checkActuation(instr.destination.value)) {
                return {
                    valid: false,
                    errorCode: 'E8005',
                    error: `[E8005: Safety Violation] Prohibited physical actuation command in destination at instruction ${i}`,
                };
            }
            for (const src of instr.sources) {
                if (checkActuation(src.value)) {
                    return {
                        valid: false,
                        errorCode: 'E8005',
                        error: `[E8005: Safety Violation] Prohibited physical actuation command in source operand at instruction ${i}`,
                    };
                }
            }
            // 3. Address369 Boundary Check
            const checkAddress = (op) => {
                if (!op)
                    return { valid: true };
                if (op.kind === 'spatial_payload' && typeof op.value === 'object' && op.value !== null) {
                    const payload = op.value;
                    if (typeof payload.address === 'number') {
                        const addr = payload.address;
                        if (addr < 0 || addr >= CanonicalAddress369.TOTAL_ADDRESSES) {
                            return { valid: false, address: addr };
                        }
                    }
                }
                if (op.type === 'address369' && typeof op.value === 'number') {
                    if (op.value < 0 || op.value >= CanonicalAddress369.TOTAL_ADDRESSES) {
                        return { valid: false, address: op.value };
                    }
                }
                return { valid: true };
            };
            const destAddr = checkAddress(instr.destination);
            if (!destAddr.valid) {
                return {
                    valid: false,
                    errorCode: 'E8006',
                    error: `[E8006: Boundary Violation] Address369 index ${destAddr.address} is outside canonical range [0..368] at instruction ${i}`,
                };
            }
            for (const src of instr.sources) {
                const srcAddr = checkAddress(src);
                if (!srcAddr.valid) {
                    return {
                        valid: false,
                        errorCode: 'E8006',
                        error: `[E8006: Boundary Violation] Address369 index ${srcAddr.address} is outside canonical range [0..368] at instruction ${i}`,
                    };
                }
            }
        }
        return { valid: true };
    }
}
