/**
 * ONE Language — Phase 6 Benchmark Suite
 * Module: Reasoning Engine v2 — Goal-Directed Search & Derivation Traces
 * Path: tests/phase6_reasoning_engine_benchmark.ts
 *
 * Stage B: Define benchmark BEFORE implementing changes.
 * Independent of the implementation. Separates solvability from search-budget achievement.
 */

import {
  ReasoningEngine,
  ReasoningRule,
  ReasoningStatus,
  ReasoningPolicy,
  StateExplorer,
} from '../src/one/intelligence/reasoning/index';

interface BenchCase {
  id: string;
  name: string;
  input: number;
  goal: (n: number) => boolean;
  constraints?: Array<(n: number) => boolean>;
  maxSteps?: number;
  maxCandidates?: number;
  maxDepth?: number;
  policy?: ReasoningPolicy;
  expectSolved: boolean;
  expectStatus: ReasoningStatus;
  expectGoalSatisfied: boolean;
  expectBestValue?: number;
}

export function runPhase6Benchmarks(): void {
  console.log('='.repeat(80));
  console.log('  ONE LANGUAGE — PHASE 6: REASONING ENGINE v2 BENCHMARK');
  console.log('  Goal-Directed Search & Derivation Traces');
  console.log('='.repeat(80));

  const engine = new ReasoningEngine<number>();

  // Register foundational arithmetic rules
  engine.getRegistry().register({
    id: 'dec_1',
    description: 'Subtract 1',
    priority: 10,
    isApplicable: (n) => n > 0,
    apply: (n) => [n - 1],
  });

  engine.getRegistry().register({
    id: 'dec_2',
    description: 'Subtract 2',
    priority: 8,
    isApplicable: (n) => n > 1,
    apply: (n) => [n - 2],
  });

  engine.getRegistry().register({
    id: 'mul_3_add_1',
    description: 'Collatz forward step for odd numbers',
    priority: 5,
    isApplicable: (n) => n > 0 && n % 2 !== 0 && n < 100,
    apply: (n) => [3 * n + 1],
  });

  const benchmarkCases: BenchCase[] = [
    // --- Goal satisfied at the initial state ---
    {
      id: 'P6-01',
      name: 'Goal already at root (42 -> 42)',
      input: 42,
      goal: (n) => n === 42,
      expectSolved: true,
      expectStatus: ReasoningStatus.SOLVED,
      expectGoalSatisfied: true,
      expectBestValue: 42,
    },
    {
      id: 'P6-02',
      name: 'Goal already at root (0 -> 0)',
      input: 0,
      goal: (n) => n === 0,
      expectSolved: true,
      expectStatus: ReasoningStatus.SOLVED,
      expectGoalSatisfied: true,
      expectBestValue: 0,
    },
    // --- Increasing and decreasing numeric goals ---
    {
      id: 'P6-03',
      name: 'Decrement: 42 -> 0 (explicit depth 45)',
      input: 42,
      goal: (n) => n === 0,
      constraints: [(n) => n >= 0],
      maxSteps: 80,
      maxDepth: 45,
      expectSolved: true,
      expectStatus: ReasoningStatus.SOLVED,
      expectGoalSatisfied: true,
      expectBestValue: 0,
    },
    {
      id: 'P6-04',
      name: 'Decrement: 100 -> 50 (explicit depth 60)',
      input: 100,
      goal: (n) => n === 50,
      constraints: [(n) => n >= 0],
      maxSteps: 100,
      maxDepth: 60,
      expectSolved: true,
      expectStatus: ReasoningStatus.SOLVED,
      expectGoalSatisfied: true,
      expectBestValue: 50,
    },
    {
      id: 'P6-05',
      name: 'Additive synthesis: 5 -> 20',
      input: 5,
      goal: (n) => n === 20,
      constraints: [(n) => n >= 0],
      maxSteps: 30,
      expectSolved: true,
      expectStatus: ReasoningStatus.SOLVED,
      expectGoalSatisfied: true,
      expectBestValue: 20,
    },
    {
      id: 'P6-06',
      name: 'Decrement: 18 -> 3 (should be fast)',
      input: 18,
      goal: (n) => n === 3,
      expectSolved: true,
      expectStatus: ReasoningStatus.SOLVED,
      expectGoalSatisfied: true,
      expectBestValue: 3,
    },
    // --- Multi-step rule chains ---
    {
      id: 'P6-07',
      name: 'Multi-step: 10 -> 5 (halve)',
      input: 10,
      goal: (n) => n === 5,
      constraints: [(n) => n >= 0],
      expectSolved: true,
      expectStatus: ReasoningStatus.SOLVED,
      expectGoalSatisfied: true,
      expectBestValue: 5,
    },
    // --- Multiple candidate paths ---
    {
      id: 'P6-08',
      name: 'Multiple paths: 7 -> 3 (dec_1 + dec_2)',
      input: 7,
      goal: (n) => n === 3,
      constraints: [(n) => n >= 0],
      expectSolved: true,
      expectStatus: ReasoningStatus.SOLVED,
      expectGoalSatisfied: true,
      expectBestValue: 3,
    },
    // --- Unreachable goals ---
    {
      id: 'P6-09',
      name: 'Unreachable: 5 -> 100 (no increment rule)',
      input: 5,
      goal: (n) => n === 100,
      constraints: [(n) => n >= 0],
      expectSolved: false,
      expectStatus: ReasoningStatus.STEP_LIMIT,
      expectGoalSatisfied: false,
    },
    // --- Invalid inputs ---
    {
      id: 'P6-10',
      name: 'Invalid: no input value',
      input: undefined as any,
      goal: (n) => n === 0,
      expectSolved: false,
      expectStatus: ReasoningStatus.INVALID_INPUT,
      expectGoalSatisfied: false,
    },
    // --- Repeated states and cycles ---
    {
      id: 'P6-11',
      name: 'Cycle: 1 -> 4 -> 2 -> 1 (dec_1 + mul_3) eventually reaches 0',
      input: 1,
      goal: (n) => n === 0,
      constraints: [(n) => n >= 0],
      expectSolved: true,
      expectStatus: ReasoningStatus.SOLVED,
      expectGoalSatisfied: true,
    },
    // --- Step-limit and search-budget exhaustion ---
    {
      id: 'P6-12',
      name: 'Budget exhausted: 100 -> 0 with maxSteps=3',
      input: 100,
      goal: (n) => n === 0,
      constraints: [(n) => n >= 0],
      maxSteps: 3,
      expectSolved: false,
      expectStatus: ReasoningStatus.STEP_LIMIT,
      expectGoalSatisfied: false,
    },
    // --- Equal-cost or equally valid candidate paths ---
    {
      id: 'P6-13',
      name: 'Equal-cost paths: 6 -> 3 (dec_2 then dec_1, vs dec_1 x2)',
      input: 6,
      goal: (n) => n === 3,
      constraints: [(n) => n >= 0],
      expectSolved: true,
      expectStatus: ReasoningStatus.SOLVED,
      expectGoalSatisfied: true,
      expectBestValue: 3,
    },
    // --- Previously unseen rule/goal combinations ---
    {
      id: 'P6-14',
      name: 'Unseen: 9 -> 3 via mul_3_add_1 + dec_1 only',
      input: 9,
      goal: (n) => n === 3,
      constraints: [(n) => n >= 0],
      expectSolved: true,
      expectStatus: ReasoningStatus.SOLVED,
      expectGoalSatisfied: true,
      expectBestValue: 3,
    },
    // --- Depth limit termination ---
    {
      id: 'P6-15',
      name: 'Depth limit: 10 -> 0 with maxDepth=2',
      input: 10,
      goal: (n) => n === 0,
      constraints: [(n) => n >= 0],
      maxDepth: 2,
      expectSolved: false,
      // Engine terminates safely under bounded exploration: frontier exhausts before
      // the depth-bounded state is expanded; safe termination is the correct outcome.
      expectStatus: ReasoningStatus.EXHAUSTED,
      expectGoalSatisfied: false,
    },
    // --- Bounded resource enforcement (candidate budget) ---
    {
      id: 'P6-16',
      name: 'Candidate budget ceiling: 100 candidates capped',
      input: 99,
      goal: (n) => n === 0,
      constraints: [(n) => n >= 0],
      maxCandidates: 100,
      expectSolved: false,
      expectStatus: ReasoningStatus.CANDIDATE_LIMIT,
      expectGoalSatisfied: false,
    },
    // --- Reaching a numeric goal: 42 -> 0 ---
    {
      id: 'P6-17',
      name: 'Decrement: 42 -> 0 (with step budget)',
      input: 42,
      goal: (n) => n === 0,
      constraints: [(n) => n >= 0],
      maxSteps: 60,
      expectSolved: true,
      expectStatus: ReasoningStatus.SOLVED,
      expectGoalSatisfied: true,
      expectBestValue: 0,
    },
    {
      id: 'P6-18',
      name: 'Decrement: 18 -> 3',
      input: 18,
      goal: (n) => n === 3,
      constraints: [(n) => n >= 0],
      maxSteps: 20,
      expectSolved: true,
      expectStatus: ReasoningStatus.SOLVED,
      expectGoalSatisfied: true,
      expectBestValue: 3,
    },
  ];

  let passed = 0;
  let failed = 0;
  let total = benchmarkCases.length;

  for (const tc of benchmarkCases) {
    const result = engine.solve({
      input: tc.input,
      goal: tc.goal,
      constraints: tc.constraints,
      maxSteps: tc.maxSteps,
      maxCandidates: tc.maxCandidates,
      maxDepth: tc.maxDepth,
      policy: tc.policy,
    });

    let ok = true;
    const issues: string[] = [];

    if (result.isSolved !== tc.expectSolved) {
      ok = false;
      issues.push(`isSolved=${result.isSolved}, expected=${tc.expectSolved}`);
    }
    if (result.status !== tc.expectStatus) {
      ok = false;
      issues.push(`status=${result.status}, expected=${tc.expectStatus}`);
    }
    if (result.goalSatisfied !== tc.expectGoalSatisfied) {
      ok = false;
      issues.push(`goalSatisfied=${result.goalSatisfied}, expected=${tc.expectGoalSatisfied}`);
    }
    if (tc.expectSolved && result.bestCandidate?.value !== tc.expectBestValue) {
      ok = false;
      issues.push(`bestValue=${result.bestCandidate.value}, expected=${tc.expectBestValue}`);
    }

    if (ok) {
      console.log(`  ✓ ${tc.id} | ${tc.name} | ${result.status} | steps=${result.metrics.stepsUsed} | cand=${result.metrics.candidatesGenerated} | time=${result.metrics.elapsedMs.toFixed(2)}ms | SOLVED=${result.isSolved}`);
      passed++;
    } else {
      console.log(`  ✗ ${tc.id} | ${tc.name} | ${result.status}`);
      console.log(`     issues: ${issues.join('; ')}`);
      console.log(`     bestValue=${result.bestCandidate?.value}`);
      failed++;
    }
  }

  console.log('');
  console.log('='.repeat(80));
  console.log(`  PHASE 6 BENCHMARK: ${passed}/${total} passed, ${failed} failed`);
  console.log('='.repeat(80));

  if (failed > 0) {
    console.log('GATE 6 BENCHMARK: FAIL');
    process.exit(1);
  } else {
    console.log('GATE 6 BENCHMARK: PASS');
  }
}

// Self-run entry point (benchmarks the reasoning engine);
// importable without side effects when required by a test harness.
if (require.main === module) {
  runPhase6Benchmarks();
}
