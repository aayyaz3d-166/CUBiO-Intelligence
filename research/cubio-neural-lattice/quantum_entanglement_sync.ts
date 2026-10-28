/**
 * CUBiO Simulated Quantum Entanglement Synchronization Engine ("one-quantum-mesh")
 * Gate: CNL-P8-001 | Sovereign Architecture
 */

export interface EPRBellPair {
  pairId: string;
  nodeA: string;
  nodeB: string;
  bellState: '|Phi+>' | '|Psi+>';
  stateVectorA: number[];
  stateVectorB: number[];
  entanglementFidelity: number; // 0.0 to 1.0 (1.0 = 100% pure entanglement)
  lastCollapseTimestamp: number;
}

export interface QuantumCollapseEvent {
  pairId: string;
  triggeringNode: string;
  entangledTargetNode: string;
  collapsedStateA: number[];
  collapsedStateB: number[];
  propagationLatencyNs: number; // 0 ns (Simulated Non-Local Instantaneous Collapse)
  fidelity: number;
}

export class QuantumEntanglementSyncEngine {
  private eprPairs: Map<string, EPRBellPair> = new Map();
  private nodePairIndex: Map<string, string[]> = new Map(); // nodeId -> pairIds[]

  /**
   * Generates a simulated maximally entangled EPR Bell State (|Phi+> = 1/√2(|00> + |11>)).
   */
  public createEntanglement(nodeA: string, nodeB: string, initialDimension: number = 4): EPRBellPair {
    const pairId = `EPR_${nodeA}_${nodeB}_369`;
    const defaultVec = new Array(initialDimension).fill(0.369);

    const pair: EPRBellPair = {
      pairId,
      nodeA,
      nodeB,
      bellState: '|Phi+>',
      stateVectorA: [...defaultVec],
      stateVectorB: [...defaultVec],
      entanglementFidelity: 1.0, // 100% Fidelity
      lastCollapseTimestamp: Date.now(),
    };

    this.eprPairs.set(pairId, pair);

    // Index by node IDs for instant retrieval
    const listA = this.nodePairIndex.get(nodeA) || [];
    listA.push(pairId);
    this.nodePairIndex.set(nodeA, listA);

    const listB = this.nodePairIndex.get(nodeB) || [];
    listB.push(pairId);
    this.nodePairIndex.set(nodeB, listB);

    return pair;
  }

  /**
   * Triggers non-local state collapse across the entangled pair without network packet latency.
   */
  public collapseAndSynchronize(originNodeId: string, newStateVector: number[]): QuantumCollapseEvent[] {
    const pairIds = this.nodePairIndex.get(originNodeId) || [];
    const events: QuantumCollapseEvent[] = [];

    for (const pid of pairIds) {
      const pair = this.eprPairs.get(pid);
      if (!pair) continue;

      const isNodeA = pair.nodeA === originNodeId;
      const targetNodeId = isNodeA ? pair.nodeB : pair.nodeA;

      // Non-local state collapse: target instantly mirrors state under |Phi+> parity
      pair.stateVectorA = [...newStateVector];
      pair.stateVectorB = [...newStateVector];
      pair.lastCollapseTimestamp = Date.now();
      pair.entanglementFidelity = 1.0;

      events.push({
        pairId: pair.pairId,
        triggeringNode: originNodeId,
        entangledTargetNode: targetNodeId,
        collapsedStateA: [...pair.stateVectorA],
        collapsedStateB: [...pair.stateVectorB],
        propagationLatencyNs: 0, // Zero latency non-local collapse
        fidelity: pair.entanglementFidelity,
      });
    }

    return events;
  }

  public getPair(pairId: string): EPRBellPair | undefined {
    return this.eprPairs.get(pairId);
  }

  public getActivePairsCount(): number {
    return this.eprPairs.size;
  }
}
