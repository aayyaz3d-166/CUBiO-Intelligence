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
import { TensorMemoryArena } from '../tensor/TensorArena';
import { AdamWOptimizer } from './AdamW';
import { clipGradNorm } from './GradientClipping';
import { LinearWarmupCosineDecayScheduler, } from './LRScheduler';
import { CrossEntropyLoss } from './CrossEntropyLoss';
export class OneTrainingEngine {
    isActuationBlocked = true;
    parameters;
    optimizer;
    scheduler;
    criterion;
    arena;
    maxGradNorm;
    stepCount = 0;
    constructor(parameters, options = {}) {
        this.parameters = [...parameters];
        this.maxGradNorm = options.maxGradNorm ?? 1.0;
        this.arena = new TensorMemoryArena({ maxBytes: options.arenaBytes ?? 32 * 1024 * 1024 });
        this.optimizer = new AdamWOptimizer(this.parameters, options.optimizer ?? {});
        if (options.scheduler) {
            this.scheduler = new LinearWarmupCosineDecayScheduler(options.scheduler);
        }
        else {
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
    zeroGrad(setNone = false) {
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
    step(forwardFn) {
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
    stateDict() {
        return this.optimizer.stateDict();
    }
    /**
     * Restores optimizer state dictionary.
     */
    loadStateDict(state) {
        this.optimizer.loadStateDict(state);
        this.stepCount = state.stepCount;
        this.scheduler.setStep(state.stepCount);
    }
    /**
     * Current step index.
     */
    getStep() {
        return this.stepCount;
    }
}
