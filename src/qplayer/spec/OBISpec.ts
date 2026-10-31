/**
 * ONE Language — Qplayer Execution Architecture
 * ==============================================
 * OBISpec.ts: One Binary Intelligence (OBI v1.0) Constants & Type Definitions
 */

export const OBI_MAGIC = Buffer.from([0x4F, 0x42, 0x49, 0x31]); // "OBI1"
export const OBI_HEADER_SIZE = 32;
export const OBI_VERSION_MAJOR = 1;
export const OBI_VERSION_MINOR = 0;

export const OBI_FLAG_ACTUATION_LOCKED = 1 << 0;
export const OBI_FLAG_369_ALIGNED      = 1 << 1;
export const OBI_FLAG_OPTIMIZED_DAG    = 1 << 2;
export const OBI_FLAG_PQC_SEALED       = 1 << 3;

export enum OBICategory {
  CONTROL    = 0, // 000
  ARITHMETIC = 1, // 001
  MEMORY     = 2, // 010
  CALLS      = 3, // 011
  SPATIAL369 = 4, // 100
  IO         = 5, // 101
  EXTENDED   = 6, // 110
  SAFETY     = 7, // 111
}

export enum OBIOpcodeControl {
  NOP               = 0x00,
  HALT              = 0x01,
  JUMP              = 0x02,
  JUMP_IF_ZERO      = 0x03,
  JUMP_IF_NOT_ZERO  = 0x04,
  CALL              = 0x05,
  RET               = 0x06,
}

export enum OBIOpcodeArithmetic {
  ADD = 0x00,
  SUB = 0x01,
  MUL = 0x02,
  DIV = 0x03,
  MOD = 0x04,
  AND = 0x05,
  OR  = 0x06,
  XOR = 0x07,
  SHL = 0x08,
  SHR = 0x09,
  EQ  = 0x0A,
  LT  = 0x0B,
  GT  = 0x0C,
}

export enum OBIOpcodeMemory {
  LOAD_CONST = 0x00,
  LOAD_VAR   = 0x01,
  STORE_VAR  = 0x02,
  MOV        = 0x03,
}

export enum OBIOpcodeCalls {
  FRAME_ENTER = 0x00,
  FRAME_EXIT  = 0x01,
  ARG_PASS    = 0x02,
}

export enum OBIOpcodeSpatial {
  SPATIAL_LOAD_369  = 0x00,
  SPATIAL_STORE_369 = 0x01,
  GRID777_MAP       = 0x02,
}

export enum OBIOpcodeIO {
  INPUT  = 0x00,
  OUTPUT = 0x01,
}

export enum OBIOpcodeSafety {
  ASSERT_ACTUATION_LOCK = 0x00,
  ASSERT_RSS_GUARD      = 0x01,
}

export enum OBIOperandMode {
  REG_REG       = 0,
  REG_IMM9      = 1,
  REG_CONSTPOOL = 2,
  SPATIAL_ADDR  = 3,
}

export enum OBIConstType {
  INT32   = 1,
  FLOAT64 = 2,
  STRING  = 3,
  BOOLEAN = 4,
}

export interface OBIHeader {
  magic: Buffer;
  versionMajor: number;
  versionMinor: number;
  flags: number;
  instructionCount: number;
  constPoolOffset: number;
  constPoolSize: number;
  entryPC: number;
  checksumCRC32: number;
}

export interface OBIInstruction {
  category: OBICategory;
  opcode: number;
  harmonicDest: number; // 9 bits (0..511)
  srcA: number;         // 5 bits (0..31)
  srcB: number;         // 5 bits (0..31)
  mode: OBIOperandMode; // 4 bits (0..15)
}

export type OBIConstant = number | string | boolean;

export interface OBIProgram {
  header: OBIHeader;
  instructions: OBIInstruction[];
  constants: OBIConstant[];
}
