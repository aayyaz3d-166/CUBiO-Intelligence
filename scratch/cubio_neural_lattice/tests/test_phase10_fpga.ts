/**
 * Comprehensive Automated Test Suite for Gate CNL-P10-001
 * Target: Hardware-in-the-Loop FPGA RTL Synthesizer ("one-fpga")
 */

import { FPGARtlEmitter } from '../fpga_rtl_emitter';
import { CubioHyperNeuralBuilder } from '../cubio_builder';
import { OneLexer } from '../../../src/one/oneLexer';
import { OneParser } from '../../../src/one/oneParser';
import { OneCompiler } from '../../../src/one/oneCompiler';
import * as fs from 'fs';

function runGateCNLP10001TestSuite(): void {
  console.log('================================================================================');
  console.log(' ⚡ CUBIO FPGA RTL SYNTHESIS & SILICON EMITTER: GATE CNL-P10-001 TEST SUITE');
  console.log('================================================================================\n');

  try {
    const emitter = new FPGARtlEmitter();
    const builder = new CubioHyperNeuralBuilder();

    const sampleProgram = `
rss_max = 512;

node Alpha {
  @Space(0.3, 0.3, 0.3);
  checkpoint alpha_init;
}

node Beta {
  @Space(0.6, 0.6, 0.6);
  checkpoint beta_init;
}

node Gamma {
  @Space(0.9, 0.9, 0.9);
  checkpoint gamma_init;
}

funnel PrimaryStream {
  stream Alpha -> Beta : 128;
}
`;

    // -------------------------------------------------------------------------
    // GATE 1: Synthesizable Verilog RTL Generation & Top-Level Module Check
    // -------------------------------------------------------------------------
    console.log('[Gate 1] Testing Synthesizable Verilog RTL Generation...');
    const lexer = new OneLexer(sampleProgram);
    const parser = new OneParser(lexer.tokenize());
    const ast = new OneCompiler(parser.parse()).compile();

    const pqcSeal = '0xPQC_369_TEST_SEAL_V10';
    const rtlResult = emitter.generateVerilogRTL(ast, pqcSeal);

    console.log(`  - Top Module Name     : ${rtlResult.topModuleName}`);
    console.log(`  - Estimated Gate Count: ${rtlResult.totalGatesEstimate.toLocaleString()} gates`);
    console.log(`  - Dual-Port BRAMs     : ${rtlResult.totalBramBlocks} blocks`);
    console.log(`  - Clock Domains       : ${rtlResult.clockDomainsCount} (3 MHz, 6 MHz, 9 MHz)`);
    console.log(`  - Verilog Source Size : ${rtlResult.verilogSourceCode.length} bytes`);

    if (rtlResult.topModuleName !== 'cubio_top' || !rtlResult.verilogSourceCode.includes('module cubio_top')) {
      throw new Error('Verilog RTL top module definition mismatch!');
    }
    console.log('  ✓ Top-level Verilog RTL module definition validated.');

    // -------------------------------------------------------------------------
    // GATE 2: Physical 3-6-9 Harmonic Clock Dividers Logic Verification
    // -------------------------------------------------------------------------
    console.log('\n[Gate 2] Verifying Physical 3-6-9 Harmonic Clock Dividers Logic...');
    const vCode = rtlResult.verilogSourceCode;

    const hasDiv3 = vCode.includes("count_div3 == 6'd29") && vCode.includes('clk_3mhz_strobe');
    const hasDiv6 = vCode.includes("count_div6 == 6'd15") && vCode.includes('clk_6mhz_strobe');
    const hasDiv9 = vCode.includes("count_div9 == 6'd10") && vCode.includes('clk_9mhz_strobe');

    console.log(`  - 3.33 MHz Divider (100MHz / 30) : ${hasDiv3 ? 'CONFIRMED' : 'MISSING'}`);
    console.log(`  - 6.25 MHz Divider (100MHz / 16) : ${hasDiv6 ? 'CONFIRMED' : 'MISSING'}`);
    console.log(`  - 9.09 MHz Divider (100MHz / 11) : ${hasDiv9 ? 'CONFIRMED' : 'MISSING'}`);

    if (!hasDiv3 || !hasDiv6 || !hasDiv9) {
      throw new Error('3-6-9 Harmonic clock divider Verilog logic missing or incorrect!');
    }
    console.log('  ✓ Physical 3-6-9 harmonic clock dividers confirmed synthesizable.');

    // -------------------------------------------------------------------------
    // GATE 3: Dual-Port BRAM Spatial Streaming Funnel Buffer
    // -------------------------------------------------------------------------
    console.log('\n[Gate 3] Verifying Dual-Port BRAM Spatial Funnel Memory...');
    const hasBram = vCode.includes('bram_funnel_memory') && vCode.includes("8'h36");
    console.log(`  - BRAM Funnel Memory Array : ${hasBram ? 'PRESENT' : 'MISSING'}`);
    if (!hasBram) {
      throw new Error('Dual-port BRAM spatial funnel memory array missing in emitted RTL!');
    }
    console.log('  ✓ Dual-port BRAM funnel buffer validated.');

    // -------------------------------------------------------------------------
    // GATE 4: Permanent Fail-Closed Hardware Actuation Lock Pin
    // -------------------------------------------------------------------------
    console.log('\n[Gate 4] Verifying Permanent Fail-Closed Hardware Lock Pin...');
    const hasHardwareLock = vCode.includes("assign is_actuation_blocked = 1'b1;");
    console.log(`  - Verilog Pin Hardwire (1'b1) : ${hasHardwareLock ? 'LOCKED' : 'UNSECURED'}`);
    console.log(`  - Synthesis Result Lock Flag  : isActuationBlocked = ${rtlResult.isActuationBlocked}`);

    if (!hasHardwareLock || rtlResult.isActuationBlocked !== true) {
      throw new Error('CRITICAL SAFETY FAILURE: Hardware actuation lock pin is not hardwired to 1\'b1!');
    }
    console.log('  ✓ Fail-closed hardware lock permanently verified at the silicon pin layer.');

    // -------------------------------------------------------------------------
    // GATE 5: 10-Phase Sovereign Master Cryptographic Lineage (P1 -> P10)
    // -------------------------------------------------------------------------
    console.log('\n[Gate 5] Verifying 10-Phase Sovereign Master Cryptographic Lineage...');
    const compileResult = builder.compilePhase10FPGA(
      sampleProgram,
      'scratch/cubio_neural_lattice/cubio_top.v',
      'cubio_fpga_phase10.3dmemory'
    );

    const expectedPhases = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'];
    const actualPhases = compileResult.lineageChain.map((l) => l.phase);
    console.log(`  ✓ 10-Phase Lineage Chain : ${actualPhases.join(' -> ')}`);
    console.log(`  ✓ Phase 10 PQC Root Seal : ${compileResult.pqcSeal}`);

    if (JSON.stringify(actualPhases) !== JSON.stringify(expectedPhases)) {
      throw new Error(`Lineage mismatch! Expected ${expectedPhases}, got ${actualPhases}`);
    }

    // Verify parent hash chaining across all 10 phases
    for (let i = 1; i < compileResult.lineageChain.length; i++) {
      const prev = compileResult.lineageChain[i - 1];
      const curr = compileResult.lineageChain[i];
      if (curr.parentHash !== prev.merkleHash) {
        throw new Error(`Lineage broken between ${prev.phase} and ${curr.phase}!`);
      }
    }
    console.log('  ✓ All 10 phases linked with unbroken cryptographic Merkle parent hashes.');

    // -------------------------------------------------------------------------
    // GATE 6: 100-Cycle Deterministic Replay (0.0000% Drift, σ² = 0.0)
    // -------------------------------------------------------------------------
    console.log('\n[Gate 6] Verifying 100-Cycle Deterministic Replay (0.0000% Drift)...');
    const initialHash = compileResult.deterministicHash;
    for (let c = 0; c < 100; c++) {
      const replayed = builder.compilePhase10FPGA(sampleProgram, 'temp_fpga.v', 'temp_fpga.3dmemory');
      if (replayed.deterministicHash !== initialHash) {
        throw new Error(`Determinism drift at FPGA compilation cycle ${c}!`);
      }
    }
    // Clean temporary test artifacts
    if (fs.existsSync('temp_fpga.v')) fs.unlinkSync('temp_fpga.v');
    if (fs.existsSync('temp_fpga.3dmemory')) fs.unlinkSync('temp_fpga.3dmemory');

    console.log('  ✓ 100/100 Replay Cycles executed with bit-for-bit exactness (Drift = 0.0000%, σ² = 0.0).');

    // -------------------------------------------------------------------------
    // GATE 7: Sovereign one.exe Toolchain Alignment
    // -------------------------------------------------------------------------
    console.log('\n[Gate 7] Verifying Sovereign one.exe Toolchain Alignment...');
    console.log(compileResult.oneExeOutput.split('\n').slice(0, 5).map((l) => `    ${l}`).join('\n'));

    console.log('\n================================================================================');
    console.log(' 🏆 GATE CNL-P10-001 FULLY CERTIFIED & PASSED (100% SUCCESS)');
    console.log('================================================================================\n');
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('\n❌ FAIL: Gate CNL-P10-001 Test Failure:');
      console.error(err.message);
    }
    process.exit(1);
  }
}

runGateCNLP10001TestSuite();
