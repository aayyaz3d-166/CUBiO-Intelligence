/**
 * ONE Language & CubiO Spatial VM — Phase 3
 * Phase 3 VM Opcodes + Integration (cubioVMPhase3.ts extends cubioVM.ts)
 *
 * Adds Phase 3 Opcodes (0x20 - 0x26) to the existing CubioVM:
 *   0x20  SNAPSHOT_SAVE    — serialize lattice to binary buffer in register
 *   0x21  SNAPSHOT_LOAD    — rehydrate lattice from binary buffer in register
 *   0x22  SNAPSHOT_VERIFY  — verify checksum of buffer in register
 *   0x23  SPATIAL_QUERY    — run predicate query, store result in register
 *   0x24  SNAPSHOT_DIFF    — diff two snapshot buffers
 *   0x25  QUERY_AGGREGATE  — compute shell aggregate stats
 *   0x26  ENTROPY_CENTROID — compute weighted entropy centroid coord
 */
import { GridMemory } from './gridMemory';
import { LatticeSnapshotEngine } from './latticeSnapshot';
import { SpatialQueryEngine } from './spatialQuery';
export { Opcode } from './cubioVM';
import { CubioVM } from './cubioVM';
// Phase 3 Opcode enum extension
export var Phase3Opcode;
(function (Phase3Opcode) {
    Phase3Opcode[Phase3Opcode["SNAPSHOT_SAVE"] = 32] = "SNAPSHOT_SAVE";
    Phase3Opcode[Phase3Opcode["SNAPSHOT_LOAD"] = 33] = "SNAPSHOT_LOAD";
    Phase3Opcode[Phase3Opcode["SNAPSHOT_VERIFY"] = 34] = "SNAPSHOT_VERIFY";
    Phase3Opcode[Phase3Opcode["SPATIAL_QUERY"] = 35] = "SPATIAL_QUERY";
    Phase3Opcode[Phase3Opcode["SNAPSHOT_DIFF"] = 36] = "SNAPSHOT_DIFF";
    Phase3Opcode[Phase3Opcode["QUERY_AGGREGATE"] = 37] = "QUERY_AGGREGATE";
    Phase3Opcode[Phase3Opcode["ENTROPY_CENTROID"] = 38] = "ENTROPY_CENTROID";
})(Phase3Opcode || (Phase3Opcode = {}));
export class CubioVMPhase3 extends CubioVM {
    snapshotEngine;
    queryEngine;
    constructor() {
        super();
        this.snapshotEngine = new LatticeSnapshotEngine();
        this.queryEngine = new SpatialQueryEngine(this.memory);
    }
    /**
     * Rebuild query engine if memory lattice was replaced (e.g. after SNAPSHOT_LOAD)
     */
    refreshQueryEngine() {
        this.queryEngine = new SpatialQueryEngine(this.memory);
    }
    /**
     * Run Phase3-aware program with Phase 1+2+3 opcode support
     */
    run(program, enableDynamicDispatch = true) {
        // Pre-scan for Phase 3 opcodes and split if needed
        const hasPhase3 = program.some((i) => i.op >= Phase3Opcode.SNAPSHOT_SAVE && i.op <= Phase3Opcode.ENTROPY_CENTROID);
        if (!hasPhase3) {
            // Pure Phase 1/2 — delegate to parent
            return super.run(program, enableDynamicDispatch);
        }
        let cycles = 0;
        let pc = 0;
        while (pc < program.length) {
            cycles++;
            const inst = program[pc];
            // ---------------------------------------------------------------
            // Phase 3 Opcodes
            // ---------------------------------------------------------------
            if (inst.op >= Phase3Opcode.SNAPSHOT_SAVE && inst.op <= Phase3Opcode.ENTROPY_CENTROID) {
                switch (inst.op) {
                    case Phase3Opcode.SNAPSHOT_SAVE: {
                        const result = this.snapshotEngine.serialize(this.memory);
                        const reg = inst.destReg ?? 'SNAPSHOT_BUFFER';
                        this.registers[reg] = result.buffer;
                        this.registers['SNAPSHOT_META'] = result.metadata;
                        this.log(`SNAPSHOT_SAVE: Saved ${result.metadata.totalCellsWritten} cells, ${result.metadata.byteSize} bytes, checksum=0x${result.metadata.checksum.toString(16).toUpperCase()}`);
                        pc++;
                        break;
                    }
                    case Phase3Opcode.SNAPSHOT_LOAD: {
                        const reg = inst.sourceReg ?? 'SNAPSHOT_BUFFER';
                        const buf = this.registers[reg];
                        if (!buf)
                            throw new Error(`SNAPSHOT_LOAD: register '${reg}' is empty or not a buffer`);
                        const result = this.snapshotEngine.deserialize(buf);
                        if (!result.valid) {
                            this.log(`SNAPSHOT_LOAD WARNING: Checksum mismatch — data may be corrupted`);
                        }
                        this.memory = result.memory;
                        this.refreshQueryEngine();
                        this.log(`SNAPSHOT_LOAD: Rehydrated ${result.metadata.totalCellsWritten} cells (valid=${result.valid})`);
                        pc++;
                        break;
                    }
                    case Phase3Opcode.SNAPSHOT_VERIFY: {
                        const reg = inst.sourceReg ?? 'SNAPSHOT_BUFFER';
                        const buf = this.registers[reg];
                        if (!buf)
                            throw new Error(`SNAPSHOT_VERIFY: register '${reg}' is empty`);
                        // Re-verify checksum
                        const hdr = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
                        const storedChecksum = hdr.getUint32(12, true);
                        const payload = buf.slice(16);
                        const computed = LatticeSnapshotEngine.fnv1a32(payload);
                        const valid = storedChecksum === computed;
                        this.registers['SNAPSHOT_VALID'] = valid;
                        this.log(`SNAPSHOT_VERIFY: stored=0x${storedChecksum.toString(16).toUpperCase()} computed=0x${computed.toString(16).toUpperCase()} -> ${valid ? 'VALID' : 'CORRUPTED'}`);
                        pc++;
                        break;
                    }
                    case Phase3Opcode.SPATIAL_QUERY: {
                        this.refreshQueryEngine();
                        let result;
                        switch (inst.queryType ?? 'shell') {
                            case 'shell':
                                result = this.queryEngine.queryByShellRange(inst.rMin ?? 0, inst.rMax ?? 3);
                                break;
                            case 'entropy':
                                result = this.queryEngine.queryByEntropyRange(inst.sMin ?? 0, inst.sMax ?? 2);
                                break;
                            case 'density':
                                result = this.queryEngine.queryByDensityRange(inst.dMin ?? 0, inst.dMax ?? 1);
                                break;
                            case 'tag':
                                result = this.queryEngine.queryByAnyTag(inst.tags ?? []);
                                break;
                            case 'knn':
                                const knnResult = this.queryEngine.knn(inst.knnCenter ?? { x: 3, y: 3, z: 3 }, inst.knnK ?? 5);
                                result = { cells: knnResult, totalScanned: GridMemory.TOTAL_CELLS, matchCount: knnResult.length, executionTimeMs: 0 };
                                break;
                        }
                        const reg = inst.destReg ?? 'QUERY_RESULT';
                        this.registers[reg] = result;
                        this.log(`SPATIAL_QUERY (${inst.queryType}): ${result.matchCount} matches in ${result.executionTimeMs}ms`);
                        pc++;
                        break;
                    }
                    case Phase3Opcode.SNAPSHOT_DIFF: {
                        const srcReg = inst.sourceReg ?? 'SNAPSHOT_BUFFER';
                        const destReg = inst.destReg ?? 'SNAPSHOT_BUFFER_NEW';
                        const buf1 = this.registers[srcReg];
                        const buf2 = this.registers[destReg];
                        if (!buf1 || !buf2)
                            throw new Error('SNAPSHOT_DIFF requires two snapshot buffers in registers');
                        const diff = this.snapshotEngine.diff(buf1, buf2);
                        this.registers['SNAPSHOT_DIFF_RESULT'] = diff;
                        this.log(`SNAPSHOT_DIFF: +${diff.added.length} added, -${diff.removed.length} removed, ~${diff.modified.length} modified, =${diff.unchangedCount} unchanged`);
                        pc++;
                        break;
                    }
                    case Phase3Opcode.QUERY_AGGREGATE: {
                        this.refreshQueryEngine();
                        const stats = this.queryEngine.shellAggregates();
                        const reg = inst.destReg ?? 'SHELL_AGGREGATES';
                        this.registers[reg] = stats;
                        this.registers['SHELL_AGGREGATES'] = stats;
                        this.log(`QUERY_AGGREGATE: Computed per-shell aggregates for ${stats.length} shells into ${reg}`);
                        pc++;
                        break;
                    }
                    case Phase3Opcode.ENTROPY_CENTROID: {
                        this.refreshQueryEngine();
                        const centroid = this.queryEngine.entropyCentroid();
                        const reg = inst.destReg ?? 'ENTROPY_CENTROID';
                        this.registers[reg] = centroid;
                        this.log(`ENTROPY_CENTROID: [${centroid.x}, ${centroid.y}, ${centroid.z}]`);
                        pc++;
                        break;
                    }
                    default:
                        throw new Error(`Unknown Phase3 opcode: 0x${inst.op.toString(16)}`);
                }
            }
            else {
                // Delegate to Phase 1/2 single-step execution
                const singleResult = super.run([inst], enableDynamicDispatch);
                cycles += singleResult.cyclesExecuted - 1;
                pc++;
            }
        }
        return {
            cyclesExecuted: cycles,
            registers: this.registers,
            gridStats: this.memory.getStats(),
            pendingWritesCount: 0,
        };
    }
}
