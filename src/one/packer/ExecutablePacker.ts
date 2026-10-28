import * as crypto from 'crypto';
import { UnifiedIRProgram } from '../ir/UnifiedIR';
import {
  ONEX_MAGIC,
  ONEX_HEADER_SIZE,
  ONEX_FORMAT_VERSION_MAJOR,
  ONEX_FORMAT_VERSION_MINOR,
  ONEX_TARGET_ARCH_VM,
  ONEX_FLAG_ACTUATION_LOCKED,
  ONEX_FLAG_MULTI_FILE_LINKED,
  ONEXHeader,
  ONEXValidationResult,
} from './ExecutableArtifact';
import { ExecutableValidator } from './ExecutableValidator';
import { VIGCanonicalizer } from '../vig/VIGCanonicalizer';

export class OnePackerError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'OnePackerError';
    this.code = code;
  }
}

export interface PackOptions {
  targetArch?: number;
  rssMaxLimitMB?: number;
  entryPointPC?: number;
  flags?: number;
  pqcSeal?: string;
}

export class ExecutablePacker {
  /**
   * Packs a UnifiedIRProgram into a sealed, versioned binary executable container (.ox).
   * Guarantees deterministic, bit-exact reproducibility (sigma^2 = 0.0).
   */
  public static pack(program: UnifiedIRProgram, options: PackOptions = {}): Buffer {
    // 1. Semantic and boundary validation
    const validation = ExecutableValidator.validate(program);
    if (!validation.valid) {
      throw new OnePackerError(
        validation.errorCode || 'E8003',
        validation.error || 'Failed executable validation'
      );
    }

    // 2. Canonical serialization of instructions & metadata
    const canonicalPayload = {
      version: program.version,
      instructions: program.instructions,
      declarativeMetadata: {
        rssMaxLimitMB: program.declarativeMetadata?.rssMaxLimitMB ?? options.rssMaxLimitMB ?? 512,
        assertRssLimitMB: program.declarativeMetadata?.assertRssLimitMB,
        actuationLock: true, // Permanent invariant
      },
    };

    const payloadString = JSON.stringify(canonicalPayload);
    const payloadBuffer = Buffer.from(payloadString, 'utf8');

    // 3. Cryptographic digest of payload
    const payloadSha256 = crypto.createHash('sha256').update(payloadBuffer).digest();

    // 4. Construct 64-byte binary header
    const headerBuffer = Buffer.alloc(ONEX_HEADER_SIZE, 0);

    // [0..3] Magic: 'ONEX'
    ONEX_MAGIC.copy(headerBuffer, 0, 0, 4);

    // [4..5] Version: Major
    headerBuffer.writeUInt16LE(ONEX_FORMAT_VERSION_MAJOR, 4);

    // [6..7] Version: Minor
    headerBuffer.writeUInt16LE(ONEX_FORMAT_VERSION_MINOR, 6);

    // [8..9] Target Arch
    const targetArch = options.targetArch ?? ONEX_TARGET_ARCH_VM;
    headerBuffer.writeUInt16LE(targetArch, 8);

    // [10..11] Flags (Mandatory: ONEX_FLAG_ACTUATION_LOCKED)
    let flags = ONEX_FLAG_ACTUATION_LOCKED;
    if (options.flags) {
      flags |= options.flags;
    }
    headerBuffer.writeUInt16LE(flags, 10);

    // [12..15] RSS Max Limit (MB)
    const rssLimit = program.declarativeMetadata?.rssMaxLimitMB ?? options.rssMaxLimitMB ?? 512;
    headerBuffer.writeUInt32LE(rssLimit, 12);

    // [16..19] Entry Point PC
    const entryPC = options.entryPointPC ?? 0;
    headerBuffer.writeUInt32LE(entryPC, 16);

    // [20..23] Instruction Count
    headerBuffer.writeUInt32LE(program.instructions.length, 20);

    // [24..27] Payload Size Bytes
    headerBuffer.writeUInt32LE(payloadBuffer.length, 24);

    // [28..31] Header Checksum: Simple deterministic checksum of bytes 0..27
    let headerSum = 0;
    for (let i = 0; i < 28; i++) {
      headerSum = (headerSum * 31 + headerBuffer[i]) >>> 0;
    }
    headerBuffer.writeUInt32LE(headerSum, 28);

    // [32..63] Payload SHA-256 Digest (32 bytes)
    payloadSha256.copy(headerBuffer, 32, 0, 32);

    // 5. Concatenate Header + Payload
    return Buffer.concat([headerBuffer, payloadBuffer]);
  }

