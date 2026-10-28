/**
 * CUBiO AI — ONE LANGUAGE — LEARNING RATE SCHEDULER
 * ===================================================
 * Module: @one/training/LRScheduler
 * Gate: ONE-07 / Training Primitives
 *
 * Implements harmonic 3-6-9 warmup and cosine annealing learning-rate schedulers.
 */

export interface SchedulerConfig {
  baseLR: number;
  totalSteps: number;
  warmupSteps: number;
  minLR?: number;
  harmonicFactor?: number;
}

export interface ILRScheduler {
  getLR(step: number): number;
  step(): number;
  currentLR: number;
  getStep(): number;
  setStep(step: number): void;
}

/**
 * Linear Warmup followed by Harmonic 369 Cosine Annealing Decay.
 * Exactly harmonizes with CUBiO pretrainingScheduler specification.
 */
export class LinearWarmupCosineDecayScheduler implements ILRScheduler {
  private readonly baseLR: number;
  private readonly minLR: number;
  private readonly totalSteps: number;
  private readonly warmupSteps: number;
  private readonly harmonicFactor: number;
  private currentStep: number = 0;
  public currentLR: number;

  constructor(config: SchedulerConfig) {
    this.baseLR = config.baseLR;
    this.minLR = config.minLR ?? 0.0;
    this.totalSteps = config.totalSteps;
    this.warmupSteps = Math.max(1, config.warmupSteps);
    this.harmonicFactor = config.harmonicFactor ?? (369 / 369);
    this.currentLR = this.getLR(0);
  }

  public getLR(step: number): number {
    if (step < this.warmupSteps) {
      // Linear warmup phase: minLR -> baseLR
      const progress = step / this.warmupSteps;
      return this.minLR + (this.baseLR - this.minLR) * progress;
    }

    // Harmonic Cosine Annealing phase: baseLR -> minLR
    const progress = Math.min(1.0, (step - this.warmupSteps) / Math.max(1, this.totalSteps - this.warmupSteps));
    const cosineDecay = 0.5 * (1.0 + Math.cos(Math.PI * progress));
    return (this.minLR + (this.baseLR - this.minLR) * cosineDecay) * this.harmonicFactor;
  }

  public step(): number {
    this.currentStep++;
    this.currentLR = this.getLR(this.currentStep);
    return this.currentLR;
  }

  public getStep(): number {
    return this.currentStep;
  }

  public setStep(step: number): void {
    this.currentStep = step;
    this.currentLR = this.getLR(this.currentStep);
  }
}

/**
 * Constant Learning Rate Scheduler.
 */
export class ConstantLRScheduler implements ILRScheduler {
  public readonly currentLR: number;
  private stepCount: number = 0;

  constructor(lr: number) {
    this.currentLR = lr;
  }

  public getLR(_step: number): number {
    return this.currentLR;
  }

  public step(): number {
    this.stepCount++;
    return this.currentLR;
  }

  public getStep(): number {
    return this.stepCount;
  }

  public setStep(step: number): void {
    this.stepCount = step;
  }
}

/**
 * Step Decay Learning Rate Scheduler (multiplies by gamma every stepSize steps).
 */
export class StepLRScheduler implements ILRScheduler {
  private readonly baseLR: number;
  private readonly stepSize: number;
  private readonly gamma: number;
  private currentStep: number = 0;
  public currentLR: number;

  constructor(baseLR: number, stepSize: number, gamma: number = 0.1) {
    this.baseLR = baseLR;
    this.stepSize = Math.max(1, stepSize);
    this.gamma = gamma;
    this.currentLR = baseLR;
  }

  public getLR(step: number): number {
    const factor = Math.floor(step / this.stepSize);
    return this.baseLR * Math.pow(this.gamma, factor);
  }

  public step(): number {
    this.currentStep++;
    this.currentLR = this.getLR(this.currentStep);
    return this.currentLR;
  }

  public getStep(): number {
    return this.currentStep;
  }

  public setStep(step: number): void {
    this.currentStep = step;
    this.currentLR = this.getLR(this.currentStep);
  }
}
