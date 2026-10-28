/**
 * Phase 7D — Persistence Bridge
 *
 * High-level API for save/load/recover operations, integrating WAL,
 * Checkpoint, and Recovery Manager into the NL2ONE pipeline.
 */

import * as fs from 'fs';
import * as path from 'path';
import { WriteAheadLog, WALEntry } from '../core/engine/wal';
import { CheckpointManager, CheckpointData } from '../core/engine/checkpoint';
import { RecoveryManager, RecoveredState } from '../core/engine/recoveryManager';
import { CubiOVirtualMachine } from '../core/engine/cubioVM';
import { OneLexer } from './oneLexer';
import { OneParser } from './oneParser';
import { OneCompiler } from './oneCompiler';
import { NL2ONECompiler } from './nlCompiler';

export interface PersistenceConfig {
  /** Base directory for persistence files */
  dataDir?: string;
  /** WAL file name */
  walFile?: string;
  /** Checkpoint file name */
  checkpointFile?: string;
}

const DEFAULT_CONFIG: Required<PersistenceConfig> = {
  dataDir: './data/one_state',
  walFile: 'wal.log',
  checkpointFile: 'checkpoint.json',
};

export class PersistenceBridge {
  private config: Required<PersistenceConfig>;
  private wal: WriteAheadLog;
  private checkpointMgr: CheckpointManager;
  private recoveryMgr: RecoveryManager;
  private vm: CubiOVirtualMachine;

  constructor(config: PersistenceConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    fs.mkdirSync(this.config.dataDir, { recursive: true });

    this.wal = new WriteAheadLog({
      logDir: this.config.dataDir,
      logFile: this.config.walFile,
    });

    this.checkpointMgr = new CheckpointManager({
      dataDir: this.config.dataDir,
      checkpointFile: this.config.checkpointFile,
      wal: this.wal,
    });

    this.recoveryMgr = new RecoveryManager({
      dataDir: this.config.dataDir,
      wal: this.wal,
      checkpointMgr: this.checkpointMgr,
    });

    this.vm = new CubiOVirtualMachine();
  }

  /**
   * Execute ONE source code and log mutations to WAL.
   */
  public executeAndLog(oneSource: string): { success: boolean; vmState: any; error?: string } {
    try {
      const lexer = new OneLexer(oneSource);
      const tokens = lexer.tokenize();
      const parser = new OneParser(tokens);
      const ast = parser.parse();
      const compiler = new OneCompiler(ast);
      const executableAST = compiler.compile();

      this.vm.execute(executableAST);
      const vmState = this.vm.getVMState();

      // Log node creations from the source
      this.logNodeCreations(oneSource, vmState);

      return { success: true, vmState };
    } catch (err: any) {
      return { success: false, vmState: null, error: err.message || String(err) };
    }
  }

  /**
   * Log node creation events from ONE source to WAL.
   */
  private logNodeCreations(source: string, vmState: any): void {
    // Detect node creation patterns in source
    const nodeRegex = /node\s+(\w+)\s*\{\s*@Space\(([^)]+)\)\s*;/g;
    let match;
    while ((match = nodeRegex.exec(source)) !== null) {
      const name = match[1];
      const coords = match[2].split(',').map(s => parseFloat(s.trim()));
      this.wal.append({
        type: 'node_create',
        description: `Node '${name}' created at (${coords.join(', ')})`,
        payload: {
          nodeId: name,
          name,
          coordinates: coords.length === 3 ? coords : [0, 0, 0],
        },
      });
    }
  }

  /**
   * Log variable declarations to WAL.
   */
  public logVariableSet(name: string, value: any): void {
    this.wal.append({
      type: 'variable_set',
      description: `Variable '${name}' set to ${value}`,
      payload: { name, value },
    });
  }

  /**
   * Log RSS limit changes to WAL.
   */
  public logRSSSet(value: number): void {
    this.wal.append({
      type: 'rss_set',
      description: `RSS limit set to ${value} MB`,
      payload: { value },
    });
  }

  /**
   * Log funnel creation to WAL.
   */
  public logFunnelOpen(name: string, sourceNode: string, targetNode: string, bufferMb: number): void {
    this.wal.append({
      type: 'funnel_open',
      description: `Funnel '${name}' opened: ${sourceNode} -> ${targetNode} (${bufferMb} MB)`,
      payload: { name, sourceNode, targetNode, bufferMb },
    });
  }

