/**
 * Phase 7C — Recovery Manager
 *
 * Loads the latest checkpoint and replays WAL entries since that checkpoint
 * to reconstruct a consistent runtime state after a crash/restart.
 */

import * as fs from 'fs';
import * as path from 'path';
import { WriteAheadLog, WALEntry } from './wal';
import { CheckpointManager, CheckpointData } from './checkpoint';

export interface RecoveryConfig {
  /** Directory for WAL and checkpoint files */
  dataDir: string;
  /** WAL instance */
  wal: WriteAheadLog;
  /** Checkpoint manager instance */
  checkpointMgr: CheckpointManager;
}

export interface RecoveredState {
  /** Whether recovery was successful */
  success: boolean;
  /** Recovered VM state (partial if recovery incomplete) */
  vmState: Record<string, any>;
  /** Recovered mesh state */
  meshState: Record<string, any>;
  /** Recovered RSS state */
  rssState: Record<string, any>;
  /** Recovered funnel state */
  funnelState: Record<string, any>;
  /** Number of WAL entries replayed */
  walEntriesReplayed: number;
  /** Error message if recovery failed */
  error?: string;
}

export class RecoveryManager {
  private config: Required<RecoveryConfig>;

  constructor(config: RecoveryConfig) {
    this.config = {
      dataDir: config.dataDir,
      wal: config.wal,
      checkpointMgr: config.checkpointMgr,
    };
  }

  /**
   * Recover runtime state from checkpoint + WAL.
   *
   * Strategy:
   * 1. Load latest checkpoint
   * 2. If no checkpoint, replay all WAL entries from scratch
   * 3. If checkpoint exists, replay WAL entries after checkpoint's walSeqIncluded
   */
  public recover(): RecoveredState {
    try {
      // Step 1: Try to load checkpoint
      const checkpoint = this.config.checkpointMgr.loadCheckpoint();

      let vmState: Record<string, any> = {};
      let meshState: Record<string, any> = {};
      let rssState: Record<string, any> = {};
      let funnelState: Record<string, any> = {};
      let walSeqStart: number = 0;
      let walEntriesReplayed: number = 0;

      if (checkpoint) {
        // Step 2a: Restore from checkpoint
        vmState = this.extractVMState(checkpoint);
        meshState = this.extractMeshState(checkpoint);
        rssState = this.extractRSSState(checkpoint);
        funnelState = this.extractFunnelState(checkpoint);
        walSeqStart = checkpoint.walSeqIncluded;
        console.log(`[Recovery] Loaded checkpoint (version ${checkpoint.version}) from ${checkpoint.timestamp}`);
      } else {
        // Step 2b: No checkpoint — start from empty state
        console.log('[Recovery] No checkpoint found, starting from empty state');
        vmState = {
          nodesCount: 0,
          streamsCount: 0,
          allocatedMemoryMb: 0,
          determinismSigmaSq: 0,
          variables: {},
          activeScopes: 1,
          evalStack: [],
          callStack: [],
          instructionPointer: 0,
          funcRegistry: new Map(),
        };
        meshState = {
          gridSize: 7,
          cellSize: 1 / 7,
          nodeIds: [],
          nodePositions: [],
        };
        rssState = {
          limitMb: 512,
          usedBytes: 0,
        };
        funnelState = {
          streamsCount: 0,
          streamDefs: [],
        };
      }

      // Step 3: Replay WAL entries after checkpoint
      const walEntries = this.config.wal.readSince(walSeqStart);
      walEntriesReplayed = walEntries.length;

      for (const entry of walEntries) {
        this.replayEntry(entry, vmState, meshState, rssState, funnelState);
      }

      console.log(`[Recovery] Replayed ${walEntriesReplayed} WAL entries since seq ${walSeqStart}`);

      return {
        success: true,
        vmState,
        meshState,
        rssState,
        funnelState,
        walEntriesReplayed,
      };
    } catch (err: any) {
      return {
        success: false,
        vmState: {},
        meshState: {},
        rssState: {},
        funnelState: {},
        walEntriesReplayed: 0,
        error: err.message || String(err),
      };
    }
  }

  /**
   * Extract VM state from checkpoint data.
   */
  private extractVMState(checkpoint: CheckpointData): Record<string, any> {
    const vs = checkpoint.vmState;
    const funcReg = new Map<string, any>();
    for (const fr of vs.funcRegistry) {
      funcReg.set(fr.name, { paramCount: fr.paramCount, entryIndex: fr.entryIndex });
    }
    return {
      nodesCount: vs.nodesCount,
      streamsCount: vs.streamsCount,
      allocatedMemoryMb: vs.allocatedMemoryMb,
      determinismSigmaSq: vs.determinismSigmaSq,
      variables: { ...vs.variables },
      activeScopes: vs.activeScopes,
      evalStack: [...vs.evalStack],
      callStack: [...vs.callStack],
      instructionPointer: vs.instructionPointer,
      funcRegistry: funcReg,
    };
  }

