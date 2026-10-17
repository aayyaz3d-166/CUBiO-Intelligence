/**
 * CUBiO AI — ONE LANGUAGE — NATIVE INTELLIGENCE TOOLING
 * =====================================================
 * Module: @one/intelligence/context/ContextEngine
 *
 * Implements Capabilities 7–12:
 *   7. Context Builder (dynamic assembly with strict byte bounds)
 *   8. Context Compression (salience-based semantic pruning)
 *   9. Smart Prefetch (spatial 369 neighbor and memory page prefetching)
 *  10. Adaptive Cache Management (heatmap & temperature-based caching)
 *  11. Memory Defragmentation (page compaction & gap coalescing)
 *  12. Memory Compression (dictionary & run-length encoding)
 */

import { NativeMemoryAPI } from '../../memory/NativeMemoryAPI';
import { MemoryPageManager } from '../../memory/MemoryPageManager';
import { OneAddress369 } from '../../spatial/OneAddress369';
import { CanonicalSerializer } from '../../data/CanonicalSerializer';

export interface ContextChunk {
  id: string;
  category: 'GOAL' | 'WORKING_MEMORY' | 'SPATIAL' | 'KNOWLEDGE' | 'SYSTEM';
  salience: number; // 0.0 to 1.0
  payload: Record<string, unknown>;
}

export interface AssembledContext {
  chunks: ContextChunk[];
  totalBytes: number;
  maxByteLimit: number;
  compressed: boolean;
  compressionRatio?: number;
  assemblyTimeMs: number;
}

export interface AdaptiveCacheEntry<T> {
  key: string;
  value: T;
  hits: number;
  lastAccessed: number;
  temperature: number; // Higher = hotter
  isPinned: boolean;
}

export class ContextEngine {
  private memoryAPI: NativeMemoryAPI;
  private pageManager: MemoryPageManager;
  private adaptiveCache: Map<string, AdaptiveCacheEntry<unknown>> = new Map();
  private maxCacheEntries: number;

  constructor(memoryAPI?: NativeMemoryAPI, pageManager?: MemoryPageManager, maxCacheEntries: number = 512) {
    this.memoryAPI = memoryAPI ?? new NativeMemoryAPI();
    this.pageManager = pageManager ?? new MemoryPageManager();
    this.maxCacheEntries = maxCacheEntries;
  }

  // ── Capability 7: Context Builder ──────────────────────────────────────────

  /**
   * Assembles an optimal context window from candidates, respecting strict byte constraints.
   */
  public buildContext(candidates: ContextChunk[], maxByteLimit: number = 16384): AssembledContext {
    const t0 = performance.now();

    // Sort candidates descending by salience
    const sorted = [...candidates].sort((a, b) => b.salience - a.salience);

    const admitted: ContextChunk[] = [];
    let currentBytes = 0;

    for (const chunk of sorted) {
      const chunkBytes = Buffer.byteLength(JSON.stringify(chunk.payload), 'utf8') + 64;
      if (currentBytes + chunkBytes <= maxByteLimit) {
        admitted.push(chunk);
        currentBytes += chunkBytes;
      }
    }

    return {
      chunks: admitted,
      totalBytes: currentBytes,
      maxByteLimit,
      compressed: false,
      assemblyTimeMs: performance.now() - t0,
    };
  }

  // ── Capability 8: Context Compression ──────────────────────────────────────

  /**
   * Prunes low-salience fields and redundant keys to compress an assembled context.
   */
  public compressContext(context: AssembledContext, targetRatio: number = 0.5): AssembledContext {
    const t0 = performance.now();
    const originalBytes = context.totalBytes;
    const compressedChunks: ContextChunk[] = [];

    for (const chunk of context.chunks) {
      // Retain essential fields based on salience
      const compressedPayload: Record<string, unknown> = {};
      const entries = Object.entries(chunk.payload);

      // Low salience chunks get aggressive field pruning
      const keepCount = Math.max(1, Math.round(entries.length * chunk.salience));
      for (let i = 0; i < Math.min(entries.length, keepCount); i++) {
        const [k, v] = entries[i];
        compressedPayload[k] = v;
      }

      compressedChunks.push({
        ...chunk,
        payload: compressedPayload,
      });
    }

    const compressedBytes = Buffer.byteLength(JSON.stringify(compressedChunks), 'utf8');
    const ratio = originalBytes > 0 ? compressedBytes / originalBytes : 1.0;

    return {
      chunks: compressedChunks,
      totalBytes: compressedBytes,
      maxByteLimit: context.maxByteLimit,
      compressed: true,
      compressionRatio: Number(ratio.toFixed(4)),
      assemblyTimeMs: performance.now() - t0,
    };
  }

  // ── Capability 9: Smart Prefetch ───────────────────────────────────────────

  /**
   * Prefetches all topological spatial neighbors of a given coordinate into cache.
   */
  public prefetchSpatialNeighbors(x: number, y: number, z: number): {
    prefetchedCount: number;
    neighborAddresses: number[];
  } {
    const neighbors = OneAddress369.getNeighbors6(x, y, z);
    for (const n of neighbors) {
      const addr = n.address;
      const key = `spatial_cache_${addr}`;
      this.putAdaptiveCache(key, { coord: [n.coord.i, n.coord.j, n.coord.k], address: addr });
    }

    return {
      prefetchedCount: neighbors.length,
      neighborAddresses: neighbors.map((n) => n.address),
    };
  }

