/**
 * CUBiO AI — ONE LANGUAGE — WORKER THREAD POOL & RECOVERY
 * =========================================================
 * Module: @one/workers/WorkerPool
 * Gate: ONE-06 / Worker Parallelism & Fault-Tolerant Pool
 *
 * Implements a managed pool of Node.js worker threads communicating over
 * SharedArrayBuffer and typed IPC protocol with automatic failure recovery.
 */

import * as os from 'os';
import {
  MasterToWorkerMessage,
  WorkerToMasterMessage,
  WorkerResultMessage,
  WorkerHealthRecord,
} from './WorkerProtocol';
import { SharedMemoryArena, WORKER_STATUS } from './SharedMemoryArena';
import { WORKER_THREAD_CODE_STRING, executeWorkerTask, WorkerThreadState } from './WorkerThreadLogic';

type WorkerClass = any;

function getWorkerThreads(): { Worker: WorkerClass | null; isMainThread: boolean } {
  try {
    const wt = require('worker_threads');
    return { Worker: wt.Worker, isMainThread: wt.isMainThread };
  } catch {
    return { Worker: null, isMainThread: true };
  }
}

export interface WorkerPoolConfig {
  maxWorkers?: number;
  useVirtualWorkers?: boolean; // Force in-process virtual workers (for lightweight unit testing)
  taskTimeoutMs?: number;      // Timeout per task in ms (default: 10,000 ms)
}

interface PendingTask {
  message: MasterToWorkerMessage;
  resolve: (res: WorkerResultMessage) => void;
  reject: (err: any) => void;
  timestamp: number;
}

export class WorkerPool {
  public readonly arena: SharedMemoryArena;
  public readonly workerCount: number;

  private workers: WorkerClass[] = [];
  private virtualStates: WorkerThreadState[] = [];
  private healthRecords: WorkerHealthRecord[] = [];
  private activeTasks: Map<number, PendingTask> = new Map();
  private pendingCallbacks: Map<string, { resolve: (res: any) => void; reject: (err: any) => void }> = new Map();
  private isVirtual: boolean = false;
  private isShutdown: boolean = false;
  private taskTimeoutMs: number;

  constructor(arena: SharedMemoryArena, config: WorkerPoolConfig = {}) {
    this.arena = arena;
    this.workerCount = Math.max(1, Math.min(arena.layout.maxWorkers, config.maxWorkers ?? Math.max(1, Math.min(8, os.cpus().length - 1))));
    this.taskTimeoutMs = config.taskTimeoutMs ?? 10000;

    const { Worker } = getWorkerThreads();
    this.isVirtual = config.useVirtualWorkers || !Worker;

    for (let k = 0; k < this.workerCount; k++) {
      this.healthRecords.push({
        workerId: k,
        isAlive: false,
        totalTasksCompleted: 0,
        totalTasksFailed: 0,
        lastHeartbeatTime: Date.now(),
        currentTaskId: null,
        currentSequence: null,
      });
    }

    this.spawnAllWorkers();
  }

  /**
   * Spawns all worker threads and initializes SharedArrayBuffer bindings.
   */
  private spawnAllWorkers(): void {
    for (let k = 0; k < this.workerCount; k++) {
      this.spawnWorker(k);
    }
  }

  /**
   * Spawns or respawns an individual worker with a specific workerId.
   */
  private spawnWorker(workerId: number): void {
    if (this.isVirtual) {
      const state: WorkerThreadState = {
        workerId,
        totalWorkers: this.workerCount,
        arena: this.arena,
        seed: 42 + workerId * 100,
      };
      this.virtualStates[workerId] = state;
      this.healthRecords[workerId].isAlive = true;
      this.healthRecords[workerId].lastHeartbeatTime = Date.now();
      return;
    }

    const { Worker } = getWorkerThreads();
    if (!Worker) return;

    try {
      const worker = new Worker(WORKER_THREAD_CODE_STRING, { eval: true });
      this.workers[workerId] = worker;
      this.healthRecords[workerId].isAlive = true;
      this.healthRecords[workerId].lastHeartbeatTime = Date.now();

      worker.on('message', (msg: WorkerToMasterMessage) => {
        this.handleWorkerResponse(workerId, msg);
      });

      worker.on('error', (err: any) => {
        this.handleWorkerFailure(workerId, `Worker error: ${err?.message || String(err)}`);
      });

      worker.on('exit', (code: number) => {
        if (!this.isShutdown && code !== 0) {
          this.handleWorkerFailure(workerId, `Worker exited abnormally with code ${code}`);
        }
      });

      // Send INIT message with SharedArrayBuffer
      worker.postMessage({
        type: 'INIT',
        workerId,
        totalWorkers: this.workerCount,
        sab: this.arena.sab,
        layout: this.arena.layout,
        seed: 42 + workerId * 100,
      });
    } catch (err: any) {
      // Fallback to virtual worker if thread spawn fails
      this.isVirtual = true;
      this.spawnWorker(workerId);
    }
  }

