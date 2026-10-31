/**
 * ONE Language — Qplayer Execution Architecture
 * ==============================================
 * QGraph.ts: Computational Graph & Node Definitions
 */

export type QNodeKind =
  | 'INPUT'
  | 'CONST'
  | 'LOAD_VAR'
  | 'STORE_VAR'
  | 'ADD'
  | 'SUB'
  | 'MUL'
  | 'DIV'
  | 'MOD'
  | 'EQ'
  | 'LT'
  | 'GT'
  | 'OUTPUT'
  | 'CALL'
  | 'HALT';

export interface QNode {
  id: number;
  kind: QNodeKind;
  value?: number | string | boolean;
  variableName?: string;
  dependencies: number[]; // Node IDs that this node consumes
  register?: number;     // Assigned virtual register (0..511)
  isFolded?: boolean;
  hasSideEffects?: boolean;
}

export class QComputationalGraph {
  public nodes: Map<number, QNode> = new Map();
  private nextId: number = 0;

  public addNode(
    kind: QNodeKind,
    dependencies: number[] = [],
    value?: number | string | boolean,
    variableName?: string,
    hasSideEffects: boolean = false
  ): QNode {
    const id = this.nextId++;
    const node: QNode = {
      id,
      kind,
      value,
      variableName,
      dependencies,
      hasSideEffects: hasSideEffects || kind === 'OUTPUT' || kind === 'STORE_VAR' || kind === 'HALT',
    };
    this.nodes.set(id, node);
    return node;
  }

  public getNode(id: number): QNode | undefined {
    return this.nodes.get(id);
  }

  public getAllNodes(): QNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Returns topological order of nodes respecting dependencies.
   */
  public topologicalSort(): QNode[] {
    const visited = new Set<number>();
    const temp = new Set<number>();
    const order: QNode[] = [];

    const visit = (nodeId: number) => {
      if (temp.has(nodeId)) {
        throw new Error(`Cycle detected in computational graph at node ${nodeId}`);
      }
      if (!visited.has(nodeId)) {
        temp.add(nodeId);
        const node = this.nodes.get(nodeId);
        if (node) {
          for (const depId of node.dependencies) {
            visit(depId);
          }
          visited.add(nodeId);
          temp.delete(nodeId);
          order.push(node);
        }
      }
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        visit(nodeId);
      }
    }

    return order;
  }
}
