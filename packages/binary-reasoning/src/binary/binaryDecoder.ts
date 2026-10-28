/**
 * ONE Language — 3/6/9-Bit Binary Language System
 * Module: Deterministic Binary Decoder (src/binary/binaryDecoder.ts)
 */

import { BitCategory, SupportedBinaryValue, TriangleOpcode, BinaryError } from './types.js';
import { TriangleMapper } from './triangleMapper.js';
import { CanonicalAddress369 } from '../shared/address369.js';
import { BinaryCodebook } from './binaryCodebook.js';

export interface DecodeResult {
  value: SupportedBinaryValue;
  bitsConsumed: number;
}

export class BinaryDecoder {
  /**
   * Decodes a bitstring from a given start offset into a value and bits consumed.
   */
  public static decode(bitstring: string, startOffset: number = 0): DecodeResult {
    if (typeof bitstring !== 'string' || !/^[01]*$/.test(bitstring)) {
      throw new BinaryError('INVALID_BITSTREAM', 'Input must be a valid binary bitstring containing only 0 and 1');
    }

    const availableBits = bitstring.length - startOffset;
    if (availableBits < 3) {
      throw new BinaryError('INCOMPLETE_STREAM', `Need at least 3 bits for type header, got ${availableBits}`);
    }

    const tagStr = bitstring.substring(startOffset, startOffset + 3);
    const category = parseInt(tagStr, 2) as BitCategory;

    switch (category) {
      case BitCategory.TYPE_NULL: {
        return { value: null, bitsConsumed: 3 };
      }

      case BitCategory.TYPE_BOOL: {
        if (availableBits < 4) {
          throw new BinaryError('INCOMPLETE_STREAM', 'Incomplete boolean value (need 4 bits)');
        }
        const boolBit = bitstring[startOffset + 3];
        return { value: boolBit === '1', bitsConsumed: 4 };
      }

      case BitCategory.TYPE_INT: {
        // [ 010 ] (3) + [ sign ] (1) + [ len ] (6) = 10 bits header
        if (availableBits < 10) {
          throw new BinaryError('INCOMPLETE_STREAM', 'Incomplete integer header (need at least 10 bits)');
        }
        const signBit = bitstring[startOffset + 3];
        const lenBits = bitstring.substring(startOffset + 4, startOffset + 10);
        const bitLen = parseInt(lenBits, 2);

        if (bitLen < 1 || bitLen > 63) {
          throw new BinaryError('MALFORMED_INTEGER', `Integer bit length ${bitLen} is invalid (must be 1..63)`);
        }

        const totalNeeded = 10 + bitLen;
        if (availableBits < totalNeeded) {
          throw new BinaryError('INCOMPLETE_STREAM', `Incomplete integer payload (need ${totalNeeded} bits, got ${availableBits})`);
        }

        const magBits = bitstring.substring(startOffset + 10, startOffset + 10 + bitLen);
        const absVal = parseInt(magBits, 2);
        const finalVal = signBit === '1' ? -absVal : absVal;

        return { value: finalVal, bitsConsumed: totalNeeded };
      }

      case BitCategory.TYPE_FLOAT: {
        // [ 011 ] (3) + [ IEEE float ] (64) = 67 bits
        if (availableBits < 67) {
          throw new BinaryError('INCOMPLETE_STREAM', `Incomplete float64 payload (need 67 bits, got ${availableBits})`);
        }
        const floatBits = bitstring.substring(startOffset + 3, startOffset + 67);
        const bytes = new Uint8Array(8);
        for (let i = 0; i < 8; i++) {
          bytes[i] = parseInt(floatBits.substring(i * 8, (i + 1) * 8), 2);
        }
        const val = new DataView(bytes.buffer).getFloat64(0, false);
        return { value: val, bitsConsumed: 67 };
      }

      case BitCategory.TYPE_TEXT: {
        // [ 100 ] (3) + [ byte_count ] (16) = 19 bits header
        if (availableBits < 19) {
          throw new BinaryError('INCOMPLETE_STREAM', 'Incomplete string header (need at least 19 bits)');
        }
        const byteCountStr = bitstring.substring(startOffset + 3, startOffset + 19);
        const byteCount = parseInt(byteCountStr, 2);
        const totalNeeded = 19 + byteCount * 8;

        if (availableBits < totalNeeded) {
          throw new BinaryError('INCOMPLETE_STREAM', `Incomplete string payload (need ${totalNeeded} bits, got ${availableBits})`);
        }

        const dataBits = bitstring.substring(startOffset + 19, startOffset + totalNeeded);
        const bytes = new Uint8Array(byteCount);
        for (let i = 0; i < byteCount; i++) {
          bytes[i] = parseInt(dataBits.substring(i * 8, (i + 1) * 8), 2);
        }
        const text = new TextDecoder().decode(bytes);
        return { value: text, bitsConsumed: totalNeeded };
      }

      case BitCategory.TYPE_ADDR369: {
        // [ 101 ] (3) + [ 9 bits addr ] = 12 bits
        if (availableBits < 12) {
          throw new BinaryError('INCOMPLETE_STREAM', 'Incomplete Address369 pointer (need 12 bits)');
        }
        const addrBits = bitstring.substring(startOffset + 3, startOffset + 12);
        const addr = parseInt(addrBits, 2);

        if (addr >= CanonicalAddress369.TOTAL_ADDRESSES) {
          throw new BinaryError('ADDRESS_OUT_OF_BOUNDS', `Address ${addr} is outside [0..368] (reserved space 369..511)`);
        }

        return { value: { kind: 'address369', address: addr }, bitsConsumed: 12 };
      }

      case BitCategory.TYPE_OPCODE: {
        // [ 110 ] (3) + [ 6 bits opcode ] = 9 bits
        if (availableBits < 9) {
          throw new BinaryError('INCOMPLETE_STREAM', 'Incomplete opcode instruction (need 9 bits)');
        }
        const opBits = bitstring.substring(startOffset + 3, startOffset + 9);
        const opcodeNum = parseInt(opBits, 2);

        // Fail-closed: reject any opcode classified as RESERVED in the canonical codebook.
        // This uses the machine-readable codebook (BinaryCodebook.TABLE_6BIT) as the single
        // source of truth — no independent list is maintained here.
        const opcodeEntry = BinaryCodebook.lookup6Bit(opcodeNum);
        if (opcodeEntry.status === 'RESERVED') {
          throw new BinaryError(
            'RESERVED_OPCODE',
            `Opcode 0x${opcodeNum.toString(16).padStart(2, '0')} (pattern '${opcodeEntry.pattern}') ` +
            `is RESERVED and cannot be decoded`,
          );
        }

        return { value: { kind: 'opcode', opcode: opcodeNum as TriangleOpcode }, bitsConsumed: 9 };
      }

      default:
        throw new BinaryError('INVALID_CODEWORD', `Unrecognized category prefix '${tagStr}'`);
    }
  }

  /**
   * Decodes an entire stream of concatenated binary values until end-of-string.
   */
  public static decodeStream(bitstring: string): SupportedBinaryValue[] {
    const results: SupportedBinaryValue[] = [];
    let offset = 0;
    while (offset < bitstring.length) {
      const res = this.decode(bitstring, offset);
      results.push(res.value);
      offset += res.bitsConsumed;
    }
    return results;
  }
}
