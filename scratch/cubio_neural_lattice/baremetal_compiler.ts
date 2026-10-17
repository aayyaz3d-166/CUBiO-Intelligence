/**
 * CUBiO Zero-OS Bare-Metal Compiler Core ("one-baremetal")
 * Gate: CNL-P6-001 | Sovereign Architecture
 */

import { ExecutableCubiOAST, ExecutableInstruction } from '../../src/one/oneCompiler';

export const BAREMETAL_MAGIC = 0x3690B4E0; // 0x369_BARE_METAL
export const BAREMETAL_VERSION = 0x0100;    // v1.0.0

export enum BareMetalOpcode {
  OP_HALT = 0x00,
  OP_SET_MEMORY_BOUND = 0x01,
  OP_ALLOC_SPATIAL_NODE = 0x02,
  OP_ALIGN_HARMONIC_369 = 0x03,
  OP_MAP_ZERO_COPY_VIEW = 0x04,
  OP_OPEN_STREAM_BUFFER = 0x05,
  OP_MAP_HYPER_GRID = 0x06,
  OP_EVAL_SYMBOLIC_RULE = 0x07,
  OP_EMBED_PQC_SEAL = 0x08,
  OP_ACTUATION_LOCK = 0x09,
}

export interface BareMetalBinaryHeader {
  magic: number;
  version: number;
  entryPointOffset: number;
  codeSectionSize: number;
  dataSectionSize: number;
  totalBinarySize: number;
  targetArchitecture: 'FREESTANDING_X86_64' | 'FREESTANDING_ARM64' | 'FREESTANDING_RISCV64';
  memoryBaseAddress: bigint;
  memoryLimitBytes: number;
  isActuationBlocked: boolean;
}

export interface CompiledBareMetalImage {
  header: BareMetalBinaryHeader;
  binaryBuffer: Buffer;
  instructionsCount: number;
  pqcSeal: string;
}

export class BareMetalCompiler {
  private readonly MEMORY_BASE_ADDR = 0x00100000n; // 1 MB Physical Flash Base
  private readonly MAX_HARDWARE_LIMIT_BYTES = 512 * 1024 * 1024; // 512 MB Physical Cap

