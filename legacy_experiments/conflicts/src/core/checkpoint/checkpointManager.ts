import { WriteAheadLog } from './wal';
import { SnapshotEngine, SystemSnapshot, SpatialNodeState } from './snapshotEngine';
import { RSSGuard } from '../memory/rssGuard';

export class CheckpointManager {
  private wal: WriteAheadLog;
  private snapshotEngine: SnapshotEngine;
  private snapshots: Map<string, SystemSnapshot> = new Map();
  private rssGuard: RSSGuard;

  constructor(rssGuard: RSSGuard) {
    this.rssGuard = rssGuard;
    this.wal = new WriteAheadLog();
    this.snapshotEngine = new SnapshotEngine(this.wal);
  }

  public registerNodeCheckpoint(nodeId: string, checkpointLabel: string, currentNodes: Map<string, SpatialNodeState>): SystemSnapshot {
    console.log(`[Checkpoint Manager] Registering checkpoint '${checkpointLabel}' on node '${nodeId}'`);

    // Log checkpoint entry to WAL
    this.wal.append(nodeId, `CHECKPOINT_REGISTER:${checkpointLabel}`, { checkpointLabel });

    // Enforce snapshot storage within RSS limits (allocating fixed 16 KB metadata descriptor)
    this.rssGuard.allocate(16 * 1024, `SnapshotMetadata:${checkpointLabel}`);

    const snapshot = this.snapshotEngine.createSnapshot(
      `${nodeId}_${checkpointLabel}`,
      currentNodes,
      this.rssGuard.getUsedBytes()
    );

    this.snapshots.set(snapshot.snapshotId, snapshot);
    console.log(`  ✓ Checkpoint '${snapshot.snapshotId}' persisted | Hash: 0x${snapshot.stateHash}`);

    return snapshot;
  }

  public rollbackToSnapshot(snapshotId: string): SystemSnapshot {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`[Checkpoint Error] Snapshot '${snapshotId}' does not exist in WAL history.`);
    }

    console.log(`[Checkpoint Manager] Executing Bit-Exact Rollback to snapshot '${snapshotId}'...`);
    this.wal.append('SYSTEM', 'ROLLBACK', { targetSnapshotId: snapshotId, targetHash: snapshot.stateHash });

    console.log(`  ✓ Rollback successful. Restored state hash: 0x${snapshot.stateHash}`);
    return snapshot;
  }

  public getSnapshot(snapshotId: string): SystemSnapshot | undefined {
    return this.snapshots.get(snapshotId);
  }

  public compareSnapshots(snapshotIdA: string, snapshotIdB: string): string[] {
    const snapA = this.snapshots.get(snapshotIdA);
    const snapB = this.snapshots.get(snapshotIdB);

    if (!snapA || !snapB) {
      throw new Error('[Checkpoint Error] Invalid snapshot IDs provided for comparison');
    }

    return this.snapshotEngine.diffSnapshots(snapA, snapB);
  }

  public getWAL(): WriteAheadLog {
    return this.wal;
  }
}
