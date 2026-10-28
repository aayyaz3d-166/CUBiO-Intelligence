/**
 * ONE Language & CubiO Spatial VM - Phase 2
 * Module 4: Spatial Virtual Machine Execution Kernel (cubioVM.ts)
 *
 * Phase 2 Upgrades:
 * - Opcodes 0x10 - 0x14:
 *   - 0x10 BRANCH_ON_ENTROPY: Evaluates S(rho) against threshold and jumps/branches instruction pointer.
 *   - 0x11 SHELL_ALLOCATE: Resolves spatial coordinate via Chebyshev radius calculation with overflow.
 *   - 0x12 PARALLEL_MESH_DISPATCH: Dispatches data across shell cells in the 3D lattice.
 *   - 0x13 DYNAMIC_QUANTIZE: Truncates/compresses stream to target precision (2-bit, 4-bit, 8-bit).
 *   - 0x14 SPATIAL_BARRIER: Halts/synchronizes until all pending shell writes are committed.
 * - Integration of EntropyDispatcher for dynamic runtime instruction mutation.
 */
import { GridMemory } from './gridMemory';
import { BitAgent } from './bitAgent';
import { EntropyEngine } from './entropyEngine';
import { EntropyDispatcher } from './entropyDispatcher';
export var Opcode;
(function (Opcode) {
    // Phase 1 Opcodes
    Opcode[Opcode["NOP"] = 0] = "NOP";
    Opcode[Opcode["GRID_INIT"] = 1] = "GRID_INIT";
    Opcode[Opcode["CELL_WRITE"] = 2] = "CELL_WRITE";
    Opcode[Opcode["CELL_READ"] = 3] = "CELL_READ";
    Opcode[Opcode["CELL_CLEAR"] = 4] = "CELL_CLEAR";
    Opcode[Opcode["ENTROPY_ANALYZE"] = 5] = "ENTROPY_ANALYZE";
    Opcode[Opcode["BIT_ANALYZE"] = 6] = "BIT_ANALYZE";
    Opcode[Opcode["ROUTED_WRITE"] = 7] = "ROUTED_WRITE";
    Opcode[Opcode["SPATIAL_BROADCAST"] = 8] = "SPATIAL_BROADCAST";
    Opcode[Opcode["COMPACT"] = 9] = "COMPACT";
    // Phase 2 Dynamic Entropy Dispatcher Opcodes
    Opcode[Opcode["BRANCH_ON_ENTROPY"] = 16] = "BRANCH_ON_ENTROPY";
    Opcode[Opcode["SHELL_ALLOCATE"] = 17] = "SHELL_ALLOCATE";
    Opcode[Opcode["PARALLEL_MESH_DISPATCH"] = 18] = "PARALLEL_MESH_DISPATCH";
    Opcode[Opcode["DYNAMIC_QUANTIZE"] = 19] = "DYNAMIC_QUANTIZE";
    Opcode[Opcode["SPATIAL_BARRIER"] = 20] = "SPATIAL_BARRIER";
    Opcode[Opcode["HALT"] = 255] = "HALT";
})(Opcode || (Opcode = {}));
export class CubioVM {
    memory;
    bitAgent;
    entropyEngine;
    dispatcher;
    registers;
    executionLog;
    pendingSpatialWrites;
    constructor() {
        this.memory = new GridMemory();
        this.bitAgent = new BitAgent(64);
        this.entropyEngine = new EntropyEngine();
        this.dispatcher = new EntropyDispatcher();
        this.registers = {};
        this.executionLog = [];
        this.pendingSpatialWrites = [];
    }
    log(msg) {
        this.executionLog.push(msg);
    }
    getLogs() {
        return [...this.executionLog];
    }
    /**
     * Quantize raw byte array into 2-bit, 4-bit, or 8-bit precision representations
     */
    static quantizePayload(payload, targetBits) {
        if (targetBits === 8) {
            return new Uint8Array(payload);
        }
        if (targetBits === 4) {
            // 4-bit quantization: 2 nibbles packed per byte
            const outLen = Math.ceil(payload.length / 2);
            const packed = new Uint8Array(outLen);
            for (let i = 0; i < payload.length; i++) {
                // Quantize byte [0..255] to 4-bit value [0..15]
                const qVal = Math.min(15, Math.floor(payload[i] / 16));
                const byteIdx = Math.floor(i / 2);
                if (i % 2 === 0) {
                    packed[byteIdx] = (qVal << 4);
                }
                else {
                    packed[byteIdx] |= qVal;
                }
            }
            return packed;
        }
        // 2-bit quantization: 4 2-bit values packed per byte
        const outLen = Math.ceil(payload.length / 4);
        const packed = new Uint8Array(outLen);
        for (let i = 0; i < payload.length; i++) {
            // Quantize byte [0..255] to 2-bit value [0..3]
            const qVal = Math.min(3, Math.floor(payload[i] / 64));
            const byteIdx = Math.floor(i / 4);
            const shift = (3 - (i % 4)) * 2;
            packed[byteIdx] |= (qVal << shift);
        }
        return packed;
    }
    /**
     * Analyze input bitstream and compute dispatch decision
     */
    analyzeAndDispatch(input) {
        const bitStr = BitAgent.toBitString(input);
        const bitAnalysis = this.bitAgent.analyze(bitStr);
        const entropyAnalysis = this.entropyEngine.analyze(bitStr);
        const decision = this.dispatcher.dispatch(entropyAnalysis, bitAnalysis);
        this.registers['LAST_BIT_ANALYSIS'] = bitAnalysis;
        this.registers['LAST_ENTROPY_ANALYSIS'] = entropyAnalysis;
        this.registers['LAST_DISPATCH_DECISION'] = decision;
        return {
            bitAgent: bitAnalysis,
            entropy: entropyAnalysis,
            decision,
        };
    }
    /**
     * Helper to execute a single program list
     */
    run(program, enableDynamicDispatch = true) {
        let cycles = 0;
        let pc = 0;
        let lastAnalysis;
        let lastDispatchDecision;
        let lastCellAccessed = null;
        while (pc < program.length) {
            cycles++;
            let inst = program[pc];
            // Dynamic Entropy Instruction Mutation
            if (enableDynamicDispatch &&
                (inst.op === Opcode.CELL_WRITE || inst.op === Opcode.ROUTED_WRITE) &&
                inst.data !== undefined) {
                const raw = typeof inst.data === 'string' ? new TextEncoder().encode(inst.data) : inst.data;
                const analysis = this.analyzeAndDispatch(raw);
                lastAnalysis = { bitAgent: analysis.bitAgent, entropy: analysis.entropy };
                lastDispatchDecision = analysis.decision;
                inst = this.dispatcher.mutateInstruction(inst, analysis.decision);
            }
            switch (inst.op) {
                case Opcode.NOP:
                    pc++;
                    break;
                case Opcode.GRID_INIT:
                    this.memory = new GridMemory();
                    this.log('Initialized 7x7x7 Spatial Memory Grid.');
                    pc++;
                    break;
                case Opcode.CELL_WRITE: {
                    if (!inst.coord || inst.data === undefined) {
                        throw new Error('CELL_WRITE requires coord and data');
                    }
                    const raw = typeof inst.data === 'string' ? new TextEncoder().encode(inst.data) : inst.data;
                    const bitStr = BitAgent.toBitString(raw);
                    const bitRes = this.bitAgent.analyze(bitStr);
                    const entRes = this.entropyEngine.analyze(bitStr);
                    lastCellAccessed = this.memory.write(inst.coord, raw, {
                        bitDensity: bitRes.bitDensity,
                        entropyScore: entRes.vonNeumannEntropy,
                    });
                    this.log(`CELL_WRITE to [${inst.coord.x},${inst.coord.y},${inst.coord.z}] (${raw.length} bytes, S=${entRes.vonNeumannEntropy.toFixed(4)})`);
                    pc++;
                    break;
                }
                case Opcode.CELL_READ: {
                    if (!inst.coord)
                        throw new Error('CELL_READ requires coord');
                    lastCellAccessed = this.memory.read(inst.coord);
                    if (inst.targetReg) {
                        this.registers[inst.targetReg] = lastCellAccessed?.data ?? null;
                    }
                    this.log(`CELL_READ from [${inst.coord.x},${inst.coord.y},${inst.coord.z}] -> ${lastCellAccessed ? `${lastCellAccessed.data?.length} bytes` : 'EMPTY'}`);
                    pc++;
                    break;
                }
                case Opcode.CELL_CLEAR: {
                    if (!inst.coord)
                        throw new Error('CELL_CLEAR requires coord');
                    this.memory.clear(inst.coord);
                    this.log(`CELL_CLEAR at [${inst.coord.x},${inst.coord.y},${inst.coord.z}]`);
                    pc++;
                    break;
                }
                case Opcode.ENTROPY_ANALYZE: {
                    if (inst.data === undefined)
                        throw new Error('ENTROPY_ANALYZE requires data');
                    const bitStr = BitAgent.toBitString(inst.data);
                    const entropy = this.entropyEngine.analyze(bitStr);
                    this.registers['ENTROPY_RESULT'] = entropy;
                    if (inst.targetReg) {
                        this.registers[inst.targetReg] = entropy.vonNeumannEntropy;
                    }
                    this.log(`ENTROPY_ANALYZE: S(rho) = ${entropy.vonNeumannEntropy.toFixed(6)}`);
                    pc++;
                    break;
                }
                case Opcode.BIT_ANALYZE: {
                    if (inst.data === undefined)
                        throw new Error('BIT_ANALYZE requires data');
                    const bitStr = BitAgent.toBitString(inst.data);
                    const bitRes = this.bitAgent.analyze(bitStr);
                    this.registers['BIT_RESULT'] = bitRes;
                    this.log(`BIT_ANALYZE: Density = ${bitRes.bitDensity.toFixed(4)}, Class = ${bitRes.classification}`);
                    pc++;
                    break;
                }
                case Opcode.ROUTED_WRITE: {
                    if (inst.data === undefined)
                        throw new Error('ROUTED_WRITE requires data');
                    const raw = typeof inst.data === 'string' ? new TextEncoder().encode(inst.data) : inst.data;
                    const analysis = this.analyzeAndDispatch(raw);
                    const shell = analysis.decision.shellRadius;
                    const alloc = this.memory.allocateByShell(shell, raw, {
                        bitDensity: analysis.bitAgent.bitDensity,
                        entropyScore: analysis.entropy.vonNeumannEntropy,
                    });
                    lastCellAccessed = alloc.cell;
                    this.log(`ROUTED_WRITE placed in Shell ${alloc.allocatedShell} at [${alloc.cell.coord.x},${alloc.cell.coord.y},${alloc.cell.coord.z}]`);
                    pc++;
                    break;
                }
                // ================= PHASE 2 OPCODES =================
                case Opcode.BRANCH_ON_ENTROPY: {
                    if (inst.data === undefined || inst.threshold === undefined || inst.targetJumpIndex === undefined) {
                        throw new Error('BRANCH_ON_ENTROPY requires data, threshold, and targetJumpIndex');
                    }
                    const bitStr = BitAgent.toBitString(inst.data);
                    const entropy = this.entropyEngine.analyze(bitStr);
                    const s = entropy.vonNeumannEntropy;
                    if (s >= inst.threshold) {
                        this.log(`BRANCH_ON_ENTROPY: S(${s.toFixed(4)}) >= ${inst.threshold}. Jumping to instruction ${inst.targetJumpIndex}`);
                        pc = inst.targetJumpIndex;
                    }
                    else {
                        this.log(`BRANCH_ON_ENTROPY: S(${s.toFixed(4)}) < ${inst.threshold}. Continuing sequence.`);
                        pc++;
                    }
                    break;
                }
                case Opcode.SHELL_ALLOCATE: {
                    if (inst.data === undefined)
                        throw new Error('SHELL_ALLOCATE requires data');
                    const raw = typeof inst.data === 'string' ? new TextEncoder().encode(inst.data) : inst.data;
                    const bitStr = BitAgent.toBitString(raw);
                    const entropy = this.entropyEngine.analyze(bitStr);
                    const bitRes = this.bitAgent.analyze(bitStr);
                    const targetShell = inst.shellRadius !== undefined
                        ? inst.shellRadius
                        : this.dispatcher.mapEntropyToShellRadius(entropy.vonNeumannEntropy);
                    const alloc = this.memory.allocateByShell(targetShell, raw, {
                        bitDensity: bitRes.bitDensity,
                        entropyScore: entropy.vonNeumannEntropy,
                        quantizationBits: inst.quantizationBits ?? 8,
                    });
                    lastCellAccessed = alloc.cell;
                    if (inst.targetReg) {
                        this.registers[inst.targetReg] = alloc.cell.coord;
                    }
                    this.log(`SHELL_ALLOCATE: Target Shell ${targetShell} -> Allocated Shell ${alloc.allocatedShell} at [${alloc.cell.coord.x},${alloc.cell.coord.y},${alloc.cell.coord.z}] (Overflow: ${alloc.overflowed})`);
                    pc++;
                    break;
                }
                case Opcode.PARALLEL_MESH_DISPATCH: {
                    if (inst.data === undefined)
                        throw new Error('PARALLEL_MESH_DISPATCH requires data');
                    const raw = typeof inst.data === 'string' ? new TextEncoder().encode(inst.data) : inst.data;
                    const bitStr = BitAgent.toBitString(raw);
                    const entropy = this.entropyEngine.analyze(bitStr);
                    const bitRes = this.bitAgent.analyze(bitStr);
                    // Apply adaptive quantization if requested
                    const qBits = inst.quantizationBits ?? 4;
                    const quantized = CubioVM.quantizePayload(raw, qBits);
                    const targetShell = inst.shellRadius !== undefined
                        ? inst.shellRadius
                        : this.dispatcher.mapEntropyToShellRadius(entropy.vonNeumannEntropy);
                    // Queue as pending spatial write
                    const pendingTask = () => {
                        const alloc = this.memory.allocateByShell(targetShell, quantized, {
                            bitDensity: bitRes.bitDensity,
                            entropyScore: entropy.vonNeumannEntropy,
                            quantizationBits: qBits,
                            tags: ['MESH_DISPATCHED'],
                        });
                        this.log(`[COMMIT] Mesh write committed to Shell ${alloc.allocatedShell} at [${alloc.cell.coord.x},${alloc.cell.coord.y},${alloc.cell.coord.z}] (${quantized.length} bytes, ${qBits}-bit quantized)`);
                    };
                    this.pendingSpatialWrites.push(pendingTask);
                    this.log(`PARALLEL_MESH_DISPATCH queued for Shell ${targetShell} with ${qBits}-bit quantization.`);
                    pc++;
                    break;
                }
                case Opcode.DYNAMIC_QUANTIZE: {
                    if (inst.data === undefined || inst.quantizationBits === undefined) {
                        throw new Error('DYNAMIC_QUANTIZE requires data and quantizationBits');
                    }
                    const raw = typeof inst.data === 'string' ? new TextEncoder().encode(inst.data) : inst.data;
                    const qPayload = CubioVM.quantizePayload(raw, inst.quantizationBits);
                    if (inst.targetReg) {
                        this.registers[inst.targetReg] = qPayload;
                    }
                    this.log(`DYNAMIC_QUANTIZE: ${raw.length} bytes -> ${qPayload.length} bytes (${inst.quantizationBits}-bit precision)`);
                    pc++;
                    break;
                }
                case Opcode.SPATIAL_BARRIER: {
                    const count = this.pendingSpatialWrites.length;
                    this.log(`SPATIAL_BARRIER: Synchronizing ${count} pending spatial writes...`);
                    while (this.pendingSpatialWrites.length > 0) {
                        const task = this.pendingSpatialWrites.shift();
                        task();
                    }
                    this.log(`SPATIAL_BARRIER: All pending spatial writes committed.`);
                    pc++;
                    break;
                }
                case Opcode.SPATIAL_BROADCAST: {
                    if (!inst.coord || inst.radius === undefined || inst.data === undefined) {
                        throw new Error('SPATIAL_BROADCAST requires coord, radius, and data');
                    }
                    const raw = typeof inst.data === 'string' ? new TextEncoder().encode(inst.data) : inst.data;
                    const count = this.memory.broadcast(inst.coord, inst.radius, raw);
                    this.log(`SPATIAL_BROADCAST center [${inst.coord.x},${inst.coord.y},${inst.coord.z}] r=${inst.radius} (${count} cells populated)`);
                    pc++;
                    break;
                }
                case Opcode.COMPACT: {
                    const res = this.memory.compact();
                    this.log(`COMPACT: moved ${res.moved} cells`);
                    pc++;
                    break;
                }
                case Opcode.HALT:
                    // Commit any remaining writes before halt
                    while (this.pendingSpatialWrites.length > 0) {
                        const task = this.pendingSpatialWrites.shift();
                        task();
                    }
                    return {
                        cyclesExecuted: cycles,
                        lastAnalysis,
                        lastDispatchDecision,
                        lastCellAccessed,
                        registers: this.registers,
                        gridStats: this.memory.getStats(),
                        pendingWritesCount: 0,
                    };
                default:
                    throw new Error(`Unknown opcode: 0x${inst.op.toString(16)}`);
            }
        }
        // Flush pending writes on termination
        while (this.pendingSpatialWrites.length > 0) {
            const task = this.pendingSpatialWrites.shift();
            task();
        }
        return {
            cyclesExecuted: cycles,
            lastAnalysis,
            lastDispatchDecision,
            lastCellAccessed,
            registers: this.registers,
            gridStats: this.memory.getStats(),
            pendingWritesCount: 0,
        };
    }
}
