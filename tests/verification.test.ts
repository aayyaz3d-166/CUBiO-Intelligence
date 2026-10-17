/**
 * ONE Language & CubiO Spatial VM - Phase 1 Prototype
 * Verification Test Suite (tests/verification.test.ts)
 */

import { BitAgent } from '../src/vm/bitAgent';
import { EntropyEngine } from '../src/vm/entropyEngine';
import { GridMemory } from '../src/vm/gridMemory';
import { CubioVM, Opcode } from '../src/vm/cubioVM';
import { OneCompiler } from '../src/compiler/oneCompiler';
import { runPhase1Pipeline } from '../src/index';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

function assertClose(actual: number, expected: number, tol: number = 1e-4, msg: string = '') {
  if (Math.abs(actual - expected) > tol) {
    throw new Error(`ASSERTION FAILED: ${msg} (Actual: ${actual}, Expected: ${expected})`);
  }
}

export function runAllTests() {
  console.log('[TEST SUITE] Starting ONE Language & CubiO Spatial VM Tests...\n');

  // Test 1: BitAgent Bit Density & Classification
  console.log('-> Running BitAgent Unit Tests...');
  const bitAgent = new BitAgent(64);

  // All zeros
  const zeros = bitAgent.analyze('0000000000000000');
  assert(zeros.bitDensity === 0, 'Zeros bit density must be 0');
  assert(zeros.classification === 'LOW_ENTROPY_PATTERN', 'Zeros must be LOW_ENTROPY_PATTERN');
  assert(zeros.fastPathEligible === true, 'Zeros should be fast-path eligible');

  // All ones
  const ones = bitAgent.analyze('1111111111111111');
  assert(ones.bitDensity === 1, 'Ones bit density must be 1');
  assert(ones.classification === 'LOW_ENTROPY_PATTERN', 'Ones must be LOW_ENTROPY_PATTERN');

  // Alternating stream
  let alternating = '';
  for (let i = 0; i < 64; i++) alternating += i % 2 === 0 ? '0' : '1';
  const altRes = bitAgent.analyze(alternating);
  assert(altRes.bitDensity === 0.5, 'Alternating density must be 0.5');
  assert(altRes.classification === 'HIGH_DENSITY_STREAM', 'Alternating should be HIGH_DENSITY_STREAM');
  assert(altRes.slidingHammingWeights[0] === 32, 'Alternating 64-bit Hamming weight must be 32');
  console.log('   [PASS] BitAgent tests passed.');

  // Test 2: Native Entropy Engine & Eigenvalue / Von Neumann Entropy
  console.log('-> Running EntropyEngine Unit Tests...');
  const entropyEngine = new EntropyEngine();

  // Pure single-state stream (|00> only) -> Entropy should be 0.0
  const pure00 = entropyEngine.analyze('0000000000000000');
  assertClose(pure00.vonNeumannEntropy, 0.0, 1e-6, 'Pure state entropy must be 0.0');
  assert(pure00.isPureState, 'Pure state flag must be true');
  assertClose(pure00.purity, 1.0, 1e-4, 'Pure state purity must be 1.0');

  // Uniform stream (equal distribution of 00, 01, 10, 11) -> Entropy must be 2.0
  const uniformBits = '00011011000110110001101100011011';
  const uniformRes = entropyEngine.analyze(uniformBits);
  assertClose(uniformRes.vonNeumannEntropy, 2.0, 1e-6, 'Uniform distribution entropy must be 2.0');
  assertClose(uniformRes.purity, 0.25, 1e-4, 'Maximal mixed purity must be 0.25');

  // Edge case 0 log 0 = 0 handling: 2 states present (00 and 11 equally) -> Entropy must be 1.0
  const halfBits = '0011001100110011';
  const halfRes = entropyEngine.analyze(halfBits);
  assertClose(halfRes.vonNeumannEntropy, 1.0, 1e-4, '50/50 mixture entropy must be 1.0');
  console.log('   [PASS] EntropyEngine tests passed.');

  // Test 3: 3D Spatial Memory Grid Lattice
  console.log('-> Running GridMemory Unit Tests...');
  const memory = new GridMemory();
  assert(GridMemory.TOTAL_CELLS === 343, 'Total cells must be 343');

  // Boundary coordinates
  const origin = { x: 0, y: 0, z: 0 };
  const center = { x: 3, y: 3, z: 3 };
  const corner = { x: 6, y: 6, z: 6 };

  assert(GridMemory.coordToIndex(origin) === 0, 'Origin index must be 0');
  assert(GridMemory.coordToIndex(center) === 171, 'Center index must be 171');
  assert(GridMemory.coordToIndex(corner) === 342, 'Corner index must be 342');

  // Write and Read
  const testBytes = new Uint8Array([1, 2, 3, 4, 5]);
  memory.write(center, testBytes, { bitDensity: 0.5, entropyScore: 1.5 });
  const readCell = memory.read(center);
  assert(readCell !== null, 'Cell at center must not be null');
  assert(readCell!.occupied === true, 'Cell must be occupied');
  assert(readCell!.data!.length === 5, 'Cell data length must be 5');
  assert(readCell!.bitDensity === 0.5, 'Cell bitDensity must match');
  assert(readCell!.entropyScore === 1.5, 'Cell entropyScore must match');

  // Boundary check validation
  let outOfBoundsCaught = false;
  try {
    memory.read({ x: 7, y: 3, z: 3 });
  } catch {
    outOfBoundsCaught = true;
  }
  assert(outOfBoundsCaught, 'Out of bounds coordinate must throw RangeError');

  // Spatial Broadcast
  const bcCount = memory.broadcast({ x: 1, y: 1, z: 1 }, 1, new Uint8Array([9]));
  assert(bcCount === 27, 'Radius 1 broadcast around [1,1,1] must write 27 cells (3x3x3)');

  // Dynamic Entropy-Aware Routing
  const lowEntropyCoord = memory.allocateByEntropy(0.1, 0.1);
  assert(
    Math.max(
      Math.abs(lowEntropyCoord.x - 3),
      Math.abs(lowEntropyCoord.y - 3),
      Math.abs(lowEntropyCoord.z - 3)
    ) <= 1,
    'Low entropy should be routed near center [3,3,3]'
  );
  console.log('   [PASS] GridMemory tests passed.');

  // Test 4: ONE Compiler & CubiO VM Pipeline
  console.log('-> Running Compiler & CubiO VM Integration Tests...');
  const compiler = new OneCompiler();
  const testSrc = `
    spatial grid: Cube(7, 7, 7);
    let sample = "CUBIO_SYSTEM";
    cell[2, 3, 4].write(sample);
    cell[2, 3, 4].read();
    entropy.analyze(sample);
  `;
  const compRes = compiler.compile(testSrc);
  assert(compRes.instructions.length >= 4, 'Compiler must produce instructions');

  const vm = new CubioVM();
  const vmRes = vm.run(compRes.instructions, false); // disable dynamic dispatch for pinned cell tests
  assert(vmRes.cyclesExecuted >= 4, 'VM must execute instructions');
  const readBack = vm.memory.read({ x: 2, y: 3, z: 4 });
  assert(readBack !== null, 'VM written cell must exist');
  assert(readBack!.occupied === true, 'VM written cell must be occupied');
  console.log('   [PASS] Compiler & CubiO VM tests passed.');

  // Test 5: End-to-End Verification Pipeline
  console.log('-> Running Full End-to-End Pipeline Verification...');
  const e2e = runPhase1Pipeline('ONE_LANGUAGE_PHASE_1');
  assert(e2e.storedCell.occupied, 'Stored cell must be occupied');
  assert(e2e.entropyAnalysis.vonNeumannEntropy > 0, 'Entropy must be positive');
  assert(e2e.bitAnalysis.totalBits === 20 * 8, 'Total bits must match 20 bytes * 8 = 160 bits');
  console.log('   [PASS] Full End-to-End Pipeline passed.');

  console.log('\n[SUCCESS] ALL VERIFICATION TESTS PASSED SUCCESSFULLY (100%).\n');
}

if (require.main === module) {
  runAllTests();
}
