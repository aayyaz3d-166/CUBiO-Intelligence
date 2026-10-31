/**
 * ONE Language — Qplayer Execution Architecture
 * ==============================================
 * QBinaryDecoder.ts: Deserializes Raw OBI Binary Streams into Executable OBIProgram
 */

import {
  OBI_MAGIC,
  OBI_HEADER_SIZE,
  OBIInstruction,
  OBIConstant,
  OBIConstType,
  OBIProgram,
  OBIHeader,
  OBICategory,
  OBIOperandMode,
} from '../spec/OBISpec';
import { computeCRC32 } from './CRC32';

export class QBinaryDecoderError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'QBinaryDecoderError';
    this.code = code;
  }
}

export class QBinaryDecoder {
  /**
   * Deserializes and validates an OBI binary buffer.
   */
  public static decode(buffer: Buffer): OBIProgram {
    if (buffer.length < OBI_HEADER_SIZE) {
      throw new QBinaryDecoderError(
        'E8101',
        `Truncated OBI stream: length ${buffer.length} < header size ${OBI_HEADER_SIZE}`
      );
    }

    // 1. Verify Magic Bytes
    if (
      buffer[0] !== OBI_MAGIC[0] ||
      buffer[1] !== OBI_MAGIC[1] ||
      buffer[2] !== OBI_MAGIC[2] ||
      buffer[3] !== OBI_MAGIC[3]
    ) {
      const actual = buffer.slice(0, 4).toString('ascii');
      throw new QBinaryDecoderError(
        'E8102',
        `Invalid OBI magic header: expected 'OBI1', got '${actual}'`
      );
    }

    // 2. Parse Header
    const versionMajor = buffer.readUInt16LE(4);
    const versionMinor = buffer.readUInt16LE(6);
    const flags = buffer.readUInt32LE(8);
    const instructionCount = buffer.readUInt32LE(12);
    const constPoolOffset = buffer.readUInt32LE(16);
    const constPoolSize = buffer.readUInt32LE(20);
    const entryPC = buffer.readUInt32LE(24);
    const expectedCRC32 = buffer.readUInt32LE(28);

    const expectedInstrBytes = instructionCount * 4;
    const totalExpectedSize = OBI_HEADER_SIZE + expectedInstrBytes + constPoolSize;

    if (buffer.length < totalExpectedSize) {
      throw new QBinaryDecoderError(
        'E8103',
        `Truncated OBI body: expected ${totalExpectedSize} bytes, got ${buffer.length}`
      );
    }

    // 3. Verify Checksum
    const payload = buffer.slice(OBI_HEADER_SIZE, totalExpectedSize);
    const actualCRC32 = computeCRC32(payload);

    if (actualCRC32 !== expectedCRC32) {
      throw new QBinaryDecoderError(
        'E8104',
        `OBI Checksum mismatch: expected CRC32 0x${expectedCRC32.toString(16)}, got 0x${actualCRC32.toString(16)}`
      );
    }

    const header: OBIHeader = {
      magic: buffer.slice(0, 4),
      versionMajor,
      versionMinor,
      flags,
      instructionCount,
      constPoolOffset,
      constPoolSize,
      entryPC,
      checksumCRC32: expectedCRC32,
    };

    // 4. Decode Instructions
    const instructions: OBIInstruction[] = [];
    let instrOffset = OBI_HEADER_SIZE;

    for (let i = 0; i < instructionCount; i++) {
      const word = buffer.readUInt32LE(instrOffset);
      instrOffset += 4;

      const category = (word & 0x07) as OBICategory;
      const opcode = (word >>> 3) & 0x3F;
      const harmonicDest = (word >>> 9) & 0x1FF;
      const srcA = (word >>> 18) & 0x1F;
      const srcB = (word >>> 23) & 0x1F;
      const mode = ((word >>> 28) & 0x0F) as OBIOperandMode;

      instructions.push({
        category,
        opcode,
        harmonicDest,
        srcA,
        srcB,
        mode,
      });
    }

    // 5. Decode Constant Pool
    const constants = this.decodeConstantPool(buffer.slice(constPoolOffset, constPoolOffset + constPoolSize));

    return {
      header,
      instructions,
      constants,
    };
  }

  private static decodeConstantPool(poolBuf: Buffer): OBIConstant[] {
    if (poolBuf.length < 4) return [];

    const count = poolBuf.readUInt32LE(0);
    const constants: OBIConstant[] = [];
    let offset = 4;

    for (let i = 0; i < count; i++) {
      if (offset >= poolBuf.length) break;
      const type = poolBuf.readUInt8(offset);
      offset += 1;

      switch (type) {
        case OBIConstType.INT32: {
          constants.push(poolBuf.readInt32LE(offset));
          offset += 4;
          break;
        }
        case OBIConstType.FLOAT64: {
          constants.push(poolBuf.readDoubleLE(offset));
          offset += 8;
          break;
        }
        case OBIConstType.STRING: {
          const len = poolBuf.readUInt16LE(offset);
          offset += 2;
          const str = poolBuf.slice(offset, offset + len).toString('utf8');
          constants.push(str);
          offset += len;
          break;
        }
        case OBIConstType.BOOLEAN: {
          constants.push(poolBuf.readUInt8(offset) !== 0);
          offset += 1;
          break;
        }
        default:
          throw new QBinaryDecoderError('E8105', `Unknown constant type tag: ${type}`);
      }
    }

    return constants;
  }
}
