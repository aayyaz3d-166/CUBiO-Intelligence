/**
 * ONE Language — Versioned Executable Artifact Specification (.ox)
 * =================================================================
 * Module: @one/packer/ExecutableArtifact
 *
 * Defines the canonical binary container format for VM-executable artifacts.
 * Provides deterministic packaging, version negotiation, fail-closed integrity
 * verification, and mandatory hardware actuation lockout enforcement.
 */

export const ONEX_MAGIC = Buffer.from('ONEX', 'ascii'); // 0x4F4E4558
export const ONEX_HEADER_SIZE = 64; // Fixed 64-byte header

export const ONEX_FORMAT_VERSION_MAJOR = 1;
export const ONEX_FORMAT_VERSION_MINOR = 0;
export const ONEX_FORMAT_VERSION_PATCH = 0;

export const ONEX_TARGET_ARCH_VM = 0x0001;
export const ONEX_TARGET_ARCH_RV64 = 0x0002;

export const ONEX_FLAG_ACTUATION_LOCKED = 0x0001;
export const ONEX_FLAG_PQC_SEALED = 0x0002;
export const ONEX_FLAG_MULTI_FILE_LINKED = 0x0004;
export const ONEX_FLAG_OPTIMIZED = 0x0008;

export interface ONEXHeader {
  magic: string; // 'ONEX'
  formatVersionMajor: number; // 1
  formatVersionMinor: number; // 0
  formatVersionPatch: number; // 0
  targetArch: number; // 0x0001 = ONE_VM
  flags: number; // Bitfield (MUST have ONEX_FLAG_ACTUATION_LOCKED)
  rssMaxLimitMB: number; // Default 512
  entryPointPC: number; // Instruction index
  instructionCount: number; // Total instruction count
  payloadSizeBytes: number; // Length of payload section
  headerChecksum: number; // CRC32/Adler checksum of header [0..27]
  payloadSha256: string; // 32-byte SHA-256 digest in hex (64 chars)
}

export interface ONEXMetadata {
  compilerVersion: string;
  compiledAt: number;
  entryPointFile: string;
  modulesCount: number;
  actuationLocked: boolean;
  rssMaxLimitMB: number;
  pqcSeal?: string;
  sourceContentHash?: string;
}

export interface ONEXValidationResult {
  valid: boolean;
  errorCode?: string;
  error?: string;
  header?: ONEXHeader;
}
