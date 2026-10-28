/**
 * GATE 25 — Continuous Learning Research: Profiling Logic
 *
 * Benchmark runner shared by the entry point.
 * Uses CommonJS require (provied as globals) to load the reasoning engine.
 *
 * Run via: node tests/gate25_profiling_entry.js
 */
"use strict";

// The entry point (gate25_profiling_entry.js) provides these globals
const ReasoningEngine = globalThis.GATE25ReasoningEngine;
const ReasoningStatus = globalThis.GATE25ReasoningStatus;
const ReasoningPolicy = globalThis.GATE25ReasoningPolicy;

// ---------------------------------------------------------------------------
// Benchmark cases
// ---------------------------------------------------------------------------

class BenchCase {
  constructor(id, name, input, goal, constraints, maxSteps, maxCandidates, maxDepth, policy, expectSolved, expectStatus, expectGoalSatisfied, expectBestValue) {
    this.id = id;
    this.name = name;
    this.input = input;
    this.goal = goal;
    this.constraints = constraints;
    this.maxSteps = maxSteps;
    this.maxCandidates = maxCandidates;
    this.maxDepth = maxDepth;
    this.policy = policy;
    this.expectSolved = expectSolved;
    this.expectStatus = expectStatus;
    this.expectGoalSatisfied = expectGoalSatisfied;
    this.expectBestValue = expectBestValue;
  }
}

function buildProfilingBenchmarks() {
  return [
    new BenchCase('P6-01', 'Goal already at root (42 -> 42)', 42,
      function (n) { return n === 42; }, undefined, undefined, undefined, undefined, undefined,
      true, ReasoningStatus.SOLVED, true, 42),
    new BenchCase('P6-02', 'Goal already at root (0 -> 0)', 0,
      function (n) { return n === 0; }, undefined, undefined, undefined, undefined, undefined,
      true, ReasoningStatus.SOLVED, true, 0),
    new BenchCase('P6-03', 'Decrement: 42 -> 0 (explicit depth 45)', 42,
      function (n) { return n === 0; }, [function (n) { return n >= 0; }], 80, 45,
      undefined, true, ReasoningStatus.SOLVED, true, 0),
    new BenchCase('P6-04', 'Decrement: 100 -> 50 (explicit depth 60)', 100,
      function (n) { return n === 50; }, [function (n) { return n >= 0; }], 100, 60,
      undefined, true, ReasoningStatus.SOLVED, true, 50),
    new BenchCase('P6-05', 'Additive synthesis: 5 -> 20', 5,
      function (n) { return n === 20; }, [function (n) { return n >= 0; }], 30, undefined, undefined, undefined,
      true, ReasoningStatus.SOLVED, true, 20),
    new BenchCase('P6-06', 'Decrement: 18 -> 3 (should be fast)', 18,
      function (n) { return n === 3; }, [function (n) { return n >= 0; }], 20, undefined, undefined, undefined,
      true, ReasoningStatus.SOLVED, true, 3),
    new BenchCase('P6-07', 'Multi-step: 10 -> 5 (halve)', 10,
      function (n) { return n === 5; }, [function (n) { return n >= 0; }], undefined, undefined, undefined, undefined,
      true, ReasoningStatus.SOLVED, true, 5),
    new BenchCase('P6-08', 'Multiple paths: 7 -> 3 (dec_1 + dec_2)', 7,
      function (n) { return n === 3; }, [function (n) { return n >= 0; }], undefined, undefined, undefined, undefined,
      true, ReasoningStatus.SOLVED, true, 3),
    new BenchCase('P6-09', 'Unreachable: 5 -> 100 (no increment rule)', 5,
      function (n) { return n === 100; }, [function (n) { return n >= 0; }], undefined, undefined, undefined,
      false, ReasoningStatus.STEP_LIMIT, false),
    new BenchCase('P6-10', 'Invalid: no input value', undefined,
      function (n) { return n === 0; }, undefined, undefined, undefined, undefined,
      false, ReasoningStatus.INVALID_INPUT, false),
    new BenchCase('P6-11', 'Cycle: 1 -> 4 -> 2 -> 1 (dec_1 + mul_3) eventually reaches 0', 1,
      function (n) { return n === 0; }, [function (n) { return n >= 0; }], undefined, undefined, undefined, undefined,
      true, ReasoningStatus.SOLVED, true),
    new BenchCase('P6-12', 'Budget exhausted: 100 -> 0 with maxSteps=3', 100,
      function (n) { return n === 0; }, [function (n) { return n >= 0; }], 3, undefined, undefined,
      false, ReasoningStatus.STEP_LIMIT, false),
    new BenchCase('P6-13', 'Equal-cost paths: 6 -> 3 (dec_2 then dec_1, vs dec_1 x2)', 6,
      function (n) { return n === 3; }, [function (n) { return n >= 0; }], undefined, undefined, undefined, undefined,
      true, ReasoningStatus.SOLVED, true, 3),
    new BenchCase('P6-14', 'Unseen: 9 -> 3 via mul_3_add_1 + dec_1 only', 9,
      function (n) { return n === 3; }, [function (n) { return n >= 0; }], undefined, undefined, undefined, undefined,
      true, ReasoningStatus.SOLVED, true, 3),
    new BenchCase('P6-15', 'Depth limit: 10 -> 0 with maxDepth=2', 10,
      function (n) { return n === 0; }, [function (n) { return n >= 0; }], undefined, 2,
      undefined, false, ReasoningStatus.EXHAUSTED, false),
    new BenchCase('P6-16', 'Candidate budget ceiling: 100 candidates capped', 99,
      function (n) { return n === 0; }, [function (n) { return n >= 0; }], undefined, 100,
      undefined, false, ReasoningStatus.CANDIDATE_LIMIT, false),
    new BenchCase('P6-17', 'Decrement: 42 -> 0 (with step budget)', 42,
      function (n) { return n === 0; }, [function (n) { return n >= 0; }], 60, undefined, undefined, undefined,
      true, ReasoningStatus.SOLVED, true, 0),
    new BenchCase('P6-18', 'Decrement: 18 -> 3', 18,
      function (n) { return n === 3; }, [function (n) { return n >= 0; }], 20, undefined, undefined, undefined,
      true, ReasoningStatus.SOLVED, true, 3),
  ];
}

