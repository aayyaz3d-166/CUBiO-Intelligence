/**
 * CUBiO Sovereign Spatial Reasoning Engine
 * Gate: CNL-P7-001 | Sovereign Architecture
 */

export type SpatialPoint3D = [number, number, number];

export interface SpatialBoundingBox {
  id: string;
  min: SpatialPoint3D;
  max: SpatialPoint3D;
}

export type SpatialRelationType =
  | 'CONTAINS'
  | 'INTERSECTS'
  | 'ADJACENT'
  | 'DISJOINT'
  | 'HARMONIC_ALIGNED_369';

export interface SpatialRelationFact {
  subject: string;
  relation: SpatialRelationType;
  object: string;
  confidence: number;
}

export class SpatialReasoningEngine {
  private regions: Map<string, SpatialBoundingBox> = new Map();
  private deducedFacts: SpatialRelationFact[] = [];

  public registerRegion(id: string, min: SpatialPoint3D, max: SpatialPoint3D): void {
    this.regions.set(id, { id, min, max });
  }

  public getRegion(id: string): SpatialBoundingBox | undefined {
    return this.regions.get(id);
  }

  /**
   * Evaluates topological relations between two registered bounding regions.
   */
  public deduceRelation(idA: string, idB: string): SpatialRelationType {
    const rA = this.regions.get(idA);
    const rB = this.regions.get(idB);

    if (!rA || !rB) {
      throw new Error(`[SpatialReasoning Fault] Region '${!rA ? idA : idB}' not found.`);
    }

    // 1. Check Contains: rA contains rB
    if (this.isBoxInsideBox(rB, rA)) {
      return 'CONTAINS';
    }

    // 2. Check Intersects: rA intersects rB
    if (this.isBoxIntersectingBox(rA, rB)) {
      return 'INTERSECTS';
    }

    // 3. Check 369 Harmonic Alignment
    if (this.isHarmonicallyAligned(rA, rB)) {
      return 'HARMONIC_ALIGNED_369';
    }

    // 4. Check Adjacency
    if (this.isBoxAdjacent(rA, rB, 0.05)) {
      return 'ADJACENT';
    }

    return 'DISJOINT';
  }

  /**
   * Executes full spatial deductive forward-chaining across all regions.
   */
  public executeDeductiveChain(): SpatialRelationFact[] {
    this.deducedFacts = [];
    const keys = Array.from(this.regions.keys());

    for (let i = 0; i < keys.length; i++) {
      for (let j = 0; j < keys.length; j++) {
        if (i === j) continue;
        const rel = this.deduceRelation(keys[i], keys[j]);
        if (rel !== 'DISJOINT') {
          this.deducedFacts.push({
            subject: keys[i],
            relation: rel,
            object: keys[j],
            confidence: 1.0,
          });
        }
      }
    }

    return this.deducedFacts;
  }

  private isBoxInsideBox(inner: SpatialBoundingBox, outer: SpatialBoundingBox): boolean {
    return (
      inner.min[0] >= outer.min[0] && inner.max[0] <= outer.max[0] &&
      inner.min[1] >= outer.min[1] && inner.max[1] <= outer.max[1] &&
      inner.min[2] >= outer.min[2] && inner.max[2] <= outer.max[2]
    );
  }

  private isBoxIntersectingBox(a: SpatialBoundingBox, b: SpatialBoundingBox): boolean {
    return (
      a.min[0] <= b.max[0] && a.max[0] >= b.min[0] &&
      a.min[1] <= b.max[1] && a.max[1] >= b.min[1] &&
      a.min[2] <= b.max[2] && a.max[2] >= b.min[2]
    );
  }

  private isBoxAdjacent(a: SpatialBoundingBox, b: SpatialBoundingBox, epsilon: number = 0.05): boolean {
    const dx = Math.max(0, Math.max(a.min[0] - b.max[0], b.min[0] - a.max[0]));
    const dy = Math.max(0, Math.max(a.min[1] - b.max[1], b.min[1] - a.max[1]));
    const dz = Math.max(0, Math.max(a.min[2] - b.max[2], b.min[2] - a.max[2]));
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return dist <= epsilon && dist > 0;
  }

  private isHarmonicallyAligned(a: SpatialBoundingBox, b: SpatialBoundingBox): boolean {
    const cA = [(a.min[0] + a.max[0]) / 2, (a.min[1] + a.max[1]) / 2, (a.min[2] + a.max[2]) / 2];
    const cB = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
    const dx = Math.abs(cA[0] - cB[0]);
    const dy = Math.abs(cA[1] - cB[1]);
    const dz = Math.abs(cA[2] - cB[2]);
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Harmonic delta matches 3/9 (0.333), 6/9 (0.666), or 1.0 within epsilon
    const mod333 = Math.abs((dist % 0.333333));
    return mod333 < 0.02 || Math.abs(dist - 0.369) < 0.02;
  }
}
