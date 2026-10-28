/**
 * ONE Language — Extreme Spatial Lookup Engine
 * =============================================
 * Module: @one/memory/extreme/ExtremeSpatialLookupEngine
 *
 * Implements Section 5 of Extreme-Scale 3D Memory Toolchain.
 * Provides direct O(1) mathematical lookup without full-space scanning.
 * Includes a bounded LRU cache for resolved entry descriptors.
 */
import { SpatialPointerEngine369 } from './369SpatialPointerEngine';
import { VirtualScaleAddressEngine } from './VirtualScaleAddressEngine';
export class ExtremeSpatialLookupEngine {
    addressEngine;
    lruCache = new Map();
    maxCacheEntries;
    // Latency telemetry
    totalLookups = 0;
    cacheHits = 0;
    cacheMisses = 0;
    recentLatenciesMicros;
    latencyRingIdx = 0;
    static LATENCY_SAMPLE_SIZE = 10000;
    constructor(addressEngine, maxCacheEntries = 4096) {
        this.addressEngine = addressEngine ?? new VirtualScaleAddressEngine();
        this.maxCacheEntries = maxCacheEntries;
        this.recentLatenciesMicros = new Float64Array(ExtremeSpatialLookupEngine.LATENCY_SAMPLE_SIZE);
    }
    /**
     * Direct O(1) mathematical lookup of a virtual address into its canonical 369 spatial pointer.
     * Fail-closed on invalid addresses.
     */
    lookup(virtualAddress) {
        const startNano = process.hrtime.bigint();
        // 1. Fail-closed address bounds check
        this.addressEngine.validateAddress(virtualAddress);
        const cacheKey = virtualAddress.toString(16);
        let pointer = this.lruCache.get(cacheKey);
        let isHit = false;
        if (pointer) {
            isHit = true;
            this.cacheHits++;
            // Promote in LRU (re-insert)
            this.lruCache.delete(cacheKey);
            this.lruCache.set(cacheKey, pointer);
        }
        else {
            this.cacheMisses++;
            // Direct O(1) mathematical resolution: NO SCAN
            pointer = SpatialPointerEngine369.virtualAddressToPointer(virtualAddress);
            // Enforce bounded cache size with LRU eviction
            if (this.lruCache.size >= this.maxCacheEntries) {
                const oldestKey = this.lruCache.keys().next().value;
                if (oldestKey !== undefined) {
                    this.lruCache.delete(oldestKey);
                }
            }
            this.lruCache.set(cacheKey, pointer);
        }
        const endNano = process.hrtime.bigint();
        const latencyMicros = Number(endNano - startNano) / 1000.0;
        // Track latency sample
        this.totalLookups++;
        this.recentLatenciesMicros[this.latencyRingIdx] = latencyMicros;
        this.latencyRingIdx = (this.latencyRingIdx + 1) % ExtremeSpatialLookupEngine.LATENCY_SAMPLE_SIZE;
        return {
            queryAddress: virtualAddress,
            canonicalAddress: pointer.canonicalAddress,
            cellId: pointer.cellId,
            coord: pointer.coord,
            pointer,
            isCacheHit: isHit,
            lookupLatencyMicros: latencyMicros,
        };
    }
    /**
     * Batch lookup returning structured results and benchmark metrics.
     */
    lookupBatch(addresses) {
        const len = addresses.length;
        const results = new Array(len);
        for (let i = 0; i < len; i++) {
            results[i] = this.lookup(addresses[i]);
        }
        return results;
    }
    /**
     * Direct lookup by canonical spatial cellId [0..342].
     */
    lookupByCellId(cellId) {
        const coord = SpatialPointerEngine369.cellIdToCoord(cellId);
        const ptr = SpatialPointerEngine369.createPointerFromCoord(coord.i, coord.j, coord.k);
        return SpatialPointerEngine369.resolvePointer(ptr);
    }
    /**
     * Calculates comprehensive latency percentiles and cache statistics.
     */
    getStats() {
        const validSamplesCount = Math.min(this.totalLookups, ExtremeSpatialLookupEngine.LATENCY_SAMPLE_SIZE);
        let mean = 0;
        if (validSamplesCount > 0) {
            const samples = Array.from(this.recentLatenciesMicros.subarray(0, validSamplesCount)).sort((a, b) => a - b);
            const sum = samples.reduce((acc, v) => acc + v, 0);
            mean = sum / validSamplesCount;
            const p95Idx = Math.floor(validSamplesCount * 0.95);
            const p99Idx = Math.floor(validSamplesCount * 0.99);
            const hitRatio = this.totalLookups > 0 ? this.cacheHits / this.totalLookups : 0;
            return {
                totalLookups: this.totalLookups,
                cacheHits: this.cacheHits,
                cacheMisses: this.cacheMisses,
                cacheHitRatio: hitRatio,
                meanLatencyMicros: mean,
                p95LatencyMicros: samples[p95Idx] ?? samples[validSamplesCount - 1],
                p99LatencyMicros: samples[p99Idx] ?? samples[validSamplesCount - 1],
                activeCacheEntries: this.lruCache.size,
                maxCacheEntries: this.maxCacheEntries,
            };
        }
        return {
            totalLookups: 0,
            cacheHits: 0,
            cacheMisses: 0,
            cacheHitRatio: 0,
            meanLatencyMicros: 0,
            p95LatencyMicros: 0,
            p99LatencyMicros: 0,
            activeCacheEntries: 0,
            maxCacheEntries: this.maxCacheEntries,
        };
    }
    /**
     * Clears the lookup cache.
     */
    clearCache() {
        this.lruCache.clear();
    }
}
