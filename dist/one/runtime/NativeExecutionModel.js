/**
 * ONE Language — Native Execution Model
 * =====================================
 * Module: @one/runtime/NativeExecutionModel
 *
 * Defines the formal execution model, lifecycle state transitions,
 * deterministic virtual cycle scheduler, and bit-exact replay validator.
 *
 * Invariants:
 *   - Zero nondeterministic entropy (sigma^2 = 0.0)
 *   - Discrete cycle stepping with instruction quotas
 *   - Strict lifecycle transitions
 */
export class NativeExecutionModel {
    state = 'UNINITIALIZED';
    cycleCount = 0;
    instructionsExecuted = 0;
    virtualTimestamp = 0; // Deterministic clock (ticks)
    maxInstructions = 1_000_000;
    maxCallDepth = 512;
    isActuationBlocked = true;
    constructor(options = {}) {
        if (options.maxInstructions !== undefined) {
            this.maxInstructions = options.maxInstructions;
        }
        if (options.maxCallDepth !== undefined) {
            this.maxCallDepth = options.maxCallDepth;
        }
        this.transition('INITIALIZING');
    }
    getState() {
        return this.state;
    }
    transition(target) {
        if (this.state === target)
            return;
        const validTransitions = {
            UNINITIALIZED: ['INITIALIZING'],
            INITIALIZING: ['READY', 'ERRORED'],
            READY: ['RUNNING', 'TERMINATED', 'INITIALIZING'],
            RUNNING: ['PAUSED', 'HALTED', 'ERRORED', 'READY'],
            PAUSED: ['RUNNING', 'HALTED', 'ERRORED'],
            HALTED: ['READY', 'TERMINATED', 'INITIALIZING'],
            ERRORED: ['READY', 'TERMINATED', 'INITIALIZING'],
            TERMINATED: ['INITIALIZING', 'UNINITIALIZED'],
        };
        const allowed = validTransitions[this.state] || [];
        if (!allowed.includes(target)) {
            throw new Error(`[NativeExecutionModel] Illegal state transition from ${this.state} to ${target}`);
        }
        this.state = target;
    }
    reset() {
        this.cycleCount = 0;
        this.instructionsExecuted = 0;
        this.virtualTimestamp = 0;
        this.state = 'READY';
    }
    advanceCycle(instructionsInCycle = 1) {
        this.cycleCount++;
        this.instructionsExecuted += instructionsInCycle;
        this.virtualTimestamp += 10; // Deterministic 10-tick step
        if (this.instructionsExecuted > this.maxInstructions) {
            this.transition('ERRORED');
            throw new Error(`[NativeExecutionModel E7007] Maximum instruction quota exceeded (${this.maxInstructions})`);
        }
    }
    checkCallDepth(currentDepth) {
        if (currentDepth > this.maxCallDepth) {
            this.transition('ERRORED');
            throw new Error(`[NativeExecutionModel E7006] Maximum call depth exceeded (${this.maxCallDepth})`);
        }
    }
    getCycleCount() {
        return this.cycleCount;
    }
    getInstructionsExecuted() {
        return this.instructionsExecuted;
    }
    getVirtualTimestamp() {
        return this.virtualTimestamp;
    }
    getMaxInstructions() {
        return this.maxInstructions;
    }
    getMaxCallDepth() {
        return this.maxCallDepth;
    }
    isActuationLocked() {
        return this.isActuationBlocked;
    }
    /**
     * Deterministic variance calculation:
     * sigma^2 = (1 / N) * sum((x_i - mu)^2)
     */
    static computeVariance(values) {
        if (values.length <= 1)
            return 0.0;
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        return Number(variance.toFixed(10));
    }
    /**
     * Bit-exact replay validator:
     * Verifies that every captured snapshot hash in the array is 100% identical.
     */
    static verifyBitExactReplay(snapshotHashes) {
        if (snapshotHashes.length === 0)
            return true;
        const baseline = snapshotHashes[0];
        for (let i = 1; i < snapshotHashes.length; i++) {
            if (snapshotHashes[i] !== baseline) {
                return false;
            }
        }
        return true;
    }
}
