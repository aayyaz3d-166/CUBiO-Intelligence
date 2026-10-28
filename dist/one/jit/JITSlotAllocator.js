/**
 * CUBiO AI — ONE LANGUAGE — JIT CODEGEN
 * ========================================
 * Module: @one/jit/JITSlotAllocator
 * Gate: ONE-05 / JavaScript JIT Code Generation
 *
 * Statically and deterministically assigns variables and registers to
 * contiguous integer slots for fast array-indexed memory access in V8 JIT.
 */
export class JITSlotAllocator {
    varSlots = new Map();
    regSlots = new Map();
    slotToMeta = [];
    constructor(program) {
        this.allocateSlots(program.instructions);
    }
    /**
     * Deterministically scans all instructions and assigns slots.
     */
    allocateSlots(instructions) {
        const varSet = new Set();
        const regSet = new Set();
        const typeMap = new Map();
        const recordOperand = (op) => {
            if (!op)
                return;
            if (op.kind === 'variable' && typeof op.value === 'string') {
                varSet.add(op.value);
                if (op.type && !typeMap.has(op.value)) {
                    typeMap.set(op.value, op.type);
                }
            }
            else if (op.kind === 'register' && typeof op.value === 'string') {
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
    getSlot(operand) {
        if (operand.kind === 'variable') {
            const idx = this.varSlots.get(operand.value);
            if (idx !== undefined)
                return idx;
            throw new Error(`Variable '${operand.value}' has no allocated JIT slot`);
        }
        if (operand.kind === 'register') {
            const idx = this.regSlots.get(operand.value);
            if (idx !== undefined)
                return idx;
            throw new Error(`Register '${operand.value}' has no allocated JIT slot`);
        }
        throw new Error(`Operand kind '${operand.kind}' cannot be mapped to a memory slot`);
    }
    getVarSlot(name) {
        return this.varSlots.get(name);
    }
    getRegSlot(name) {
        return this.regSlots.get(name);
    }
    getVariableMap() {
        return this.varSlots;
    }
    getRegisterMap() {
        return this.regSlots;
    }
    getSlotMetadata(slotIndex) {
        return this.slotToMeta[slotIndex];
    }
    get totalSlots() {
        return this.slotToMeta.length;
    }
    get varCount() {
        return this.varSlots.size;
    }
    get regCount() {
        return this.regSlots.size;
    }
}
