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
