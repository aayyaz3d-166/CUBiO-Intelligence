/**
 * ONE Language & CubiO Spatial VM - Phase 2
 * Compiler Driver Pipeline (oneCompiler.ts)
 *
 * Phase 2 Bytecode Emitter:
 * - Emits Phase 2 Opcodes:
 *   - 0x10 BRANCH_ON_ENTROPY
 *   - 0x11 SHELL_ALLOCATE
 *   - 0x12 PARALLEL_MESH_DISPATCH
 *   - 0x13 DYNAMIC_QUANTIZE
 *   - 0x14 SPATIAL_BARRIER
 */
import { Lexer } from './lexer';
import { Parser } from './parser';
import { Opcode } from '../vm/cubioVM';
import { Phase3Opcode } from '../vm/cubioVMPhase3';
export class OneCompiler {
    symbolTable = new Map();
    /**
     * Complete compilation pipeline: source code string -> bytecode instructions
     */
    compile(source) {
        this.symbolTable.clear();
        // 1. Lexical Analysis
        const lexer = new Lexer(source);
        const tokens = lexer.tokenize();
        // 2. Syntactic Analysis / AST Generation
        const parser = new Parser(tokens);
        const ast = parser.parse();
        // 3. Bytecode Emission
        const instructions = this.emitBytecode(ast);
        return {
            ast,
            instructions,
            symbolTable: new Map(this.symbolTable),
        };
    }
    resolveData(val) {
        if (typeof val === 'number') {
            return val.toString();
        }
        if (this.symbolTable.has(val)) {
            const sym = this.symbolTable.get(val);
            return typeof sym === 'string' ? sym : JSON.stringify(sym);
        }
        return val;
    }
    emitBytecode(ast) {
        const instructions = [];
        for (const stmt of ast.body) {
            switch (stmt.type) {
                case 'SpatialGridDecl':
                    instructions.push({
                        op: Opcode.GRID_INIT,
                        comment: `Init grid Cube(${stmt.dimX}, ${stmt.dimY}, ${stmt.dimZ})`,
                    });
                    break;
                case 'VariableDecl':
                    this.symbolTable.set(stmt.name, stmt.value);
                    break;
                case 'CellWrite':
                    instructions.push({
                        op: Opcode.CELL_WRITE,
                        coord: { x: stmt.x, y: stmt.y, z: stmt.z },
                        data: this.resolveData(stmt.data),
                        comment: `Write data to [${stmt.x}, ${stmt.y}, ${stmt.z}]`,
                    });
                    break;
                case 'CellRead':
                    instructions.push({
                        op: Opcode.CELL_READ,
                        coord: { x: stmt.x, y: stmt.y, z: stmt.z },
                        comment: `Read data from [${stmt.x}, ${stmt.y}, ${stmt.z}]`,
                    });
                    break;
                case 'CellClear':
                    instructions.push({
                        op: Opcode.CELL_CLEAR,
                        coord: { x: stmt.x, y: stmt.y, z: stmt.z },
                        comment: `Clear cell [${stmt.x}, ${stmt.y}, ${stmt.z}]`,
                    });
                    break;
                case 'EntropyAnalyze':
                    instructions.push({
                        op: Opcode.ENTROPY_ANALYZE,
                        data: this.resolveData(stmt.stream),
                        comment: `Analyze Von Neumann entropy of stream`,
                    });
                    break;
                case 'BitAnalyze':
                    instructions.push({
                        op: Opcode.BIT_ANALYZE,
                        data: this.resolveData(stmt.stream),
                        comment: `Bitstream intelligence analysis`,
                    });
                    break;
                case 'Broadcast':
                    instructions.push({
                        op: Opcode.SPATIAL_BROADCAST,
                        coord: { x: stmt.centerX, y: stmt.centerY, z: stmt.centerZ },
                        radius: stmt.radius,
                        data: this.resolveData(stmt.data),
                        comment: `Broadcast radius ${stmt.radius} around [${stmt.centerX}, ${stmt.centerY}, ${stmt.centerZ}]`,
                    });
                    break;
                case 'Compact':
                    instructions.push({
                        op: Opcode.COMPACT,
                        comment: `Compact 3D spatial memory lattice`,
                    });
                    break;
                // Phase 2 Bytecode Emission
                case 'BranchEntropy':
                    instructions.push({
                        op: Opcode.BRANCH_ON_ENTROPY,
                        data: this.resolveData(stmt.stream),
                        threshold: stmt.threshold,
                        // Jump target set to arbitrary relative offset or end if labels are resolved
                        targetJumpIndex: instructions.length + 2,
                        comment: `Branch on entropy S(rho) >= ${stmt.threshold}`,
                    });
                    break;
                case 'ShellAlloc':
                    instructions.push({
                        op: Opcode.SHELL_ALLOCATE,
                        data: this.resolveData(stmt.stream),
                        targetReg: stmt.targetReg,
                        shellRadius: stmt.shellRadius,
                        comment: `Allocate cell in concentric shell based on entropy`,
                    });
                    break;
                case 'Quantize':
                    instructions.push({
                        op: Opcode.DYNAMIC_QUANTIZE,
                        data: this.resolveData(stmt.stream),
                        quantizationBits: stmt.bits,
                        targetReg: stmt.targetReg,
                        comment: `Adaptive dynamic quantization to ${stmt.bits} bits`,
                    });
                    break;
                case 'SpatialBarrier':
                    instructions.push({
                        op: Opcode.SPATIAL_BARRIER,
                        shellRadius: stmt.shellRadius,
                        comment: `Spatial memory write barrier (synchronize pending writes)`,
                    });
                    break;
                // Phase 3 Bytecode Emission
                case 'SnapshotSave':
                    instructions.push({
                        op: Phase3Opcode.SNAPSHOT_SAVE,
                        destReg: stmt.destReg,
                        comment: `Save 3D spatial grid snapshot to register ${stmt.destReg ?? 'SNAPSHOT_BUFFER'}`,
                    });
                    break;
                case 'SnapshotLoad':
                    instructions.push({
                        op: Phase3Opcode.SNAPSHOT_LOAD,
                        sourceReg: stmt.sourceReg,
                        comment: `Load 3D spatial grid snapshot from register ${stmt.sourceReg ?? 'SNAPSHOT_BUFFER'}`,
                    });
                    break;
                case 'SnapshotVerify':
                    instructions.push({
                        op: Phase3Opcode.SNAPSHOT_VERIFY,
                        sourceReg: stmt.sourceReg,
                        comment: `Verify checksum of snapshot in register ${stmt.sourceReg ?? 'SNAPSHOT_BUFFER'}`,
                    });
                    break;
                case 'SpatialQuery':
                    instructions.push({
                        op: Phase3Opcode.SPATIAL_QUERY,
                        queryType: stmt.queryType,
                        rMin: stmt.rMin,
                        rMax: stmt.rMax,
                        sMin: stmt.sMin,
                        sMax: stmt.sMax,
                        dMin: stmt.dMin,
                        dMax: stmt.dMax,
                        tags: stmt.tags,
                        knnK: stmt.knnK,
                        destReg: stmt.destReg,
                        comment: `Execute spatial query (${stmt.queryType})`,
                    });
                    break;
                case 'SnapshotDiff':
                    instructions.push({
                        op: Phase3Opcode.SNAPSHOT_DIFF,
                        sourceReg: stmt.sourceReg,
                        destReg: stmt.destReg,
                        comment: `Diff snapshot in ${stmt.sourceReg} against ${stmt.destReg}`,
                    });
                    break;
                case 'QueryAggregate':
                    instructions.push({
                        op: Phase3Opcode.QUERY_AGGREGATE,
                        destReg: stmt.destReg,
                        comment: `Aggregate spatial statistics across 3D shells`,
                    });
                    break;
                case 'EntropyCentroid':
                    instructions.push({
                        op: Phase3Opcode.ENTROPY_CENTROID,
                        destReg: stmt.destReg,
                        comment: `Compute weighted spatial entropy centroid coordinate`,
                    });
                    break;
            }
        }
        instructions.push({ op: Opcode.HALT, comment: 'Halt execution' });
        return instructions;
    }
}
