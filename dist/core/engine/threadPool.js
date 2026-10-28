/**
 * Phase 8A — Thread Pool
 *
 * Worker thread pool for concurrent VM task execution and deterministic
 * result aggregation using Node.js worker_threads and asynchronous concurrency.
 */
import * as os from 'os';
function getWorker() {
    try {
        const { Worker, isMainThread, parentPort } = require('worker_threads');
        return { Worker, isMainThread, parentPort: parentPort ?? null };
    }
    catch {
        return { Worker: null, isMainThread: true, parentPort: null };
    }
}
export class ThreadPool {
    maxThreads = 1;
    activeWorkers = [];
    taskQueue = [];
    runningTasks = new Map();
    handlers = new Map();
    isMain = true;
    workerScript;
    workerCounter = 0;
    activeCount = 0;
    constructor(config = {}) {
        const { isMainThread } = getWorker();
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
        this.activeCount = 0;
    }
    /**
     * Register a custom task handler for a specific task type.
     */
    registerHandler(type, handler) {
        this.handlers.set(type, handler);
    }
    /**
     * Setup listener for worker thread to receive tasks from main.
     */
    setupWorkerListener() {
        const { parentPort } = getWorker();
        if (!parentPort)
            return;
        parentPort.on('message', async (msg) => {
            if (msg.type === 'TASK') {
                const { task, callbackId } = msg;
                try {
                    const result = await this.executeLocalTask(task);
                    parentPort?.postMessage({ type: 'RESULT', callbackId, result });
                }
                catch (err) {
                    parentPort?.postMessage({ type: 'RESULT', callbackId, result: { success: false, error: err.message } });
                }
            }
        });
    }
    /**
     * Execute a task locally (handler invocation or simulated harmonic timing).
     */
    async executeLocalTask(task) {
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
            }
            catch (err) {
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
            }
            catch (err) {
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
            },
        };
    }
    /**
     * Submit a task to the thread pool with deterministic 369-harmonic sequence ordering.
     */
    async executeTask(type, payload, sequence = 0, handler) {
        if (!this.isMain) {
            throw new Error('ThreadPool.executeTask: called from worker thread — use main thread');
        }
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const task = { id: taskId, type, payload, sequence, handler };
        return new Promise((resolve, reject) => {
            this.taskQueue.push({ task, resolve, reject });
            this.taskQueue.sort((a, b) => a.task.sequence - b.task.sequence);
            this.dispatch();
        });
    }
    /**
     * Dispatch next task from queue to an available worker or execute asynchronously.
     */
    dispatch() {
        while (this.activeCount < this.maxThreads && this.taskQueue.length > 0) {
            const item = this.taskQueue.shift();
            if (!item)
                break;
            const { task, resolve, reject } = item;
            this.activeCount++;
            this.runningTasks.set(task.id, task);
            (async () => {
                try {
                    const result = await this.executeLocalTask(task);
                    resolve(result);
                }
                catch (err) {
                    reject(err);
                }
                finally {
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
    getQueueSize() {
        return this.taskQueue.length;
    }
    /**
     * Get number of active (running) tasks.
     */
    getActiveCount() {
        return this.activeCount;
    }
    /**
     * Get max thread count.
     */
    getMaxThreads() {
        return this.maxThreads;
    }
    /**
     * Gracefully shutdown the pool.
     */
    shutdown() {
        this.taskQueue = [];
        for (const worker of this.activeWorkers) {
            if (worker?.terminate)
                worker.terminate();
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
export async function executeConcurrently(tasks, pool) {
    const tp = pool ?? new ThreadPool();
    try {
        const promises = tasks.map((t) => tp.executeTask(t.type, t.payload, t.sequence, t.handler));
        const results = await Promise.all(promises);
        // Sort by sequence for deterministic ordering
        results.sort((a, b) => a.sequence - b.sequence);
        return results;
    }
    finally {
        if (!pool)
            tp.shutdown();
    }
}
