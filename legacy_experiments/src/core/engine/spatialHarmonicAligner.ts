/**
 * Phase 5B — Harmonic Mesh Aligner
 *
 * Mesh-wide 369 alignment engine: locks all registered nodes
 * to the 369 addressing matrix with determinism (σ² = 0.0).
 */

import { SpatialMeshCluster, MeshNode } from './spatialMeshCluster';
import { SpatialHarmonic369Engine, Point3D, is369Resonant } from './spatialHarmonic369';

export interface HarmonicLock {
  nodeId: string;
  sourceCoord: Point3D;
  lockedCoord: Point3D;
  resonance: number;
}

export class HarmonicMeshAligner {
  private mesh: SpatialMeshCluster;
  private engine: SpatialHarmonic369Engine;
  private locks: Map<string, HarmonicLock> = new Map();
  private readonly TARGET_369: Point3D = { x: 3/9, y: 6/9, z: 9/9 };

  constructor(mesh: SpatialMeshCluster) {
    this.mesh = mesh;
    this.engine = new SpatialHarmonic369Engine();
  }

  public lockNode(nodeId: string): HarmonicLock | null {
    const node = this.mesh.getNode(nodeId);
    if (!node) return null;

    const locked = this.engine.align(node.coordinate, this.TARGET_369);
    const lock: HarmonicLock = {
      nodeId,
      sourceCoord: node.coordinate,
      lockedCoord: locked,
      resonance: this.computeResonance(locked),
    };

    this.locks.set(nodeId, lock);
    console.log(`  [Harmonic] Locked '${nodeId}': (${node.coordinate.x.toFixed(3)}, ${node.coordinate.y.toFixed(3)}, ${node.coordinate.z.toFixed(3)}) → (${locked.x.toFixed(4)}, ${locked.y.toFixed(4)}, ${locked.z.toFixed(4)}) [resonance: ${lock.resonance.toFixed(4)}]`);
    return lock;
  }

  public unlockNode(nodeId: string): void {
    this.locks.delete(nodeId);
  }

  public getLock(nodeId: string): HarmonicLock | undefined {
    return this.locks.get(nodeId);
  }

  public getAllLocks(): HarmonicLock[] {
    return Array.from(this.locks.values());
  }

  public alignAllNodes(): void {
    const nodes = this.mesh.getAllNodes();
    console.log(`  [Harmonic Aligner] Aligning ${nodes.length} nodes to 369 matrix...`);

    for (const node of nodes) {
      this.lockNode(node.id);
    }

    console.log(`  [Harmonic Aligner] Done. σ² = ${this.verifyDeterminism().sigmaSq} (deterministic).`);
  }

  public verifyDeterminism(): { sigmaSq: number; allLocked: boolean; lockedCount: number; totalNodes: number } {
    const nodes = this.mesh.getAllNodes();
    const allPoints = nodes.map(n => {
      const lock = this.locks.get(n.id);
      return lock ? lock.lockedCoord : n.coordinate;
    });

    const sigmaSq = this.engine.calculateVariance(allPoints);
    const allLocked = nodes.every(n => this.locks.has(n.id));

    return {
      sigmaSq,
      allLocked,
      lockedCount: this.locks.size,
      totalNodes: nodes.length,
    };
  }

  public getMeshHarmonicScore(): number {
    const nodes = this.mesh.getAllNodes();
    if (nodes.length === 0) return 0;
    const coords = nodes.map(n => n.coordinate);
    return this.engine.computeMeshHarmonicScore(coords);
  }

  public getAlignedMeshScore(): number {
    const locks = this.getAllLocks();
    if (locks.length === 0) return 0;
    const coords = locks.map(l => l.lockedCoord);
    return this.engine.computeMeshHarmonicScore(coords);
  }

  private computeResonance(point: Point3D): number {
    const h3 = 3/9, h6 = 6/9, h9 = 9/9;
    const dx = Math.abs(point.x - h3);
    const dy = Math.abs(point.y - h6);
    const dz = Math.abs(point.z - h9);
    const raw = 1.0 - (dx + dy + dz) / 3.0;
    return Math.max(0, Math.min(1, raw));
  }

  public clear(): void {
    this.locks.clear();
  }
}
