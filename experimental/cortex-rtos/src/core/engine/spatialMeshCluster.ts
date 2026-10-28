/**
 * Phase 5A — Spatial Mesh Cluster (7×7×7 Grid)
 *
 * Manages a 7×7×7 3D coordinate space with node registration,
 * grid layout, and neighbor discovery via 3D adjacency vectors.
 */

import { Point3D, SpatialHarmonic369Engine } from './spatialHarmonic369';

export interface MeshNode {
  id: string;
  coordinate: Point3D;
  isActive: boolean;
  registeredAt: number;
}

export interface NeighborResult {
  nodeId: string;
  coordinate: Point3D;
  distance: number;
  direction: string; // 'N','S','E','W','U','D' or 'diagonal'
}

export class SpatialMeshCluster {
  private static readonly GRID_SIZE = 7;  // 7×7×7 grid
  private static readonly CELL_SIZE = 1.0 / 7; // each cell = 1/7th of space

  private nodes: Map<string, MeshNode> = new Map();
  private grid: (MeshNode | null)[][][] = this.initEmptyGrid();
  private rssGuard: import('../memory/rssGuard').RSSGuard;

  constructor(rssGuard: import('../memory/rssGuard').RSSGuard) {
    this.rssGuard = rssGuard;
  }

  private initEmptyGrid(): (MeshNode | null)[][][] {
    const g: (MeshNode | null)[][][] = [];
    for (let x = 0; x < 7; x++) {
      g[x] = [];
      for (let y = 0; y < 7; y++) {
        g[x][y] = [];
        for (let z = 0; z < 7; z++) {
          g[x][y][z] = null;
        }
      }
    }
    return g;
  }

  // ─── Coordinate Helpers ────────────────────────────────────────────────

  public coordToCell(c: Point3D): [number, number, number] {
    const cellSize = SpatialMeshCluster.CELL_SIZE;
    const cx = Math.min(6, Math.max(0, Math.floor(c.x / cellSize)));
    const cy = Math.min(6, Math.max(0, Math.floor(c.y / cellSize)));
    const cz = Math.min(6, Math.max(0, Math.floor(c.z / cellSize)));
    return [cx, cy, cz];
  }

  private cellToCoord(cell: [number, number, number]): Point3D {
    return {
      x: (cell[0] + 0.5) / 7,
      y: (cell[1] + 0.5) / 7,
      z: (cell[2] + 0.5) / 7,
    };
  }

  private distance(a: Point3D, b: Point3D): number {
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
  }

  // ─── Node Registration ──────────────────────────────────────────────────

  public registerNode(id: string, coordinate: Point3D): void {
    if (this.nodes.has(id)) {
      throw new Error(`[Mesh Error] Node '${id}' already registered`);
    }
    if (coordinate.x < 0 || coordinate.x > 1 ||
        coordinate.y < 0 || coordinate.y > 1 ||
        coordinate.z < 0 || coordinate.z > 1) {
      throw new Error(`[Mesh Error] Coordinate (${coordinate.x}, ${coordinate.y}, ${coordinate.z}) outside [0,1]^3`);
    }

    // RSS allocation per node (64 KB descriptor)
    this.rssGuard.allocate(64 * 1024, `MeshNode:${id}`);

    const node: MeshNode = {
      id,
      coordinate,
      isActive: true,
      registeredAt: Date.now(),
    };

    this.nodes.set(id, node);

    // Place in grid
    const [cx, cy, cz] = this.coordToCell(coordinate);
    this.grid[cx][cy][cz] = node;

    console.log(`  [Mesh] Registered node '${id}' at (${coordinate.x.toFixed(3)}, ${coordinate.y.toFixed(3)}, ${coordinate.z.toFixed(3)}) [cell (${cx},${cy},${cz})]`);
  }

  public unregisterNode(id: string): void {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`[Mesh Error] Node '${id}' not found`);

    // Free RSS
    this.rssGuard.free(64 * 1024);

    // Remove from grid
    const [cx, cy, cz] = this.coordToCell(node.coordinate);
    if (this.grid[cx][cy][cz]?.id === id) {
      this.grid[cx][cy][cz] = null;
    }

