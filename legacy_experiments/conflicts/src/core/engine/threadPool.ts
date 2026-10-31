/**
 * Phase 8A — Thread Pool
 *
 * Worker thread pool for concurrent VM task execution and deterministic
 * result aggregation using Node.js worker_threads.
 */

import * as os from 'os';

// Dynamic imports for worker_threads (avoid top-level isMainThread issues)
type WorkerClass = typeof Worker;
type ParentPort = { postMessage: (msg: any) => void; on: (event: string, cb: (msg: any) => void) => void };

function getWorker(): { Worker: WorkerClass; isMainThread: boolean; parentPort: ParentPort | null } {
  try {
    const { Worker, isMainThread, parentPort } = require('worker_threads');
    return { Worker, isMainThread, parentPort: parentPort ?? null };
  } catch {
    return { Worker: null as any, isMainThread: true, parentPort: null };
  }
}

export interface Task<T = any, R = any> {
  id: string;
  type: string;
  payload: T;
  sequence: number; // 369-harmonic sequence order
}

export interface TaskResult<R = any> {
  id: string;
  sequence: number;
  success: boolean;
  result?: R;
  error?: string;
}

export interface ThreadPoolConfig {
  maxThreads?: number;
  /** Optional worker script path for offloading heavy tasks */
  workerScript?: string;
}

export class ThreadPool {
  private maxThreads: number = 1;
  private activeWorkers: any[] = [];
  private taskQueue: Array<{ task: Task; resolve: (res: TaskResult) => void; reject: (err: any) => void }> = [];
  private runningTasks: Map<string, any> = new Map();
  private isMain: boolean = true;
  private workerScript?: string;
  private workerCounter: number = 0;

  constructor(config: ThreadPoolConfig = {}) {
    const { Worker, isMainThread } = getWorker();
    this.isMain = isMainThread;
    if (!this.isMain) {
      // Worker thread: will receive tasks from main via parentPort
      this.setupWorkerListener();
      return;
    }

    this.maxThreads = config.maxThreads ?? Math.max(1, os.cpus().length - 1);
    this.activeWorkers = [];
    this.taskQueue = [];
    this.runningTasks = new Map();
    this.workerScript = config.workerScript;
    this.workerCounter = 0;
  }

  /**
   * Setup listener for worker thread to receive tasks from main.
   */
  private setupWorkerListener(): void {
    const { parentPort } = getWorker();
    if (!parentPort) return;

    parentPort.on('message', (msg: any) => {
      if (msg.type === 'TASK') {
        const { task, callbackId } = msg;
        try {
          const result = this.executeLocalTask(task);
          parentPort?.postMessage({ type: 'RESULT', callbackId, result });
        } catch (err: any) {
          parentPort?.postMessage({ type: 'RESULT', callbackId, result: { success: false, error: err.message } });
        }
      }
    });
  }

  /**
   * Execute a task locally (simulated or delegated to worker).
   */
  private executeLocalTask<T, R>(task: Task<T, R>): TaskResult<R> {
    // Simulate task execution with 369-harmonic timing
    const delay = (task.sequence % 369) * 0.01;
    return {
      id: task.id,
      sequence: task.sequence,
      success: true,
      result: {
        executedType: task.type,
        processedPayload: task.payload,
        timestamp: Date.now(),
        harmonicSeq: task.sequence,
      } as R,
    };
  }

  /**
   * Submit a task to the thread pool with deterministic 369-harmonic sequence ordering.
   */
  public async executeTask<T, R>(type: string, payload: T, sequence: number = 0): Promise<TaskResult<R>> {
    if (!this.isMain) {
      throw new Error('ThreadPool.executeTask: called from worker thread — use main thread');
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const task: Task<T, R> = { id: taskId, type, payload, sequence };

    return new Promise((resolve, reject) => {
      this.taskQueue.push({ task, resolve, reject });
      this.taskQueue.sort((a, b) => a.task.sequence - b.task.sequence);
      this.dispatch();
    });
  }

  /**
   * Dispatch next task from queue to an available worker or execute locally.
   */
  private dispatch(): void {
    if (this.taskQueue.length === 0) return;

    const item = this.taskQueue.shift();
    if (!item) return;

    const { task, resolve, reject } = item;

    // For Phase 8A, execute locally (simulated concurrency).
    // Phase 8B+ will delegate to actual worker threads.
    try {
      const result = this.executeLocalTask(task);
      resolve(result);
    } catch (err: any) {
      reject(err);
    }
  }

  /**
   * Get current queue size.
   */
  public getQueueSize(): number {
    return this.taskQueue.length;
  }

  /**
   * Get number of active (running) tasks.
   */
  public getActiveCount(): number {
    return this.runningTasks.size;
  }

  /**
   * Get max thread count.
   */
  public getMaxThreads(): number {
    return this.maxThreads;
  }

  /**
   * Gracefully shutdown the pool.
   */
  public shutdown(): void {
    this.taskQueue = [];
    for (const worker of this.activeWorkers) {
      if (worker?.terminate) worker.terminate();
    }
    this.activeWorkers = [];
    this.runningTasks.clear();
  }
}

/**
 * Convenience: execute multiple tasks concurrently and collect results
 * in deterministic 369-harmonic sequence order.
 */
export async function executeConcurrently<T, R>(
  tasks: Array<{ type: string; payload: T; sequence: number }>,
  pool?: ThreadPool,
): Promise<TaskResult<R>[]> {
  const tp = pool ?? new ThreadPool();
  try {
    const promises = tasks.map(t => tp.executeTask<T, R>(t.type, t.payload, t.sequence));
    const results = await Promise.all(promises);
    // Sort by sequence for deterministic ordering
    results.sort((a, b) => a.sequence - b.sequence);
    return results;
  } finally {
    if (!pool) tp.shutdown();
  }
}
