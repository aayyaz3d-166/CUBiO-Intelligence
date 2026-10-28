# ONE 0/1 Reasoning Intelligence Engine Specification (v1.0)

**Document:** `docs/reasoning-engine-v1.md`  
**Status:** Canonical Reference Standard (v1.0)  
**Architecture:** Bounded Deterministic Forward-Chaining State Exploration  
**Decision Space:** Discrete 0/1 Signals (`0` = REJECT / STOP, `1` = ACCEPT / CONTINUE)  
**Dependencies:** Zero external runtime dependencies (native TypeScript / JavaScript)

---

## 1. Principles & Deterministic Guarantees

### 1.1 Discrete 0/1 Decision Signals
Every candidate state under evaluation generates an explicit `decisionSignal: 0 | 1`:
- **`0` (REJECT / STOP):** The candidate violates one or more domain boundaries, type constraints, or invariant predicates. Categorical outcome: `DecisionOutcome.REJECT`.
- **`1` (ACCEPT / CONTINUE):** The candidate satisfies all structural and invariant predicates, representing a valid intermediate progression or a target solution state. Categorical outcome: `DecisionOutcome.ACCEPT`.

### 1.2 Explicit Non-Claims & Safety Scope Invariant
> [!IMPORTANT]
> **Scope & Safety Invariant:**  
> This engine implements **strictly bounded, deterministic symbolic search** over programmer-defined rules and invariant predicates.
> - It does **NOT** claim general artificial intelligence (AGI), autonomous self-learning, emergent cognition, or unconstrained natural language reasoning.
> - It operates purely by expanding discrete state spaces through registered transformation rules ([`ReasoningRule<T>`](../src/reasoning/types.ts)) and evaluating them against deterministic goal predicates.

### 1.3 Deterministic Ranking & Tie-Breaking
When multiple valid candidates are generated from a frontier node, they are ordered deterministically:
1. **Validity:** Candidates passing all constraints (`valid: true`) strictly precede candidates violating constraints (`valid: false`).
2. **Goal Satisfaction:** Candidates satisfying the task goal predicate (`goalSatisfied: true`) strictly precede non-goal candidates.
3. **Score Ordering:** Evaluated using a deterministic linear scoring function:
   $$\text{Score} = (\text{goalSatisfied} \times 100.0) + (\text{constraintsPassed} \times 10.0) - (\text{depth} \times 0.1)$$
4. **Lexicographical Tie-Breaker:** When scores are identical, candidates are ordered lexicographically by their unique candidate IDs (`a.candidate.id.localeCompare(b.candidate.id)`).
   - This guarantees that two identical runs produce identical evaluation orders with zero variance across platforms.

### 1.4 State Deduplication & Cycle Prevention
To eliminate infinite loops in cyclical or diamond transition graphs:
- Every visited candidate state is hashed deterministically (`JSON.stringify` by default or custom state key).
- Any newly generated candidate whose state hash has already been evaluated or queued is immediately discarded.

### 1.5 Execution Budgets & Fail-Closed Guards
Search horizons are strictly bounded by three configurable safety parameters:
- **`maxSteps`** (default: `100`): Maximum search iterations. If reached, the engine terminates with status `ReasoningStatus.STEP_LIMIT`.
- **`maxCandidates`** (default: `250`): Maximum candidate states generated. If reached, terminates with `ReasoningStatus.CANDIDATE_LIMIT`.
- **`maxDepth`** (default: `20`): Maximum tree depth from the root. Branches exceeding this depth are pruned with `ReasoningStatus.DEPTH_LIMIT`.
- **`timeoutMs`** (optional): Execution time ceiling in milliseconds. If elapsed, terminates with `ReasoningStatus.CANCELLED`.

---

## 2. Component Architecture

```mermaid
flowchart TD
    Task[ReasoningInput&lt;T&gt;] --> Engine[ReasoningEngine&lt;T&gt;]

    subgraph CoreEngine["Bounded Reasoning Subsystem"]
        Registry[RuleRegistry&lt;T&gt;\nPriority-Ordered Rule Catalog]
        Explorer[StateExplorer&lt;T&gt;\nFIFO / LIFO Frontier &amp; Cycle Pruner]
        Evaluator[CandidateEvaluator&lt;T&gt;\n0/1 Decision Signal &amp; Scorer]

        Engine --> Registry
        Engine --> Explorer
        Engine --> Evaluator

        Registry -->|Applicable Rules| Explorer
        Explorer -->|Generated Candidates| Evaluator
        Evaluator -->|Ranked Candidates| Engine
    end

    Engine --> Trace[ReasoningTraceEvent&lt;T&gt;[]]
    Engine --> Result[ReasoningResult&lt;T&gt;]
    Result --> Bridge[BinaryReasoningBridge]
    Bridge --> Envelopes[BinaryReasoningEnvelope[]]
```

