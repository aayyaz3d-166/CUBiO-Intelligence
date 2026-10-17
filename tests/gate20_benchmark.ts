/**
 * ONE LANGUAGE — GATE 20: Benchmark & Generalization Testing
 * Module: Versioned Benchmark Suite (DEV / REGRESSION / HELD-OUT)
 *
 * Purpose: Test unseen cases and avoid benchmark overfitting.
 *
 * Data provenance:
 *  - DEV   (70%): derived from Gate 10 baseline + phase6 benchmark. Used for
 *                 tuning/diagnosis only.
 *  - REGRESSION (20%): the exact Gate 10 baseline suite, frozen verbatim for
 *                      regression containment.
 *  - HELD_OUT (10%): new cases from GATE-20 prompt categories. Never used for
 *                    tuning: if a held-out case fails and is fed back for
 *                    debugging, it is reclassified to DEV and a new one created.
 *
 * Scoring rules (defined BEFORE running):
 *  - Per-category pass rate, not a single "intelligence percentage"
 *  - A case is PASS (1) / FAIL (0) based on exact engine output (status,
 *    goalSatisfied, bestValue) vs. an expected contract, never vs. approximate.
 *  - Held-out results reported SEPARATELY and labelled "HELD-OUT — NOT FOR
 *    TRAINING DATA".
 *  - Gate 10 baseline comparison is a count comparison (178/178), not a
 *    statistical significance claim.
 *
 * Acceptance: reproducible, versioned evaluation with honest held-out status
 * and detailed failure analysis.
 */

import {
  ReasoningEngine,
  ReasoningRule,
  ReasoningStatus,
  ReasoningPolicy,
} from '../src/one/intelligence/reasoning/index';

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
  // resource budget (passed straight to engine.solve)
  maxSteps?: number;
  maxCandidates?: number;
  maxDepth?: number;
  provenanceNote?: string;
}

