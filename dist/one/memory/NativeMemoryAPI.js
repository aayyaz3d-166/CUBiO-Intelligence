/**
 * ONE Language — Native Memory API Coordinator
 * =============================================
 * Module: @one/memory/NativeMemoryAPI
 *
 * Implements the full suite of native memory primitives:
 *   - STORE     : Persistent VDB record insertion with spatial anchoring
 *   - LOAD      : Tiered L1 cache / L2 VDB retrieval with automatic promotion
 *   - REFERENCE : Safe reference handle creation with permission controls
 *   - UPDATE    : Sovereign atomic mutation enforcing OCC version validation
 *   - CACHE     : Fast-access memory caching with harmonic priority tiers
 *   - PAGE      : Bounded 64 KB paged memory allocation with spatial alignment
 *   - EVICT     : Deterministic LRU / harmonic cache eviction honoring pins
 */
import { NativeVDB } from './NativeVDB';
import { MemoryPageManager } from './MemoryPageManager';
import { OCCManager } from './OCCManager';
import { MemoryCache } from './MemoryCache';
import { createNull } from '../runtime/NativeValues';
import { CanonicalRef } from '../data/CanonicalRef';
export class NativeMemoryAPI {
    vdb;
    cache;
    pageManager;
    occ;
    spatialBridge;
    is_actuation_blocked = true; // Permanent sovereign safety invariant
    constructor(config = {}, spatialBridge) {
        this.vdb = new NativeVDB(config.maxVdbBytes ?? 64 * 1024 * 1024);
        this.cache = new MemoryCache(config.maxCacheEntries ?? 1000, config.maxCacheBytes ?? 16 * 1024 * 1024);
        this.pageManager = new MemoryPageManager(config.maxPages ?? 256, config.pageSizeBytes ?? MemoryPageManager.DEFAULT_PAGE_SIZE);
        this.occ = new OCCManager();
        this.spatialBridge = spatialBridge;
    }
    // ── 1. STORE Primitive ─────────────────────────────────────────────────────
    /**
     * STORE: Persists a record into VDB, indexes canonical address, and registers initial OCC version.
     */
    store(id, payload, vector = [0, 0, 0], canonicalAddress, spatialCoord) {
        const record = this.vdb.insert(id, vector, payload, canonicalAddress, spatialCoord);
        // Register OCC tracking
        this.occ.register(id, record.version, record.stateHash);
        // Warm L1 cache
        this.cache.set(id, payload, record.vector.byteLength + 128);
        return {
            id: record.id,
            version: record.version,
            stateHash: record.stateHash,
            canonicalAddress: record.canonicalAddress,
            dimension: record.dimension,
            byteSize: record.vector.byteLength + 256,
        };
    }
    // ── 2. LOAD Primitive ──────────────────────────────────────────────────────
    /**
     * LOAD: Retrieves value by ID, checking L1 cache first, then falling back to L2 VDB.
     */
    load(id) {
        // 1. Try L1 Cache
        const cached = this.cache.get(id);
        if (cached)
            return cached;
        // 2. Try L2 VDB
        const record = this.vdb.get(id);
        if (record) {
            // Promote to L1 cache
            this.cache.set(id, record.payload, record.vector.byteLength + 128);
            return record.payload;
        }
        return undefined;
    }
    /**
     * Loads a record by Canonical Address [26..368].
     */
    loadByAddress(canonicalAddress) {
        const record = this.vdb.getByAddress(canonicalAddress);
        if (record) {
            return record.payload;
        }
        return undefined;
    }
    /**
     * Searches VDB by vector similarity.
     */
    searchSimilarity(vector, topK = 5) {
        return this.vdb.search(vector, topK);
    }
    // ── 3. REFERENCE Primitive ─────────────────────────────────────────────────
    /**
     * REFERENCE: Creates a sovereign CanonicalRef handle to a VDB record, spatial voxel, or canonical address.
     */
    reference(targetType, target, permission = 'READ_WRITE') {
        if (targetType === 'RECORD') {
            const id = String(target);
            return CanonicalRef.createHeapRef(`one://vdb/${id}`, {
                getter: () => this.load(id) ?? createNull(),
                setter: (v) => {
                    this.update(id, v);
                },
            }, permission);
        }
        if (targetType === 'SPATIAL_VOXEL') {
            if (!this.spatialBridge) {
                throw new Error('[NativeMemoryAPI Error] SpatialBridge not attached to memory coordinator.');
            }
            const coord = target;
            return CanonicalRef.createSpatialRef(coord.i, coord.j, coord.k, this.spatialBridge, permission);
        }
        if (targetType === 'CANONICAL_ADDRESS') {
            if (!this.spatialBridge) {
                throw new Error('[NativeMemoryAPI Error] SpatialBridge not attached to memory coordinator.');
            }
            const addr = Number(target);
            return CanonicalRef.createAddressRef(addr, this.spatialBridge, permission);
        }
        throw new Error(`[NativeMemoryAPI Error] Unsupported reference target type '${targetType}'.`);
    }
    // ── 4. UPDATE Primitive ────────────────────────────────────────────────────
    /**
     * UPDATE: Sovereign atomic mutation enforcing OCC version validation.
     */
    update(id, newPayload, newVector, expectedVersion) {
        const record = this.vdb.get(id);
        if (!record) {
            throw new Error(`[NativeMemoryAPI Error] Cannot update nonexistent record '${id}'.`);
        }
        const expVer = expectedVersion ?? record.version;
        // Validate OCC
        this.occ.verifyAndBump(id, expVer);
        // Update VDB
        const updated = this.vdb.update(id, newPayload, newVector, expVer);
        // Refresh L1 Cache
        this.cache.set(id, newPayload, updated.vector.byteLength + 128);
        return {
            id: updated.id,
            version: updated.version,
            stateHash: updated.stateHash,
            canonicalAddress: updated.canonicalAddress,
            dimension: updated.dimension,
            byteSize: updated.vector.byteLength + 256,
        };
    }
    // ── 5. CACHE Primitive ─────────────────────────────────────────────────────
    /**
     * CACHE: Explicit fast caching with harmonic tier.
     */
    cacheValue(key, value, sizeBytes = 128, pin = false, harmonicTier = 6) {
        return this.cache.set(key, value, sizeBytes, pin, harmonicTier);
    }
    // ── 6. PAGE Primitive ──────────────────────────────────────────────────────
    /**
     * PAGE: Allocates discrete 64 KB memory page.
     */
    allocatePage(canonicalAddressRange = [0, 0], pin = false) {
        return this.pageManager.allocatePage(canonicalAddressRange, pin);
    }
    /**
     * Accesses paged memory manager.
     */
    getPageManager() {
        return this.pageManager;
    }
    // ── 7. EVICT Primitive ─────────────────────────────────────────────────────
    /**
     * EVICT: Evicts a specific key or coldest entry from cache.
     */
    evict(key) {
        if (key !== undefined) {
            return this.cache.evict(key);
        }
        return this.cache.evictColdest() !== undefined;
    }
    // ── Diagnostics & Resource Ceilings ────────────────────────────────────────
    /**
     * Summary of memory consumption across all tiers.
     */
    getMemoryUsage() {
        const vdbBytes = this.vdb.getAllocatedBytes();
        const cacheMetrics = this.cache.getMetrics();
        const pagedBytes = this.pageManager.getTotalPagedBytes();
        return {
            vdbAllocatedBytes: vdbBytes,
            cacheAllocatedBytes: cacheMetrics.allocatedBytes,
            pagedAllocatedBytes: pagedBytes,
            totalAllocatedBytes: vdbBytes + cacheMetrics.allocatedBytes + pagedBytes,
            vdbRecordsCount: this.vdb.size(),
            cacheEntriesCount: cacheMetrics.size,
            pagesCount: this.pageManager.pageCount(),
        };
    }
    getOCCManager() {
        return this.occ;
    }
    getCache() {
        return this.cache;
    }
    getVDB() {
        return this.vdb;
    }
}
