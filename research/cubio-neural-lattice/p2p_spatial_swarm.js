/**
 * CUBiO Distributed P2P Spatial Mesh Swarm Core
 * Gate: CNL-P23-002 | Sovereign Architecture ("one-swarm")
 * 343-Cell Spatial Voxel Sharding & Serverless Peer-to-Peer Gossip Protocol
 */
import { PQCPacketGuard } from './pqc_packet_guard';
import { HarmonicQuorumConsensusEngine } from './harmonic_quorum_consensus';
import { PQCLatticeSealEngine } from '../../src/core/crypto/pqc_lattice_seal';
export class P2PSpatialSwarmRouter {
    nodes = new Map();
    packetGuard = new PQCPacketGuard();
    consensusEngine = new HarmonicQuorumConsensusEngine();
    spatialLatticeShards = new Map();
    constructor() {
        // Initialize 343 spatial cell shards
        for (let i = 0; i < 343; i++) {
            this.spatialLatticeShards.set(i, new Map());
        }
    }
    /**
     * Registers a sovereign peer node in the 3D spatial coordinate space.
     */
    registerNode(node) {
        this.nodes.set(node.nodeId, node);
        this.packetGuard.registerTrustedPeer(node.nodeId);
    }
    getNode(nodeId) {
        return this.nodes.get(nodeId);
    }
    getAllNodes() {
        return Array.from(this.nodes.values()).filter((n) => n.isActive);
    }
    /**
     * Calculates linear shard index (0..342) from 3D coordinates [x, y, z].
     */
    coordToShardIndex(coord) {
        const x = Math.max(0, Math.min(6, Math.floor(coord[0])));
        const y = Math.max(0, Math.min(6, Math.floor(coord[1])));
        const z = Math.max(0, Math.min(6, Math.floor(coord[2])));
        return x + y * 7 + z * 49;
    }
    /**
     * Executes decentralized P2P shard broadcast and multi-node consensus.
     */
    broadcastShardUpdate(senderNodeId, targetCoord, shardKey, shardValue, sequenceNumber = 1) {
        const sender = this.nodes.get(senderNodeId);
        if (!sender) {
            throw new Error(`Sender node '${senderNodeId}' not registered in swarm.`);
        }
        const shardIndex = this.coordToShardIndex(targetCoord);
        const activeNodes = this.getAllNodes();
        const packets = [];
        // 1. Sign and emit PQC packets to all peer nodes
        for (const peer of activeNodes) {
            const pkt = this.packetGuard.signPacket(senderNodeId, targetCoord, {
                shardKey,
                shardValue,
                shardIndex,
            }, sequenceNumber);
            packets.push(pkt);
        }
        // 2. Validate and simulate gossip voting across harmonic tiers
        const votes = [];
        const proposedState = `${shardIndex}:${shardKey}:${JSON.stringify(shardValue)}`;
        const proposedStateHash = PQCLatticeSealEngine.generatePQCSeal(Buffer.from(proposedState, 'utf-8'));
        for (const peer of activeNodes) {
            const pkt = packets.find((p) => p.senderNodeId === senderNodeId);
            if (pkt) {
                const verification = this.packetGuard.verifyIncomingPacket(pkt);
                if (verification.isAuthentic) {
                    votes.push({
                        nodeId: peer.nodeId,
                        shardIndex,
                        proposedStateHash,
                        frequencyMhz: peer.frequencyMhz,
                        pqcSignature: pkt.pqcSignature,
                    });
                }
            }
        }
        // 3. Evaluate harmonic quorum consensus (Byzantine supermajority >= 67%)
        const roundId = `RND_SEQ_${sequenceNumber}_SHARD_${shardIndex}`;
        const consensus = this.consensusEngine.evaluateConsensusRound(roundId, shardIndex, votes);
        // 4. Commit verified shard state to distributed spatial storage
        if (consensus.quorumAchieved) {
            const shardMap = this.spatialLatticeShards.get(shardIndex) || new Map();
            shardMap.set(shardKey, shardValue);
            this.spatialLatticeShards.set(shardIndex, shardMap);
            // Replicate to each active node local store
            for (const peer of activeNodes) {
                peer.shardStorage.set(shardKey, shardValue);
            }
        }
        const masterData = `${roundId}:${consensus.committedStateHash}:${consensus.affirmativeVotes}/${activeNodes.length}`;
        const pqcSwarmSeal = PQCLatticeSealEngine.generatePQCSeal(Buffer.from(masterData, 'utf-8'));
        return {
            broadcastId: roundId,
            senderNodeId,
            totalNodesReached: activeNodes.length,
            packetsEmitted: packets.length,
            consensusAchieved: consensus.quorumAchieved,
            committedStateHash: consensus.committedStateHash,
            pqcSwarmSeal,
        };
    }
    getShardValue(coord, key) {
        const shardIndex = this.coordToShardIndex(coord);
        return this.spatialLatticeShards.get(shardIndex)?.get(key);
    }
    getQuarantineCount() {
        return this.packetGuard.getQuarantinedCount();
    }
}
