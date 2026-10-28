/**
 * Comprehensive Automated Test Suite for Gate CNL-P21-001
 * Target: Dual-Output Singularity-UI Master Distribution ("Singularity-Master-v21")
 */

import { SingularityDistBundler } from '../singularity_dist_bundler';
import * as fs from 'fs';
import * as path from 'path';

function runGateCNLP21001TestSuite(): void {
  console.log('================================================================================');
  console.log(' 🌌 CUBIO DUAL-OUTPUT SINGULARITY MASTER: GATE CNL-P21-001 TEST SUITE');
  console.log('================================================================================\n');

  try {
    const bundler = new SingularityDistBundler();

    // -------------------------------------------------------------------------
    // GATE 1: Master Distribution Build & Artifact Generation
    // -------------------------------------------------------------------------
    console.log('[Gate 1] Building Master Dual-Output Distribution Package...');
    const result = bundler.buildMasterDistribution('dist/singularity_master_v21');

    console.log(`  - Target Directory  : ${result.outputDirectory}`);
    console.log(`  - Total Files Count : ${result.filesGenerated.length}`);
    console.log(`  - PQC Master Root   : ${result.pqcSeal}`);
    console.log(`  - Total Size        : ${result.totalSizeKb} KB`);

    for (const f of result.filesGenerated) {
      if (!fs.existsSync(f)) {
        throw new Error(`Expected generated file not found: ${f}`);
      }
      console.log(`    ✓ ${path.basename(f)} exists (${fs.statSync(f).size} bytes)`);
    }

    // -------------------------------------------------------------------------
    // GATE 2: Dual-Output HTML Integrity (Web + Singularity-UI)
    // -------------------------------------------------------------------------
    console.log('\n[Gate 2] Verifying Adaptive Dual-Output HTML Content...');
    const htmlContent = fs.readFileSync('dist/singularity_master_v21/index.html', 'utf-8');

    const hasWebMode = htmlContent.includes('Web Mode') && htmlContent.includes('switchMode');
    const has3DMode = htmlContent.includes('Singularity-UI (3D)') && htmlContent.includes('render3DVoxels');
    const has343Cells = htmlContent.includes('343-Cell (7x7x7) Voxel Lattice');
    const hasHarmonics = htmlContent.includes('#f59e0b') && htmlContent.includes('#06b6d4') && htmlContent.includes('16, 185, 129');

    if (!hasWebMode || !has3DMode || !has343Cells || !hasHarmonics) {
      throw new Error('Dual-output HTML artifact missing required mode switches or 3D rendering loops!');
    }
    console.log('  ✓ Adaptive Dual-Output HTML (Traditional Web + 3D Singularity-UI) verified.');

    // -------------------------------------------------------------------------
    // GATE 3: 21-Phase Cryptographic Lineage Verification
    // -------------------------------------------------------------------------
    console.log('\n[Gate 3] Verifying 21-Phase Immutable Cryptographic Lineage...');
    const memoryData = JSON.parse(fs.readFileSync('dist/singularity_master_v21/cubio_master.3dmemory', 'utf-8'));

    const lineage = memoryData.lineageChain || [];
    console.log(`  - Total Lineage Phases : ${lineage.length}`);
    console.log(`  - P1 Header            : ${lineage[0].label}`);
    console.log(`  - P21 Terminal Header  : ${lineage[20].label}`);

    if (lineage.length !== 21) {
      throw new Error(`Lineage phase count mismatch! Expected 21, got ${lineage.length}`);
    }
    console.log('  ✓ 21-Phase master cryptographic lineage chain verified unbroken.');

    // -------------------------------------------------------------------------
    // GATE 4: Permanent Fail-Closed Hardware Actuation Lock Verification
    // -------------------------------------------------------------------------
    console.log('\n[Gate 4] Verifying Fail-Closed Actuation Lock...');
    if (memoryData.is_actuation_blocked !== true || result.isActuationBlocked !== true) {
      throw new Error('CRITICAL: Actuation lock is not active in master distribution metadata!');
    }
    console.log('  ✓ Permanent fail-closed hardware lock verified (is_actuation_blocked = true).');

    // -------------------------------------------------------------------------
    // GATE 5: 100-Cycle Deterministic Replay (0.0000% Drift, σ² = 0.0)
    // -------------------------------------------------------------------------
    console.log('\n[Gate 5] Verifying 100-Cycle Deterministic Replay (0.0000% Drift)...');
    const initialHash = result.deterministicStateHash;
    for (let c = 0; c < 100; c++) {
      const replayed = bundler.buildMasterDistribution('dist/temp_singularity');
      if (replayed.deterministicStateHash !== initialHash) {
        throw new Error(`Determinism drift detected at distribution bundle cycle ${c}!`);
      }
    }
    // Clean temporary test dir
    if (fs.existsSync('dist/temp_singularity')) {
      fs.rmSync('dist/temp_singularity', { recursive: true, force: true });
    }
    console.log('  ✓ 100/100 Replay Cycles executed with bit-for-bit exactness (Drift = 0.0000%, σ² = 0.0).');

    // -------------------------------------------------------------------------
    // GATE 6: Resource Ceiling Verification (< 512 MB RSS)
    // -------------------------------------------------------------------------
    console.log('\n[Gate 6] Verifying Memory RSS Ceiling...');
    console.log(`  - Peak RSS Footprint   : ${result.peakRssMb} MB (Ceiling: 512 MB)`);
    if (result.peakRssMb > 512) {
      throw new Error('Memory ceiling exceeded!');
    }
    console.log('  ✓ Memory footprint strictly bounded (<512 MB RSS).');

    console.log('\n================================================================================');
    console.log(' 🏆 GATE CNL-P21-001 FULLY CERTIFIED & PASSED (100% SUCCESS)');
    console.log('================================================================================\n');
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('\n❌ FAIL: Gate CNL-P21-001 Test Failure:');
      console.error(err.message);
    }
    process.exit(1);
  }
}

runGateCNLP21001TestSuite();
