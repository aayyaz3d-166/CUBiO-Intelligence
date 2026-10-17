/**
 * ONE Language — Canonical Reality Manifold
 * ==========================================
 * Module: @one/reality/CanonicalReality
 *
 * Implements the REALITY primitive in the PATH ≠ STATE ≠ REALITY ontology.
 * Represents a complete, sovereign causal universe containing a DAG of states,
 * branching counterfactual worldlines, virtual timelines, and 3-way branch merging.
 *
 * Resource limits strictly bounded to prevent uncontrolled expansion:
 *   - maxStates: 10,000
 *   - maxBranches: 128
 *   - maxBranchDepth: 64
 *   - maxTransitionsPerBranch: 5,000
 */

import * as crypto from 'crypto';
import { StateNode } from './StateNode';
import { StateTransition } from './Transition';
import { RealityBranch } from './RealityBranch';
import { CanonicalTime } from './CanonicalTime';
import { NativeValue, createRecord, toRaw, fromRaw, isEqual } from '../runtime/NativeValues';
import { OneNativeRuntimeError } from '../runtime/NativeErrors';
import { CanonicalSerializer } from '../data/CanonicalSerializer';

export interface RealityResourceConfig {
  maxStates?: number;                // Default: 10,000
  maxBranches?: number;              // Default: 128
  maxBranchDepth?: number;           // Default: 64
  maxTransitionsPerBranch?: number;  // Default: 5,000
}

export class CanonicalReality {
  public readonly realityId: string;
  public readonly name: string;
  public readonly rootBranchId: string;

  private states: Map<string, StateNode> = new Map();
  private transitions: Map<string, StateTransition> = new Map();
  private branches: Map<string, RealityBranch> = new Map();
  private activeBranchId: string;

  private stateCounter: number = 0;
  private transitionCounter: number = 0;
  private branchCounter: number = 0;

  // Resource Bounds
  private readonly maxStates: number;
  private readonly maxBranches: number;
  private readonly maxBranchDepth: number;
  private readonly maxTransitionsPerBranch: number;

  constructor(
    realityId: string,
    name: string,
    initialPayload: NativeValue,
    config: RealityResourceConfig = {}
  ) {
    this.realityId = realityId;
    this.name = name;

    this.maxStates = config.maxStates ?? 10_000;
    this.maxBranches = config.maxBranches ?? 128;
    this.maxBranchDepth = config.maxBranchDepth ?? 64;
    this.maxTransitionsPerBranch = config.maxTransitionsPerBranch ?? 5_000;

    // 1. Create Root State
    const rootStateId = `state_0`;
    this.stateCounter++;
    const rootState = new StateNode({
      stateId: rootStateId,
      revision: 1,
      parentStateIds: [],
      payload: initialPayload,
      createdAtTick: 0,
    });
    this.states.set(rootStateId, rootState);

    // 2. Create Root / Main Branch
    this.rootBranchId = `branch_main`;
    this.branchCounter++;
    const rootBranch = new RealityBranch({
      branchId: this.rootBranchId,
      name: 'main',
      forkStateId: rootStateId,
      initialStateId: rootStateId,
      depth: 0,
    });
    this.branches.set(this.rootBranchId, rootBranch);
    this.activeBranchId = this.rootBranchId;
  }

  // ── 1. State Mutation & Transition Commits ──────────────────────────────────

  /**
   * Commits a state transition along a specific branch.
   */
  public commitTransition(
    branchId: string,
    action: string,
    newPayload: NativeValue,
    params: Record<string, NativeValue> = {},
    cost: number = 1.0
  ): { state: StateNode; transition: StateTransition } {
    const branch = this.branches.get(branchId);
    if (!branch) {
      throw new Error(`[CanonicalReality Error] Branch '${branchId}' not found.`);
    }

    if (this.states.size >= this.maxStates) {
      throw new OneNativeRuntimeError(
        'E7011',
        `[CanonicalReality E7011] Maximum state capacity (${this.maxStates}) reached. State allocation rejected.`
      );
    }

    if (branch.path.length() >= this.maxTransitionsPerBranch) {
      throw new OneNativeRuntimeError(
        'E7011',
        `[CanonicalReality E7011] Maximum transitions per branch (${this.maxTransitionsPerBranch}) reached on branch '${branch.name}'.`
      );
    }

    const parentState = this.states.get(branch.headStateId)!;
    const newStateId = `state_${this.stateCounter++}`;
    const transId = `trans_${this.transitionCounter++}`;
    const nextTick = branch.localTime.getTicks() + 1;

    const newState = new StateNode({
      stateId: newStateId,
      revision: parentState.revision + 1,
      parentStateIds: [parentState.stateId],
      payload: newPayload,
      createdAtTick: nextTick,
    });

    const transition = new StateTransition({
      transitionId: transId,
      fromStateId: parentState.stateId,
      toStateId: newState.stateId,
      action,
      params,
      cost,
      tick: nextTick,
    });

    this.states.set(newState.stateId, newState);
    this.transitions.set(transition.transitionId, transition);
    branch.commitState(newState.stateId, transition);

    return { state: newState, transition };
  }