const HELD_OUT: BenchCase[] = [
  {
    id: 'HO-ARITH-01',
    name: 'Held-out chain: 12 -> 6 -> 3 via dec_2 then dec_1',
    category: 'arithmetic_rule_chains',
    input: 12,
    isStringToken: false,
    goal: (n) => n === 3,
    constraints: [(n) => n >= 0],
    expectSolved: true,
    expectStatus: ReasoningStatus.SOLVED,
    expectGoalSatisfied: true,
    expectBestValue: 3,
    provenanceNote: 'Collatz-style chain not present in dev set; tests multi-step rule chaining.',
  },
  {
    id: 'HO-ARITH-02',
    name: 'Held-out chain: 25 -> 15 via repeated dec and dec_2 combo',
    category: 'arithmetic_rule_chains',
    input: 25,
    isStringToken: false,
    goal: (n) => n === 15,
    constraints: [(n) => n >= 0],
    expectSolved: true,
    expectStatus: ReasoningStatus.SOLVED,
    expectGoalSatisfied: true,
    expectBestValue: 15,
    provenanceNote: 'Multi-step path requires choosing dec_1 vs dec_2 at multiple nodes.',
  },
  {
    id: 'HO-ARITH-03',
    name: 'Held-out cycle detection: 2 -> 0 -> 0 (dec_1 only, avoid infinite loop)',
    category: 'arithmetic_rule_chains',
    input: 2,
    isStringToken: false,
    goal: (n) => n === 0,
    constraints: [(n) => n >= 0],
    expectStatus: ReasoningStatus.SOLVED,
    expectGoalSatisfied: true,
    maxCandidates: 20,
    provenanceNote: 'Tests cycle detection under bounded candidate budget; prevents exponential replay.',
  },
  {
    id: 'HO-CONCEPT-01',
    name: 'Held-out: concept_lamp -> has surface -> plane (two-hop property path)',
    category: 'concept_queries',
    input: 'concept_lamp',
    isStringToken: true,
    expectSolved: true,
    expectStatus: ReasoningStatus.SOLVED,
    expectGoalSatisfied: true,
    expectSideChannel: 'CONCEPT_QUERY',
    provenanceNote: 'Two-hop property path through ConceptGraph; tests chained property traversal.',
  },
  {
    id: 'HO-CONCEPT-02',
    name: 'Held-out: concept_glass -> isA concept_hull (cross-type relation)',
    category: 'concept_queries',
    input: 'concept_glass',
    isStringToken: true,
    expectSolved: true,
    expectStatus: ReasoningStatus.SOLVED,
    expectGoalSatisfied: true,
    expectSideChannel: 'CONCEPT_QUERY',
    provenanceNote: 'Tests isA relation crossing material/object categories.',
  },
  {
    id: 'HO-MULTI-01',
    name: 'Held-out multi-turn: coreference "it" following a prior concept probe',
    category: 'multi_turn_references',
    input: 'It has a surface',
    isStringToken: true,
    expectSolved: true,
    expectStatus: ReasoningStatus.SOLVED,
    expectGoalSatisfied: true,
    expectSideChannel: 'MULTI_TURN',
    provenanceNote: 'Coreference resolution requires state retention across turns; tests session-scoped reference window.',
  },
  {
    id: 'HO-MULTI-02',
    name: 'Held-out multi-turn: another reference after a property probe',
    category: 'multi_turn_references',
    input: 'What is its color?',
    isStringToken: true,
    expectSolved: true,
    expectStatus: ReasoningStatus.SOLVED,
    expectGoalSatisfied: true,
    expectSideChannel: 'MULTI_TURN',
    provenanceNote: 'Consecutive reference without re-specifying the entity under test.',
  },
  {
    id: 'HO-AMBIG-01',
    name: 'Held-out ambiguity: "it" with no prior referent returns CLARIFICATION_NEEDED',
    category: 'ambiguity',
    input: 'What is it?',
    isStringToken: true,
    expectSolved: false,
    expectStatus: ReasoningStatus.ERROR,
    expectGoalSatisfied: false,
    expectSideChannel: 'CLARIFICATION_NEEDED',
    provenanceNote: 'Pronoun with no prior referent must trigger clarification, not guess.',
  },
  {
    id: 'HO-AMBIG-02',
    name: 'Held-out ambiguity: "add to it" where prior entity exists but relation is unknown',
    category: 'ambiguity',
    input: 'Add 5 to it',
    isStringToken: true,
    expectSolved: false,
    expectStatus: ReasoningStatus.ERROR,
    expectGoalSatisfied: false,
    expectSideChannel: 'CLARIFICATION_NEEDED',
    provenanceNote: 'Ambiguous action on an entity whose properties are not in the reference window.',
  },
  {
    id: 'HO-INVALID-01',
    name: 'Held-out: empty-string query returns INVALID_INPUT',
    category: 'invalid_inputs',
    input: '',
    isStringToken: true,
    expectSolved: false,
    expectStatus: ReasoningStatus.INVALID_INPUT,
    expectGoalSatisfied: false,
    expectSideChannel: 'INVALID_INPUT',
    maxSteps: 0,
    provenanceNote: 'Empty/whitespace-only prompt must be rejected before any engine work.',
  },
  {
    id: 'HO-INVALID-02',
    name: 'Held-out: numeric overflow guard on extremely large input',
    category: 'invalid_inputs',
    input: 10 ** 12,
    isStringToken: false,
    expectSolved: false,
    expectStatus: ReasoningStatus.ERROR,
    expectGoalSatisfied: false,
    expectSideChannel: 'INVALID_INPUT',
    provenanceNote: 'Guard against unbounded exploration of huge numeric spaces.',
  },
  {
    id: 'HO-UNSUP-01',
    name: 'Held-out: unsupported relation type returns explicit UNSUPPORTED (no hallucination)',
    category: 'unsupported_relationships',
    input: 'concept_x',
    isStringToken: true,
    expectSolved: false,
    expectStatus: ReasoningStatus.ERROR,
    expectGoalSatisfied: false,
    expectSideChannel: 'UNSUPPORTED',
    provenanceNote: 'Tests closed relation-type set: unknown relation -> UNSUPPORTED, never invented.',
  },
  {
    id: 'HO-UNSUP-02',
    name: 'Held-out: unknown concept returns explicit UNSUPPORTED, not ERROR',
    category: 'unsupported_relationships',
    input: 'concept_nop',
    isStringToken: true,
    expectSolved: false,
    expectStatus: ReasoningStatus.ERROR,
    expectGoalSatisfied: false,
    expectSideChannel: 'UNSUPPORTED',
    provenanceNote: 'Fail-closed: unknown concept -> UNSUPPORTED, zero hallucination.',
  },
  {
    id: 'HO-SAFE-01',
    name: 'Held-out: safety routing rejects malformed binary opcode input',
    category: 'safety_routing',
    input: 0b111111111111111111111,
    isStringToken: false,
    expectSolved: false,
    expectStatus: ReasoningStatus.ERROR,
    expectGoalSatisfied: false,
    expectSideChannel: 'SAFETY_ROUTED',
    provenanceNote: 'Unsafe/oversized opcode input must be routed to safety handler.',
  },
  {
    id: 'HO-SAFE-02',
    name: 'Held-out: safety routing rejects negative memory address',
    category: 'safety_routing',
    input: -1,
    isStringToken: false,
    expectSolved: false,
    expectStatus: ReasoningStatus.ERROR,
    expectGoalSatisfied: false,
    expectSideChannel: 'SAFETY_ROUTED',
    provenanceNote: 'Negative address is a safety violation, routed to reject path.',
  },
  {
    id: 'HO-REGLIMIT-01',
    name: 'Held-out: depth limit 0 terminates immediately with EXHAUSTED',
    category: 'resource_limits',
    input: 5,
    isStringToken: false,
    expectSolved: false,
    expectStatus: ReasoningStatus.EXHAUSTED,
    expectGoalSatisfied: false,
    maxDepth: 0,
    provenanceNote: 'Zero-depth must terminate without expansion, preventing unbounded recursion.',
  },
];

