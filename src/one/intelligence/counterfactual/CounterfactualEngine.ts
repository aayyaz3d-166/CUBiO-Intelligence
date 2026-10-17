/**
 * CUBiO AI — ONE LANGUAGE — NATIVE INTELLIGENCE TOOLING
 * =====================================================
 * Module: @one/intelligence/counterfactual/CounterfactualEngine
 *
 * Implements Capabilities 13–16:
 *   13. Branch Manager (lifecycle, forking, switching, freezing)
 *   14. Reality Simulation (transition commit, virtual time, DAG progression)
 *   15. Reality Comparison (multi-worldline state & path diffing)
 *   16. Counterfactual Engine (speculative what-if evaluation & delta measurement)
 */

import { CanonicalReality } from '../../reality/CanonicalReality';
import { RealityBranch } from '../../reality/RealityBranch';
import { StateNode } from '../../reality/StateNode';
import { StateTransition } from '../../reality/Transition';
import { CausalPath } from '../../reality/CausalPath';
import { NativeValue, toRaw, fromRaw, isEqual } from '../../runtime/NativeValues';
import { CanonicalSerializer } from '../../data/CanonicalSerializer';

export interface SpeculativeAction {
  action: string;
  payloadDelta: Record<string, unknown>;
  params?: Record<string, NativeValue>;
  cost?: number;
}

export interface CounterfactualScenario {
  scenarioName: string;
  forkFromBranchId: string;
  forkFromStateId?: string;
  actions: SpeculativeAction[];
}

export interface CounterfactualOutcome {
  scenarioName: string;
  speculativeBranchId: string;
  success: boolean;
  baselineHeadStateId: string;
  speculativeHeadStateId: string;
  initialPayload: Record<string, unknown>;
  finalPayload: Record<string, unknown>;
  stateDelta: {
    added: Record<string, unknown>;
    modified: Record<string, { before: unknown; after: unknown }>;
    removed: string[];
  };
  totalCost: number;
  divergenceTick: number;
  evaluatedGoalReached?: boolean;
}

export interface RealityBranchDiff {
  branchAId: string;
  branchBId: string;
  lowestCommonAncestorStateId?: string;
  divergencePoint: string;
  pathLengthA: number;
  pathLengthB: number;
  costDifference: number;
  stateIdentical: boolean;
  stateDelta: {
    addedInB: string[];
    removedInB: string[];
    modified: string[];
  };
}

export class CounterfactualEngine {
  public readonly reality: CanonicalReality;

  constructor(reality: CanonicalReality) {
    this.reality = reality;
  }

  // ── Capability 13: Branch Management ───────────────────────────────────────

  public createBranch(name: string, parentBranchId?: string, forkStateId?: string): RealityBranch {
    const parentId = parentBranchId ?? this.reality.rootBranchId;
    return this.reality.forkBranch(parentId, name, forkStateId);
  }

  public getBranch(branchId: string): RealityBranch | undefined {
    return this.reality.getBranch(branchId);
  }

  public freezeBranch(branchId: string): void {
    const branch = this.reality.getBranch(branchId);
    if (branch) branch.freeze();
  }

  public switchActiveBranch(branchId: string): void {
    this.reality.setActiveBranch(branchId);
  }

  // ── Capability 14: Reality Simulation ──────────────────────────────────────

  /**
   * Simulates an action transition on a branch, updating state and virtual clock.
   */
  public simulateStep(
    branchId: string,
    action: string,
    payload: NativeValue,
    cost: number = 1.0
  ): { state: StateNode; transition: StateTransition } {
    return this.reality.commitTransition(branchId, action, payload, {}, cost);
  }

  // ── Capability 15: Reality Comparison & Worldline Diffing ──────────────────

