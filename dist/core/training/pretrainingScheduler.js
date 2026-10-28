export class PretrainingScheduler {
    getLearningRate(step, config) {
        if (step < config.warmupSteps) {
            // Linear warmup phase
            return config.baseLR * (step / config.warmupSteps);
        }
        // Harmonic 369 Cosine Annealing
        const progress = (step - config.warmupSteps) / Math.max(1, config.totalSteps - config.warmupSteps);
        const cosineDecay = 0.5 * (1 + Math.cos(Math.PI * progress));
        // Harmonized with 369 scaling factor
        return config.baseLR * cosineDecay * (369 / 369);
    }
}