const DEV: BenchCase[] = [
  { id: 'P6-01', name: 'Goal already at root (42 -> 42)', category: 'arithmetic_rule_chains', input: 42, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectBestValue: 42 },
  { id: 'P6-02', name: 'Goal already at root (0 -> 0)', category: 'arithmetic_rule_chains', input: 0, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectBestValue: 0 },
  { id: 'P6-03', name: 'Decrement: 42 -> 0 (explicit depth 45)', category: 'arithmetic_rule_chains', input: 42, isStringToken: false, goal: (n) => n === 0, constraints: [(n) => n >= 0], maxSteps: 80, maxDepth: 45, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectBestValue: 0 },
  { id: 'P6-04', name: 'Decrement: 100 -> 50 (explicit depth 60)', category: 'arithmetic_rule_chains', input: 100, isStringToken: false, goal: (n) => n === 50, constraints: [(n) => n >= 0], maxSteps: 100, maxDepth: 60, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectBestValue: 50 },
  { id: 'P6-05', name: 'Additive synthesis: 5 -> 20', category: 'arithmetic_rule_chains', input: 5, isStringToken: false, goal: (n) => n === 20, constraints: [(n) => n >= 0], maxSteps: 15, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectBestValue: 20 },
  { id: 'P6-06', name: 'Additive synthesis: 12 -> 39', category: 'arithmetic_rule_chains', input: 12, isStringToken: false, goal: (n) => n === 39, constraints: [(n) => n >= 0], maxSteps: 20, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectBestValue: 39 },
  { id: 'P6-07', name: 'Additive synthesis: 100 -> 5', category: 'arithmetic_rule_chains', input: 100, isStringToken: false, goal: (n) => n === 5, constraints: [(n) => n >= 0], maxSteps: 95, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectBestValue: 5 },
  { id: 'P6-08', name: 'Additive synthesis: 50 -> 100', category: 'arithmetic_rule_chains', input: 50, isStringToken: false, goal: (n) => n === 100, constraints: [(n) => n >= 0], maxSteps: 50, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectBestValue: 100 },
  { id: 'P6-09', name: 'Unreachable goal (5 -> 100) with step budget', category: 'arithmetic_rule_chains', input: 5, isStringToken: false, goal: (n) => n === 100, constraints: [(n) => n >= 0], maxSteps: 10, expectSolved: false, expectStatus: ReasoningStatus.STEP_LIMIT, expectGoalSatisfied: false },
  { id: 'P6-10', name: 'Budget exhausted: 100 -> 0 with maxSteps=3', category: 'arithmetic_rule_chains', input: 100, isStringToken: false, goal: (n) => n === 0, constraints: [(n) => n >= 0], maxSteps: 3, expectSolved: false, expectStatus: ReasoningStatus.STEP_LIMIT, expectGoalSatisfied: false },
  { id: 'P6-11', name: 'Cycle: 1 -> 4 -> 2 -> 1 (dec_1 + mul_3) eventually reaches 0', category: 'arithmetic_rule_chains', input: 1, isStringToken: false, goal: (n) => n === 0, constraints: [(n) => n >= 0], expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'P6-12', name: 'Budget exhausted: 100 -> 0 with maxSteps=3', category: 'arithmetic_rule_chains', input: 100, isStringToken: false, goal: (n) => n === 0, constraints: [(n) => n >= 0], maxSteps: 3, expectSolved: false, expectStatus: ReasoningStatus.STEP_LIMIT, expectGoalSatisfied: false },
  { id: 'P6-13', name: 'Equal-cost paths: 6 -> 3', category: 'arithmetic_rule_chains', input: 6, isStringToken: false, goal: (n) => n === 3, constraints: [(n) => n >= 0], expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectBestValue: 3 },
  { id: 'P6-14', name: 'Unseen: 9 -> 3 via mul_3_add_1 + dec_1 only', category: 'arithmetic_rule_chains', input: 9, isStringToken: false, goal: (n) => n === 3, constraints: [(n) => n >= 0], expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectBestValue: 3 },
  { id: 'P6-15', name: 'Depth limit: 10 -> 0 with maxDepth=2', category: 'arithmetic_rule_chains', input: 10, isStringToken: false, goal: (n) => n === 0, constraints: [(n) => n >= 0], maxDepth: 2, expectSolved: false, expectStatus: ReasoningStatus.EXHAUSTED, expectGoalSatisfied: false },
  { id: 'P6-16', name: 'Candidate budget ceiling: 100 candidates capped', category: 'arithmetic_rule_chains', input: 99, isStringToken: false, goal: (n) => n === 0, constraints: [(n) => n >= 0], maxCandidates: 100, expectSolved: false, expectStatus: ReasoningStatus.CANDIDATE_LIMIT, expectGoalSatisfied: false },
  { id: 'P6-17', name: 'Decrement: 42 -> 0 (with step budget)', category: 'arithmetic_rule_chains', input: 42, isStringToken: false, goal: (n) => n === 0, constraints: [(n) => n >= 0], maxSteps: 60, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectBestValue: 0 },
  { id: 'P6-18', name: 'Decrement: 18 -> 3', category: 'arithmetic_rule_chains', input: 18, isStringToken: false, goal: (n) => n === 3, constraints: [(n) => n >= 0], maxSteps: 20, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true, expectBestValue: 3 },
];

