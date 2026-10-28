/**
 * ONE Language — Qplayer Execution Architecture (Phase 4 POC Test)
 * =================================================================
 * poc_execution.test.ts: End-to-End Proof of Concept (5 + 3 = 8) & Differential Comparison
 */

import * as assert from 'assert';
import { Qplayer } from '../../src/qplayer/index';
import { QBinaryDecoder } from '../../src/qplayer/binary/QBinaryDecoder';
import { UnifiedCompiler } from '../../src/one/UnifiedCompiler';

export async function runPOCTests(): Promise<void> {
  console.log('\n================================================================================');
  console.log('  QPLAYER — PHASE 4: PROOF OF CONCEPT (POC) EXECUTION VERIFICATION');
  console.log('================================================================================\n');

  // ── Step 1: Define Target Proof-of-Concept Program ────────────────────────
  console.log('[Step 1] Initializing Proof-of-Concept Program...');
  const pocSource = `let a = 5;
let b = 3;
let result = a + b;
print result;
`;
  console.log('Source Code:\n' + pocSource);

  // ── Step 2: Compile to One Binary Intelligence (OBI) ──────────────────────
  console.log('[Step 2] Compiling and Encoding into One Binary Intelligence (.obi)...');
  const compileStart = performance.now();
  const obiBuffer = Qplayer.compileToOBI(pocSource);
  const compileTimeMs = performance.now() - compileStart;

  assert.ok(obiBuffer.length > 32, 'Binary size must be greater than header size');
  console.log(`  ✔ OBI Binary generated: ${obiBuffer.length} bytes (compiled in ${compileTimeMs.toFixed(2)}ms)`);

  // ── Step 3: Inspect Decoded Program ───────────────────────────────────────
  console.log('[Step 3] Inspecting Decoded OBI Program Structure...');
  const decoded = QBinaryDecoder.decode(obiBuffer);
  console.log(`  - Magic:             ${decoded.header.magic.toString('ascii')}`);
  console.log(`  - Version:           v${decoded.header.versionMajor}.${decoded.header.versionMinor}`);
  console.log(`  - Instruction Count: ${decoded.instructions.length}`);
  console.log(`  - Constants Pool:    ${JSON.stringify(decoded.constants)}`);
  console.log(`  - CRC32 Checksum:    0x${decoded.header.checksumCRC32.toString(16)}`);

  // ── Step 4: Execute on Qplayer Runtime ────────────────────────────────────
  console.log('\n[Step 4] Executing on Qplayer Runtime...');
  const execResult = Qplayer.runBinary(obiBuffer);

  assert.ok(execResult.success, `Qplayer execution failed: ${execResult.error?.message}`);
  assert.strictEqual(execResult.output.length, 1, 'Expected 1 output line');
  assert.strictEqual(execResult.output[0], '8', `Expected output '8', got '${execResult.output[0]}'`);
  console.log(`  ✔ Qplayer Output: ${execResult.output[0]}`);
  console.log(`  ✔ Instructions Executed: ${execResult.instructionsExecuted}`);
  console.log(`  ✔ Execution Time: ${execResult.executionTimeMs.toFixed(2)}ms`);

  // ── Step 5: Differential Comparison Against UnifiedVM ─────────────────────
  console.log('\n[Step 5] Running Differential Verification Against UnifiedVM...');
  const compiler = new UnifiedCompiler();
  const vmCompResult = compiler.execute(pocSource);

  assert.ok(vmCompResult.compilation.success, 'UnifiedCompiler compilation must succeed');
  assert.ok(vmCompResult.vmResult?.success, 'UnifiedVM execution must succeed');
  const vmOutput = vmCompResult.vmResult?.output[0];
  console.log(`  ✔ UnifiedVM Output: ${vmOutput}`);

  assert.strictEqual(
    execResult.output[0],
    vmOutput,
    `Qplayer output (${execResult.output[0]}) must match UnifiedVM output (${vmOutput}) bit-for-bit`
  );
  console.log('  ✔ Output parity confirmed: Qplayer and UnifiedVM produced IDENTICAL result (8).');

  // ── Step 6: Binary Density Metric ─────────────────────────────────────────
  console.log('\n[Step 6] Computing Density & Metric Report...');
  const irJsonSize = Buffer.byteLength(JSON.stringify(vmCompResult.compilation.ir || {}));
  console.log(`  - UnifiedVM JSON IR Size: ${irJsonSize} bytes`);
  console.log(`  - Qplayer OBI Binary Size: ${obiBuffer.length} bytes`);
  const compressionRatio = ((1 - obiBuffer.length / irJsonSize) * 100).toFixed(1);
  console.log(`  - Binary Footprint Reduction: ~${compressionRatio}% smaller than JSON IR!`);

  console.log('\n================================================================================');
  console.log('  QPLAYER PROOF-OF-CONCEPT PASSED WITH 100% SUCCESS');
  console.log('================================================================================\n');
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('poc_execution.test.ts')) {
  runPOCTests().catch((err) => {
    console.error('\n[FATAL TEST ERROR]:', err);
    process.exit(1);
  });
}
