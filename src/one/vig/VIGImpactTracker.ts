/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/VIGImpactTracker
 * Specification: VIG Phase 3 Dependency Graph & Impact Tracking
 *
 * Implements cycle-safe BFS/DFS impact traversal, public API breach detection,
 * required test discovery, and upstream dependency querying.
 */

import {
  VIGNode,
  VIGEdge,
  ImpactReport,
  ImpactTraversalOptions,
  ImpactTraversalMode,
} from './types';
import { VIGGraphStore } from './VIGGraphStore';

export class VIGImpactTracker {
  /**
   * Computes the complete transitive downstream impact set for changed CIDs.
   * Traverses reverse (incoming) edges: from dependency -> dependent.
   *
   * @param changedCids List of initially modified or queried node CIDs.
   * @param store Active VIGGraphStore containing nodes and adjacency indexes.
   * @param options Configuration for traversal mode, maxDepth, and test inclusion.
   */
  public static computeDownstreamImpact(
    changedCids: readonly string[],
    store: VIGGraphStore,
    options: ImpactTraversalOptions = {}
  ): ImpactReport {
    const startMs = performance.now();
    const maxDepth = options.maxDepth ?? 50;
    const mode: ImpactTraversalMode = options.mode ?? 'BFS';
    const includeTests = options.includeTests ?? true;

    const rootSet = new Set<string>(changedCids);
    const affectedNodeMap = new Map<string, VIGNode>();
    const requiredTestMap = new Map<string, VIGNode>();
    const cycles: string[][] = [];
    let isPublicApiBreached = false;
    let maxDepthReached = 0;

    // Check if any root node is an exported public symbol
    for (const cid of changedCids) {
      const rootNode = store.getNode(cid);
      if (rootNode && rootNode.isExported) {
        isPublicApiBreached = true;
      }
    }

    if (mode === 'BFS') {
      // ── Cycle-Safe Breadth-First Traversal ──────────────────────────────────
      const visited = new Set<string>(changedCids);
      // Queue stores: { cid, depth, path }
      const queue: { cid: string; depth: number; path: string[] }[] = [];

      for (const cid of changedCids) {
        queue.push({ cid, depth: 0, path: [cid] });
      }

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.depth > maxDepthReached) {
          maxDepthReached = current.depth;
        }

        if (current.depth >= maxDepth) {
          continue;
        }

        // Incoming edges point TO current.cid from its dependents (sources)
        const incomingEdges = store.getIncomingEdges(current.cid);

        for (const edge of incomingEdges) {
          if (edge.isPublicApi) {
            isPublicApiBreached = true;
          }

          const dependentCid = edge.sourceCid;
          const dependentNode = store.getNode(dependentCid);
          if (!dependentNode) {
            continue;
          }

          // Cycle detection: check if dependentCid is already in the current traversal branch path
          const cycleIdx = current.path.indexOf(dependentCid);
          if (cycleIdx !== -1) {
            const detectedCycle = current.path.slice(cycleIdx).concat(dependentCid);
            // Deduplicate cycles
            if (!this.containsCycle(cycles, detectedCycle)) {
              cycles.push(detectedCycle);
            }
          }

          if (!visited.has(dependentCid)) {
            visited.add(dependentCid);

            // Record as affected if not part of the initial root set
            if (!rootSet.has(dependentCid)) {
              affectedNodeMap.set(dependentCid, dependentNode);
            }

            // Test discovery
            if (includeTests && this.isTestNode(dependentNode, edge)) {
              requiredTestMap.set(dependentCid, dependentNode);
            }

            queue.push({
              cid: dependentCid,
              depth: current.depth + 1,
              path: [...current.path, dependentCid],
            });
          }
        }
      }
    } else {
      // ── Cycle-Safe Depth-First Traversal ────────────────────────────────────
      const visited = new Set<string>();
      const inStack = new Set<string>();

      const dfs = (cid: string, depth: number, path: string[]) => {
        if (depth > maxDepthReached) {
          maxDepthReached = depth;
        }
        if (depth >= maxDepth) {
          return;
        }

        inStack.add(cid);

        const incomingEdges = store.getIncomingEdges(cid);
        for (const edge of incomingEdges) {
          if (edge.isPublicApi) {
            isPublicApiBreached = true;
          }

          const dependentCid = edge.sourceCid;
          const dependentNode = store.getNode(dependentCid);
          if (!dependentNode) {
            continue;
          }

          // Cycle detected if neighbor is in active recursion stack
          if (inStack.has(dependentCid)) {
            const cycleIdx = path.indexOf(dependentCid);
            if (cycleIdx !== -1) {
              const detectedCycle = path.slice(cycleIdx).concat(dependentCid);
              if (!this.containsCycle(cycles, detectedCycle)) {
                cycles.push(detectedCycle);
              }
            }
          } else if (!visited.has(dependentCid)) {
            visited.add(dependentCid);

            if (!rootSet.has(dependentCid)) {
              affectedNodeMap.set(dependentCid, dependentNode);
            }

            if (includeTests && this.isTestNode(dependentNode, edge)) {
              requiredTestMap.set(dependentCid, dependentNode);
            }

            dfs(dependentCid, depth + 1, [...path, dependentCid]);
          }
        }

        inStack.delete(cid);
      };

      for (const rootCid of changedCids) {
        visited.add(rootCid);
        dfs(rootCid, 0, [rootCid]);
      }
    }

    const affectedNodes = Array.from(affectedNodeMap.values()).sort((a, b) =>
      a.cid.localeCompare(b.cid)
    );
    const affectedPaths = Array.from(new Set(affectedNodes.map((n) => n.path))).sort();
    const requiredTestSuites = Array.from(requiredTestMap.values()).sort((a, b) =>
      a.cid.localeCompare(b.cid)
    );

    const executionTimeMs = performance.now() - startMs;

    return {
      rootCids: changedCids.slice(),
      affectedNodes,
      affectedPaths,
      requiredTestSuites,
      isPublicApiBreached,
      maxDepthReached,
      cycleDetected: cycles.length > 0,
      cycles,
      executionTimeMs,
    };
  }

  /**
   * Computes all upstream dependencies that the specified nodes transitively depend on.
   * Traverses forward (outgoing) edges: from consumer -> dependency.
   */
  public static computeUpstreamDependencies(
    rootCids: readonly string[],
    store: VIGGraphStore,
    options: ImpactTraversalOptions = {}
  ): {
    dependencies: readonly VIGNode[];
    cycles: readonly (readonly string[])[];
    maxDepthReached: number;
  } {
    const maxDepth = options.maxDepth ?? 50;
    const rootSet = new Set<string>(rootCids);
    const visited = new Set<string>(rootCids);
    const depMap = new Map<string, VIGNode>();
    const cycles: string[][] = [];
    let maxDepthReached = 0;

    const queue: { cid: string; depth: number; path: string[] }[] = [];
    for (const cid of rootCids) {
      queue.push({ cid, depth: 0, path: [cid] });
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth > maxDepthReached) {
        maxDepthReached = current.depth;
      }
      if (current.depth >= maxDepth) {
        continue;
      }

      const outEdges = store.getOutgoingEdges(current.cid);
      for (const edge of outEdges) {
        const targetCid = edge.targetCid;
        const targetNode = store.getNode(targetCid);
        if (!targetNode) continue;

        // Cycle check
        const cycleIdx = current.path.indexOf(targetCid);
        if (cycleIdx !== -1) {
          const detectedCycle = current.path.slice(cycleIdx).concat(targetCid);
          if (!this.containsCycle(cycles, detectedCycle)) {
            cycles.push(detectedCycle);
          }
        }

        if (!visited.has(targetCid)) {
          visited.add(targetCid);
          if (!rootSet.has(targetCid)) {
            depMap.set(targetCid, targetNode);
          }
          queue.push({
            cid: targetCid,
            depth: current.depth + 1,
            path: [...current.path, targetCid],
          });
        }
      }
    }

    const dependencies = Array.from(depMap.values()).sort((a, b) =>
      a.cid.localeCompare(b.cid)
    );

    return {
      dependencies,
      cycles,
      maxDepthReached,
    };
  }

  // ── Helper Utilities ────────────────────────────────────────────────────────

  private static isTestNode(node: VIGNode, edge?: VIGEdge): boolean {
    if (node.kind === 'TEST_SUITE') return true;
    if (edge && edge.relation === 'TESTS_MODULE') return true;
    const normalized = node.path.replace(/\\/g, '/').toLowerCase();
    return (
      normalized.startsWith('tests/') ||
      normalized.includes('.test.') ||
      normalized.includes('_test.')
    );
  }

  private static containsCycle(existingCycles: string[][], candidate: string[]): boolean {
    const candidateStr = candidate.join('->');
    for (const c of existingCycles) {
      if (c.join('->') === candidateStr) return true;
    }
    return false;
  }
}
