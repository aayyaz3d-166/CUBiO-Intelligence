/**
 * ONE Language — Native Runtime State
 * ===================================
 * Module: @one/runtime/NativeRuntimeState
 *
 * Encapsulates total execution state: activation call frames, registers,
 * global variables, operand stacks, RSS physical memory tracking, and
 * bit-exact cryptographic state snapshot/restore.
 *
 * Invariants:
 *   - Physical RSS bounded strictly under 512 MB
 *   - Call stack depth capped at 512 frames
 *   - Bit-exact state serialization with SHA-256 state hashing
 */
import * as crypto from 'crypto';
import { toRaw, fromRaw } from './NativeValues';
import { OneNativeRuntimeError } from './NativeErrors';
import { RSSGuard } from '../../core/memory/rssGuard';
export class NativeRuntimeState {
    globals = new Map();
    globalRegisters = new Map();
    callStack = [];
    rssGuard;
    maxRssBytes = 512 * 1024 * 1024; // 512 MB strict ceiling
    currentRssBytes = 0;
    maxCallDepth = 512;
    isActuationBlocked = true;
    constructor(rssLimitMb = 512) {
        this.maxRssBytes = rssLimitMb * 1024 * 1024;
        this.rssGuard = new RSSGuard(rssLimitMb);
    }
    // ── Memory Management (RSSGuard) ──────────────────────────────────────────
    allocateMemory(bytes, tag = 'RuntimeObject') {
        if (this.currentRssBytes + bytes > this.maxRssBytes) {
            throw new OneNativeRuntimeError('E7011', `Physical RSS ceiling of ${this.maxRssBytes / (1024 * 1024)} MB breached (requested ${bytes} bytes, current ${this.currentRssBytes} bytes)`, 0, this.getStackTrace());
        }
        this.rssGuard.allocate(bytes, tag);
        this.currentRssBytes += bytes;
    }
    freeMemory(bytes) {
        this.currentRssBytes = Math.max(0, this.currentRssBytes - bytes);
    }
    getRssAllocatedBytes() {
        return this.currentRssBytes;
    }
    getRssAllocatedMb() {
        return Number((this.currentRssBytes / (1024 * 1024)).toFixed(3));
    }
    // ── Variable Access & Scope Resolution ────────────────────────────────────
    setVariable(name, value) {
        if (this.callStack.length > 0) {
            const topFrame = this.callStack[this.callStack.length - 1];
            if (topFrame.locals.has(name) || !this.globals.has(name)) {
                topFrame.locals.set(name, value);
                return;
            }
        }
        this.globals.set(name, value);
    }
    getVariable(name, pc = 0) {
        if (this.callStack.length > 0) {
            const topFrame = this.callStack[this.callStack.length - 1];
            if (topFrame.locals.has(name)) {
                return topFrame.locals.get(name);
            }
        }
        if (this.globals.has(name)) {
            return this.globals.get(name);
        }
        throw new OneNativeRuntimeError('E7004', `Undefined variable '${name}'`, pc, this.getStackTrace());
    }
    hasVariable(name) {
        if (this.callStack.length > 0) {
            const topFrame = this.callStack[this.callStack.length - 1];
            if (topFrame.locals.has(name))
                return true;
        }
        return this.globals.has(name);
    }
    // ── Register Access ───────────────────────────────────────────────────────
    setRegister(regName, value) {
        if (this.callStack.length > 0) {
            const topFrame = this.callStack[this.callStack.length - 1];
            topFrame.registers.set(regName, value);
        }
        else {
            this.globalRegisters.set(regName, value);
        }
    }
    getRegister(regName, pc = 0) {
        if (this.callStack.length > 0) {
            const topFrame = this.callStack[this.callStack.length - 1];
            if (topFrame.registers.has(regName)) {
                return topFrame.registers.get(regName);
            }
        }
        if (this.globalRegisters.has(regName)) {
            return this.globalRegisters.get(regName);
        }
        throw new OneNativeRuntimeError('E7004', `Undefined register '${regName}'`, pc, this.getStackTrace());
    }
    // ── Call Stack & Activation Records ───────────────────────────────────────
    pushCallFrame(fnName, returnPC, returnDestRegister = null) {
        if (this.callStack.length >= this.maxCallDepth) {
            throw new OneNativeRuntimeError('E7006', `Maximum call depth of ${this.maxCallDepth} frames exceeded (stack overflow)`, returnPC, this.getStackTrace());
        }
        const frame = {
            returnPC,
            fnName,
            locals: new Map(),
            registers: new Map(),
            operandStack: [],
            returnDestRegister,
        };
        this.callStack.push(frame);
        return frame;
    }
    popCallFrame() {
        if (this.callStack.length === 0) {
            throw new Error('[NativeRuntimeState] Call stack underflow on popCallFrame');
        }
        return this.callStack.pop();
    }
    getCallDepth() {
        return this.callStack.length;
    }
    getCurrentFrame() {
        return this.callStack[this.callStack.length - 1];
    }
    getStackTrace() {
        return this.callStack.map((f, idx) => `[#${idx}] ${f.fnName} (return to PC ${f.returnPC})`);
    }
    isActuationLocked() {
        return this.isActuationBlocked;
    }
    getGlobalsMap() {
        return this.globals;
    }
    reset() {
        this.globals.clear();
        this.globalRegisters.clear();
        this.callStack = [];
        this.currentRssBytes = 0;
        this.rssGuard = new RSSGuard(Math.round(this.maxRssBytes / (1024 * 1024)));
    }
    // ── Cryptographic State Snapshot & Restore ────────────────────────────────
    captureSnapshot(currentPC = 0) {
        const rawGlobals = {};
        for (const [k, v] of this.globals.entries()) {
            rawGlobals[k] = toRaw(v);
        }
        const rawGlobalRegs = {};
        for (const [k, v] of this.globalRegisters.entries()) {
            rawGlobalRegs[k] = toRaw(v);
        }
        const frameSnapshots = this.callStack.map((f) => {
            const rawLocals = {};
            for (const [k, v] of f.locals.entries()) {
                rawLocals[k] = toRaw(v);
            }
            return {
                fnName: f.fnName,
                returnPC: f.returnPC,
                locals: rawLocals,
            };
        });
        const canonicalRepresentation = JSON.stringify({
            pc: currentPC,
            globals: rawGlobals,
            globalRegisters: rawGlobalRegs,
            callStackDepth: this.callStack.length,
            callStack: frameSnapshots,
            rssAllocatedBytes: this.currentRssBytes,
            isActuationBlocked: this.isActuationBlocked,
        });
        const snapshotHash = crypto
            .createHash('sha256')
            .update(canonicalRepresentation)
            .digest('hex');
        return {
            snapshotHash: `0xSTATE_${snapshotHash.substring(0, 16).toUpperCase()}`,
            timestamp: Date.now(),
            pc: currentPC,
            globals: rawGlobals,
            globalRegisters: rawGlobalRegs,
            callStackDepth: this.callStack.length,
            callStack: frameSnapshots,
            rssAllocatedBytes: this.currentRssBytes,
            isActuationBlocked: this.isActuationBlocked,
        };
    }
    restoreSnapshot(snapshot) {
        this.globals.clear();
        for (const [k, v] of Object.entries(snapshot.globals)) {
            this.globals.set(k, fromRaw(v));
        }
        this.globalRegisters.clear();
        for (const [k, v] of Object.entries(snapshot.globalRegisters)) {
            this.globalRegisters.set(k, fromRaw(v));
        }
        this.callStack = snapshot.callStack.map((fs) => {
            const locals = new Map();
            for (const [k, v] of Object.entries(fs.locals)) {
                locals.set(k, fromRaw(v));
            }
            return {
                fnName: fs.fnName,
                returnPC: fs.returnPC,
                locals,
                registers: new Map(),
                operandStack: [],
                returnDestRegister: null,
            };
        });
        this.currentRssBytes = snapshot.rssAllocatedBytes;
    }
}
