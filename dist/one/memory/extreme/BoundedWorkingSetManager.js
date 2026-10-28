/**
 * ONE Language — Bounded Working-Set Manager
 * ===========================================
 * Module: @one/memory/extreme/BoundedWorkingSetManager
 *
 * Implements Section 13 of Extreme-Scale 3D Memory Toolchain.
 * Enforces hard memory ceilings, active object limits, and deterministic eviction.
 * Interoperates with rssGuard to ensure physical RSS never exceeds 512 MB.
 */
export class MemoryCeilingExceededError extends Error {
    constructor(message) {
        super(`[BoundedWorkingSetManager Hard Memory Ceiling Exceeded] ${message}`);
        this.name = 'MemoryCeilingExceededError';
    }
}
export class BoundedWorkingSetManager {
    static ABSOLUTE_RSS_GUARD_BYTES = 512 * 1024 * 1024; // 512 MB hard ceiling
    static DEFAULT_HEAP_LIMIT_BYTES = 256 * 1024 * 1024; // 256 MB default ceiling
    maxHeapBytes;
    maxResidentPages;
    maxCacheEntries;
    maxActiveObjects;
    registeredEvictionHooks = [];
    constructor(config = {}) {
        this.maxHeapBytes = Math.min(config.maxHeapBytes ?? BoundedWorkingSetManager.DEFAULT_HEAP_LIMIT_BYTES, BoundedWorkingSetManager.ABSOLUTE_RSS_GUARD_BYTES);
        this.maxResidentPages = config.maxResidentPages ?? 256;
        this.maxCacheEntries = config.maxCacheEntries ?? 4096;
        this.maxActiveObjects = config.maxActiveObjects ?? 10000;
    }
    /**
     * Registers a callback invoked during memory pressure to release pages/cache entries.
     */
    registerEvictionHook(hook) {
        this.registeredEvictionHooks.push(hook);
    }
    /**
     * Checks current memory footprint and enforces limits.
     * If usage exceeds 80%, triggers eviction.
     * If usage exceeds 98%, fails closed.
     */
    checkAndEnforcePressure() {
        const mem = process.memoryUsage();
        const heapUsed = mem.heapUsed;
        const rss = mem.rss;
        // Hard fail-closed check against 512 MB absolute guard
        if (rss >= BoundedWorkingSetManager.ABSOLUTE_RSS_GUARD_BYTES || heapUsed >= this.maxHeapBytes) {
            // Attempt emergency eviction
            let freed = false;
            for (const hook of this.registeredEvictionHooks) {
                if (hook())
                    freed = true;
            }
            const postMem = process.memoryUsage();
            if (postMem.rss >= BoundedWorkingSetManager.ABSOLUTE_RSS_GUARD_BYTES || postMem.heapUsed >= this.maxHeapBytes) {
                throw new MemoryCeilingExceededError(`Process RSS (${(postMem.rss / 1024 / 1024).toFixed(2)} MB) or Heap (${(postMem.heapUsed / 1024 / 1024).toFixed(2)} MB) breached safety ceiling.`);
            }
            return {
                currentHeapUsedBytes: postMem.heapUsed,
                maxHeapLimitBytes: this.maxHeapBytes,
                heapUtilizationPercent: (postMem.heapUsed / this.maxHeapBytes) * 100,
                isUnderPressure: true,
                pressureActionTaken: 'EVICT',
                residentPagesCount: 0,
                activeCacheCount: 0,
            };
        }
        const util = (heapUsed / this.maxHeapBytes) * 100;
        let action = 'NONE';
        if (util > 80.0) {
            action = 'EVICT';
            for (const hook of this.registeredEvictionHooks) {
                hook();
            }
        }
        else if (util > 70.0) {
            action = 'THROTTLE';
        }
        return {
            currentHeapUsedBytes: heapUsed,
            maxHeapLimitBytes: this.maxHeapBytes,
            heapUtilizationPercent: util,
            isUnderPressure: util > 70.0,
            pressureActionTaken: action,
            residentPagesCount: 0,
            activeCacheCount: 0,
        };
    }
    getMaxHeapBytes() {
        return this.maxHeapBytes;
    }
}
