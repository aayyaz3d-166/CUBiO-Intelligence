/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/VIGChangeScanner
 * Specification: VIG Phase 4 Change Detection & Selective Invalidation
 *
 * Implements three-phase change detection (fast stat filter, content hashing,
 * public vs private classification), explicit ignore rules, and instrumentation.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import {
  VIGManifest,
  VIGFileManifestEntry,
  ChangeDetectionResult,
  FileChangeRecord,
  ChangeScanInstrumentation,
} from './types';
import { VIGCanonicalizer } from './VIGCanonicalizer';
import { VIGModel } from './VIGModel';
import { VIGASTExtractor } from './VIGASTExtractor';

export interface VIGScannerOptions {
  /** Optional custom ignored directory names */
  readonly customIgnoredDirs?: readonly string[];
  /** Optional custom allowed extensions */
  readonly allowedExtensions?: readonly string[];
  /** Whether to verify public API signatures using AST */
  readonly classifyApiChanges?: boolean;
  /**
   * If true, bypasses fast stat filters (mtime/size) and computes SHA-256
   * hashes for all files to guarantee detection of same-size/same-mtime edits.
   */
  readonly forceFullHash?: boolean;
}

export class VIGChangeScanner {
  public static readonly DEFAULT_IGNORED_DIRS: readonly string[] = Object.freeze([
    'node_modules',
    '.git',
    '.vig',
    'dist',
    'build',
    'coverage',
    'tmp',
    'scratch',
  ]);

  public static readonly DEFAULT_ALLOWED_EXTENSIONS: readonly string[] = Object.freeze([
    '.ts',
    '.tsx',
    '.js',
    '.mjs',
    '.cjs',
    '.one',
    '.json',
  ]);

