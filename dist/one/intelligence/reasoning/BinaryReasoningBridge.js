/**
 * ONE Language — Phase 3: 0/1 Reasoning Intelligence Engine
 * Module: Binary Reasoning Bridge (src/one/intelligence/reasoning/BinaryReasoningBridge.ts)
 */
import { BinaryEncoder, BinaryDecoder, } from '../../../../src/binary';
export class BinaryReasoningBridge {
    /**
     * Serializes a supported primitive or typed reasoning token into a canonical binary envelope.
     * Leverages the frozen Binary Language v1 protocol.
     */
    static serializeToken(value) {
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
    static serializeFloatToken(value) {
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
    static deserializeToken(bitstring) {
        const result = BinaryDecoder.decode(bitstring);
        return result.value;
    }
    /**
     * Validates if a binary bitstream conforms fail-closed to protocol v1.
     */
    static validateBitstream(bitstring) {
        try {
            BinaryDecoder.decode(bitstring);
            return true;
        }
        catch {
            return false;
        }
    }
}
