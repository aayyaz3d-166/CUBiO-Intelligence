/**
 * ONE Language — Reality Branch
 * ==============================
 * Module: @one/reality/RealityBranch
 *
 * Implements the BRANCH primitive representing a causal worldline or counterfactual
 * timeline stemming from a parent fork state.
 */

import { CausalPath } from './CausalPath';
import { CanonicalTime } from './CanonicalTime';
import { StateTransition } from './Transition';

export type BranchStatus = 'ACTIVE' | 'MERGED' | 'ABORTED' | 'FROZEN';

export interface RealityBranchOptions {
  branchId: string;
  name: string;
  parentBranchId?: string;
  forkStateId: string;
  initialStateId: string;
  depth: number;
  initialTime?: CanonicalTime;
}

export class RealityBranch {
  public readonly branchId: string;
  public readonly name: string;
  public readonly parentBranchId?: string;
  public readonly forkStateId: string;
  public readonly depth: number;
  public headStateId: string;
  public path: CausalPath;
  public localTime: CanonicalTime;
  public status: BranchStatus = 'ACTIVE';

  constructor(options: RealityBranchOptions) {
    this.branchId = options.branchId;
    this.name = options.name;
    this.parentBranchId = options.parentBranchId;
    this.forkStateId = options.forkStateId;
    this.depth = options.depth;
    this.headStateId = options.initialStateId;
    this.path = new CausalPath(`path_${options.branchId}`, options.initialStateId);
    this.localTime = options.initialTime ? options.initialTime.clone() : new CanonicalTime();
  }

  /**
   * Advances this branch by applying a transition to a new head state.
   */
  public commitState(newStateId: string, transition: StateTransition): void {
    if (this.status !== 'ACTIVE') {
      throw new Error(`[RealityBranch Error] Cannot commit state to branch '${this.name}' in status '${this.status}'.`);
    }

    this.path = this.path.append(transition);
    this.headStateId = newStateId;
    this.localTime.advance(1);
  }

  /**
   * Freezes this branch to prevent further mutations.
   */
  public freeze(): void {
    this.status = 'FROZEN';
  }

  /**
   * Aborts this branch.
   */
  public abort(): void {
    this.status = 'ABORTED';
  }

  /**
   * Marks this branch as merged into its parent.
   */
  public markMerged(): void {
    this.status = 'MERGED';
  }
}
