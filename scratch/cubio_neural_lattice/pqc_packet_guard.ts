/**
 * CUBiO Post-Quantum Lattice Packet Guard
 * Gate: CNL-P23-002 | Sovereign Architecture ("one-swarm")
 * Module-LWE Polynomial Ring Cryptographic Sealing for P2P Packets
 */

import { PQCLatticeSealEngine } from '../../src/core/crypto/pqc_lattice_seal';

export interface PQCPacket {
  packetId: string;
  senderNodeId: string;
  targetSpatialCoord: [number, number, number];
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

export class PQCPacketGuard {
  private trustedPeers: Set<string> = new Set();
  private quarantinedPeers: Set<string> = new Set();
  private quarantinedCount: number = 0;

  public registerTrustedPeer(peerId: string): void {
    this.trustedPeers.add(peerId);
  }

  /**
   * Signs an outgoing gossip packet with a Post-Quantum Lattice seal.
   */
  public signPacket(
    senderId: string,
    targetCoord: [number, number, number],
    payload: Record<string, unknown>,
    sequenceNumber: number = 1
  ): PQCPacket {
    const packetId = `PKT_${senderId}_SEQ_${sequenceNumber}`;
    const timestamp = 1725880000000 + sequenceNumber;
    const rawData = `${senderId}:${targetCoord.join(',')}:${JSON.stringify(payload)}:${sequenceNumber}`;
    const pqcSignature = PQCLatticeSealEngine.generatePQCSeal(Buffer.from(rawData, 'utf-8'));

    return {
      packetId,
      senderNodeId: senderId,
      targetSpatialCoord: targetCoord,
      payload,
      pqcSignature,
      timestamp,
    };
  }

  /**
   * Verifies an incoming packet's cryptographic lattice seal and peer authenticity.
   */
  public verifyIncomingPacket(packet: PQCPacket): VerificationVerdict {
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
      this.quarantinedCount++;
      return {
        isAuthentic: false,
        senderVerified: false,
        quarantined: true,
        errorReason: `Untrusted peer '${packet.senderNodeId}' rejected.`,
      };
    }

    // 3. Cryptographic PQC Lattice Signature Verification
    const seq = packet.packetId.includes('_SEQ_') ? packet.packetId.split('_SEQ_')[1] : '1';
    const rawData = `${packet.senderNodeId}:${packet.targetSpatialCoord.join(',')}:${JSON.stringify(packet.payload)}:${seq}`;
    const expectedSeal = PQCLatticeSealEngine.generatePQCSeal(Buffer.from(rawData, 'utf-8'));

    if (packet.pqcSignature !== expectedSeal) {
      this.quarantinedPeers.add(packet.senderNodeId);
      this.quarantinedCount++;
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

  public getQuarantinedCount(): number {
    return this.quarantinedCount;
  }
}
