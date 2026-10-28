export class FaultTolerantWAL {
    log = [];
    rssGuard;
    constructor(rssGuard) {
        this.rssGuard = rssGuard;
    }
    writeCheckpoint(step, loss, weightsHash) {
        // Allocate small tracking footprint under RSS Guard (2 MB)
        this.rssGuard.allocate(2 * 1024 * 1024, `WALCheckpoint:Step${step}`);
        const entry = {
            step,
            loss,
            weightsHash,
            timestamp: Date.now()
        };
        this.log.push(entry);
        console.log(`[WAL Checkpoint] Successfully written state for Step ${step} (Loss: ${loss.toFixed(4)})`);
    }
    recoverLastState() {
        if (this.log.length === 0)
            return null;
        const lastEntry = this.log[this.log.length - 1];
        console.log(`[WAL Recovery] Rolled back and recovered to Step ${lastEntry.step} with hash ${lastEntry.weightsHash}`);
        return lastEntry;
    }
}
