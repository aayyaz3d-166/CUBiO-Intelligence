/**
 * CUBiO AI — ONE LANGUAGE — JIT CODEGEN
 * ========================================
 * Module: @one/jit/JITSlotAllocator
 * Gate: ONE-05 / JavaScript JIT Code Generation
 *
 * Statically and deterministically assigns variables and registers to
 * contiguous integer slots for fast array-indexed memory access in V8 JIT.
 */

import { IRInstruction, IROperand, UnifiedIRProgram } from '../ir/UnifiedIR';

export interface SlotMetadata {
  index: number;
  name: string;
  kind: 'variable' | 'register';
  declaredType?: string;
}

export class JITSlotAllocator {
  private varSlots: Map<string, number> = new Map();
  private regSlots: Map<string, number> = new Map();
  private slotToMeta: SlotMetadata[] = [];

  constructor(program: UnifiedIRProgram) {
    this.allocateSlots(program.instructions);
  }

  /**
   * Deterministically scans all instructions and assigns slots.
   */
  private allocateSlots(instructions: IRInstruction[]): void {
    const varSet = new Set<string>();
    const regSet = new Set<string>();
    const typeMap = new Map<string, string>();

    const recordOperand = (op?: IROperand) => {
      if (!op) return;
      if (op.kind === 'variable' && typeof op.value === 'string') {
        varSet.add(op.value);
        if (op.type && !typeMap.has(op.value)) {
          typeMap.set(op.value, op.type);
        }
      } else if (op.kind === 'register' && typeof op.value === 'string') {
        regSet.add(op.value);
        if (op.type && !typeMap.has(op.value)) {
          typeMap.set(op.value, op.type);
        }
      }
    };

    for (const instr of instructions) {
      recordOperand(instr.destination);
      for (const src of instr.sources) {
        recordOperand(src);
      }
    }

    // Sort deterministically
    const sortedVars = Array.from(varSet).sort();
    const sortedRegs = Array.from(regSet).sort((a, b) => {
      const aNum = parseInt(a.replace(/^r/, ''), 10);
      const bNum = parseInt(b.replace(/^r/, ''), 10);
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
        return aNum - bNum;
      }
      return a.localeCompare(b);
    });

    let currentSlot = 0;

    // Allocate variable slots first (0 .. varCount - 1)
    for (const varName of sortedVars) {
      this.varSlots.set(varName, currentSlot);
      this.slotToMeta.push({
        index: currentSlot,
        name: varName,
        kind: 'variable',
        declaredType: typeMap.get(varName),
      });
      currentSlot++;
    }

    // Allocate register slots next (varCount .. total - 1)
    for (const regName of sortedRegs) {
      this.regSlots.set(regName, currentSlot);
      this.slotToMeta.push({
        index: currentSlot,
        name: regName,
        kind: 'register',
        declaredType: typeMap.get(regName),
      });
      currentSlot++;
    }
  }

  /**
   * Resolves the slot index for an operand.
   * Throws if operand is not a variable or register.
   */
  public getSlot(operand: IROperand): number {
    if (operand.kind === 'variable') {
      const idx = this.varSlots.get(operand.value as string);
      if (idx !== undefined) return idx;
      throw new Error(`Variable '${operand.value}' has no allocated JIT slot`);
    }
    if (operand.kind === 'register') {
      const idx = this.regSlots.get(operand.value as string);
      if (idx !== undefined) return idx;
      throw new Error(`Register '${operand.value}' has no allocated JIT slot`);
    }
    throw new Error(`Operand kind '${operand.kind}' cannot be mapped to a memory slot`);
  }

  public getVarSlot(name: string): number | undefined {
    return this.varSlots.get(name);
  }

  public getRegSlot(name: string): number | undefined {
    return this.regSlots.get(name);
  }

  public getVariableMap(): ReadonlyMap<string, number> {
    return this.varSlots;
  }

  public getRegisterMap(): ReadonlyMap<string, number> {
    return this.regSlots;
  }

  public getSlotMetadata(slotIndex: number): SlotMetadata | undefined {
    return this.slotToMeta[slotIndex];
  }

  public get totalSlots(): number {
    return this.slotToMeta.length;
  }

  public get varCount(): number {
    return this.varSlots.size;
  }

  public get regCount(): number {
    return this.regSlots.size;
  }
}
