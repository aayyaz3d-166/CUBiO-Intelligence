/**
 * CUBiO AI — ONE LANGUAGE — JIT CODEGEN
 * ========================================
 * Module: @one/jit/JITBytecodeEmitter
 * Gate: ONE-05 / JavaScript JIT Code Generation
 *
 * Emits clean, deterministic, sandboxed JavaScript source code from
 * UnifiedIRProgram bytecode with slot-based variables and Tensor operations.
 */

import { UnifiedIRProgram, IRInstruction, IROperand } from '../ir/UnifiedIR';
import { JITSlotAllocator } from './JITSlotAllocator';

export interface EmitterOptions {
  maxInstructions?: number;
  strictTypes?: boolean;
}

export class JITBytecodeEmitter {
  private allocator: JITSlotAllocator;
  private labels: Map<string, number> = new Map();
  private functions: Map<string, { entryPC: number; paramNames: string[]; endPC: number }> = new Map();

  constructor(private program: UnifiedIRProgram, allocator?: JITSlotAllocator) {
    this.allocator = allocator ?? new JITSlotAllocator(program);
    this.indexLabelsAndFunctions();
  }

  /**
   * Pre-scan pass to index all label PCs and function boundaries.
   */
  private indexLabelsAndFunctions(): void {
    const instructions = this.program.instructions;
    // Pass 1: Index all labels
    for (let i = 0; i < instructions.length; i++) {
      const instr = instructions[i];
      if (instr.opcode === 'CONST' && instr.metadata?.isLabel) {
        const labelName = (instr.destination?.value as string) ?? (instr.sources[0]?.value as string) ?? '';
        if (labelName) {
          this.labels.set(labelName, i + 1);
        }
      }
    }
    // Pass 2: Index all functions with resolved label targets
    for (let i = 0; i < instructions.length; i++) {
      const instr = instructions[i];
      if (instr.opcode === 'CONST' && instr.metadata?.isFunctionHeader) {
        const fnName = (instr.metadata.name as string) ?? (instr.metadata.functionName as string) ?? '';
        const params = (instr.metadata.params as string[]) ?? (instr.metadata.paramNames as string[]) ?? [];
        const endLabel = instr.metadata.endLabel as string | undefined;

        let endPC = instructions.length;
        if (endLabel && this.labels.has(endLabel)) {
          endPC = this.labels.get(endLabel)!;
        } else {
          // Linear search for matching function end marker
          let depth = 0;
          for (let j = i; j < instructions.length; j++) {
            if (instructions[j].opcode === 'CONST' && instructions[j].metadata?.isFunctionHeader) depth++;
            if (instructions[j].opcode === 'CONST' && instructions[j].metadata?.isFunctionEnd) {
              depth--;
              if (depth === 0) {
                endPC = j + 1;
                break;
              }
            }
          }
        }
        if (fnName) {
          this.functions.set(fnName, { entryPC: i + 1, paramNames: params, endPC });
        }
      }
    }
  }

