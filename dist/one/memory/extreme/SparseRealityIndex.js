/**
 * ONE Language — Sparse Reality Index
 * ====================================
 * Module: @one/memory/extreme/SparseRealityIndex
 *
 * Implements Section 21 of Extreme-Scale 3D Memory Toolchain.
 * Provides lazy, on-demand indexing of branching realities without full-tree expansion.
 */
export class SparseRealityIndex {
    nodes = new Map();
    maxMaterializedNodes;
    constructor(maxMaterializedNodes = 256) {
        this.maxMaterializedNodes = maxMaterializedNodes;
    }
    /**
     * Registers a sparse reality descriptor without expanding its complete tree.
     */
    registerSparseReality(realityId, branchId, headStateId, depth, parentBranchId, activeInvariants = []) {
        const key = `${realityId}:${branchId}`;
        this.nodes.set(key, {
            realityId,
            branchId,
            parentBranchId,
            depth,
            headStateId,
            activeInvariants,
            isMaterialized: false,
        });
    }
    /**
     * Materializes a specific reality branch on demand.
     */
    materializeBranch(realityId, branchId) {
        const key = `${realityId}:${branchId}`;
        const node = this.nodes.get(key);
        if (!node) {
            throw new Error(`[SparseRealityIndex Error] Reality branch '${branchId}' in universe '${realityId}' not found.`);
        }
        if (!node.isMaterialized) {
            // Enforce active working set limit
            this.evictIfFull();
            node.isMaterialized = true;
            node.materializedAtMs = Date.now();
        }
        return node;
    }
    /**
     * Evicts oldest materialized reality node.
     */
    evictIfFull() {
        let materializedCount = 0;
        for (const node of this.nodes.values()) {
            if (node.isMaterialized)
                materializedCount++;
        }
        if (materializedCount >= this.maxMaterializedNodes) {
            for (const node of this.nodes.values()) {
                if (node.isMaterialized) {
                    node.isMaterialized = false;
                    node.materializedAtMs = undefined;
                    break;
                }
            }
        }
    }
    size() {
        return this.nodes.size;
    }
    getMaterializedCount() {
        let c = 0;
        for (const n of this.nodes.values()) {
            if (n.isMaterialized)
                c++;
        }
        return c;
    }
}
