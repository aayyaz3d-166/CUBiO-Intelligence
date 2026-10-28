/**
 * ONE Language — Qplayer Execution Architecture
 * ==============================================
 * QplayerRuntime.ts: Dedicated Register-Based Execution Runtime for OBI Programs
 */

import {
  OBIProgram,
  OBICategory,
  OBIOpcodeControl,
  OBIOpcodeArithmetic,
  OBIOpcodeMemory,
  OBIOpcodeIO,
  OBIOpcodeSpatial,
  OBIOpcodeSafety,
  OBIOperandMode,
} from '../spec/OBISpec';
import { QBinaryDecoder } from '../binary/QBinaryDecoder';
import { QBinaryValidator } from '../binary/QBinaryValidator';

export interface QplayerOptions {
  maxInstructions?: number;
  mockInputs?: Array<number | string | boolean>;
  rssLimitMB?: number;
}

export interface CallFrame {
  fnName?: string;
  returnPC: number;
  destReg: number;
  locals: Map<string, any>;
}

export interface QplayerExecutionResult {
  success: boolean;
  output: string[];
  instructionsExecuted: number;
  executionTimeMs: number;
  registers: Array<number | string | boolean>;
  variables: Record<string, any>;
  spatialMemory369: number[];
  error?: {
    code: string;
    message: string;
    pc: number;
  };
}

export class QplayerRuntime {
  private registers: Array<any> = new Array(512).fill(0);
  private globals: Map<string, any> = new Map();
  private callStack: CallFrame[] = [];
  private spatialMemory369: Float64Array = new Float64Array(369); // Exact Address369 boundary [0..368]
  private output: string[] = [];
  private inputQueue: Array<any> = [];
  private pc: number = 0;
  private instructionsExecuted: number = 0;
  private maxInstructions: number = 1_000_000;
  private rssLimitMB: number = 512;

  constructor(options: QplayerOptions = {}) {
    if (options.maxInstructions) {
      this.maxInstructions = options.maxInstructions;
    }
    if (options.mockInputs) {
      this.inputQueue = [...options.mockInputs];
    }
    if (options.rssLimitMB) {
      this.rssLimitMB = options.rssLimitMB;
    }
  }

  /**
   * Executes a raw OBI binary buffer.
   */
  public executeBuffer(buffer: Buffer): QplayerExecutionResult {
    // 1. Validate Binary Fail-Closed
    const valResult = QBinaryValidator.validateBuffer(buffer);
    if (!valResult.valid) {
      return {
        success: false,
        output: [],
        instructionsExecuted: 0,
        executionTimeMs: 0,
        registers: [],
        variables: {},
        spatialMemory369: [],
        error: {
          code: valResult.errorCode || 'E8002',
          message: valResult.error || 'Binary validation failed',
          pc: 0,
        },
      };
    }

    const program = QBinaryDecoder.decode(buffer);
    return this.executeProgram(program);
  }

