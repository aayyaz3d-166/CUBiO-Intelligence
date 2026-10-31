/**
 * ONE Language — Qplayer Execution Architecture
 * ==============================================
 * QBinaryEncoder.ts: Serializes OBI Instructions & Constants into Binary Stream (.obi)
 */

import {
  OBI_MAGIC,
  OBI_HEADER_SIZE,
  OBI_VERSION_MAJOR,
  OBI_VERSION_MINOR,
  OBI_FLAG_ACTUATION_LOCKED,
  OBI_FLAG_369_ALIGNED,
  OBI_FLAG_OPTIMIZED_DAG,
  OBIInstruction,
  OBIConstant,
  OBIConstType,
} from '../spec/OBISpec';
import { computeCRC32 } from './CRC32';

export interface EncodeOptions {
  flags?: number;
  entryPC?: number;
}

export class QBinaryEncoder {
  /**
   * Packs an array of instructions and constant pool into a sealed OBI buffer.
   */
  public static encode(
    instructions: OBIInstruction[],
    constants: OBIConstant[] = [],
    options: EncodeOptions = {}
  ): Buffer {
    // 1. Encode Constant Pool
    const constPoolBuf = this.encodeConstantPool(constants);

    // 2. Encode Instructions (4 bytes per instruction)
    const instrBytesLen = instructions.length * 4;
    const instrBuf = Buffer.alloc(instrBytesLen);

    for (let i = 0; i < instructions.length; i++) {
      const instr = instructions[i];
      const word = (
        (instr.category & 0x07) |
        ((instr.opcode & 0x3F) << 3) |
        ((instr.harmonicDest & 0x1FF) << 9) |
        ((instr.srcA & 0x1F) << 18) |
        ((instr.srcB & 0x1F) << 23) |
        ((instr.mode & 0x0F) << 28)
      ) >>> 0;

      instrBuf.writeUInt32LE(word, i * 4);
    }

    // 3. Compute Checksum over Instructions + Constant Pool
    const payload = Buffer.concat([instrBuf, constPoolBuf]);
    const checksumCRC32 = computeCRC32(payload);

    // 4. Construct 32-Byte Header
    const headerBuf = Buffer.alloc(OBI_HEADER_SIZE);
    OBI_MAGIC.copy(headerBuf, 0, 0, 4);
    headerBuf.writeUInt16LE(OBI_VERSION_MAJOR, 4);
    headerBuf.writeUInt16LE(OBI_VERSION_MINOR, 6);

    const defaultFlags = OBI_FLAG_ACTUATION_LOCKED | OBI_FLAG_369_ALIGNED | OBI_FLAG_OPTIMIZED_DAG;
    headerBuf.writeUInt32LE(options.flags ?? defaultFlags, 8);
    headerBuf.writeUInt32LE(instructions.length, 12);

    const constPoolOffset = OBI_HEADER_SIZE + instrBytesLen;
    headerBuf.writeUInt32LE(constPoolOffset, 16);
    headerBuf.writeUInt32LE(constPoolBuf.length, 20);
    headerBuf.writeUInt32LE(options.entryPC ?? 0, 24);
    headerBuf.writeUInt32LE(checksumCRC32, 28);

    // 5. Final Assembly
    return Buffer.concat([headerBuf, instrBuf, constPoolBuf]);
  }

  private static encodeConstantPool(constants: OBIConstant[]): Buffer {
    const buffers: Buffer[] = [];

    // Count header (4 bytes UInt32LE)
    const countBuf = Buffer.alloc(4);
    countBuf.writeUInt32LE(constants.length, 0);
    buffers.push(countBuf);

    for (const c of constants) {
      if (typeof c === 'number') {
        if (Number.isInteger(c)) {
          const entry = Buffer.alloc(1 + 4);
          entry.writeUInt8(OBIConstType.INT32, 0);
          entry.writeInt32LE(c, 1);
          buffers.push(entry);
        } else {
          const entry = Buffer.alloc(1 + 8);
          entry.writeUInt8(OBIConstType.FLOAT64, 0);
          entry.writeDoubleLE(c, 1);
          buffers.push(entry);
        }
      } else if (typeof c === 'string') {
        const strBytes = Buffer.from(c, 'utf8');
        const entry = Buffer.alloc(1 + 2 + strBytes.length);
        entry.writeUInt8(OBIConstType.STRING, 0);
        entry.writeUInt16LE(strBytes.length, 1);
        strBytes.copy(entry, 3);
        buffers.push(entry);
      } else if (typeof c === 'boolean') {
        const entry = Buffer.alloc(1 + 1);
        entry.writeUInt8(OBIConstType.BOOLEAN, 0);
        entry.writeUInt8(c ? 1 : 0, 1);
        buffers.push(entry);
      } else {
        throw new Error(`Unsupported constant type: ${typeof c}`);
      }
    }

    return Buffer.concat(buffers);
  }
}