  // ── 2. Branch Forking & Lifecycle ──────────────────────────────────────────

  /**
   * Forks a new counterfactual worldline branch from a parent branch at a specific state.
   */
  public forkBranch(
    parentBranchId: string,
    branchName: string,
    forkFromStateId?: string
  ): RealityBranch {
    if (this.branches.size >= this.maxBranches) {
      throw new OneNativeRuntimeError(
        'E7011',
        `[CanonicalReality E7011] Maximum concurrent active branches (${this.maxBranches}) exceeded. Forking rejected.`
      );
    }

    const parentBranch = this.branches.get(parentBranchId);
    if (!parentBranch) {
      throw new Error(`[CanonicalReality Error] Parent branch '${parentBranchId}' not found.`);
    }

    if (parentBranch.depth + 1 > this.maxBranchDepth) {
      throw new OneNativeRuntimeError(
        'E7011',
        `[CanonicalReality E7011] Maximum branch depth (${this.maxBranchDepth}) exceeded. Cannot fork branch at depth ${parentBranch.depth + 1}.`
      );
    }

    const forkStateId = forkFromStateId ?? parentBranch.headStateId;
    if (!this.states.has(forkStateId)) {
      throw new Error(`[CanonicalReality Error] Fork state '${forkStateId}' not found in reality.`);
    }

    const branchId = `branch_${this.branchCounter++}_${branchName}`;
    const branch = new RealityBranch({
      branchId,
      name: branchName,
      parentBranchId: parentBranch.branchId,
      forkStateId,
      initialStateId: forkStateId,
      depth: parentBranch.depth + 1,
      initialTime: parentBranch.localTime,
    });

    this.branches.set(branchId, branch);
    return branch;
  }

  // ── 3. Lineage Traversal & Lowest Common Ancestor (LCA) ────────────────────

  /**
   * Traverses backward from a state to collect all its ancestor states.
   */
  public getAncestors(stateId: string): StateNode[] {
    const ancestors: StateNode[] = [];
    const queue: string[] = [stateId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const node = this.states.get(currentId);
      if (!node) continue;

      if (currentId !== stateId) {
        ancestors.push(node);
      }

      for (const pId of node.parentStateIds) {
        if (!visited.has(pId)) {
          queue.push(pId);
        }
      }
    }

    return ancestors;
  }

  /**
   * Finds the Lowest Common Ancestor (LCA) state between two states.
   */
  public findLowestCommonAncestor(stateIdA: string, stateIdB: string): StateNode | undefined {
    if (stateIdA === stateIdB) {
      return this.states.get(stateIdA);
    }

    const ancestorsA = new Set<string>([stateIdA, ...this.getAncestors(stateIdA).map((s) => s.stateId)]);
    const queueB: string[] = [stateIdB];
    const visitedB = new Set<string>();

    while (queueB.length > 0) {
      const curr = queueB.shift()!;
      if (visitedB.has(curr)) continue;
      visitedB.add(curr);

      if (ancestorsA.has(curr)) {
        return this.states.get(curr);
      }

      const node = this.states.get(curr);
      if (node) {
        for (const pId of node.parentStateIds) {
          queueB.push(pId);
        }
      }
    }

    return undefined;
  }

  // ── 4. 3-Way Branch Merge ──────────────────────────────────────────────────

