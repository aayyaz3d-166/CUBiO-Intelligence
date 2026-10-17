/**
 * ONE Language — Phase 3: 0/1 Reasoning Intelligence Engine
 * Module: Binary Reasoning Bridge (src/one/intelligence/reasoning/BinaryReasoningBridge.ts)
 */

import {
  BinaryEncoder,
  BinaryDecoder,
  BinaryError,
  SupportedBinaryValue,
} from '../../../../src/binary';
import { BinaryReasoningEnvelope } from './types';

export class BinaryReasoningBridge {
  /**
   * Serializes a supported primitive or typed reasoning token into a canonical binary envelope.
   * Leverages the frozen Binary Language v1 protocol.
   */
  public static serializeToken(value: SupportedBinaryValue): BinaryReasoningEnvelope {
    const rawBits = BinaryEncoder.encode(value);
    const tag = rawBits.substring(0, 3);
    const decoded = BinaryDecoder.decode(rawBits).value;

    return {
      typeTag: tag,
      rawBits,
      bitLength: rawBits.length,
      decodedValue: decoded,
    };
  }

  /**
   * Serializes an explicit IEEE-754 64-bit float token using the documented encodeFloat path.
   */
  public static serializeFloatToken(value: number): BinaryReasoningEnvelope {
    const rawBits = BinaryEncoder.encodeFloat(value);
    const tag = rawBits.substring(0, 3);
    const decoded = BinaryDecoder.decode(rawBits).value;

    return {
      typeTag: tag,
      rawBits,
      bitLength: rawBits.length,
      decodedValue: decoded,
    };
  }

  /**
   * Deserializes a binary bitstream into a verified reasoning token.
   * Throws fail-closed BinaryError on malformed bits, reserved opcodes, or out-of-bounds addresses.
   */
  public static deserializeToken(bitstring: string): SupportedBinaryValue {
    const result = BinaryDecoder.decode(bitstring);
    return result.value;
  }

  /**
   * Validates if a binary bitstream conforms fail-closed to protocol v1.
   */
  public static validateBitstream(bitstring: string): boolean {
    try {
      BinaryDecoder.decode(bitstring);
      return true;
    } catch {
      return false;
    }
  }
}
