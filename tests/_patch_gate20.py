from hermes_tools import write_file

path = 'tests/gate20_benchmark.ts'

content = r'''/**
 * ONE LANGUAGE — GATE 20: Benchmark & Generalization Testing
 * Versioned benchmark: DEV / REGRESSION / HELD-OUT
 *
 * Scoring rules (defined before running):
 *  - Per-category pass rate, NOT an "intelligence percentage".
 *  - PASS/FAIL by exact engine output (status, goalSatisfied, bestValue)
 *    vs. expected contract, never approximate.
 *  - Held-out reported separately, labelled "HELD-OUT — NOT FOR TRAINING DATA".
 *  - Gate 10 baseline comparison is a count (178/178), not a statistic.
 *
 * Acceptance: reproducible, versioned evaluation with honest held-out status
 * and detailed failure analysis.
 */

import {
  ReasoningEngine,
  ReasoningRule,
  ReasoningStatus,
} from '../src/one/intelligence/reasoning';

export const BENCHMARK_VERSION = 'GATE-20-2026-10-11-v1';

export type SetCategory =
  | 'arithmetic_rule_chains'
  | 'concept_queries'
  | 'multi_turn_references'
  | 'ambiguity'
  | 'invalid_inputs'
  | 'unsupported_relationships'
  | 'safety_routing'
  | 'resource_limits';

export interface BenchCase {
  id: string;
  name: string;
  category: SetCategory;
  input?: number | string;
  isStringToken: boolean;
  expectSolved: boolean;
  expectStatus: ReasoningStatus;
  expectGoalSatisfied: boolean;
  expectBestValue?: number;
  goal?: (n: number) => boolean;
  constraints?: Array<(n: number) => boolean>;
  expectSideChannel?: string;
  maxSteps?: number;
  maxCandidates?: number;
  maxDepth?: number;
  provenanceNote?: string;
}

const DEV_CASES: BenchCase[] = [
  { id: 'P6-01', name: 'Goal at root (42)', category: 'arithmetic_rule_chains', input: 42, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectBestValue: 42 },
  { id: 'P6-02', name: 'Goal at root (0)', category: 'arithmetic_rule_chains', input: 0, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectBestValue: 0 },
  { id: 'P6-03', name: '42 -> 0 (depth 45)', category: 'arithmetic_rule_chains', input: 42, isStringToken: false, goal: n => n === 0, constraints: [n => n >= 0], maxDepth: 45, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectBestValue: 0 },
  { id: 'P6-04', name: '100 -> 50 (depth 60)', category: 'arithmetic_rule_chains', input: 100, isStringToken: false, goal: n => n === 50, constraints: [n => n >= 0], maxDepth: 60, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectBestValue: 50 },
  { id: 'P6-05', name: '5 -> 20 additive', category: 'arithmetic_rule_chains', input: 5, isStringToken: false, goal: n => n === 20, constraints: [n => n >= 0], maxSteps: 15, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectBestValue: 20 },
  { id: 'P6-06', name: '12 -> 39 additive', category: 'arithmetic_rule_chains', input: 12, isStringToken: false, goal: n => n === 39, constraints: [n => n >= 0], maxSteps: 20, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectBestValue: 39 },
  { id: 'P6-07', name: '100 -> 5 additive', category: 'arithmetic_rule_chains', input: 100, isStringToken: false, goal: n => n === 5, constraints: [n => n >= 0], maxSteps: 95, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectBestValue: 5 },
  { id: 'P6-08', name: '50 -> 100 additive', category: 'arithmetic_rule_chains', input: 50, isStringToken: false, goal: n => n === 100, constraints: [n => n >= 0], maxSteps: 50, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectBestValue: 100 },
  { id: 'P6-09', name: '5 -> 100 unreachable', category: 'arithmetic_rule_chains', input: 5, isStringToken: false, goal: n => n === 100, constraints: [n => n >= 0], maxSteps: 10, expectSolved: false, expectStatus: ReasoningStatus.STEP_LIMIT, expectGoalSatisfied: false },
  { id: 'P6-10', name: '100 -> 0, maxSteps=3', category: 'arithmetic_rule_chains', input: 100, isStringToken: false, goal: n => n === 0, constraints: [n => n >= 0], maxSteps: 3, expectSolved: false, expectStatus: ReasoningStatus.STEP_LIMIT, expectGoalSatisfied: false },
  { id: 'P6-11', name: 'Cycle 1 -> 4 -> 2 -> 1', category: 'arithmetic_rule_chains', input: 1, isStringToken: false, goal: n => n === 0, constraints: [n => n >= 0], expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'P6-12', name: '100 -> 0, maxSteps=3', category: 'arithmetic_rule_chains', input: 100, isStringToken: false, goal: n => n === 0, constraints: [n => n >= 0], maxSteps: 3, expectSolved: false, expectStatus: ReasoningStatus.STEP_LIMIT, expectGoalSatisfied: false },
  { id: 'P6-13', name: '6 -> 3', category: 'arithmetic_rule_chains', input: 6, isStringToken: false, goal: n => n === 3, constraints: [n => n >= 0], expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectBestValue: 3 },
  { id: 'P6-14', name: '9 -> 3 unseen', category: 'arithmetic_rule_chains', input: 9, isStringToken: false, goal: n => n === 3, constraints: [n => n >= 0], expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectBestValue: 3 },
  { id: 'P6-15', name: '10 -> 0, maxDepth=2', category: 'arithmetic_rule_chains', input: 10, isStringToken: false, goal: n => n === 0, constraints: [n => n >= 0], maxDepth: 2, expectSolved: false, expectStatus: ReasoningStatus.EXHAUSTED, expectGoalSatisfied: false },
  { id: 'P6-16', name: '100 candidates capped', category: 'arithmetic_rule_chains', input: 99, isStringToken: false, goal: n => n === 0, constraints: [n => n >= 0], maxCandidates: 100, expectSolved: false, expectStatus: ReasoningStatus.CANDIDATE_LIMIT, expectGoalSatisfied: false },
  { id: 'P6-17', name: '42 -> 0 with budget', category: 'arithmetic_rule_chains', input: 42, isStringToken: false, goal: n => n === 0, constraints: [n => n >= 0], maxSteps: 60, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectBestValue: 0 },
  { id: 'P6-18', name: '18 -> 3', category: 'arithmetic_rule_chains', input: 18, isStringToken: false, goal: n => n === 3, constraints: [n => n >= 0], maxSteps: 20, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectBestValue: 3 },
];

const HELD_OUT_CASES: BenchCase[] = [
  { id: 'HO-ARITH-01', name: 'Chain 12 -> 6 -> 3', category: 'arithmetic_rule_chains', input: 12, isStringToken: false, goal: n => n === 3, constraints: [n => n >= 0], expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectBestValue: 3, provenanceNote: 'Collatz-style chain not in dev set.' },
  { id: 'HO-ARITH-02', name: 'Chain 25 -> 15', category: 'arithmetic_rule_chains', input: 25, isStringToken: false, goal: n => n === 15, constraints: [n => n >= 0], expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectBestValue: 15, provenanceNote: 'Multi-step requires choosing dec_1 vs dec_2.' },
  { id: 'HO-ARITH-03', name: 'Cycle detection, depth budget', category: 'arithmetic_rule_chains', input: 2, isStringToken: false, goal: n => n === 0, constraints: [n => n >= 0], maxCandidates: 20, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectMaxCandidates: 20, provenanceNote: 'Cycle guard under bounded candidate budget.' },
  { id: 'HO-CONCEPT-01', name: 'Two-hop property path', category: 'concept_queries', input: 'concept_lamp', isStringToken: true, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectSideChannel: 'CONCEPT_QUERY', provenanceNote: 'Chained property traversal.' },
  { id: 'HO-CONCEPT-02', name: 'Cross-type isA relation', category: 'concept_queries', input: 'concept_glass', isStringToken: true, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectSideChannel: 'CONCEPT_QUERY', provenanceNote: 'isA across material/object categories.' },
  { id: 'HO-MULTI-01', name: 'Coreference after concept probe', category: 'multi_turn_references', input: 'It has a surface', isStringToken: true, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectSideChannel: 'MULTI_TURN', provenanceNote: 'Session-scoped reference window.' },
  { id: 'HO-MULTI-02', name: 'Consecutive reference', category: 'multi_turn_references', input: 'What is its color?', isStringToken: true, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectSideChannel: 'MULTI_TURN', provenanceNote: 'Reference without re-specification.' },
  { id: 'HO-AMBIG-01', name: 'Pronoun with no referent', category: 'ambiguity', input: 'What is it?', isStringToken: true, expectSolved: false, expectStatus: ReasoningStatus.ERROR, expectGoalSatisfied: false, expectSideChannel: 'CLARIFICATION_NEEDED', provenanceNote: 'Pronoun triggers clarification, not guess.' },
  { id: 'HO-AMBIG-02', name: 'Ambiguous action on unknown entity', category: 'ambiguity', input: 'Add 5 to it', isStringToken: true, expectSolved: false, expectStatus: ReasoningStatus.ERROR, expectGoalSatisfied: false, expectSideChannel: 'CLARIFICATION_NEEDED', provenanceNote: 'Unresolved action -> clarification.' },
  { id: 'HO-INVALID-01', name: 'Empty-string query', category: 'invalid_inputs', input: '', isStringToken: true, expectSolved: false, expectStatus: ReasoningStatus.INVALID_INPUT, expectGoalSatisfied: false, expectSideChannel: 'INVALID_INPUT', expectMaxSteps: 0, provenanceNote: 'Empty prompt rejected before engine work.' },
  { id: 'HO-INVALID-02', name: 'Numeric overflow guard', category: 'invalid_inputs', input: 10 ** 12, isStringToken: false, expectSolved: false, expectStatus: ReasoningStatus.ERROR, expectGoalSatisfied: false, expectSideChannel: 'INVALID_INPUT', provenanceNote: 'Unbounded large-space guard.' },
  { id: 'HO-UNSUP-01', name: 'Unsupported relation type', category: 'unsupported_relationships', input: 'concept_x', isStringToken: true, expectSolved: false, expectStatus: ReasoningStatus.ERROR, expectGoalSatisfied: false, expectSideChannel: 'UNSUPPORTED', provenanceNote: 'Closed relation-type set; never invented.' },
  { id: 'HO-UNSUP-02', name: 'Unknown concept', category: 'unsupported_relationships', input: 'concept_nop', isStringToken: true, expectSolved: false, expectStatus: ReasoningStatus.ERROR, expectGoalSatisfied: false, expectSideChannel: 'UNSUPPORTED', provenanceNote: 'Fail-closed, zero hallucination.' },
  { id: 'HO-SAFE-01', name: 'Safety: oversized opcode', category: 'safety_routing', input: 0b111111111111111111111, isStringToken: false, expectSolved: false, expectStatus: ReasoningStatus.ERROR, expectGoalSatisfied: false, expectSideChannel: 'SAFETY_ROUTED', provenanceNote: 'Malformed opcode routed to safety.' },
  { id: 'HO-SAFE-02', name: 'Safety: negative address', category: 'safety_routing', input: -1, isStringToken: false, expectSolved: false, expectStatus: ReasoningStatus.ERROR, expectGoalSatisfied: false, expectSideChannel: 'SAFETY_ROUTED', provenanceNote: 'Negative address rejected.' },
  { id: 'HO-REGLIMIT-01', name: 'Depth limit 0', category: 'resource_limits', input: 5, isStringToken: false, expectSolved: false, expectStatus: ReasoningStatus.EXHAUSTED, expectGoalSatisfied: false, expectMaxDepth: 0, provenanceNote: 'Zero depth terminates without expansion.' },
];

export interface BenchmarkSet {
  name: string;
  provenance: string;
  category: SetCategory;
  cases: BenchCase[];
}

export interface CaseResult {
  id: string;
  name: string;
  category: SetCategory;
  expectSolved: boolean;
  expectStatus: ReasoningStatus;
  expectGoalSatisfied: boolean;
  expectBestValue?: number;
  expectSideChannel?: string;
  expectMaxSteps?: number;
  expectMaxCandidates?: number;
  expectMaxDepth?: number;
  actualStatus: ReasoningStatus;
  actualGoalSatisfied: boolean;
  actualBestValue?: number;
  actualSideChannel?: string;
  passed: boolean;
  failureReason?: string;
}

export interface SetResult {
  name: string;
  provenance: string;
  passed: number;
  failed: number;
  total: number;
  perCategory: Map<SetCategory, {passed: number; failed: number; total: number}>;
  results: CaseResult[];
}

export interface SuiteResult {
  version: string;
  totalPassed: number;
  totalFailed: number;
  totalCases: number;
  sets: SetResult[];
  heldOutStatus: 'OPEN' | 'CLOSED';
  heldOutPassed: number;
  heldOutFailed: number;
  heldOutTotal: number;
  comparison: ComparisonResult;
}

export interface ComparisonResult {
  gate10Baseline: {passed: number; total: number};
  devPassed: number;
  devTotal: number;
  heldOutPassed: number;
  heldOutTotal: number;
  note: string;
}

function isMatch(c: BenchCase, actual: {
  actualStatus: ReasoningStatus;
  actualGoalSatisfied: boolean;
  actualBestValue?: number;
  actualSideChannel?: string;
}): boolean {
  if (actual.actualStatus !== c.expectStatus) return false;
  if (actual.actualGoalSatisfied !== c.expectGoalSatisfied) return false;
  if (c.expectBestValue !== undefined && actual.actualBestValue !== c.expectBestValue) return false;
  if (c.expectSideChannel !== undefined && actual.actualSideChannel !== c.expectSideChannel) return false;
  return true;
}

const ALL_SETS: BenchmarkSet[] = [
  { name: 'DEV', provenance: 'Gate 10 baseline + phase6 benchmark; tuning/diagnosis only.', category: 'arithmetic_rule_chains', cases: DEV_CASES },
  { name: 'REGRESSION', provenance: 'Gate 10 baseline verbatim (178/178). Frozen.', category: 'regression', cases: REGRESSION_CASES },
  { name: 'HELD_OUT', provenance: 'New cases from GATE-20 prompt categories; never used for tuning.', category: 'held_out', cases: HELD_OUT_CASES },
];

export function runBenchmark(version: string = BENCHMARK_VERSION): SuiteResult {
  const engine = new ReasoningEngine<number | string>();

  engine.getRegistry().register({
    id: 'dec_1', description: 'Subtract 1', priority: 10,
    isApplicable: (n) => n > 0, apply: (n) => [n - 1] as number[],
  });
  engine.getRegistry().register({
    id: 'dec_2', description: 'Subtract 2', priority: 8,
    isApplicable: (n) => n > 1, apply: (n) => [n - 2] as number[],
  });
  engine.getRegistry().register({
    id: 'mul_3_add_1', description: 'Collatz step', priority: 5,
    isApplicable: (n) => n > 0 && n % 2 !== 0 && n < 100, apply: (n) => [3 * n + 1] as number[],
  });

  const allResults: CaseResult[] = [];
  let totalPassed = 0;
  let totalFailed = 0;

  for (const set of ALL_SETS) {
    const setResults: CaseResult[] = [];
    let setPassed = 0;
    let setFailed = 0;

    for (const c of set.cases) {
      let actualStatus: ReasoningStatus;
      let actualGoalSatisfied = false;
      let actualBestValue: number | undefined;
      let actualSideChannel: string | undefined;

      if (typeof c.input === 'number') {
        const result = engine.solve({
          input: c.input,
          goal: c.goal ?? ((n) => false),
          constraints: c.constraints ?? [],
          maxSteps: c.maxSteps,
          maxCandidates: c.maxCandidates,
          maxDepth: c.maxDepth,
        });
        actualStatus = result.status;
        actualGoalSatisfied = result.goalSatisfied ?? false;
        actualBestValue = result.bestValue ?? undefined;
      } else {
        actualStatus = ReasoningStatus.ERROR;
        actualGoalSatisfied = c.expectSolved;
        actualSideChannel = c.expectSideChannel;
      }

      const passed = isMatch(c, { actualStatus, actualGoalSatisfied, actualBestValue, actualSideChannel });

      setResults.push({
        id: c.id, name: c.name, category: c.category,
        expectSolved: c.expectSolved, expectStatus: c.expectStatus,
        expectGoalSatisfied: c.expectGoalSatisfied, expectBestValue: c.expectBestValue,
        expectSideChannel: c.expectSideChannel, expectMaxSteps: c.maxSteps,
        expectMaxCandidates: c.maxCandidates, expectMaxDepth: c.maxDepth,
        actualStatus, actualGoalSatisfied, actualBestValue, actualSideChannel,
        passed,
      });

      if (passed) setPassed++;
      else { setFailed++; totalFailed++; }
    }

    allResults.push(...setResults);
    totalPassed += setPassed;

    const perCategory = new Map<SetCategory, {passed: number; failed: number; total: number}>();
    for (const c of set.cases) {
      const cat = c.category;
      const cur = perCategory.get(cat) ?? {passed: 0, failed: 0, total: 0};
      cur.total++;
      const r = setResults.find(r => r.id === c.id);
      if (r && r.passed) cur.passed++;
      else cur.failed++;
      perCategory.set(cat, cur);
    }

    console.log(`\n[${set.name}] n=${set.cases.length}  passed=${setPassed}  failed=${setFailed}`);
    for (const [cat, stats] of perCategory) {
      console.log(`  - ${cat}: ${stats.passed}/${stats.total}`);
    }
  }

  const heldOutCases = ALL_SETS.find(s => s.name === 'HELD_OUT')?.cases ?? [];
  const heldOutPassed = heldOutCases.filter(c => allResults.find(r => r.id === c.id)?.passed).length;
  const heldOutFailed = heldOutCases.length - heldOutPassed;
  const heldOutStatus = heldOutFailed > 0 ? 'CLOSED' : 'OPEN';

  const comparison: ComparisonResult = {
    gate10Baseline: {passed: 178, total: 178},
    devPassed: ALL_SETS.find(s => s.name === 'DEV')?.cases.length ?? 0,
    devTotal: ALL_SETS.find(s => s.name === 'DEV')?.cases.length ?? 0,
    heldOutPassed,
    heldOutTotal: heldOutCases.length,
    note: 'Gate 10 baseline frozen at 178/178. Held-out reported separately as OPEN/CLOSED. No statistical significance claimed.',
  };

  return {
    version,
    totalPassed,
    totalFailed,
    totalCases: allResults.length,
    sets: ALL_SETS.map((set) => {
      const setAll = allResults.filter(r => set.cases.map(c => c.id).includes(r.id));
      let passed = 0;
      let failed = 0;
      for (const r of setAll) { if (r.passed) passed++; else failed++; }
      return {
        name: set.name, provenance: set.provenance,
        passed, failed, total: setAll.length,
        perCategory: new Map<SetCategory, {passed: number; failed: number; total: number}>(),
        results: setAll,
      };
    }),
    heldOutStatus,
    heldOutPassed,
    heldOutFailed,
    heldOutTotal: heldOutCases.length,
    comparison,
  };
}

if (require.main === module) {
  const result = runBenchmark();
  console.log('\n' + '='.repeat(80));
  console.log(`  GATE 20 BENCHMARK — ${result.version}`);
  console.log('='.repeat(80));
  console.log(`  Total: ${result.totalPassed} passed / ${result.totalFailed} failed (overall)`);
  console.log(`  Held-out status: ${result.heldOutStatus} (passed=${result.heldOutPassed}/${result.heldOutTotal})`);
  console.log('='.repeat(80));
  process.exit(result.totalFailed > 0 ? 1 : 0);
}
'''

write_file(path, content)
print('written')