  /**
   * Emits the complete JavaScript function string.
   */
  public emitJavaScript(options: EmitterOptions = {}): string {
    const maxInstr = options.maxInstructions ?? 1_000_000;
    const totalSlots = this.allocator.totalSlots;
    const instructions = this.program.instructions;
    const lines: string[] = [];

    // Header & Function signature
    lines.push('/**');
    lines.push(' * CUBiO AI — ONE LANGUAGE — V8 JIT COMPILED NUMERIC BACKEND');
    lines.push(' * Deterministically Generated JavaScript from UnifiedIRProgram');
    lines.push(` * Total Slots: ${totalSlots} (${this.allocator.varCount} variables, ${this.allocator.regCount} registers)`);
    lines.push(` * Instruction Count: ${instructions.length}`);
    lines.push(' */');
    lines.push('return function executeJIT(ctx, slots, initialGlobals) {');
    lines.push('  "use strict";');
    lines.push('  var pc = 0;');
    lines.push('  var instrCount = 0;');
    lines.push(`  var MAX_INSTRUCTIONS = ${maxInstr};`);
    lines.push('  var builtins = ctx.builtins;');
    lines.push('  var fround = Math.fround;');
    lines.push('  var imul = Math.imul;');
    lines.push('  var callStack = [];');
    lines.push('  var loopCursors = new Map();');
    lines.push('');

    // Pre-populate variable slots from initialGlobals if provided
    lines.push('  if (initialGlobals) {');
    const varMap = this.allocator.getVariableMap();
    for (const [varName, slotIdx] of varMap.entries()) {
      const meta = this.allocator.getSlotMetadata(slotIdx);
      const dt = meta?.declaredType?.toLowerCase();
      lines.push(`    if (initialGlobals.hasOwnProperty(${JSON.stringify(varName)})) {`);
      if (dt === 'i32' || dt === 'int32' || dt === 'int') {
        lines.push(`      slots[${slotIdx}] = (initialGlobals[${JSON.stringify(varName)}]) | 0;`);
      } else if (dt === 'f32' || dt === 'float32' || dt === 'float') {
        lines.push(`      slots[${slotIdx}] = fround(initialGlobals[${JSON.stringify(varName)}]);`);
      } else if (dt === 'bool' || dt === 'boolean') {
        lines.push(`      slots[${slotIdx}] = Boolean(initialGlobals[${JSON.stringify(varName)}]);`);
      } else {
        lines.push(`      slots[${slotIdx}] = initialGlobals[${JSON.stringify(varName)}];`);
      }
      lines.push('    }');
    }
    lines.push('  }');
    lines.push('');

    // Main Execution Dispatch Loop
    lines.push(`  while (pc < ${instructions.length}) {`);
    lines.push('    instrCount++;');
    lines.push('    if (instrCount > MAX_INSTRUCTIONS) {');
    lines.push('      throw new ctx.OneVMError("E5007", "Max instruction limit exceeded (" + MAX_INSTRUCTIONS + ")", pc);');
    lines.push('    }');
    lines.push('    switch (pc) {');

    for (let i = 0; i < instructions.length; i++) {
      const instr = instructions[i];
      lines.push(`      case ${i}: { // [${instr.opcode}]`);
      this.emitInstruction(instr, i, lines);
      lines.push('      }');
    }

    lines.push('      default:');
    lines.push('        pc = ' + instructions.length + ';');
    lines.push('        break;');
    lines.push('    }');
    lines.push('  }');
    lines.push('');

    // Epilogue: Collect globals from variable slots
    lines.push('  var globals = {};');
    for (const [varName, slotIdx] of varMap.entries()) {
      lines.push(`  globals[${JSON.stringify(varName)}] = slots[${slotIdx}];`);
    }
    lines.push('');
    lines.push('  return {');
    lines.push('    success: true,');
    lines.push('    output: ctx.output,');
    lines.push('    globals: globals,');
    lines.push('    instructionsExecuted: instrCount');
    lines.push('  };');
    lines.push('};');

    return lines.join('\n');
  }