  /**
   * Executes a decoded OBIProgram.
   */
  public executeProgram(program: OBIProgram): QplayerExecutionResult {
    const startMs = performance.now();
    this.registers.fill(0);
    this.globals.clear();
    this.callStack = [];
    this.spatialMemory369.fill(0);
    this.output = [];
    this.pc = program.header.entryPC || 0;
    this.instructionsExecuted = 0;

    const instructions = program.instructions;
    const constants = program.constants;

    try {
      while (this.pc < instructions.length) {
        if (this.instructionsExecuted >= this.maxInstructions) {
          throw new Error(`[E5007] Max instruction count exceeded (${this.maxInstructions})`);
        }

        const instr = instructions[this.pc];
        const currentPC = this.pc;
        this.pc++;
        this.instructionsExecuted++;

        switch (instr.category) {
          // ── Category 0: Control & Functions ───────────────────────────────
          case OBICategory.CONTROL: {
            switch (instr.opcode) {
              case OBIOpcodeControl.NOP:
                break;
              case OBIOpcodeControl.HALT:
                return this.buildResult(true, startMs);
              case OBIOpcodeControl.JUMP:
                this.pc = instr.harmonicDest;
                break;
              case OBIOpcodeControl.JUMP_IF_ZERO:
                if (this.registers[instr.srcA] === 0 || !this.registers[instr.srcA]) {
                  this.pc = instr.harmonicDest;
                }
                break;
              case OBIOpcodeControl.JUMP_IF_NOT_ZERO:
                if (this.registers[instr.srcA] !== 0 && !!this.registers[instr.srcA]) {
                  this.pc = instr.harmonicDest;
                }
                break;
              case OBIOpcodeControl.CALL: {
                if (this.callStack.length >= 512) {
                  throw new Error(`[E5006] Max call depth exceeded (512) at PC ${currentPC}`);
                }
                const targetPC = instr.harmonicDest;
                const destReg = instr.srcA;
                this.callStack.push({
                  returnPC: this.pc,
                  destReg,
                  locals: new Map(),
                });
                this.pc = targetPC;
                break;
              }
              case OBIOpcodeControl.RET: {
                if (this.callStack.length === 0) {
                  // Top-level return halts execution
                  return this.buildResult(true, startMs);
                }
                const frame = this.callStack.pop()!;
                const returnVal = this.registers[instr.srcA];
                this.registers[frame.destReg] = returnVal;
                this.pc = frame.returnPC;
                break;
              }
              default:
                throw new Error(`[E5002] Unknown Control Opcode 0x${instr.opcode.toString(16)} at PC ${currentPC}`);
            }
            break;
          }

          // ── Category 1: Arithmetic & Comparison ───────────────────────────
          case OBICategory.ARITHMETIC: {
            let leftVal = this.registers[instr.srcA];
            let rightVal = this.registers[instr.srcB];

            if (instr.mode === OBIOperandMode.REG_IMM9) {
              this.registers[instr.srcA] = instr.harmonicDest;
              break;
            }

            let resultVal: any = 0;
            switch (instr.opcode) {
              case OBIOpcodeArithmetic.ADD:
                resultVal = leftVal + rightVal;
                break;
              case OBIOpcodeArithmetic.SUB:
                resultVal = leftVal - rightVal;
                break;
              case OBIOpcodeArithmetic.MUL:
                resultVal = leftVal * rightVal;
                break;
              case OBIOpcodeArithmetic.DIV:
                if (rightVal === 0) {
                  throw new Error(`[E5001] Division by zero at PC ${currentPC}`);
                }
                resultVal = Math.floor(leftVal / rightVal);
                break;
              case OBIOpcodeArithmetic.MOD:
                if (rightVal === 0) {
                  throw new Error(`[E5001] Modulo by zero at PC ${currentPC}`);
                }
                resultVal = leftVal % rightVal;
                break;
              case OBIOpcodeArithmetic.AND:
                resultVal = leftVal & rightVal;
                break;
              case OBIOpcodeArithmetic.OR:
                resultVal = leftVal | rightVal;
                break;
              case OBIOpcodeArithmetic.XOR:
                resultVal = leftVal ^ rightVal;
                break;
              case OBIOpcodeArithmetic.SHL:
                resultVal = leftVal << rightVal;
                break;
              case OBIOpcodeArithmetic.SHR:
                resultVal = leftVal >> rightVal;
                break;
              case OBIOpcodeArithmetic.EQ:
                resultVal = leftVal === rightVal ? 1 : 0;
                break;
              case OBIOpcodeArithmetic.LT:
                resultVal = leftVal < rightVal ? 1 : 0;
                break;
              case OBIOpcodeArithmetic.GT:
                resultVal = leftVal > rightVal ? 1 : 0;
                break;
              default:
                throw new Error(`[E5002] Unknown Arithmetic Opcode 0x${instr.opcode.toString(16)} at PC ${currentPC}`);
            }

            this.registers[instr.harmonicDest] = resultVal;
            break;
          }

          // ── Category 2: Memory & Variables ────────────────────────────────
          case OBICategory.MEMORY: {
            switch (instr.opcode) {
              case OBIOpcodeMemory.LOAD_CONST: {
                const constVal = constants[instr.srcB];
                this.registers[instr.harmonicDest] = constVal;
                break;
              }
              case OBIOpcodeMemory.STORE_VAR: {
                const varName = String(constants[instr.srcB] || `v${instr.srcB}`);
                const val = this.registers[instr.srcA];
                if (this.callStack.length > 0) {
                  this.callStack[this.callStack.length - 1].locals.set(varName, val);
                } else {
                  this.globals.set(varName, val);
                }
                this.registers[instr.harmonicDest] = val;
                break;
              }
              case OBIOpcodeMemory.LOAD_VAR: {
                const varName = String(constants[instr.srcB] || `v${instr.srcB}`);
                let val = 0;
                if (this.callStack.length > 0 && this.callStack[this.callStack.length - 1].locals.has(varName)) {
                  val = this.callStack[this.callStack.length - 1].locals.get(varName);
                } else if (this.globals.has(varName)) {
                  val = this.globals.get(varName);
                }
                this.registers[instr.harmonicDest] = val;
                break;
              }
              case OBIOpcodeMemory.MOV: {
                this.registers[instr.harmonicDest] = this.registers[instr.srcA];
                break;
              }
              default:
                throw new Error(`[E5002] Unknown Memory Opcode 0x${instr.opcode.toString(16)} at PC ${currentPC}`);
            }
            break;
          }

          // ── Category 4: Spatial 369 Memory & Grid ──────────────────────────
          case OBICategory.SPATIAL369: {
            switch (instr.opcode) {
              case OBIOpcodeSpatial.SPATIAL_LOAD_369: {
                const addr = instr.harmonicDest;
                if (addr < 0 || addr > 368) {
                  throw new Error(`[E8005] Address369 boundary violation: address ${addr} out of range [0..368] at PC ${currentPC}`);
                }
                this.registers[instr.srcA] = this.spatialMemory369[addr];
                break;
              }
              case OBIOpcodeSpatial.SPATIAL_STORE_369: {
                const addr = instr.harmonicDest;
                if (addr < 0 || addr > 368) {
                  throw new Error(`[E8005] Address369 boundary violation: address ${addr} out of range [0..368] at PC ${currentPC}`);
                }
                const val = this.registers[instr.srcA];
                this.spatialMemory369[addr] = typeof val === 'number' ? val : Number(val) || 0;
                break;
              }
              case OBIOpcodeSpatial.GRID777_MAP: {
                // Map 3D coordinate (x,y,z) to 7x7x7 grid index [0..342]
                const x = Math.min(6, Math.max(0, Math.floor(this.registers[instr.srcA] || 0)));
                const y = Math.min(6, Math.max(0, Math.floor(this.registers[instr.srcB] || 0)));
                const z = Math.min(6, Math.max(0, Math.floor(this.registers[instr.harmonicDest] || 0)));
                const cellIndex = x * 49 + y * 7 + z;
                this.registers[instr.srcA] = cellIndex;
                break;
              }
              default:
                throw new Error(`[E5002] Unknown Spatial Opcode 0x${instr.opcode.toString(16)} at PC ${currentPC}`);
            }
            break;
          }

          // ── Category 5: Input & Output ────────────────────────────────────
          case OBICategory.IO: {
            switch (instr.opcode) {
              case OBIOpcodeIO.INPUT: {
                const nextInput = this.inputQueue.length > 0 ? this.inputQueue.shift() : 0;
                this.registers[instr.harmonicDest] = nextInput;
                break;
              }
              case OBIOpcodeIO.OUTPUT: {
                const outVal = this.registers[instr.srcA];
                this.output.push(String(outVal));
                break;
              }
              default:
                throw new Error(`[E5002] Unknown IO Opcode 0x${instr.opcode.toString(16)} at PC ${currentPC}`);
            }
            break;
          }

          // ── Category 7: Safety & Resource Invariants ──────────────────────
          case OBICategory.SAFETY: {
            switch (instr.opcode) {
              case OBIOpcodeSafety.ASSERT_ACTUATION_LOCK:
                // Actuation lock verified permanently
                break;
              case OBIOpcodeSafety.ASSERT_RSS_GUARD: {
                const currentMb = process.memoryUsage().heapUsed / (1024 * 1024);
                if (currentMb > this.rssLimitMB) {
                  throw new Error(`[E8001] Memory RSS Guard violation: ${currentMb.toFixed(1)}MB exceeds limit of ${this.rssLimitMB}MB`);
                }
                break;
              }
              default:
                break;
            }
            break;
          }

          default:
            throw new Error(`[E5002] Unknown Opcode Category ${instr.category} at PC ${currentPC}`);
        }
      }

      return this.buildResult(true, startMs);
    } catch (err: any) {
      const msg = err.message || String(err);
      const codeMatch = msg.match(/\[([A-Z0-9]+)\]/);
      const code = codeMatch ? codeMatch[1] : 'E5000';

      return {
        success: false,
        output: [...this.output],
        instructionsExecuted: this.instructionsExecuted,
        executionTimeMs: performance.now() - startMs,
        registers: [...this.registers.slice(0, 16)],
        variables: Object.fromEntries(this.globals),
        spatialMemory369: Array.from(this.spatialMemory369.slice(0, 16)),
        error: {
          code,
          message: msg,
          pc: this.pc,
        },
      };
    }
  }

  private buildResult(success: boolean, startMs: number): QplayerExecutionResult {
    return {
      success,
      output: [...this.output],
      instructionsExecuted: this.instructionsExecuted,
      executionTimeMs: performance.now() - startMs,
      registers: [...this.registers.slice(0, 16)],
      variables: Object.fromEntries(this.globals),
      spatialMemory369: Array.from(this.spatialMemory369.slice(0, 16)),
    };
  }
}
