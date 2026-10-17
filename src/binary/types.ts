/**
 * ONE Language — 3/6/9-Bit Binary Language System
 * Module: Types & Interfaces (src/binary/types.ts)
 */

export enum BitCategory {
  TYPE_NULL = 0b000,      // 0
  TYPE_BOOL = 0b001,      // 1
  TYPE_INT = 0b010,       // 2
  TYPE_FLOAT = 0b011,     // 3
  TYPE_TEXT = 0b100,      // 4
  TYPE_ADDR369 = 0b101,   // 5
  TYPE_OPCODE = 0b110,    // 6
  TYPE_CONTROL = 0b111,   // 7
}

export enum TriangleOpcode {
  // Quartile 0: Core Operations
  OP_NOP = 0x00,
  OP_HALT = 0x01,
  OP_READ = 0x02,
  OP_WRITE = 0x03,
  OP_INSPECT = 0x04,
  OP_PUSH = 0x05,
  OP_POP = 0x06,
  OP_SWAP = 0x07,
  OP_ADD = 0x08,
  OP_SUB = 0x09,
  OP_MUL = 0x0a,
  OP_DIV = 0x0b,
  OP_MOD = 0x0c,
  OP_EQ = 0x0d,
  OP_LT = 0x0e,
  OP_GT = 0x0f,

  // Quartile 1: Control & Spatial Routing
  OP_JUMP = 0x10,
  OP_JUMP_IF = 0x11,
  OP_CALL = 0x12,
  OP_RET = 0x13,
  OP_SHELL_ALLOC = 0x14,
  OP_ENTROPY_EVAL = 0x15,
  OP_LOCK_CHECK = 0x16,
  OP_BARRIER = 0x17,

  // Quartile 3: Markers
  MARKER_ESCAPE = 0x3e,
  MARKER_EOS = 0x3f,
}

export interface TrianglePositions {
  c1: 0 | 1; // Corner 1 (Apex)
  e1: 0 | 1; // Edge 1 (Left slant)
  c2: 0 | 1; // Corner 2 (Bottom-Left)
  e2: 0 | 1; // Edge 2 (Base)
  c3: 0 | 1; // Corner 3 (Bottom-Right)
  e3: 0 | 1; // Edge 3 (Right slant)
}

export type SupportedBinaryValue =
  | null
  | boolean
  | number
  | string
  | { kind: 'address369'; address: number }
  | { kind: 'opcode'; opcode: TriangleOpcode };

export class BinaryError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(`[BinaryError ${code}] ${message}`);
    this.name = 'BinaryError';
    this.code = code;
  }
}
