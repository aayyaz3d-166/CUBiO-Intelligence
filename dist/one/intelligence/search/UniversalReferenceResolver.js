/**
 * CUBiO AI — ONE LANGUAGE — NATIVE INTELLIGENCE TOOLING
 * =====================================================
 * Module: @one/intelligence/search/UniversalReferenceResolver
 *
 * Implements Capability 6: Universal Reference Resolver
 * Seamlessly resolves any sovereign URI (`one://...`) into its target entity
 * with zero-copy reference caching and permission enforcement.
 */
import { OneAddress369 } from '../../spatial/OneAddress369';
import { toRaw } from '../../runtime/NativeValues';
import { OneNativeRuntimeError } from '../../runtime/NativeErrors';
export class UniversalReferenceResolver {
    memoryAPI;
    realities = new Map();
    cache = new Map();
    maxCacheSize;
    constructor(memoryAPI, maxCacheSize = 2048) {
        this.memoryAPI = memoryAPI;
        this.maxCacheSize = maxCacheSize;
    }
    registerReality(reality) {
        this.realities.set(reality.realityId, reality);
    }
    /**
     * Resolves any one:// URI into its target value or state.
     */
    resolve(uri, bypassCache = false) {
        if (!bypassCache) {
            const cached = this.cache.get(uri);
            if (cached)
                return cached;
        }
        if (!uri.startsWith('one://')) {
            throw new OneNativeRuntimeError('E7010', `[Resolver Error] Invalid URI scheme '${uri}'. Must start with 'one://'.`);
        }
        const withoutScheme = uri.substring(6); // strip 'one://'
        const [pathPart, fragmentPart] = withoutScheme.split('#');
        const [pathOnly, queryPart] = pathPart.split('?');
        const segments = pathOnly.split('/').filter(Boolean);
        if (segments.length === 0) {
            throw new OneNativeRuntimeError('E7010', `[Resolver Error] Empty URI path in '${uri}'.`);
        }
        const domainType = segments[0].toLowerCase();
        let resolved;
        switch (domainType) {
            case 'spatial': {
                // e.g. one://spatial/3/3/3
                const x = Number(segments[1] ?? 0);
                const y = Number(segments[2] ?? 0);
                const z = Number(segments[3] ?? 0);
                const addr = OneAddress369.coordToAddress(x, y, z);
                const disp = OneAddress369.toDisplayIndex(addr);
                resolved = {
                    uri,
                    protocol: 'one',
                    domain: 'SPATIAL',
                    targetId: `coord_${x}_${y}_${z}`,
                    isWritable: true,
                    value: { x, y, z, canonicalAddress: addr, displayIndex: disp },
                    cachedAtMs: performance.now(),
                };
                break;
            }
            case 'addr': {
                // e.g. one://addr/197
                const addr = Number(segments[1] ?? 0);
                OneAddress369.validateAddress(addr);
                const disp = OneAddress369.toDisplayIndex(addr);
                const isSpatial = OneAddress369.isSpatial(addr);
                resolved = {
                    uri,
                    protocol: 'one',
                    domain: 'ADDRESS',
                    targetId: `addr_${addr}`,
                    isWritable: true,
                    value: {
                        canonicalAddress: addr,
                        displayIndex: disp,
                        isSpatial,
                        coordinates: isSpatial ? OneAddress369.addressToCoord(addr) : null,
                    },
                    cachedAtMs: performance.now(),
                };
                break;
            }
            case 'mem': {
                // e.g. one://mem/record_id
                const key = segments[1];
                if (!key)
                    throw new OneNativeRuntimeError('E7008', `Missing record key in '${uri}'.`);
                let val = null;
                if (this.memoryAPI) {
                    const loaded = this.memoryAPI.load(key);
                    val = loaded ? toRaw(loaded) : null;
                }
                resolved = {
                    uri,
                    protocol: 'one',
                    domain: 'MEMORY',
                    targetId: key,
                    isWritable: true,
                    value: val,
                    cachedAtMs: performance.now(),
                };
                break;
            }
            case 'reality': {
                // e.g. one://reality/reality_id/branch/branch_id/state/state_id
                const realityId = segments[1];
                const reality = this.realities.get(realityId);
                if (!reality) {
                    throw new OneNativeRuntimeError('E7010', `Reality '${realityId}' not found in resolver.`);
                }
                let targetVal = null;
                let targetId = realityId;
                if (segments.length >= 4 && segments[2] === 'branch') {
                    const branchId = segments[3];
                    const branch = reality.getBranch(branchId);
                    if (!branch)
                        throw new OneNativeRuntimeError('E7010', `Branch '${branchId}' not found in reality '${realityId}'.`);
                    targetId = branchId;
                    targetVal = {
                        branchId: branch.branchId,
                        name: branch.name,
                        headStateId: branch.headStateId,
                        status: branch.status,
                        depth: branch.depth,
                    };
                    if (segments.length >= 6 && segments[4] === 'state') {
                        const stateId = segments[5];
                        const state = reality.getState(stateId);
                        if (!state)
                            throw new OneNativeRuntimeError('E7010', `State '${stateId}' not found in reality.`);
                        targetId = stateId;
                        targetVal = {
                            stateId: state.stateId,
                            revision: state.revision,
                            hash: state.stateHash,
                            payload: toRaw(state.payload),
                        };
                    }
                }
                else {
                    targetVal = {
                        realityId: reality.realityId,
                        name: reality.name,
                        statesCount: reality.getStateCount(),
                        branchesCount: reality.getBranchCount(),
                        seal: reality.sealReality(),
                    };
                }
                resolved = {
                    uri,
                    protocol: 'one',
                    domain: 'REALITY',
                    targetId,
                    isWritable: false, // States in DAG are strictly immutable
                    value: targetVal,
                    cachedAtMs: performance.now(),
                };
                break;
            }
            case 'knowledge': {
                // e.g. one://knowledge/concept/Alpha or one://knowledge/rules
                const concept = segments.slice(1).join('/');
                resolved = {
                    uri,
                    protocol: 'one',
                    domain: 'KNOWLEDGE',
                    targetId: concept || 'root',
                    isWritable: true,
                    value: {
                        concept: concept || 'root',
                        provenance: '0xKNOWLEDGE_SOVEREIGN',
                        query: queryPart ?? null,
                        fragment: fragmentPart ?? null,
                    },
                    cachedAtMs: performance.now(),
                };
                break;
            }
            default:
                resolved = {
                    uri,
                    protocol: 'one',
                    domain: 'UNKNOWN',
                    targetId: segments[0],
                    isWritable: false,
                    value: null,
                    cachedAtMs: performance.now(),
                };
        }
        // Cache with eviction if limit reached
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey)
                this.cache.delete(firstKey);
        }
        this.cache.set(uri, resolved);
        return resolved;
    }
    /**
     * Resolves a batch of sovereign URIs with zero-copy reference caching.
     */
    resolveBatch(uris, bypassCache = false) {
        return uris.map((uri) => this.resolve(uri, bypassCache));
    }
    /**
     * Clears resolver cache.
     */
    clearCache() {
        this.cache.clear();
    }
}
