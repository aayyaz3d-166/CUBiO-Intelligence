// Phase 8D — Concurrency Safety Bridge
//
// Thread-safe wrapper for NL2ONE pipeline execution with deterministic
// 369-harmonic aggregation.

import { ThreadPool, executeConcurrently } from '../core/engine/threadPool';
import { ConcurrentNodeRegistry, LockFreeVariableStore, HarmonicCounter } from '../core/engine/lockFreeStructures';
import { LockFreeQueue } from '../core/engine/lockFreeStructures';
import { NL2ONECompiler } from './nlCompiler';
import { PersistenceBridge } from './persistenceBridge';
import * as os from 'os';

export interface ConcurrentExecutionResult {
  input: string;
  success: boolean;
  generatedCode: string;
  vmState: any;
  error?: string;
  phase?: string;
  sequence: number;
  harmonicTier: number;
}

export interface ConcurrencyBridgeConfig {
  maxThreads?: number;
  enablePersistence?: boolean;
  dataDir?: string;
}

export class ConcurrencyBridge {
  private pool: ThreadPool;
  private registry: ConcurrentNodeRegistry;
  private variableStore: LockFreeVariableStore;
  private harmonicCounter: HarmonicCounter;
  private compiler: NL2ONECompiler;
  private persistenceBridge?: PersistenceBridge;
  private executionQueue: LockFreeQueue<{
    input: string;
    sequence: number;
    resolve: (result: ConcurrentExecutionResult) => void;
    reject: (err: any) => void;
  }>;
  private maxConcurrent: number;
  private isProcessing: boolean = false;

  constructor(config: ConcurrencyBridgeConfig = {}) {
    const maxThreads = config.maxThreads ?? Math.max(1, os.cpus().length - 1);
    this.pool = new ThreadPool({ maxThreads });
    this.registry = new ConcurrentNodeRegistry();
    this.variableStore = new LockFreeVariableStore();
    this.harmonicCounter = new HarmonicCounter();
    this.compiler = new NL2ONECompiler();
    this.maxConcurrent = maxThreads;

    // Queue capacity: 1024 * max threads for concurrent execution
    this.executionQueue = new LockFreeQueue<any>(1024 * Math.max(1, maxThreads));

    // Optional persistence bridge
    if (config.enablePersistence) {
      this.persistenceBridge = new PersistenceBridge({
        dataDir: config.dataDir ?? './data/one_state',
      });
    }
  }

  /**
   * Process the execution queue sequentially (lock-free, ordered by sequence).
   * Uses the thread pool for actual execution.
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (!this.executionQueue.isEmpty()) {
        const item = this.executionQueue.dequeue();
        if (!item) break;

        try {
          const result = await this.compiler.compileAndExecute(item.input);
          const seq = this.harmonicCounter.increment();
          const harmonicTier = this.harmonicCounter.getResonanceTier();

          if (result.success) {
            item.resolve({
              input: item.input,
              success: true,
              generatedCode: result.generatedCode,
              vmState: result.vmState,
              sequence: seq,
              harmonicTier,
            });
          } else {
            item.resolve({
              input: item.input,
              success: false,
              generatedCode: '',
              vmState: null,
              error: result.error ?? 'Unknown error',
              phase: result.phase ?? 'unknown',
              sequence: seq,
              harmonicTier,
            });
          }
        } catch (err: any) {
          item.reject(err);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute a single NL input through the NL2ONE pipeline with thread-safe execution.
   */
  public async executeNL(input: string, sequence: number = 0): Promise<ConcurrentExecutionResult> {
    const seq = this.harmonicCounter.increment();
    const harmonicTier = this.harmonicCounter.getResonanceTier();

    return new Promise((resolve, reject) => {
      this.executionQueue.enqueue({
        input,
        sequence: seq,
        resolve: (result: ConcurrentExecutionResult) => resolve(result),
        reject,
      });
      this.processQueue();
    });
  }

  /**
   * Execute multiple NL inputs concurrently with deterministic ordering.
   * Results are returned in 369-harmonic sequence order.
   */
  public async executeConcurrentNL(inputs: string[]): Promise<ConcurrentExecutionResult[]> {
    const tasks = inputs.map((input, idx) => ({
      type: 'compile_execute_nl',
      payload: { input },
      sequence: idx + 1,
    }));

    const results = await executeConcurrently<{ input: string }, any>(tasks, this.pool);
    const concurrentResults: ConcurrentExecutionResult[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const input = inputs[i];
      const seq = this.harmonicCounter.increment();
      const harmonicTier = this.harmonicCounter.getResonanceTier();

      if (result.success) {
        concurrentResults.push({
          input,
          success: true,
          generatedCode: result.result?.generatedCode ?? '',
          vmState: result.result?.vmState ?? null,
          sequence: seq,
          harmonicTier,
        });

        // Register nodes found in generated code
        const code = result.result?.generatedCode ?? '';
        this.extractAndRegisterNodes(code);

        // Store variables
        const vmState = result.result?.vmState;
        if (vmState?.variables) {
          for (const [name, value] of Object.entries(vmState.variables)) {
            this.variableStore.set(name, value);
          }
        }

        // Persist if enabled
        if (this.persistenceBridge) {
          try {
            this.persistenceBridge.executeNL(input);
          } catch {
            // Persistence failure is non-fatal
          }
        }
      } else {
        concurrentResults.push({
          input,
          success: false,
          generatedCode: '',
          vmState: null,
          error: result.result?.error ?? 'Unknown error',
          phase: result.result?.phase ?? 'unknown',
          sequence: seq,
          harmonicTier,
        });
      }
    }

    // Sort by 369-harmonic sequence for deterministic ordering
    concurrentResults.sort((a, b) => a.sequence - b.sequence);
    return concurrentResults;
  }

