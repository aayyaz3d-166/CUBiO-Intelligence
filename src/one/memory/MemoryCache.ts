/**
 * ONE Language — Native Memory Cache & Eviction Engine
 * =====================================================
 * Module: @one/memory/MemoryCache
 *
 * Implements CACHE and EVICT primitives for low-latency in-memory caching.
 * Employs deterministic LRU / harmonic resonance eviction policies while
 * honoring pinned state guarantees.
 */

import { NativeValue, createNull } from '../runtime/NativeValues';

export interface CacheEntry {
  key: string;
  value: NativeValue;
  sizeBytes: number;
  isPinned: boolean;
  insertedAt: number;
  lastAccessedAt: number;
  accessCount: number;
  harmonicTier: 3 | 6 | 9;
}

export class MemoryCache {
  private entries: Map<string, CacheEntry> = new Map();
  private maxCapacity: number;
  private maxSizeBytes: number;
  private currentSizeBytes: number = 0;
  private hitCount: number = 0;
  private missCount: number = 0;

  constructor(maxCapacity: number = 1000, maxSizeBytes: number = 16 * 1024 * 1024) {
    this.maxCapacity = maxCapacity;
    this.maxSizeBytes = maxSizeBytes;
  }

  /**
   * Caches a key-value entry (CACHE primitive).
   */
  public set(
    key: string,
    value: NativeValue,
    sizeEstimateBytes: number = 128,
    pin: boolean = false,
    harmonicTier: 3 | 6 | 9 = 6
  ): CacheEntry {
    // If key already exists, replace and update size
    const existing = this.entries.get(key);
    if (existing) {
      this.currentSizeBytes -= existing.sizeBytes;
      this.entries.delete(key);
    }

    // Ensure capacity and memory bounds before insertion
    while (
      (this.entries.size >= this.maxCapacity || this.currentSizeBytes + sizeEstimateBytes > this.maxSizeBytes) &&
      this.canEvictAny()
    ) {
      this.evictColdest();
    }

    if (this.currentSizeBytes + sizeEstimateBytes > this.maxSizeBytes) {
      throw new Error(
        `[MemoryCache E7011] Cache byte capacity exceeded (${this.maxSizeBytes} bytes). Cannot cache key '${key}'.`
      );
    }

    const now = Date.now();
    const entry: CacheEntry = {
      key,
      value,
      sizeBytes: sizeEstimateBytes,
      isPinned: pin,
      insertedAt: now,
      lastAccessedAt: now,
      accessCount: 1,
      harmonicTier,
    };

    this.entries.set(key, entry);
    this.currentSizeBytes += sizeEstimateBytes;
    return entry;
  }

  /**
   * Retrieves a cached value, updating access metrics.
   */
  public get(key: string): NativeValue | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      this.missCount++;
      return undefined;
    }

    this.hitCount++;
    entry.lastAccessedAt = Date.now();
    entry.accessCount++;

    // Re-insert to keep LRU order (Map preserves insertion order)
    this.entries.delete(key);
    this.entries.set(key, entry);

    return entry.value;
  }

  /**
   * Checks whether key is cached.
   */
  public has(key: string): boolean {
    return this.entries.has(key);
  }

  /**
   * Explicitly evicts a key from the cache (EVICT primitive).
   */
  public evict(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;

    if (entry.isPinned) {
      throw new Error(`[MemoryCache E7010] Cannot evict pinned cache key '${key}'.`);
    }

    this.currentSizeBytes -= entry.sizeBytes;
    return this.entries.delete(key);
  }

  /**
   * Deterministically evicts the coldest unpinned entry (LRU + Harmonic).
   */
  public evictColdest(): CacheEntry | undefined {
    let candidateKey: string | undefined;
    let lowestScore = Infinity;

    for (const [k, entry] of this.entries.entries()) {
      if (entry.isPinned) continue;

      // Score: Tier priority (3=low, 6=mid, 9=high) combined with access frequency and recency
      const score = entry.harmonicTier * 1000 + entry.accessCount * 10;
      if (score < lowestScore) {
        lowestScore = score;
        candidateKey = k;
      }
    }

    if (!candidateKey) {
      // Fallback to absolute oldest unpinned
      for (const [k, entry] of this.entries.entries()) {
        if (!entry.isPinned) {
          candidateKey = k;
          break;
        }
      }
    }

    if (!candidateKey) return undefined;

    const entry = this.entries.get(candidateKey)!;
    this.currentSizeBytes -= entry.sizeBytes;
    this.entries.delete(candidateKey);
    return entry;
  }

  /**
   * Checks whether any unpinned entry can be evicted.
   */
  public canEvictAny(): boolean {
    for (const entry of this.entries.values()) {
      if (!entry.isPinned) return true;
    }
    return false;
  }

  /**
   * Sets pinned status on an entry.
   */
  public setPinned(key: string, pinned: boolean): void {
    const entry = this.entries.get(key);
    if (entry) {
      entry.isPinned = pinned;
    }
  }

  /**
   * Returns cache metrics.
   */
  public getMetrics(): {
    size: number;
    capacity: number;
    allocatedBytes: number;
    maxBytes: number;
    hits: number;
    misses: number;
    hitRatio: number;
  } {
    const total = this.hitCount + this.missCount;
    return {
      size: this.entries.size,
      capacity: this.maxCapacity,
      allocatedBytes: this.currentSizeBytes,
      maxBytes: this.maxSizeBytes,
      hits: this.hitCount,
      misses: this.missCount,
      hitRatio: total > 0 ? this.hitCount / total : 0,
    };
  }

  /**
   * Clears unpinned entries.
   */
  public clear(includePinned: boolean = false): void {
    if (includePinned) {
      this.entries.clear();
      this.currentSizeBytes = 0;
    } else {
      for (const [k, entry] of Array.from(this.entries.entries())) {
        if (!entry.isPinned) {
          this.currentSizeBytes -= entry.sizeBytes;
          this.entries.delete(k);
        }
      }
    }
  }
}