// ---------------------------------------------------------------------------
// Result container
// ---------------------------------------------------------------------------

class BenchmarkResult {
  constructor(id, name, input, status, isSolved, goalSatisfied, bestValue, stepsUsed, candidatesGenerated, candidatesEvaluated, depthReached, elapsedMs, frontierSize, peakHeapUsedMB, stopReason) {
    this.id = id;
    this.name = name;
    this.input = input;
    this.status = status;
    this.isSolved = isSolved;
    this.goalSatisfied = goalSatisfied;
    this.bestValue = bestValue;
    this.stepsUsed = stepsUsed;
    this.candidatesGenerated = candidatesGenerated;
    this.candidatesEvaluated = candidatesEvaluated;
    this.depthReached = depthReached;
    this.elapsedMs = elapsedMs;
    this.frontierSize = frontierSize;
    this.peakHeapUsedMB = peakHeapUsedMB;
    this.stopReason = stopReason;
  }
}

function getPeakHeapUsedMB() {
  try {
    const stats = process.memoryUsage();
    return stats.heapUsed / (1024 * 1024);
  } catch (e) {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Engine runner
// ---------------------------------------------------------------------------

function runProfilingBenchmarks(ReasoningEngineCtor, ReasoningStatus, ReasoningPolicy) {
  const cases = buildProfilingBenchmarks();
  const results = [];
  const engine = new ReasoningEngineCtor();

  engine.getRegistry().register({
    id: 'dec_1',
    description: 'Subtract 1',
    priority: 10,
    isApplicable: function (n) { return n > 0; },
    apply: function (n) { return [n - 1]; },
  });
  engine.getRegistry().register({
    id: 'dec_2',
    description: 'Subtract 2',
    priority: 8,
    isApplicable: function (n) { return n > 1; },
    apply: function (n) { return [n - 2]; },
  });
  engine.getRegistry().register({
    id: 'mul_3_add_1',
    description: 'Collatz forward step for odd numbers',
    priority: 5,
    isApplicable: function (n) { return n > 0 && n % 2 !== 0 && n < 100; },
    apply: function (n) { return [3 * n + 1]; },
  });

  for (let i = 0; i < cases.length; i++) {
    const tc = cases[i];
    const t0 = performance.now();
    const result = engine.solve({
      input: tc.input,
      goal: tc.goal,
      constraints: tc.constraints,
      maxSteps: tc.maxSteps,
      maxCandidates: tc.maxCandidates,
      maxDepth: tc.maxDepth,
      policy: tc.policy,
    });
    const elapsed = performance.now() - t0;

    results.push(new BenchmarkResult(
      tc.id, tc.name, tc.input, result.status, result.isSolved,
      result.goalSatisfied || false,
      result.bestCandidate ? result.bestCandidate.value : undefined,
      result.metrics ? result.metrics.stepsUsed : 0,
      result.metrics ? result.metrics.candidatesGenerated : 0,
      result.metrics ? result.metrics.candidatesEvaluated : 0,
      result.metrics ? result.metrics.depthReached : 0,
      elapsed, 0, getPeakHeapUsedMB(), result.stopReason || ''
    ));

    // Verify against expectations
    let ok = true;
    const issues = [];
    if (tc.expectSolved !== undefined && result.isSolved !== tc.expectSolved) { ok = false; issues.push('isSolved'); }
    if (tc.expectStatus !== undefined && result.status !== tc.expectStatus) { ok = false; issues.push('status'); }
    if (tc.expectGoalSatisfied !== undefined && result.goalSatisfied !== tc.expectGoalSatisfied) { ok = false; issues.push('goalSatisfied'); }
    if (tc.expectSolved && result.bestCandidate && tc.expectBestValue !== undefined && result.bestCandidate.value !== tc.expectBestValue) {
      ok = false; issues.push('bestValue');
    }
    if (!ok) {
      console.log('  \u2717 ' + tc.id + ' | ' + tc.name + ' | ' + result.status + ' | issues: ' + issues.join(', '));
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Stats computation (median/p95, etc.)
// ---------------------------------------------------------------------------

function computeStats(results) {
  const elapsedList = results.map(r => r.elapsedMs);
  elapsedList.sort((a, b) => a - b);

  const n = elapsedList.length;
  const median = n % 2 === 0 ? (elapsedList[n / 2 - 1] + elapsedList[n / 2]) / 2 : elapsedList[Math.floor(n / 2)];
  const p95 = elapsedList[Math.floor(n * 0.95)];

  const solved = results.filter(r => r.isSolved);
  const unsolved = results.filter(r => !r.isSolved);

  return {
    total: n,
    medianMs: median,
    p95Ms: p95,
    meanMs: elapsedList.reduce((a, b) => a + b, 0) / n,
    solved: solved.length,
    unsolved: unsolved.length,
    maxHeapMB: Math.max(...results.map(r => r.peakHeapUsedMB)),
    stepLimitHits: results.filter(r => r.status === ReasoningStatus.STEP_LIMIT).length,
    candidateLimitHits: results.filter(r => r.status === ReasoningStatus.CANDIDATE_LIMIT).length,
    depthLimitHits: results.filter(r => r.status === ReasoningStatus.DEPTH_LIMIT).length,
    exhaustedHits: results.filter(r => r.status === ReasoningStatus.EXHAUSTED).length,
    invalidInputHits: results.filter(r => r.status === ReasoningStatus.INVALID_INPUT).length,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function run() {
  console.log('='.repeat(80));
  console.log('  GATE 25 \u2014 Continuous Learning Research: Profiling Baseline');
  console.log('='.repeat(80));

  const results = runProfilingBenchmarks(ReasoningEngine, ReasoningStatus, ReasoningPolicy);
  const stats = computeStats(results);

  console.log('');
  console.log('ID     | Name                                            | Status       | Steps | Cands | Time(ms) | PeakMB | Solved');
  console.log('-'.repeat(130));
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    console.log(
      r.id.padEnd(6) + ' | ' + r.name.padEnd(47) + ' | ' + r.status.padEnd(12) + ' | ' +
      r.stepsUsed.toString().padStart(5) + ' | ' + r.candidatesGenerated.toString().padStart(5) + ' | ' +
      r.elapsedMs.toFixed(2).padStart(8) + ' | ' + r.peakHeapUsedMB.toFixed(2).padStart(6) + ' | ' + r.isSolved
    );
  }

  console.log('-'.repeat(130));
  console.log('STATS');
  console.log('  Total cases:                        ' + stats.total);
  console.log('  Median latency (ms):                ' + stats.medianMs.toFixed(2));
  console.log('  P95 latency (ms):                   ' + stats.p95Ms.toFixed(2));
  console.log('  Mean latency (ms):                  ' + stats.meanMs.toFixed(2));
  console.log('  Solved:                             ' + stats.solved);
  console.log('  Unsolved:                           ' + stats.unsolved);
  console.log('  Peak heap (MB):                     ' + stats.maxHeapMB.toFixed(2));
  console.log('  Step-limit hits:                    ' + stats.stepLimitHits);
  console.log('  Candidate-limit hits:               ' + stats.candidateLimitHits);
  console.log('  Depth-limit hits:                   ' + stats.depthLimitHits);
  console.log('  Exhausted hits:                     ' + stats.exhaustedHits);
  console.log('  Invalid-input hits:                 ' + stats.invalidInputHits);
  console.log('');
  console.log('  \u2713 Profiling baseline complete. Results saved for GATE 25 experimental branch.');
}

if (require.main === module) {
  run();
}
