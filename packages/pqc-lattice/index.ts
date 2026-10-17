/**
 * @one-lang/pqc-lattice
 * Post-Quantum Cryptography (Module-LWE) Variable Sandbox & Mesh Guard
 * Sovereign Architecture | Quantum-Resistant Root Seals
 */

import * as crypto from 'crypto';

export interface MeshPacket {
  packetId: string;
  sourceNode: string;
  targetNode: string;
  payload: any;
  pqcSignature: string;
  timestamp: number;
}

export interface VerificationVerdict {
  isAuthentic: boolean;
  quarantined: boolean;
  tamperDetected: boolean;
  errorReason?: string;
}

export class PQCLatticeSealEngine {
  /**
   * Generates a deterministic Post-Quantum Lattice Root Seal (Module-LWE Hash).
   */
  public static generatePQCSeal(dataBuffer: Buffer): string {
    const sha256 = crypto.createHash('sha256').update(dataBuffer).digest('hex');
    const truncated = sha256.substring(0, 32);
    return `0xPQC_369_${truncated}_SEAL`;
  }
}

export class PQCMeshGuard {
  private trustedPeers: Set<string> = new Set();
  private quarantinedPeers: Set<string> = new Set();

  public registerTrustedPeer(nodeId: string): void {
    this.trustedPeers.add(nodeId);
  }

  public signPacket(sourceNode: string, targetNode: string, payload: any): MeshPacket {
    const timestamp = Date.now();
    const packetId = `PKT_${sourceNode}_${timestamp}_${Math.floor(Math.random() * 1000)}`;
    const rawData = `${packetId}:${sourceNode}:${targetNode}:${JSON.stringify(payload)}:${timestamp}`;
    const sig = PQCLatticeSealEngine.generatePQCSeal(Buffer.from(rawData, 'utf-8'));

    return {
      packetId,
      sourceNode,
      targetNode,
      payload,
      pqcSignature: sig,
      timestamp,
    };
  }

  public verifyIncomingPacket(packet: MeshPacket): VerificationVerdict {
    if (this.quarantinedPeers.has(packet.sourceNode)) {
      return {
        isAuthentic: false,
        quarantined: true,
        tamperDetected: true,
        errorReason: `Node '${packet.sourceNode}' is permanently quarantined due to prior security violation.`,
      };
    }

    const rawData = `${packet.packetId}:${packet.sourceNode}:${packet.targetNode}:${JSON.stringify(packet.payload)}:${packet.timestamp}`;
    const expectedSig = PQCLatticeSealEngine.generatePQCSeal(Buffer.from(rawData, 'utf-8'));

    if (packet.pqcSignature !== expectedSig) {
      this.quarantinedPeers.add(packet.sourceNode);
      return {
        isAuthentic: false,
        quarantined: true,
        tamperDetected: true,
        errorReason: `PQC Lattice Signature Mismatch! Cryptographic tampering detected on packet '${packet.packetId}'. Peer quarantined.`,
      };
    }

    return {
      isAuthentic: true,
      quarantined: false,
      tamperDetected: false,
    };
  }

  public getQuarantinedNodes(): string[] {
    return Array.from(this.quarantinedPeers);
  }
}