  /**
   * Scans the physical filesystem rooted at `repoRoot` against the active manifest.
   */
  public static scanRepository(
    repoRoot: string,
    manifest: VIGManifest | null,
    options: VIGScannerOptions = {}
  ): ChangeDetectionResult {
    const startMs = performance.now();
    let statChecks = 0;
    let filesReRead = 0;

    const manifestFiles = manifest?.files ?? {};
    const seenPathsOnDisk = new Set<string>();

    const addedFiles: string[] = [];
    const changedFiles: FileChangeRecord[] = [];
    const unchangedFiles: string[] = [];
    const touchOnlyFiles: string[] = [];
    let isPublicApiBreached = false;

    // Collect all candidate files on disk
    const diskFiles = this.collectFilesRecursive(repoRoot, repoRoot, options);

    for (const diskFile of diskFiles) {
      const normPath = diskFile.relPath;
      seenPathsOnDisk.add(normPath);

      statChecks++;
      const currentStat = diskFile.stat;
      const manifestEntry = manifestFiles[normPath];

      if (!manifestEntry) {
        // File added
        filesReRead++;
        const content = fs.readFileSync(diskFile.fullPath, 'utf8');
        const normContent = VIGCanonicalizer.normalizeLineEndings(content);
        const contentHash = crypto.createHash('sha256').update(normContent, 'utf8').digest('hex');
        const isTest = this.isTestPath(normPath);
        const cid = VIGModel.createNode({
          kind: isTest ? 'TEST_SUITE' : 'SOURCE_FILE',
          path: normPath,
          name: path.basename(normPath),
          contentHash,
          isExported: true,
        }).cid;

        const publicApiHash = VIGASTExtractor.computePublicApiHash(content, normPath);

        addedFiles.push(normPath);
        changedFiles.push({
          path: normPath,
          classification: 'FILE_ADDED',
          newEntry: {
            path: normPath,
            mtimeMs: currentStat.mtimeMs,
            ctimeMs: currentStat.ctimeMs,
            ino: currentStat.ino,
            sizeBytes: currentStat.size,
            contentHash,
            cid,
            publicApiHash,
            isTest,
          },
          isPublicApiBreached: true, // New files introduce new declarations
        });
        isPublicApiBreached = true;
        continue;
      }

      // Phase 1: Fast Stat Filter (mtime, ctime, ino, size)
      const mtimeMatch =
        Math.abs(manifestEntry.mtimeMs - currentStat.mtimeMs) < 0.001 ||
        Math.floor(manifestEntry.mtimeMs) === Math.floor(currentStat.mtimeMs);
      const ctimeMatch =
        manifestEntry.ctimeMs === undefined ||
        Math.abs(manifestEntry.ctimeMs - currentStat.ctimeMs) < 0.001 ||
        Math.floor(manifestEntry.ctimeMs) === Math.floor(currentStat.ctimeMs);
      const inoMatch = manifestEntry.ino === undefined || manifestEntry.ino === currentStat.ino;
      const sizeMatch = manifestEntry.sizeBytes === currentStat.size;

      if (!options.forceFullHash && mtimeMatch && ctimeMatch && inoMatch && sizeMatch) {
        // Unchanged fast path: 0 bytes re-read!
        unchangedFiles.push(normPath);
        continue;
      }

      // Phase 2: Content Hash Verification (Stat differed or forceFullHash)
      filesReRead++;
      const content = fs.readFileSync(diskFile.fullPath, 'utf8');
      const normContent = VIGCanonicalizer.normalizeLineEndings(content);
      const currentHash = crypto.createHash('sha256').update(normContent, 'utf8').digest('hex');

      if (currentHash === manifestEntry.contentHash) {
        // Touch-only clean run: mtime touched but content identical
        touchOnlyFiles.push(normPath);
        unchangedFiles.push(normPath);
        continue;
      }

      // Phase 3: Classification (Content actually changed)
      const isTest = this.isTestPath(normPath);
      const currentPublicApiHash = VIGASTExtractor.computePublicApiHash(content, normPath);
      const isSignatureChanged = currentPublicApiHash !== manifestEntry.publicApiHash;

      const classification = isSignatureChanged
        ? 'PUBLIC_API_SIGNATURE_CHANGE'
        : 'PRIVATE_IMPLEMENTATION_CHANGE';

      if (isSignatureChanged) {
        isPublicApiBreached = true;
      }

      const newCid = VIGModel.createNode({
        kind: isTest ? 'TEST_SUITE' : 'SOURCE_FILE',
        path: normPath,
        name: path.basename(normPath),
        contentHash: currentHash,
        isExported: true,
      }).cid;

      changedFiles.push({
        path: normPath,
        classification,
        oldEntry: manifestEntry,
        newEntry: {
          path: normPath,
          mtimeMs: currentStat.mtimeMs,
          ctimeMs: currentStat.ctimeMs,
          ino: currentStat.ino,
          sizeBytes: currentStat.size,
          contentHash: currentHash,
          cid: newCid,
          publicApiHash: currentPublicApiHash,
          isTest,
        },
        isPublicApiBreached: isSignatureChanged,
      });
    }

    // Check for Deleted Files (in manifest but not on disk)
    const deletedFiles: string[] = [];
    for (const manifestPath of Object.keys(manifestFiles)) {
      if (!seenPathsOnDisk.has(manifestPath)) {
        deletedFiles.push(manifestPath);
        isPublicApiBreached = true; // Deleted files break consumers
        changedFiles.push({
          path: manifestPath,
          classification: 'FILE_DELETED',
          oldEntry: manifestFiles[manifestPath],
          isPublicApiBreached: true,
        });
      }
    }

    const durationMs = performance.now() - startMs;
    const isNoOp =
      addedFiles.length === 0 &&
      deletedFiles.length === 0 &&
      changedFiles.length === 0;

    const instrumentation: ChangeScanInstrumentation = {
      filesScanned: diskFiles.length,
      statChecks,
      filesReRead,
      scanDurationMs: durationMs,
    };

    return {
      isNoOp,
      addedFiles: addedFiles.sort(),
      deletedFiles: deletedFiles.sort(),
      changedFiles: changedFiles.sort((a, b) => a.path.localeCompare(b.path)),
      unchangedFiles: unchangedFiles.sort(),
      touchOnlyFiles: touchOnlyFiles.sort(),
      isPublicApiBreached,
      instrumentation,
    };
  }

