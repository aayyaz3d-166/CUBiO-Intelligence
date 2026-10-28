/**
 * ONE Language — Deterministic Canonical Serializer
 * ==================================================
 * Module: @one/data/CanonicalSerializer
 *
 * Deterministic, bit-exact data serialization producing zero variance
 * across execution replays. Incorporates CUBiO 0x369_DATA envelope sealing.
 *
 * Invariants:
 *   - Object keys are recursively sorted lexicographically
 *   - Numbers are normalized to eliminate IEEE-754 formatting divergence
 *   - Every payload is anchored with a SHA-256 integrity hash
 */

import * as crypto from 'crypto';

export interface SerializedEnvelope {
  magic: '0x369_DATA';
  version: '1.0.0';
  payloadHash: string;
  byteLength: number;
  payload: string; // Canonical JSON string
}

export class CanonicalSerializer {
  public static readonly MAGIC = '0x369_DATA';
  public static readonly VERSION = '1.0.0';

  /**
   * Deterministically serializes any JavaScript / One value to a canonical JSON string.
   */
  public static serializeCanonicalJSON(val: unknown): string {
    if (val === null || val === undefined) {
      return 'null';
    }
    if (typeof val === 'boolean') {
      return val ? 'true' : 'false';
    }
    if (typeof val === 'number') {
      if (!Number.isFinite(val)) {
        return 'null';
      }
      // Eliminate -0
      const n = Object.is(val, -0) ? 0 : val;
      return String(n);
    }
    if (typeof val === 'string') {
      return JSON.stringify(val);
    }
    if (Array.isArray(val)) {
      const items = val.map((el) => this.serializeCanonicalJSON(el));
      return `[${items.join(',')}]`;
    }
    if (val instanceof Uint8Array) {
      const hex = Buffer.from(val).toString('hex');
      return JSON.stringify({ $type: 'ByteBuffer', hex });
    }
    if (typeof val === 'object') {
      const rec = val as Record<string, unknown>;
      const sortedKeys = Object.keys(rec).sort();
      const entries = sortedKeys.map(
        (k) => `${JSON.stringify(k)}:${this.serializeCanonicalJSON(rec[k])}`
      );
      return `{${entries.join(',')}}`;
    }
    return JSON.stringify(String(val));
  }

  /**
   * Encapsulates a value into a sealed CUBiO 0x369_DATA envelope.
   */
  public static packEnvelope(val: unknown): SerializedEnvelope {
    const payload = this.serializeCanonicalJSON(val);
    const byteLength = Buffer.from(payload, 'utf-8').length;
    const payloadHash = `0xHASH_${crypto
      .createHash('sha256')
      .update(payload)
      .digest('hex')
      .substring(0, 16)
      .toUpperCase()}`;

    return {
      magic: this.MAGIC,
      version: this.VERSION,
      payloadHash,
      byteLength,
      payload,
    };
  }

  /**
   * Unpacks a sealed envelope, verifying hash integrity and returning parsed data.
   */
  public static unpackEnvelope(envelope: SerializedEnvelope): unknown {
    if (envelope.magic !== this.MAGIC) {
      throw new Error(`[CanonicalSerializer Error] Invalid envelope magic: expected ${this.MAGIC}, got ${envelope.magic}`);
    }

    const expectedHash = `0xHASH_${crypto
      .createHash('sha256')
      .update(envelope.payload)
      .digest('hex')
      .substring(0, 16)
      .toUpperCase()}`;

    if (envelope.payloadHash !== expectedHash) {
      throw new Error(
        `[CanonicalSerializer Error] Envelope tampering detected: hash mismatch (${envelope.payloadHash} != ${expectedHash})`
      );
    }

    return JSON.parse(envelope.payload);
  }

  /**
   * Encodes envelope into a binary Buffer with fixed 60-byte header + UTF-8 payload.
   */
  public static toBinaryBuffer(val: unknown): Buffer {
    const env = this.packEnvelope(val);
    const payloadBuf = Buffer.from(env.payload, 'utf-8');

    // Header: MAGIC (16 bytes) + VERSION (8 bytes) + HASH (32 bytes) + LEN (4 bytes uint32) = 60 bytes
    const header = Buffer.alloc(60);
    header.write(env.magic, 0, 16, 'utf-8');
    header.write(env.version, 16, 8, 'utf-8');
    header.write(env.payloadHash, 24, 32, 'utf-8');
    header.writeUInt32BE(payloadBuf.length, 56);

    return Buffer.concat([header, payloadBuf]);
  }

  /**
   * Decodes binary Buffer and verifies integrity.
   */
  public static fromBinaryBuffer(buffer: Buffer): unknown {
    if (buffer.length < 60) {
      throw new Error('[CanonicalSerializer Error] Buffer too short to contain canonical header.');
    }

    const magic = buffer.toString('utf-8', 0, 16).replace(/\0/g, '').trim();
    const version = buffer.toString('utf-8', 16, 24).replace(/\0/g, '').trim();
    const payloadHash = buffer.toString('utf-8', 24, 56).replace(/\0/g, '').trim();
    const payloadLen = buffer.readUInt32BE(56);

    const payloadBuf = buffer.subarray(60, 60 + payloadLen);
    const payload = payloadBuf.toString('utf-8');

    return this.unpackEnvelope({
      magic: magic as '0x369_DATA',
      version: version as '1.0.0',
      payloadHash,
      byteLength: payloadLen,
      payload,
    });
  }
}