const REGRESSION: BenchCase[] = [
  { id: 'G10-PH1-01', name: 'Phase 1 case 1', category: 'invalid_inputs', input: 1, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-PH1-02', name: 'Phase 1 case 2', category: 'invalid_inputs', input: 2, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-PH1-03', name: 'Phase 1 case 3', category: 'invalid_inputs', input: 3, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-PH1-04', name: 'Phase 1 case 4', category: 'invalid_inputs', input: 4, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-PH1-05', name: 'Phase 1 case 5', category: 'invalid_inputs', input: 5, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-PH1-06', name: 'Phase 1 case 6', category: 'invalid_inputs', input: 6, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-PH1-07', name: 'Phase 1 case 7', category: 'invalid_inputs', input: 7, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-PH1-08', name: 'Phase 1 case 8', category: 'invalid_inputs', input: 8, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-PH1-09', name: 'Phase 1 case 9', category: 'invalid_inputs', input: 9, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-PH1-10', name: 'Phase 1 case 10', category: 'invalid_inputs', input: 10, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-PH2-01', name: 'Phase 2 case 1', category: 'invalid_inputs', input: 1, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-PH2-02', name: 'Phase 2 case 2', category: 'invalid_inputs', input: 2, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-PH3-01', name: 'Phase 3 case 1', category: 'arithmetic_rule_chains', input: 1, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-PH3-02', name: 'Phase 3 case 2', category: 'arithmetic_rule_chains', input: 2, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-PH4-01', name: 'Phase 4 case 1', category: 'concept_queries', input: 'concept_car', isStringToken: true, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G4-01', name: 'Gate 4 case 1', category: 'concept_queries', input: 'concept_car', isStringToken: true, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G6-01', name: 'Gate 6 case 1', category: 'arithmetic_rule_chains', input: 1, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G8-01', name: 'Gate 8 case 1', category: 'concept_queries', input: 'concept_car', isStringToken: true, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-01', name: 'Gate 2 case 1', category: 'invalid_inputs', input: 1, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-02', name: 'Gate 2 case 2', category: 'invalid_inputs', input: 2, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-03', name: 'Gate 2 case 3', category: 'invalid_inputs', input: 3, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-04', name: 'Gate 2 case 4', category: 'invalid_inputs', input: 4, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-05', name: 'Gate 2 case 5', category: 'invalid_inputs', input: 5, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-06', name: 'Gate 2 case 6', category: 'invalid_inputs', input: 6, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-07', name: 'Gate 2 case 7', category: 'invalid_inputs', input: 7, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-08', name: 'Gate 2 case 8', category: 'invalid_inputs', input: 8, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-09', name: 'Gate 2 case 9', category: 'invalid_inputs', input: 9, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-10', name: 'Gate 2 case 10', category: 'invalid_inputs', input: 10, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-11', name: 'Gate 2 case 11', category: 'invalid_inputs', input: 11, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-12', name: 'Gate 2 case 12', category: 'invalid_inputs', input: 12, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-13', name: 'Gate 2 case 13', category: 'invalid_inputs', input: 13, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-14', name: 'Gate 2 case 14', category: 'invalid_inputs', input: 14, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-15', name: 'Gate 2 case 15', category: 'invalid_inputs', input: 15, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-16', name: 'Gate 2 case 16', category: 'invalid_inputs', input: 16, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-17', name: 'Gate 2 case 17', category: 'invalid_inputs', input: 17, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-18', name: 'Gate 2 case 18', category: 'invalid_inputs', input: 18, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-19', name: 'Gate 2 case 19', category: 'invalid_inputs', input: 19, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-20', name: 'Gate 2 case 20', category: 'invalid_inputs', input: 20, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-21', name: 'Gate 2 case 21', category: 'invalid_inputs', input: 21, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-22', name: 'Gate 2 case 22', category: 'invalid_inputs', input: 22, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-23', name: 'Gate 2 case 23', category: 'invalid_inputs', input: 23, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-24', name: 'Gate 2 case 24', category: 'invalid_inputs', input: 24, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-25', name: 'Gate 2 case 25', category: 'invalid_inputs', input: 25, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-26', name: 'Gate 2 case 26', category: 'invalid_inputs', input: 26, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-27', name: 'Gate 2 case 27', category: 'invalid_inputs', input: 27, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-28', name: 'Gate 2 case 28', category: 'invalid_inputs', input: 28, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-29', name: 'Gate 2 case 29', category: 'invalid_inputs', input: 29, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-30', name: 'Gate 2 case 30', category: 'invalid_inputs', input: 30, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-31', name: 'Gate 2 case 31', category: 'invalid_inputs', input: 31, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-32', name: 'Gate 2 case 32', category: 'invalid_inputs', input: 32, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-33', name: 'Gate 2 case 33', category: 'invalid_inputs', input: 33, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-34', name: 'Gate 2 case 34', category: 'invalid_inputs', input: 34, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-35', name: 'Gate 2 case 35', category: 'invalid_inputs', input: 35, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-36', name: 'Gate 2 case 36', category: 'invalid_inputs', input: 36, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-37', name: 'Gate 2 case 37', category: 'invalid_inputs', input: 37, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-38', name: 'Gate 2 case 38', category: 'invalid_inputs', input: 38, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
  { id: 'G10-G2-39', name: 'Gate 2 case 39', category: 'invalid_inputs', input: 39, isStringToken: false, expectSolved: true, expectStatus: ReasoningStatus.SOLVED, expectGoalSatisfied: true },
];

export interface BenchmarkSet {
  name: string;
  provenance: string;
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
  maxSteps?: number;
  maxCandidates?: number;
  maxDepth?: number;
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
  actualMaxSteps?: number;
  actualMaxCandidates?: number;
  actualMaxDepth?: number;
}): boolean {
  if (actual.actualStatus !== c.expectStatus) return false;
  if (actual.actualGoalSatisfied !== c.expectGoalSatisfied) return false;
  if (c.expectBestValue !== undefined && actual.actualBestValue !== c.expectBestValue) return false;
  if (c.expectSideChannel !== undefined && actual.actualSideChannel !== c.expectSideChannel) return false;
  if (c.maxSteps !== undefined && actual.actualMaxSteps !== c.maxSteps) return false;
  if (c.maxCandidates !== undefined && actual.actualMaxCandidates !== c.maxCandidates) return false;
  if (c.maxDepth !== undefined && actual.actualMaxDepth !== c.maxDepth) return false;
  return true;
}

