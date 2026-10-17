/**
 * Automated Verification Suite for Lattice-Secured Variable Sandboxing
 */

import { LatticeMemorySandbox } from '../lattice_sandbox';

function runLatticeSandboxTests(): void {
  console.log('================================================================================');
  console.log(' 🛡️ CUBIO LATTICE-SECURED VARIABLE SANDBOX & PQC MEMORY GUARD TEST');
  console.log('================================================================================\n');

  try {
    const sandbox = new LatticeMemorySandbox();

    // [Step 1] Allocate PQC-Secured Variable
    console.log('[Step 1] Allocating PQC-Secured Spatial Tensor Parameter...');
    const v1 = sandbox.allocate<number>('HarmonicFrequencyRatio', 'number', 0.369, { min: 0.0, max: 1.0 });
    console.log(`  ✓ Variable '${v1.name}' Allocated in Sandbox.`);
    console.log(`  - Initial Value  : ${v1.value}`);
    console.log(`  - Version        : v${v1.version}`);
    console.log(`  - PQC Root Seal  : ${v1.pqcSeal}`);

    // [Step 2] Valid Secure Read & Write Operations
    console.log('\n[Step 2] Executing Authenticated Secure Write & Read...');
    sandbox.write('HarmonicFrequencyRatio', 0.693);
    const readVal = sandbox.read<number>('HarmonicFrequencyRatio');
    console.log(`  ✓ Securely Updated Value to: ${readVal}`);
    if (readVal !== 0.693) {
      throw new Error('Read value mismatch after secure write!');
    }

    // [Step 3] Test Out-of-Bounds Rejection (Fail-Closed)
    console.log('\n[Step 3] Testing Strict Boundary Assertion (Out-of-Bounds Rejection)...');
    try {
      sandbox.write('HarmonicFrequencyRatio', 1.5); // Bound is [0.0, 1.0]
      throw new Error('FAIL: Out-of-bounds write should have been rejected!');
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('Sandbox Boundary Violation')) {
        console.log(`  ✓ Intercepted Boundary Violation: ${err.message}`);
      } else {
        throw err;
      }
    }

    // [Step 4] Simulate Memory Tampering Attack & Verify Quarantine Lock
    console.log('\n[Step 4] Simulating Unauthorized Memory Tampering / Side-Channel Injection...');
    sandbox.simulateTamperAttack('HarmonicFrequencyRatio', 0.9999); // Rogue modification
    console.log('  - Rogue injection applied directly to memory slot.');

    try {
      sandbox.read<number>('HarmonicFrequencyRatio');
      throw new Error('FAIL: Tampered variable should have triggered PQC seal breach!');
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('Cryptographic Integrity Breach')) {
        console.log(`  ✓ PQC Seal Breach Detected: ${err.message}`);
      } else {
        throw err;
      }
    }

    // [Step 5] Verify Quarantined Read Lock
    console.log('\n[Step 5] Verifying Permanent Quarantine Lock...');
    try {
      sandbox.read<number>('HarmonicFrequencyRatio');
      throw new Error('FAIL: Quarantined variable must remain inaccessible!');
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('QUARANTINED')) {
        console.log(`  ✓ Quarantine Lock Verified: ${err.message}`);
      } else {
        throw err;
      }
    }

    // [Step 6] 100-Cycle Determinism Replay Test
    console.log('\n[Step 6] Verifying Replay Determinism (100 Cycles, σ² = 0.0)...');
    for (let c = 0; c < 100; c++) {
      const s = new LatticeMemorySandbox();
      s.allocate('param', 'number', 0.369, { min: 0.0, max: 1.0 });
      s.write('param', 0.693);
      if (s.read('param') !== 0.693) {
        throw new Error(`Determinism drift at cycle ${c}!`);
      }
    }
    console.log('  ✓ 100/100 Replay Cycles executed with bit-for-bit exactness (Drift = 0.0000%, σ² = 0.0).');

    console.log('\n================================================================================');
    console.log(' 🏆 LATTICE-SECURED VARIABLE SANDBOXING FULLY CERTIFIED & PASSED (100%)');
    console.log('================================================================================\n');
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('\n❌ FAIL: Lattice Sandbox Test Error:');
      console.error(err.message);
    }
    process.exit(1);
  }
}

runLatticeSandboxTests();