  /**
   * Scans an in-memory virtual filesystem snapshot for deterministic testing.
   */
  public static scanInMemory(
    files: ReadonlyMap<string, { content: string; mtimeMs: number; ctimeMs?: number; sizeBytes?: number }>,
    manifest: VIGManifest | null,
    options: VIGScannerOptions = {}
  ): ChangeDetectionResult {
    const startMs = performance.now();
    let statChecks = 0;
    let filesReRead = 0;

    const manifestFiles = manifest?.files ?? {};
    const seenPaths = new Set<string>();

    const addedFiles: string[] = [];
    const changedFiles: FileChangeRecord[] = [];
    const unchangedFiles: string[] = [];
    const touchOnlyFiles: string[] = [];
    let isPublicApiBreached = false;

    for (const [rawPath, file] of files.entries()) {
      const normPath = VIGCanonicalizer.normalizePath(rawPath);
      if (this.isIgnored(normPath)) continue;

      seenPaths.add(normPath);
      statChecks++;

      const manifestEntry = manifestFiles[normPath];
      const normContent = VIGCanonicalizer.normalizeLineEndings(file.content);
      const computedSize = file.sizeBytes ?? Buffer.byteLength(normContent, 'utf8');

      if (!manifestEntry) {
        filesReRead++;
        const contentHash = crypto.createHash('sha256').update(normContent, 'utf8').digest('hex');
        const isTest = this.isTestPath(normPath);
        const cid = VIGModel.createNode({
          kind: isTest ? 'TEST_SUITE' : 'SOURCE_FILE',
          path: normPath,
          name: path.basename(normPath),
          contentHash,
          isExported: true,
        }).cid;

        const publicApiHash = VIGASTExtractor.computePublicApiHash(normContent, normPath);
        addedFiles.push(normPath);
        changedFiles.push({
          path: normPath,
          classification: 'FILE_ADDED',
          newEntry: {
            path: normPath,
            mtimeMs: file.mtimeMs,
            ctimeMs: file.ctimeMs,
            sizeBytes: computedSize,
            contentHash,
            cid,
            publicApiHash,
            isTest,
          },
          isPublicApiBreached: true,
        });
        isPublicApiBreached = true;
        continue;
      }

      // Fast stat filter (mtime, ctime, size)
      const mtimeMatch =
        Math.abs(manifestEntry.mtimeMs - file.mtimeMs) < 0.001 ||
        Math.floor(manifestEntry.mtimeMs) === Math.floor(file.mtimeMs);
      const ctimeMatch =
        manifestEntry.ctimeMs === undefined ||
        file.ctimeMs === undefined ||
        Math.abs(manifestEntry.ctimeMs - file.ctimeMs) < 0.001 ||
        Math.floor(manifestEntry.ctimeMs) === Math.floor(file.ctimeMs);
      const sizeMatch = manifestEntry.sizeBytes === computedSize;

      if (!options.forceFullHash && mtimeMatch && ctimeMatch && sizeMatch) {
        unchangedFiles.push(normPath);
        continue;
      }

      // Content Hash Check
      filesReRead++;
      const currentHash = crypto.createHash('sha256').update(normContent, 'utf8').digest('hex');

      if (currentHash === manifestEntry.contentHash) {
        touchOnlyFiles.push(normPath);
        unchangedFiles.push(normPath);
        continue;
      }

      const isTest = this.isTestPath(normPath);
      const currentPublicApiHash = VIGASTExtractor.computePublicApiHash(normContent, normPath);
      const isSignatureChanged = currentPublicApiHash !== manifestEntry.publicApiHash;

      const classification = isSignatureChanged
        ? 'PUBLIC_API_SIGNATURE_CHANGE'
        : 'PRIVATE_IMPLEMENTATION_CHANGE';

      if (isSignatureChanged) {
        isPublicApiBreached = true;
      }

      const newCid = VIGModel.createNode({
        kind: isTest ? 'TEST_SUITE' : 'SOURCE_FILE',
        path: normPath,
        name: path.basename(normPath),
        contentHash: currentHash,
        isExported: true,
      }).cid;

      changedFiles.push({
        path: normPath,
        classification,
        oldEntry: manifestEntry,
        newEntry: {
          path: normPath,
          mtimeMs: file.mtimeMs,
          ctimeMs: file.ctimeMs,
          sizeBytes: computedSize,
          contentHash: currentHash,
          cid: newCid,
          publicApiHash: currentPublicApiHash,
          isTest,
        },
        isPublicApiBreached: isSignatureChanged,
      });
    }

    const deletedFiles: string[] = [];
    for (const manifestPath of Object.keys(manifestFiles)) {
      if (!seenPaths.has(manifestPath)) {
        deletedFiles.push(manifestPath);
        isPublicApiBreached = true;
        changedFiles.push({
          path: manifestPath,
          classification: 'FILE_DELETED',
          oldEntry: manifestFiles[manifestPath],
          isPublicApiBreached: true,
        });
      }
    }

    const durationMs = performance.now() - startMs;
    const isNoOp =
      addedFiles.length === 0 &&
      deletedFiles.length === 0 &&
      changedFiles.length === 0;

    return {
      isNoOp,
      addedFiles: addedFiles.sort(),
      deletedFiles: deletedFiles.sort(),
      changedFiles: changedFiles.sort((a, b) => a.path.localeCompare(b.path)),
      unchangedFiles: unchangedFiles.sort(),
      touchOnlyFiles: touchOnlyFiles.sort(),
      isPublicApiBreached,
      instrumentation: {
        filesScanned: files.size,
        statChecks,
        filesReRead,
        scanDurationMs: durationMs,
      },
    };
  }

