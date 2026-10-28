/**
 * CUBiO AI — ONE LANGUAGE — TASK 04
 * =================================
 * Native Canonical 369 Addressing System Interface Verification Suite
 *
 * Verifies:
 *   - Gate 1: 369 Address Space Partitioning & Symbolic/Spatial Layer Verification
 *   - Gate 2: Exhaustive 343-Cell Bijective Coordinate Roundtrip (100% Bijection)
 *   - Gate 3: UI Display Index 1-to-1 Mapping ([1..369] <-> [0..368])
 *   - Gate 4: Fail-Closed Bounds Validation & Error Attribution (E7012, E7013)
 *   - Gate 5: Continuous Quantization, Spatial References & Permission Enforcement
 *   - Gate 6: Topological Traversal, Neighbors & Volumetric Slicing
 *   - Gate 7: 100-Cycle Deterministic Replay (sigma^2 = 0.0) & Sovereignty Lock
 */

import {
  OneAddress369,
  SpatialBridge,
  CanonicalRef,
  createInt,
  OneNativeRuntimeError,
} from '../../../src/one';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(`Assertion Failure: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runTask04VerificationSuite(): Promise<void> {
  console.log('================================================================================');
  console.log(' 📍 CUBiO AI — ONE LANGUAGE — TASK 04: CANONICAL 369 ADDRESSING INTERFACE');
  console.log('================================================================================\n');

  // ===========================================================================
  // Gate 1: 369 Address Space Partitioning & Layer Verification
  // ===========================================================================
  console.log('[Gate 1] Verifying 369 Address Space Partitioning...');

  assert(OneAddress369.TOTAL_ADDRESSES === 369, 'Total canonical address space is 369 cells');
  assert(OneAddress369.SYMBOLIC_COUNT === 26, 'Symbolic layer contains exactly 26 registers');
  assert(OneAddress369.SPATIAL_COUNT === 343, 'Spatial layer contains exactly 343 cells (7x7x7)');
  assert(OneAddress369.SYMBOLIC_START === 0 && OneAddress369.SYMBOLIC_END === 25, 'Symbolic range is [0..25]');
  assert(OneAddress369.SPATIAL_START === 26 && OneAddress369.SPATIAL_END === 368, 'Spatial range is [26..368]');

  // Classification
  assert(OneAddress369.isSymbolic(0) === true, 'Address 0 is symbolic');
  assert(OneAddress369.isSymbolic(25) === true, 'Address 25 is symbolic');
  assert(OneAddress369.isSymbolic(26) === false, 'Address 26 is NOT symbolic');

  assert(OneAddress369.isSpatial(26) === true, 'Address 26 is spatial');
  assert(OneAddress369.isSpatial(197) === true, 'Address 197 is spatial');
  assert(OneAddress369.isSpatial(368) === true, 'Address 368 is spatial');
  assert(OneAddress369.isSpatial(25) === false, 'Address 25 is NOT spatial');

  // Metadata Inspection
  const symInfo = OneAddress369.inspectAddress(0);
  assert(symInfo.layer === 'SYMBOLIC', 'Address 0 layer is SYMBOLIC');
  assert(symInfo.symbolicKey === 'SYM_A_00', 'Address 0 symbolic key is SYM_A_00');
  assert(symInfo.displayIndex === 1, 'Address 0 display index is 1');

  const originInfo = OneAddress369.inspectAddress(26);
  assert(originInfo.layer === 'SPATIAL', 'Address 26 layer is SPATIAL');
  assert(originInfo.spatialCoord?.i === 0 && originInfo.spatialCoord?.j === 0 && originInfo.spatialCoord?.k === 0, 'Address 26 coord is (0,0,0)');
  assert(originInfo.displayIndex === 27, 'Address 26 display index is 27');

  const centerInfo = OneAddress369.inspectAddress(197);
  assert(centerInfo.layer === 'SPATIAL', 'Address 197 layer is SPATIAL');
  assert(centerInfo.spatialCoord?.i === 3 && centerInfo.spatialCoord?.j === 3 && centerInfo.spatialCoord?.k === 3, 'Address 197 is center (3,3,3)');
  assert(centerInfo.displayIndex === 198, 'Address 197 display index is 198');

  console.log('  Gate 1 Passed: 369 address space partitioning verified.\n');

  // ===========================================================================
  // Gate 2: Exhaustive 343-Cell Bijective Coordinate Roundtrip
  // ===========================================================================
  console.log('[Gate 2] Verifying Exhaustive 343-Cell Bijective Coordinate Roundtrip...');

  const seenAddresses = new Set<number>();
  let bijectionValid = true;

  for (let k = 0; k < 7; k++) {
    for (let j = 0; j < 7; j++) {
      for (let i = 0; i < 7; i++) {
        const expectedAddress = 26 + (i + 7 * j + 49 * k);
        const calculatedAddress = OneAddress369.coordToAddress(i, j, k);

        if (calculatedAddress !== expectedAddress) {
          bijectionValid = false;
          break;
        }

        seenAddresses.add(calculatedAddress);

        const roundtripCoord = OneAddress369.addressToCoord(calculatedAddress);
        if (roundtripCoord.i !== i || roundtripCoord.j !== j || roundtripCoord.k !== k) {
          bijectionValid = false;
          break;
        }
      }
    }
  }

  assert(bijectionValid, 'All 343 coordinates map with exact mathematical identity');
  assert(seenAddresses.size === 343, 'All 343 addresses in [26..368] uniquely populated');
  assert(Math.min(...Array.from(seenAddresses)) === 26, 'Lowest spatial address is 26');
  assert(Math.max(...Array.from(seenAddresses)) === 368, 'Highest spatial address is 368');

  console.log('  Gate 2 Passed: 343-cell bijective coordinate roundtrip certified.\n');

  // ===========================================================================
  // Gate 3: UI Display Index 1-to-1 Mapping ([1..369] <-> [0..368])
  // ===========================================================================
  console.log('[Gate 3] Verifying UI Display Index 1-to-1 Mapping...');

  assert(OneAddress369.toDisplayIndex(0) === 1, 'Address 0 -> Display Index 1');
  assert(OneAddress369.toDisplayIndex(25) === 26, 'Address 25 -> Display Index 26');
  assert(OneAddress369.toDisplayIndex(26) === 27, 'Address 26 -> Display Index 27');
  assert(OneAddress369.toDisplayIndex(197) === 198, 'Address 197 -> Display Index 198');
  assert(OneAddress369.toDisplayIndex(368) === 369, 'Address 368 -> Display Index 369');

  assert(OneAddress369.fromDisplayIndex(1) === 0, 'Display Index 1 -> Address 0');
  assert(OneAddress369.fromDisplayIndex(27) === 26, 'Display Index 27 -> Address 26');
  assert(OneAddress369.fromDisplayIndex(198) === 197, 'Display Index 198 -> Address 197');
  assert(OneAddress369.fromDisplayIndex(369) === 368, 'Display Index 369 -> Address 368');

  // Formatter
  assert(
    OneAddress369.formatDisplayIndex(197) === 'Display Index [198..369] (Internal: 197)',
    'Display index formatted string matches standard canonical notation'
  );

  console.log('  Gate 3 Passed: UI display index mapping verified.\n');

  // ===========================================================================
  // Gate 4: Fail-Closed Bounds Validation & Error Attribution
  // ===========================================================================
  console.log('[Gate 4] Verifying Fail-Closed Bounds Validation...');

  // 1. Negative address
  let caughtNegAddr = false;
  try {
    OneAddress369.validateAddress(-1);
  } catch (err: any) {
    caughtNegAddr = true;
    assert(err instanceof OneNativeRuntimeError, 'Negative address throws OneNativeRuntimeError');
    assert(err.code === 'E7013', 'Error code is E7013');
  }
  assert(caughtNegAddr, 'Negative address rejected fail-closed');

  // 2. Out-of-bounds address > 368
  let caughtHighAddr = false;
  try {
    OneAddress369.validateAddress(369);
  } catch (err: any) {
    caughtHighAddr = true;
    assert(err.code === 'E7013', 'Address 369 throws E7013');
  }
  assert(caughtHighAddr, 'Address 369 rejected fail-closed');

  // 3. Symbolic address passed to spatial validator
  let caughtSymSpatial = false;
  try {
    OneAddress369.validateSpatialAddress(25);
  } catch (err: any) {
    caughtSymSpatial = true;
    assert(err.code === 'E7013', 'Symbolic address in spatial validator throws E7013');
  }
  assert(caughtSymSpatial, 'Symbolic address rejected in spatial validator');

  // 4. Out-of-bounds coordinate
  let caughtCoordOob = false;
  try {
    OneAddress369.validateCoord(7, 0, 0);
  } catch (err: any) {
    caughtCoordOob = true;
    assert(err.code === 'E7012', 'Coordinate 7 throws E7012');
  }
  assert(caughtCoordOob, 'Coordinate > 6 rejected fail-closed');

  // 5. Display Index 0 or 370
  let caughtDispOob = false;
  try {
    OneAddress369.validateDisplayIndex(0);
  } catch (err: any) {
    caughtDispOob = true;
    assert(err.code === 'E7013', 'Display index 0 throws E7013');
  }
  assert(caughtDispOob, 'Display index 0 rejected fail-closed');

  console.log('  Gate 4 Passed: Fail-closed bounds validation verified.\n');

  // ===========================================================================
  // Gate 5: Continuous Quantization, Spatial References & Permissions
  // ===========================================================================
  console.log('[Gate 5] Verifying Continuous Quantization & Spatial References...');

  // Quantization
  const qCenter = OneAddress369.quantizeContinuousCoord(0.5, 0.5, 0.5);
  assert(qCenter.i === 3 && qCenter.j === 3 && qCenter.k === 3, '(0.5, 0.5, 0.5) quantizes to center (3,3,3)');

  const qOrigin = OneAddress369.quantizeContinuousCoord(0.0, 0.0, 0.0);
  assert(qOrigin.i === 0 && qOrigin.j === 0 && qOrigin.k === 0, '(0.0, 0.0, 0.0) quantizes to origin (0,0,0)');

  const qCorner = OneAddress369.quantizeContinuousCoord(1.0, 1.0, 1.0);
  assert(qCorner.i === 6 && qCorner.j === 6 && qCorner.k === 6, '(1.0, 1.0, 1.0) quantizes to corner (6,6,6)');

  // Unquantize
  const uCenter = OneAddress369.unquantizeToContinuousCoord(3, 3, 3);
  assert(Math.abs(uCenter.x - 0.5) < 1e-6, '(3,3,3) unquantizes to x=0.5');

  // Spatial Reference with SpatialBridge
  const bridge = new SpatialBridge({ actuationLock: false });
  bridge.set(3, 3, 3, 999);

  const spatialRef = OneAddress369.createSpatialRef(3, 3, 3, bridge, 'READ_WRITE');
  assert(spatialRef.toURI() === 'one://spatial/3/3/3#addr197', 'Spatial reference URI anchors canonical address #addr197');
  assert(spatialRef.deref().value === 999, 'Spatial reference dereference reads initial voxel value');

  spatialRef.assign(createInt(1234));
  assert(bridge.get(3, 3, 3) === 1234, 'Spatial reference assignment successfully mutates voxel');

  // Read-Only Reference
  const roRef = OneAddress369.createSpatialRef(0, 0, 0, bridge, 'READ_ONLY');
  let roErrorCaught = false;
  try {
    roRef.assign(createInt(1));
  } catch (err: any) {
    roErrorCaught = true;
    assert(err.message.includes('READ_ONLY'), 'Assignment to READ_ONLY spatial ref threw error');
  }
  assert(roErrorCaught, 'READ_ONLY spatial reference safely protected against mutation');

  console.log('  Gate 5 Passed: Continuous quantization & spatial references verified.\n');

  // ===========================================================================
  // Gate 6: Topological Traversal, Neighbors & Volumetric Slicing
  // ===========================================================================
  console.log('[Gate 6] Verifying Topological Traversal, Neighbors & Slicing...');

  // 1. Corner (0,0,0) 6-neighbors -> exactly 3 inside boundary
  const cornerNeighbors = OneAddress369.getNeighbors6(0, 0, 0);
  assert(cornerNeighbors.length === 3, 'Origin corner (0,0,0) has exactly 3 neighbors within 7x7x7 grid');

  // 2. Center (3,3,3) 6-neighbors -> exactly 6
  const centerNeighbors6 = OneAddress369.getNeighbors6(3, 3, 3);
  assert(centerNeighbors6.length === 6, 'Center voxel (3,3,3) has exactly 6 Manhattan neighbors');

  // 3. Center (3,3,3) 26-neighbors -> exactly 26
  const centerNeighbors26 = OneAddress369.getNeighbors26(3, 3, 3);
  assert(centerNeighbors26.length === 26, 'Center voxel (3,3,3) has exactly 26 Moore neighbors');

  // 4. Distance metrics
  const distMan = OneAddress369.distanceManhattan({ i: 0, j: 0, k: 0 }, { i: 3, j: 3, k: 3 });
  assert(distMan === 9, 'Manhattan distance (0,0,0) to (3,3,3) is 9 (3+3+3)');

  const distCheb = OneAddress369.distanceChebyshev({ i: 0, j: 0, k: 0 }, { i: 3, j: 3, k: 3 });
  assert(distCheb === 3, 'Chebyshev distance (0,0,0) to (3,3,3) is 3');

  // 5. Layer K Slicing
  const layer0 = OneAddress369.sliceLayerK(0);
  assert(layer0.length === 49, 'Layer k=0 contains exactly 49 addresses (7x7)');
  assert(layer0[0] === 26, 'Layer k=0 starts at address 26');
  assert(layer0[48] === 74, 'Layer k=0 ends at address 74 (26 + 48)');

  const layer6 = OneAddress369.sliceLayerK(6);
  assert(layer6.length === 49, 'Layer k=6 contains exactly 49 addresses (7x7)');
  assert(layer6[0] === 320, 'Layer k=6 starts at address 320 (26 + 49*6)');
  assert(layer6[48] === 368, 'Layer k=6 ends at address 368');

  // 6. Sub-volume Bounding Slicing
  const subVolume = OneAddress369.sliceVolume({ i: 0, j: 0, k: 0 }, { i: 1, j: 1, k: 1 });
  assert(subVolume.length === 8, 'Bounding volume [0..1]³ contains exactly 2x2x2 = 8 addresses');

  // 7. 3-6-9 Harmonic Resonance
  assert(OneAddress369.harmonicResonance(197) === 9, 'Address 197 (disp 198) digital root is 9');
  assert(OneAddress369.harmonicResonance(26) === 9, 'Address 26 (disp 27) digital root is 9');

  console.log('  Gate 6 Passed: Topological traversal & spatial slicing verified.\n');

  // ===========================================================================
  // Gate 7: 100-Cycle Determinism Replay & Sovereignty Lock
  // ===========================================================================
  console.log('[Gate 7] Verifying 100-Cycle Determinism & Sovereignty Invariants...');

  // Default bridge actuation lock must be true
  const defaultBridge = new SpatialBridge();
  assert(defaultBridge.isLocked() === true, 'Default SpatialBridge actuation lock is permanently true');

  let defaultWriteCaught = false;
  try {
    defaultBridge.set(3, 3, 3, 100);
  } catch (err: any) {
    defaultWriteCaught = true;
    assert(err.message.includes('Actuation lock is engaged'), 'Write blocked by actuation lock');
  }
  assert(defaultWriteCaught, 'Default bridge write safely blocked fail-closed');

  // 100-Cycle Deterministic Replay
  let determinismPass = true;
  for (let c = 0; c < 100; c++) {
    const addr = OneAddress369.coordToAddress(3, 3, 3);
    const coord = OneAddress369.addressToCoord(addr);
    const disp = OneAddress369.toDisplayIndex(addr);
    const harm = OneAddress369.harmonicResonance(addr);

    if (addr !== 197 || coord.i !== 3 || coord.j !== 3 || coord.k !== 3 || disp !== 198 || harm !== 9) {
      determinismPass = false;
      break;
    }
  }
  assert(determinismPass, '100/100 Replay cycles match with bit-for-bit exactness (sigma^2 = 0.0)');

  console.log('  Gate 7 Passed: 100-cycle determinism & sovereignty verified.\n');

  console.log('================================================================================');
  console.log(' 🏆 TASK 04 CANONICAL 369 ADDRESSING: 100% CERTIFIED & PASSED');
  console.log(' 📊 Total Gates Passed     : 7 / 7');
  console.log(' 🔒 Sovereignty Invariant  : PERMANENT FAIL-CLOSED ACTUATION LOCK');
  console.log(' ⚡ Determinism            : σ² = 0.0 (BIT-EXACT DETERMINISTIC REPLAY)');
  console.log('================================================================================\n');
}

runTask04VerificationSuite().catch((err) => {
  console.error('\n❌ Task 04 Verification Suite failed with unhandled error:', err);
  process.exit(1);
});
