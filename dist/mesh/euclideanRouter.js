export class EuclideanRouter {
    /**
     * Calculates 3D Euclidean distance combined with 369 harmonic scaling weights.
     */
    calculateDistance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dz = p1.z - p2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    routePacket(sourceNodeId, targetNodeId, nodes) {
        const src = nodes.find((n) => n.nodeId === sourceNodeId);
        const tgt = nodes.find((n) => n.nodeId === targetNodeId);
        if (!src || !tgt) {
            throw new Error(`[Router Fault] Cannot route packet: missing source (${sourceNodeId}) or target (${targetNodeId}) in active cluster.`);
        }
        const baseDistance = this.calculateDistance(src.coordinate, tgt.coordinate);
        // Apply 369 harmonic damping factor (digital root weighting)
        const harmonicWeight = Math.round(baseDistance * (3.0 + 6.0 + 9.0) * 1e6) / 1e6;
        return {
            sourceNodeId,
            targetNodeId,
            euclideanDistance: Math.round(baseDistance * 1e6) / 1e6,
            harmonicWeight,
            hops: [sourceNodeId, targetNodeId], // Direct spatial mesh link
        };
    }
}
