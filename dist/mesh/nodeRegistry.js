export class NodeRegistry {
    registry = new Map();
    registerNode(descriptor) {
        const { x, y, z } = descriptor.coordinate;
        if (x < 0 || x > 1 || y < 0 || y > 1 || z < 0 || z > 1) {
            throw new Error(`[Mesh Registry Error] Node '${descriptor.nodeId}' coordinate (${x}, ${y}, ${z}) is outside [0, 1]^3 spatial bounds.`);
        }
        this.registry.set(descriptor.nodeId, descriptor);
        console.log(`  [Mesh Registry] Registered node '${descriptor.nodeId}' at endpoint ${descriptor.endpoint} [Space: (${x}, ${y}, ${z})]`);
    }
    getNode(nodeId) {
        return this.registry.get(nodeId);
    }
    getAllNodes() {
        return Array.from(this.registry.values()).filter((n) => n.status === 'ACTIVE');
    }
    unregisterNode(nodeId) {
        this.registry.delete(nodeId);
        console.log(`  [Mesh Registry] Unregistered node '${nodeId}'`);
    }
}
