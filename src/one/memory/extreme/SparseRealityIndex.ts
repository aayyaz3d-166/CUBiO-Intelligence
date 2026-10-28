/**
 * ONE Language — Sparse Reality Index
 * ====================================
 * Module: @one/memory/extreme/SparseRealityIndex
 *
 * Implements Section 21 of Extreme-Scale 3D Memory Toolchain.
 * Provides lazy, on-demand indexing of branching realities without full-tree expansion.
 */

export interface SparseRealityNode {
  readonly realityId: string;
  readonly branchId: string;
  readonly parentBranchId?: string;
  readonly depth: number;
  readonly headStateId: string;
  readonly activeInvariants: string[];
  isMaterialized: boolean;
  materializedAtMs?: number;
}

export class SparseRealityIndex {
  private readonly nodes: Map<string, SparseRealityNode> = new Map();
  private readonly maxMaterializedNodes: number;

  constructor(maxMaterializedNodes: number = 256) {
    this.maxMaterializedNodes = maxMaterializedNodes;
  }

  /**
   * Registers a sparse reality descriptor without expanding its complete tree.
   */
  public registerSparseReality(
    realityId: string,
    branchId: string,
    headStateId: string,
    depth: number,
    parentBranchId?: string,
    activeInvariants: string[] = []
  ): void {
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
  public materializeBranch(realityId: string, branchId: string): SparseRealityNode {
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
  private evictIfFull(): void {
    let materializedCount = 0;
    for (const node of this.nodes.values()) {
      if (node.isMaterialized) materializedCount++;
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

  public size(): number {
    return this.nodes.size;
  }

  public getMaterializedCount(): number {
    let c = 0;
    for (const n of this.nodes.values()) {
      if (n.isMaterialized) c++;
    }
    return c;
  }
}
