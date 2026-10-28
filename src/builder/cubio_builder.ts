import { OneLexer } from '../one/oneLexer';
import { OneParser, Grid777Coordinate, SpatialCoordinate } from '../one/oneParser';
import { OneCompiler, ExecutableCubiOAST } from '../one/oneCompiler';
import { CubiOVirtualMachine, RuntimeSpatialNode } from '../core/engine/cubioVM';
import { SpatialVisualizer } from '../cli/spatialVisualizer';
import { ProvenanceMerkleEngine, MerkleSealResult } from '../core/release/provenanceMerkle';
import { PQCLatticeSealEngine } from '../core/crypto/pqc_lattice_seal';
import { HarmonicDecayEngine, CellResonanceState } from '../core/memory/harmonic_decay';

export interface CubioBuilderExport {
  ast: ExecutableCubiOAST;
  vm: CubiOVirtualMachine;
  voxelCount: number;
  merkleSeal: string;
}

/**
 * Sovereign Bridge Adapter for Antigravity Builder UI & Visualizer
 */
export class CubioBuilder {
  /**
   * Compiles raw ONE language code into validated CubiO bytecode.
   */
  public static compileOneSource(sourceCode: string): ExecutableCubiOAST {
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
  public static executeOneVM(bytecode: ExecutableCubiOAST): CubiOVirtualMachine {
    const vm = new CubiOVirtualMachine();
    vm.execute(bytecode);
    return vm;
  }

  /**
   * Quantizes continuous normalized [0, 1]³ space into 7x7x7 discrete lattice (0..342).
   */
  public static quantize777(x: number, y: number, z: number): Grid777Coordinate {
    return OneCompiler.quantize777(x, y, z);
  }

  /**
   * Unquantizes a discrete 7x7x7 cell index (0..342) back to normalized spatial coordinates.
   */
  public static unquantize777(cellIndex: number): SpatialCoordinate {
    return OneCompiler.unquantize777(cellIndex);
  }

  /**
   * Parses live Channel One streaming tokens: _1::CUBE_ID::FUNNEL_ID::HARMONIC::Rx::COMMAND
   */
  public static parseStreamToken(tokenStr: string): {
    root: string;
    cubeId: string;
    funnelId: string;
    harmonicLevel: number;
    rxAction: string;
    command: string;
  } {
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
  public static generateMerkleSeal(): MerkleSealResult {
    const engine = new ProvenanceMerkleEngine();
    return engine.generateMasterMerkleSeal();
  }

  /**
   * Generates Post-Quantum Lattice Hardened Seal for state buffers.
   */
  public static generatePQCSeal(stateBuffer: Buffer): string {
    return PQCLatticeSealEngine.generatePQCSeal(stateBuffer);
  }

  /**
   * Renders real-time 3D spatial dashboard for the builder.
   */
  public static renderVisualGrid(
    programName: string,
    nodes: RuntimeSpatialNode[],
    usedMb: number,
    maxMb: number = 512
  ): void {
    SpatialVisualizer.renderDashboard(programName, nodes, usedMb, maxMb);
  }
}

/**
 * Advanced Next-Gen Builder Bridge incorporating PQC Lattice Seals & Harmonic Decay
 */
export class CubiOAdvancedBuilderBridge {
  private decayEngine = new HarmonicDecayEngine(0.05, 0.001);
  private activeCells = new Map<number, CellResonanceState>();

  public registerActiveCell(cellId: number, activityScore: number = 1.0, timestamp?: number): void {
    this.decayEngine.registerCell(this.activeCells, cellId, activityScore, timestamp);
  }

  public getActiveCellsCount(): number {
    return this.activeCells.size;
  }

  public compileWithStep1Features(sourceCode: string, targetFile: string = 'state.3dmemory'): {
    ast: ExecutableCubiOAST;
    sealHash: string;
    recycledCount: number;
    remainingCells: number;
  } {
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
