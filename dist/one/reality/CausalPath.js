/**
 * ONE Language — Causal Path
 * ===========================
 * Module: @one/reality/CausalPath
 *
 * Implements the PATH primitive in the PATH ≠ STATE ≠ REALITY ontology.
 * Encapsulates the complete causal trajectory, provenance, and transition sequence
 * that yielded a given state.
 */
import * as crypto from 'crypto';
export class CausalPath {
    pathId;
    initialStateId;
    finalStateId;
    transitions;
    totalCost;
    pathHash;
    constructor(pathId, initialStateId, transitions = []) {
        this.pathId = pathId;
        this.initialStateId = initialStateId;
        this.transitions = [...transitions];
        // Verify causal continuity
        let current = initialStateId;
        let costAcc = 0;
        for (let i = 0; i < this.transitions.length; i++) {
            const t = this.transitions[i];
            if (t.fromStateId !== current) {
                throw new Error(`[CausalPath Continuity Error] Broken causal link at step ${i}: transition from '${t.fromStateId}' does not match expected state '${current}'.`);
            }
            current = t.toStateId;
            costAcc += t.cost;
        }
        this.finalStateId = current;
        this.totalCost = costAcc;
        this.pathHash = CausalPath.computePathHash(initialStateId, this.transitions);
    }
    /**
     * Deterministically computes cryptographic hash of this causal path.
     */
    static computePathHash(initialStateId, transitions) {
        const hash = crypto.createHash('sha256');
        hash.update(initialStateId);
        for (const t of transitions) {
            hash.update(t.signature);
        }
        return `0xPATH_${hash.digest('hex').substring(0, 16).toUpperCase()}`;
    }
    /**
     * Appends a new valid transition to this path, producing a new immutable CausalPath.
     */
    append(transition, newPathId) {
        if (transition.fromStateId !== this.finalStateId) {
            throw new Error(`[CausalPath Error] Cannot append transition from '${transition.fromStateId}' to path ending at '${this.finalStateId}'.`);
        }
        const id = newPathId ?? `${this.pathId}_step${this.transitions.length + 1}`;
        return new CausalPath(id, this.initialStateId, [...this.transitions, transition]);
    }
    /**
     * Path length (number of transitions).
     */
    length() {
        return this.transitions.length;
    }
}
