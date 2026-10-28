/**
 * ONE Language — 3/6/9-Bit Binary Language System
 * Module: Triangle Geometric Mapper (src/binary/triangleMapper.ts)
 */

import { TrianglePositions, BinaryError } from './types.js';

export class TriangleMapper {
  /**
   * Converts a 6-bit integer (0..63) to its canonical 6 geometric triangle positions.
   * Bit 0 (MSB) -> Corner 1 (Apex)
   * Bit 1       -> Edge 1 (Left slant)
   * Bit 2       -> Corner 2 (Bottom-Left)
   * Bit 3       -> Edge 2 (Base)
   * Bit 4       -> Corner 3 (Bottom-Right)
   * Bit 5 (LSB) -> Edge 3 (Right slant)
   */
  public static codeToPositions(code: number): TrianglePositions {
    if (!Number.isInteger(code) || code < 0 || code > 63) {
      throw new BinaryError('INVALID_TRIANGLE_CODE', `Triangle code ${code} is outside 6-bit range [0..63]`);
    }
    return {
      c1: ((code >> 5) & 1) as 0 | 1,
      e1: ((code >> 4) & 1) as 0 | 1,
      c2: ((code >> 3) & 1) as 0 | 1,
      e2: ((code >> 2) & 1) as 0 | 1,
      c3: ((code >> 1) & 1) as 0 | 1,
      e3: (code & 1) as 0 | 1,
    };
  }

  /**
   * Converts canonical 6 geometric triangle positions back to a 6-bit integer (0..63).
   */
  public static positionsToCode(pos: TrianglePositions): number {
    return (
      (pos.c1 << 5) |
      (pos.e1 << 4) |
      (pos.c2 << 3) |
      (pos.e2 << 2) |
      (pos.c3 << 1) |
      pos.e3
    );
  }

  /**
   * Formats a 6-bit code into a 6-character bitstring (e.g. '101100').
   */
  public static toBitString(code: number): string {
    if (!Number.isInteger(code) || code < 0 || code > 63) {
      throw new BinaryError('INVALID_TRIANGLE_CODE', `Triangle code ${code} is outside 6-bit range [0..63]`);
    }
    return code.toString(2).padStart(6, '0');
  }

  /**
   * Parses a 6-character bitstring into a 6-bit integer.
   */
  public static fromBitString(str: string): number {
    if (typeof str !== 'string' || str.length !== 6 || !/^[01]{6}$/.test(str)) {
      throw new BinaryError('INVALID_BIT_STRING', `Bitstring '${str}' must be exactly 6 binary characters`);
    }
    return parseInt(str, 2);
  }

  /**
   * Returns an ASCII diagram representation of the triangle configuration.
   */
  public static renderAscii(code: number): string {
    const pos = this.codeToPositions(code);
    const c1 = pos.c1 ? '●' : '○';
    const c2 = pos.c2 ? '●' : '○';
    const c3 = pos.c3 ? '●' : '○';
    const e1 = pos.e1 ? '/' : ' ';
    const e2 = pos.e2 ? '——' : '  ';
    const e3 = pos.e3 ? '\\' : ' ';

    return [
      `     [${c1}]`,
      `     /   \\`,
      `   ${e1}      ${e3}`,
      `   /       \\`,
      ` [${c2}] ${e2} [${c3}]`,
    ].join('\n');
  }
}
