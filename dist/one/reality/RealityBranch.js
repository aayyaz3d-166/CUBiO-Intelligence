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
export class RealityBranch {
    branchId;
    name;
    parentBranchId;
    forkStateId;
    depth;
    headStateId;
    path;
    localTime;
    status = 'ACTIVE';
    constructor(options) {
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
    commitState(newStateId, transition) {
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
    freeze() {
        this.status = 'FROZEN';
    }
    /**
     * Aborts this branch.
     */
    abort() {
        this.status = 'ABORTED';
    }
    /**
     * Marks this branch as merged into its parent.
     */
    markMerged() {
        this.status = 'MERGED';
    }
}
