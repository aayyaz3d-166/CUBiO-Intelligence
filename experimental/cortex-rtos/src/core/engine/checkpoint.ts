/**
 * Phase 7B — Checkpoint (State Snapshot)
 *
 * Serializes the full runtime state (VM + mesh + variables + RSS) into
 * a single checkpoint.json file for recovery and restart.
 */

import * as fs from 'fs';
import * as path from 'path';
import { WriteAheadLog, WALEntry } from './wal';

export interface CheckpointData {
  /** Checkpoint version for forward/backward compatibility */
  version: number;
  /** ISO timestamp of checkpoint creation */
  timestamp: string;
  /** Last WAL sequence number included in this checkpoint */
  walSeqIncluded: number;
  /** CubiO VM state snapshot */
  vmState: {
    nodesCount: number;
    streamsCount: number;
    allocatedMemoryMb: number;
    determinismSigmaSq: number;
    variables: Record<string, any>;
    activeScopes: number;
    evalStack: any[];
    callStack: number[];
    instructionPointer: number;
    funcRegistry: Array<{ name: string; paramCount: number; entryIndex: number }>;
  };
  /** Spatial mesh cluster state */
  meshState: {
    gridSize: number;
    cellSize: number;
    nodeIds: string[];
    nodePositions: Array<{ id: string; x: number; y: number; z: number }>;
  };
  /** RSS guard state */
  rssState: {
    limitMb: number;
    usedBytes: number;
  };
  /** Funnel / stream state */
  funnelState: {
    streamsCount: number;
    streamDefs: Array<{ name: string; source: string; target: string; bufferMb: number }>;
  };
}

export interface CheckpointConfig {
  /** Directory for checkpoint files */
  dataDir: string;
  /** Checkpoint file name */
  checkpointFile?: string;
  /** WAL instance for logging checkpoint events */
  wal?: WriteAheadLog;
}

const DEFAULT_CONFIG: Required<CheckpointConfig> = {
  dataDir: './data/one_state',
  checkpointFile: 'checkpoint.json',
  wal: undefined as any,
};

export class CheckpointManager {
  private config: Required<CheckpointConfig>;
  private filePath: string;

  constructor(config: Partial<CheckpointConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.filePath = path.resolve(this.config.dataDir, this.config.checkpointFile!);
    fs.mkdirSync(this.config.dataDir, { recursive: true });
  }

  /**
   * Create a checkpoint from the current VM + mesh + RSS state.
   */
  public createCheckpoint(vmState: any, meshState: any, rssState: any, funnelState: any, walSeqIncluded: number): CheckpointData {
    const data: CheckpointData = {
      version: 1,
      timestamp: new Date().toISOString(),
      walSeqIncluded: walSeqIncluded,
      vmState: {
        nodesCount: vmState.nodesCount ?? 0,
        streamsCount: vmState.streamsCount ?? 0,
        allocatedMemoryMb: vmState.allocatedMemoryMb ?? 0,
        determinismSigmaSq: vmState.determinismSigmaSq ?? 0,
        variables: vmState.variables ?? {},
        activeScopes: vmState.activeScopes ?? 1,
        evalStack: vmState.evalStack ?? [],
        callStack: vmState.callStack ?? [],
        instructionPointer: vmState.instructionPointer ?? 0,
        funcRegistry: (vmState.funcRegistry ?? new Map<string, { paramCount: number; entryIndex: number }>()).entries()
          .map(([name, info]: [string, { paramCount: number; entryIndex: number }]) => ({ name, paramCount: info.paramCount, entryIndex: info.entryIndex }))
          .toArray(),
      },
      meshState: {
        gridSize: meshState.gridSize ?? 7,
        cellSize: meshState.cellSize ?? (1 / 7),
        nodeIds: meshState.nodeIds ?? [],
        nodePositions: meshState.nodePositions ?? [],
      },
      rssState: {
        limitMb: rssState.limitMb ?? 512,
        usedBytes: rssState.usedBytes ?? 0,
      },
      funnelState: {
        streamsCount: funnelState.streamsCount ?? 0,
        streamDefs: funnelState.streamDefs ?? [],
      },
    };

    // Write atomically: write to temp, then rename
    const tempPath = this.filePath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, this.filePath);

    // Log checkpoint event to WAL
    if (this.config.wal) {
      this.config.wal.append({
        type: 'checkpoint',
        description: `Checkpoint created at seq ${walSeqIncluded}`,
        payload: { walSeqIncluded, timestamp: data.timestamp },
      });
    }

    return data;
  }

  /**
   * Load the latest checkpoint from disk.
   */
  public loadCheckpoint(): CheckpointData | null {
    if (!fs.existsSync(this.filePath)) return null;
    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      const data = JSON.parse(content) as CheckpointData;
      if (!data || data.version === undefined) return null;
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Delete the checkpoint file.
   */
  public deleteCheckpoint(): void {
    if (fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
    }
  }

  /**
   * Check if a checkpoint exists.
   */
  public hasCheckpoint(): boolean {
    return fs.existsSync(this.filePath);
  }

  /**
   * Get the checkpoint file path.
   */
  public getFilePath(): string {
    return this.filePath;
  }
}