  /**
   * Evaluates whether a directory matches explicit ignore rules.
   */
  public static isIgnoredDirectory(
    relPath: string,
    customIgnoredDirs?: readonly string[]
  ): boolean {
    const norm = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
    const segments = norm.split('/');
    const ignoredDirs = customIgnoredDirs ?? this.DEFAULT_IGNORED_DIRS;
    for (const seg of segments) {
      if (ignoredDirs.includes(seg)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Evaluates whether a normalized relative path matches explicit ignore rules.
   */
  public static isIgnored(
    relPath: string,
    customIgnoredDirs?: readonly string[],
    allowedExtensions?: readonly string[]
  ): boolean {
    const norm = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
    const segments = norm.split('/');

    const ignoredDirs = customIgnoredDirs ?? this.DEFAULT_IGNORED_DIRS;
    for (const seg of segments) {
      if (ignoredDirs.includes(seg)) {
        return true;
      }
    }

    // Check extension
    const ext = path.extname(norm).toLowerCase();
    const validExts = allowedExtensions ?? this.DEFAULT_ALLOWED_EXTENSIONS;
    if (!validExts.includes(ext)) {
      return true;
    }

    return false;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private static collectFilesRecursive(
    currentDir: string,
    repoRoot: string,
    options: VIGScannerOptions
  ): { relPath: string; fullPath: string; stat: fs.Stats }[] {
    const results: { relPath: string; fullPath: string; stat: fs.Stats }[] = [];
    if (!fs.existsSync(currentDir)) return results;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return results;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = VIGCanonicalizer.normalizePath(
        path.relative(repoRoot, fullPath),
        repoRoot
      );

      if (entry.isDirectory()) {
        if (!this.isIgnoredDirectory(relPath, options.customIgnoredDirs)) {
          results.push(...this.collectFilesRecursive(fullPath, repoRoot, options));
        }
      } else if (entry.isFile()) {
        if (!this.isIgnored(relPath, options.customIgnoredDirs, options.allowedExtensions)) {
          try {
            const stat = fs.statSync(fullPath);
            results.push({ relPath, fullPath, stat });
          } catch {}
        }
      }
    }

    return results;
  }

  private static isTestPath(relPath: string): boolean {
    const p = relPath.toLowerCase();
    return p.startsWith('tests/') || p.includes('.test.') || p.includes('_test.');
  }
}
