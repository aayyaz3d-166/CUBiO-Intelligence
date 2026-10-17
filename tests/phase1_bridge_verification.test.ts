/**
 * ONE Language — Phase 1 Architecture Bridge & Runtime Unification Test Suite
 * ===========================================================================
 * Coverage Requirements:
 *  1. All 343 valid spatial indices uniqueness.
 *  2. All 343 coordinates forward/inverse round-trip bijection.
 *  3. Minimum (0,0,0) and maximum (6,6,6) valid coordinates.
 *  4. Minimum (26) and maximum (368) spatial addresses.
 *  5. Invalid coordinates (<0, >6) and invalid addresses (<0, 369, 1000).
 *  6. Symbolic address boundary cases (0 and 25).
 *  7. Spatial address boundary cases (26 and 368).
 *  8. GridMemory read/write synchronization through SpatialBridge.
 *  9. SpatialBridge actuation lock fail-closed enforcement (reads allowed, writes blocked).
 * 10. UnifiedVM end-to-end execution of spatial queries and data retrieval.
 */

import { CanonicalAddress369 } from '../src/one/address369_canonical';
import { OneAddress369 } from '../src/one/spatial/OneAddress369';
import { SpatialBridge } from '../src/one/spatial/SpatialBridge';
import { GridMemory } from '../src/vm/gridMemory';
import { UnifiedCompiler } from '../src/one/UnifiedCompiler';
import { UnifiedVM } from '../src/one/vm/UnifiedVM';

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${msg}`);
  }
}

export function runPhase1BridgeTests(): void {
  console.log('='.repeat(78));
  console.log('  ONE LANGUAGE — PHASE 1 ARCHITECTURE BRIDGE VERIFICATION SUITE');
  console.log('='.repeat(78));

  // ── Test 1 & 2: 343 Spatial Cells Uniqueness & Bijective Roundtrip ─────────
  console.log('\n[Test 1 & 2] Verifying 343 Spatial Cells Uniqueness & Bijective Roundtrip...');
  const seenAddresses = new Set<number>();
  const seenGridIndices = new Set<number>();

  for (let z = 0; z < 7; z++) {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        // CanonicalAddress369 forward
        const canonicalAddr = CanonicalAddress369.spatialCoordToCanonicalAddress(x, y, z);
        assert(!seenAddresses.has(canonicalAddr), `Address ${canonicalAddr} must be unique`);
        seenAddresses.add(canonicalAddr);

        // GridMemory forward
        const gridIdx = GridMemory.coordToIndex({ x, y, z });
        assert(!seenGridIndices.has(gridIdx), `Grid index ${gridIdx} must be unique`);
        seenGridIndices.add(gridIdx);

        // Core identity invariant: Canonical Address = 26 + GridMemory Index
        assert(
          canonicalAddr === 26 + gridIdx,
          `Canonical address (${canonicalAddr}) must equal 26 + gridIdx (${26 + gridIdx})`
        );

        // Inverse round-trip check
        const coordFromAddr = CanonicalAddress369.canonicalAddressToSpatialCoord(canonicalAddr);
        assert(
          coordFromAddr.i === x && coordFromAddr.j === y && coordFromAddr.k === z,
          `CanonicalAddress369 inverse mapping mismatch at (${x},${y},${z})`
        );

        const coordFromGrid = GridMemory.indexToCoord(gridIdx);
        assert(
          coordFromGrid.x === x && coordFromGrid.y === y && coordFromGrid.z === z,
          `GridMemory inverse mapping mismatch at (${x},${y},${z})`
        );
      }
    }
  }

  assert(seenAddresses.size === 343, 'Must have exactly 343 unique spatial addresses');
  assert(seenGridIndices.size === 343, 'Must have exactly 343 unique grid indices');
  console.log('  ✓ 343/343 coordinates verify bit-exact bijection & uniqueness.');

  // ── Test 3 & 4: Minimum & Maximum Boundary Conditions ─────────────────────
  console.log('\n[Test 3 & 4] Verifying Coordinate and Address Extreme Boundaries...');
  // Origin (0,0,0) -> 26
  assert(
    CanonicalAddress369.spatialCoordToCanonicalAddress(0, 0, 0) === 26,
    'Origin (0,0,0) must map to address 26'
  );
  assert(
    GridMemory.coordToIndex({ x: 0, y: 0, z: 0 }) === 0,
    'Origin (0,0,0) must map to grid index 0'
  );

  // Corner Max (6,6,6) -> 368
  assert(
    CanonicalAddress369.spatialCoordToCanonicalAddress(6, 6, 6) === 368,
    'Max corner (6,6,6) must map to address 368'
  );
  assert(
    GridMemory.coordToIndex({ x: 6, y: 6, z: 6 }) === 342,
    'Max corner (6,6,6) must map to grid index 342'
  );

  // Center (3,3,3) -> 197
  assert(
    CanonicalAddress369.spatialCoordToCanonicalAddress(3, 3, 3) === 197,
    'Center (3,3,3) must map to address 197'
  );
  assert(
    GridMemory.coordToIndex({ x: 3, y: 3, z: 3 }) === 171,
    'Center (3,3,3) must map to grid index 171'
  );
  console.log('  ✓ Origin (26), Center (197), and Corner Max (368) verified.');

  // ── Test 5: Boundary & Invalid Input Rejection ─────────────────────────────
  console.log('\n[Test 5] Verifying Fail-Closed Rejection of Invalid Coordinates/Addresses...');
  let caughtCoordNegative = false;
  try {
    CanonicalAddress369.spatialCoordToCanonicalAddress(-1, 0, 0);
  } catch {
    caughtCoordNegative = true;
  }
  assert(caughtCoordNegative, 'Negative coordinate must be rejected fail-closed');

  let caughtCoordOver = false;
  try {
    CanonicalAddress369.spatialCoordToCanonicalAddress(7, 0, 0);
  } catch {
    caughtCoordOver = true;
  }
  assert(caughtCoordOver, 'Coordinate >= 7 must be rejected fail-closed');

  let caughtAddrNegative = false;
  try {
    CanonicalAddress369.toDisplayIndex(-1);
  } catch {
    caughtAddrNegative = true;
  }
  assert(caughtAddrNegative, 'Negative internal address must be rejected');

  let caughtAddrOver = false;
  try {
    CanonicalAddress369.toDisplayIndex(369);
  } catch {
    caughtAddrOver = true;
  }
  assert(caughtAddrOver, 'Internal address 369 must be rejected (max is 368)');
  console.log('  ✓ Invalid coordinates & out-of-range addresses rejected fail-closed.');

  // ── Test 6 & 7: Symbolic vs Spatial Address Space Separation ──────────────
  console.log('\n[Test 6 & 7] Verifying Symbolic (0..25) vs Spatial (26..368) Boundary Separation...');
  const symMin = CanonicalAddress369.inspectAddress(0);
  assert(symMin.layer === 'SYMBOLIC' && symMin.displayIndex === 1, 'Address 0 is symbolic display 1');

  const symMax = CanonicalAddress369.inspectAddress(25);
  assert(symMax.layer === 'SYMBOLIC' && symMax.displayIndex === 26, 'Address 25 is symbolic display 26');

  const spatMin = CanonicalAddress369.inspectAddress(26);
  assert(spatMin.layer === 'SPATIAL' && spatMin.displayIndex === 27, 'Address 26 is spatial display 27');

  const spatMax = CanonicalAddress369.inspectAddress(368);
  assert(spatMax.layer === 'SPATIAL' && spatMax.displayIndex === 369, 'Address 368 is spatial display 369');

  let symInSpatialCheck = false;
  try {
    CanonicalAddress369.canonicalAddressToSpatialCoord(25);
  } catch {
    symInSpatialCheck = true;
  }
  assert(symInSpatialCheck, 'Address 25 cannot be decoded as spatial coordinate');
  console.log('  ✓ Strict boundary separation between Symbolic (0..25) and Spatial (26..368) verified.');

  // ── Test 8: Shared Memory Bridge Synchronization with GridMemory ──────────
  console.log('\n[Test 8] Verifying Shared Memory Bridge Synchronization with GridMemory...');
  const gridMemory = new GridMemory();
  const unlockedBridge = new SpatialBridge({ actuationLock: false, gridMemory });

  // Write different data types
  unlockedBridge.set(3, 3, 3, 999.5);
  unlockedBridge.set(0, 0, 0, 'HELLO_SPATIAL');
  unlockedBridge.set(6, 6, 6, true);

  // Verify reads from SpatialBridge
  assert(unlockedBridge.get(3, 3, 3) === 999.5, 'Readback float from SpatialBridge');
  assert(unlockedBridge.get(0, 0, 0) === 'HELLO_SPATIAL', 'Readback string from SpatialBridge');
  assert(unlockedBridge.get(6, 6, 6) === true, 'Readback boolean from SpatialBridge');

  // Verify synchronization into GridMemory cells
  const centerCell = gridMemory.read({ x: 3, y: 3, z: 3 });
  assert(centerCell !== null && centerCell.occupied, 'GridMemory center cell must be occupied');
  assert(SpatialBridge.decodeCellPayload(centerCell!.data!) === 999.5, 'Decoded float matches in GridMemory');

  const originCell = gridMemory.read({ x: 0, y: 0, z: 0 });
  assert(originCell !== null && originCell.occupied, 'GridMemory origin cell must be occupied');
  assert(SpatialBridge.decodeCellPayload(originCell!.data!) === 'HELLO_SPATIAL', 'Decoded string matches in GridMemory');

  const maxCell = gridMemory.read({ x: 6, y: 6, z: 6 });
  assert(maxCell !== null && maxCell.occupied, 'GridMemory max cell must be occupied');
  assert(SpatialBridge.decodeCellPayload(maxCell!.data!) === true, 'Decoded bool matches in GridMemory');

  // Test addressSet synchronization
  unlockedBridge.addressSet(197, 'UPDATED_CENTER');
  assert(unlockedBridge.address(197) === 'UPDATED_CENTER', 'Address-based read from SpatialBridge');
  const updatedCell = gridMemory.read({ x: 3, y: 3, z: 3 });
  assert(SpatialBridge.decodeCellPayload(updatedCell!.data!) === 'UPDATED_CENTER', 'Updated string in GridMemory');

  console.log('  ✓ Shared memory synchronization between SpatialBridge and GridMemory verified.');

  // ── Test 9: Actuation Lock Fail-Closed Enforcement ─────────────────────────
  console.log('\n[Test 9] Verifying Actuation Lock Fail-Closed Enforcement...');
  const lockedBridge = new SpatialBridge({ actuationLock: true });
  assert(lockedBridge.isLocked() === true, 'Locked bridge must report isLocked() === true');

  // Reading allowed
  assert(lockedBridge.get(3, 3, 3) === null, 'Read on locked bridge allowed');
  assert(lockedBridge.address(197) === null, 'Address read on locked bridge allowed');

  // Writing coordinate blocked
  let coordWriteBlocked = false;
  try {
    lockedBridge.set(3, 3, 3, 100);
  } catch (err: any) {
    coordWriteBlocked = true;
    assert(err.message.includes('Actuation lock is engaged'), 'Error must specify actuation lock');
  }
  assert(coordWriteBlocked, 'Coordinate write must be blocked by actuation lock');

  // Writing address blocked
  let addrWriteBlocked = false;
  try {
    lockedBridge.addressSet(197, 100);
  } catch (err: any) {
    addrWriteBlocked = true;
    assert(err.message.includes('Actuation lock is engaged'), 'Error must specify actuation lock');
  }
  assert(addrWriteBlocked, 'Address write must be blocked by actuation lock');
  console.log('  ✓ Fail-closed actuation lock verified (reads allowed, writes denied).');

  // ── Test 10: End-to-End UnifiedCompiler -> UnifiedVM Integration ───────────
  console.log('\n[Test 10] Verifying End-to-End UnifiedCompiler -> UnifiedVM Integration...');
  const compiler = new UnifiedCompiler();

  // Test 10a: spatial.isLocked() and spatial.inspect()
  const scriptA = `
    let locked = spatial.isLocked();
    let info = spatial.inspect(3, 3, 3);
    print locked;
    print info.address;
    print info.displayIndex;
  `;
  const resA = compiler.execute(scriptA);
  assert(resA.vmResult !== undefined && resA.vmResult.success, 'Script A must execute successfully');
  assert(resA.vmResult!.output[0] === 'true', 'spatial.isLocked() must print true');
  assert(resA.vmResult!.output[1] === '197', 'Center address must be 197');
  assert(resA.vmResult!.output[2] === '198', 'Center display index must be 198');

  // Test 10b: Custom bridge with unlocked actuation and shared GridMemory
  const sharedMemory = new GridMemory();
  const customBridge = new SpatialBridge({ actuationLock: false, gridMemory: sharedMemory });
  const scriptB = `
    spatial.set(3, 3, 3, 777);
    let val = spatial.get(3, 3, 3);
    print val;
  `;
  const compB = compiler.compile(scriptB);
  assert(compB.success && compB.ir !== undefined, 'Script B must compile cleanly');

  const vmB = new UnifiedVM();
  const vmResultB = vmB.execute(compB.ir!, { spatialBridge: customBridge });
  assert(vmResultB.success, 'Script B must execute cleanly');
  assert(vmResultB.output[0] === '777', 'Read back value must be 777');

  const checkCell = sharedMemory.read({ x: 3, y: 3, z: 3 });
  assert(checkCell !== null && checkCell.occupied, 'GridMemory must reflect write executed via VM script');
  assert(SpatialBridge.decodeCellPayload(checkCell!.data!) === 777, 'GridMemory value must match 777');

  console.log('  ✓ End-to-end compiler-to-VM spatial bridge execution verified.');

  console.log('\n' + '='.repeat(78));
  console.log('  PHASE 1 VERIFICATION: ALL 10 TARGETED AUDIT GATES PASSED (100%)');
  console.log('='.repeat(78) + '\n');
}

if (require.main === module) {
  runPhase1BridgeTests();
}
