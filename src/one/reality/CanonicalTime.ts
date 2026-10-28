/**
 * ONE Language — Canonical Virtual Timeline
 * ==========================================
 * Module: @one/reality/CanonicalTime
 *
 * Implements the TIME primitive providing deterministic, discrete temporal progression.
 * Guarantees zero wall-clock drift and bit-exact repeatability across replay cycles (sigma^2 = 0.0).
 */

export class CanonicalTime {
  private ticks: number;
  private epoch: number;
  private readonly epochIntervalTicks: number;

  constructor(initialTicks: number = 0, initialEpoch: number = 0, epochIntervalTicks: number = 1000) {
    this.ticks = initialTicks;
    this.epoch = initialEpoch;
    this.epochIntervalTicks = epochIntervalTicks;
  }

  /**
   * Advances the virtual clock by a discrete number of ticks.
   */
  public advance(deltaTicks: number = 1): number {
    if (deltaTicks < 0 || !Number.isInteger(deltaTicks)) {
      throw new Error(`[CanonicalTime Error] Cannot advance time by invalid delta: ${deltaTicks}.`);
    }

    this.ticks += deltaTicks;
    this.epoch = Math.floor(this.ticks / this.epochIntervalTicks);
    return this.ticks;
  }

  public getTicks(): number {
    return this.ticks;
  }

  public getEpoch(): number {
    return this.epoch;
  }

  /**
   * Forks a child timeline anchored at current ticks.
   */
  public forkChildTimeline(): CanonicalTime {
    return new CanonicalTime(this.ticks, this.epoch, this.epochIntervalTicks);
  }

  /**
   * Clones this timeline.
   */
  public clone(): CanonicalTime {
    return new CanonicalTime(this.ticks, this.epoch, this.epochIntervalTicks);
  }
}