  /**
   * Execute NL inputs in batches for controlled concurrency.
   */
  public async executeBatchedNL(inputs: string[], batchSize: number = 4): Promise<ConcurrentExecutionResult[]> {
    const allResults: ConcurrentExecutionResult[] = [];

    for (let i = 0; i < inputs.length; i += batchSize) {
      const batch = inputs.slice(i, i + batchSize);
      const batchResults = await this.executeConcurrentNL(batch);
      allResults.push(...batchResults);

      // Small delay between batches for backpressure control
      const delay = (batchSize % 369) * 0.001;
      await new Promise(resolve => setTimeout(resolve, delay * 1000));
    }

    return allResults;
  }

  /**
   * Extract node names from ONE code and register them.
   */
  private extractAndRegisterNodes(code: string): void {
    const nodePattern = /node\s+(\w+)\s*\{/gi;
    let match: RegExpExecArray | null;
    while ((match = nodePattern.exec(code)) !== null) {
      const nodeName = match[1];
      this.registry.registerNode(nodeName, [0, 0, 0]);
    }
  }

  /**
   * Get the thread pool used by this bridge.
   */
  public getThreadPool(): ThreadPool {
    return this.pool;
  }

  /**
   * Get the concurrent node registry.
   */
  public getRegistry(): ConcurrentNodeRegistry {
    return this.registry;
  }

  /**
   * Get the variable store.
   */
  public getVariableStore(): LockFreeVariableStore {
    return this.variableStore;
  }

  /**
   * Get the harmonic counter.
   */
  public getHarmonicCounter(): HarmonicCounter {
    return this.harmonicCounter;
  }

  /**
   * Get the NL2ONE compiler.
   */
  public getCompiler(): NL2ONECompiler {
    return this.compiler;
  }

  /**
   * Get the persistence bridge (if enabled).
   */
  public getPersistenceBridge(): PersistenceBridge | undefined {
    return this.persistenceBridge;
  }

  /**
   * Get concurrency configuration.
   */
  public getConfig(): {
    maxThreads: number;
    enablePersistence: boolean;
    queueSize: number;
    registeredNodes: number;
    variableCount: number;
    harmonicValue: number;
    harmonicTier: number;
  } {
    return {
      maxThreads: this.maxConcurrent,
      enablePersistence: !!this.persistenceBridge,
      queueSize: this.executionQueue.size(),
      registeredNodes: this.registry.getCount(),
      variableCount: Object.keys(this.variableStore.getAll()).length,
      harmonicValue: this.harmonicCounter.get(),
      harmonicTier: this.harmonicCounter.getResonanceTier(),
    };
  }

  /**
   * Gracefully shutdown the bridge.
   */
  public shutdown(): void {
    this.pool.shutdown();
    if (this.persistenceBridge) {
      this.persistenceBridge.close();
    }
    this.executionQueue.clear();
    this.isProcessing = false;
  }

  /**
   * Reset the bridge state (clears registry, variable store, and queue).
   */
  public reset(): void {
    this.registry.clear();
    this.variableStore.clear();
    this.harmonicCounter.reset();
    this.executionQueue.clear();
    if (this.persistenceBridge) {
      this.persistenceBridge.reset();
    }
  }
}

/**
 * Execute NL inputs concurrently and return only successful results.
 */
export async function executeConcurrentNL(
  inputs: string[],
  config: ConcurrencyBridgeConfig = {},
): Promise<ConcurrentExecutionResult[]> {
  const bridge = new ConcurrencyBridge(config);
  try {
    const results = await bridge.executeConcurrentNL(inputs);
    return results.filter(r => r.success);
  } finally {
    bridge.shutdown();
  }
}

/**
 * Execute NL inputs in batches with controlled concurrency.
 */
export async function executeBatchedNL(
  inputs: string[],
  batchSize: number = 4,
  config: ConcurrencyBridgeConfig = {},
): Promise<ConcurrentExecutionResult[]> {
  const bridge = new ConcurrencyBridge(config);
  try {
    return await bridge.executeBatchedNL(inputs, batchSize);
  } finally {
    bridge.shutdown();
  }
}
