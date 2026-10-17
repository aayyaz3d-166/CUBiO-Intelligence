import { Point3D } from '../core/engine/spatialHarmonic369';

export interface ClusterNodeDescriptor {
  nodeId: string;
  endpoint: string;
  coordinate: Point3D;
  availableRssMb: number;
  status: 'ACTIVE' | 'DRAINING' | 'OFFLINE';
}

export class NodeRegistry {
  private registry: Map<string, ClusterNodeDescriptor> = new Map();

  public registerNode(descriptor: ClusterNodeDescriptor): void {
    const { x, y, z } = descriptor.coordinate;
    if (x < 0 || x > 1 || y < 0 || y > 1 || z < 0 || z > 1) {
      throw new Error(`[Mesh Registry Error] Node '${descriptor.nodeId}' coordinate (${x}, ${y}, ${z}) is outside [0, 1]^3 spatial bounds.`);
    }
    this.registry.set(descriptor.nodeId, descriptor);
    console.log(`  [Mesh Registry] Registered node '${descriptor.nodeId}' at endpoint ${descriptor.endpoint} [Space: (${x}, ${y}, ${z})]`);
  }

  public getNode(nodeId: string): ClusterNodeDescriptor | undefined {
    return this.registry.get(nodeId);
  }

  public getAllNodes(): ClusterNodeDescriptor[] {
    return Array.from(this.registry.values()).filter((n) => n.status === 'ACTIVE');
  }

  public unregisterNode(nodeId: string): void {
    this.registry.delete(nodeId);
    console.log(`  [Mesh Registry] Unregistered node '${nodeId}'`);
  }
}