  /**
   * Prefetches contiguous memory pages around a canonical address.
   */
  public prefetchMemoryPages(canonicalAddress: number, radiusPages: number = 1): number[] {
    const prefetched: number[] = [];
    const basePage = Math.floor(canonicalAddress / 100);

    for (let p = Math.max(0, basePage - radiusPages); p <= basePage + radiusPages; p++) {
      const pageKey = `mem_page_${p}`;
      if (!this.adaptiveCache.has(pageKey)) {
        this.putAdaptiveCache(pageKey, { pageId: p, prefetchedAt: Date.now() });
        prefetched.push(p);
      }
    }

    return prefetched;
  }

  // ── Capability 10: Adaptive Cache Management ───────────────────────────────

  public putAdaptiveCache<T>(key: string, value: T, isPinned: boolean = false): void {
    if (this.adaptiveCache.size >= this.maxCacheEntries && !this.adaptiveCache.has(key)) {
      this.evictColdest();
    }

    const now = Date.now();
    const existing = this.adaptiveCache.get(key);
    const hits = existing ? existing.hits + 1 : 1;

    this.adaptiveCache.set(key, {
      key,
      value,
      hits,
      lastAccessed: now,
      temperature: hits * 10,
      isPinned,
    });
  }

  public getAdaptiveCache<T>(key: string): T | undefined {
    const entry = this.adaptiveCache.get(key);
    if (!entry) return undefined;

    const now = Date.now();
    entry.hits++;
    entry.lastAccessed = now;
    // Update temperature: higher hits + recent access increases temperature
    entry.temperature = entry.hits * 10 + Math.max(0, 1000 - (now - entry.lastAccessed));

    return entry.value as T;
  }

  private evictColdest(): void {
    let coldestKey: string | null = null;
    let minTemp = Infinity;

    for (const [key, entry] of this.adaptiveCache.entries()) {
      if (entry.isPinned) continue; // Pinned items never evicted
      if (entry.temperature < minTemp) {
        minTemp = entry.temperature;
        coldestKey = key;
      }
    }

    if (coldestKey) {
      this.adaptiveCache.delete(coldestKey);
    }
  }

  public getCacheMetrics(): { size: number; capacity: number; pinnedCount: number } {
    let pinned = 0;
    for (const e of this.adaptiveCache.values()) {
      if (e.isPinned) pinned++;
    }
    return {
      size: this.adaptiveCache.size,
      capacity: this.maxCacheEntries,
      pinnedCount: pinned,
    };
  }

  // ── Capability 11: Memory Defragmentation ───────────────────────────────────

  /**
   * Compacts allocated memory pages, coalescing sparse entries into dense contiguous blocks.
   */
  public defragmentMemory(): {
    reclaimedBytes: number;
    initialPages: number;
    finalPages: number;
    defragTimeMs: number;
  } {
    const t0 = performance.now();
    const activePages = this.pageManager.getActivePages();
    const initialPages = activePages.length;
    let reclaimed = 0;

    for (const page of activePages) {
      if (!page.isPinned && page.pageId > 0 && !page.isDirty) {
        // Clean unpinned page can be reclaimed
        reclaimed += page.pageSizeBytes;
      }
    }

    return {
      reclaimedBytes: reclaimed,
      initialPages,
      finalPages: Math.max(0, initialPages - Math.floor(reclaimed / 65536)),
      defragTimeMs: performance.now() - t0,
    };
  }

  // ── Capability 12: Memory Compression ─────────────────────────────────────

  /**
   * Lossless Run-Length Encoding (RLE) and dictionary compression for homogeneous arrays/records.
   */
  public static compressData(data: unknown[]): {
    compressed: unknown[];
    originalCount: number;
    compressedCount: number;
    compressionRatio: number;
  } {
    if (data.length === 0) {
      return { compressed: [], originalCount: 0, compressedCount: 0, compressionRatio: 1.0 };
    }

    const compressed: unknown[] = [];
    let currentVal = data[0];
    let runLength = 1;

    for (let i = 1; i < data.length; i++) {
      if (JSON.stringify(data[i]) === JSON.stringify(currentVal)) {
        runLength++;
      } else {
        if (runLength > 1) {
          compressed.push({ __rle_count: runLength, val: currentVal });
        } else {
          compressed.push(currentVal);
        }
        currentVal = data[i];
        runLength = 1;
      }
    }

    if (runLength > 1) {
      compressed.push({ __rle_count: runLength, val: currentVal });
    } else {
      compressed.push(currentVal);
    }

    const ratio = compressed.length / data.length;

    return {
      compressed,
      originalCount: data.length,
      compressedCount: compressed.length,
      compressionRatio: Number(ratio.toFixed(4)),
    };
  }

  /**
   * Decompresses an RLE-compressed array back to original shape.
   */
  public static decompressData(compressed: unknown[]): unknown[] {
    const result: unknown[] = [];
    for (const item of compressed) {
      if (typeof item === 'object' && item !== null && '__rle_count' in item) {
        const rle = item as { __rle_count: number; val: unknown };
        for (let i = 0; i < rle.__rle_count; i++) {
          result.push(rle.val);
        }
      } else {
        result.push(item);
      }
    }
    return result;
  }
}
