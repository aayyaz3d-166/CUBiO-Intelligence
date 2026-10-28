/**
 * ONE Language — Canonical Virtual Timeline
 * ==========================================
 * Module: @one/reality/CanonicalTime
 *
 * Implements the TIME primitive providing deterministic, discrete temporal progression.
 * Guarantees zero wall-clock drift and bit-exact repeatability across replay cycles (sigma^2 = 0.0).
 */
export class CanonicalTime {
    ticks;
    epoch;
    epochIntervalTicks;
    constructor(initialTicks = 0, initialEpoch = 0, epochIntervalTicks = 1000) {
        this.ticks = initialTicks;
        this.epoch = initialEpoch;
        this.epochIntervalTicks = epochIntervalTicks;
    }
    /**
     * Advances the virtual clock by a discrete number of ticks.
     */
    advance(deltaTicks = 1) {
        if (deltaTicks < 0 || !Number.isInteger(deltaTicks)) {
            throw new Error(`[CanonicalTime Error] Cannot advance time by invalid delta: ${deltaTicks}.`);
        }
        this.ticks += deltaTicks;
        this.epoch = Math.floor(this.ticks / this.epochIntervalTicks);
        return this.ticks;
    }
    getTicks() {
        return this.ticks;
    }
    getEpoch() {
        return this.epoch;
    }
    /**
     * Forks a child timeline anchored at current ticks.
     */
    forkChildTimeline() {
        return new CanonicalTime(this.ticks, this.epoch, this.epochIntervalTicks);
    }
    /**
     * Clones this timeline.
     */
    clone() {
        return new CanonicalTime(this.ticks, this.epoch, this.epochIntervalTicks);
    }
}
