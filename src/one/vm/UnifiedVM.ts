/**
 * ONE Language — Phase 3: Unified VM / Runtime
 * ============================================
 * Executes the UnifiedIRProgram produced by Phase 2 IR Lowering.
 *
 * Architecture:
 *   - Stack machine with explicit Call Frames
 *   - Program Counter (PC) stepping through IRInstruction stream
 *   - Operand stack per call frame
 *   - Variable store (locals) per call frame
 *   - Global variable store (top-level scope)
 *   - Function registry (name → entry PC, param descriptors)
 *   - Zero dynamic code evaluation, zero Function constructor, zero host-code escape
 *
 * Safety Guards:
 *   - Division-by-zero / Modulo-by-zero: throws OneVMError (E5001)
 *   - Unknown opcode:                     throws OneVMError (E5002)
 *   - Stack underflow / Type error:       throws OneVMError (E5003)
 *   - Undefined variable:                 throws OneVMError (E5004)
 *   - Undefined function:                 throws OneVMError (E5005)
 *   - Max call depth exceeded (512):      throws OneVMError (E5006)
 *   - Max instructions exceeded (10^6):   throws OneVMError (E5007)
 */

import { UnifiedIRProgram, IRInstruction, IROperand } from '../ir/UnifiedIR';
import { ONE_BUILTIN_FUNCTIONS } from '../stdlib/OneStdLib';
import { DeterministicNumericOps, toI32, toF32, toBool } from '../types/TypedNumeric';

// ─────────────────────────────────────────────────────────────────────────────
// Runtime Types & Errors
// ─────────────────────────────────────────────────────────────────────────────

export interface VMArray extends Array<VMValue> {}
export interface VMRecord {
  [key: string]: VMValue;
}
export type VMValue = number | string | boolean | null | VMArray | VMRecord;

export interface VMRuntimeError {
  code: string;
  message: string;
  pc: number;
}

export class OneVMError extends Error {
  public readonly code: string;
  public readonly pc: number;

  constructor(code: string, message: string, pc: number) {
    super(`[${code}] at PC ${pc}: ${message}`);
    this.name = 'OneVMError';
    this.code = code;
    this.pc = pc;
  }
}

/**
 * Call frame representing an active function activation record.
 */
interface CallFrame {
  /** PC to return to after RETURN */
  returnPC: number;
  /** Variable store for this frame's local bindings */
  locals: Map<string, VMValue>;
  /** Register store for intermediate computations within this frame */
  registers: Map<string, VMValue>;
  /** Operand stack for expression evaluation within this frame */
  operandStack: VMValue[];
  /** Destination register in caller frame to store return value */
  returnDestRegister: string | null;
}

/**
 * Function metadata stored in function registry.
 */
interface FunctionDescriptor {
  name: string;
  entryPC: number;
  paramNames: string[];
  endLabel?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// VM Execution Result
// ─────────────────────────────────────────────────────────────────────────────

export interface VMExecutionResult {
  success: boolean;
  output: string[];
  globals: Record<string, VMValue>;
  error?: VMRuntimeError;
  instructionsExecuted: number;
  executionTimeMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified VM Implementation
// ─────────────────────────────────────────────────────────────────────────────

const MAX_CALL_DEPTH = 512;
const MAX_INSTRUCTIONS = 1_000_000;

export class UnifiedVM {
  // Global variable store (top-level environment)
  private globals: Map<string, VMValue> = new Map();

  // Global register store (top-level registers)
  private globalRegisters: Map<string, VMValue> = new Map();

  // Function registry: function name → descriptor
  private functions: Map<string, FunctionDescriptor> = new Map();

  // Built-in standard library function registry
  private builtins: Map<string, (...args: any[]) => any> = new Map();

  // Label index: label name → instruction PC
  private labels: Map<string, number> = new Map();

  // Call stack holding active activation records
  private callStack: CallFrame[] = [];

  // Loop iteration cursors for for-in loops: instruction index → current array index
  private loopCursors: Map<number, number> = new Map();

  // Standard output captured from PRINT opcodes
  private output: string[] = [];

  // Flat instruction array being interpreted
  private instructions: IRInstruction[] = [];

  // Program counter
  private pc: number = 0;

  // Counter of executed instructions for timeout / infinite loop protection
  private instructionsExecuted: number = 0;

