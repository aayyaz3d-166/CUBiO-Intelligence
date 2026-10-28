/**
 * CUBiO PQC-Secured Peer Mesh Guard & Firewall
 * Gate: CNL-P8-001 | Sovereign Architecture
 */

import { PQCLatticeSealEngine } from '../../src/core/crypto/pqc_lattice_seal';

export interface MeshPacket {
  packetId: string;
  senderNodeId: string;
  targetNodeId: string;
  payload: Record<string, unknown>;
  pqcSignature: string;
  timestamp: number;
}

export interface VerificationVerdict {
  isAuthentic: boolean;
  senderVerified: boolean;
  quarantined: boolean;
  errorReason?: string;
}

export class PQCMeshGuard {
  private trustedPeers: Set<string> = new Set();
  private quarantinedPeers: Set<string> = new Set();

  public registerTrustedPeer(peerId: string): void {
    this.trustedPeers.add(peerId);
  }

  /**
   * Signs an outgoing gossip packet with a Post-Quantum Lattice seal.
   */
  public signPacket(senderId: string, targetId: string, payload: Record<string, unknown>): MeshPacket {
    const packetId = `PKT_${senderId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const rawData = `${senderId}:${targetId}:${JSON.stringify(payload)}`;
    const pqcSignature = PQCLatticeSealEngine.generatePQCSeal(Buffer.from(rawData, 'utf-8'));

    return {
      packetId,
      senderNodeId: senderId,
      targetNodeId: targetId,
      payload,
      pqcSignature,
      timestamp: Date.now(),
    };
  }

  /**
   * Verifies an incoming packet's cryptographic lattice seal and peer authenticity.
   */
  public verifyIncomingPacket(packet: MeshPacket): VerificationVerdict {
    // 1. Check if sender is quarantined
    if (this.quarantinedPeers.has(packet.senderNodeId)) {
      return {
        isAuthentic: false,
        senderVerified: false,
        quarantined: true,
        errorReason: `Sender '${packet.senderNodeId}' is QUARANTINED due to prior security breach.`,
      };
    }

    // 2. Check peer trust registration
    if (!this.trustedPeers.has(packet.senderNodeId)) {
      this.quarantinedPeers.add(packet.senderNodeId);
      return {
        isAuthentic: false,
        senderVerified: false,
        quarantined: true,
        errorReason: `Untrusted peer '${packet.senderNodeId}' rejected.`,
      };
    }

    // 3. Cryptographic PQC Lattice Signature Verification
    const rawData = `${packet.senderNodeId}:${packet.targetNodeId}:${JSON.stringify(packet.payload)}`;
    const expectedSeal = PQCLatticeSealEngine.generatePQCSeal(Buffer.from(rawData, 'utf-8'));

    if (packet.pqcSignature !== expectedSeal) {
      this.quarantinedPeers.add(packet.senderNodeId);
      return {
        isAuthentic: false,
        senderVerified: true,
        quarantined: true,
        errorReason: `PQC Lattice Signature Mismatch! Cryptographic tampering detected on packet '${packet.packetId}'. Peer quarantined.`,
      };
    }

    return {
      isAuthentic: true,
      senderVerified: true,
      quarantined: false,
    };
  }

  public isPeerQuarantined(peerId: string): boolean {
    return this.quarantinedPeers.has(peerId);
  }
}
