import { NodeRegistry, ClusterNodeDescriptor } from './nodeRegistry';
import { EuclideanRouter, RoutePathResult } from './euclideanRouter';
import { Point3D } from '../core/engine/spatialHarmonic369';

export class SpatialMeshCluster {
  private registry: NodeRegistry;
  private router: EuclideanRouter;
  private clusterId: string;

  constructor(clusterId: string = 'CubiO-Mesh-Alpha') {
    this.clusterId = clusterId;
    this.registry = new NodeRegistry();
    this.router = new EuclideanRouter();
  }

  public addNode(nodeId: string, endpoint: string, coordinate: Point3D, availableRssMb: number = 512): void {
    this.registry.registerNode({
      nodeId,
      endpoint,
      coordinate,
      availableRssMb,
      status: 'ACTIVE',
    });
  }

  public dispatchPacket(sourceNodeId: string, targetNodeId: string, payload: unknown): RoutePathResult {
    const activeNodes = this.registry.getAllNodes();
    const route = this.router.routePacket(sourceNodeId, targetNodeId, activeNodes);

    console.log(`[Mesh Cluster '${this.clusterId}'] Routing packet via 3D harmonic mesh:`);
    console.log(`  - Path: ${route.hops.join(' -> ')}`);
    console.log(`  - Euclidean Distance: ${route.euclideanDistance}`);
    console.log(`  - 369 Harmonic Weight: ${route.harmonicWeight}`);

    return route;
  }

  public getClusterStats() {
    return {
      clusterId: this.clusterId,
      activeNodesCount: this.registry.getAllNodes().length,
    };
  }
}
