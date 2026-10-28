export class SnapshotEngine {
    wal;
    constructor(wal) {
        this.wal = wal;
    }
    createSnapshot(snapshotId, nodes, rssAllocatedBytes) {
        const nodesCopy = {};
        for (const [id, node] of nodes.entries()) {
            nodesCopy[id] = JSON.parse(JSON.stringify(node));
        }
        const snapshotPayload = {
            nodes: nodesCopy,
            rssAllocatedBytes,
        };
        const stateHash = this.wal.computeStateHash(snapshotPayload);
        const sequenceId = this.wal.getSequenceCount();
        // Log snapshot transaction into WAL
        this.wal.append('SYSTEM', 'CREATE_SNAPSHOT', { snapshotId, stateHash, sequenceId });
        return {
            snapshotId,
            sequenceId,
            stateHash,
            nodes: nodesCopy,
            rssAllocatedBytes,
        };
    }
    /**
     * Computes zero-variance diff between two snapshots.
     */
    diffSnapshots(base, target) {
        const diffs = [];
        if (base.stateHash === target.stateHash) {
            return ['[ZERO_DIFF] Snapshots are bit-for-bit identical (σ² = 0.0)'];
        }
        for (const nodeId of Object.keys(target.nodes)) {
            if (!base.nodes[nodeId]) {
                diffs.push(`[NODE_ADDED] Node '${nodeId}' added in snapshot '${target.snapshotId}'`);
                continue;
            }
            const baseCoord = base.nodes[nodeId].coordinate;
            const targetCoord = target.nodes[nodeId].coordinate;
            if (baseCoord.x !== targetCoord.x ||
                baseCoord.y !== targetCoord.y ||
                baseCoord.z !== targetCoord.z) {
                diffs.push(`[SPATIAL_SHIFT] Node '${nodeId}' position changed from (${baseCoord.x}, ${baseCoord.y}, ${baseCoord.z}) -> (${targetCoord.x}, ${targetCoord.y}, ${targetCoord.z})`);
            }
        }
        for (const nodeId of Object.keys(base.nodes)) {
            if (!target.nodes[nodeId]) {
                diffs.push(`[NODE_REMOVED] Node '${nodeId}' removed in snapshot '${target.snapshotId}'`);
            }
        }
        return diffs;
    }
}
