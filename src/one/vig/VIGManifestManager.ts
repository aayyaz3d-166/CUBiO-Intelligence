/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/VIGManifestManager
 * Specification: VIG Phase 4 Change Detection & Selective Invalidation
 *
 * Implements repository-relative manifest persistence, Merkle root sealing,
 * fail-closed corruption detection, and Windows-compatible atomic file replacement.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import {
  VIGManifest,
  VIGFileManifestEntry,
  VIGIntegrityError,
  VIGValidationError,
} from './types';
import { VIGCanonicalizer } from './VIGCanonicalizer';

export class VIGManifestManager {
  public static readonly DEFAULT_MANIFEST_DIR = '.vig';
  public static readonly DEFAULT_MANIFEST_FILE = '.vig/manifest.json';
  public static readonly CURRENT_SCHEMA_VERSION = 1;

  /**
   * Computes the deterministic Merkle root seal across all sorted manifest entries.
   */
  public static computeManifestSeal(
    files: Readonly<Record<string, VIGFileManifestEntry>>
  ): string {
    const sortedPaths = Object.keys(files).sort();
    const fragments: string[] = [];
    for (const p of sortedPaths) {
      const e = files[p];
      fragments.push(`${e.path}:${e.mtimeMs}:${e.sizeBytes}:${e.contentHash}:${e.publicApiHash}`);
    }
    const payload = fragments.join('\n');
    return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
  }

  /**
   * Constructs an immutable, sealed VIGManifest record from a file entry map.
   */
  public static createManifest(
    files: Record<string, VIGFileManifestEntry>,
    indexedAt: number = Date.now()
  ): VIGManifest {
    const manifestRootSeal = this.computeManifestSeal(files);
    return Object.freeze({
      schemaVersion: this.CURRENT_SCHEMA_VERSION,
      manifestRootSeal,
      indexedAt,
      fileCount: Object.keys(files).length,
      files: Object.freeze({ ...files }),
    });
  }

  /**
   * Loads and validates the manifest from disk.
   * - Returns null if the manifest file does not exist.
   * - Throws VIGIntegrityError if the file is corrupted, unparseable,
   *   has an unsupported schemaVersion, or fails Merkle root seal verification.
   */
  public static loadManifest(manifestPath?: string): VIGManifest | null {
    const targetPath = manifestPath ?? this.DEFAULT_MANIFEST_FILE;
    if (!fs.existsSync(targetPath)) {
      return null;
    }

    let rawText: string;
    try {
      rawText = fs.readFileSync(targetPath, 'utf8');
    } catch (err: any) {
      throw new VIGIntegrityError(`Failed to read manifest file "${targetPath}": ${err.message}`);
    }

    let payload: VIGManifest;
    try {
      payload = JSON.parse(rawText) as VIGManifest;
    } catch (err: any) {
      throw new VIGIntegrityError(
        `Failed to parse manifest JSON at "${targetPath}": ${err.message}. Manifest is corrupt.`
      );
    }

    if (!payload || typeof payload !== 'object') {
      throw new VIGIntegrityError(`Manifest at "${targetPath}" is malformed or empty.`);
    }

    if (payload.schemaVersion !== this.CURRENT_SCHEMA_VERSION) {
      throw new VIGIntegrityError(
        `Unsupported manifest schema version: ${payload.schemaVersion} (expected ${this.CURRENT_SCHEMA_VERSION})`
      );
    }

    if (!payload.files || typeof payload.files !== 'object' || Array.isArray(payload.files)) {
      throw new VIGIntegrityError(
        `Manifest at "${targetPath}" has invalid or missing "files" dictionary.`
      );
    }

    if (typeof payload.manifestRootSeal !== 'string' || !/^[a-f0-9]{64}$/.test(payload.manifestRootSeal)) {
      throw new VIGIntegrityError(
        `Manifest at "${targetPath}" is missing a valid 64-character Merkle root seal.`
      );
    }

    // Verify cryptographic Merkle root seal
    const expectedSeal = this.computeManifestSeal(payload.files);
    if (payload.manifestRootSeal !== expectedSeal) {
      throw new VIGIntegrityError(
        `Cryptographic manifest root seal mismatch! Expected: "${expectedSeal}", got: "${payload.manifestRootSeal}". Manifest payload is tampered or corrupted.`
      );
    }

    return Object.freeze(payload);
  }

  /**
   * Atomically saves the manifest using Windows-compatible temporary file replacement.
   */
  public static saveManifest(
    manifest: VIGManifest,
    manifestPath?: string
  ): void {
    if (!manifest || manifest.schemaVersion !== this.CURRENT_SCHEMA_VERSION) {
      throw new VIGValidationError('Attempted to save an invalid or unversioned VIGManifest');
    }

    const targetPath = manifestPath ?? this.DEFAULT_MANIFEST_FILE;
    const targetDir = path.dirname(targetPath);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Clean up orphaned temp files older than 60 seconds
    this.cleanStaleTempFiles(targetDir);

    const tempPath = path.join(
      targetDir,
      `manifest.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).substring(2, 8)}`
    );

    const serialized = JSON.stringify(manifest, null, 2);
    fs.writeFileSync(tempPath, serialized, 'utf8');

    this.atomicReplaceFileSync(tempPath, targetPath);
  }

  /**
   * Windows-compatible atomic file replacement protocol with retry backoff.
   */
  public static atomicReplaceFileSync(
    tempPath: string,
    targetPath: string,
    maxRetries: number = 5
  ): void {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        fs.renameSync(tempPath, targetPath);
        return;
      } catch (err: any) {
        if (
          (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES') &&
          attempt < maxRetries - 1
        ) {
          // Synchronous sleep using Atomics.wait if possible, or busy wait
          try {
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10 * Math.pow(2, attempt));
          } catch {
            const start = Date.now();
            while (Date.now() - start < 10 * Math.pow(2, attempt)) {
              // busy wait
            }
          }
          continue;
        }

        // Fallback: Copy and unlink on persistent Windows NTFS locks
        try {
          fs.copyFileSync(tempPath, targetPath);
          try {
            fs.unlinkSync(tempPath);
          } catch {}
          return;
        } catch (copyErr: any) {
          if (attempt === maxRetries - 1) {
            throw new VIGIntegrityError(
              `Failed atomic file replacement for "${targetPath}": ${copyErr.message}`
            );
          }
        }
      }
    }
  }

  /**
   * Cleans up stale temp files left behind by interrupted process runs.
   */
  public static cleanStaleTempFiles(dir: string, maxAgeMs: number = 60000): void {
    if (!fs.existsSync(dir)) return;
    try {
      const files = fs.readdirSync(dir);
      const now = Date.now();
      for (const file of files) {
        if (file.includes('.tmp.')) {
          const filePath = path.join(dir, file);
          try {
            const stat = fs.statSync(filePath);
            if (now - stat.mtimeMs > maxAgeMs) {
              fs.unlinkSync(filePath);
            }
          } catch {}
        }
      }
    } catch {}
  }
}