  /**
   * Execute a UnifiedIRProgram from start to finish.
   */
  public execute(
    program: UnifiedIRProgram,
    options?: { spatialBridge?: import('../spatial/SpatialBridge').SpatialBridge }
  ): VMExecutionResult {
    const startMs = performance.now();

    // Reset runtime state
    this.globals = new Map();
    this.globalRegisters = new Map();
    this.functions = new Map();
    this.builtins = new Map();
    for (const [bName, bFn] of Object.entries(ONE_BUILTIN_FUNCTIONS)) {
      this.builtins.set(bName, bFn);
    }
    const { TENSOR_BUILTIN_FUNCTIONS } = require('../jit/JITRuntimeContext');
    for (const [bName, bFn] of Object.entries(TENSOR_BUILTIN_FUNCTIONS)) {
      this.builtins.set(bName, bFn as any);
    }

    // Attach spatial bridge methods to global and builtins
    const bridge = options?.spatialBridge ?? new (require('../spatial/SpatialBridge').SpatialBridge)();
    const spatialObj = bridge.toVMObject();
    this.globals.set('spatial', spatialObj as unknown as VMValue);
    for (const [mName, mFn] of Object.entries(spatialObj)) {
      this.builtins.set(`spatial.${mName}`, mFn as any);
    }

    this.labels = new Map();
    this.callStack = [];
    this.loopCursors = new Map();
    this.output = [];
    this.instructions = program.instructions;
    this.pc = 0;
    this.instructionsExecuted = 0;

    try {
      // Pass 1: Build label index and function registry
      this.buildIndexes();

      // Pass 2: Interpret instruction stream
      this.runLoop();

      const executionTimeMs = performance.now() - startMs;
      return {
        success: true,
        output: [...this.output],
        globals: Object.fromEntries(this.globals),
        instructionsExecuted: this.instructionsExecuted,
        executionTimeMs,
      };
    } catch (err) {
      const executionTimeMs = performance.now() - startMs;
      if (err instanceof OneVMError) {
        return {
          success: false,
          output: [...this.output],
          globals: Object.fromEntries(this.globals),
          error: { code: err.code, message: err.message, pc: err.pc },
          instructionsExecuted: this.instructionsExecuted,
          executionTimeMs,
        };
      }
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        output: [...this.output],
        globals: Object.fromEntries(this.globals),
        error: { code: 'E5000', message: msg, pc: this.pc },
        instructionsExecuted: this.instructionsExecuted,
        executionTimeMs,
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Pass 1: Index Labels and Functions
  // ─────────────────────────────────────────────────────────────────────────

  private buildIndexes(): void {
    for (let i = 0; i < this.instructions.length; i++) {
      const instr = this.instructions[i];

      // CONST with isFunctionHeader
      if (instr.opcode === 'CONST' && instr.metadata?.isFunctionHeader) {
        const name = instr.metadata.name as string;
        const params = (instr.metadata.params as string[]) || [];
        const endLabel = instr.metadata.endLabel as string | undefined;
        this.functions.set(name, {
          name,
          entryPC: i + 1,
          paramNames: params,
          endLabel,
        });
      }

      // CONST with isLabel
      if (
        instr.opcode === 'CONST' &&
        instr.metadata?.isLabel &&
        instr.destination?.kind === 'label'
      ) {
        const labelName = instr.destination.value as string;
        // Target is the instruction immediately following the label marker
        this.labels.set(labelName, i + 1);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Pass 2: Interpretation Loop
  // ─────────────────────────────────────────────────────────────────────────

  private runLoop(): void {
    while (this.pc < this.instructions.length) {
      if (this.instructionsExecuted >= MAX_INSTRUCTIONS) {
        throw new OneVMError(
          'E5007',
          'Max instruction count exceeded (infinite loop guard: 1,000,000 ops)',
          this.pc
        );
      }

      const instr = this.instructions[this.pc];
      this.pc++;
      this.instructionsExecuted++;

      this.dispatch(instr);
    }
  }

  private dispatch(instr: IRInstruction): void {
    switch (instr.opcode) {

      // ── CONST ─────────────────────────────────────────────────────────────
      case 'CONST': {
        // Label marker — no-op during execution (already indexed)
        if (instr.metadata?.isLabel) break;

        // Function header — skip body during top-level linear execution
        if (instr.metadata?.isFunctionHeader) {
          if (instr.metadata.endLabel) {
            this.pc = this.resolveLabel(instr.metadata.endLabel as string, instr);
          } else {
            this.pc = this.findFunctionEnd(this.pc - 1);
          }
          break;
        }

        // Array literal
        if (instr.destination && instr.metadata?.isArrayLiteral) {
          const arr = instr.sources.map((s) => this.loadOperand(s));
          this.setDest(instr.destination, arr);
          break;
        }

        // Object literal
        if (instr.destination && instr.metadata?.isObjectLiteral) {
          const obj: Record<string, VMValue> = {};
          const keys = (instr.metadata.keys as string[]) || [];
          for (let k = 0; k < keys.length; k++) {
            obj[keys[k]] = this.loadOperand(instr.sources[k]);
          }
          this.setDest(instr.destination, obj);
          break;
        }

        // Scalar constant load: CONST dest, [constOperand]
        if (instr.destination && instr.sources.length > 0) {
          const value = this.resolveConstantOperand(instr.sources[0]);
          this.setDest(instr.destination, value);
        }
        break;
      }

      // ── LOAD ──────────────────────────────────────────────────────────────
      case 'LOAD': {
        if (!instr.destination || instr.sources.length === 0) break;

        // For-in loop iterator advance
        if (instr.metadata?.iteratorVar && instr.metadata?.endLabel) {
          const iterVal = this.loadOperand(instr.sources[0]);
          const endTargetPC = this.resolveLabel(instr.metadata.endLabel as string, instr);
          if (Array.isArray(iterVal)) {
            const loopKey = instr.index;
            const currentIdx = this.loopCursors.get(loopKey) ?? 0;
            if (currentIdx >= iterVal.length) {
              this.loopCursors.delete(loopKey);
              this.pc = endTargetPC;
              break;
            }
            this.loopCursors.set(loopKey, currentIdx + 1);
            this.setDest(instr.destination, iterVal[currentIdx]);
            break;
          }
        }

        const src = instr.sources[0];
        const value = this.loadVar(src);
        this.setDest(instr.destination, value);
        break;
      }

      // ── STORE ─────────────────────────────────────────────────────────────
      case 'STORE': {
        if (!instr.destination || instr.sources.length === 0) break;
        const value = this.loadOperand(instr.sources[0]);
        this.storeVar(instr.destination, value);
        break;
      }

      // ── MOVE ──────────────────────────────────────────────────────────────
      case 'MOVE': {
        if (!instr.destination || instr.sources.length === 0) break;
        const value = this.loadOperand(instr.sources[0]);
        this.setDest(instr.destination, value);
        break;
      }

      // ── ADD ───────────────────────────────────────────────────────────────
      case 'ADD': {
        if (!instr.destination || instr.sources.length < 2) break;
        const left = this.loadOperand(instr.sources[0]);
        const right = this.loadOperand(instr.sources[1]);
        if (typeof left === 'string' || typeof right === 'string') {
          this.setDest(instr.destination, String(left) + String(right));
        } else {
          const dt = instr.destination.type?.toLowerCase();
          if (dt === 'i32' || dt === 'int32' || dt === 'int') {
            this.setDest(instr.destination, DeterministicNumericOps.addI32(Number(left) || 0, Number(right) || 0));
          } else if (dt === 'f32' || dt === 'float32' || dt === 'float') {
            this.setDest(instr.destination, DeterministicNumericOps.addF32(Number(left) || 0, Number(right) || 0));
          } else {
            this.setDest(instr.destination, (left as number) + (right as number));
          }
        }
        break;
      }

      // ── SUB ───────────────────────────────────────────────────────────────
      case 'SUB': {
        if (!instr.destination || instr.sources.length < 2) break;
        const left = this.numOperand(instr.sources[0], instr);
        const right = this.numOperand(instr.sources[1], instr);
        const dt = instr.destination.type?.toLowerCase();
        if (dt === 'i32' || dt === 'int32' || dt === 'int') {
          this.setDest(instr.destination, DeterministicNumericOps.subI32(left, right));
        } else if (dt === 'f32' || dt === 'float32' || dt === 'float') {
          this.setDest(instr.destination, DeterministicNumericOps.subF32(left, right));
        } else {
          this.setDest(instr.destination, left - right);
        }
        break;
      }

      // ── MUL ───────────────────────────────────────────────────────────────
      case 'MUL': {
        if (!instr.destination || instr.sources.length < 2) break;
        const left = this.numOperand(instr.sources[0], instr);
        const right = this.numOperand(instr.sources[1], instr);
        const dt = instr.destination.type?.toLowerCase();
        if (dt === 'i32' || dt === 'int32' || dt === 'int') {
          this.setDest(instr.destination, DeterministicNumericOps.mulI32(left, right));
        } else if (dt === 'f32' || dt === 'float32' || dt === 'float') {
          this.setDest(instr.destination, DeterministicNumericOps.mulF32(left, right));
        } else {
          this.setDest(instr.destination, left * right);
        }
        break;
      }

      // ── DIV ───────────────────────────────────────────────────────────────
      case 'DIV': {
        if (!instr.destination || instr.sources.length < 2) break;
        const left = this.numOperand(instr.sources[0], instr);
        const right = this.numOperand(instr.sources[1], instr);
        if (right === 0) {
          throw new OneVMError('E5001', 'Division by zero', this.pc - 1);
        }
        const dt = instr.destination.type?.toLowerCase();
        if (dt === 'i32' || dt === 'int32' || dt === 'int') {
          this.setDest(instr.destination, DeterministicNumericOps.divI32(left, right));
        } else if (dt === 'f32' || dt === 'float32' || dt === 'float') {
          this.setDest(instr.destination, DeterministicNumericOps.divF32(left, right));
        } else {
          this.setDest(instr.destination, left / right);
        }
        break;
      }

      // ── MOD ───────────────────────────────────────────────────────────────
      case 'MOD': {
        if (!instr.destination || instr.sources.length < 2) break;
        const left = this.numOperand(instr.sources[0], instr);
        const right = this.numOperand(instr.sources[1], instr);
        if (right === 0) {
          throw new OneVMError('E5001', 'Modulo by zero', this.pc - 1);
        }
        const dt = instr.destination.type?.toLowerCase();
        if (dt === 'i32' || dt === 'int32' || dt === 'int') {
          this.setDest(instr.destination, DeterministicNumericOps.modI32(left, right));
        } else if (dt === 'f32' || dt === 'float32' || dt === 'float') {
          this.setDest(instr.destination, DeterministicNumericOps.modF32(left, right));
        } else {
          this.setDest(instr.destination, left % right);
        }
        break;
      }

      // ── CMP ───────────────────────────────────────────────────────────────
      case 'CMP': {
        if (!instr.destination) break;
        const operator = instr.metadata?.operator as string | undefined;

        // Unary NOT: CMP dest, [operand] ; operator: '!'
        if (operator === '!' && instr.sources.length >= 1) {
          const val = this.loadOperand(instr.sources[0]);
          this.setDest(instr.destination, !val);
          break;
        }

        if (instr.sources.length < 2 || !operator) break;
        const left = this.loadOperand(instr.sources[0]);
        const right = this.loadOperand(instr.sources[1]);
        let result: boolean;
        switch (operator) {
          case '<':   result = (left as number) <  (right as number); break;
          case '<=':  result = (left as number) <= (right as number); break;
          case '>':   result = (left as number) >  (right as number); break;
          case '>=':  result = (left as number) >= (right as number); break;
          case '==':  result = left === right; break;
          case '!=':  result = left !== right; break;
          case '&&':  result = Boolean(left) && Boolean(right); break;
          case '||':  result = Boolean(left) || Boolean(right); break;
          default:    result = false;
        }
        this.setDest(instr.destination, result);
        break;
      }

      // ── Explicit Comparison Opcodes: EQ, NE, LT, LTE, GT, GTE ─────────────
      case 'EQ':
      case 'NE':
      case 'LT':
      case 'LTE':
      case 'GT':
      case 'GTE': {
        if (!instr.destination || instr.sources.length < 2) break;
        const left = this.loadOperand(instr.sources[0]);
        const right = this.loadOperand(instr.sources[1]);
        let res = false;
        if (instr.opcode === 'EQ') res = left === right;
        else if (instr.opcode === 'NE') res = left !== right;
        else if (instr.opcode === 'LT') res = (left as number) < (right as number);
        else if (instr.opcode === 'LTE') res = (left as number) <= (right as number);
        else if (instr.opcode === 'GT') res = (left as number) > (right as number);
        else if (instr.opcode === 'GTE') res = (left as number) >= (right as number);
        this.setDest(instr.destination, res);
        break;
      }

      // ── JUMP ──────────────────────────────────────────────────────────────
      case 'JUMP': {
        const labelOp = instr.destination;
        if (labelOp?.kind === 'label') {
          this.pc = this.resolveLabel(labelOp.value as string, instr);
        }
        break;
      }

      // ── JUMP_IF ───────────────────────────────────────────────────────────
      case 'JUMP_IF': {
        const conditionMode = instr.metadata?.condition as string | undefined;
        const labelOp = instr.destination;
        if (!labelOp || labelOp.kind !== 'label') break;
        const targetPC = this.resolveLabel(labelOp.value as string, instr);

        if (instr.sources.length === 0) break;
        const condValue = this.loadOperand(instr.sources[0]);
        const condBool = Boolean(condValue);

        if (conditionMode === 'false') {
          if (!condBool) {
            this.pc = targetPC;
          }
        } else {
          if (condBool) {
            this.pc = targetPC;
          }
        }
        break;
      }

      // ── JUMP_IF_FALSE ─────────────────────────────────────────────────────
      case 'JUMP_IF_FALSE': {
        const labelOp = instr.destination;
        if (!labelOp || labelOp.kind !== 'label') break;
        const targetPC = this.resolveLabel(labelOp.value as string, instr);
        if (instr.sources.length === 0) break;
        const condValue = this.loadOperand(instr.sources[0]);
        if (!Boolean(condValue)) {
          this.pc = targetPC;
        }
        break;
      }

      // ── PRINT ─────────────────────────────────────────────────────────────
      case 'PRINT': {
        if (instr.sources.length === 0) break;
        const value = this.loadOperand(instr.sources[0]);
        const str = this.formatValue(value);
        this.output.push(str);
        break;
      }

      // ── CALL ──────────────────────────────────────────────────────────────
      case 'CALL': {
        if (!instr.destination || instr.sources.length === 0) break;

        if (this.callStack.length >= MAX_CALL_DEPTH) {
          throw new OneVMError('E5006', 'Maximum call depth exceeded (stack overflow: 512 frames)', this.pc - 1);
        }

        const calleeOperand = instr.sources[0];
        const calleeName = calleeOperand.value as string;
        const fnDesc = this.functions.get(calleeName);

        if (!fnDesc) {
          if (this.builtins.has(calleeName)) {
            const builtinFn = this.builtins.get(calleeName)!;
            const argValues: VMValue[] = [];
            const startIdx = instr.metadata?.isMethodCall ? 2 : 1;
            for (let i = startIdx; i < instr.sources.length; i++) {
              argValues.push(this.loadOperand(instr.sources[i]));
            }
            const res = builtinFn(...argValues);
            this.setDest(instr.destination, res !== undefined ? res : null);
            break;
          }

          // Dotted method call fallback: Math.sqrt -> sqrt, spatial.get -> get
          if (calleeName.includes('.')) {
            const parts = calleeName.split('.');
            const shortName = parts[1];
            if (this.builtins.has(shortName)) {
              const builtinFn = this.builtins.get(shortName)!;
              const argValues: VMValue[] = [];
              const startIdx = instr.metadata?.isMethodCall ? 2 : 1;
              for (let i = startIdx; i < instr.sources.length; i++) {
                argValues.push(this.loadOperand(instr.sources[i]));
              }
              const res = builtinFn(...argValues);
              this.setDest(instr.destination, res !== undefined ? res : null);
              break;
            }
          }

          throw new OneVMError('E5005', `Undefined function '${calleeName}'`, this.pc - 1);
        }

        // Resolve argument values from current frame
        const argValues: VMValue[] = [];
        for (let i = 1; i < instr.sources.length; i++) {
          argValues.push(this.loadOperand(instr.sources[i]));
        }

        // Push new activation record
        const newFrame: CallFrame = {
          returnPC: this.pc,
          locals: new Map(),
          registers: new Map(),
          operandStack: [],
          returnDestRegister: instr.destination.kind === 'register'
            ? String(instr.destination.value)
            : null,
        };

        // Bind parameters into new activation record
        for (let i = 0; i < fnDesc.paramNames.length; i++) {
          newFrame.locals.set(fnDesc.paramNames[i], argValues[i] ?? null);
        }

        this.callStack.push(newFrame);

        // Jump to function entry instruction
        this.pc = fnDesc.entryPC;
        break;
      }

      // ── RETURN ────────────────────────────────────────────────────────────
      case 'RETURN': {
        let returnValue: VMValue = null;
        if (instr.sources.length > 0) {
          returnValue = this.loadOperand(instr.sources[0]);
        }

        if (this.callStack.length === 0) {
          // Top-level return terminates program execution
          this.pc = this.instructions.length;
          break;
        }

        const frame = this.callStack.pop()!;
        this.pc = frame.returnPC;

        // Propagate return value to caller's destination register
        if (frame.returnDestRegister !== null) {
          if (this.callStack.length === 0) {
            this.globalRegisters.set(frame.returnDestRegister, returnValue);
          } else {
            const callerFrame = this.callStack[this.callStack.length - 1];
            callerFrame.registers.set(frame.returnDestRegister, returnValue);
          }
        }
        break;
      }

      // ── SPATIAL_OP ────────────────────────────────────────────────────────
      case 'SPATIAL_OP': {
        // Preserved declarative spatial instruction: no-op in computational interpreter
        break;
      }

      // ── FIELD_GET ─────────────────────────────────────────────────────────
      case 'FIELD_GET': {
        if (!instr.destination || instr.sources.length === 0) break;
        const obj = this.loadOperand(instr.sources[0]);
        const field = (instr.metadata?.field as string) || '';
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          const rec = obj as Record<string, VMValue>;
          if (!(field in rec)) {
            throw new OneVMError('E5008', `Field '${field}' not found on object`, this.pc - 1);
          }
          this.setDest(instr.destination, rec[field]);
          break;
        }
        if (Array.isArray(obj) && field === 'length') {
          this.setDest(instr.destination, obj.length);
          break;
        }
        if (typeof obj === 'string' && field === 'length') {
          this.setDest(instr.destination, obj.length);
          break;
        }
        throw new OneVMError('E5003', `Cannot read property '${field}' of non-object`, this.pc - 1);
      }

      // ── FIELD_SET ─────────────────────────────────────────────────────────
      case 'FIELD_SET': {
        if (instr.sources.length < 2) break;
        const obj = this.loadOperand(instr.sources[0]);
        const val = this.loadOperand(instr.sources[1]);
        const field = (instr.metadata?.field as string) || '';
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          (obj as Record<string, VMValue>)[field] = val;
          break;
        }
        throw new OneVMError('E5003', `Cannot set property '${field}' on non-object`, this.pc - 1);
      }

      // ── INDEX_GET ─────────────────────────────────────────────────────────
      case 'INDEX_GET': {
        if (!instr.destination || instr.sources.length < 2) break;
        const target = this.loadOperand(instr.sources[0]);
        const idxVal = this.loadOperand(instr.sources[1]);
        const idx = Number(idxVal);
        if (Array.isArray(target)) {
          if (!Number.isInteger(idx) || idx < 0 || idx >= target.length) {
            throw new OneVMError('E5009', `Array index ${idx} out of bounds [0..${target.length - 1}]`, this.pc - 1);
          }
          this.setDest(instr.destination, target[idx]);
          break;
        }
        if (typeof target === 'string') {
          if (!Number.isInteger(idx) || idx < 0 || idx >= target.length) {
            throw new OneVMError('E5009', `String index ${idx} out of bounds [0..${target.length - 1}]`, this.pc - 1);
          }
          this.setDest(instr.destination, target.charAt(idx));
          break;
        }
        throw new OneVMError('E5003', `Cannot index non-indexable value`, this.pc - 1);
      }

      // ── INDEX_SET ─────────────────────────────────────────────────────────
      case 'INDEX_SET': {
        if (instr.sources.length < 3) break;
        const target = this.loadOperand(instr.sources[0]);
        const idxVal = this.loadOperand(instr.sources[1]);
        const val = this.loadOperand(instr.sources[2]);
        const idx = Number(idxVal);
        if (Array.isArray(target)) {
          if (!Number.isInteger(idx) || idx < 0 || idx >= target.length) {
            throw new OneVMError('E5009', `Array index ${idx} out of bounds [0..${target.length - 1}]`, this.pc - 1);
          }
          target[idx] = val;
          break;
        }
        throw new OneVMError('E5003', `Cannot index-assign into non-array value`, this.pc - 1);
      }

      default: {
        throw new OneVMError(
          'E5002',
          `Unknown opcode '${(instr as IRInstruction).opcode}'`,
          this.pc - 1
        );
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Variable Access & Storage
  // ─────────────────────────────────────────────────────────────────────────

  private loadVar(op: IROperand): VMValue {
    const name = op.value as string;
    if (this.callStack.length > 0) {
      const frame = this.callStack[this.callStack.length - 1];
      if (frame.locals.has(name)) return frame.locals.get(name)!;
    }
    if (this.globals.has(name)) return this.globals.get(name)!;
    throw new OneVMError('E5004', `Undefined variable '${name}'`, this.pc - 1);
  }

  private storeVar(dest: IROperand, value: VMValue): void {
    const name = dest.value as string;
    let typedVal = value;
    if (dest.type) {
      const t = dest.type.toLowerCase();
      if (t === 'i32' || t === 'int32' || t === 'int') {
        typedVal = toI32(value);
      } else if (t === 'f32' || t === 'float32' || t === 'float') {
        typedVal = toF32(value);
      } else if (t === 'bool' || t === 'boolean') {
        typedVal = toBool(value);
      }
    }
    if (this.callStack.length > 0) {
      const frame = this.callStack[this.callStack.length - 1];
      if (frame.locals.has(name) || !this.globals.has(name)) {
        frame.locals.set(name, typedVal);
      } else {
        this.globals.set(name, typedVal);
      }
    } else {
      this.globals.set(name, typedVal);
    }
  }

  private loadOperand(op: IROperand): VMValue {
    switch (op.kind) {
      case 'constant':
        return op.value as VMValue;

      case 'register': {
        const regName = op.value as string;
        if (this.callStack.length > 0) {
          const frame = this.callStack[this.callStack.length - 1];
          if (frame.registers.has(regName)) return frame.registers.get(regName)!;
        }
        if (this.globalRegisters.has(regName)) return this.globalRegisters.get(regName)!;
        throw new OneVMError('E5004', `Undefined register '${regName}'`, this.pc - 1);
      }

      case 'variable':
        return this.loadVar(op);

      case 'label':
        return 0;

      default:
        return null;
    }
  }

  private resolveConstantOperand(op: IROperand): VMValue {
    if (op.kind === 'constant') return op.value as VMValue;
    return this.loadOperand(op);
  }

  private setDest(dest: IROperand, value: VMValue): void {
    const name = dest.value as string;
    if (dest.kind === 'register') {
      if (this.callStack.length > 0) {
        const frame = this.callStack[this.callStack.length - 1];
        frame.registers.set(name, value);
      } else {
        this.globalRegisters.set(name, value);
      }
    } else if (dest.kind === 'variable') {
      this.storeVar(dest, value);
    }
  }

  private numOperand(op: IROperand, instr: IRInstruction): number {
    const val = this.loadOperand(op);
    if (typeof val !== 'number') {
      throw new OneVMError(
        'E5003',
        `Expected numeric operand for arithmetic opcode but got ${typeof val} (value: ${val})`,
        this.pc - 1
      );
    }
    return val;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Resolution Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private resolveLabel(labelName: string, instr: IRInstruction): number {
    const targetPC = this.labels.get(labelName);
    if (targetPC === undefined) {
      throw new OneVMError('E5002', `Undefined label '${labelName}'`, this.pc - 1);
    }
    return targetPC;
  }

  private findFunctionEnd(headerPC: number): number {
    let depth = 0;
    for (let i = headerPC; i < this.instructions.length; i++) {
      const op = this.instructions[i].opcode;
      if (op === 'CONST' && this.instructions[i].metadata?.isFunctionHeader) {
        depth++;
      }
      if (op === 'RETURN') {
        depth--;
        if (depth === 0) {
          return i + 1;
        }
      }
    }
    return this.instructions.length;
  }

  private formatValue(value: VMValue): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return '[' + value.map((v) => this.formatValue(v)).join(', ') + ']';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public Diagnostic & Inspection API
  // ─────────────────────────────────────────────────────────────────────────

  public getGlobals(): ReadonlyMap<string, VMValue> {
    return this.globals;
  }

  public getCallDepth(): number {
    return this.callStack.length;
  }

  public getFunctionRegistry(): ReadonlyMap<string, FunctionDescriptor> {
    return this.functions;
  }

  public getLabelIndex(): ReadonlyMap<string, number> {
    return this.labels;
  }
}
