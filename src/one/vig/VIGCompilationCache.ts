/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/VIGCompilationCache
 * Specification: VIG Phase 8 Native Integration
 *
 * Content-addressed compilation cache for parsed AST and lowered IR programs.
 * Employs deterministic SHA-256 keys to guarantee zero-stale cache hits and
 * integrates with VIG change detection for selective invalidation.
 */

import * as crypto from 'crypto';
import { UnifiedProgramNode } from '../ast/UnifiedAST';
import { UnifiedIRProgram } from '../ir/UnifiedIR';
import { CompilationCacheMetrics } from './types';
import { VIGCanonicalizer } from './VIGCanonicalizer';

export interface CompilationCacheKeyParams {
  readonly contentHash: string;
  readonly compilerVersion?: string;
  readonly compilerOptions?: Readonly<Record<string, unknown>>;
  readonly importedPublicApiHashes?: Readonly<Record<string, string>>;
}

export interface CachedCompilationArtifact {
  readonly cacheKey?: string;
  readonly contentHash: string;
  readonly compilerVersion?: string;
  readonly compilerOptions?: Readonly<Record<string, unknown>>;
  readonly importedPublicApiHashes?: Readonly<Record<string, string>>;
  readonly filePath: string;
  readonly ast: UnifiedProgramNode;
  readonly ir?: UnifiedIRProgram;
  readonly publicApiHash?: string;
  readonly compiledAt: number;
  readonly sizeBytes: number;
}

export class VIGCompilationCache {
  private readonly cache: Map<string, CachedCompilationArtifact> = new Map();
  private readonly pathToHashes: Map<string, Set<string>> = new Map();

  private hitsCount = 0;
  private missesCount = 0;
  private evictionsCount = 0;
  private readonly maxCapacity: number;

  constructor(maxCapacity: number = 500) {
    this.maxCapacity = maxCapacity;
  }

  public get metrics(): CompilationCacheMetrics {
    const totalRequests = this.hitsCount + this.missesCount;
    const hitRate = totalRequests > 0 ? this.hitsCount / totalRequests : 0;

    return Object.freeze({
      hits: this.hitsCount,
      misses: this.missesCount,
      evictions: this.evictionsCount,
      totalEntries: this.cache.size,
      hitRate: parseFloat(hitRate.toFixed(4)),
    });
  }

  /**
   * Computes a deterministic SHA-256 compilation cache key from content hash,
   * compiler version, compiler options, and imported public API hashes.
   */
  public static computeCacheKey(params: string | CompilationCacheKeyParams): string {
    if (typeof params === 'string') {
      return params;
    }

    const contentHash = params.contentHash;
    const compilerVersion = params.compilerVersion ?? 'v0.1.0-vig';
    const compilerOptions = params.compilerOptions
      ? VIGCanonicalizer.canonicalizeMetadata(params.compilerOptions as Record<string, unknown>)
      : '{}';
    const imports = params.importedPublicApiHashes ?? {};
    const sortedImports = Object.keys(imports)
      .sort()
      .map((k) => `${k}=${imports[k]}`)
      .join(';');

    const payload = `content:${contentHash}|compiler:${compilerVersion}|options:${compilerOptions}|imports:${sortedImports}`;
    return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
  }

  /**
   * Retrieves a cached compilation artifact by its content hash or cache key params.
   */
  public get(keyOrParams: string | CompilationCacheKeyParams): CachedCompilationArtifact | null {
    const key = VIGCompilationCache.computeCacheKey(keyOrParams);
    const entry = this.cache.get(key);
    if (entry) {
      this.hitsCount++;
      return entry;
    }
    this.missesCount++;
    return null;
  }

  /**
   * Checks whether a compilation artifact exists in cache.
   */
  public has(keyOrParams: string | CompilationCacheKeyParams): boolean {
    const key = VIGCompilationCache.computeCacheKey(keyOrParams);
    return this.cache.has(key);
  }

  /**
   * Stores a compiled AST and optional IR artifact keyed by content hash or full cache key.
   */
  public put(
    keyOrParams: string | CompilationCacheKeyParams,
    filePath: string,
    ast: UnifiedProgramNode,
    ir?: UnifiedIRProgram,
    publicApiHash?: string
  ): CachedCompilationArtifact {
    const normPath = VIGCanonicalizer.normalizePath(filePath);
    const key = VIGCompilationCache.computeCacheKey(keyOrParams);
    const contentHash = typeof keyOrParams === 'string' ? keyOrParams : keyOrParams.contentHash;
    const compilerVersion = typeof keyOrParams === 'object' ? keyOrParams.compilerVersion : undefined;
    const compilerOptions = typeof keyOrParams === 'object' ? keyOrParams.compilerOptions : undefined;
    const importedPublicApiHashes = typeof keyOrParams === 'object' ? keyOrParams.importedPublicApiHashes : undefined;

    // Evict oldest if capacity exceeded
    if (this.cache.size >= this.maxCapacity && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.evictionsCount++;
      }
    }

    const artifact: CachedCompilationArtifact = Object.freeze({
      cacheKey: key,
      contentHash,
      compilerVersion,
      compilerOptions,
      importedPublicApiHashes,
      filePath: normPath,
      ast,
      ir,
      publicApiHash,
      compiledAt: Date.now(),
      sizeBytes: JSON.stringify(ast).length + (ir ? JSON.stringify(ir).length : 0),
    });

    this.cache.set(key, artifact);

    // Index path -> contentHashes / keys
    let hashSet = this.pathToHashes.get(normPath);
    if (!hashSet) {
      hashSet = new Set();
      this.pathToHashes.set(normPath, hashSet);
    }
    hashSet.add(key);

    return artifact;
  }

  /**
   * Selectively invalidates cached entries for specific file paths.
   */
  public invalidatePath(filePath: string): number {
    const normPath = VIGCanonicalizer.normalizePath(filePath);
    const hashes = this.pathToHashes.get(normPath);
    if (!hashes || hashes.size === 0) return 0;

    let invalidated = 0;
    for (const h of hashes) {
      if (this.cache.delete(h)) {
        invalidated++;
      }
    }
    this.pathToHashes.delete(normPath);
    return invalidated;
  }

  /**
   * Selectively invalidates cached entries for multiple downstream dependent paths.
   */
  public invalidateDownstreamPaths(paths: readonly string[]): number {
    let totalInvalidated = 0;
    for (const p of paths) {
      totalInvalidated += this.invalidatePath(p);
    }
    return totalInvalidated;
  }

  /**
   * Clears the entire cache.
   */
  public clear(): void {
    this.cache.clear();
    this.pathToHashes.clear();
    this.hitsCount = 0;
    this.missesCount = 0;
    this.evictionsCount = 0;
  }
}
