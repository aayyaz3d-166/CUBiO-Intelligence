/**
 * CUBiO Neuro-Symbolic Hybrid Compilation & Inference Core
 * Gate: CNL-P5-001 | Sovereign Architecture
 */

export interface SymbolicPredicate {
  field: string;
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'IN_SLICE' | 'HARMONIC_MATCH';
  value: unknown;
}

export interface SymbolicRule {
  id: string;
  name: string;
  predicates: SymbolicPredicate[];
  action: string;
  confidenceThreshold: number; // e.g. 0.85
  priority: number;            // 369-aligned priority
}

export interface SpatialNeuralWeightVector {
  cellIndex: number;
  weights: number[]; // Continuous weights
  bias: number;
  harmonicResonance: number; // 3, 6, or 9
}

export interface HybridInferenceResult {
  ruleId: string;
  symbolicGuardPassed: boolean;
  neuralActivationScore: number;
  hybridConfidence: number;
  isActuationBlocked: boolean; // Immutable Fail-Closed safety lock
  actionTaken: string;
  deterministicVariance: number;
}

export class NeuroSymbolicEngine {
  private rules: Map<string, SymbolicRule> = new Map();
  private weightLattice: Map<number, SpatialNeuralWeightVector> = new Map();
  public readonly is_actuation_blocked: boolean = true; // Permanent Fail-Closed Safety Lock

  constructor() {
    this.is_actuation_blocked = true;
  }

  public registerRule(rule: SymbolicRule): void {
    this.rules.set(rule.id, rule);
  }

  public setNeuralWeights(cellIndex: number, weights: number[], bias: number, harmonicResonance: number = 9): void {
    this.weightLattice.set(cellIndex, {
      cellIndex,
      weights: [...weights],
      bias,
      harmonicResonance,
    });
  }

  /**
   * Deterministic Sigmoid Activation: σ(z) = 1 / (1 + exp(-z))
   */
  private sigmoid(z: number): number {
    return Math.round((1.0 / (1.0 + Math.exp(-z))) * 1e6) / 1e6;
  }

  /**
   * Evaluates a symbolic predicate against context.
   */
  public evaluatePredicate(predicate: SymbolicPredicate, context: Record<string, unknown>): boolean {
    const val = context[predicate.field];

    switch (predicate.operator) {
      case '==':
        return val === predicate.value;
      case '!=':
        return val !== predicate.value;
      case '>':
        return typeof val === 'number' && typeof predicate.value === 'number' && val > predicate.value;
      case '<':
        return typeof val === 'number' && typeof predicate.value === 'number' && val < predicate.value;
      case '>=':
        return typeof val === 'number' && typeof predicate.value === 'number' && val >= predicate.value;
      case '<=':
        return typeof val === 'number' && typeof predicate.value === 'number' && val <= predicate.value;
      case 'HARMONIC_MATCH':
        return typeof val === 'number' && (val % 3 === 0 || val === 369);
      case 'IN_SLICE':
        if (Array.isArray(predicate.value) && typeof val === 'number') {
          return predicate.value.includes(val);
        }
        return false;
      default:
        return false;
    }
  }

  /**
   * Evaluates hybrid symbolic-neural inference over a target hyper-cell.
   */
  public evaluateHybrid(
    ruleId: string,
    cellIndex: number,
    inputVector: number[],
    context: Record<string, unknown>
  ): HybridInferenceResult {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`[NeuroSymbolic Error] Rule '${ruleId}' not found.`);
    }

    // 1. Symbolic Guard Evaluation (Deterministic Boolean Logic)
    let symbolicGuardPassed = true;
    for (const pred of rule.predicates) {
      if (!this.evaluatePredicate(pred, context)) {
        symbolicGuardPassed = false;
        break;
      }
    }

    // 2. Spatial Neural Weight Feed-Forward Activation
    const weightVec = this.weightLattice.get(cellIndex) || {
      cellIndex,
      weights: new Array(inputVector.length).fill(0.369),
      bias: 0.0369,
      harmonicResonance: 9,
    };

    let dotProduct = weightVec.bias;
    const len = Math.min(inputVector.length, weightVec.weights.length);
    for (let i = 0; i < len; i++) {
      dotProduct += inputVector[i] * weightVec.weights[i];
    }

    // 369 Harmonic Resonance Modulation factor
    const harmonicModulation = (weightVec.harmonicResonance / 9.0) * 0.1;
    const neuralActivationScore = this.sigmoid(dotProduct + harmonicModulation);

    // 3. Composite Hybrid Confidence Score
    const hybridConfidence = symbolicGuardPassed
      ? Math.round(neuralActivationScore * 1e6) / 1e6
      : 0.0;

    const actionAllowed = symbolicGuardPassed && hybridConfidence >= rule.confidenceThreshold;
    const actionTaken = actionAllowed ? rule.action : 'REJECTED_BY_GUARD_OR_THRESHOLD';

    return {
      ruleId,
      symbolicGuardPassed,
      neuralActivationScore,
      hybridConfidence,
      isActuationBlocked: this.is_actuation_blocked, // Always true (Fail-Closed)
      actionTaken,
      deterministicVariance: 0.0, // σ² = 0.0
    };
  }

  public getRules(): SymbolicRule[] {
    return Array.from(this.rules.values());
  }

  public getWeightLatticeSize(): number {
    return this.weightLattice.size;
  }
}
