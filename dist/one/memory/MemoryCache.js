/**
 * ONE Language — Native Memory Cache & Eviction Engine
 * =====================================================
 * Module: @one/memory/MemoryCache
 *
 * Implements CACHE and EVICT primitives for low-latency in-memory caching.
 * Employs deterministic LRU / harmonic resonance eviction policies while
 * honoring pinned state guarantees.
 */
export class MemoryCache {
    entries = new Map();
    maxCapacity;
    maxSizeBytes;
    currentSizeBytes = 0;
    hitCount = 0;
    missCount = 0;
    constructor(maxCapacity = 1000, maxSizeBytes = 16 * 1024 * 1024) {
        this.maxCapacity = maxCapacity;
        this.maxSizeBytes = maxSizeBytes;
    }
    /**
     * Caches a key-value entry (CACHE primitive).
     */
    set(key, value, sizeEstimateBytes = 128, pin = false, harmonicTier = 6) {
        // If key already exists, replace and update size
        const existing = this.entries.get(key);
        if (existing) {
            this.currentSizeBytes -= existing.sizeBytes;
            this.entries.delete(key);
        }
        // Ensure capacity and memory bounds before insertion
        while ((this.entries.size >= this.maxCapacity || this.currentSizeBytes + sizeEstimateBytes > this.maxSizeBytes) &&
            this.canEvictAny()) {
            this.evictColdest();
        }
        if (this.currentSizeBytes + sizeEstimateBytes > this.maxSizeBytes) {
            throw new Error(`[MemoryCache E7011] Cache byte capacity exceeded (${this.maxSizeBytes} bytes). Cannot cache key '${key}'.`);
        }
        const now = Date.now();
        const entry = {
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
    get(key) {
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
    has(key) {
        return this.entries.has(key);
    }
    /**
     * Explicitly evicts a key from the cache (EVICT primitive).
     */
    evict(key) {
        const entry = this.entries.get(key);
        if (!entry)
            return false;
        if (entry.isPinned) {
            throw new Error(`[MemoryCache E7010] Cannot evict pinned cache key '${key}'.`);
        }
        this.currentSizeBytes -= entry.sizeBytes;
        return this.entries.delete(key);
    }
    /**
     * Deterministically evicts the coldest unpinned entry (LRU + Harmonic).
     */
    evictColdest() {
        let candidateKey;
        let lowestScore = Infinity;
        for (const [k, entry] of this.entries.entries()) {
            if (entry.isPinned)
                continue;
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
        if (!candidateKey)
            return undefined;
        const entry = this.entries.get(candidateKey);
        this.currentSizeBytes -= entry.sizeBytes;
        this.entries.delete(candidateKey);
        return entry;
    }
    /**
     * Checks whether any unpinned entry can be evicted.
     */
    canEvictAny() {
        for (const entry of this.entries.values()) {
            if (!entry.isPinned)
                return true;
        }
        return false;
    }
    /**
     * Sets pinned status on an entry.
     */
    setPinned(key, pinned) {
        const entry = this.entries.get(key);
        if (entry) {
            entry.isPinned = pinned;
        }
    }
    /**
     * Returns cache metrics.
     */
    getMetrics() {
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
    clear(includePinned = false) {
        if (includePinned) {
            this.entries.clear();
            this.currentSizeBytes = 0;
        }
        else {
            for (const [k, entry] of Array.from(this.entries.entries())) {
                if (!entry.isPinned) {
                    this.currentSizeBytes -= entry.sizeBytes;
                    this.entries.delete(k);
                }
            }
        }
    }
}
