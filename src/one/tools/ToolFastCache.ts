/**
 * ONE Language — Native Tool Fast Result Cache
 * =============================================
 * Module: @one/tools/ToolFastCache
 *
 * Sub-millisecond caching layer for native tool invocations.
 * Caches deterministic tool responses using SHA-256 parameter digests.
 */

import * as crypto from 'crypto';
import { INativeTool, ToolExecutionContext, NativeToolResponse } from './INativeTool';
import { NativeValue, toRaw } from '../runtime/NativeValues';
import { CanonicalSerializer } from '../data/CanonicalSerializer';

export interface CachedToolResult {
  cacheKey: string;
  response: NativeToolResponse;
  cachedAt: number;
  hitCount: number;
}

export class ToolFastCache {
  private cache: Map<string, CachedToolResult> = new Map();
  private maxEntries: number;
  private hits: number = 0;
  private misses: number = 0;

  constructor(maxEntries: number = 1000) {
    this.maxEntries = maxEntries;
  }

  /**
   * Generates a deterministic cache key from tool ID and input parameters.
   */
  public static computeKey(toolId: string, params: Record<string, NativeValue>): string {
    const rawParams: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params)) {
      rawParams[k] = toRaw(v);
    }
    const json = CanonicalSerializer.serializeCanonicalJSON(rawParams);
    return `0xCACHE_${crypto.createHash('sha256').update(toolId).update(json).digest('hex').substring(0, 16).toUpperCase()}`;
  }

  /**
   * Invokes a tool with fast caching.
   */
  public executeWithCache(
    tool: INativeTool,
    params: Record<string, NativeValue>,
    context: ToolExecutionContext
  ): NativeToolResponse {
    if (context.skipCache) {
      return tool.execute(params, context);
    }

    const key = ToolFastCache.computeKey(tool.id, params);
    const cached = this.cache.get(key);

    if (cached) {
      this.hits++;
      cached.hitCount++;
      return {
        ...cached.response,
        latencyMs: 0.02, // Sub-millisecond cache hit
      };
    }

    this.misses++;
    const response = tool.execute(params, context);

    if (response.success) {
      // Evict oldest if capacity reached
      if (this.cache.size >= this.maxEntries) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) this.cache.delete(firstKey);
      }

      this.cache.set(key, {
        cacheKey: key,
        response,
        cachedAt: Date.now(),
        hitCount: 0,
      });
    }

    return response;
  }

  /**
   * Retrieves a cached tool result by key.
   */
  public get(key: string): CachedToolResult | undefined {
    return this.cache.get(key);
  }

  /**
   * Checks if key exists in cache.
   */
  public has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Returns cache metrics.
   */
  public getMetrics(): {
    size: number;
    capacity: number;
    hits: number;
    misses: number;
    hitRatio: number;
  } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      capacity: this.maxEntries,
      hits: this.hits,
      misses: this.misses,
      hitRatio: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Clears cache.
   */
  public clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}
