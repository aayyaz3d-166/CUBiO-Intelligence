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
import { WORKER_THREAD_CODE_STRING, executeWorkerTask } from './WorkerThreadLogic';
function getWorkerThreads() {
    try {
        const wt = require('worker_threads');
        return { Worker: wt.Worker, isMainThread: wt.isMainThread };
    }
    catch {
        return { Worker: null, isMainThread: true };
    }
}
export class WorkerPool {
    arena;
    workerCount;
    workers = [];
    virtualStates = [];
    healthRecords = [];
    activeTasks = new Map();
    pendingCallbacks = new Map();
    isVirtual = false;
    isShutdown = false;
    taskTimeoutMs;
    constructor(arena, config = {}) {
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
    spawnAllWorkers() {
        for (let k = 0; k < this.workerCount; k++) {
            this.spawnWorker(k);
        }
    }
    /**
     * Spawns or respawns an individual worker with a specific workerId.
     */
    spawnWorker(workerId) {
        if (this.isVirtual) {
            const state = {
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
        if (!Worker)
            return;
        try {
            const worker = new Worker(WORKER_THREAD_CODE_STRING, { eval: true });
            this.workers[workerId] = worker;
            this.healthRecords[workerId].isAlive = true;
            this.healthRecords[workerId].lastHeartbeatTime = Date.now();
            worker.on('message', (msg) => {
                this.handleWorkerResponse(workerId, msg);
            });
            worker.on('error', (err) => {
                this.handleWorkerFailure(workerId, `Worker error: ${err?.message || String(err)}`);
            });
            worker.on('exit', (code) => {
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
        }
        catch (err) {
            // Fallback to virtual worker if thread spawn fails
            this.isVirtual = true;
            this.spawnWorker(workerId);
        }
    }
    /**
     * Handles incoming messages from a worker.
     */
    handleWorkerResponse(workerId, msg) {
        this.healthRecords[workerId].lastHeartbeatTime = Date.now();
        if (msg.type === 'PONG') {
            const active = this.activeTasks.get(workerId);
            this.activeTasks.delete(workerId);
            this.healthRecords[workerId].currentTaskId = null;
            this.healthRecords[workerId].currentSequence = null;
            this.healthRecords[workerId].totalTasksCompleted++;
            const taskId = msg.taskId || active?.message?.taskId;
            if (taskId) {
                const pending = this.pendingCallbacks.get(taskId);
                if (pending) {
                    this.pendingCallbacks.delete(taskId);
                    pending.resolve(msg);
                    return;
                }
            }
            if (active) {
                active.resolve(msg);
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
            }
            else {
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
    handleWorkerFailure(workerId, reason) {
        this.healthRecords[workerId].isAlive = false;
        this.healthRecords[workerId].totalTasksFailed++;
        const interruptedTask = this.activeTasks.get(workerId);
        this.activeTasks.delete(workerId);
        // Clean up dead worker instance
        const oldWorker = this.workers[workerId];
        if (oldWorker?.terminate) {
            try {
                oldWorker.terminate();
            }
            catch { }
        }
        if (this.isShutdown)
            return;
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
    async injectFault(workerId) {
        if (workerId < 0 || workerId >= this.workerCount)
            return;
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
    async dispatchToWorker(workerId, message) {
        if (this.isShutdown) {
            throw new Error('WorkerPool is already shut down');
        }
        const taskId = message.taskId || `task_${Date.now()}_${workerId}_${Math.random().toString(36).substr(2, 6)}`;
        const sequence = message.sequence ?? 0;
        message.taskId = taskId;
        message.sequence = sequence;
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
                executeWorkerTask(message, state, (res) => {
                    this.handleWorkerResponse(workerId, res);
                });
            }
            else {
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
    async broadcast(message) {
        const promises = [];
        for (let k = 0; k < this.workerCount; k++) {
            promises.push(this.dispatchToWorker(k, { ...message, workerId: k }));
        }
        return Promise.all(promises);
    }
    /**
     * Returns health status records for all workers in the pool.
     */
    getHealthStatus() {
        return this.healthRecords;
    }
    /**
     * Gracefully shuts down the pool and terminates all workers.
     */
    async shutdown() {
        this.isShutdown = true;
        for (let k = 0; k < this.workerCount; k++) {
            const worker = this.workers[k];
            if (worker?.terminate) {
                try {
                    await worker.terminate();
                }
                catch { }
            }
            this.healthRecords[k].isAlive = false;
        }
        this.workers = [];
        this.virtualStates = [];
        this.pendingCallbacks.clear();
        this.activeTasks.clear();
    }
}
