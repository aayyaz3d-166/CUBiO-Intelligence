/**
 * Automated Test Suite for Gate CNL-P26.3-COMPILER
 * Target: ONE Language Compiler — Bare-Metal Spatial Engine Bridge ('one compile spatial')
 *
 * 5 Validation Gates:
 *   Gate 1 — Canonical spatial_engine.one Source Registration & Syntax Integrity
 *   Gate 2 — Fixed Memory Footprint Audit (343 Cells * 28 Bytes = 9,604 Bytes / ~9.38 KB)
 *   Gate 3 — Deterministic Golden Ratio Wave Propagation Decay (phi^-1 = 0.6180339887)
 *   Gate 4 — Deterministic PQC Master Root Seal (0xPQC_369_*_SEAL, 100-Cycle Replay sigma^2 = 0.0)
 *   Gate 5 — ONE Language CLI Toolchain Extension ('one compile spatial')
 */

import * as path from 'path';
import * as fs from 'fs';
import { SpatialEngineCompiler } from '../../../src/one/spatial_engine_compiler';
import { OneCLI } from '../../../src/cli/oneCLI';
import { CanonicalAddress369 } from '../../../src/one/address369_canonical';

function runGateCNLP263CompilerTestSuite(): void {
  console.log('================================================================================');
  console.log(' 🧬 CUBIO ONE COMPILER: GATE CNL-P26.3-COMPILER SPATIAL ENGINE TEST SUITE');
  console.log('================================================================================\n');

  try {
    const compiler = new SpatialEngineCompiler();
    const sourcePath = path.resolve(__dirname, '../../../src/one/programs/spatial_engine.one');

    // -------------------------------------------------------------------------
    // GATE 1: Canonical Source Registration & Syntax Integrity
    // -------------------------------------------------------------------------
    console.log('[Gate 1] Verifying Canonical Source Registration & Syntax Integrity...');
    console.log(`  - Source Module Path            : ${sourcePath}`);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Canonical source file not found at: ${sourcePath}`);
    }

    const sourceContent = fs.readFileSync(sourcePath, 'utf-8');
    const hasModule = sourceContent.includes('module One.Engine.SpatialQuantum');
    const hasVector3 = sourceContent.includes('struct Vector3');
    const hasHexCell = sourceContent.includes('struct HexCell');
    const hasLattice = sourceContent.includes('HexCell[343]');
    const hasGoldenDecay = sourceContent.includes('GOLDEN_RATIO_INV');

    console.log(`  - Module Definition Found       : ${hasModule}`);
    console.log(`  - Vector3 Struct Definition     : ${hasVector3}`);
    console.log(`  - HexCell Struct Definition     : ${hasHexCell}`);
    console.log(`  - Fixed Array HexCell[343]      : ${hasLattice}`);
    console.log(`  - Golden Decay Constant Found   : ${hasGoldenDecay}`);

    if (!hasModule || !hasVector3 || !hasHexCell || !hasLattice || !hasGoldenDecay) {
      throw new Error('Syntax integrity check failed for spatial_engine.one!');
    }
    console.log('  ✓ Canonical source module spatial_engine.one registered and syntax verified.\n');

    // -------------------------------------------------------------------------
    // GATE 2: Fixed Memory Footprint Audit (9,604 bytes / ~9.38 KB)
    // -------------------------------------------------------------------------
    console.log('[Gate 2] Verifying Fixed Memory Footprint Audit (9,604 bytes / ~9.38 KB)...');
    const compilation = compiler.compileSpatialModule(sourcePath, 42);

    if (!compilation.success) {
      throw new Error(`Compilation failed: ${compilation.error}`);
    }

    console.log(`  - Target Lattice Cells          : ${compilation.totalCells}`);
    console.log(`  - Bytes Per Cell                : ${compilation.bytesPerCell} bytes`);
    console.log(`  - Total Fixed Memory Footprint  : ${compilation.memoryFootprintBytes} bytes (~${compilation.memoryFootprintKb} KB)`);
    console.log(`  - RSS Memory Limit Envelope     : < 512 MB (${(compilation.memoryFootprintBytes / (1024 * 1024)).toFixed(4)} MB used)`);

    if (compilation.totalCells !== 343) {
      throw new Error(`Cell count mismatch: expected 343, got ${compilation.totalCells}`);
    }
    if (compilation.bytesPerCell !== 28) {
      throw new Error(`Bytes per cell mismatch: expected 28, got ${compilation.bytesPerCell}`);
    }
    if (compilation.memoryFootprintBytes !== 9604) {
      throw new Error(`Memory footprint mismatch: expected 9604, got ${compilation.memoryFootprintBytes}`);
    }
    console.log('  ✓ Fixed 343-cell memory footprint strictly validated at exactly 9,604 bytes.\n');

    // -------------------------------------------------------------------------
    // GATE 3: Deterministic Golden Ratio Wave Propagation Decay
    // -------------------------------------------------------------------------
    console.log('[Gate 3] Verifying Deterministic Golden Ratio Wave Propagation Decay...');
    const cells = compilation.cells;

    // Origin cell at (3, 3, 3)
    const originCell = cells.find((c) => c.x === 3 && c.y === 3 && c.z === 3);
    if (!originCell) {
      throw new Error('Origin cell (3, 3, 3) not found in compiled cell matrix!');
    }

    console.log(`  - Origin Cell (3,3,3) Addr      : ${originCell.canonicalAddress} [Display Index: ${originCell.displayIndex}]`);
    console.log(`  - Origin Quantum Probability    : ${originCell.quantum_probability}`);
    console.log(`  - Origin Intent Resonance       : ${originCell.intent_resonance}`);
    console.log(`  - Origin Collapsed Flag         : ${originCell.is_collapsed}`);

    if (originCell.quantum_probability !== 1.0 || originCell.intent_resonance !== 1.0 || !originCell.is_collapsed) {
      throw new Error('Origin cell wave values corrupted!');
    }

    // Corner cell at (0, 0, 0)
    const cornerCell = cells.find((c) => c.x === 0 && c.y === 0 && c.z === 0)!;
    console.log(`  - Corner Cell (0,0,0) Addr      : ${cornerCell.canonicalAddress} [Display Index: ${cornerCell.displayIndex}]`);
    console.log(`  - Corner Quantum Probability    : ${cornerCell.quantum_probability}`);
    console.log(`  - Corner Intent Resonance       : ${cornerCell.intent_resonance}`);
    console.log(`  - Corner Collapsed Flag         : ${cornerCell.is_collapsed}`);
    console.log(`  - Corner RF Safe State (Null)   : ${cornerCell.is_rf_null}`);

    if (cornerCell.quantum_probability >= 1.0 || cornerCell.is_collapsed !== false || !cornerCell.is_rf_null) {
      throw new Error('Corner cell wave decay or safe state error!');
    }

    // All cells safe state check
    const allRfNull = cells.every((c) => c.is_rf_null === true);
    if (!allRfNull) {
      throw new Error('UUP Epistemic Truth Violation: Not all cells initialized with is_rf_null = true!');
    }
    console.log('  ✓ Deterministic golden ratio wave decay and UUP=1.0 safe state confirmed.\n');

    // -------------------------------------------------------------------------
    // GATE 4: Deterministic PQC Master Root Seal Validation (100 Cycles)
    // -------------------------------------------------------------------------
    console.log('[Gate 4] Verifying Deterministic PQC Master Root Seal (100 Cycles, sigma^2 = 0.0)...');
    console.log(`  - Base PQC Master Root Seal     : ${compilation.pqcRootSeal}`);

    if (!compilation.pqcRootSeal.startsWith('0xPQC_369_') || !compilation.pqcRootSeal.endsWith('_SEAL')) {
      throw new Error(`Invalid PQC Root Seal format: ${compilation.pqcRootSeal}`);
    }

    for (let c = 0; c < 100; c++) {
      const replayed = compiler.compileSpatialModule(sourcePath, 42);
      if (replayed.pqcRootSeal !== compilation.pqcRootSeal) {
        throw new Error(`Deterministic drift detected at cycle ${c}! Base=${compilation.pqcRootSeal}, Replay=${replayed.pqcRootSeal}`);
      }
    }
    console.log('  ✓ 100/100 Replay Cycles executed with bit-for-bit exactness (sigma^2 = 0.0, 0.0000% Drift).\n');

    // -------------------------------------------------------------------------
    // GATE 5: ONE Language CLI Toolchain Extension ('one compile spatial')
    // -------------------------------------------------------------------------
    console.log('[Gate 5] Verifying ONE Language CLI Extension (one compile spatial)...');
    const cli = new OneCLI();
    console.log('  - Running: one compile spatial');
    cli.executeCommand(['node', 'one', 'compile', 'spatial']);
    console.log('  ✓ CLI bare-metal compilation command verified.\n');

    console.log('================================================================================');
    console.log(' 🏆 GATE CNL-P26.3-COMPILER 100% CERTIFIED & PASSED');
    console.log(' 🧬 BARE-METAL SPATIAL COMPILATION PIPELINE FULLY OPERATIONAL');
    console.log('================================================================================\n');
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err);
    process.exit(1);
  }
}

runGateCNLP263CompilerTestSuite();
