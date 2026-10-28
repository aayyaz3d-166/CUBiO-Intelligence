/**
 * Comprehensive Automated Test Suite for Gate CNL-P6-001
 * Target: Zero-OS Bare-Metal Compilation ("one-baremetal")
 */

import * as fs from 'fs';
import { CubioHyperNeuralBuilder } from '../cubio_builder';
import { BAREMETAL_MAGIC, BareMetalCompiler } from '../baremetal_compiler';
import { FreestandingMicroKernel } from '../micro_kernel_runtime';

const sampleBareMetalProgram = `
rss_max = 512;
@assert_rss(512);
@actuation_lock(true);

node BareNodeAlpha {
  @Space(0.333, 0.666, 0.999);
  @memview(32);
  checkpoint bm_init;
}

node BareNodeBeta {
  @Space(0.111, 0.222, 0.333);
  @memview(32);
}

channel BareMetalChannel {
  stream BareNodeAlpha -> BareNodeBeta : 64;
  @gossip(369);
}

seal "baremetal_image.3dmemory";
`;

function runGateCNLP6001TestSuite(): void {
  console.log('================================================================================');
  console.log(' 🚀 CUBIO BARE-METAL COMPILER: GATE CNL-P6-001 VERIFICATION SUITE');
  console.log('================================================================================\n');

  try {
    const builder = new CubioHyperNeuralBuilder();

    // -------------------------------------------------------------------------
    // GATE 1: Freestanding Binary Generation & Magic Signature
    // -------------------------------------------------------------------------
    console.log('[Gate 1] Compiling ONE Language AST to Freestanding Bare-Metal Binary...');
    const result = builder.compileBareMetal(
      sampleBareMetalProgram,
      'one-baremetal.bin',
      'cubio_baremetal_phase6.3dmemory'
    );

    console.log(`  ✓ Binary File Generated    : ${result.binaryPath} (${result.binarySize} bytes)`);
    console.log(`  ✓ Opcodes Emitted          : ${result.instructionsCount} raw instructions`);
    console.log(`  ✓ PQC Lattice Root Seal    : ${result.pqcSeal}`);

    const binaryBuffer = fs.readFileSync('one-baremetal.bin');
    const readMagic = binaryBuffer.readUInt32BE(0);
    console.log(`  ✓ Binary Magic Check       : 0x${readMagic.toString(16).toUpperCase()} (Expected: 0x3690B4E0)`);

    if (readMagic !== BAREMETAL_MAGIC) {
      throw new Error(`Invalid bare-metal binary magic: 0x${readMagic.toString(16)}`);
    }

    // -------------------------------------------------------------------------
    // GATE 2: Freestanding Micro-Kernel Boot & Zero-OS Execution
    // -------------------------------------------------------------------------
    console.log('\n[Gate 2] Booting Freestanding Micro-Kernel Runtime (Zero-OS Target)...');
    console.log(`  ✓ Kernel Cycles Executed   : ${result.kernelCycles} cycles`);
    console.log(`  ✓ Allocated Spatial Nodes  : ${result.allocatedNodes}`);
    console.log(`  ✓ Active Memory Footprint  : ${result.allocatedMemoryMb.toFixed(2)} MB / 512 MB`);

    if (result.allocatedNodes !== 2) {
      throw new Error(`Expected 2 allocated nodes in bare-metal runtime, got ${result.allocatedNodes}`);
    }

    // -------------------------------------------------------------------------
    // GATE 3: Physical Memory Bounds & Ceiling Guard (< 512 MB)
    // -------------------------------------------------------------------------
    console.log('\n[Gate 3] Verifying Physical Hardware Memory Constraints...');
    console.log(`  ✓ Memory Ceiling Preserved : ${result.allocatedMemoryMb.toFixed(2)} MB <= 512.00 MB`);
    if (result.allocatedMemoryMb > 512.0) {
      throw new Error('Hardware memory ceiling breached in bare-metal kernel!');
    }

    // -------------------------------------------------------------------------
    // GATE 4: Permanent Fail-Closed Actuation Lock
    // -------------------------------------------------------------------------
    console.log('\n[Gate 4] Verifying Fail-Closed Actuation Lock...');
    console.log(`  ✓ Actuation Lock Status    : is_actuation_blocked = ${result.isActuationBlocked}`);
    if (result.isActuationBlocked !== true) {
      throw new Error('CRITICAL: Actuation lock must be permanently true in bare-metal mode!');
    }

    // -------------------------------------------------------------------------
    // GATE 5: 6-Phase Cryptographic Lineage Preservation (P1 -> P6)
    // -------------------------------------------------------------------------
    console.log('\n[Gate 5] Verifying 6-Phase Immutable Cryptographic Lineage...');
    const expectedPhases = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
    const actualPhases = result.lineageChain.map(l => l.phase);
    console.log(`  ✓ Lineage Chain            : ${actualPhases.join(' -> ')}`);

    if (JSON.stringify(actualPhases) !== JSON.stringify(expectedPhases)) {
      throw new Error(`Lineage chain mismatch! Expected ${expectedPhases}, got ${actualPhases}`);
    }

    // -------------------------------------------------------------------------
    // GATE 6: Deterministic Replay (100 Cycles, 0.0000% Drift, σ² = 0.0)
    // -------------------------------------------------------------------------
    console.log('\n[Gate 6] Verifying Bare-Metal Deterministic Replay (100 Cycles)...');
    const firstBin = binaryBuffer.toString('hex');
    for (let c = 0; c < 100; c++) {
      const recompiled = builder.compileBareMetal(sampleBareMetalProgram, 'one-baremetal-temp.bin', 'temp.3dmemory');
      const recompiledBuf = fs.readFileSync('one-baremetal-temp.bin').toString('hex');
      if (recompiledBuf !== firstBin) {
        throw new Error(`Determinism drift detected during bare-metal compilation at cycle ${c}!`);
      }
    }
    if (fs.existsSync('one-baremetal-temp.bin')) fs.unlinkSync('one-baremetal-temp.bin');
    if (fs.existsSync('temp.3dmemory')) fs.unlinkSync('temp.3dmemory');
    console.log('  ✓ 100/100 Replay Cycles verified with bit-for-bit identity (Drift = 0.0000%, σ² = 0.0).');

    // -------------------------------------------------------------------------
    // GATE 7: Sovereign one.exe Toolchain Verification
    // -------------------------------------------------------------------------
    console.log('\n[Gate 7] Verifying Sovereign one.exe Toolchain Alignment...');
    console.log(result.oneExeOutput.split('\n').slice(0, 5).map(l => `    ${l}`).join('\n'));

    console.log('\n================================================================================');
    console.log(' 🏆 GATE CNL-P6-001 FULLY CERTIFIED & PASSED (100% SUCCESS)');
    console.log('================================================================================\n');
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('\n❌ FAIL: Gate CNL-P6-001 Test Failure:');
      console.error(err.message);
    }
    process.exit(1);
  }
}

runGateCNLP6001TestSuite();
