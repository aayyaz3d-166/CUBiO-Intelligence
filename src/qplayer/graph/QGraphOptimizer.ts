/**
 * ONE Language — Qplayer Execution Architecture
 * ==============================================
 * QGraphOptimizer.ts: Semantics-Preserving Logic Optimization for QGraph
 */

import { QComputationalGraph, QNode } from './QGraph';

export class QGraphOptimizer {
  /**
   * Optimizes the computational graph with constant folding, dead-node elimination,
   * and virtual register allocation.
   */
  public static optimize(graph: QComputationalGraph): QComputationalGraph {
    this.foldConstants(graph);
    this.eliminateDeadNodes(graph);
    this.allocateRegisters(graph);
    return graph;
  }

  /**
   * Identifies operations where all input operands are constants and folds them.
   */
  private static foldConstants(graph: QComputationalGraph): void {
    let changed = true;
    while (changed) {
      changed = false;
      for (const node of graph.getAllNodes()) {
        if (node.isFolded || node.kind === 'CONST' || node.hasSideEffects) continue;

        if (['ADD', 'SUB', 'MUL', 'DIV', 'MOD'].includes(node.kind)) {
          if (node.dependencies.length === 2) {
            const left = graph.getNode(node.dependencies[0]);
            const right = graph.getNode(node.dependencies[1]);

            if (
              left &&
              right &&
              left.kind === 'CONST' &&
              right.kind === 'CONST' &&
              typeof left.value === 'number' &&
              typeof right.value === 'number'
            ) {
              let foldedVal: number;
              switch (node.kind) {
                case 'ADD':
                  foldedVal = left.value + right.value;
                  break;
                case 'SUB':
                  foldedVal = left.value - right.value;
                  break;
                case 'MUL':
                  foldedVal = left.value * right.value;
                  break;
                case 'DIV':
                  if (right.value === 0) continue; // Do not fold div-by-zero
                  foldedVal = Math.floor(left.value / right.value);
                  break;
                case 'MOD':
                  if (right.value === 0) continue;
                  foldedVal = left.value % right.value;
                  break;
                default:
                  continue;
              }

              node.kind = 'CONST';
              node.value = foldedVal;
              node.dependencies = [];
              node.isFolded = true;
              changed = true;
            }
          }
        }
      }
    }
  }

  /**
   * Removes nodes that are unused and have no side effects.
   */
  private static eliminateDeadNodes(graph: QComputationalGraph): void {
    const liveNodeIds = new Set<number>();

    // Mark phase: Seed with all nodes that have side effects (OUTPUT, STORE, HALT)
    for (const node of graph.getAllNodes()) {
      if (node.hasSideEffects) {
        liveNodeIds.add(node.id);
      }
    }

    // Propagate liveness along dependency edges
    let changed = true;
    while (changed) {
      changed = false;
      for (const liveId of Array.from(liveNodeIds)) {
        const liveNode = graph.getNode(liveId);
        if (liveNode) {
          for (const depId of liveNode.dependencies) {
            if (!liveNodeIds.has(depId)) {
              liveNodeIds.add(depId);
              changed = true;
            }
          }
        }
      }
    }

    // Sweep phase: Delete unreferenced non-side-effect nodes
    for (const node of graph.getAllNodes()) {
      if (!liveNodeIds.has(node.id)) {
        graph.nodes.delete(node.id);
      }
    }
  }

  /**
   * Linear scan virtual register allocator for sorted nodes.
   */
  private static allocateRegisters(graph: QComputationalGraph): void {
    const sorted = graph.topologicalSort();
    let regCounter = 0;

    for (const node of sorted) {
      if (node.kind !== 'HALT') {
        node.register = regCounter++;
      }
    }
  }
}