  /**
   * Performs deep structural and causal comparison between two branches.
   */
  public compareBranches(branchAId: string, branchBId: string): RealityBranchDiff {
    const bA = this.reality.getBranch(branchAId);
    const bB = this.reality.getBranch(branchBId);
    if (!bA || !bB) throw new Error(`Branches '${branchAId}' or '${branchBId}' not found.`);

    const stateA = this.reality.getState(bA.headStateId)!;
    const stateB = this.reality.getState(bB.headStateId)!;

    const lca = this.reality.findLowestCommonAncestor(stateA.stateId, stateB.stateId);

    const rawA = (toRaw(stateA.payload) ?? {}) as Record<string, unknown>;
    const rawB = (toRaw(stateB.payload) ?? {}) as Record<string, unknown>;

    const addedInB: string[] = [];
    const removedInB: string[] = [];
    const modified: string[] = [];

    const allKeys = new Set([...Object.keys(rawA), ...Object.keys(rawB)]);
    for (const k of allKeys) {
      if (!(k in rawA) && k in rawB) addedInB.push(k);
      else if (k in rawA && !(k in rawB)) removedInB.push(k);
      else if (JSON.stringify(rawA[k]) !== JSON.stringify(rawB[k])) modified.push(k);
    }

    return {
      branchAId,
      branchBId,
      lowestCommonAncestorStateId: lca?.stateId,
      divergencePoint: lca ? lca.stateId : 'ROOT',
      pathLengthA: bA.path.length(),
      pathLengthB: bB.path.length(),
      costDifference: Number((bB.path.totalCost - bA.path.totalCost).toFixed(4)),
      stateIdentical: stateA.equals(stateB),
      stateDelta: { addedInB, removedInB, modified },
    };
  }

  // ── Capability 16: Counterfactual Speculative "What-If" Engine ─────────────

  /**
   * Evaluates a "What-If" counterfactual scenario without mutating baseline branches.
   */
  public evaluateWhatIf(
    scenario: CounterfactualScenario,
    goalPredicate?: (statePayload: Record<string, unknown>) => boolean
  ): CounterfactualOutcome {
    const parentBranch = this.reality.getBranch(scenario.forkFromBranchId);
    if (!parentBranch) throw new Error(`Parent branch '${scenario.forkFromBranchId}' not found.`);

    // 1. Fork speculative branch
    const specBranch = this.reality.forkBranch(
      parentBranch.branchId,
      `whatif_${scenario.scenarioName}_${Date.now()}`,
      scenario.forkFromStateId
    );

    const initialState = this.reality.getState(specBranch.headStateId)!;
    let currentRaw = (toRaw(initialState.payload) ?? {}) as Record<string, unknown>;
    let totalCost = 0;

    // 2. Execute speculative actions
    for (const step of scenario.actions) {
      currentRaw = { ...currentRaw, ...step.payloadDelta };
      const nextVal = fromRaw(currentRaw);
      const res = this.reality.commitTransition(
        specBranch.branchId,
        step.action,
        nextVal,
        step.params ?? {},
        step.cost ?? 1.0
      );
      totalCost += step.cost ?? 1.0;
    }

    const finalState = this.reality.getState(specBranch.headStateId)!;
    const finalRaw = (toRaw(finalState.payload) ?? {}) as Record<string, unknown>;
    const initialRaw = (toRaw(initialState.payload) ?? {}) as Record<string, unknown>;

    // 3. Compute detailed delta
    const added: Record<string, unknown> = {};
    const modified: Record<string, { before: unknown; after: unknown }> = {};
    const removed: string[] = [];

    for (const [k, v] of Object.entries(finalRaw)) {
      if (!(k in initialRaw)) added[k] = v;
      else if (JSON.stringify(initialRaw[k]) !== JSON.stringify(v)) {
        modified[k] = { before: initialRaw[k], after: v };
      }
    }
    for (const k of Object.keys(initialRaw)) {
      if (!(k in finalRaw)) removed.push(k);
    }

    const goalReached = goalPredicate ? goalPredicate(finalRaw) : undefined;

    // 4. Freeze the speculative branch to preserve isolation
    specBranch.freeze();

    return {
      scenarioName: scenario.scenarioName,
      speculativeBranchId: specBranch.branchId,
      success: true,
      baselineHeadStateId: parentBranch.headStateId,
      speculativeHeadStateId: finalState.stateId,
      initialPayload: initialRaw,
      finalPayload: finalRaw,
      stateDelta: { added, modified, removed },
      totalCost,
      divergenceTick: specBranch.localTime.getTicks(),
      evaluatedGoalReached: goalReached,
    };
  }
}
