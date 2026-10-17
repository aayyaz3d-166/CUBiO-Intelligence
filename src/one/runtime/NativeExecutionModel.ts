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

export type RuntimeLifecycleState =
  | 'UNINITIALIZED'
  | 'INITIALIZING'
  | 'READY'
  | 'RUNNING'
  | 'PAUSED'
  | 'HALTED'
  | 'ERRORED'
  | 'TERMINATED';

export type ExecutionMode = 'MICRO_STEP' | 'CYCLE_TICK' | 'BATCH';

export interface ExecutionMetrics {
  state: RuntimeLifecycleState;
  cycleCount: number;
  instructionsExecuted: number;
  virtualTimestamp: number;
  callDepth: number;
  rssAllocatedBytes: number;
  isActuationBlocked: boolean;
  determinismVariance: number;
}

export interface StepResult {
  done: boolean;
  cycle: number;
  pc: number;
  state: RuntimeLifecycleState;
  error?: string;
}

export class NativeExecutionModel {
  private state: RuntimeLifecycleState = 'UNINITIALIZED';
  private cycleCount: number = 0;
  private instructionsExecuted: number = 0;
  private virtualTimestamp: number = 0; // Deterministic clock (ticks)
  private maxInstructions: number = 1_000_000;
  private maxCallDepth: number = 512;
  private readonly isActuationBlocked: boolean = true;

  constructor(options: { maxInstructions?: number; maxCallDepth?: number } = {}) {
    if (options.maxInstructions !== undefined) {
      this.maxInstructions = options.maxInstructions;
    }
    if (options.maxCallDepth !== undefined) {
      this.maxCallDepth = options.maxCallDepth;
    }
    this.transition('INITIALIZING');
  }

  public getState(): RuntimeLifecycleState {
    return this.state;
  }

  public transition(target: RuntimeLifecycleState): void {
    if (this.state === target) return;

    const validTransitions: Record<RuntimeLifecycleState, RuntimeLifecycleState[]> = {
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
      throw new Error(
        `[NativeExecutionModel] Illegal state transition from ${this.state} to ${target}`
      );
    }
    this.state = target;
  }

  public reset(): void {
    this.cycleCount = 0;
    this.instructionsExecuted = 0;
    this.virtualTimestamp = 0;
    this.state = 'READY';
  }

  public advanceCycle(instructionsInCycle: number = 1): void {
    this.cycleCount++;
    this.instructionsExecuted += instructionsInCycle;
    this.virtualTimestamp += 10; // Deterministic 10-tick step

    if (this.instructionsExecuted > this.maxInstructions) {
      this.transition('ERRORED');
      throw new Error(
        `[NativeExecutionModel E7007] Maximum instruction quota exceeded (${this.maxInstructions})`
      );
    }
  }

  public checkCallDepth(currentDepth: number): void {
    if (currentDepth > this.maxCallDepth) {
      this.transition('ERRORED');
      throw new Error(
        `[NativeExecutionModel E7006] Maximum call depth exceeded (${this.maxCallDepth})`
      );
    }
  }

  public getCycleCount(): number {
    return this.cycleCount;
  }

  public getInstructionsExecuted(): number {
    return this.instructionsExecuted;
  }

  public getVirtualTimestamp(): number {
    return this.virtualTimestamp;
  }

  public getMaxInstructions(): number {
    return this.maxInstructions;
  }

  public getMaxCallDepth(): number {
    return this.maxCallDepth;
  }

  public isActuationLocked(): boolean {
    return this.isActuationBlocked;
  }

  /**
   * Deterministic variance calculation:
   * sigma^2 = (1 / N) * sum((x_i - mu)^2)
   */
  public static computeVariance(values: number[]): number {
    if (values.length <= 1) return 0.0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Number(variance.toFixed(10));
  }

  /**
   * Bit-exact replay validator:
   * Verifies that every captured snapshot hash in the array is 100% identical.
   */
  public static verifyBitExactReplay(snapshotHashes: string[]): boolean {
    if (snapshotHashes.length === 0) return true;
    const baseline = snapshotHashes[0];
    for (let i = 1; i < snapshotHashes.length; i++) {
      if (snapshotHashes[i] !== baseline) {
        return false;
      }
    }
    return true;
  }
}
