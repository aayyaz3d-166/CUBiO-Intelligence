import { PQCLatticeSealEngine } from './core/crypto/pqc_lattice_seal';
import { HarmonicDecayEngine, CellResonanceState } from './core/memory/harmonic_decay';
import { CubiOAdvancedBuilderBridge } from './builder/cubio_builder';

const sampleProgram = `
rss_max = 512;
@assert_rss(512);

node QuantumNodeAlpha {
  @Grid777(3, 6, 2);
  @memview(32);
  checkpoint pqc_genesis;
}

node QuantumNodeBeta {
  @Grid777(0, 3, 5);
  @memview(32);
}

channel QuantumMesh {
  stream QuantumNodeAlpha -> QuantumNodeBeta : 64;
  @gossip(369);
}

seal "quantum_hardened_state.3dmemory";
`;

function runStep1NextGenTestSuite(): void {
  console.log('======================================================================');
  console.log(' 🛡️ STEP 1 NEXT-GEN TEST: PQC LATTICE SEALS & HARMONIC DECAY');
  console.log('======================================================================\n');

  try {
    // 1. Test PQC Lattice Seal Engine
    console.log('[Test 1] Testing Post-Quantum Lattice-Based Cryptographic Hashing...');
    const dummyState = Buffer.from('CubiO_Spatial_State_Matrix_369_Vector', 'utf-8');
    const pqcSeal = PQCLatticeSealEngine.generatePQCSeal(dummyState);
    console.log(`  ✓ Generated PQC Seal: ${pqcSeal}`);
    if (!pqcSeal.startsWith('0xPQC_369_') || !pqcSeal.endsWith('_SEAL')) {
      throw new Error('Invalid PQC seal format generated!');
    }

    // 2. Test Harmonic Decay Engine (Euler Exponential Decay: R(t) = R_0 * e^(-lambda * t))
    console.log('\n[Test 2] Testing Self-Healing Harmonic Decay Memory Reclamation...');
    const decayEngine = new HarmonicDecayEngine(0.05, 0.001); // lambda=0.05, threshold=0.001
    const testCells = new Map<number, CellResonanceState>();

    const now = Date.now();
    // Fresh cell (just accessed 0 seconds ago) -> Should NOT decay
    decayEngine.registerCell(testCells, 101, 1.0, now);
    // Moderately active cell (accessed 20 seconds ago) -> R = 1.0 * e^(-0.05 * 20) = 1.0 * e^(-1) = 0.3678 > 0.001 -> Should NOT decay
    decayEngine.registerCell(testCells, 102, 1.0, now - 20 * 1000);
    // Stale cell (accessed 200 seconds ago) -> R = 1.0 * e^(-0.05 * 200) = 1.0 * e^(-10) = 0.000045 < 0.001 -> MUST decay
    decayEngine.registerCell(testCells, 103, 1.0, now - 200 * 1000);
    // Dead cell (accessed 500 seconds ago) -> MUST decay
    decayEngine.registerCell(testCells, 104, 0.5, now - 500 * 1000);

    console.log(`  - Initial Active Cells Count: ${testCells.size}`);
    const recycled = decayEngine.evaluateAndHeal(testCells, now);
    console.log(`  ✓ Recycled Inactive Cell IDs: [${recycled.join(', ')}]`);
    console.log(`  ✓ Remaining Active Resonant Cells: [${Array.from(testCells.keys()).join(', ')}]`);

    if (!recycled.includes(103) || !recycled.includes(104) || testCells.has(103) || testCells.has(104)) {
      throw new Error('Harmonic decay failed to reclaim stale cells!');
    }
    if (!testCells.has(101) || !testCells.has(102)) {
      throw new Error('Harmonic decay prematurely reclaimed active cells!');
    }

    // 3. Test Full CubiO Advanced Builder Bridge Integration
    console.log('\n[Test 3] Testing CubiO Advanced Builder Bridge Integration...');
    const bridge = new CubiOAdvancedBuilderBridge();
    bridge.registerActiveCell(201, 1.0, now);
    bridge.registerActiveCell(202, 0.1, now - 300 * 1000); // Stale

    const compileResult = bridge.compileWithStep1Features(sampleProgram, 'quantum_hardened_state.3dmemory');
    console.log(`  ✓ Compiled AST Instructions Count: ${compileResult.ast.instructions.length}`);
    console.log(`  ✓ Generated PQC State Seal: ${compileResult.sealHash}`);
    console.log(`  ✓ Harmonic Memory Sweep: Recycled ${compileResult.recycledCount} cells | Active: ${compileResult.remainingCells}`);

    console.log('\n======================================================================');
    console.log(' ✅ PASS: STEP 1 (PQC LATTICE SEALS & HARMONIC DECAY) CERTIFIED');
    console.log('======================================================================\n');
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('\n❌ FAIL: Step 1 Next-Gen Test Error:');
      console.error(err.message);
    }
    process.exit(1);
  }
}

runStep1NextGenTestSuite();
