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

export type NativeErrorCode =
  | 'E7001' // Division or Modulo by Zero
  | 'E7002' // Unknown Opcode or Invalid Instruction
  | 'E7003' // Type Mismatch
  | 'E7004' // Undefined Variable / Identifier / Register
  | 'E7005' // Undefined Function / Non-Callable Invocation
  | 'E7006' // Maximum Call Depth Exceeded (Stack Overflow)
  | 'E7007' // Maximum Instruction Quota Exceeded (Infinite Loop)
  | 'E7008' // Out of Bounds Array Access
  | 'E7009' // Field Not Found on Record
  | 'E7010' // Actuation Lock Violation (Fail-Closed Hardware Guard)
  | 'E7011' // Memory Ceiling Exceeded (RSS Guard Breach)
  | 'E7012' // Spatial Coordinate Out of Bounds
  | 'E7013' // Canonical Address Out of Bounds
  | 'E7014'; // Security Sandbox Violation

export interface NativeErrorDescriptor {
  code: NativeErrorCode;
  category: 'ARITHMETIC' | 'TYPE' | 'LOOKUP' | 'RESOURCE' | 'SECURITY' | 'SPATIAL';
  description: string;
}

export const ERROR_CATALOG: Record<NativeErrorCode, NativeErrorDescriptor> = {
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
  public readonly code: NativeErrorCode;
  public readonly pc: number;
  public readonly callStack: string[];
  public readonly timestamp: number;
  public readonly failClosed: boolean = true;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: NativeErrorCode,
    message: string,
    pc: number = 0,
    callStack: string[] = [],
    details?: Record<string, unknown>
  ) {
    super(`[${code}] at PC ${pc}: ${message}`);
    this.name = 'OneNativeRuntimeError';
    this.code = code;
    this.pc = pc;
    this.callStack = [...callStack];
    this.timestamp = Date.now();
    this.details = details;
  }

  public getDescriptor(): NativeErrorDescriptor {
    return ERROR_CATALOG[this.code];
  }

  public toJSON(): Record<string, unknown> {
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