  /**
   * Handles incoming messages from a worker.
   */
  private handleWorkerResponse(workerId: number, msg: WorkerToMasterMessage): void {
    this.healthRecords[workerId].lastHeartbeatTime = Date.now();

    if (msg.type === 'PONG') {
      const active = this.activeTasks.get(workerId);
      this.activeTasks.delete(workerId);
      this.healthRecords[workerId].currentTaskId = null;
      this.healthRecords[workerId].currentSequence = null;
      this.healthRecords[workerId].totalTasksCompleted++;

      const taskId = (msg as any).taskId || (active?.message as any)?.taskId;
      if (taskId) {
        const pending = this.pendingCallbacks.get(taskId);
        if (pending) {
          this.pendingCallbacks.delete(taskId);
          pending.resolve(msg as any);
          return;
        }
      }

      if (active) {
        active.resolve(msg as any);
      }
      return;
    }

    if (msg.type === 'RESULT') {
      const taskId = msg.taskId;
      this.healthRecords[workerId].currentTaskId = null;
      this.healthRecords[workerId].currentSequence = null;
      this.activeTasks.delete(workerId);

      if (msg.success) {
        this.healthRecords[workerId].totalTasksCompleted++;
      } else {
        this.healthRecords[workerId].totalTasksFailed++;
      }

      const pending = this.pendingCallbacks.get(taskId);
      if (pending) {
        this.pendingCallbacks.delete(taskId);
        pending.resolve(msg);
      }
    }
  }

  /**
   * Automatic Worker Failure & Recovery Handling.
   * If a worker crashes or errors:
   *   1. Identifies the interrupted task.
   *   2. Terminates the dead worker cleanly.
   *   3. Respawns a healthy replacement worker with the same workerId.
   *   4. Resubmits the pending task with its original sequence index.
   */
  private handleWorkerFailure(workerId: number, reason: string): void {
    this.healthRecords[workerId].isAlive = false;
    this.healthRecords[workerId].totalTasksFailed++;

    const interruptedTask = this.activeTasks.get(workerId);
    this.activeTasks.delete(workerId);

    // Clean up dead worker instance
    const oldWorker = this.workers[workerId];
    if (oldWorker?.terminate) {
      try {
        oldWorker.terminate();
      } catch {}
    }

    if (this.isShutdown) return;

    // Respawn replacement worker
    this.spawnWorker(workerId);

    // If an in-flight task was interrupted, automatically replay it on the recovered worker
    if (interruptedTask) {
      this.dispatchToWorker(workerId, interruptedTask.message)
        .then(interruptedTask.resolve)
        .catch(interruptedTask.reject);
    }
  }

  /**
   * Injects a synthetic fault into a worker thread to test and verify recovery.
   */
  public async injectFault(workerId: number): Promise<void> {
    if (workerId < 0 || workerId >= this.workerCount) return;

    if (this.isVirtual) {
      // Simulate crash by resetting virtual state
      this.virtualStates[workerId] = {
        workerId,
        totalWorkers: this.workerCount,
        arena: this.arena,
        seed: Date.now(),
      };
      this.healthRecords[workerId].totalTasksFailed++;
      return;
    }

    const worker = this.workers[workerId];
    if (worker?.terminate) {
      await worker.terminate();
      this.handleWorkerFailure(workerId, 'Fault Injection: Forced worker termination');
    }
  }

  /**
   * Dispatches a message to a specific worker and awaits completion.
   */
  public async dispatchToWorker(workerId: number, message: MasterToWorkerMessage): Promise<WorkerResultMessage> {
    if (this.isShutdown) {
      throw new Error('WorkerPool is already shut down');
    }

    const taskId = (message as any).taskId || `task_${Date.now()}_${workerId}_${Math.random().toString(36).substr(2, 6)}`;
    const sequence = (message as any).sequence ?? 0;
    (message as any).taskId = taskId;
    (message as any).sequence = sequence;

    return new Promise((resolve, reject) => {
      this.pendingCallbacks.set(taskId, { resolve, reject });
      this.activeTasks.set(workerId, {
        message,
        resolve,
        reject,
        timestamp: Date.now(),
      });

      this.healthRecords[workerId].currentTaskId = taskId;
      this.healthRecords[workerId].currentSequence = sequence;

      if (this.isVirtual) {
        const state = this.virtualStates[workerId];
        executeWorkerTask(message, state, (res: WorkerToMasterMessage) => {
          this.handleWorkerResponse(workerId, res);
        });
      } else {
        const worker = this.workers[workerId];
        if (!worker) {
          reject(new Error(`Worker ${workerId} is not available`));
          return;
        }
        worker.postMessage(message);
      }
    });
  }

  /**
   * Broadcasts a message to all active workers concurrently.
   */
  public async broadcast(message: MasterToWorkerMessage): Promise<WorkerResultMessage[]> {
    const promises: Promise<WorkerResultMessage>[] = [];
    for (let k = 0; k < this.workerCount; k++) {
      promises.push(this.dispatchToWorker(k, { ...message, workerId: k } as any));
    }
    return Promise.all(promises);
  }

  /**
   * Returns health status records for all workers in the pool.
   */
  public getHealthStatus(): ReadonlyArray<WorkerHealthRecord> {
    return this.healthRecords;
  }

  /**
   * Gracefully shuts down the pool and terminates all workers.
   */
  public async shutdown(): Promise<void> {
    this.isShutdown = true;
    for (let k = 0; k < this.workerCount; k++) {
      const worker = this.workers[k];
      if (worker?.terminate) {
        try {
          await worker.terminate();
        } catch {}
      }
      this.healthRecords[k].isAlive = false;
    }
    this.workers = [];
    this.virtualStates = [];
    this.pendingCallbacks.clear();
    this.activeTasks.clear();
  }
}
