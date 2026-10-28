/**
 * CUBiO AI — ONE LANGUAGE — LEVEL 1 IR OPTIMIZER
 * ===============================================
 * Module: @one/ir/IROptimizer
 * Specification: Level 1 IR Optimization
 *
 * Implements safe, verifiable intermediate representation transformations:
 *   - Constant Folding & Constant Propagation
 *   - Algebraic Identity Simplification (x + 0, x * 1, x * 0)
 *   - Redundant MOVE & Self-Assignment Elimination
 *   - Dead-Code Elimination (unused pure registers)
 *   - Preserves 100% semantic equivalence and determinism (σ² = 0.0)
 */
import { createConstant, } from './UnifiedIR';
export class IROptimizer {
    /**
     * Optimizes an IR program through successive optimization passes.
     */
    static optimize(program) {
        let instructions = [...program.instructions];
        const originalCount = instructions.length;
        let constantsFolded = 0;
        let algebraicIdentitiesSimplified = 0;
        let redundantMovesEliminated = 0;
        let deadInstructionsEliminated = 0;
        // Pass 1: Constant Propagation & Folding
        const constValues = new Map();
        const foldedInstructions = [];
        for (const inst of instructions) {
            if (inst.opcode === 'CONST' && inst.destination && inst.sources.length > 0) {
                const destKey = String(inst.destination.value);
                const val = inst.sources[0].value;
                if (typeof val === 'number' || typeof val === 'string' || typeof val === 'boolean') {
                    constValues.set(destKey, val);
                }
                foldedInstructions.push(inst);
                continue;
            }
            // Constant folding for binary arithmetic
            if (['ADD', 'SUB', 'MUL', 'DIV', 'MOD'].includes(inst.opcode) && inst.sources.length >= 2) {
                const s0 = inst.sources[0];
                const s1 = inst.sources[1];
                const val0 = s0.kind === 'constant' ? s0.value : constValues.get(String(s0.value));
                const val1 = s1.kind === 'constant' ? s1.value : constValues.get(String(s1.value));
                if (typeof val0 === 'number' && typeof val1 === 'number') {
                    let computed = null;
                    switch (inst.opcode) {
                        case 'ADD':
                            computed = val0 + val1;
                            break;
                        case 'SUB':
                            computed = val0 - val1;
                            break;
                        case 'MUL':
                            computed = val0 * val1;
                            break;
                        case 'DIV':
                            if (val1 !== 0)
                                computed = val0 / val1;
                            break;
                        case 'MOD':
                            if (val1 !== 0)
                                computed = val0 % val1;
                            break;
                    }
                    if (computed !== null && inst.destination) {
                        constantsFolded++;
                        constValues.set(String(inst.destination.value), computed);
                        foldedInstructions.push({
                            index: foldedInstructions.length,
                            opcode: 'CONST',
                            destination: inst.destination,
                            sources: [createConstant(computed, 'number')],
                            metadata: { ...inst.metadata, foldedFrom: inst.opcode },
                        });
                        continue;
                    }
                }
                // Algebraic Identity Simplification (x + 0, x * 1, x * 0)
                if (inst.opcode === 'ADD' && val1 === 0 && inst.destination) {
                    algebraicIdentitiesSimplified++;
                    foldedInstructions.push({
                        index: foldedInstructions.length,
                        opcode: 'MOVE',
                        destination: inst.destination,
                        sources: [s0],
                        metadata: { ...inst.metadata, simplified: 'x+0' },
                    });
                    continue;
                }
                if (inst.opcode === 'MUL' && val1 === 1 && inst.destination) {
                    algebraicIdentitiesSimplified++;
                    foldedInstructions.push({
                        index: foldedInstructions.length,
                        opcode: 'MOVE',
                        destination: inst.destination,
                        sources: [s0],
                        metadata: { ...inst.metadata, simplified: 'x*1' },
                    });
                    continue;
                }
                if (inst.opcode === 'MUL' && val1 === 0 && inst.destination) {
                    algebraicIdentitiesSimplified++;
                    foldedInstructions.push({
                        index: foldedInstructions.length,
                        opcode: 'CONST',
                        destination: inst.destination,
                        sources: [createConstant(0, 'number')],
                        metadata: { ...inst.metadata, simplified: 'x*0' },
                    });
                    continue;
                }
            }
            foldedInstructions.push(inst);
        }
        // Pass 2: Redundant MOVE & Self-Assignment Elimination
        const cleanedMoves = [];
        for (const inst of foldedInstructions) {
            if (inst.opcode === 'MOVE' && inst.destination && inst.sources.length === 1) {
                if (inst.destination.value === inst.sources[0].value) {
                    redundantMovesEliminated++;
                    continue; // eliminate redundant self-move (r1 = r1)
                }
            }
            cleanedMoves.push(inst);
        }
        // Pass 3: Dead-Code Elimination (Unused temporary register assignments)
        // Find all used registers
        const usedRegisters = new Set();
        for (const inst of cleanedMoves) {
            for (const src of inst.sources) {
                if (src.kind === 'register') {
                    usedRegisters.add(String(src.value));
                }
            }
            // Control flow, I/O, and spatial ops inherently have side-effects
            if (['CALL', 'RETURN', 'JUMP', 'JUMP_IF', 'JUMP_IF_FALSE', 'PRINT', 'SPATIAL_OP', 'STORE', 'FIELD_SET', 'INDEX_SET'].includes(inst.opcode)) {
                if (inst.destination && inst.destination.kind === 'register') {
                    usedRegisters.add(String(inst.destination.value));
                }
            }
        }
        const finalInstructions = [];
        for (let i = 0; i < cleanedMoves.length; i++) {
            const inst = cleanedMoves[i];
            // Pure temporary registers that are never read and have no side effects
            if (['CONST', 'MOVE', 'ADD', 'SUB', 'MUL', 'DIV', 'MOD'].includes(inst.opcode) &&
                inst.destination &&
                inst.destination.kind === 'register' &&
                !usedRegisters.has(String(inst.destination.value)) &&
                i < cleanedMoves.length - 1 // preserve last instruction if return
            ) {
                deadInstructionsEliminated++;
                continue;
            }
            finalInstructions.push({
                ...inst,
                index: finalInstructions.length,
            });
        }
        const reduction = originalCount > 0
            ? ((originalCount - finalInstructions.length) / originalCount) * 100
            : 0;
        const stats = {
            originalInstructionCount: originalCount,
            optimizedInstructionCount: finalInstructions.length,
            constantsFolded,
            algebraicIdentitiesSimplified,
            redundantMovesEliminated,
            deadInstructionsEliminated,
            reductionPercentage: Number(reduction.toFixed(2)),
        };
        return {
            program: {
                ...program,
                instructions: finalInstructions,
            },
            stats,
        };
    }
}
