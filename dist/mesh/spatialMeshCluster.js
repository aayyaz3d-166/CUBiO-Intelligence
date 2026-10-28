import { NodeRegistry } from './nodeRegistry';
import { EuclideanRouter } from './euclideanRouter';
export class SpatialMeshCluster {
    registry;
    router;
    clusterId;
    constructor(clusterId = 'CubiO-Mesh-Alpha') {
        this.clusterId = clusterId;
        this.registry = new NodeRegistry();
        this.router = new EuclideanRouter();
    }
    addNode(nodeId, endpoint, coordinate, availableRssMb = 512) {
        this.registry.registerNode({
            nodeId,
            endpoint,
            coordinate,
            availableRssMb,
            status: 'ACTIVE',
        });
    }
    dispatchPacket(sourceNodeId, targetNodeId, payload) {
        const activeNodes = this.registry.getAllNodes();
        const route = this.router.routePacket(sourceNodeId, targetNodeId, activeNodes);
        console.log(`[Mesh Cluster '${this.clusterId}'] Routing packet via 3D harmonic mesh:`);
        console.log(`  - Path: ${route.hops.join(' -> ')}`);
        console.log(`  - Euclidean Distance: ${route.euclideanDistance}`);
        console.log(`  - 369 Harmonic Weight: ${route.harmonicWeight}`);
        return route;
    }
    getClusterStats() {
        return {
            clusterId: this.clusterId,
            activeNodesCount: this.registry.getAllNodes().length,
        };
    }
}