  /**
   * Compiles high-level AST instructions into raw, freestanding machine bytecode.
   */
  public compileToBareMetal(
    ast: ExecutableCubiOAST,
    pqcSeal: string,
    arch: 'FREESTANDING_X86_64' | 'FREESTANDING_ARM64' | 'FREESTANDING_RISCV64' = 'FREESTANDING_X86_64'
  ): CompiledBareMetalImage {
    const codeStream: number[] = [];
    const dataStream: number[] = [];

    // 1. Emit Hardware Memory Limit & Safety Actuation Lock
    this.emitInstruction(codeStream, BareMetalOpcode.OP_SET_MEMORY_BOUND, [
      (this.MAX_HARDWARE_LIMIT_BYTES >>> 24) & 0xFF,
      (this.MAX_HARDWARE_LIMIT_BYTES >>> 16) & 0xFF,
      (this.MAX_HARDWARE_LIMIT_BYTES >>> 8) & 0xFF,
      this.MAX_HARDWARE_LIMIT_BYTES & 0xFF,
    ]);

    this.emitInstruction(codeStream, BareMetalOpcode.OP_ACTUATION_LOCK, [0x01]); // Permanently locked (Fail-Closed)

    // 2. Translate AST instructions to raw opcodes
    let instructionCounter = 2;

    for (const inst of ast.instructions) {
      switch (inst.op) {
        case 'ALLOC_SPATIAL_NODE': {
          const payload = inst.payload as { nodeId: string; coordinate: { x: number; y: number; z: number } };
          const dataOffset = this.encodeStringData(dataStream, payload.nodeId);
          const xInt = Math.round(payload.coordinate.x * 1000);
          const yInt = Math.round(payload.coordinate.y * 1000);
          const zInt = Math.round(payload.coordinate.z * 1000);

          this.emitInstruction(codeStream, BareMetalOpcode.OP_ALLOC_SPATIAL_NODE, [
            (dataOffset >>> 8) & 0xFF,
            dataOffset & 0xFF,
            (xInt >>> 8) & 0xFF,
            xInt & 0xFF,
            (yInt >>> 8) & 0xFF,
            yInt & 0xFF,
            (zInt >>> 8) & 0xFF,
            zInt & 0xFF,
          ]);
          instructionCounter++;
          break;
        }

        case 'ALIGN_HARMONIC': {
          const payload = inst.payload as { nodeId: string; targetCoordinate: { x: number; y: number; z: number } };
          const tx = Math.round(payload.targetCoordinate.x * 1000);
          const ty = Math.round(payload.targetCoordinate.y * 1000);
          const tz = Math.round(payload.targetCoordinate.z * 1000);

          this.emitInstruction(codeStream, BareMetalOpcode.OP_ALIGN_HARMONIC_369, [
            (tx >>> 8) & 0xFF,
            tx & 0xFF,
            (ty >>> 8) & 0xFF,
            ty & 0xFF,
            (tz >>> 8) & 0xFF,
            tz & 0xFF,
          ]);
          instructionCounter++;
          break;
        }

        case 'OPEN_FUNNEL_STREAM':
        case 'OPEN_GOSSIP_CHANNEL': {
          const payload = inst.payload as { bufferMb: number; priority?: number };
          const bufMb = payload.bufferMb || 32;
          const prio = payload.priority || 369;

          this.emitInstruction(codeStream, BareMetalOpcode.OP_OPEN_STREAM_BUFFER, [
            bufMb & 0xFF,
            (prio >>> 8) & 0xFF,
            prio & 0xFF,
          ]);
          instructionCounter++;
          break;
        }

        case 'MAP_ZERO_COPY_VIEW': {
          const payload = inst.payload as { viewSizeMb: number };
          const mb = payload.viewSizeMb || 16;
          this.emitInstruction(codeStream, BareMetalOpcode.OP_MAP_ZERO_COPY_VIEW, [mb & 0xFF]);
          instructionCounter++;
          break;
        }

        default:
          break;
      }
    }

    // 3. Embed PQC Lattice Root Seal
    const sealOffset = this.encodeStringData(dataStream, pqcSeal);
    this.emitInstruction(codeStream, BareMetalOpcode.OP_EMBED_PQC_SEAL, [
      (sealOffset >>> 8) & 0xFF,
      sealOffset & 0xFF,
    ]);
    instructionCounter++;

    // 4. Halt
    this.emitInstruction(codeStream, BareMetalOpcode.OP_HALT, []);
    instructionCounter++;

    // 5. Assemble Freestanding Binary Image (Header + Code + Data)
    const headerSize = 64; // Fixed 64-byte Header
    const codeSize = codeStream.length;
    const dataSize = dataStream.length;
    const totalBinarySize = headerSize + codeSize + dataSize;

    const binaryBuffer = Buffer.alloc(totalBinarySize);

    // Write Header (Big-Endian)
    binaryBuffer.writeUInt32BE(BAREMETAL_MAGIC, 0);       // Magic 0x3690B4E0
    binaryBuffer.writeUInt16BE(BAREMETAL_VERSION, 4);     // Version 0x0100
    binaryBuffer.writeUInt16BE(headerSize, 6);            // Entry Point
    binaryBuffer.writeUInt32BE(codeSize, 8);              // Code Section Size
    binaryBuffer.writeUInt32BE(dataSize, 12);             // Data Section Size
    binaryBuffer.writeUInt32BE(totalBinarySize, 16);      // Total Size
    binaryBuffer.writeBigUInt64BE(this.MEMORY_BASE_ADDR, 20); // Base Address (1 MB)
    binaryBuffer.writeUInt32BE(this.MAX_HARDWARE_LIMIT_BYTES, 28); // Hardware Limit (512 MB)
    binaryBuffer.writeUInt8(0x01, 32);                    // isActuationBlocked = true

    // Write Code & Data
    Buffer.from(codeStream).copy(binaryBuffer, headerSize);
    Buffer.from(dataStream).copy(binaryBuffer, headerSize + codeSize);

    const header: BareMetalBinaryHeader = {
      magic: BAREMETAL_MAGIC,
      version: BAREMETAL_VERSION,
      entryPointOffset: headerSize,
      codeSectionSize: codeSize,
      dataSectionSize: dataSize,
      totalBinarySize,
      targetArchitecture: arch,
      memoryBaseAddress: this.MEMORY_BASE_ADDR,
      memoryLimitBytes: this.MAX_HARDWARE_LIMIT_BYTES,
      isActuationBlocked: true,
    };

    return {
      header,
      binaryBuffer,
      instructionsCount: instructionCounter,
      pqcSeal,
    };
  }

  private emitInstruction(stream: number[], opcode: BareMetalOpcode, operands: number[]): void {
    stream.push(opcode);
    stream.push(operands.length);
    for (const op of operands) {
      stream.push(op & 0xFF);
    }
  }

  private encodeStringData(stream: number[], str: string): number {
    const offset = stream.length;
    const bytes = Buffer.from(str, 'utf-8');
    stream.push(bytes.length);
    for (const b of bytes) {
      stream.push(b);
    }
    return offset;
  }
}
