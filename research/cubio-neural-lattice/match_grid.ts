/**
 * CUBiO Spatial Pattern Matching Engine (@MatchGrid)
 * Target: Geometric Region Evaluation (Boxes, Spheres, Hyper-Planes)
 */

export type SpatialCoord = [number, number, number];

export interface BoxRegion {
  type: 'box';
  min: SpatialCoord;
  max: SpatialCoord;
  route: string;
}

export interface SphereRegion {
  type: 'sphere';
  center: SpatialCoord;
  radius: number;
  harmonicFrequency: number; // 3, 6, or 9 MHz
}

export type SpatialRule = BoxRegion | SphereRegion | { type: 'default'; route: string };

export interface MatchGridEvaluationResult {
  matchedRuleType: 'box' | 'sphere' | 'default' | 'none';
  route?: string;
  harmonicTrigger?: number;
}

export class MatchGridEvaluator {
  private rules: SpatialRule[];

  constructor(rules: SpatialRule[]) {
    this.rules = rules;
  }

  public evaluate(coord: SpatialCoord): MatchGridEvaluationResult {
    for (const rule of this.rules) {
      if (rule.type === 'box' && this.isInsideBox(coord, rule.min, rule.max)) {
        return { matchedRuleType: 'box', route: rule.route };
      }
      if (rule.type === 'sphere' && this.isInsideSphere(coord, rule.center, rule.radius)) {
        return { matchedRuleType: 'sphere', harmonicTrigger: rule.harmonicFrequency };
      }
    }

    // Fallback to default if present
    const defaultRule = this.rules.find((r) => r.type === 'default') as
      | { type: 'default'; route: string }
      | undefined;

    return {
      matchedRuleType: defaultRule ? 'default' : 'none',
      route: defaultRule ? defaultRule.route : 'NULL_ROUTE',
    };
  }

  private isInsideBox(p: SpatialCoord, min: SpatialCoord, max: SpatialCoord): boolean {
    return (
      p[0] >= min[0] &&
      p[0] <= max[0] &&
      p[1] >= min[1] &&
      p[1] <= max[1] &&
      p[2] >= min[2] &&
      p[2] <= max[2]
    );
  }

  private isInsideSphere(p: SpatialCoord, center: SpatialCoord, radius: number): boolean {
    const dx = p[0] - center[0];
    const dy = p[1] - center[1];
    const dz = p[2] - center[2];
    return dx * dx + dy * dy + dz * dz <= radius * radius;
  }
}
