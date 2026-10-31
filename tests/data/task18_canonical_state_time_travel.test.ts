/**
 * ONE Intelligence — Task 18 Verification Suite
 * ===============================================
 * Tests: Canonical State, Checkpoints & Time-Travel Manager
 * Module: tests/data/task18_canonical_state_time_travel.test.ts
 */

import * as assert from 'assert';
import * as crypto from 'crypto';
import {
  CanonicalState,
  StateRevision,
  StateDiff,
  CanonicalObject,
  CanonicalSerializer,
  TimeTravelStateManager,
  SnapshotMigrationEngine,
  VersionedStateSnapshot,
  TimeTravelError,
  IncompatibleSchemaError,
  IntegrityViolationError,
  SnapshotCorruptionError,
  MalformedSnapshotError,
  Address369BoundsError,
  ActuationBlockedError,
} from '../../src/one/data';
import { CanonicalAddress369 } from '../../src/one/address369_canonical';
import { UnifiedVM } from '../../src/one/vm/UnifiedVM';
import { UnifiedCompiler } from '../../src/one/UnifiedCompiler';

export function runTask18CanonicalStateTimeTravelTests(): void {
  console.log('='.repeat(80));
  console.log('  ONE INTELLIGENCE — TASK 18: CANONICAL STATE, CHECKPOINTS & TIME-TRAVEL');
  console.log('='.repeat(80));

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 1: Canonical State Inventory, Commit & Monotonic Revisions
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 1] Canonical State Inventory, Commit & Monotonic Revisions...');

  const stateAlpha = new CanonicalState('entity_alpha', {
    name: 'AlphaModel',
    iteration: 0,
    isActive: true,
    weights: [0.1, 0.2, 0.3],
    config: { lr: 0.001, optimizer: 'adam' },
  }, 10);

  assert.strictEqual(stateAlpha.stateId, 'entity_alpha', 'Suite 1A: State ID matches');
  assert.strictEqual(stateAlpha.canonicalAddress, 10, 'Suite 1A: Address369 binding is 10');
  assert.strictEqual(stateAlpha.getRevisionId(), 1, 'Suite 1A: Initial commit revision is 1');
  assert.strictEqual(stateAlpha.get('name'), 'AlphaModel', 'Suite 1A: Field name loaded');

  const initialHash = stateAlpha.computeHash();
  assert.ok(initialHash.startsWith('0xSTATE_'), 'Suite 1A: State hash starts with 0xSTATE_');

  // Mutation and commit -> Revision 2
  stateAlpha.set('iteration', 1);
  stateAlpha.set('status', 'TRAINING');
  const rev2 = stateAlpha.commit();
  assert.strictEqual(rev2.revisionId, 2, 'Suite 1B: Monotonic revision increment to 2');
  assert.notStrictEqual(rev2.stateHash, initialHash, 'Suite 1B: Mutated state produces distinct SHA-256 hash');
  assert.strictEqual(stateAlpha.get('iteration'), 1, 'Suite 1B: Value updated to 1');

  // Mutation and commit -> Revision 3
  stateAlpha.set('iteration', 2);
  const rev3 = stateAlpha.commit();
  assert.strictEqual(rev3.revisionId, 3, 'Suite 1C: Monotonic revision increment to 3');

  // Local rollback to Revision 1
  const rollbackSuccess = stateAlpha.rollback(1);
  assert.strictEqual(rollbackSuccess, true, 'Suite 1D: Local rollback to revision 1 succeeds');
  assert.strictEqual(stateAlpha.getRevisionId(), 1, 'Suite 1D: Current revision is 1');
  assert.strictEqual(stateAlpha.get('iteration'), 0, 'Suite 1D: Value reverted back to 0');
  assert.strictEqual(stateAlpha.has('status'), false, 'Suite 1D: Key status no longer exists in revision 1');

  // Rolling back to non-existent revision throws error
  assert.throws(
    () => stateAlpha.rollback(999),
    /Target revision 999 not found/,
    'Suite 1E: Rollback to non-existent revision fails closed'
  );

  // Memory estimation
  const estBytes = stateAlpha.estimateMemoryBytes();
  assert.ok(estBytes > 128, 'Suite 1F: Memory estimation accounts for state overhead');

  console.log('  ✓ Suite 1 passed: State inventory, monotonic revisions, and local rollback certified.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 2: Snapshot Capture & Time-Travel Rollback Equivalence
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 2] Snapshot Capture & Time-Travel Rollback Equivalence...');

  const manager = new TimeTravelStateManager();
  const stateUser = new CanonicalState('user_profile', { username: 'alice', score: 100 }, 5);
  const stateInventory = new CanonicalState('user_inventory', { gold: 500, items: ['sword', 'shield'] }, 6);

  manager.registerState(stateUser);
  manager.registerState(stateInventory);

  // Capture baseline checkpoint
  const snapBaseline = manager.createSnapshot({
    snapshotId: 'checkpoint_baseline',
    timestamp: 1000,
    canonicalAddress: 100,
    description: 'Initial player baseline before battle',
  });

  assert.strictEqual(snapBaseline.header.magic, 'ONESTATE', 'Suite 2A: Magic is ONESTATE');
  assert.strictEqual(snapBaseline.header.schemaVersion, '1.0.0', 'Suite 2A: Schema is 1.0.0');
  assert.strictEqual(snapBaseline.payload.metadata.canonicalStatesCount, 2, 'Suite 2A: 2 states recorded');
  assert.ok(snapBaseline.header.pqcSeal.startsWith('0xPQC_369_'), 'Suite 2A: PQC seal generated');

  const baselineUserHash = stateUser.computeHash();
  const baselineInvHash = stateInventory.computeHash();

  // Simulate complex mutations (e.g. gameplay actions)
  stateUser.set('score', 250);
  stateUser.set('level', 2);
  stateUser.commit();

  stateInventory.set('gold', 350); // spent 150 gold
  stateInventory.set('items', ['sword', 'shield', 'potion']);
  stateInventory.commit();

  assert.strictEqual(stateUser.get('score'), 250, 'Suite 2B: Mutated user score is 250');
  assert.strictEqual(stateInventory.get('gold'), 350, 'Suite 2B: Mutated inventory gold is 350');

  // Execute Time-Travel Rollback to baseline
  const restoreRes = manager.rollbackToSnapshot('checkpoint_baseline');
  assert.strictEqual(restoreRes.snapshotId, 'checkpoint_baseline', 'Suite 2C: Restored snapshot ID matches');
  assert.strictEqual(restoreRes.restoredStatesCount, 2, 'Suite 2C: 2 states restored');
  assert.strictEqual(restoreRes.isLosslessVerified, true, 'Suite 2C: Lossless verification passed');
  assert.ok(restoreRes.latencyMs >= 0, 'Suite 2C: Latency is recorded');

  // Verify bit-for-bit equivalence after rollback
  assert.strictEqual(stateUser.get('score'), 100, 'Suite 2D: User score restored bit-exact to 100');
  assert.strictEqual(stateUser.has('level'), false, 'Suite 2D: Uncommitted level key deleted on restore');
  assert.strictEqual(stateInventory.get('gold'), 500, 'Suite 2D: Gold restored bit-exact to 500');
  assert.deepStrictEqual(stateInventory.get('items'), ['sword', 'shield'], 'Suite 2D: Items restored bit-exact');

  assert.strictEqual(stateUser.computeHash(), baselineUserHash, 'Suite 2E: User state hash matches baseline bit-for-bit');
  assert.strictEqual(stateInventory.computeHash(), baselineInvHash, 'Suite 2E: Inventory state hash matches baseline bit-for-bit');

  console.log('  ✓ Suite 2 passed: Snapshot capture and time-travel rollback equivalence confirmed.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 3: Zero-Variance Delta Diffing & State Change Tracking
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 3] Zero-Variance Delta Diffing & State Change Tracking...');

  const state1 = new CanonicalState('doc', { title: 'v1', body: 'original', author: 'bob' });
  const state2 = new CanonicalState('doc', { title: 'v2', body: 'original', editor: 'alice' });

  const diffDirect = state1.diff(state2);
  assert.strictEqual(diffDirect.isIdentical, false, 'Suite 3A: Non-identical diff');
  assert.deepStrictEqual(diffDirect.addedKeys, ['editor'], 'Suite 3A: Added keys is [editor]');
  assert.deepStrictEqual(diffDirect.removedKeys, ['author'], 'Suite 3A: Removed keys is [author]');
  assert.strictEqual(diffDirect.modifiedKeys.length, 1, 'Suite 3A: 1 modified key');
  assert.strictEqual(diffDirect.modifiedKeys[0].key, 'title', 'Suite 3A: Modified key is title');
  assert.strictEqual(diffDirect.modifiedKeys[0].oldValue, 'v1', 'Suite 3A: Old value is v1');
  assert.strictEqual(diffDirect.modifiedKeys[0].newValue, 'v2', 'Suite 3A: New value is v2');

  // Identical diff test
  const stateIdentical = new CanonicalState('doc', { title: 'v1', body: 'original', author: 'bob' });
  const diffIdentical = state1.diff(stateIdentical);
  assert.strictEqual(diffIdentical.isIdentical, true, 'Suite 3B: Identical diff has isIdentical === true');
  assert.strictEqual(diffIdentical.addedKeys.length, 0, 'Suite 3B: 0 added keys');
  assert.strictEqual(diffIdentical.removedKeys.length, 0, 'Suite 3B: 0 removed keys');
  assert.strictEqual(diffIdentical.modifiedKeys.length, 0, 'Suite 3B: 0 modified keys');

  // Manager-level snapshot diffing
  const mgrDiff = new TimeTravelStateManager();
  const dState = new CanonicalState('config', { env: 'production', debug: false, port: 8080 });
  mgrDiff.registerState(dState);

  const snapA = mgrDiff.createSnapshot({ snapshotId: 'snap_cfg_A', timestamp: 100 });

  dState.set('debug', true);
  dState.set('port', 9090);
  dState.set('profiling', true);
  dState.delete('env');
  dState.commit();

  const snapB = mgrDiff.createSnapshot({ snapshotId: 'snap_cfg_B', timestamp: 200 });

  const report = mgrDiff.diffSnapshots('snap_cfg_A', 'snap_cfg_B');
  assert.strictEqual(report.isIdentical, false, 'Suite 3C: Snapshots are not identical');
  assert.ok(report.stateDiffs['config'], 'Suite 3C: State config has diff');
  assert.deepStrictEqual(report.stateDiffs['config'].addedKeys, ['profiling'], 'Suite 3C: Added key is profiling');
  assert.deepStrictEqual(report.stateDiffs['config'].removedKeys, ['env'], 'Suite 3C: Removed key is env');

  // Self-diff of snapA yields isIdentical === true
  const selfDiff = mgrDiff.diffSnapshots('snap_cfg_A', 'snap_cfg_A');
  assert.strictEqual(selfDiff.isIdentical, true, 'Suite 3D: Self-diff is identical (sigma^2 = 0.0)');

  console.log('  ✓ Suite 3 passed: Zero-variance delta diffing and state change tracking certified.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 4: Incompatible Schema Version Rejection & Migration Engine
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 4] Incompatible Schema Version Rejection & Migration Engine...');

  const snapForSchemaTest = mgrDiff.getSnapshot('snap_cfg_A')!;

  // Fabricate invalid future schema version
  const invalidSchemaSnap: VersionedStateSnapshot = {
    header: {
      ...snapForSchemaTest.header,
      schemaVersion: '2.0.0', // Unsupported future schema
    },
    payload: snapForSchemaTest.payload,
  };

  assert.throws(
    () => mgrDiff.restoreFromSnapshot(invalidSchemaSnap),
    (err: any) => err instanceof IncompatibleSchemaError && err.code === 'E7010',
    'Suite 4A: Unsupported schemaVersion 2.0.0 fails closed with E7010'
  );

  // Test SnapshotMigrationEngine: Migrate v1.0.0 to v1.1.0
  const migResult = SnapshotMigrationEngine.migrate(snapForSchemaTest, '1.1.0');
  assert.strictEqual(migResult.success, true, 'Suite 4B: Migration to 1.1.0 succeeds');
  assert.strictEqual(migResult.migratedSnapshot.header.schemaVersion, '1.1.0', 'Suite 4B: Migrated schema is 1.1.0');
  assert.strictEqual(
    (migResult.migratedSnapshot.payload.metadata.extraMetadata as any)?.migratedFrom,
    '1.0.0',
    'Suite 4B: Provenance extraMetadata records source 1.0.0'
  );

  // Restore migrated 1.1.0 snapshot through TimeTravelStateManager (1.1.0 is in SUPPORTED_SCHEMA_VERSIONS)
  const migRestore = mgrDiff.restoreFromSnapshot(migResult.migratedSnapshot);
  assert.strictEqual(migRestore.schemaVersion, '1.1.0', 'Suite 4C: Restored migrated 1.1.0 snapshot successfully');
  assert.strictEqual(migRestore.isLosslessVerified, true, 'Suite 4C: Migrated restore verified lossless');

  console.log('  ✓ Suite 4 passed: Incompatible schema rejected fail-closed, migration engine certified.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 5: Corrupted, Tampered & Truncated Snapshot Rejection & Recovery
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 5] Corrupted, Tampered & Truncated Snapshot Rejection & Recovery...');

  // 5A: Tampered Checksum (bit flip in payload)
  const tamperedPayload: any = JSON.parse(JSON.stringify(snapForSchemaTest.payload));
  tamperedPayload.canonicalStates['config'].data['debug'] = 'TAMPERED_INJECTION';

  const tamperedSnap: VersionedStateSnapshot = {
    header: snapForSchemaTest.header, // Keeps original checksum
    payload: tamperedPayload,
  };

  assert.throws(
    () => mgrDiff.restoreFromSnapshot(tamperedSnap),
    (err: any) => err instanceof IntegrityViolationError && err.code === 'E7011',
    'Suite 5A: Payload tampering detected by SHA-256 integrity check (CHECKSUM_MISMATCH)'
  );

  // 5B: Tampered PQC Seal
  const validCanonJSON = CanonicalSerializer.serializeCanonicalJSON(snapForSchemaTest.payload);
  const validPayloadBuf = Buffer.from(validCanonJSON, 'utf-8');
  const validSha = crypto.createHash('sha256').update(validPayloadBuf).digest('hex');

  const tamperedSealSnap: VersionedStateSnapshot = {
    header: {
      ...snapForSchemaTest.header,
      sha256Checksum: validSha,
      pqcSeal: '0xPQC_369_CORRUPTED_SEAL_FAIL_CLOSED_00000000_SEAL',
    },
    payload: snapForSchemaTest.payload,
  };

  assert.throws(
    () => mgrDiff.restoreFromSnapshot(tamperedSealSnap),
    (err: any) => err instanceof IntegrityViolationError && err.code === 'E7011',
    'Suite 5B: Tampered PQC seal rejected fail-closed (PQC_SEAL_MISMATCH)'
  );

  // 5C: Binary buffer truncation (< 60 bytes)
  const shortBuf = Buffer.alloc(30);
  assert.throws(
    () => mgrDiff.deserializeSnapshot(shortBuf),
    (err: any) => err instanceof SnapshotCorruptionError && err.code === 'E7012',
    'Suite 5C: Buffer under 60 bytes rejected with SnapshotCorruptionError'
  );

  // 5D: Binary buffer payload corruption
  const validBuffer = mgrDiff.serializeSnapshot(snapForSchemaTest);
  const corruptedBuffer = Buffer.from(validBuffer);
  corruptedBuffer[validBuffer.length - 10] ^= 0xff; // Invert bit in payload

  assert.throws(
    () => mgrDiff.restoreFromBuffer(corruptedBuffer),
    (err: any) => err instanceof SnapshotCorruptionError || err instanceof IntegrityViolationError,
    'Suite 5D: Bit-flipped binary payload rejected fail-closed'
  );

  // 5E: Interrupted recovery atomicity check
  const stateHealth = new CanonicalState('health', { hp: 100, mp: 50 });
  const mgrAtomic = new TimeTravelStateManager([stateHealth]);
  const snapSafe = mgrAtomic.createSnapshot({ snapshotId: 'snap_safe', timestamp: 500 });

  stateHealth.set('hp', 75);
  stateHealth.commit();

  // Create malformed snapshot missing required field
  const malformedSnap: any = {
    header: snapSafe.header,
    payload: {
      metadata: snapSafe.payload.metadata,
      // missing canonicalStates and walRecords
    },
  };

  assert.throws(
    () => mgrAtomic.restoreFromSnapshot(malformedSnap),
    (err: any) => err instanceof TimeTravelError,
    'Suite 5E: Malformed snapshot rejected'
  );

  // Verify health state was NOT corrupted by the aborted restore attempt
  assert.strictEqual(stateHealth.get('hp'), 75, 'Suite 5E: Atomic rollback preserved pre-attempt state');

  console.log('  ✓ Suite 5 passed: Corrupted, tampered, and truncated snapshots rejected; atomic rollback verified.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 6: WAL Append-Only Audit Logging & Sequence Monotonicity Replay
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 6] WAL Append-Only Audit Logging & Sequence Monotonicity Replay...');

  const mgrWAL = new TimeTravelStateManager();
  const testState = new CanonicalState('counter', { value: 0 });
  mgrWAL.registerState(testState);

  for (let step = 1; step <= 5; step++) {
    testState.set('value', step);
    testState.commit();
    mgrWAL.recordMutation('counter', `INCREMENT_TO_${step}`, { value: step });
  }

  const logStream = mgrWAL.getWAL().getLogStream();
  assert.ok(logStream.length >= 6, 'Suite 6A: WAL contains register + 5 mutation records');

  // Verify sequence monotonicity and synthetic clock (369 * seq)
  for (let i = 0; i < logStream.length; i++) {
    const rec = logStream[i];
    assert.strictEqual(rec.sequenceId, i + 1, `Suite 6B: Monotonic sequence ID at ${i}`);
    assert.strictEqual(rec.timestamp, 369 * (i + 1), `Suite 6B: Deterministic clock at ${i} is 369 * ${i + 1}`);
    assert.strictEqual(
      rec.payloadHash,
      mgrWAL.getWAL().computeStateHash(rec.stateData),
      `Suite 6B: FNV-1a payload hash matches for sequence ${rec.sequenceId}`
    );
  }

  // Replay WAL
  const replayResult = mgrWAL.replayWAL(1, logStream.length);
  assert.strictEqual(replayResult.replayedRecords, logStream.length, 'Suite 6C: All WAL records successfully replayed');
  assert.ok(replayResult.finalStateHashes['counter'], 'Suite 6C: Final state hash calculated');

  console.log('  ✓ Suite 6 passed: WAL append-only sequence logging and replay monotonicity confirmed.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 7: Actuation Lockout, Address369 Bounds & Deterministic Replay (σ² = 0.0)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 7] Actuation Lockout, Address369 Bounds & Deterministic Replay (σ² = 0.0)...');

  const mgrFinal = new TimeTravelStateManager();
  assert.strictEqual(mgrFinal.isActuationBlocked, true, 'Suite 7A: Actuation lock is permanently true');

  // 7A: Actuation unblock attempt rejected
  const snapWithActuation: VersionedStateSnapshot = {
    header: {
      magic: 'ONESTATE',
      schemaVersion: '1.0.0',
      snapshotId: 'unauthorized_actuation_attempt',
      createdAt: 1000,
      pqcSeal: '0xPQC_369_SEAL',
      sha256Checksum: 'dummy_hash',
      isActuationBlocked: false, // Unauthorized actuation flag
    },
    payload: {
      metadata: {
        systemId: 'one',
        sequenceId: 1,
        canonicalStatesCount: 0,
        hasVMState: false,
        walSequenceId: 0,
      },
      canonicalStates: {},
      walRecords: [],
    },
  };

  assert.throws(
    () => mgrFinal.restoreFromSnapshot(snapWithActuation),
    (err: any) => err instanceof ActuationBlockedError && err.code === 'E8005',
    'Suite 7A: Unauthorized actuation flag throws ActuationBlockedError (E8005)'
  );

  // 7B: Address369 bounds [0..368]
  assert.doesNotThrow(() => {
    new TimeTravelStateManager([new CanonicalState('valid_0', {}, 0)]);
    new TimeTravelStateManager([new CanonicalState('valid_368', {}, 368)]);
  }, 'Suite 7B: Valid canonical boundaries 0 and 368 accepted');

  assert.throws(
    () => new TimeTravelStateManager([new CanonicalState('invalid_neg', {}, -1)]),
    (err: any) => err instanceof Address369BoundsError && err.code === 'E8006',
    'Suite 7B: Address -1 rejected with Address369BoundsError (E8006)'
  );

  assert.throws(
    () => new TimeTravelStateManager([new CanonicalState('invalid_369', {}, 369)]),
    (err: any) => err instanceof Address369BoundsError && err.code === 'E8006',
    'Suite 7B: Address 369 rejected with Address369BoundsError (E8006)'
  );

  // 7C: Deterministic Replay Variance (σ² = 0.0) across 100 snapshot cycles
  const fixedState = new CanonicalState('det_entity', {
    kernel: 'HermiteWavelet',
    dim: 369,
    latticeGrid: [1, 3, 6, 9],
    harmonicRank: 4,
  }, 36);

  const mgrDet = new TimeTravelStateManager([fixedState]);
  const capturedChecksums: string[] = [];
  const capturedPQCSeals: string[] = [];
  const fixedTimestamp = 1710000000000;

  for (let cycle = 0; cycle < 100; cycle++) {
    const snap = mgrDet.createSnapshot({
      snapshotId: 'deterministic_fixed_cycle',
      timestamp: fixedTimestamp,
      sequenceId: 1,
      includeWAL: false,
      canonicalAddress: 36,
      systemId: 'one-deterministic-cluster',
    });
    capturedChecksums.push(snap.header.sha256Checksum);
    capturedPQCSeals.push(snap.header.pqcSeal);
  }

  for (let cycle = 1; cycle < 100; cycle++) {
    assert.strictEqual(
      capturedChecksums[cycle],
      capturedChecksums[0],
      `Suite 7C: Run ${cycle} SHA-256 matches run 0 bit-for-bit`
    );
    assert.strictEqual(
      capturedPQCSeals[cycle],
      capturedPQCSeals[0],
      `Suite 7C: Run ${cycle} PQC seal matches run 0 bit-for-bit`
    );
  }

  // 7D: 100-cycle consecutive rollback exactness
  const refStateHash = fixedState.computeHash();
  for (let cycle = 0; cycle < 100; cycle++) {
    // Mutate
    fixedState.set('harmonicRank', 999);
    fixedState.commit();
    // Rollback
    mgrDet.rollbackToSnapshot('deterministic_fixed_cycle');
    assert.strictEqual(fixedState.get('harmonicRank'), 4, `Suite 7D: Rollback cycle ${cycle} restored rank`);
    assert.strictEqual(fixedState.computeHash(), refStateHash, `Suite 7D: Rollback cycle ${cycle} hash exactness`);
  }

  console.log('  ✓ Suite 7 passed: Actuation lock, Address369 bounds, and 100-cycle replay variance sigma^2 = 0.0 verified.');

  console.log('\n' + '='.repeat(80));
  console.log('  TASK 18 VERIFICATION: ALL 7 SUITES PASSED (100%)');
  console.log('='.repeat(80) + '\n');
}

if (
  typeof process !== 'undefined' &&
  process.argv &&
  process.argv[1] &&
  process.argv[1].includes('task18_canonical_state_time_travel')
) {
  runTask18CanonicalStateTimeTravelTests();
}