  /**
   * Extract mesh state from checkpoint data.
   */
  private extractMeshState(checkpoint: CheckpointData): Record<string, any> {
    return {
      gridSize: checkpoint.meshState.gridSize,
      cellSize: checkpoint.meshState.cellSize,
      nodeIds: [...checkpoint.meshState.nodeIds],
      nodePositions: checkpoint.meshState.nodePositions.map(np => ({ ...np })),
    };
  }

  /**
   * Extract RSS state from checkpoint data.
   */
  private extractRSSState(checkpoint: CheckpointData): Record<string, any> {
    return {
      limitMb: checkpoint.rssState.limitMb,
      usedBytes: checkpoint.rssState.usedBytes,
    };
  }

  /**
   * Extract funnel state from checkpoint data.
   */
  private extractFunnelState(checkpoint: CheckpointData): Record<string, any> {
    return {
      streamsCount: checkpoint.funnelState.streamsCount,
      streamDefs: checkpoint.funnelState.streamDefs.map(sd => ({ ...sd })),
    };
  }

  /**
   * Replay a single WAL entry and apply its mutation to the state.
   */
  private replayEntry(
    entry: WALEntry,
    vmState: Record<string, any>,
    meshState: Record<string, any>,
    rssState: Record<string, any>,
    funnelState: Record<string, any>,
  ): void {
    switch (entry.type) {
      case 'node_create': {
        vmState.nodesCount = (vmState.nodesCount || 0) + 1;
        if (entry.payload.coordinates) {
          meshState.nodeIds.push(entry.payload.nodeId || entry.payload.name || 'unknown');
          meshState.nodePositions.push({
            id: entry.payload.nodeId || entry.payload.name || 'unknown',
            x: entry.payload.coordinates[0],
            y: entry.payload.coordinates[1],
            z: entry.payload.coordinates[2],
          });
        }
        break;
      }
      case 'node_remove': {
        vmState.nodesCount = Math.max(0, (vmState.nodesCount || 0) - 1);
        const id = entry.payload.nodeId || entry.payload.name;
        const idx = meshState.nodeIds.indexOf(id);
        if (idx >= 0) {
          meshState.nodeIds.splice(idx, 1);
          meshState.nodePositions.splice(idx, 1);
        }
        break;
      }
      case 'variable_set': {
        vmState.variables[entry.payload.name] = entry.payload.value;
        break;
      }
      case 'variable_delete': {
        delete vmState.variables[entry.payload.name];
        break;
      }
      case 'funnel_open': {
        vmState.streamsCount = (vmState.streamsCount || 0) + 1;
        funnelState.streamsCount = (funnelState.streamsCount || 0) + 1;
        funnelState.streamDefs.push({
          name: entry.payload.name || 'unknown',
          source: entry.payload.sourceNode || 'unknown',
          target: entry.payload.targetNode || 'unknown',
          bufferMb: entry.payload.bufferMb ?? 64,
        });
        break;
      }
      case 'funnel_close': {
        vmState.streamsCount = Math.max(0, (vmState.streamsCount || 0) - 1);
        funnelState.streamsCount = Math.max(0, (funnelState.streamsCount || 0) - 1);
        const idx = funnelState.streamDefs.findIndex((s: { name: string }) => s.name === (entry.payload.name || 'unknown'));
        if (idx >= 0) funnelState.streamDefs.splice(idx, 1);
        break;
      }
      case 'rss_set': {
        rssState.limitMb = entry.payload.value || 512;
        break;
      }
      case 'mesh_register': {
        if (!meshState.nodeIds.includes(entry.payload.nodeId)) {
          meshState.nodeIds.push(entry.payload.nodeId);
        }
        break;
      }
      case 'mesh_unregister': {
        const idx = meshState.nodeIds.indexOf(entry.payload.nodeId);
        if (idx >= 0) meshState.nodeIds.splice(idx, 1);
        break;
      }
      case 'checkpoint': {
        // Checkpoint entries are already applied via checkpoint load; no state change needed
        break;
      }
      default: {
        // Unknown type — skip
        break;
      }
    }
  }

  /**
   * Get recovery statistics.
   */
  public getStats(): { walEntries: number; checkpointExists: boolean; latestSeq: number } {
    return {
      walEntries: this.config.wal.getTotalEntries(),
      checkpointExists: this.config.checkpointMgr.hasCheckpoint(),
      latestSeq: this.config.wal.getLatestSeq(),
    };
  }
}
