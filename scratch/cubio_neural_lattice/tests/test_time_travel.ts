/**
 * Automated Verification Suite for Time-Travel Checkpoint & Rewind
 */

import { TimeTravelManager } from '../time_travel_checkpoint';

function runTimeTravelTests(): void {
  console.log('================================================================================');
  console.log(' ⏳ CUBIO TIME-TRAVEL CHECKPOINT & REWIND VERIFICATION SUITE');
  console.log('================================================================================\n');

  try {
    const tm = new TimeTravelManager();

    // Mock initial state
    const initialGrid = { rank: '4D', activeCells: 1029, stateHash: '0x369_ALPHA' };
    const mockActors = [
      { id: 'Actor_CoreAlpha', frequency: 3, mailbox: ['msg1', 'msg2'] },
      { id: 'Actor_ResonanceMaster', frequency: 9, mailbox: ['msg_sync'] },
    ];

    // [Step 1] Capture State Snapshot
    const snapId = 'checkpoint_phase_alpha';
    const snapshot = tm.createSnapshot(snapId, initialGrid, mockActors, 145.5);
    console.log(`[Step 1] Snapshot Captured: '${snapshot.checkpointId}'`);
    console.log(`  - PQC Root Seal   : ${snapshot.pqcSeal}`);
    console.log(`  - State Hash      : ${snapshot.deterministicStateHash}`);
    console.log(`  - Memory Footprint: ${snapshot.memoryFootprint} MB`);

    // [Step 2] Simulate State Mutation / Drift
    console.log('\n[Step 2] Simulating Runtime State Mutation & Memory Drift...');
    initialGrid.stateHash = '0x369_MUTATED_DRIFT';
    mockActors[0].mailbox.push('unauthorized_mutation');
    console.log(`  - Mutated Live Grid Hash: ${initialGrid.stateHash}`);
    console.log(`  - Mutated Live Mailbox  : ${mockActors[0].mailbox.length} messages`);

    // [Step 3] Execute Rewind Operation
    console.log(`\n[Step 3] Executing Time-Travel Rewind to '${snapId}'...`);
    const restoredState = tm.rewindState(snapId);

    // [Step 4] Verify Bit-for-Bit Exactness
    console.log('\n[Step 4] Auditing Restored State for Zero-Drift Bit Exactness...');
    const isHashMatch = restoredState.gridState.stateHash === '0x369_ALPHA';
    const isMailboxMatch = restoredState.actorStates[0].mailboxSize === 2;

    console.log(`  - Restored State Hash : ${restoredState.gridState.stateHash} (Expected: 0x369_ALPHA)`);
    console.log(`  - Restored Mailbox Size: ${restoredState.actorStates[0].mailboxSize} (Expected: 2)`);
    console.log(`  - Restored PQC Seal   : ${restoredState.pqcSeal}`);

    if (!isHashMatch || !isMailboxMatch) {
      throw new Error('State drift detected during rewind operation!');
    }

    // [Step 5] 100-Cycle Determinism Replay Test
    console.log('\n[Step 5] Running 100 Consecutive Rewind Replay Cycles...');
    const initialHash = restoredState.deterministicStateHash;
    for (let c = 0; c < 100; c++) {
      const replayed = tm.rewindState(snapId);
      if (replayed.deterministicStateHash !== initialHash) {
        throw new Error(`Determinism drift at rewind cycle ${c}!`);
      }
    }
    console.log('  ✓ 100/100 Rewind Replay Cycles passed with bit-for-bit exactness (Drift = 0.0000%, σ² = 0.0).');

    console.log('\n================================================================================');
    console.log(' 🏆 TIME-TRAVEL CHECKPOINT GATE FULLY PASSED & CERTIFIED (100%)');
    console.log('================================================================================\n');
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('\n❌ FAIL: Time-Travel Verification Error:');
      console.error(err.message);
    }
    process.exit(1);
  }
}

runTimeTravelTests();
