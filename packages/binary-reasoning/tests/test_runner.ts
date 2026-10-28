/**
 * ONE Binary 0/1 Reasoning Intelligence
 * Master Standalone Test Runner (tests/test_runner.ts)
 */

import { runPhase2BinaryTests } from './binary/binary_language.test';
import { runPhase3ReasoningTests } from './reasoning/reasoning_engine.test';
import { runIntegrationE2ETests } from './integration/bridge_e2e.test';
import { runPhase3Benchmarks } from './reasoning/reasoning_benchmark';

async function main() {
  console.log('\n================================================================================');
  console.log('  ONE BINARY 0/1 REASONING INTELLIGENCE — MASTER TEST SUITE');
  console.log('================================================================================\n');

  let passedSuites = 0;
  let totalSuites = 4;

  try {
    console.log('>>> RUNNING SUITE 1/4: Binary Language Protocol Tests...');
    runPhase2BinaryTests();
    passedSuites++;

    console.log('>>> RUNNING SUITE 2/4: Reasoning Intelligence Engine Tests...');
    runPhase3ReasoningTests();
    passedSuites++;

    console.log('>>> RUNNING SUITE 3/4: End-to-End Integration & Bridge Tests...');
    runIntegrationE2ETests();
    passedSuites++;

    console.log('>>> RUNNING SUITE 4/4: Deterministic Reasoning Benchmarks...');
    runPhase3Benchmarks();
    passedSuites++;

    console.log('================================================================================');
    console.log(`  ALL ${passedSuites}/${totalSuites} TEST SUITES COMPLETED WITH 100% SUCCESS!`);
    console.log('================================================================================\n');
    process.exit(0);
  } catch (error) {
    console.error('\n[TEST RUNNER CRITICAL ERROR] A test suite threw an unhandled exception:');
    console.error(error);
    process.exit(1);
  }
}

main();
