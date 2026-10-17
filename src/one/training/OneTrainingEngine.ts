/**
 * CUBiO AI — ONE LANGUAGE — UNIFIED ONE TRAINING ENGINE
 * ========================================================
 * Module: @one/training/OneTrainingEngine
 * Gate: ONE-07 / Tensor Training Primitives
 *
 * Implements a sovereign, high-level training engine combining:
 *   1. Float32Array-backed Tensors
 *   2. Reverse-mode automatic differentiation
 *   3. AdamW optimizer with decoupled weight decay
 *   4. Gradient norm clipping
 *   5. Harmonic 3-6-9 warmup / cosine annealing learning rate scheduling
 *   6. Optimizer state checkpointing & sandboxed cloning
 *   7. Permanent fail-closed actuation safety lock
 */

import { Tensor } from '../tensor/Tensor';
import { TensorMemoryArena } from '../tensor/TensorArena';
import { AdamWOptimizer, AdamWOptions } from './AdamW';
import { clipGradNorm } from './GradientClipping';
import {
  ILRScheduler,
  LinearWarmupCosineDecayScheduler,
  SchedulerConfig,
} from './LRScheduler';
import { CrossEntropyLoss } from './CrossEntropyLoss';
import { OptimizerStateRecord } from './OptimizerState';

export interface OneTrainingEngineOptions {
  optimizer?: AdamWOptions;
  scheduler?: SchedulerConfig;
  maxGradNorm?: number;
  arenaBytes?: number;
}

export interface TrainingStepTelemetry {
  step: number;
  loss: number;
  learningRate: number;
  unclippedGradNorm: number;
  clippedGradNorm: number;
  durationMs: number;
  isActuationBlocked: boolean;
}

export class OneTrainingEngine {
  public readonly isActuationBlocked: boolean = true;
  public readonly parameters: Tensor[];
  public readonly optimizer: AdamWOptimizer;
  public readonly scheduler: ILRScheduler;
  public readonly criterion: CrossEntropyLoss;
  public readonly arena: TensorMemoryArena;
  public readonly maxGradNorm: number;
  private stepCount: number = 0;

  constructor(parameters: Tensor[], options: OneTrainingEngineOptions = {}) {
    this.parameters = [...parameters];
    this.maxGradNorm = options.maxGradNorm ?? 1.0;
    this.arena = new TensorMemoryArena({ maxBytes: options.arenaBytes ?? 32 * 1024 * 1024 });

    this.optimizer = new AdamWOptimizer(this.parameters, options.optimizer ?? {});

    if (options.scheduler) {
      this.scheduler = new LinearWarmupCosineDecayScheduler(options.scheduler);
    } else {
      this.scheduler = new LinearWarmupCosineDecayScheduler({
        baseLR: this.optimizer.lr,
        warmupSteps: 10,
        totalSteps: 100,
      });
    }

    this.criterion = new CrossEntropyLoss();
  }

  /**
   * Resets all parameter gradients.
   */
  public zeroGrad(setNone: boolean = false): void {
    this.optimizer.zeroGrad(setNone);
  }

  /**
   * Executes a complete training step:
   *   1. zeroGrad()
   *   2. forward(logits, targets) -> loss
   *   3. loss.backward()
   *   4. clipGradNorm()
   *   5. optimizer.step()
   *   6. scheduler.step()
   */
  public step(
    forwardFn: () => { logits: Tensor; targets: number[] | Int32Array }
  ): TrainingStepTelemetry {
    const t0 = performance.now();
    this.stepCount++;

    // 1. Reset gradients
    this.zeroGrad();

    // 2. Forward pass
    const { logits, targets } = forwardFn();
    const lossTensor = this.criterion.forward(logits, targets, this.arena);
    const loss = lossTensor.item();

    // 3. Reverse-mode Autograd
    lossTensor.backward(undefined, this.arena);

    // 4. Gradient Clipping
    const unclippedGradNorm = clipGradNorm(this.parameters, this.maxGradNorm);

    // 5. Optimizer Step
    this.optimizer.lr = this.scheduler.currentLR;
    this.optimizer.step();

    // 6. Scheduler Step
    const currentLR = this.scheduler.step();

    const durationMs = performance.now() - t0;

    return {
      step: this.stepCount,
      loss,
      learningRate: currentLR,
      unclippedGradNorm,
      clippedGradNorm: Math.min(unclippedGradNorm, this.maxGradNorm),
      durationMs,
      isActuationBlocked: this.isActuationBlocked,
    };
  }

  /**
   * Captures optimizer state dictionary.
   */
  public stateDict(): OptimizerStateRecord {
    return this.optimizer.stateDict();
  }

  /**
   * Restores optimizer state dictionary.
   */
  public loadStateDict(state: OptimizerStateRecord): void {
    this.optimizer.loadStateDict(state);
    this.stepCount = state.stepCount;
    this.scheduler.setStep(state.stepCount);
  }

  /**
   * Current step index.
   */
  public getStep(): number {
    return this.stepCount;
  }
}