  /**
   * Reads and parses the 64-byte header of an ONEX binary container.
   */
  public static readHeader(buffer: Buffer | Uint8Array): ONEXHeader {
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    if (buf.length < ONEX_HEADER_SIZE) {
      throw new OnePackerError(
        'E8003',
        `Artifact truncated: size is ${buf.length} bytes, expected at least ${ONEX_HEADER_SIZE} bytes for header`
      );
    }

    const magic = buf.slice(0, 4).toString('ascii');
    const formatVersionMajor = buf.readUInt16LE(4);
    const formatVersionMinor = buf.readUInt16LE(6);
    const formatVersionPatch = 0;
    const targetArch = buf.readUInt16LE(8);
    const flags = buf.readUInt16LE(10);
    const rssMaxLimitMB = buf.readUInt32LE(12);
    const entryPointPC = buf.readUInt32LE(16);
    const instructionCount = buf.readUInt32LE(20);
    const payloadSizeBytes = buf.readUInt32LE(24);
    const headerChecksum = buf.readUInt32LE(28);
    const payloadSha256 = buf.slice(32, 64).toString('hex');

    return {
      magic,
      formatVersionMajor,
      formatVersionMinor,
      formatVersionPatch,
      targetArch,
      flags,
      rssMaxLimitMB,
      entryPointPC,
      instructionCount,
      payloadSizeBytes,
      headerChecksum,
      payloadSha256,
    };
  }

  /**
   * Performs fail-closed validation of an ONEX binary artifact before unpacking.
   */
  public static validateArtifact(buffer: Buffer | Uint8Array): ONEXValidationResult {
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

    // 1. Minimum Size Check
    if (buf.length < ONEX_HEADER_SIZE) {
      return {
        valid: false,
        errorCode: 'E8003',
        error: `[E8003: Payload Error] Artifact truncated: buffer size ${buf.length} bytes < minimum header ${ONEX_HEADER_SIZE} bytes`,
      };
    }

    let header: ONEXHeader;
    try {
      header = this.readHeader(buf);
    } catch (err: any) {
      return {
        valid: false,
        errorCode: 'E8003',
        error: err.message,
      };
    }

    // 2. Magic Verification
    if (header.magic !== 'ONEX') {
      return {
        valid: false,
        errorCode: 'E8001',
        error: `[E8001: Format Error] Invalid executable magic: expected 'ONEX', got '${header.magic}'`,
        header,
      };
    }

    // 3. Version Compatibility Check
    if (header.formatVersionMajor !== ONEX_FORMAT_VERSION_MAJOR) {
      return {
        valid: false,
        errorCode: 'E8002',
        error: `[E8002: Version Error] Incompatible executable format version: artifact version v${header.formatVersionMajor}.${header.formatVersionMinor} is not supported by runtime v${ONEX_FORMAT_VERSION_MAJOR}.x`,
        header,
      };
    }

    // 4. Actuation Lockout Invariant Check
    if ((header.flags & ONEX_FLAG_ACTUATION_LOCKED) === 0) {
      return {
        valid: false,
        errorCode: 'E8005',
        error: '[E8005: Safety Violation] Actuation lockout invariant violated: ONEX_FLAG_ACTUATION_LOCKED is not set in header',
        header,
      };
    }

    // 5. Total Length Check
    const expectedTotal = ONEX_HEADER_SIZE + header.payloadSizeBytes;
    if (buf.length !== expectedTotal) {
      return {
        valid: false,
        errorCode: 'E8003',
        error: `[E8003: Payload Error] Payload length mismatch: expected ${expectedTotal} bytes, got ${buf.length} bytes (artifact truncated or appended)`,
        header,
      };
    }

    // 6. Cryptographic Integrity Digest Verification (Tamper Detection)
    const payloadBuffer = buf.slice(ONEX_HEADER_SIZE);
    const actualSha256 = crypto.createHash('sha256').update(payloadBuffer).digest('hex');
    if (actualSha256 !== header.payloadSha256) {
      return {
        valid: false,
        errorCode: 'E8004',
        error: `[E8004: Integrity Error] Artifact payload integrity check failed: expected SHA-256 '${header.payloadSha256}', recomputed '${actualSha256}' (artifact tampered or corrupted)`,
        header,
      };
    }

    return {
      valid: true,
      header,
    };
  }

  /**
   * Unpacks, validates, and deserializes an ONEX binary artifact into a verified UnifiedIRProgram.
   * Throws OnePackerError upon any validation or integrity failure.
   */
  public static unpack(buffer: Buffer | Uint8Array): UnifiedIRProgram {
    const valResult = this.validateArtifact(buffer);
    if (!valResult.valid) {
      throw new OnePackerError(valResult.errorCode || 'E8003', valResult.error || 'Invalid artifact');
    }

    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    const payloadBuffer = buf.slice(ONEX_HEADER_SIZE);
    const payloadString = payloadBuffer.toString('utf8');

    let parsed: any;
    try {
      parsed = JSON.parse(payloadString);
    } catch (err: any) {
      throw new OnePackerError('E8003', `Failed to parse payload JSON: ${err.message}`);
    }

    const program: UnifiedIRProgram = {
      version: parsed.version ?? '1.0.0',
      instructions: parsed.instructions ?? [],
      declarativeMetadata: {
        rssMaxLimitMB: valResult.header?.rssMaxLimitMB ?? parsed.declarativeMetadata?.rssMaxLimitMB ?? 512,
        assertRssLimitMB: parsed.declarativeMetadata?.assertRssLimitMB,
        actuationLock: true,
      },
    };

    // Deep semantic and opcode validation of instructions
    const postValidation = ExecutableValidator.validate(program);
    if (!postValidation.valid) {
      throw new OnePackerError(
        postValidation.errorCode || 'E8007',
        postValidation.error || 'Failed post-unpack validation'
      );
    }

    return program;
  }
}
