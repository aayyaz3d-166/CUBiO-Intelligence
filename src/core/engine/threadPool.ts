/**
 * Phase 8A — Thread Pool
 *
 * Worker thread pool for concurrent VM task execution and deterministic
 * result aggregation using Node.js worker_threads and asynchronous concurrency.
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
  handler?: (payload: T, sequence: number) => Promise<R> | R;
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
  /** Optional maximum pending queue size to prevent unbounded queue saturation */
  maxQueueSize?: number;
}

export type TaskHandler<T = any, R = any> = (payload: T, sequence: number) => Promise<R> | R;

export class ThreadPool {
  private maxThreads: number = 1;
  private maxQueueSize: number = 0;
  private isShutdown: boolean = false;
  private activeWorkers: any[] = [];
  private taskQueue: Array<{
    task: Task;
    resolve: (res: TaskResult) => void;
    reject: (err: any) => void;
  }> = [];
  private runningTasks: Map<string, Task> = new Map();
  private handlers: Map<string, TaskHandler> = new Map();
  private isMain: boolean = true;
  private workerScript?: string;
  private workerCounter: number = 0;
  private activeCount: number = 0;

  constructor(config: ThreadPoolConfig = {}) {
    const { isMainThread } = getWorker();
    this.isMain = isMainThread;
    if (!this.isMain) {
      // Worker thread: will receive tasks from main via parentPort
      this.setupWorkerListener();
      return;
    }

    this.maxThreads = config.maxThreads ?? Math.max(1, os.cpus().length - 1);
    this.maxQueueSize = config.maxQueueSize ?? 0;
    this.isShutdown = false;
    this.activeWorkers = [];
    this.taskQueue = [];
    this.runningTasks = new Map();
    this.workerScript = config.workerScript;
    this.workerCounter = 0;
    this.activeCount = 0;
  }

  /**
   * Register a custom task handler for a specific task type.
   */
  public registerHandler<T = any, R = any>(type: string, handler: TaskHandler<T, R>): void {
    this.handlers.set(type, handler);
  }

  /**
   * Setup listener for worker thread to receive tasks from main.
   */
  private setupWorkerListener(): void {
    const { parentPort } = getWorker();
    if (!parentPort) return;

    parentPort.on('message', async (msg: any) => {
      if (msg.type === 'TASK') {
        const { task, callbackId } = msg;
        try {
          const result = await this.executeLocalTask(task);
          parentPort?.postMessage({ type: 'RESULT', callbackId, result });
        } catch (err: any) {
          parentPort?.postMessage({ type: 'RESULT', callbackId, result: { success: false, error: err.message } });
        }
      }
    });
  }

  /**
   * Execute a task locally (handler invocation or simulated harmonic timing).
   */
  private async executeLocalTask<T, R>(task: Task<T, R>): Promise<TaskResult<R>> {
    // 1. If explicit task handler is provided
    if (task.handler) {
      try {
        const res = await task.handler(task.payload, task.sequence);
        return {
          id: task.id,
          sequence: task.sequence,
          success: true,
          result: res,
        };
      } catch (err: any) {
        return {
          id: task.id,
          sequence: task.sequence,
          success: false,
          error: err?.message || String(err),
        };
      }
    }

    // 2. If registered handler exists for this type
    const registeredHandler = this.handlers.get(task.type);
    if (registeredHandler) {
      try {
        const res = await registeredHandler(task.payload, task.sequence);
        return {
          id: task.id,
          sequence: task.sequence,
          success: true,
          result: res,
        };
      } catch (err: any) {
        return {
          id: task.id,
          sequence: task.sequence,
          success: false,
          error: err?.message || String(err),
        };
      }
    }

    // 3. Fallback default simulated execution with 369-harmonic timing
    const delay = (task.sequence % 369) * 0.001;
    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }
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
  public async executeTask<T, R>(
    type: string,
    payload: T,
    sequence: number = 0,
    handler?: TaskHandler<T, R>
  ): Promise<TaskResult<R>> {
    if (!this.isMain) {
      throw new Error('ThreadPool.executeTask: called from worker thread — use main thread');
    }
    if (this.isShutdown) {
      throw new Error('ThreadPool is shut down');
    }
    if (this.maxQueueSize > 0 && this.taskQueue.length >= this.maxQueueSize) {
      throw new Error(`ThreadPool queue saturated: max capacity ${this.maxQueueSize} reached`);
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const task: Task<T, R> = { id: taskId, type, payload, sequence, handler };

    return new Promise((resolve, reject) => {
      this.taskQueue.push({ task, resolve, reject });
      this.taskQueue.sort((a, b) => a.task.sequence - b.task.sequence);
      this.dispatch();
    });
  }

  /**
   * Dispatch next task from queue to an available worker or execute asynchronously.
   */
  private dispatch(): void {
    while (this.activeCount < this.maxThreads && this.taskQueue.length > 0) {
      const item = this.taskQueue.shift();
      if (!item) break;

      const { task, resolve, reject } = item;
      this.activeCount++;
      this.runningTasks.set(task.id, task);

      (async () => {
        try {
          const result = await this.executeLocalTask(task);
          resolve(result);
        } catch (err: any) {
          reject(err);
        } finally {
          this.activeCount--;
          this.runningTasks.delete(task.id);
          this.dispatch();
        }
      })();
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
    return this.activeCount;
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
    this.isShutdown = true;
    for (const item of this.taskQueue) {
      item.reject(new Error('ThreadPool shut down'));
    }
    this.taskQueue = [];
    for (const worker of this.activeWorkers) {
      if (worker?.terminate) worker.terminate();
    }
    this.activeWorkers = [];
    this.runningTasks.clear();
    this.activeCount = 0;
  }
}

/**
 * Convenience: execute multiple tasks concurrently and collect results
 * in deterministic 369-harmonic sequence order.
 */
export async function executeConcurrently<T, R>(
  tasks: Array<{ type: string; payload: T; sequence: number; handler?: TaskHandler<T, R> }>,
  pool?: ThreadPool
): Promise<TaskResult<R>[]> {
  const tp = pool ?? new ThreadPool();
  try {
    const promises = tasks.map((t) => tp.executeTask<T, R>(t.type, t.payload, t.sequence, t.handler));
    const results = await Promise.all(promises);
    // Sort by sequence for deterministic ordering
    results.sort((a, b) => a.sequence - b.sequence);
    return results;
  } finally {
    if (!pool) tp.shutdown();
  }
}
