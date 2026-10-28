/**
 * CUBiO Harmonic 3-6-9 Actor Concurrency Runtime
 * Target: Lock-Free Frequency-Phased Concurrency (3, 6, 9 MHz)
 */

export type HarmonicFrequency = 3 | 6 | 9;

export interface ActorMessage {
  sender: string;
  payload: Record<string, unknown> | string | number;
  timestamp: number;
}

export class HarmonicActor {
  public readonly id: string;
  public readonly frequency: HarmonicFrequency;
  private mailbox: ActorMessage[] = [];
  private processedMessages: ActorMessage[] = [];
  public state: 'IDLE' | 'ACTIVE' | 'SYNCHRONIZING' = 'IDLE';

  constructor(id: string, frequency: HarmonicFrequency) {
    this.id = id;
    this.frequency = frequency;
  }

  public send(msg: ActorMessage): void {
    this.mailbox.push(msg);
  }

  public tick(currentTick: number): number {
    // Harmonic phase synchronization check (e.g., 3 MHz ticks every 3 cycles, 6 every 6, 9 every 9)
    if (currentTick % this.frequency === 0) {
      return this.processMailbox();
    }
    return 0;
  }

  private processMailbox(): number {
    if (this.mailbox.length === 0) {
      this.state = 'IDLE';
      return 0;
    }

    this.state = 'ACTIVE';
    let processedCount = 0;
    while (this.mailbox.length > 0) {
      const msg = this.mailbox.shift();
      if (msg) {
        this.processedMessages.push(msg);
        processedCount++;
      }
    }
    this.state = 'IDLE';
    return processedCount;
  }

  public getMailboxLength(): number {
    return this.mailbox.length;
  }

  public getProcessedCount(): number {
    return this.processedMessages.length;
  }

  public getProcessedMessages(): ActorMessage[] {
    return [...this.processedMessages];
  }
}

export class HarmonicActorMeshCoordinator {
  private actors: Map<string, HarmonicActor> = new Map();
  private clockCycle: number = 0;

  public registerActor(id: string, frequency: HarmonicFrequency): HarmonicActor {
    const actor = new HarmonicActor(id, frequency);
    this.actors.set(id, actor);
    return actor;
  }

  public getActor(id: string): HarmonicActor | undefined {
    return this.actors.get(id);
  }

  public dispatch(targetActorId: string, msg: ActorMessage): void {
    const actor = this.actors.get(targetActorId);
    if (!actor) {
      throw new Error(`[Actor Fault] Target actor '${targetActorId}' does not exist in mesh.`);
    }
    actor.send(msg);
  }

  /**
   * Advances the global harmonic clock and triggers frequency-phased actor sweeps.
   */
  public advanceClock(ticks: number = 1): { totalProcessed: number; currentCycle: number } {
    let totalProcessed = 0;
    for (let i = 0; i < ticks; i++) {
      this.clockCycle++;
      for (const actor of this.actors.values()) {
        totalProcessed += actor.tick(this.clockCycle);
      }
    }
    return { totalProcessed, currentCycle: this.clockCycle };
  }

  public getActors(): HarmonicActor[] {
    return Array.from(this.actors.values());
  }
}
