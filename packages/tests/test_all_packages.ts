/**
 * Multi-Package Sovereign Test Suite
 * Comprehensive Verification of all 5 Packages in packages/
 */

import { NLPSpatialParser } from '../nlp-parser';
import { SpatialASTEmitter } from '../ast-emitter';
import { PQCLatticeSealEngine, PQCMeshGuard } from '../pqc-lattice';
import { TimeTravelManager } from '../time-travel';
import { SovereignCLIEngine } from '../sovereign-cli';

function runAllPackagesTestSuite(): void {
  console.log('================================================================================');
  console.log(' 📦 SOVEREIGN PACKAGES MULTI-MODULE TEST SUITE');
  console.log('================================================================================\n');

  try {
    // -------------------------------------------------------------------------
    // Test 1: @one-lang/nlp-parser
    // -------------------------------------------------------------------------
    console.log('[Test 1] Testing @one-lang/nlp-parser...');
    const parser = new NLPSpatialParser();
    const urduIntent = parser.parsePrompt('Ek 4D spatial mesh banao jismein Node Alpha aur Node Beta 512 MB memory par chalayein.');
    if (urduIntent.languageDetected !== 'ROMAN_URDU' || urduIntent.nodes.length !== 2) {
      throw new Error('NLP Parser Roman Urdu verification failed!');
    }
    const engIntent = parser.parsePrompt('Create spatial topology with Node Alpha and Node Beta with 256 MB memory.');
    if (engIntent.languageDetected !== 'ENGLISH' || engIntent.rssMaxMb !== 256) {
      throw new Error('NLP Parser English verification failed!');
    }
    console.log('  ✓ @one-lang/nlp-parser passed (Bilingual parsing verified).');

    // -------------------------------------------------------------------------
    // Test 2: @one-lang/ast-emitter
    // -------------------------------------------------------------------------
    console.log('\n[Test 2] Testing @one-lang/ast-emitter...');
    const emitter = new SpatialASTEmitter();
    const emission = emitter.compilePromptToAST(urduIntent);
    if (!emission.generatedSourceCode.includes('rss_max = 512;') || emission.compiledAst.instructions.length === 0) {
      throw new Error('AST Emitter compilation failed!');
    }
    console.log(`  ✓ @one-lang/ast-emitter passed (${emission.compiledAst.instructions.length} bytecode instructions emitted).`);

    // -------------------------------------------------------------------------
    // Test 3: @one-lang/pqc-lattice
    // -------------------------------------------------------------------------
    console.log('\n[Test 3] Testing @one-lang/pqc-lattice...');
    const seal = PQCLatticeSealEngine.generatePQCSeal(Buffer.from('test_data', 'utf-8'));
    if (!seal.startsWith('0xPQC_369_') || !seal.endsWith('_SEAL')) {
      throw new Error('PQC Seal format invalid!');
    }
    const guard = new PQCMeshGuard();
    guard.registerTrustedPeer('Node_Alpha');
    const validPkt = guard.signPacket('Node_Alpha', 'Node_Beta', { val: 42 });
    const verdictValid = guard.verifyIncomingPacket(validPkt);
    if (!verdictValid.isAuthentic) {
      throw new Error('Valid packet rejected by PQC Guard!');
    }
    const tamperedPkt = { ...validPkt, payload: { val: 999 } };
    const verdictTampered = guard.verifyIncomingPacket(tamperedPkt);
    if (verdictTampered.isAuthentic || !verdictTampered.quarantined) {
      throw new Error('Tampered packet not quarantined by PQC Guard!');
    }
    console.log('  ✓ @one-lang/pqc-lattice passed (PQC root seals and tamper defense verified).');

    // -------------------------------------------------------------------------
    // Test 4: @one-lang/time-travel
    // -------------------------------------------------------------------------
    console.log('\n[Test 4] Testing @one-lang/time-travel...');
    const tt = new TimeTravelManager();
    const initialActors = [{ id: 'Node_Alpha', frequency: 9, mailboxSize: 0, stateVector: [0.1, 0.2, 0.3, 1.0] }];
    tt.captureSnapshot('CP_001', { val: 1 }, initialActors, 128);

    const rewound = tt.rewindToSnapshot('CP_001');
    if (JSON.stringify(rewound.actorStates) !== JSON.stringify(initialActors)) {
      throw new Error('Time-travel rewind state mismatch!');
    }
    console.log('  ✓ @one-lang/time-travel passed (Bit-exact rewind σ² = 0.0 verified).');

    // -------------------------------------------------------------------------
    // Test 5: @one-lang/sovereign-cli
    // -------------------------------------------------------------------------
    console.log('\n[Test 5] Testing @one-lang/sovereign-cli End-to-End Pipeline...');
    const cli = new SovereignCLIEngine();
    const report = cli.executeFullPipeline('Ek 4D spatial mesh banao jismein Node Alpha aur Node Beta 512 MB memory limit par sync hon.');
    if (!report.deterministicMatch || !report.packetVerification.isAuthentic) {
      throw new Error('Sovereign CLI end-to-end pipeline verification failed!');
    }
    console.log('  ✓ @one-lang/sovereign-cli passed (Full end-to-end pipeline verified).');

    console.log('\n================================================================================');
    console.log(' 🏆 ALL 5 PACKAGES IN packages/ FULLY CERTIFIED & PASSED (100% SUCCESS)');
    console.log('================================================================================\n');
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('\n❌ FAIL: Multi-Package Test Suite Failure:');
      console.error(err.message);
    }
    process.exit(1);
  }
}

runAllPackagesTestSuite();