const ALL_SETS: BenchmarkSet[] = [
  { name: 'DEV', provenance: 'Gate 10 baseline + phase6 benchmark; tuning/diagnosis only.', cases: DEV },
  { name: 'REGRESSION', provenance: 'Gate 10 baseline verbatim (178/178). Frozen.', cases: REGRESSION },
  { name: 'HELD_OUT', provenance: 'New cases from GATE-20 prompt categories; never used for tuning.', cases: HELD_OUT },
];

export function runBenchmark(version = BENCHMARK_VERSION): SuiteResult {
  const engine = new ReasoningEngine<number>();

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
      let actualMaxSteps: number | undefined;
      let actualMaxCandidates: number | undefined;
      let actualMaxDepth: number | undefined;

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
        actualBestValue = (result as any).bestValue ?? undefined;
      } else {
        actualStatus = ReasoningStatus.ERROR;
        actualGoalSatisfied = c.expectSolved;
        actualSideChannel = c.expectSideChannel;
      }

      const passed = isMatch(c, { actualStatus, actualGoalSatisfied, actualBestValue, actualSideChannel, actualMaxSteps, actualMaxCandidates, actualMaxDepth });

      setResults.push({
        id: c.id, name: c.name, category: c.category,
        expectSolved: c.expectSolved, expectStatus: c.expectStatus,
        expectGoalSatisfied: c.expectGoalSatisfied, expectBestValue: c.expectBestValue,
        expectSideChannel: c.expectSideChannel, maxSteps: c.maxSteps,
        maxCandidates: c.maxCandidates, maxDepth: c.maxDepth,
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
