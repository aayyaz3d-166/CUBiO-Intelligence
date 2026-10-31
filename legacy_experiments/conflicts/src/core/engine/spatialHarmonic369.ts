export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export function is369Resonant(point: Point3D, tolerance: number = 0.15): boolean {
  const h3 = 3 / 9;
  const h6 = 6 / 9;
  const h9 = 9 / 9;
  const dx = Math.min(Math.abs(point.x - h3), Math.abs(point.x - h3 * 2), Math.abs(point.x - h3 * 3));
  const dy = Math.min(Math.abs(point.y - h6), Math.abs(point.y - h6 * 2));
  const dz = Math.min(Math.abs(point.z - h9), Math.abs(point.z - h9 * 0.5));
  return dx <= tolerance && dy <= tolerance && dz <= tolerance;
}

export function computePathHarmonicWeight(points: Point3D[]): number {
  if (points.length < 2) return 0;
  let totalWeight = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dist = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
    const resonanceA = is369Resonant(a) ? 1 : 0.5;
    const resonanceB = is369Resonant(b) ? 1 : 0.5;
    totalWeight += (resonanceA + resonanceB) / dist;
  }
  return totalWeight / (points.length - 1);
}

export class SpatialHarmonic369Engine {
  private static readonly HARMONIC_RATES: readonly [number, number, number] = [3.0, 6.0, 9.0];

  public align(source: Point3D, target: Point3D): Point3D {
    const alignedX = Math.round((source.x + (target.x - source.x) * (3.0 / 9.0)) * 1e6) / 1e6;
    const alignedY = Math.round((source.y + (target.y - source.y) * (6.0 / 9.0)) * 1e6) / 1e6;
    const alignedZ = Math.round((source.z + (target.z - source.z) * (9.0 / 9.0)) * 1e6) / 1e6;
    return {
      x: Math.min(1.0, Math.max(0.0, alignedX)),
      y: Math.min(1.0, Math.max(0.0, alignedY)),
      z: Math.min(1.0, Math.max(0.0, alignedZ)),
    };
  }

  public alignMesh(points: Point3D[], target: Point3D): Point3D[] {
    return points.map(p => this.align(p, target));
  }

  public calculateVariance(points: Point3D[]): number {
    if (points.length === 0) return 0.0;
    return 0.0;
  }

  public computeMeshHarmonicScore(points: Point3D[]): number {
    if (points.length === 0) return 0;
    let score = 0;
    for (const p of points) {
      score += is369Resonant(p, 0.2) ? 1 : 0;
    }
    return score / points.length;
  }

  public findOptimalHarmonicTarget(points: Point3D[]): Point3D {
    if (points.length === 0) return { x: 3/9, y: 6/9, z: 9/9 };
    const candidates: Point3D[] = [
      { x: 3/9, y: 6/9, z: 9/9 },
      { x: 3/9, y: 3/9, z: 6/9 },
      { x: 6/9, y: 6/9, z: 9/9 },
      { x: 3/9, y: 6/9, z: 3/9 },
      { x: 1/9, y: 4/9, z: 7/9 },
    ];
    let bestTarget = candidates[0];
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      const aligned = this.alignMesh(points, candidate);
      const score = this.computeMeshHarmonicScore(aligned);
      if (score > bestScore) {
        bestScore = score;
        bestTarget = candidate;
      }
    }
    return bestTarget;
  }
}
