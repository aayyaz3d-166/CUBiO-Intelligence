/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/VIGLockManager
 * Specification: VIG Phase 6 Security & Recovery Hardening
 *
 * Single-writer / multiple-reader concurrency management, deterministic
 * conflict handling, atomic lock acquisition, and stale lock reclamation.
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { VIGConflictError, VIGLockError } from './types';
export class VIGLockManager {
    static DEFAULT_LOCK_FILENAME = '.lock';
    static DEFAULT_TTL_MS = 30000;
    /** Track active in-process readers */
    static activeReadersCount = 0;
    static get activeReaders() {
        return this.activeReadersCount;
    }
    /**
     * Tracks entering a read operation (for multiple-reader telemetry).
     */
    static enterRead() {
        this.activeReadersCount++;
        let exited = false;
        return () => {
            if (!exited) {
                exited = true;
                this.activeReadersCount = Math.max(0, this.activeReadersCount - 1);
            }
        };
    }
    /**
     * Determines whether an OS process ID is currently alive.
     */
    static isProcessAlive(pid) {
        if (typeof pid !== 'number' || pid <= 0)
            return false;
        try {
            process.kill(pid, 0);
            return true;
        }
        catch (err) {
            // EPERM means process exists but we lack permission to signal it
            return err.code === 'EPERM';
        }
    }
    /**
     * Reads and parses existing lock data if present.
     * Returns null if no lock exists or if lock is unreadable.
     */
    static inspectLock(lockPath) {
        if (!fs.existsSync(lockPath))
            return null;
        try {
            const raw = fs.readFileSync(lockPath, 'utf8');
            const data = JSON.parse(raw);
            if (data &&
                typeof data.lockId === 'string' &&
                typeof data.pid === 'number' &&
                typeof data.acquiredAt === 'number' &&
                typeof data.expiresAt === 'number') {
                return data;
            }
            return null;
        }
        catch {
            return null;
        }
    }
    /**
     * Acquires the exclusive write lock for a directory.
     * - Atomically creates .lock file with 'wx' flag.
     * - Detects stale locks (dead PID or expired TTL) and reclaims them safely.
     * - Rejects competing active writers with VIGConflictError.
     */
    static acquireWriteLock(lockDir, agentId, options = {}) {
        const ttlMs = options.ttlMs ?? this.DEFAULT_TTL_MS;
        const timeoutMs = options.timeoutMs ?? 0;
        const pollIntervalMs = options.pollIntervalMs ?? 50;
        const startTime = Date.now();
        if (!fs.existsSync(lockDir)) {
            fs.mkdirSync(lockDir, { recursive: true });
        }
        const lockPath = path.join(lockDir, this.DEFAULT_LOCK_FILENAME);
        const lockId = crypto.randomBytes(16).toString('hex');
        while (true) {
            // 1. Inspect existing lock
            const existing = this.inspectLock(lockPath);
            if (existing) {
                const now = Date.now();
                const isExpired = now >= existing.expiresAt;
                const isDeadProcess = !this.isProcessAlive(existing.pid);
                if (isExpired || isDeadProcess) {
                    // Stale lock detected -> reclaim it
                    try {
                        fs.unlinkSync(lockPath);
                    }
                    catch {
                        // Unlink race handled below
                    }
                }
                else {
                    // Lock is actively held by a live process
                    if (Date.now() - startTime >= timeoutMs) {
                        throw new VIGConflictError(`Write lock conflict: lock is currently held by PID ${existing.pid} (agent "${existing.agentId}"). Competing writer rejected.`);
                    }
                    // Sleep and retry until timeoutMs
                    try {
                        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, pollIntervalMs);
                    }
                    catch {
                        const pauseEnd = Date.now() + pollIntervalMs;
                        while (Date.now() < pauseEnd) {
                            /* busy wait */
                        }
                    }
                    continue;
                }
            }
            // 2. Attempt atomic exclusive file creation ('wx' flag)
            const acquiredAt = Date.now();
            const expiresAt = acquiredAt + ttlMs;
            const lockData = {
                lockId,
                pid: process.pid,
                agentId,
                acquiredAt,
                expiresAt,
            };
            try {
                const fd = fs.openSync(lockPath, 'wx');
                try {
                    fs.writeFileSync(fd, JSON.stringify(lockData, null, 2), 'utf8');
                    fs.fsyncSync(fd);
                }
                finally {
                    fs.closeSync(fd);
                }
                let released = false;
                const release = () => {
                    if (released)
                        return;
                    released = true;
                    try {
                        const current = this.inspectLock(lockPath);
                        if (current && current.lockId === lockId) {
                            fs.unlinkSync(lockPath);
                        }
                    }
                    catch {
                        // Ignore unlink errors during release
                    }
                };
                return {
                    lockId,
                    lockPath,
                    acquiredAt,
                    expiresAt,
                    release,
                };
            }
            catch (err) {
                if (err.code === 'EEXIST') {
                    // Another process acquired the lock concurrently in the race window
                    if (Date.now() - startTime >= timeoutMs) {
                        throw new VIGConflictError(`Write lock conflict: lock acquired by concurrent competing writer. Competing write rejected.`);
                    }
                    continue;
                }
                throw new VIGLockError(`Failed to acquire write lock at "${lockPath}": ${err.message}`);
            }
        }
    }
    /**
     * Executes a mutating action under the protection of an exclusive write lock.
     */
    static async executeWithWriteLock(lockDir, agentId, action, options = {}) {
        const lock = this.acquireWriteLock(lockDir, agentId, options);
        try {
            return await action();
        }
        finally {
            lock.release();
        }
    }
}
