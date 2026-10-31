/**
 * ONE Language — Qplayer Execution Architecture (v1.2.1)
 * =======================================================
 * QSpatialParallelScheduler.ts: Spatial Multi-Core & DAG Parallel Task Scheduler
 *
 * Partitions independent computational DAG subgraphs into parallel execution
 * tasks across available logical CPU cores, achieving multi-core acceleration
 * without requiring the programmer to manually write thread synchronization.
 */

import { QComputationalGraph, QNode } from '../graph/QGraph';

export interface ParallelTaskChunk {
  chunkId: number;
  nodeIds: number[];
  independent: boolean;
}

export interface ParallelExecutionMetrics {
  totalNodes: number;
  parallelChunks: number;
  concurrencyLevel: number;
  speedupEstimated: number;
}

export class QSpatialParallelScheduler {
  /**
   * Analyzes a QComputationalGraph to partition independent nodes into parallel execution chunks.
   */
  public static partitionGraph(graph: QComputationalGraph): ParallelTaskChunk[] {
    const nodes = graph.getAllNodes();
    const indegreeMap = new Map<number, number>();
    const dependentsMap = new Map<number, number[]>();

    for (const node of nodes) {
      indegreeMap.set(node.id, node.dependencies.length);
      for (const dep of node.dependencies) {
        const list = dependentsMap.get(dep) || [];
        list.push(node.id);
        dependentsMap.set(dep, list);
      }
    }

    // Topological waves of execution
    const waves: QNode[][] = [];
    let remainingNodes = [...nodes];

    while (remainingNodes.length > 0) {
      const currentWave = remainingNodes.filter((n) => (indegreeMap.get(n.id) || 0) === 0);
      if (currentWave.length === 0) {
        waves.push(remainingNodes);
        break;
      }

      waves.push(currentWave);

      for (const node of currentWave) {
        const deps = dependentsMap.get(node.id) || [];
        for (const targetId of deps) {
          const deg = indegreeMap.get(targetId) || 0;
          indegreeMap.set(targetId, Math.max(0, deg - 1));
        }
      }

      const waveIds = new Set(currentWave.map((n) => n.id));
      remainingNodes = remainingNodes.filter((n) => !waveIds.has(n.id));
    }

    const chunks: ParallelTaskChunk[] = [];
    let chunkCounter = 0;

    for (const wave of waves) {
      if (wave.length > 1) {
        chunks.push({
          chunkId: chunkCounter++,
          nodeIds: wave.map((n) => n.id),
          independent: true,
        });
      } else if (wave.length === 1) {
        chunks.push({
          chunkId: chunkCounter++,
          nodeIds: [wave[0].id],
          independent: false,
        });
      }
    }

    return chunks;
  }

  /**
   * Calculates estimated multi-core speedup for the given graph structure.
   */
  public static estimateSpeedup(graph: QComputationalGraph, numCores: number = 8): ParallelExecutionMetrics {
    const chunks = this.partitionGraph(graph);
    const totalNodes = graph.getAllNodes().length;
    let parallelNodes = 0;

    for (const c of chunks) {
      if (c.independent && c.nodeIds.length > 1) {
        parallelNodes += c.nodeIds.length;
      }
    }

    const parallelFraction = totalNodes > 0 ? parallelNodes / totalNodes : 0;
    const speedup = 1 / ((1 - parallelFraction) + (parallelFraction / Math.min(numCores, 8)));

    return {
      totalNodes,
      parallelChunks: chunks.filter((c) => c.independent).length,
      concurrencyLevel: Math.min(numCores, 8),
      speedupEstimated: parseFloat(speedup.toFixed(2)),
    };
  }
}