    this.nodes.delete(id);
    console.log(`  [Mesh] Unregistered node '${id}'`);
  }

  public getNode(id: string): MeshNode | undefined {
    return this.nodes.get(id);
  }

  public getAllNodes(): MeshNode[] {
    return Array.from(this.nodes.values());
  }

  public getNodeCount(): number {
    return this.nodes.size;
  }

  // ─── Neighbor Discovery (3D adjacency) ─────────────────────────────────

  private static readonly DIRS: Array<[number, number, number, string]> = [
    [1,0,0,'E'], [-1,0,0,'W'],
    [0,1,0,'N'], [0,-1,0,'S'],
    [0,0,1,'U'],  [0,0,-1,'D'],
    [1,1,0,'NE'], [1,-1,0,'SE'], [-1,1,0,'NW'], [-1,-1,0,'SW'],
    [1,0,1,'EU'], [1,0,-1,'ED'], [-1,0,1,'WU'], [-1,0,-1,'WD'],
    [0,1,1,'NU'], [0,1,-1,'ND'], [0,-1,1,'SU'], [0,-1,-1,'SD'],
    [1,1,1,'NEU'], [1,1,-1,'NED'], [1,-1,1,'SEU'], [1,-1,-1,'SED'],
    [-1,1,1,'NWU'], [-1,1,-1,'NWD'], [-1,-1,1,'SWU'], [-1,-1,-1,'SWD'],
  ];

  public findNeighbors(nodeId: string, radius: number = 1): NeighborResult[] {
    const node = this.nodes.get(nodeId);
    if (!node) return [];

    const results: NeighborResult[] = [];
    const [cx, cy, cz] = this.coordToCell(node.coordinate);
    const threshold = radius * (1/7) * 1.5; // cell-diagonal-ish threshold

    for (const [dx, dy, dz, dir] of SpatialMeshCluster.DIRS) {
      const nx = cx + dx, ny = cy + dy, nz = cz + dz;
      if (nx < 0 || nx > 6 || ny < 0 || ny > 6 || nz < 0 || nz > 6) continue;

      const neighbor = this.grid[nx][ny][nz];
      if (!neighbor) continue;

      const dist = this.distance(node.coordinate, neighbor.coordinate);
      if (dist <= threshold && neighbor.id !== nodeId) {
        results.push({
          nodeId: neighbor.id,
          coordinate: neighbor.coordinate,
          distance: dist,
          direction: dir,
        });
      }
    }

    results.sort((a, b) => a.distance - b.distance);
    return results;
  }

  public findNearest(nodeId: string, excludeIds: string[] = []): NeighborResult | null {
    const node = this.nodes.get(nodeId);
    if (!node) return null;

    let best: NeighborResult | null = null;
    for (const [id, other] of this.nodes) {
      if (id === nodeId || excludeIds.includes(id)) continue;
      const dist = this.distance(node.coordinate, other.coordinate);
      if (!best || dist < best.distance) {
        best = {
          nodeId: id,
          coordinate: other.coordinate,
          distance: dist,
          direction: 'closest',
        };
      }
    }
    return best;
  }

  // ─── Grid Queries ───────────────────────────────────────────────────────

  public isCellOccupied(cx: number, cy: number, cz: number): boolean {
    if (cx < 0 || cx > 6 || cy < 0 || cy > 6 || cz < 0 || cz > 6) return false;
    return this.grid[cx][cy][cz] !== null;
  }

  public getCellNode(cx: number, cy: number, cz: number): MeshNode | null {
    if (cx < 0 || cx > 6 || cy < 0 || cy > 6 || cz < 0 || cz > 6) return null;
    return this.grid[cx][cy][cz];
  }

  public getGridOccupancy(): { occupied: number; total: number } {
    let occupied = 0;
    for (let x = 0; x < 7; x++)
      for (let y = 0; y < 7; y++)
        for (let z = 0; z < 7; z++)
          if (this.grid[x][y][z] !== null) occupied++;
    return { occupied, total: 7*7*7 };
  }

  public clear(): void {
    for (const [id] of this.nodes) {
      this.rssGuard.free(64 * 1024);
    }
    this.nodes.clear();
    this.grid = this.initEmptyGrid();
  }
}

// ─── Harmonic Mesh Aligner (Phase 5B) ─────────────────────────────────────

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
    for (const node of nodes) {
      this.lockNode(node.id);
    }
  }

  public verifyDeterminism(): { sigmaSq: number; allLocked: boolean; lockedCount: number; totalNodes: number } {
    const nodes = this.mesh.getAllNodes();
    const allPoints = nodes.map(n => {
      const lock = this.locks.get(n.id);
      return lock ? lock.lockedCoord : n.coordinate;
    });
    const sigmaSq = this.engine.calculateVariance(allPoints);
    const allLocked = nodes.every(n => this.locks.has(n.id));
    return { sigmaSq, allLocked, lockedCount: this.locks.size, totalNodes: nodes.length };
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
