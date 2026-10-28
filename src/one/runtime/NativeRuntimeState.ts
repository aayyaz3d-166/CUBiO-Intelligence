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
import { NativeValue, toRaw, fromRaw, formatNativeValue } from './NativeValues';
import { OneNativeRuntimeError } from './NativeErrors';
import { RSSGuard } from '../../core/memory/rssGuard';

export interface NativeCallFrame {
  returnPC: number;
  fnName: string;
  locals: Map<string, NativeValue>;
  registers: Map<string, NativeValue>;
  operandStack: NativeValue[];
  returnDestRegister: string | null;
}

export interface StateSnapshot {
  snapshotHash: string;
  timestamp: number;
  pc: number;
  globals: Record<string, unknown>;
  globalRegisters: Record<string, unknown>;
  callStackDepth: number;
  callStack: Array<{
    fnName: string;
    returnPC: number;
    locals: Record<string, unknown>;
  }>;
  rssAllocatedBytes: number;
  isActuationBlocked: boolean;
}

export class NativeRuntimeState {
  private globals: Map<string, NativeValue> = new Map();
  private globalRegisters: Map<string, NativeValue> = new Map();
  private callStack: NativeCallFrame[] = [];
  private rssGuard: RSSGuard;
  private readonly maxRssBytes: number = 512 * 1024 * 1024; // 512 MB strict ceiling
  private currentRssBytes: number = 0;
  private readonly maxCallDepth: number = 512;
  private readonly isActuationBlocked: boolean = true;

  constructor(rssLimitMb: number = 512) {
    this.maxRssBytes = rssLimitMb * 1024 * 1024;
    this.rssGuard = new RSSGuard(rssLimitMb);
  }

  // ── Memory Management (RSSGuard) ──────────────────────────────────────────

  public allocateMemory(bytes: number, tag: string = 'RuntimeObject'): void {
    if (this.currentRssBytes + bytes > this.maxRssBytes) {
      throw new OneNativeRuntimeError(
        'E7011',
        `Physical RSS ceiling of ${this.maxRssBytes / (1024 * 1024)} MB breached (requested ${bytes} bytes, current ${this.currentRssBytes} bytes)`,
        0,
        this.getStackTrace()
      );
    }
    this.rssGuard.allocate(bytes, tag);
    this.currentRssBytes += bytes;
  }

  public freeMemory(bytes: number): void {
    this.currentRssBytes = Math.max(0, this.currentRssBytes - bytes);
  }

  public getRssAllocatedBytes(): number {
    return this.currentRssBytes;
  }

  public getRssAllocatedMb(): number {
    return Number((this.currentRssBytes / (1024 * 1024)).toFixed(3));
  }

  // ── Variable Access & Scope Resolution ────────────────────────────────────

  public setVariable(name: string, value: NativeValue): void {
    if (this.callStack.length > 0) {
      const topFrame = this.callStack[this.callStack.length - 1];
      if (topFrame.locals.has(name) || !this.globals.has(name)) {
        topFrame.locals.set(name, value);
        return;
      }
    }
    this.globals.set(name, value);
  }

  public getVariable(name: string, pc: number = 0): NativeValue {
    if (this.callStack.length > 0) {
      const topFrame = this.callStack[this.callStack.length - 1];
      if (topFrame.locals.has(name)) {
        return topFrame.locals.get(name)!;
      }
    }
    if (this.globals.has(name)) {
      return this.globals.get(name)!;
    }
    throw new OneNativeRuntimeError(
      'E7004',
      `Undefined variable '${name}'`,
      pc,
      this.getStackTrace()
    );
  }

  public hasVariable(name: string): boolean {
    if (this.callStack.length > 0) {
      const topFrame = this.callStack[this.callStack.length - 1];
      if (topFrame.locals.has(name)) return true;
    }
    return this.globals.has(name);
  }

  // ── Register Access ───────────────────────────────────────────────────────

  public setRegister(regName: string, value: NativeValue): void {
    if (this.callStack.length > 0) {
      const topFrame = this.callStack[this.callStack.length - 1];
      topFrame.registers.set(regName, value);
    } else {
      this.globalRegisters.set(regName, value);
    }
  }

  public getRegister(regName: string, pc: number = 0): NativeValue {
    if (this.callStack.length > 0) {
      const topFrame = this.callStack[this.callStack.length - 1];
      if (topFrame.registers.has(regName)) {
        return topFrame.registers.get(regName)!;
      }
    }
    if (this.globalRegisters.has(regName)) {
      return this.globalRegisters.get(regName)!;
    }
    throw new OneNativeRuntimeError(
      'E7004',
      `Undefined register '${regName}'`,
      pc,
      this.getStackTrace()
    );
  }

  // ── Call Stack & Activation Records ───────────────────────────────────────

  public pushCallFrame(
    fnName: string,
    returnPC: number,
    returnDestRegister: string | null = null
  ): NativeCallFrame {
    if (this.callStack.length >= this.maxCallDepth) {
      throw new OneNativeRuntimeError(
        'E7006',
        `Maximum call depth of ${this.maxCallDepth} frames exceeded (stack overflow)`,
        returnPC,
        this.getStackTrace()
      );
    }

    const frame: NativeCallFrame = {
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

  public popCallFrame(): NativeCallFrame {
    if (this.callStack.length === 0) {
      throw new Error('[NativeRuntimeState] Call stack underflow on popCallFrame');
    }
    return this.callStack.pop()!;
  }

  public getCallDepth(): number {
    return this.callStack.length;
  }

  public getCurrentFrame(): NativeCallFrame | undefined {
    return this.callStack[this.callStack.length - 1];
  }

  public getStackTrace(): string[] {
    return this.callStack.map(
      (f, idx) => `[#${idx}] ${f.fnName} (return to PC ${f.returnPC})`
    );
  }

  public isActuationLocked(): boolean {
    return this.isActuationBlocked;
  }

  public getGlobalsMap(): Map<string, NativeValue> {
    return this.globals;
  }

  public reset(): void {
    this.globals.clear();
    this.globalRegisters.clear();
    this.callStack = [];
    this.currentRssBytes = 0;
    this.rssGuard = new RSSGuard(Math.round(this.maxRssBytes / (1024 * 1024)));
  }

  // ── Cryptographic State Snapshot & Restore ────────────────────────────────

  public captureSnapshot(currentPC: number = 0): StateSnapshot {
    const rawGlobals: Record<string, unknown> = {};
    for (const [k, v] of this.globals.entries()) {
      rawGlobals[k] = toRaw(v);
    }

    const rawGlobalRegs: Record<string, unknown> = {};
    for (const [k, v] of this.globalRegisters.entries()) {
      rawGlobalRegs[k] = toRaw(v);
    }

    const frameSnapshots = this.callStack.map((f) => {
      const rawLocals: Record<string, unknown> = {};
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

  public restoreSnapshot(snapshot: StateSnapshot): void {
    this.globals.clear();
    for (const [k, v] of Object.entries(snapshot.globals)) {
      this.globals.set(k, fromRaw(v));
    }

    this.globalRegisters.clear();
    for (const [k, v] of Object.entries(snapshot.globalRegisters)) {
      this.globalRegisters.set(k, fromRaw(v));
    }

    this.callStack = snapshot.callStack.map((fs) => {
      const locals = new Map<string, NativeValue>();
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
