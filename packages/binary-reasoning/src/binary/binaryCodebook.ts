/**
 * ONE Language — 3/6/9-Bit Binary Language System
 * Module: Machine-Readable Binary Codebook (src/binary/binaryCodebook.ts)
 */

import { BitCategory, TriangleOpcode, BinaryError } from './types.js';
import { CanonicalAddress369 } from '../shared/address369.js';

export interface CodebookEntry3Bit {
  pattern: string;
  category: BitCategory;
  name: string;
  description: string;
}

export interface CodebookEntry6Bit {
  code: number;
  pattern: string;
  mnemonic?: string;
  opcode?: TriangleOpcode;
  quartile: 0 | 1 | 2 | 3;
  status: 'ASSIGNED' | 'RESERVED';
  description: string;
}

export interface CodebookEntry9Bit {
  code: number;
  pattern: string;
  layer: 'SYMBOLIC' | 'SPATIAL' | 'RESERVED';
  displayIndex?: number;
  coord?: { i: number; j: number; k: number };
  status: 'ASSIGNED' | 'RESERVED';
}

export class BinaryCodebook {
  // ── 3-Bit Code Space (Exactly 8 Patterns) ──────────────────────────────────
  public static readonly TABLE_3BIT: CodebookEntry3Bit[] = [
    { pattern: '000', category: BitCategory.TYPE_NULL, name: 'TYPE_NULL', description: 'Null value / padding' },
    { pattern: '001', category: BitCategory.TYPE_BOOL, name: 'TYPE_BOOL', description: 'Boolean value (0=false, 1=true)' },
    { pattern: '010', category: BitCategory.TYPE_INT, name: 'TYPE_INT', description: 'Signed variable-length integer' },
    { pattern: '011', category: BitCategory.TYPE_FLOAT, name: 'TYPE_FLOAT', description: 'IEEE 754 64-bit float' },
    { pattern: '100', category: BitCategory.TYPE_TEXT, name: 'TYPE_TEXT', description: 'UTF-8 string stream' },
    { pattern: '101', category: BitCategory.TYPE_ADDR369, name: 'TYPE_ADDR369', description: 'Canonical Address369 pointer' },
    { pattern: '110', category: BitCategory.TYPE_OPCODE, name: 'TYPE_OPCODE', description: '6-bit triangle opcode' },
    { pattern: '111', category: BitCategory.TYPE_CONTROL, name: 'TYPE_CONTROL', description: 'Stream framing and control' },
  ];

  // ── 6-Bit Code Space (Exactly 64 Patterns) ─────────────────────────────────
  public static readonly TABLE_6BIT: CodebookEntry6Bit[] = [];

  // ── 9-Bit Code Space (Exactly 512 Patterns) ────────────────────────────────
  public static readonly TABLE_9BIT: CodebookEntry9Bit[] = [];

  static {
    // Populate 6-bit table
    const opcodeNames: Record<number, string> = {
      0x00: 'OP_NOP', 0x01: 'OP_HALT', 0x02: 'OP_READ', 0x03: 'OP_WRITE',
      0x04: 'OP_INSPECT', 0x05: 'OP_PUSH', 0x06: 'OP_POP', 0x07: 'OP_SWAP',
      0x08: 'OP_ADD', 0x09: 'OP_SUB', 0x0a: 'OP_MUL', 0x0b: 'OP_DIV',
      0x0c: 'OP_MOD', 0x0d: 'OP_EQ', 0x0e: 'OP_LT', 0x0f: 'OP_GT',
      0x10: 'OP_JUMP', 0x11: 'OP_JUMP_IF', 0x12: 'OP_CALL', 0x13: 'OP_RET',
      0x14: 'OP_SHELL_ALLOC', 0x15: 'OP_ENTROPY_EVAL', 0x16: 'OP_LOCK_CHECK', 0x17: 'OP_BARRIER',
      0x3e: 'MARKER_ESCAPE', 0x3f: 'MARKER_EOS',
    };

    for (let c = 0; c < 64; c++) {
      const pattern = c.toString(2).padStart(6, '0');
      const quartile = Math.floor(c / 16) as 0 | 1 | 2 | 3;
      const mnemonic = opcodeNames[c];
      const isAssigned = mnemonic !== undefined;

      BinaryCodebook.TABLE_6BIT.push({
        code: c,
        pattern,
        mnemonic,
        opcode: isAssigned ? (c as TriangleOpcode) : undefined,
        quartile,
        status: isAssigned ? 'ASSIGNED' : 'RESERVED',
        description: isAssigned ? `Instruction ${mnemonic}` : `Reserved 6-bit pattern ${pattern}`,
      });
    }

    // Populate 9-bit table
    for (let a = 0; a < 512; a++) {
      const pattern = a.toString(2).padStart(9, '0');
      if (a < CanonicalAddress369.TOTAL_ADDRESSES) {
        // Within valid Canonical Address369 space [0..368]
        const info = CanonicalAddress369.inspectAddress(a);
        BinaryCodebook.TABLE_9BIT.push({
          code: a,
          pattern,
          layer: info.layer,
          displayIndex: info.displayIndex,
          coord: info.spatialCoord ? { i: info.spatialCoord.i, j: info.spatialCoord.j, k: info.spatialCoord.k } : undefined,
          status: 'ASSIGNED',
        });
      } else {
        // Out of bounds reserved address [369..511]
        BinaryCodebook.TABLE_9BIT.push({
          code: a,
          pattern,
          layer: 'RESERVED',
          status: 'RESERVED',
        });
      }
    }
  }

  // ── Lookup Methods ─────────────────────────────────────────────────────────

  public static lookup3Bit(pattern: string): CodebookEntry3Bit {
    const entry = this.TABLE_3BIT.find((e) => e.pattern === pattern);
    if (!entry) {
      throw new BinaryError('INVALID_3BIT_PATTERN', `Pattern '${pattern}' is not a valid 3-bit code`);
    }
    return entry;
  }

  public static lookup6Bit(code: number): CodebookEntry6Bit {
    if (!Number.isInteger(code) || code < 0 || code > 63) {
      throw new BinaryError('INVALID_6BIT_CODE', `Code ${code} is outside 6-bit range [0..63]`);
    }
    return this.TABLE_6BIT[code];
  }

  public static lookup9Bit(code: number): CodebookEntry9Bit {
    if (!Number.isInteger(code) || code < 0 || code > 511) {
      throw new BinaryError('INVALID_9BIT_CODE', `Code ${code} is outside 9-bit range [0..511]`);
    }
    return this.TABLE_9BIT[code];
  }
}
