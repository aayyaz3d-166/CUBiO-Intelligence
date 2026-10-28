/**
 * ONE Language — Phase 4 Benchmark Suite
 * Module: Memory-On vs Memory-Off Reasoning Utility Benchmark
 * Path: tests/memory/phase4_memory_benchmark.ts
 */

import {
  SelectiveMemory,
  MemoryContextAdapter,
  ConceptGraph,
} from '../../src/one/intelligence/memory';
import {
  ReasoningEngine,
  RuleRegistry,
  ReasoningRule,
  ReasoningStatus,
} from '../../src/one/intelligence/reasoning';

interface MemoryBenchmarkCase {
  id: string;
  description: string;
  input: number;
  goal: (n: number) => boolean;
  goalDescription: string;
  conceptTarget?: string;
  setupMemory: (mem: SelectiveMemory, reg: RuleRegistry<number>) => void;
  expectedMemoryOnSolved: boolean;
  expectedMemoryOffSolved: boolean;
}

export function runPhase4MemoryBenchmarks(): void {
  console.log('='.repeat(95));
  console.log('  ONE LANGUAGE — PHASE 4: MEMORY-ON VS MEMORY-OFF REASONING UTILITY BENCHMARK');
  console.log('='.repeat(95));

  const testCases: MemoryBenchmarkCase[] = [
    {
      id: 'MEM-BM-01',
      description: 'Reasoning with Validated Reusable Rule (Transfer to New Input)',
      input: 12,
      goal: (n: number) => n === 3,
      goalDescription: 'Reach 3 from 12 via halving or decrement',
      conceptTarget: 'concept_target_three',
      setupMemory: (mem, reg) => {
        // Register halve_even rule into procedural memory and promote it
        const halveRule: ReasoningRule<number> = {
          id: 'halve_even',
          description: 'Divide even number by 2',
          isApplicable: (n) => n > 0 && n % 2 === 0,
          apply: (n) => [n / 2],
        };
        mem.registerCandidateRule(halveRule);
        mem.validateAndPromoteRule('halve_even', true, 1); // Promoted to active registry
      },
      expectedMemoryOnSolved: true,
      expectedMemoryOffSolved: false, // Without halving rule in baseline registry, cannot reach in 1 step
    },
    {
      id: 'MEM-BM-02',
      description: 'Reasoning with Irrelevant Memory (Should Not Pollute/Degrade)',
      input: 5,
      goal: (n: number) => n === 4,
      goalDescription: 'Reach 4 from 5',
      conceptTarget: 'concept_unrelated_astronomy',
      setupMemory: (mem, reg) => {
        mem.semanticGraph.addConcept({
          conceptId: 'concept_unrelated_astronomy',
          label: 'Supernova',
          type: 'EVENT',
          attributes: { luminosity: 1e9 },
          source: 'USER_PROVIDED',
          confidence: 1.0,
          version: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        // Baseline has decrement
        reg.register({
          id: 'dec_1',
          description: 'Subtract 1',
          isApplicable: (n) => n > 0,
          apply: (n) => [n - 1],
        });
      },
      expectedMemoryOnSolved: true,
      expectedMemoryOffSolved: true, // Baseline also solves; memory does not degrade
    },
    {
      id: 'MEM-BM-03',
      description: 'Reasoning with Conflicting / Invalidated Rule (Must Avoid Faulty Rule)',
      input: 6,
      goal: (n: number) => n === 0,
      goalDescription: 'Reach 0 from 6',
      setupMemory: (mem, reg) => {
        // Register a faulty rule that diverges
        const faultyRule: ReasoningRule<number> = {
          id: 'faulty_diverge',
          description: 'Diverges away from zero',
          isApplicable: () => true,
          apply: (n) => [n + 10],
        };
        mem.registerCandidateRule(faultyRule);
        mem.validateAndPromoteRule('faulty_diverge', false); // Invalidated!

        // Correct decrement rule
        reg.register({
          id: 'dec_1',
          description: 'Subtract 1',
          isApplicable: (n) => n > 0,
          apply: (n) => [n - 1],
        });
      },
      expectedMemoryOnSolved: true,
      expectedMemoryOffSolved: true, // Both solve because invalidated rule is cleanly excluded
    },
    {
      id: 'MEM-BM-04',
      description: 'Missing Knowledge (Explicit Unresolved Fallback)',
      input: 7,
      goal: (n: number) => n === 0,
      goalDescription: 'Reach 0 without any rules',
      conceptTarget: 'concept_unknown_target',
      setupMemory: () => {
        // No rules registered anywhere
      },
      expectedMemoryOnSolved: false, // Cannot solve without rules
      expectedMemoryOffSolved: false,
    },
  ];

  console.log('\nID         | Description                                        | Memory-Off | Memory-On | Utility Gain | Status');
  console.log('-'.repeat(105));

  for (const tc of testCases) {
    // Setup baseline and memory registries
    const baselineRegistry = new RuleRegistry<number>();
    const memRegistry = new RuleRegistry<number>();
    const memory = new SelectiveMemory(memRegistry);
    const adapter = new MemoryContextAdapter(memory);

    tc.setupMemory(memory, memRegistry);

    // If baseline has identical base rules (e.g. dec_1 in MEM-BM-02 and MEM-BM-03), mirror them
    const memRules = memRegistry.getAll();
    for (const r of memRules) {
      if (r.id === 'dec_1') {
        baselineRegistry.register(r);
      }
    }

    // 1. Evaluate Baseline (Memory-Off)
    const baselineEngine = new ReasoningEngine<number>(baselineRegistry);
    const baselineResult = baselineEngine.solve({
      input: tc.input,
      goal: tc.goal,
      goalDescription: tc.goalDescription,
      maxSteps: 10,
    });

    // 2. Evaluate Memory-Augmented (Memory-On)
    const memEngine = new ReasoningEngine<number>(memRegistry);

    const memResponse = adapter.solveWithMemory(
      memEngine,
      {
        input: tc.input,
        goal: tc.goal,
        goalDescription: tc.goalDescription,
        maxSteps: 10,
      },
      tc.conceptTarget,
    );
    const memResult = memResponse.result;

    const memOffOk = baselineResult.isSolved === tc.expectedMemoryOffSolved;
    const memOnOk = memResult.isSolved === tc.expectedMemoryOnSolved;

    if (!memOffOk || !memOnOk) {
      throw new Error(`[BENCHMARK FAILED] Scenario ${tc.id} outcome mismatch (Off: ${baselineResult.isSolved}, On: ${memResult.isSolved})`);
    }

    const utilityGain = memResult.isSolved && !baselineResult.isSolved ? '+100% (Rule Transfer)' : '0% (Equiv / Handled)';
    const statusText = 'VERIFIED';

    console.log(
      `${tc.id.padEnd(10)} | ${tc.description.padEnd(50)} | ` +
      `${(baselineResult.isSolved ? 'SOLVED' : 'FAILED').padEnd(10)} | ` +
      `${(memResult.isSolved ? 'SOLVED' : 'FAILED').padEnd(9)} | ` +
      `${utilityGain.padEnd(20)} | ${statusText}`,
    );
  }

  console.log('-'.repeat(105));
  console.log('  ✓ All 4 memory utility benchmarks verified: Validated rules transfer; invalidated rules safely excluded.');
  console.log('='.repeat(95) + '\n');
}

if (require.main === module) {
  runPhase4MemoryBenchmarks();
}
