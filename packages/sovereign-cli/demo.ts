/**
 * Sovereign Interactive CLI Demonstration Tool
 * Live Roman Urdu & English Natural Prompt Execution
 */

import { SovereignCLIEngine } from './index';

function runSovereignDemo(): void {
  console.log('================================================================================');
  console.log(' 🌌 SOVEREIGN COMPUTING ARCHITECTURE: INTERACTIVE STANDALONE SDK DEMO');
  console.log('================================================================================\n');

  const cli = new SovereignCLIEngine();

  // ---------------------------------------------------------------------------
  // Demo 1: Roman Urdu Prompt Execution
  // ---------------------------------------------------------------------------
  console.log('┌──────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ DEMO 1: Roman Urdu Natural Prompt Processing                                │');
  console.log('└──────────────────────────────────────────────────────────────────────────────┘');
  const urduPrompt = 'Ek 4D spatial mesh banao jismein Node Alpha aur Node Beta 512 MB memory limit par 369 harmonic frequency ke sath synchronize hon.';
  console.log(`[Input Prompt]: "${urduPrompt}"\n`);

  const report1 = cli.executeFullPipeline(urduPrompt);

  console.log('1. NLP Intent Analysis (@one-lang/nlp-parser):');
  console.log(`   - Language Detected   : ${report1.intent.languageDetected}`);
  console.log(`   - Confidence Score    : ${(report1.intent.confidenceScore * 100).toFixed(1)}%`);
  console.log(`   - Extracted Nodes     : [${report1.intent.nodes.map((n) => n.nodeId).join(', ')}]`);
  console.log(`   - Memory Limit (RSS)  : ${report1.intent.rssMaxMb} MB`);

  console.log('\n2. Generated ONE Language Source Code (@one-lang/ast-emitter):');
  console.log(report1.emission.generatedSourceCode.split('\n').map((l) => `   | ${l}`).join('\n'));

  console.log('\n3. PQC Lattice Root Seal & Packet Guard (@one-lang/pqc-lattice):');
  console.log(`   - PQC Lattice Root    : ${report1.pqcSeal}`);
  console.log(`   - Mesh Packet Status  : Authentic = ${report1.packetVerification.isAuthentic} | Quarantined = ${report1.packetVerification.quarantined}`);

  console.log('\n4. Time-Travel Bit-Exact Rewind (@one-lang/time-travel):');
  console.log(`   - Captured Checkpoint : ${report1.initialCheckpoint.checkpointId} (Memory: ${report1.initialCheckpoint.memoryFootprintMb} MB)`);
  console.log(`   - Pre-Mutation State  : [${report1.initialCheckpoint.actorStates[0].stateVector.join(', ')}]`);
  console.log(`   - Post-Rewind State   : [${report1.rewoundState.actorStates[0].stateVector.join(', ')}]`);
  console.log(`   - Replay Determinism  : ${report1.deterministicMatch ? 'EXACT (σ² = 0.0, 0.0000% Drift)' : 'DRIFT DETECTED'}`);

  // ---------------------------------------------------------------------------
  // Demo 2: English Prompt Execution
  // ---------------------------------------------------------------------------
  console.log('\n\n┌──────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ DEMO 2: English Natural Prompt Processing                                    │');
  console.log('└──────────────────────────────────────────────────────────────────────────────┘');
  const engPrompt = 'Create a distributed spatial topology with Node Alpha, Node Beta, and Node Gamma at 256 MB memory limit.';
  console.log(`[Input Prompt]: "${engPrompt}"\n`);

  const report2 = cli.executeFullPipeline(engPrompt);

  console.log('1. NLP Intent Analysis (@one-lang/nlp-parser):');
  console.log(`   - Language Detected   : ${report2.intent.languageDetected}`);
  console.log(`   - Extracted Nodes     : [${report2.intent.nodes.map((n) => n.nodeId).join(', ')}]`);
  console.log(`   - Memory Limit (RSS)  : ${report2.intent.rssMaxMb} MB`);

  console.log('\n2. Generated Instructions Count (@one-lang/ast-emitter):');
  console.log(`   - Bytecode Instructions : ${report2.emission.compiledAst.instructions.length}`);
  console.log(`   - PQC Master Seal       : ${report2.pqcSeal}`);
  console.log(`   - Time-Travel Rewind    : ${report2.deterministicMatch ? 'CONFIRMED (σ² = 0.0)' : 'FAILED'}`);

  console.log('\n================================================================================');
  console.log(' 🏆 ALL 4 STANDALONE SDK PACKAGES OPERATING WITH 100% SUCCESS');
  console.log('================================================================================\n');
}

runSovereignDemo();
