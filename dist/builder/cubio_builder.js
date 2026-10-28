import { OneLexer } from '../one/oneLexer';
import { OneParser } from '../one/oneParser';
import { OneCompiler } from '../one/oneCompiler';
import { CubiOVirtualMachine } from '../core/engine/cubioVM';
import { SpatialVisualizer } from '../cli/spatialVisualizer';
import { ProvenanceMerkleEngine } from '../core/release/provenanceMerkle';
import { PQCLatticeSealEngine } from '../core/crypto/pqc_lattice_seal';
import { HarmonicDecayEngine } from '../core/memory/harmonic_decay';
/**
 * Sovereign Bridge Adapter for Antigravity Builder UI & Visualizer
 */
export class CubioBuilder {
    /**
     * Compiles raw ONE language code into validated CubiO bytecode.
     */
    static compileOneSource(sourceCode) {
        const lexer = new OneLexer(sourceCode);
        const tokens = lexer.tokenize();
        const parser = new OneParser(tokens);
        const ast = parser.parse();
        const compiler = new OneCompiler(ast);
        return compiler.compile();
    }
    /**
     * Executes compiled bytecode in the deterministic CubiO Virtual Machine.
     */
    static executeOneVM(bytecode) {
        const vm = new CubiOVirtualMachine();
        vm.execute(bytecode);
        return vm;
    }
    /**
     * Quantizes continuous normalized [0, 1]³ space into 7x7x7 discrete lattice (0..342).
     */
    static quantize777(x, y, z) {
        return OneCompiler.quantize777(x, y, z);
    }
    /**
     * Unquantizes a discrete 7x7x7 cell index (0..342) back to normalized spatial coordinates.
     */
    static unquantize777(cellIndex) {
        return OneCompiler.unquantize777(cellIndex);
    }
    /**
     * Parses live Channel One streaming tokens: _1::CUBE_ID::FUNNEL_ID::HARMONIC::Rx::COMMAND
     */
    static parseStreamToken(tokenStr) {
        const parts = tokenStr.trim().split('::');
        if (parts.length < 6 || (parts[0] !== '_1' && parts[0] !== '1')) {
            throw new Error(`[Stream Format Error] Invalid token '${tokenStr}'. Expected '_1::CUBE::FUNNEL::LVL::Rx::CMD'`);
        }
        return {
            root: parts[0],
            cubeId: parts[1],
            funnelId: parts[2],
            harmonicLevel: parseInt(parts[3], 10) || 3,
            rxAction: parts[4],
            command: parts[5],
        };
    }
    /**
     * Generates master 8-layer cryptographic Merkle seal.
     */
    static generateMerkleSeal() {
        const engine = new ProvenanceMerkleEngine();
        return engine.generateMasterMerkleSeal();
    }
    /**
     * Generates Post-Quantum Lattice Hardened Seal for state buffers.
     */
    static generatePQCSeal(stateBuffer) {
        return PQCLatticeSealEngine.generatePQCSeal(stateBuffer);
    }
    /**
     * Renders real-time 3D spatial dashboard for the builder.
     */
    static renderVisualGrid(programName, nodes, usedMb, maxMb = 512) {
        SpatialVisualizer.renderDashboard(programName, nodes, usedMb, maxMb);
    }
}
/**
 * Advanced Next-Gen Builder Bridge incorporating PQC Lattice Seals & Harmonic Decay
 */
export class CubiOAdvancedBuilderBridge {
    decayEngine = new HarmonicDecayEngine(0.05, 0.001);
    activeCells = new Map();
    registerActiveCell(cellId, activityScore = 1.0, timestamp) {
        this.decayEngine.registerCell(this.activeCells, cellId, activityScore, timestamp);
    }
    getActiveCellsCount() {
        return this.activeCells.size;
    }
    compileWithStep1Features(sourceCode, targetFile = 'state.3dmemory') {
        // 1. Run harmonic decay sweep on active cells
        const now = Date.now();
        const recycled = this.decayEngine.evaluateAndHeal(this.activeCells, now);
        // 2. Compile spatial program
        const ast = CubioBuilder.compileOneSource(sourceCode);
        // 3. Generate PQC Post-Quantum Lattice Seal over source & bytecode
        const stateBuffer = Buffer.from(sourceCode + JSON.stringify(ast), 'utf-8');
        const sealHash = PQCLatticeSealEngine.generatePQCSeal(stateBuffer);
        return {
            ast,
            sealHash,
            recycledCount: recycled.length,
            remainingCells: this.activeCells.size,
        };
    }
}
