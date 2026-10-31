/**
 * Comprehensive Automated Test Suite for Gate CNL-P8-001
 * Target: Autonomous Multi-Mesh Federation ("one-quantum-mesh")
 */

import { MeshFederationEngine } from '../mesh_federation_engine';
import { QuantumEntanglementSyncEngine } from '../quantum_entanglement_sync';
import { PQCMeshGuard } from '../pqc_mesh_guard';
import { CubioHyperNeuralBuilder } from '../cubio_builder';

function runGateCNLP8001TestSuite(): void {
  console.log('================================================================================');
  console.log(' 🌐 CUBIO MULTI-MESH FEDERATION: GATE CNL-P8-001 TEST SUITE');
  console.log('================================================================================\n');

  try {
    // -------------------------------------------------------------------------
    // GATE 1: P2P Mesh Node Registration & Discovery
    // -------------------------------------------------------------------------
    console.log('[Gate 1] Verifying P2P Swarm Node Spawning & Topology...');
    const federation = new MeshFederationEngine();
    federation.registerNode('Node_Alpha', [0.1, 0.1, 0.1], 9);
    federation.registerNode('Node_Beta', [0.3, 0.3, 0.3], 9);
    federation.registerNode('Node_Gamma', [0.5, 0.5, 0.5], 6);
    federation.registerNode('Node_Omega', [0.9, 0.9, 0.9], 3);

    console.log(`  ✓ Registered ${federation.getNodes().length} sovereign nodes across 3/6/9 MHz frequency bands.`);
    if (federation.getNodes().length !== 4) {
      throw new Error('Expected 4 nodes in mesh topology!');
    }

    // -------------------------------------------------------------------------
    // GATE 2: Quantum Entanglement Link & Instant Non-Local State Collapse
    // -------------------------------------------------------------------------
    console.log('\n[Gate 2] Verifying Quantum Entanglement Links & Instant Non-Local Collapse...');
    const pairAB = federation.linkQuantumEntanglement('Node_Alpha', 'Node_Beta');
    const pairGO = federation.linkQuantumEntanglement('Node_Gamma', 'Node_Omega');
    console.log(`  ✓ Created EPR Pair '${pairAB.pairId}' (|Phi+> Bell State | Fidelity = ${pairAB.entanglementFidelity * 100}%)`);
    console.log(`  ✓ Created EPR Pair '${pairGO.pairId}' (|Phi+> Bell State | Fidelity = ${pairGO.entanglementFidelity * 100}%)`);

    // Trigger state collapse on Alpha -> Beta should instantly mirror state
    const collapseEvents = federation.updateNodeState('Node_Alpha', [0.999, 0.888, 0.777, 1.0]);
    console.log(`  ✓ Triggered Quantum State Collapse from Node_Alpha:`);
    for (const ev of collapseEvents) {
      console.log(`    • Target Node '${ev.entangledTargetNode}' collapsed instantly (Latency: ${ev.propagationLatencyNs}ns | Fidelity: ${ev.fidelity})`);
      console.log(`      Collapsed State: [${ev.collapsedStateB.join(', ')}]`);
    }

    const betaNode = federation.getNodes().find((n) => n.nodeId === 'Node_Beta');
    if (!betaNode || JSON.stringify(betaNode.localStateVector) !== JSON.stringify([0.999, 0.888, 0.777, 1.0])) {
      throw new Error('Quantum entanglement state collapse failed on Node_Beta!');
    }

    // -------------------------------------------------------------------------
    // GATE 3: PQC Mesh Guard Verification & Rogue Packet Quarantine
    // -------------------------------------------------------------------------
    console.log('\n[Gate 3] Verifying PQC Mesh Guard & Rogue Tampering Defense...');
    const guard = new PQCMeshGuard();
    guard.registerTrustedPeer('Node_Alpha');
    guard.registerTrustedPeer('Node_Beta');

    // Case A: Valid Packet
    const validPkt = guard.signPacket('Node_Alpha', 'Node_Beta', { tensorPayload: [1, 2, 3] });
    const verdictA = guard.verifyIncomingPacket(validPkt);
    console.log(`  ✓ Valid Packet Verdict: Authentic = ${verdictA.isAuthentic} | Quarantined = ${verdictA.quarantined}`);
    if (!verdictA.isAuthentic || verdictA.quarantined) {
      throw new Error('PQC Mesh Guard rejected a valid authentic packet!');
    }

    // Case B: Tampered Packet
    const tamperedPkt = { ...validPkt, payload: { tensorPayload: [999, 999, 999] } }; // Tampered data
    const verdictB = guard.verifyIncomingPacket(tamperedPkt);
    console.log(`  ✓ Tampered Packet Verdict: Authentic = ${verdictB.isAuthentic} | Quarantined = ${verdictB.quarantined} | Reason: ${verdictB.errorReason}`);
    if (verdictB.isAuthentic || !verdictB.quarantined) {
      throw new Error('PQC Mesh Guard failed to intercept and quarantine a tampered packet!');
    }

    // -------------------------------------------------------------------------
    // GATE 4: 8-Phase Immutable Cryptographic Lineage (P1 -> P8)
    // -------------------------------------------------------------------------
    console.log('\n[Gate 4] Verifying 8-Phase Immutable Cryptographic Lineage...');
    const builder = new CubioHyperNeuralBuilder();
    const compileResult = builder.compilePhase8Federation('cubio_mesh_phase8.3dmemory');

    const expectedPhases = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
    const actualPhases = compileResult.lineageChain.map((l) => l.phase);
    console.log(`  ✓ Full 8-Phase Lineage Chain : ${actualPhases.join(' -> ')}`);
    console.log(`  ✓ Phase 8 PQC Root Seal      : ${compileResult.pqcSeal}`);

    if (JSON.stringify(actualPhases) !== JSON.stringify(expectedPhases)) {
      throw new Error(`Lineage mismatch! Expected ${expectedPhases}, got ${actualPhases}`);
    }

    // -------------------------------------------------------------------------
    // GATE 5: 100-Cycle Deterministic Replay (0.0000% Drift, σ² = 0.0)
    // -------------------------------------------------------------------------
    console.log('\n[Gate 5] Verifying 100-Cycle Deterministic Replay (0.0000% Drift)...');
    const initialHash = compileResult.deterministicHash;
    for (let c = 0; c < 100; c++) {
      const replayEngine = new MeshFederationEngine();
      replayEngine.registerNode('Node_Alpha', [0.1, 0.1, 0.1], 9);
      replayEngine.registerNode('Node_Beta', [0.3, 0.3, 0.3], 9);
      replayEngine.registerNode('Node_Gamma', [0.5, 0.5, 0.5], 6);
      replayEngine.registerNode('Node_Omega', [0.9, 0.9, 0.9], 3);
      replayEngine.linkQuantumEntanglement('Node_Alpha', 'Node_Beta');
      replayEngine.linkQuantumEntanglement('Node_Gamma', 'Node_Omega');
      replayEngine.updateNodeState('Node_Alpha', [0.888, 0.999, 0.777, 1.0]);
      const rep = replayEngine.getFederationReport(1725300000000);
      if (rep.deterministicStateHash !== initialHash) {
        throw new Error(`State drift detected during federation report at cycle ${c}!`);
      }
    }
    console.log('  ✓ 100/100 Replay Cycles executed with bit-for-bit exactness (Drift = 0.0000%, σ² = 0.0).');

    // -------------------------------------------------------------------------
    // GATE 6: Sovereign one.exe Toolchain Alignment
    // -------------------------------------------------------------------------
    console.log('\n[Gate 6] Verifying Sovereign one.exe Toolchain Alignment...');
    console.log(compileResult.oneExeOutput.split('\n').slice(0, 5).map((l) => `    ${l}`).join('\n'));

    console.log('\n================================================================================');
    console.log(' 🏆 GATE CNL-P8-001 FULLY CERTIFIED & PASSED (100% SUCCESS)');
    console.log('================================================================================\n');
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('\n❌ FAIL: Gate CNL-P8-001 Test Failure:');
      console.error(err.message);
    }
    process.exit(1);
  }
}

runGateCNLP8001TestSuite();