  /**
   * Performs 3-way merge of a source branch into a target branch using LCA.
   */
  public mergeBranch(
    sourceBranchId: string,
    targetBranchId: string,
    customResolver?: (base: NativeValue, src: NativeValue, tgt: NativeValue) => NativeValue
  ): { mergedState: StateNode; transition: StateTransition } {
    const srcBranch = this.branches.get(sourceBranchId);
    const tgtBranch = this.branches.get(targetBranchId);

    if (!srcBranch || !tgtBranch) {
      throw new Error(`[CanonicalReality Error] Branches '${sourceBranchId}' or '${targetBranchId}' not found.`);
    }

    const srcHead = this.states.get(srcBranch.headStateId)!;
    const tgtHead = this.states.get(tgtBranch.headStateId)!;

    const lca = this.findLowestCommonAncestor(srcHead.stateId, tgtHead.stateId);
    if (!lca) {
      throw new Error(`[CanonicalReality Error] No common ancestor found between branches '${srcBranch.name}' and '${tgtBranch.name}'.`);
    }

    // Resolve merged payload
    let mergedPayload: NativeValue;
    if (customResolver) {
      mergedPayload = customResolver(lca.payload, srcHead.payload, tgtHead.payload);
    } else {
      // Default 3-way record merge
      const baseRaw = (toRaw(lca.payload) ?? {}) as Record<string, unknown>;
      const srcRaw = (toRaw(srcHead.payload) ?? {}) as Record<string, unknown>;
      const tgtRaw = (toRaw(tgtHead.payload) ?? {}) as Record<string, unknown>;

      const allKeys = new Set([
        ...Object.keys(baseRaw),
        ...Object.keys(srcRaw),
        ...Object.keys(tgtRaw),
      ]);

      const eq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
      const mergedRaw: Record<string, unknown> = {};

      for (const k of allKeys) {
        const inBase = k in baseRaw;
        const inSrc = k in srcRaw;
        const inTgt = k in tgtRaw;
        const bVal = baseRaw[k];
        const sVal = srcRaw[k];
        const tVal = tgtRaw[k];

        const sChanged = !inBase ? inSrc : !eq(sVal, bVal);
        const tChanged = !inBase ? inTgt : !eq(tVal, bVal);

        if (!sChanged && !tChanged) {
          if (inBase) mergedRaw[k] = bVal;
        } else if (sChanged && !tChanged) {
          if (inSrc) mergedRaw[k] = sVal;
        } else if (!sChanged && tChanged) {
          if (inTgt) mergedRaw[k] = tVal;
        } else {
          // Both changed
          if (eq(sVal, tVal)) {
            if (inSrc) mergedRaw[k] = sVal;
          } else {
            throw new Error(
              `[CanonicalReality Merge Conflict] Conflict on field '${k}': branch '${srcBranch.name}' set ${JSON.stringify(sVal)} while branch '${tgtBranch.name}' set ${JSON.stringify(tVal)}.`
            );
          }
        }
      }
      mergedPayload = fromRaw(mergedRaw);
    }

    const mergedStateId = `state_${this.stateCounter++}_merge`;
    const transId = `trans_${this.transitionCounter++}_merge`;
    const nextTick = Math.max(srcBranch.localTime.getTicks(), tgtBranch.localTime.getTicks()) + 1;

    const mergedState = new StateNode({
      stateId: mergedStateId,
      revision: Math.max(srcHead.revision, tgtHead.revision) + 1,
      parentStateIds: [tgtHead.stateId, srcHead.stateId], // Multiple parents
      payload: mergedPayload,
      createdAtTick: nextTick,
    });

    const transition = new StateTransition({
      transitionId: transId,
      fromStateId: tgtHead.stateId,
      toStateId: mergedState.stateId,
      action: `MERGE_BRANCH_${srcBranch.name}_INTO_${tgtBranch.name}`,
      cost: 2.0,
      tick: nextTick,
    });

    this.states.set(mergedState.stateId, mergedState);
    this.transitions.set(transition.transitionId, transition);
    tgtBranch.commitState(mergedState.stateId, transition);
    srcBranch.markMerged();

    return { mergedState, transition };
  }

  // ── 5. Reality Cryptographic Seal ──────────────────────────────────────────

  /**
   * Seals the entire reality manifold into a cryptographic SHA-256 seal (0xREALITY_...).
   */
  public sealReality(): string {
    const branchHeads: Record<string, string> = {};
    for (const [bId, branch] of this.branches.entries()) {
      branchHeads[bId] = branch.headStateId;
    }

    const payload = {
      realityId: this.realityId,
      name: this.name,
      totalStates: this.states.size,
      totalTransitions: this.transitions.size,
      totalBranches: this.branches.size,
      branchHeads,
    };

    const json = CanonicalSerializer.serializeCanonicalJSON(payload);
    return `0xREALITY_${crypto
      .createHash('sha256')
      .update(json)
      .digest('hex')
      .substring(0, 16)
      .toUpperCase()}`;
  }

  // ── 6. Getters & Accessors ─────────────────────────────────────────────────

  public getState(stateId: string): StateNode | undefined {
    return this.states.get(stateId);
  }

  public getTransition(transitionId: string): StateTransition | undefined {
    return this.transitions.get(transitionId);
  }

  public getBranch(branchId: string): RealityBranch | undefined {
    return this.branches.get(branchId);
  }

  public getActiveBranch(): RealityBranch {
    return this.branches.get(this.activeBranchId)!;
  }

  public setActiveBranch(branchId: string): void {
    if (!this.branches.has(branchId)) {
      throw new Error(`[CanonicalReality Error] Cannot switch to non-existent branch '${branchId}'.`);
    }
    this.activeBranchId = branchId;
  }

  public getStatesCount(): number {
    return this.states.size;
  }

  public getStateCount(): number {
    return this.states.size;
  }

  public getBranchesCount(): number {
    return this.branches.size;
  }

  public getBranchCount(): number {
    return this.branches.size;
  }

  public getTransitionCount(): number {
    return this.transitions.size;
  }

  public estimateTotalMemoryBytes(): number {
    let total = 0;
    for (const state of this.states.values()) {
      total += state.estimateMemoryBytes();
    }
    for (const trans of this.transitions.values()) {
      total += trans.estimateMemoryBytes();
    }
    for (const branch of this.branches.values()) {
      total += 256 + branch.path.length() * 32;
    }
    return total;
  }
}
