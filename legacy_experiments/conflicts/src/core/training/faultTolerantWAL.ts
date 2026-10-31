import { RSSGuard } from '../memory/rssGuard';

export interface WALEntry {
  step: number;
  loss: number;
  weightsHash: string;
  timestamp: number;
}

export class FaultTolerantWAL {
  private log: WALEntry[] = [];
  private rssGuard: RSSGuard;

  constructor(rssGuard: RSSGuard) {
    this.rssGuard = rssGuard;
  }

  public writeCheckpoint(step: number, loss: number, weightsHash: string): void {
    // Allocate small tracking footprint under RSS Guard (2 MB)
    this.rssGuard.allocate(2 * 1024 * 1024, `WALCheckpoint:Step${step}`);

    const entry: WALEntry = {
      step,
      loss,
      weightsHash,
      timestamp: Date.now()
    };
    this.log.push(entry);
    console.log(`[WAL Checkpoint] Successfully written state for Step ${step} (Loss: ${loss.toFixed(4)})`);
  }

  public recoverLastState(): WALEntry | null {
    if (this.log.length === 0) return null;
    const lastEntry = this.log[this.log.length - 1];
    console.log(`[WAL Recovery] Rolled back and recovered to Step ${lastEntry.step} with hash ${lastEntry.weightsHash}`);
    return lastEntry;
  }
}
