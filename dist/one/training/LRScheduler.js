/**
 * CUBiO AI — ONE LANGUAGE — LEARNING RATE SCHEDULER
 * ===================================================
 * Module: @one/training/LRScheduler
 * Gate: ONE-07 / Training Primitives
 *
 * Implements harmonic 3-6-9 warmup and cosine annealing learning-rate schedulers.
 */
/**
 * Linear Warmup followed by Harmonic 369 Cosine Annealing Decay.
 * Exactly harmonizes with CUBiO pretrainingScheduler specification.
 */
export class LinearWarmupCosineDecayScheduler {
    baseLR;
    minLR;
    totalSteps;
    warmupSteps;
    harmonicFactor;
    currentStep = 0;
    currentLR;
    constructor(config) {
        this.baseLR = config.baseLR;
        this.minLR = config.minLR ?? 0.0;
        this.totalSteps = config.totalSteps;
        this.warmupSteps = Math.max(1, config.warmupSteps);
        this.harmonicFactor = config.harmonicFactor ?? (369 / 369);
        this.currentLR = this.getLR(0);
    }
    getLR(step) {
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
    step() {
        this.currentStep++;
        this.currentLR = this.getLR(this.currentStep);
        return this.currentLR;
    }
    getStep() {
        return this.currentStep;
    }
    setStep(step) {
        this.currentStep = step;
        this.currentLR = this.getLR(this.currentStep);
    }
}
/**
 * Constant Learning Rate Scheduler.
 */
export class ConstantLRScheduler {
    currentLR;
    stepCount = 0;
    constructor(lr) {
        this.currentLR = lr;
    }
    getLR(_step) {
        return this.currentLR;
    }
    step() {
        this.stepCount++;
        return this.currentLR;
    }
    getStep() {
        return this.stepCount;
    }
    setStep(step) {
        this.stepCount = step;
    }
}
/**
 * Step Decay Learning Rate Scheduler (multiplies by gamma every stepSize steps).
 */
export class StepLRScheduler {
    baseLR;
    stepSize;
    gamma;
    currentStep = 0;
    currentLR;
    constructor(baseLR, stepSize, gamma = 0.1) {
        this.baseLR = baseLR;
        this.stepSize = Math.max(1, stepSize);
        this.gamma = gamma;
        this.currentLR = baseLR;
    }
    getLR(step) {
        const factor = Math.floor(step / this.stepSize);
        return this.baseLR * Math.pow(this.gamma, factor);
    }
    step() {
        this.currentStep++;
        this.currentLR = this.getLR(this.currentStep);
        return this.currentLR;
    }
    getStep() {
        return this.currentStep;
    }
    setStep(step) {
        this.currentStep = step;
        this.currentLR = this.getLR(this.currentStep);
    }
}