  /**
   * Save current state to checkpoint.
   */
  public saveState(vmState: any, meshState: any, rssState: any, funnelState: any): CheckpointData | null {
    try {
      const latestSeq = this.wal.getLatestSeq();
      const checkpoint = this.checkpointMgr.createCheckpoint(vmState, meshState, rssState, funnelState, latestSeq);
      console.log(`[Persistence] Checkpoint saved (seq ${latestSeq}, ${this.wal.getTotalEntries()} total WAL entries)`);
      return checkpoint;
    } catch (err: any) {
      console.error(`[Persistence] Checkpoint save failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Load and recover state from disk.
   */
  public recoverState(): RecoveredState {
    console.log('[Persistence] Starting recovery...');
    const result = this.recoveryMgr.recover();
    if (result.success) {
      console.log(`[Persistence] Recovery complete: ${result.walEntriesReplayed} WAL entries replayed`);
    } else {
      console.error(`[Persistence] Recovery failed: ${result.error}`);
    }
    return result;
  }

  /**
   * Reset persistence (clear WAL and checkpoint).
   */
  public reset(): void {
    this.wal.remove();
    this.checkpointMgr.deleteCheckpoint();
    console.log('[Persistence] Reset complete — WAL and checkpoint cleared');
  }

  /**
   * Get WL statistics.
   */
  public getStats(): { walEntries: number; checkpointExists: boolean; latestSeq: number } {
    return this.recoveryMgr.getStats();
  }

  /**
   * Get the underlying VM instance.
   */
  public getVM(): CubiOVirtualMachine {
    return this.vm;
  }

  /**
   * Get the NL2ONE compiler instance (for NL→ONE→execute pipeline).
   */
  public getNL2ONECompiler(): NL2ONECompiler {
    return new NL2ONECompiler();
  }

  /**
   * Execute an NL sentence through the full NL2ONE + persistence pipeline.
   */
  public executeNL(nlInput: string): { success: boolean; vmState: any; generatedCode: string; error?: string } {
    const compiler = this.getNL2ONECompiler();
    const result = compiler.compileAndExecute(nlInput);

    if (result.success) {
      // Log to WAL
      this.logFromNLResult(nlInput, result);
      return {
        success: true,
        vmState: result.vmState,
        generatedCode: result.generatedCode,
      };
    } else {
      return {
        success: false,
        vmState: null,
        generatedCode: '',
        error: result.error,
      };
    }
  }

  /**
   * Log mutations detected from an NL2ONE success result.
   */
  private logFromNLResult(nlInput: string, result: any): void {
    const code = result.generatedCode;
    const state = result.vmState;

    // Log node creations
    const nodeRegex = /node\s+(\w+)\s*\{\s*@Space\(([^)]+)\)\s*;/g;
    let match;
    while ((match = nodeRegex.exec(code)) !== null) {
      const name = match[1];
      const coords = match[2].split(',').map(s => parseFloat(s.trim()));
      this.wal.append({
        type: 'node_create',
        description: `NL: Node '${name}' created at (${coords.join(', ')})`,
        payload: { nodeId: name, name, coordinates: coords.length === 3 ? coords : [0, 0, 0] },
      });
    }

    // Log variable sets
    const varRegex = /let\s+(\w+)\s*:\s*\w+\s*=\s*([^;]+)/g;
    while ((match = varRegex.exec(code)) !== null) {
      const name = match[1];
      const rawVal = match[2].trim();
      const value = rawVal.startsWith('"') ? rawVal.slice(1, -1) : parseFloat(rawVal);
      this.logVariableSet(name, value);
    }

    // Log RSS sets
    const rssRegex = /rss_max\s*=\s*(\d+)/g;
    if ((match = rssRegex.exec(code)) !== null) {
      this.logRSSSet(parseInt(match[1], 10));
    }

    // Log funnels
    const funnelRegex = /funnel\s+(\w+)\s*\{\s*stream\s+(\w+)\s*->\s*(\w+)\s*:\s*(\d+)/g;
    while ((match = funnelRegex.exec(code)) !== null) {
      this.logFunnelOpen(match[1], match[2], match[3], parseInt(match[4], 10));
    }
  }

  /**
   * Get the underlying WAL instance.
   */
  public getWal(): WriteAheadLog {
    return this.wal;
  }

  /**
   * Get the underlying CheckpointManager instance.
   */
  public getCheckpointMgr(): CheckpointManager {
    return this.checkpointMgr;
  }

  /**
   * Close and cleanup resources.
   */
  public close(): void {
    this.wal.close();
    console.log('[Persistence] Closed');
  }
}
