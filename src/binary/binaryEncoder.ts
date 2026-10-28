/**
 * ONE Language — 3/6/9-Bit Binary Language System
 * Module: Deterministic Binary Encoder (src/binary/binaryEncoder.ts)
 */

import { BitCategory, SupportedBinaryValue, TriangleOpcode, BinaryError } from './types';
import { TriangleMapper } from './triangleMapper';
import { CanonicalAddress369 } from '../one/address369_canonical';

export class BinaryEncoder {
  /**
   * Encodes any supported value into a canonical Big-Endian bitstring ('0' and '1').
   */
  public static encode(value: SupportedBinaryValue): string {
    // 1. Null
    if (value === null) {
      return '000'; // TYPE_NULL
    }

    // 2. Boolean
    if (typeof value === 'boolean') {
      return '001' + (value ? '1' : '0'); // TYPE_BOOL + bit
    }

    // 3. Number (Integer vs Float64)
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return this.encodeInteger(value);
      } else {
        return this.encodeFloat(value);
      }
    }

    // 4. String (UTF-8 bytes)
    if (typeof value === 'string') {
      return this.encodeText(value);
    }

    // 5. Complex Object (Address369 vs Opcode)
    if (typeof value === 'object') {
      if (value.kind === 'address369') {
        return this.encodeAddress(value.address);
      }
      if (value.kind === 'opcode') {
        return this.encodeOpcode(value.opcode);
      }
    }

    throw new BinaryError('UNSUPPORTED_VALUE_TYPE', `Unsupported value: ${String(value)}`);
  }

  // ── Specific Type Encoders ─────────────────────────────────────────────────

  public static encodeInteger(val: number): string {
    const signBit = val < 0 ? '1' : '0';
    const absVal = Math.abs(val);
    const magnitudeBits = absVal === 0 ? '0' : absVal.toString(2);
    const bitLen = magnitudeBits.length;

    if (bitLen > 63) {
      throw new BinaryError('INTEGER_OVERFLOW', `Integer magnitude requires ${bitLen} bits (max 63)`);
    }

    const lenField = bitLen.toString(2).padStart(6, '0');
    return '010' + signBit + lenField + magnitudeBits;
  }

  public static encodeFloat(val: number): string {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setFloat64(0, val, false); // Big-Endian
    const u8 = new Uint8Array(buf);
    let floatBits = '';
    for (let i = 0; i < 8; i++) {
      floatBits += u8[i].toString(2).padStart(8, '0');
    }
    return '011' + floatBits;
  }

  public static encodeText(text: string): string {
    const utf8 = new TextEncoder().encode(text);
    const byteCount = utf8.length;
    if (byteCount > 65535) {
      throw new BinaryError('STRING_OVERFLOW', `String length ${byteCount} exceeds max 65535 bytes`);
    }
    const lenBits = byteCount.toString(2).padStart(16, '0');
    let dataBits = '';
    for (let i = 0; i < byteCount; i++) {
      dataBits += utf8[i].toString(2).padStart(8, '0');
    }
    return '100' + lenBits + dataBits;
  }

  public static encodeAddress(addr: number): string {
    if (!Number.isInteger(addr) || addr < 0 || addr >= CanonicalAddress369.TOTAL_ADDRESSES) {
      throw new BinaryError('ADDRESS_OUT_OF_BOUNDS', `Address ${addr} is outside [0..368]`);
    }
    const addrBits = addr.toString(2).padStart(9, '0');
    return '101' + addrBits;
  }

  public static encodeOpcode(opcode: TriangleOpcode): string {
    if (!Number.isInteger(opcode) || opcode < 0 || opcode > 63) {
      throw new BinaryError('INVALID_OPCODE', `Opcode ${opcode} is outside [0..63]`);
    }
    const opBits = TriangleMapper.toBitString(opcode);
    return '110' + opBits;
  }
}