### 2.1 RuleRegistry
- Central repository for reusable [`ReasoningRule<T>`](../src/reasoning/types.ts) definitions.
- Enforces globally unique rule identifiers; duplicate registrations throw an error fail-closed.
- Queries applicable rules for a given state using `rule.isApplicable(state, context)`.
- Orders applicable rules deterministically by priority descending, then by rule ID lexicographically.

### 2.2 StateExplorer
- Manages the search frontier using selectable exploration policies:
  - `ReasoningPolicy.BREADTH_FIRST`: FIFO queue ensuring shortest path discovery.
  - `ReasoningPolicy.DEPTH_FIRST`: LIFO stack for deep linear path exploration.
  - `ReasoningPolicy.GREEDY_BEST_FIRST`: Priority queue prioritizing high-scoring partial evaluations.
- Invokes rule transformation functions `rule.apply(state, context)` to generate child candidate nodes.
- Discards duplicates using internal visited state set.

### 2.3 CandidateEvaluator
- Tests candidate values against:
  1. Structural validation predicates.
  2. Invariant constraints (`spec.constraints`).
  3. The goal predicate (`spec.goal`).
- Emits explicit audit reasons for every check passed or failed.
- Assigns the categorical `decision` (`ACCEPT` or `REJECT`) and binary `decisionSignal` (`1` or `0`).

### 2.4 ReasoningEngine
- Orchestrates the main search loop:
  1. Initializes root candidate from `spec.input` at depth 0.
  2. Evaluates root candidate; if already satisfying `spec.goal`, completes immediately with `ReasoningStatus.SOLVED`.
  3. Iteratively pops candidates from the frontier, applies rules, evaluates child candidates, and checks safety budgets.
  4. Records every transition as a structured [`ReasoningTraceEvent<T>`](../src/reasoning/types.ts).
  5. Returns a comprehensive [`ReasoningResult<T>`](../src/reasoning/types.ts).

---

## 3. Data Structures & Type Contracts

### 3.1 ReasoningRule Contract
```typescript
export interface ReasoningRule<T = unknown, C = Record<string, unknown>> {
  readonly id: string;
  readonly description: string;
  readonly priority?: number; // Higher numbers execute first
  isApplicable: (state: T, context?: C) => boolean;
  apply: (state: T, context?: C) => T[] | Promise<T[]>;
}
```

### 3.2 Candidate Node
```typescript
export interface Candidate<T = unknown> {
  id: string;              // e.g. 'cand_0', 'cand_1'
  value: T;                // Proposed value or state
  parentId?: string;       // Lineage pointer
  ruleId: string;          // Generating rule ID
  derivation: string;      // Concise human-readable derivation
  depth: number;           // Distance from root
  status: 'GENERATED' | 'ACCEPTED' | 'REJECTED' | 'INVALID' | 'UNEVALUATED';
  stepIndex: number;
}
```

### 3.3 Candidate Evaluation Breakdown
```typescript
export interface CandidateEvaluation<T = unknown> {
  candidateId: string;
  candidateValue: T;
  valid: boolean;
  goalSatisfied: boolean;
  decisionSignal: 0 | 1;
  score: number;
  reasons: string[];
  decision: DecisionOutcome; // ACCEPT | REJECT | DEFER
}
```

---

## 4. Binary Integration via BinaryReasoningBridge

To facilitate verifiable communication across system barriers, the reasoning engine connects to the 3/6/9-bit Binary Language protocol through [`BinaryReasoningBridge`](../src/integration/BinaryReasoningBridge.ts):

- **Token Serialization:** Calls `BinaryReasoningBridge.serializeToken(val)` to encapsulate primitive values, spatial addresses, and triangle opcodes into `BinaryReasoningEnvelope` structures (`typeTag`, `rawBits`, `bitLength`, `decodedValue`).
- **Bit-Exact Verification:** Every encoded token is immediately verified against `BinaryReasoningBridge.deserializeToken(envelope.rawBits)` ensuring 100% bijective preservation.
- **Session Bundles:** The high-level [`ReasoningSession`](../src/integration/ReasoningSession.ts) coordinates rule execution and automatically captures a bit-exact binary derivation trace alongside the solution candidate.