  /**
   * Emits code for a single IR instruction inside a switch case.
   */
  private emitInstruction(instr: IRInstruction, pc: number, lines: string[]): void {
    const nextPC = pc + 1;

    switch (instr.opcode) {
      case 'CONST': {
        if (instr.metadata?.isLabel) {
          lines.push(`        pc = ${nextPC}; break;`);
          return;
        }
        if (instr.metadata?.isFunctionHeader) {
          const fnName = ((instr.metadata.name ?? instr.metadata.functionName) as string) ?? '';
          const fnInfo = this.functions.get(fnName);
          const endPC = fnInfo ? fnInfo.endPC : nextPC;
          lines.push(`        pc = ${endPC}; break;`);
          return;
        }

        const destSlot = instr.destination ? this.allocator.getSlot(instr.destination) : -1;
        if (destSlot === -1) {
          lines.push(`        pc = ${nextPC}; break;`);
          return;
        }

        // Array literal
        if (instr.metadata?.isArrayLiteral) {
          const items = instr.sources.map((s) => this.renderSource(s)).join(', ');
          lines.push(`        slots[${destSlot}] = [${items}];`);
          lines.push(`        pc = ${nextPC}; break;`);
          return;
        }

        // Object literal
        if (instr.metadata?.isObjectLiteral) {
          const keys = (instr.metadata.keys as string[]) || [];
          const props = keys.map((k, idx) => `${JSON.stringify(k)}: ${this.renderSource(instr.sources[idx])}`).join(', ');
          lines.push(`        slots[${destSlot}] = { ${props} };`);
          lines.push(`        pc = ${nextPC}; break;`);
          return;
        }

        // Scalar constant load
        if (instr.sources.length > 0) {
          const src = instr.sources[0];
          const val = src.value;
          const destType = (instr.destination?.type || this.allocator.getSlotMetadata(destSlot)?.declaredType || '').toLowerCase();

          if (destType === 'i32' || destType === 'int32' || destType === 'int') {
            lines.push(`        slots[${destSlot}] = (${Number(val) || 0}) | 0;`);
          } else if (destType === 'f32' || destType === 'float32' || destType === 'float') {
            lines.push(`        slots[${destSlot}] = fround(${Number(val) || 0});`);
          } else if (destType === 'bool' || destType === 'boolean') {
            lines.push(`        slots[${destSlot}] = ${Boolean(val)};`);
          } else if (typeof val === 'number') {
            lines.push(`        slots[${destSlot}] = ${val};`);
          } else {
            lines.push(`        slots[${destSlot}] = ${JSON.stringify(val)};`);
          }
        }
        lines.push(`        pc = ${nextPC}; break;`);
        break;
      }

      case 'LOAD': {
        if (!instr.destination || instr.sources.length === 0) {
          lines.push(`        pc = ${nextPC}; break;`);
          return;
        }
        const destSlot = this.allocator.getSlot(instr.destination);

        // For-in iterator advance
        if (instr.metadata?.iteratorVar && instr.metadata?.endLabel) {
          const arrSlot = this.allocator.getSlot(instr.sources[0]);
          const endTargetPC = this.resolveLabel(instr.metadata.endLabel as string);
          lines.push(`        var iterArr = slots[${arrSlot}];`);
          lines.push(`        if (Array.isArray(iterArr)) {`);
          lines.push(`          var curIdx = loopCursors.get(${pc}) || 0;`);
          lines.push(`          if (curIdx >= iterArr.length) {`);
          lines.push(`            loopCursors.delete(${pc});`);
          lines.push(`            pc = ${endTargetPC}; break;`);
          lines.push('          }');
          lines.push(`          loopCursors.set(${pc}, curIdx + 1);`);
          lines.push(`          slots[${destSlot}] = iterArr[curIdx];`);
          lines.push(`          pc = ${nextPC}; break;`);
          lines.push('        }');
        }

        const src = instr.sources[0];
        lines.push(`        slots[${destSlot}] = ${this.renderSource(src)};`);
        lines.push(`        pc = ${nextPC}; break;`);
        break;
      }

      case 'STORE':
      case 'MOVE': {
        if (!instr.destination || instr.sources.length === 0) {
          lines.push(`        pc = ${nextPC}; break;`);
          return;
        }
        const destSlot = this.allocator.getSlot(instr.destination);
        const src = instr.sources[0];
        const dt = (instr.destination.type || this.allocator.getSlotMetadata(destSlot)?.declaredType || '').toLowerCase();
        if (dt === 'i32' || dt === 'int32' || dt === 'int') {
          lines.push(`        slots[${destSlot}] = (${this.renderSource(src)}) | 0;`);
        } else if (dt === 'f32' || dt === 'float32' || dt === 'float') {
          lines.push(`        slots[${destSlot}] = fround(${this.renderSource(src)});`);
        } else if (dt === 'bool' || dt === 'boolean') {
          lines.push(`        slots[${destSlot}] = Boolean(${this.renderSource(src)});`);
        } else {
          lines.push(`        slots[${destSlot}] = ${this.renderSource(src)};`);
        }
        lines.push(`        pc = ${nextPC}; break;`);
        break;
      }

      case 'ADD': {
        if (!instr.destination || instr.sources.length < 2) {
          lines.push(`        pc = ${nextPC}; break;`);
          return;
        }
        const destSlot = this.allocator.getSlot(instr.destination);
        const left = this.renderSource(instr.sources[0]);
        const right = this.renderSource(instr.sources[1]);
        const leftType = instr.sources[0]?.type?.toLowerCase() || (instr.sources[0]?.kind === 'variable' || instr.sources[0]?.kind === 'register' ? this.allocator.getSlotMetadata(this.allocator.getSlot(instr.sources[0]))?.declaredType?.toLowerCase() : undefined);
        const rightType = instr.sources[1]?.type?.toLowerCase() || (instr.sources[1]?.kind === 'variable' || instr.sources[1]?.kind === 'register' ? this.allocator.getSlotMetadata(this.allocator.getSlot(instr.sources[1]))?.declaredType?.toLowerCase() : undefined);
        const dt = (instr.destination.type || this.allocator.getSlotMetadata(destSlot)?.declaredType || '').toLowerCase();
        const isI32 = dt === 'i32' || dt === 'int32' || dt === 'int' || leftType === 'i32' || rightType === 'i32';
        const isF32 = !isI32 && (dt === 'f32' || dt === 'float32' || dt === 'float' || leftType === 'f32' || rightType === 'f32');

        lines.push(`        var a = ${left};`);
        lines.push(`        var b = ${right};`);
        lines.push('        if (typeof a === "string" || typeof b === "string") {');
        lines.push(`          slots[${destSlot}] = String(a) + String(b);`);
        lines.push('        } else {');
        if (isI32) {
          lines.push(`          slots[${destSlot}] = (a + b) | 0;`);
        } else if (isF32) {
          lines.push(`          slots[${destSlot}] = fround(a + b);`);
        } else {
          lines.push(`          slots[${destSlot}] = a + b;`);
        }
        lines.push('        }');
        lines.push(`        pc = ${nextPC}; break;`);
        break;
      }

      case 'SUB': {
        if (!instr.destination || instr.sources.length < 2) {
          lines.push(`        pc = ${nextPC}; break;`);
          return;
        }
        const destSlot = this.allocator.getSlot(instr.destination);
        const left = this.renderSource(instr.sources[0]);
        const right = this.renderSource(instr.sources[1]);
        const leftType = instr.sources[0]?.type?.toLowerCase() || (instr.sources[0]?.kind === 'variable' || instr.sources[0]?.kind === 'register' ? this.allocator.getSlotMetadata(this.allocator.getSlot(instr.sources[0]))?.declaredType?.toLowerCase() : undefined);
        const rightType = instr.sources[1]?.type?.toLowerCase() || (instr.sources[1]?.kind === 'variable' || instr.sources[1]?.kind === 'register' ? this.allocator.getSlotMetadata(this.allocator.getSlot(instr.sources[1]))?.declaredType?.toLowerCase() : undefined);
        const dt = (instr.destination.type || this.allocator.getSlotMetadata(destSlot)?.declaredType || '').toLowerCase();
        const isI32 = dt === 'i32' || dt === 'int32' || dt === 'int' || leftType === 'i32' || rightType === 'i32';
        const isF32 = !isI32 && (dt === 'f32' || dt === 'float32' || dt === 'float' || leftType === 'f32' || rightType === 'f32');

        lines.push(`        var a = ${left};`);
        lines.push(`        var b = ${right};`);
        if (isI32) {
          lines.push(`        slots[${destSlot}] = (a - b) | 0;`);
        } else if (isF32) {
          lines.push(`        slots[${destSlot}] = fround(a - b);`);
        } else {
          lines.push(`        slots[${destSlot}] = a - b;`);
        }
        lines.push(`        pc = ${nextPC}; break;`);
        break;
      }

      case 'MUL': {
        if (!instr.destination || instr.sources.length < 2) {
          lines.push(`        pc = ${nextPC}; break;`);
          return;
        }
        const destSlot = this.allocator.getSlot(instr.destination);
        const left = this.renderSource(instr.sources[0]);
        const right = this.renderSource(instr.sources[1]);
        const leftType = instr.sources[0]?.type?.toLowerCase() || (instr.sources[0]?.kind === 'variable' || instr.sources[0]?.kind === 'register' ? this.allocator.getSlotMetadata(this.allocator.getSlot(instr.sources[0]))?.declaredType?.toLowerCase() : undefined);
        const rightType = instr.sources[1]?.type?.toLowerCase() || (instr.sources[1]?.kind === 'variable' || instr.sources[1]?.kind === 'register' ? this.allocator.getSlotMetadata(this.allocator.getSlot(instr.sources[1]))?.declaredType?.toLowerCase() : undefined);
        const dt = (instr.destination.type || this.allocator.getSlotMetadata(destSlot)?.declaredType || '').toLowerCase();
        const isI32 = dt === 'i32' || dt === 'int32' || dt === 'int' || leftType === 'i32' || rightType === 'i32';
        const isF32 = !isI32 && (dt === 'f32' || dt === 'float32' || dt === 'float' || leftType === 'f32' || rightType === 'f32');

        lines.push(`        var a = ${left};`);
        lines.push(`        var b = ${right};`);
        if (isI32) {
          lines.push(`        slots[${destSlot}] = imul(a, b);`);
        } else if (isF32) {
          lines.push(`        slots[${destSlot}] = fround(a * b);`);
        } else {
          lines.push(`        slots[${destSlot}] = a * b;`);
        }
        lines.push(`        pc = ${nextPC}; break;`);
        break;
      }

      case 'DIV': {
        if (!instr.destination || instr.sources.length < 2) {
          lines.push(`        pc = ${nextPC}; break;`);
          return;
        }
        const destSlot = this.allocator.getSlot(instr.destination);
        const left = this.renderSource(instr.sources[0]);
        const right = this.renderSource(instr.sources[1]);
        const leftType = instr.sources[0]?.type?.toLowerCase() || (instr.sources[0]?.kind === 'variable' || instr.sources[0]?.kind === 'register' ? this.allocator.getSlotMetadata(this.allocator.getSlot(instr.sources[0]))?.declaredType?.toLowerCase() : undefined);
        const rightType = instr.sources[1]?.type?.toLowerCase() || (instr.sources[1]?.kind === 'variable' || instr.sources[1]?.kind === 'register' ? this.allocator.getSlotMetadata(this.allocator.getSlot(instr.sources[1]))?.declaredType?.toLowerCase() : undefined);
        const dt = (instr.destination.type || this.allocator.getSlotMetadata(destSlot)?.declaredType || '').toLowerCase();
        const isI32 = dt === 'i32' || dt === 'int32' || dt === 'int' || leftType === 'i32' || rightType === 'i32';
        const isF32 = !isI32 && (dt === 'f32' || dt === 'float32' || dt === 'float' || leftType === 'f32' || rightType === 'f32');

        lines.push(`        var a = ${left};`);
        lines.push(`        var b = ${right};`);
        lines.push('        if (b === 0) {');
        lines.push(`          throw new ctx.OneVMError("E5001", "Division by zero", ${pc});`);
        lines.push('        }');
        if (isI32) {
          lines.push(`        slots[${destSlot}] = (a / b) | 0;`);
        } else if (isF32) {
          lines.push(`        slots[${destSlot}] = fround(a / b);`);
        } else {
          lines.push(`        slots[${destSlot}] = a / b;`);
        }
        lines.push(`        pc = ${nextPC}; break;`);
        break;
      }

      case 'MOD': {
        if (!instr.destination || instr.sources.length < 2) {
          lines.push(`        pc = ${nextPC}; break;`);
          return;
        }
        const destSlot = this.allocator.getSlot(instr.destination);
        const left = this.renderSource(instr.sources[0]);
        const right = this.renderSource(instr.sources[1]);
        const leftType = instr.sources[0]?.type?.toLowerCase() || (instr.sources[0]?.kind === 'variable' || instr.sources[0]?.kind === 'register' ? this.allocator.getSlotMetadata(this.allocator.getSlot(instr.sources[0]))?.declaredType?.toLowerCase() : undefined);
        const rightType = instr.sources[1]?.type?.toLowerCase() || (instr.sources[1]?.kind === 'variable' || instr.sources[1]?.kind === 'register' ? this.allocator.getSlotMetadata(this.allocator.getSlot(instr.sources[1]))?.declaredType?.toLowerCase() : undefined);
        const dt = (instr.destination.type || this.allocator.getSlotMetadata(destSlot)?.declaredType || '').toLowerCase();
        const isI32 = dt === 'i32' || dt === 'int32' || dt === 'int' || leftType === 'i32' || rightType === 'i32';
        const isF32 = !isI32 && (dt === 'f32' || dt === 'float32' || dt === 'float' || leftType === 'f32' || rightType === 'f32');

        lines.push(`        var a = ${left};`);
        lines.push(`        var b = ${right};`);
        lines.push('        if (b === 0) {');
        lines.push(`          throw new ctx.OneVMError("E5001", "Modulo by zero", ${pc});`);
        lines.push('        }');
        if (isI32) {
          lines.push(`        slots[${destSlot}] = (a % b) | 0;`);
        } else if (isF32) {
          lines.push(`        slots[${destSlot}] = fround(a % b);`);
        } else {
          lines.push(`        slots[${destSlot}] = a % b;`);
        }
        lines.push(`        pc = ${nextPC}; break;`);
        break;
      }

      case 'CMP': {
        if (!instr.destination) {
          lines.push(`        pc = ${nextPC}; break;`);
          return;
        }
        const destSlot = this.allocator.getSlot(instr.destination);
        const op = instr.metadata?.operator as string | undefined;

        if (op === '!' && instr.sources.length >= 1) {
          lines.push(`        slots[${destSlot}] = !${this.renderSource(instr.sources[0])};`);
        } else if (instr.sources.length >= 2 && op) {
          const l = this.renderSource(instr.sources[0]);
          const r = this.renderSource(instr.sources[1]);
          const cmpOp = op === '==' ? '===' : (op === '!=' ? '!==' : op);
          lines.push(`        slots[${destSlot}] = Boolean(${l} ${cmpOp} ${r});`);
        }
        lines.push(`        pc = ${nextPC}; break;`);
        break;
      }

      case 'EQ':
      case 'NE':
      case 'LT':
      case 'LTE':
      case 'GT':
      case 'GTE': {
        if (!instr.destination || instr.sources.length < 2) {
          lines.push(`        pc = ${nextPC}; break;`);
          return;
        }
        const destSlot = this.allocator.getSlot(instr.destination);
        const l = this.renderSource(instr.sources[0]);
        const r = this.renderSource(instr.sources[1]);
        const opMap: Record<string, string> = {
          EQ: '===',
          NE: '!==',
          LT: '<',
          LTE: '<=',
          GT: '>',
          GTE: '>=',
        };
        lines.push(`        slots[${destSlot}] = Boolean(${l} ${opMap[instr.opcode]} ${r});`);
        lines.push(`        pc = ${nextPC}; break;`);
        break;
      }

      case 'JUMP': {
        const labelOp = instr.destination ?? instr.sources[0];
        const targetPC = this.resolveLabel(labelOp.value as string);
        lines.push(`        pc = ${targetPC}; break;`);
        break;
      }

      case 'JUMP_IF': {
        const conditionMode = instr.metadata?.condition as string | undefined;
        const labelOp = instr.destination ?? (instr.sources.length > 1 ? instr.sources[1] : undefined);
        const condOp = instr.sources[0];
        const targetPC = this.resolveLabel(labelOp?.value as string);
        const condCheck = conditionMode === 'false'
          ? `!Boolean(${this.renderSource(condOp)})`
          : `Boolean(${this.renderSource(condOp)})`;
        lines.push(`        if (${condCheck}) {`);
        lines.push(`          pc = ${targetPC}; break;`);
        lines.push('        } else {');
        lines.push(`          pc = ${nextPC}; break;`);
        lines.push('        }');
        break;
      }

      case 'JUMP_IF_FALSE': {
        const labelOp = instr.destination ?? (instr.sources.length > 1 ? instr.sources[1] : undefined);
        const condOp = instr.sources[0];
        const targetPC = this.resolveLabel(labelOp?.value as string);
        lines.push(`        if (!Boolean(${this.renderSource(condOp)})) {`);
        lines.push(`          pc = ${targetPC}; break;`);
        lines.push('        } else {');
        lines.push(`          pc = ${nextPC}; break;`);
        lines.push('        }');
        break;
      }

      case 'PRINT': {
        if (instr.sources.length > 0) {
          const val = this.renderSource(instr.sources[0]);
          lines.push(`        ctx.output.push(ctx.formatValue(${val}));`);
        }
        lines.push(`        pc = ${nextPC}; break;`);
        break;
      }

      case 'CALL': {
        if (!instr.destination || instr.sources.length === 0) {
          lines.push(`        pc = ${nextPC}; break;`);
          return;
        }
        const destSlot = this.allocator.getSlot(instr.destination);
        const calleeName = String(instr.sources[0].value);
        const argExprs = instr.sources.slice(1).map((s) => this.renderSource(s)).join(', ');

        const fnInfo = this.functions.get(calleeName);
        if (fnInfo) {
          lines.push(`        var callArgs = [${argExprs}];`);
          lines.push('        if (callStack.length >= 512) {');
          lines.push(`          throw new ctx.OneVMError("E5006", "Maximum call depth exceeded (stack overflow: 512 frames)", ${pc});`);
          lines.push('        }');
          // Push return frame
          lines.push('        callStack.push({');
          lines.push(`          returnPC: ${nextPC},`);
          lines.push(`          destSlot: ${destSlot},`);
          lines.push('          savedSlots: slots.slice()');
          lines.push('        });');
          // Bind arguments to parameters
          for (let p = 0; p < fnInfo.paramNames.length; p++) {
            const pName = fnInfo.paramNames[p];
            const pSlot = this.allocator.getVarSlot(pName);
            if (pSlot !== undefined && p + 1 < instr.sources.length) {
              lines.push(`        slots[${pSlot}] = callArgs[${p}];`);
            }
          }
          lines.push(`        pc = ${fnInfo.entryPC}; break;`);
        } else {
          // Built-in function call
          lines.push(`        var bFn = builtins.get(${JSON.stringify(calleeName)});`);
          lines.push('        if (!bFn && ' + JSON.stringify(calleeName) + '.indexOf(".") !== -1) {');
          lines.push(`          var shortName = ${JSON.stringify(calleeName)}.split(".")[1];`);
          lines.push('          bFn = builtins.get(shortName);');
          lines.push('        }');
          lines.push('        if (bFn) {');
          lines.push(`          slots[${destSlot}] = bFn(${argExprs});`);
          lines.push('        } else {');
          lines.push(`          throw new ctx.OneVMError("E5005", "Undefined function '" + ${JSON.stringify(calleeName)} + "'", ${pc});`);
          lines.push('        }');
          lines.push(`        pc = ${nextPC}; break;`);
        }
        break;
      }

      case 'RETURN': {
        const retExpr = instr.sources.length > 0 ? this.renderSource(instr.sources[0]) : 'null';
        lines.push('        if (callStack.length > 0) {');
        lines.push(`          var retVal = ${retExpr};`);
        lines.push('          var frame = callStack.pop();');
        lines.push('          for (var si = 0; si < frame.savedSlots.length; si++) { slots[si] = frame.savedSlots[si]; }');
        lines.push(`          slots[frame.destSlot] = retVal;`);
        lines.push('          pc = frame.returnPC; break;');
        lines.push('        } else {');
        lines.push('          pc = ' + this.program.instructions.length + '; break;');
        lines.push('        }');
        break;
      }

      case 'INDEX_GET': {
        if (!instr.destination || instr.sources.length < 2) {
          lines.push(`        pc = ${nextPC}; break;`);
          return;
        }
        const destSlot = this.allocator.getSlot(instr.destination);
        const obj = this.renderSource(instr.sources[0]);
        const idx = this.renderSource(instr.sources[1]);
        lines.push(`        slots[${destSlot}] = (${obj})[${idx}];`);
        lines.push(`        pc = ${nextPC}; break;`);
        break;
      }

      case 'INDEX_SET': {
        if (instr.sources.length < 3) {
          lines.push(`        pc = ${nextPC}; break;`);
          return;
        }
        const obj = this.renderSource(instr.sources[0]);
        const idx = this.renderSource(instr.sources[1]);
        const val = this.renderSource(instr.sources[2]);
        lines.push(`        (${obj})[${idx}] = ${val};`);
        lines.push(`        pc = ${nextPC}; break;`);
        break;
      }

      case 'FIELD_GET': {
        if (!instr.destination || instr.sources.length < 1) {
          lines.push(`        pc = ${nextPC}; break;`);
          return;
        }
        const destSlot = this.allocator.getSlot(instr.destination);
        const obj = this.renderSource(instr.sources[0]);
        const field = (instr.metadata?.fieldName as string) ?? (instr.sources[1]?.value as string);
        lines.push(`        slots[${destSlot}] = (${obj})[${JSON.stringify(field)}];`);
        lines.push(`        pc = ${nextPC}; break;`);
        break;
      }

      case 'FIELD_SET': {
        if (instr.sources.length < 2) {
          lines.push(`        pc = ${nextPC}; break;`);
          return;
        }
        const obj = this.renderSource(instr.sources[0]);
        const field = (instr.metadata?.fieldName as string) ?? '';
        const val = this.renderSource(instr.sources[1]);
        lines.push(`        (${obj})[${JSON.stringify(field)}] = ${val};`);
        lines.push(`        pc = ${nextPC}; break;`);
        break;
      }

      default:
        // No-op for unsupported or spatial ops during JIT
        lines.push(`        pc = ${nextPC}; break;`);
        break;
    }
  }

  /**
   * Renders an operand as a JavaScript expression.
   */
  private renderSource(operand: IROperand): string {
    if (operand.kind === 'variable' || operand.kind === 'register') {
      const slot = this.allocator.getSlot(operand);
      return `slots[${slot}]`;
    }
    if (operand.kind === 'constant') {
      const val = operand.value;
      if (typeof val === 'number') {
        const t = operand.type?.toLowerCase();
        if (t === 'f32') return `fround(${val})`;
        if (t === 'i32') return `(${val} | 0)`;
        return String(val);
      }
      if (typeof val === 'string') return JSON.stringify(val);
      if (typeof val === 'boolean') return String(val);
      if (val === null) return 'null';
    }
    return 'null';
  }

  private resolveLabel(labelName: string): number {
    const pc = this.labels.get(labelName);
    if (pc !== undefined) return pc;
    // Fallback: search label instruction
    for (let i = 0; i < this.program.instructions.length; i++) {
      const instr = this.program.instructions[i];
      if (
        instr.opcode === 'CONST' &&
        instr.metadata?.isLabel &&
        ((instr.destination?.value as string) === labelName || (instr.sources[0]?.value as string) === labelName)
      ) {
        return i + 1;
      }
    }
    return this.program.instructions.length;
  }
}
