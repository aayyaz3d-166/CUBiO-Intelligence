/**
 * CUBiO Autonomous Multi-Mesh Federation Engine ("one-quantum-mesh")
 * Gate: CNL-P8-001 | Sovereign Architecture
 */

import { QuantumEntanglementSyncEngine, EPRBellPair, QuantumCollapseEvent } from './quantum_entanglement_sync';
import { PQCMeshGuard, MeshPacket, VerificationVerdict } from './pqc_mesh_guard';
import { PQCLatticeSealEngine } from '../../src/core/crypto/pqc_lattice_seal';

export interface SovereignMeshNode {
  nodeId: string;
  spatialCoordinate: [number, number, number];
  harmonicBandMhz: 3 | 6 | 9;
  localStateVector: number[];
  status: 'ACTIVE_ENTANGLED' | 'STANDBY' | 'QUARANTINED';
}

export interface FederationStateReport {
  gate: string;
  activeNodesCount: number;
  entangledPairsCount: number;
  totalCollapseEvents: number;
  isActuationBlocked: boolean;
  pqcRootSeal: string;
  deterministicStateHash: string;
  nodes: SovereignMeshNode[];
}

export class MeshFederationEngine {
  private nodes: Map<string, SovereignMeshNode> = new Map();
  public readonly quantumSync: QuantumEntanglementSyncEngine;
  public readonly meshGuard: PQCMeshGuard;
  public readonly is_actuation_blocked: boolean = true;
  private collapseEventLog: QuantumCollapseEvent[] = [];

  constructor() {
    this.quantumSync = new QuantumEntanglementSyncEngine();
    this.meshGuard = new PQCMeshGuard();
  }

  /**
   * Spawns and registers a sovereign peer node in the federation.
   */
  public registerNode(nodeId: string, coord: [number, number, number], harmonicBand: 3 | 6 | 9 = 9): SovereignMeshNode {
    const node: SovereignMeshNode = {
      nodeId,
      spatialCoordinate: [...coord],
      harmonicBandMhz: harmonicBand,
      localStateVector: [0.369, 0.693, 0.936, 1.0],
      status: 'ACTIVE_ENTANGLED',
    };

    this.nodes.set(nodeId, node);
    this.meshGuard.registerTrustedPeer(nodeId);
    return node;
  }

  /**
   * Creates an EPR entanglement link between two peer nodes.
   */
  public linkQuantumEntanglement(nodeA: string, nodeB: string): EPRBellPair {
    if (!this.nodes.has(nodeA) || !this.nodes.has(nodeB)) {
      throw new Error(`[Federation Fault] Nodes '${nodeA}' and '${nodeB}' must both be registered before entangling.`);
    }
    return this.quantumSync.createEntanglement(nodeA, nodeB, 4);
  }

  /**
   * Updates state on one node, triggering instant non-local quantum collapse across the mesh.
   */
  public updateNodeState(originNodeId: string, newState: number[]): QuantumCollapseEvent[] {
    const originNode = this.nodes.get(originNodeId);
    if (!originNode) {
      throw new Error(`[Federation Error] Node '${originNodeId}' not found in mesh.`);
    }

    originNode.localStateVector = [...newState];

    // Trigger instant quantum entanglement state collapse
    const collapseEvents = this.quantumSync.collapseAndSynchronize(originNodeId, newState);
    for (const ev of collapseEvents) {
      this.collapseEventLog.push(ev);
      const target = this.nodes.get(ev.entangledTargetNode);
      if (target) {
        target.localStateVector = [...ev.collapsedStateB];
      }
    }

    return collapseEvents;
  }

  /**
   * Generates a frozen federation state report with PQC root seal.
   */
  public getFederationReport(logicalTimestamp: number = 1725300000000): FederationStateReport {
    const statePayload = {
      gate: 'CNL-P8-001',
      nodes: Array.from(this.nodes.values()).map((n) => ({
        nodeId: n.nodeId,
        coord: n.spatialCoordinate,
        harmonicBand: n.harmonicBandMhz,
        stateVector: n.localStateVector,
        status: n.status,
      })),
      entangledPairsCount: this.quantumSync.getActivePairsCount(),
      totalCollapseEvents: this.collapseEventLog.length,
      is_actuation_blocked: true,
      timestamp: logicalTimestamp,
    };

    const stateBuf = Buffer.from(JSON.stringify(statePayload), 'utf-8');
    const pqcRootSeal = PQCLatticeSealEngine.generatePQCSeal(stateBuf);

    // Compute FNV-1a state hash
    let hash = 0x811c9dc5;
    const str = JSON.stringify(statePayload);
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    const deterministicStateHash = '0x369_' + (hash >>> 0).toString(16).padStart(8, '0');

    return {
      gate: 'CNL-P8-001',
      activeNodesCount: this.nodes.size,
      entangledPairsCount: this.quantumSync.getActivePairsCount(),
      totalCollapseEvents: this.collapseEventLog.length,
      isActuationBlocked: this.is_actuation_blocked,
      pqcRootSeal,
      deterministicStateHash,
      nodes: Array.from(this.nodes.values()),
    };
  }

  public getNodes(): SovereignMeshNode[] {
    return Array.from(this.nodes.values());
  }
}
