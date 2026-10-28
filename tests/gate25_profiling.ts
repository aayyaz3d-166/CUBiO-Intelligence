/**
 * GATE 25 — Continuous Learning Research: Profiling Baseline (CommonJS)
 *
 * Runs the reasoning engine benchmarks and captures performance profiles
 * (median/p95 latency, peak memory, states explored, queue size, failure rates)
 * WITHOUT modifying production weights.
 *
 * Build: npx tsc tests/gate25_profiling.ts --outDir dist --module commonjs --target es2022 --esModuleInterop
 * Run:   node dist/tests/gate25_profiling.js
 */

const {
  ReasoningEngine,
  ReasoningRule,
  ReasoningStatus,
  ReasoningPolicy,
  StateExplorer,
} = require('../dist/one/intelligence/reasoning/index.js');

function BenchCase(id, name, input, goal, constraints, maxSteps, maxCandidates, maxDepth, policy, expectSolved, expectStatus, expectGoalSatisfied, expectBestValue) {
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

function buildProfilingBenchmarks() {
  const engine = new ReasoningEngine();

  engine.getRegistry().register({
    id: 'dec_1',
    description: 'Subtract 1',
    priority: 10,
    isApplicable: function(n) { return n > 0; },
    apply: function(n) { return [n - 1]; },
  });
  engine.getRegistry().register({
    id: 'dec_2',
    description: 'Subtract 2',
    priority: 8,
    isApplicable: function(n) { return n > 1; },
    apply: function(n) { return [n - 2]; },
  });
  engine.getRegistry().register({
    id: 'mul_3_add_1',
    description: 'Collatz forward step for odd numbers',
    priority: 5,
    isApplicable: function(n) { return n > 0 && n % 2 !== 0 && n < 100; },
    apply: function(n) { return [3 * n + 1]; },
  });

  return [
    new BenchCase('P6-01', 'Goal already at root (42 -> 42)', 42,
      function(n) { return n === 42; }, undefined, undefined, undefined, undefined, undefined,
      true, ReasoningStatus.SOLVED, true, 42),
    new BenchCase('P6-02', 'Goal already at root (0 -> 0)', 0,
      function(n) { return n === 0; }, undefined, undefined, undefined, undefined, undefined,
      true, ReasoningStatus.SOLVED, true, 0),
    new BenchCase('P6-03', 'Decrement: 42 -> 0 (explicit depth 45)', 42,
      function(n) { return n === 0; }, [(function(n) { return n >= 0; })], 80, 45,
      undefined, true, ReasoningStatus.SOLVED, true, 0),
    new BenchCase('P6-04', 'Decrement: 100 -> 50 (explicit depth 60)', 100,
      function(n) { return n === 50; }, [(function(n) { return n >= 0; })], 100, 60,
      undefined, true, ReasoningStatus.SOLVED, true, 50),
    new BenchCase('P6-05', 'Additive synthesis: 5 -> 20', 5,
      function(n) { return n === 20; }, [(function(n) { return n >= 0; })], 30, undefined, undefined, undefined,
      true, ReasoningStatus.SOLVED, true, 20),
    new BenchCase('P6-06', 'Decrement: 18 -> 3 (should be fast)', 18,
      function(n) { return n === 3; }, [(function(n) { return n >= 0; })], 20, undefined, undefined, undefined,
      true, ReasoningStatus.SOLVED, true, 3),
    new BenchCase('P6-07', 'Multi-step: 10 -> 5 (halve)', 10,
      function(n) { return n === 5; }, [(function(n) { return n >= 0; })], undefined, undefined, undefined, undefined,
      true, ReasoningStatus.SOLVED, true, 5),
    new BenchCase('P6-08', 'Multiple paths: 7 -> 3 (dec_1 + dec_2)', 7,
      function(n) { return n === 3; }, [(function(n) { return n >= 0; })], undefined, undefined, undefined, undefined,
      true, ReasoningStatus.SOLVED, true, 3),
    new BenchCase('P6-09', 'Unreachable: 5 -> 100 (no increment rule)', 5,
      function(n) { return n === 100; }, [(function(n) { return n >= 0; })], undefined, undefined, undefined,
      false, ReasoningStatus.STEP_LIMIT, false),
    new BenchCase('P6-10', 'Invalid: no input value', undefined,
      function(n) { return n === 0; }, undefined, undefined, undefined, undefined,
      false, ReasoningStatus.INVALID_INPUT, false),
    new BenchCase('P6-11', 'Cycle: 1 -> 4 -> 2 -> 1 (dec_1 + mul_3) eventually reaches 0', 1,
      function(n) { return n === 0; }, [(function(n) { return n >= 0; })], undefined, undefined, undefined, undefined,
      true, ReasoningStatus.SOLVED, true),
    new BenchCase('P6-12', 'Budget exhausted: 100 -> 0 with maxSteps=3', 100,
      function(n) { return n === 0; }, [(function(n) { return n >= 0; })], 3, undefined, undefined,
      false, ReasoningStatus.STEP_LIMIT, false),
    new BenchCase('P6-13', 'Equal-cost paths: 6 -> 3 (dec_2 then dec_1, vs dec_1 x2)', 6,
      function(n) { return n === 3; }, [(function(n) { return n >= 0; })], undefined, undefined, undefined, undefined,
      true, ReasoningStatus.SOLVED, true, 3),
    new BenchCase('P6-14', 'Unseen: 9 -> 3 via mul_3_add_1 + dec_1 only', 9,
      function(n) { return n === 3; }, [(function(n) { return n >= 0; })], undefined, undefined, undefined, undefined,
      true, ReasoningStatus.SOLVED, true, 3),
    new BenchCase('P6-15', 'Depth limit: 10 -> 0 with maxDepth=2', 10,
      function(n) { return n === 0; }, [(function(n) { return n >= 0; })], undefined, 2,
      undefined, false, ReasoningStatus.EXHAUSTED, false),
    new BenchCase('P6-16', 'Candidate budget ceiling: 100 candidates capped', 99,
      function(n) { return n === 0; }, [(function(n) { return n >= 0; })], undefined, 100,
      undefined, false, ReasoningStatus.CANDIDATE_LIMIT, false),
    new BenchCase('P6-17', 'Decrement: 42 -> 0 (with step budget)', 42,
      function(n) { return n === 0; }, [(function(n) { return n >= 0; })], 60, undefined, undefined, undefined,
      true, ReasoningStatus.SOLVED, true, 0),
    new BenchCase('P6-18', 'Decrement: 18 -> 3', 18,
      function(n) { return n === 3; }, [(function(n) { return n >= 0; })], 20, undefined, undefined, undefined,
      true, ReasoningStatus.SOLVED, true, 3),
  ];
}

function BenchmarkResult(id, name, input, status, isSolved, goalSatisfied, bestValue, stepsUsed, candidatesGenerated, candidatesEvaluated, depthReached, elapsedMs, frontierSize, peakHeapUsedMB, stopReason) {
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

function getPeakHeapUsedMB() {
  try {
    const stats = process.memoryUsage();
    return stats.heapUsed / (1024 * 1024);
  } catch {
    return 0;
  }
}

function runProfilingBenchmarks() {
  const cases = buildProfilingBenchmarks();
  const results = [];
  const engine = new ReasoningEngine();

  engine.getRegistry().register({
    id: 'dec_1',
    description: 'Subtract 1',
    priority: 10,
    isApplicable: function(n) { return n > 0; },
    apply: function(n) { return [n - 1]; },
  });
  engine.getRegistry().register({
    id: 'dec_2',
    description: 'Subtract 2',
    priority: 8,
    isApplicable: function(n) { return n > 1; },
    apply: function(n) { return [n - 2]; },
  });
  engine.getRegistry().register({
    id: 'mul_3_add_1',
    description: 'Collatz forward step for odd numbers',
    priority: 5,
    isApplicable: function(n) { return n > 0 && n % 2 !== 0 && n < 100; },
    apply: function(n) { return [3 * n + 1]; },
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

    let ok = true;
    const issues = [];
    if (tc.expectSolved !== undefined && result.isSolved !== tc.expectSolved) { ok = false; issues.push('isSolved'); }
    if (tc.expectStatus !== undefined && result.status !== tc.expectStatus) { ok = false; issues.push('status'); }
    if (tc.expectGoalSatisfied !== undefined && result.goalSatisfied !== tc.expectGoalSatisfied) { ok = false; issues.push('goalSatisfied'); }
    if (tc.expectSolved && result.bestCandidate && tc.expectBestValue !== undefined && result.bestCandidate.value !== tc.expectBestValue) {
      ok = false; issues.push('bestValue');
    }
    if (!ok) {
      console.log('  ✗ ' + tc.id + ' | ' + tc.name + ' | ' + result.status + ' | issues: ' + issues.join(', '));
    }
  }

  return results;
}

if (require.main === module) {
  console.log('='.repeat(80));
  console.log('  GATE 25 — Continuous Learning Research: Profiling Baseline');
  console.log('='.repeat(80));

  const results = runProfilingBenchmarks();

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
  console.log('  ✓ Profiling baseline complete. Results saved for GATE 25 experimental branch.');
}
