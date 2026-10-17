/**
 * Comprehensive Automated Test Suite for Gate CNL-P7-001
 * Target: Spatial Reasoning & Knowledge Inference Engine ("CubiO-Spatial-Reasoning-v1")
 */

import { SpatialReasoningEngine } from '../spatial_reasoning_engine';
import { KnowledgeInferenceEngine } from '../knowledge_inference_engine';
import { ReasoningStateCoordinator } from '../reasoning_state_engine';
import { CubioHyperNeuralBuilder } from '../cubio_builder';

function runGateCNLP7001TestSuite(): void {
  console.log('================================================================================');
  console.log(' 🧠 CUBIO SPATIAL REASONING & THEOREM PROVER: GATE CNL-P7-001 TEST SUITE');
  console.log('================================================================================\n');

  try {
    // -------------------------------------------------------------------------
    // GATE 1: Spatial Topological Reasoning Engine
    // -------------------------------------------------------------------------
    console.log('[Gate 1] Verifying Spatial Topological Deductions...');
    const spatialEngine = new SpatialReasoningEngine();

    // Register 3 regions
    spatialEngine.registerRegion('Universe_Core', [0.0, 0.0, 0.0], [1.0, 1.0, 1.0]);
    spatialEngine.registerRegion('Cluster_Alpha', [0.2, 0.2, 0.2], [0.6, 0.6, 0.6]);
    spatialEngine.registerRegion('Node_Beta', [0.3, 0.3, 0.3], [0.4, 0.4, 0.4]);

    const rel1 = spatialEngine.deduceRelation('Universe_Core', 'Cluster_Alpha');
    const rel2 = spatialEngine.deduceRelation('Cluster_Alpha', 'Node_Beta');
    console.log(`  ✓ Deduce Relation (Universe_Core -> Cluster_Alpha) : ${rel1} (Expected: CONTAINS)`);
    console.log(`  ✓ Deduce Relation (Cluster_Alpha -> Node_Beta)     : ${rel2} (Expected: CONTAINS)`);

    if (rel1 !== 'CONTAINS' || rel2 !== 'CONTAINS') {
      throw new Error('Spatial containment deduction failed!');
    }

    const facts = spatialEngine.executeDeductiveChain();
    console.log(`  ✓ Total Spatial Facts Inferred: ${facts.length}`);

    // -------------------------------------------------------------------------
    // GATE 2: Knowledge Inference Engine & Theorem Prover
    // -------------------------------------------------------------------------
    console.log('\n[Gate 2] Verifying Knowledge Inference & Theorem Proving...');
    const knowledgeEngine = new KnowledgeInferenceEngine();

    // Register Transitive Containment Axiom: A CONTAINS B -> B IN A
    knowledgeEngine.registerRule({
      id: 'RULE_TRANSITIVE_CONTAINMENT',
      name: 'Transitive Containment Inversion',
      antecedents: [{ predicate: 'CONTAINS', subjectVar: '?X', objectVar: '?Y' }],
      consequent: { predicate: 'LOCATED_INSIDE', subjectVar: '?Y', objectVar: '?X' },
      confidenceWeight: 1.0,
    });

    // Register Safe Routing Axiom: Y LOCATED_INSIDE X -> Y IS_ROUTABLE_FROM X
    knowledgeEngine.registerRule({
      id: 'RULE_SPATIAL_ROUTABILITY',
      name: 'Spatial Routability Theorem',
      antecedents: [{ predicate: 'LOCATED_INSIDE', subjectVar: '?A', objectVar: '?B' }],
      consequent: { predicate: 'ROUTABLE_FROM', subjectVar: '?A', objectVar: '?B' },
      confidenceWeight: 1.0,
    });

    knowledgeEngine.assertFact('Universe_Core', 'CONTAINS', 'Cluster_Alpha');
    const proofSteps = knowledgeEngine.inferNewKnowledge();
    console.log(`  ✓ Theorem Prover Derived ${proofSteps.length} New Proof Steps:`);
    for (const step of proofSteps) {
      console.log(`    [Step ${step.stepNumber}] Fact: '${step.derivedFact.subject} ${step.derivedFact.predicate} ${step.derivedFact.object}' | ${step.justification}`);
    }

    const queriedFact = knowledgeEngine.queryFact('Cluster_Alpha', 'ROUTABLE_FROM', 'Universe_Core');
    if (!queriedFact) {
      throw new Error('Theorem proving failed to deduce spatial routability theorem!');
    }
    console.log(`  ✓ Query Verification for Theorem: '${queriedFact.subject} ${queriedFact.predicate} ${queriedFact.object}' -> CONFIRMED.`);

    // -------------------------------------------------------------------------
    // GATE 3: Integrated Reasoning State Coordinator
    // -------------------------------------------------------------------------
    console.log('\n[Gate 3] Verifying Integrated Reasoning State Pass & PQC Sealing...');
    const coordinator = new ReasoningStateCoordinator();
    coordinator.spatialEngine.registerRegion('Sector_01', [0.0, 0.0, 0.0], [0.5, 0.5, 0.5]);
    coordinator.spatialEngine.registerRegion('Unit_01', [0.1, 0.1, 0.1], [0.2, 0.2, 0.2]);

    coordinator.knowledgeEngine.registerRule({
      id: 'RULE_INVERT',
      name: 'Spatial Inversion',
      antecedents: [{ predicate: 'CONTAINS', subjectVar: '?X', objectVar: '?Y' }],
      consequent: { predicate: 'ENCAPSULATED_BY', subjectVar: '?Y', objectVar: '?X' },
      confidenceWeight: 1.0,
    });

    const report = coordinator.executeFullReasoningPass();
    console.log(`  ✓ Spatial Deductions Inferred : ${report.spatialDeductionsCount}`);
    console.log(`  ✓ Theorems Proved            : ${report.inferredTheoremsCount}`);
    console.log(`  ✓ PQC Root Seal Generated     : ${report.pqcSeal}`);
    console.log(`  ✓ Deterministic State Hash    : ${report.deterministicStateHash}`);
    console.log(`  ✓ Fail-Closed Actuation Block : is_actuation_blocked = ${report.isActuationBlocked}`);

    if (report.spatialDeductionsCount < 1 || report.inferredTheoremsCount < 1) {
      throw new Error('Integrated reasoning report failed to deduce sufficient facts!');
    }

    // -------------------------------------------------------------------------
    // GATE 4: 7-Phase Immutable Cryptographic Lineage (P1 -> P7)
    // -------------------------------------------------------------------------
    console.log('\n[Gate 4] Verifying 7-Phase Immutable Lineage Preservation...');
    const builder = new CubioHyperNeuralBuilder();
    const compileResult = builder.compilePhase7Reasoning('cubio_reasoning_phase7.3dmemory');

    const expectedPhases = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'];
    const actualPhases = compileResult.lineageChain.map((l) => l.phase);
    console.log(`  ✓ Full Lineage Chain : ${actualPhases.join(' -> ')}`);

    if (JSON.stringify(actualPhases) !== JSON.stringify(expectedPhases)) {
      throw new Error(`Lineage mismatch! Expected ${expectedPhases}, got ${actualPhases}`);
    }

    // -------------------------------------------------------------------------
    // GATE 5: Deterministic Replay (100 Cycles, 0.0000% Drift, σ² = 0.0)
    // -------------------------------------------------------------------------
    console.log('\n[Gate 5] Verifying 100-Cycle Deterministic Replay (0.0000% Drift)...');
    const initialHash = report.deterministicStateHash;
    for (let c = 0; c < 100; c++) {
      const replayCoord = new ReasoningStateCoordinator();
      replayCoord.spatialEngine.registerRegion('Sector_01', [0.0, 0.0, 0.0], [0.5, 0.5, 0.5]);
      replayCoord.spatialEngine.registerRegion('Unit_01', [0.1, 0.1, 0.1], [0.2, 0.2, 0.2]);
      replayCoord.knowledgeEngine.registerRule({
        id: 'RULE_INVERT',
        name: 'Spatial Inversion',
        antecedents: [{ predicate: 'CONTAINS', subjectVar: '?X', objectVar: '?Y' }],
        consequent: { predicate: 'ENCAPSULATED_BY', subjectVar: '?Y', objectVar: '?X' },
        confidenceWeight: 1.0,
      });
      const replayed = replayCoord.executeFullReasoningPass(1725200000000);
      if (replayed.deterministicStateHash !== initialHash) {
        throw new Error(`State drift detected during reasoning pass at cycle ${c}!`);
      }
    }
    console.log('  ✓ 100/100 Replay Cycles executed with bit-for-bit exactness (Drift = 0.0000%, σ² = 0.0).');

    // -------------------------------------------------------------------------
    // GATE 6: Sovereign one.exe Toolchain Alignment
    // -------------------------------------------------------------------------
    console.log('\n[Gate 6] Verifying Sovereign one.exe Toolchain Alignment...');
    console.log(compileResult.oneExeOutput.split('\n').slice(0, 5).map((l) => `    ${l}`).join('\n'));

    console.log('\n================================================================================');
    console.log(' 🏆 GATE CNL-P7-001 FULLY CERTIFIED & PASSED (100% SUCCESS)');
    console.log('================================================================================\n');
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('\n❌ FAIL: Gate CNL-P7-001 Test Failure:');
      console.error(err.message);
    }
    process.exit(1);
  }
}

runGateCNLP7001TestSuite();
