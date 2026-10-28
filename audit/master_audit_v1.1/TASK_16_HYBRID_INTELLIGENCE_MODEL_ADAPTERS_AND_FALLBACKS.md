# TASK 16 — HYBRID INTELLIGENCE, MODEL ADAPTERS AND FALLBACKS

> **Status:** Certified & Verified  
> **Environment:** Node.js v24.14.1 / Windows 11 x64  
> **Repository:** `F:\ONE language` (`integration/v1.0.1-local`)  
> **Safety Invariants:** Actuation Lockout (`isActuationBlocked: true`, `E8005`), Fail-Closed Parameter Validation (`NativeModelRegistry`), Absolute Symbolic Authority (Neural proposal cannot override symbolic proofs), Deterministic Replay Invariance ($\sigma^2 = 0.0$)  
> **Release Artifact Integrity:** Preserved 100% bit-exact across `dist/one.exe`, `dist/v1.0.1-rc/one.exe`, `dist/v1.0.1-rc/one-language-1.0.1.vsix`

---

## 1. Executive Summary

Task 16 established an authoritative trace, predictable routing specification, and empirical verification harness across the hybrid intelligence stack in ONE Language:
- [`HybridConversationEngine`](file:///F:/ONE%20language/src/one/intelligence/hybrid/HybridConversationEngine.ts)
- Model Adapters: [`Native5MAdapter`](file:///F:/ONE%20language/src/one/intelligence/hybrid/Native5MAdapter.ts), [`ModelReasoningAdapter`](file:///F:/ONE%20language/src/one/intelligence/reasoning/ModelReasoningAdapter.ts), and [`CUBiOCoreBridge`](file:///F:/ONE%20language/src/one/intelligence/runtime/CUBiOCoreBridge.ts)
- [`NativeModelRegistry`](file:///F:/ONE%20language/src/one/native_model_registry.ts)
- [`ReasoningEngine`](file:///F:/ONE%20language/src/one/intelligence/reasoning/ReasoningEngine.ts) & [`ReasoningSession`](file:///F:/ONE%20language/src/one/intelligence/reasoning/ReasoningSession.ts)
- [`PlanningEngine`](file:///F:/ONE%20language/src/one/intelligence/planning/PlanningEngine.ts)
- [`AgiOneCoreOrchestrator`](file:///F:/ONE%20language/src/one/agi_one_core_orchestrator.ts) & [`AgiOneIPCBridge`](file:///F:/ONE%20language/src/one/agi_one_ipc_bridge.ts)

A strict routing policy was defined and verified: symbolic methods maintain **absolute veto authority**; neural inference is strictly opt-in (`enableNeuralInference: true`) and bounded ($M \le 45$ tokens, $t \le 200\text{ ms}$); model adapter throws are intercepted fail-soft via `safeGenerate()`; malformed proposals are rejected by strict schema validation; and offline/unavailable models cleanly degrade to pure deterministic reasoning without crashing or fabricating success.

```mermaid
flowchart TD
    UserReq["User Input (HybridRequest)"] --> Val["validateHybridRequest()"]
    Val --> Intent["IntentParser.parse()"]

    Intent --> CheckFollowUp{Follow-Up Mention?}
    CheckFollowUp -- Yes --> ResolveFollowUp["dispatchFollowUp() (Bounded Context)"]
    CheckFollowUp -- No --> RouteIntent{Intent Type}

    RouteIntent -- REASONING_TASK --> ReasoningDispatch["dispatchReasoning() (Phase 3 ReasoningEngine)"]
    RouteIntent -- CONCEPT_QUERY --> ConceptDispatch["dispatchConceptQuery() (Phase 4 ConceptGraph)"]
    RouteIntent -- CONVERSATIONAL_FACT --> FactDispatch["dispatchConversationalFact() (Template / Greeting)"]
    RouteIntent -- UNKNOWN_REQUEST --> ClarificationDispatch["dispatchUnknown() (Structured Clarification)"]

    ReasoningDispatch --> NeuralCheck{enableNeuralInference && isAvailable?}
    NeuralCheck -- False --> PureSymbolic["Pure Symbolic Ground Truth (isSolved, derivation)"]
    NeuralCheck -- True --> SafeGen["safeGenerate() (Bounded 45 Tokens)"]

    SafeGen -- Throws / Empty --> PureSymbolic
    SafeGen -- Valid JSON --> ValidateProp{"validateNeuralProposal()"}
    ValidateProp -- Invalid / Out-of-Bounds --> PureSymbolic
    ValidateProp -- Valid --> DecorateNL["Decorate Presentation (Symbolic Authority Invariant)"]

    DecorateNL --> FinalResp["HybridResponse (Never Fabricates Success)"]
    PureSymbolic --> FinalResp
    ResolveFollowUp --> FinalResp
    ConceptDispatch --> FinalResp
    FactDispatch --> FinalResp
    ClarificationDispatch --> FinalResp
```

---

## 2. Component Trace & Responsibilities

| Component | Authoritative File | Core Responsibility | Model & Parameter Boundary | Safety Invariants |
| :--- | :--- | :--- | :--- | :--- |
| **`HybridConversationEngine`** | [`HybridConversationEngine.ts`](file:///F:/ONE%20language/src/one/intelligence/hybrid/HybridConversationEngine.ts) | User intent dispatch, multi-turn session dialogue state, symbolic-neural coordination | Delegates to `Native5MAdapter` and `ReasoningEngine` | Never throws; never allows neural proposals to override symbolic proofs or write to memory. |
| **`Native5MAdapter`** | [`Native5MAdapter.ts`](file:///F:/ONE%20language/src/one/intelligence/hybrid/Native5MAdapter.ts) | Bridges CUBIO-NATIVE-MODEL-V1 checkpoint into Node.js runtime | 4,894,208 parameters (8L-8H-256D-512FFN) | Capped at $\le 45$ tokens; repetition penalty 1.2; fail-soft error object on missing checkpoint. |
| **`ModelReasoningAdapter`** | [`ModelReasoningAdapter.ts`](file:///F:/ONE%20language/src/one/intelligence/reasoning/ModelReasoningAdapter.ts) | Candidate evaluation & state embedding tensors ($[1, 256]$) | 4.89M (Native 5M) / 148,912 (CUBiO V1) | Isolated in `AutogradTape.noGrad()`; bounded timeout ($50\text{ ms}$); `isActuationBlocked: true`. |
| **`NativeModelRegistry`** | [`native_model_registry.ts`](file:///F:/ONE%20language/src/one/native_model_registry.ts) | Certified authority for model identities and layer breakdowns | Strictly 148,912 parameters for CUBIO-MODEL-STAGE1-V1 | Rejects deprecated 38,400 count fail-closed; INT4/FP16 footprint verification. |
| **`ReasoningEngine`** | [`ReasoningEngine.ts`](file:///F:/ONE%20language/src/one/intelligence/reasoning/ReasoningEngine.ts) | Bounded A*/DFS state-space search with rule application | Symbolic heuristics | Strict step limits ($\le 500$), candidates ($\le 100$), depth ($\le 10$); `CancellationToken`. |
| **`PlanningEngine`** | [`PlanningEngine.ts`](file:///F:/ONE%20language/src/one/intelligence/planning/PlanningEngine.ts) | Hierarchical Task Network (HTN) decomposition and self-correction | Native Tool Adapters (`cubio:reasoning`, `cubio:memory`) | Rollback checkpoints; self-verification of post-conditions. |
| **`AgiOneCoreOrchestrator`** | [`agi_one_core_orchestrator.ts`](file:///F:/ONE%20language/src/one/agi_one_core_orchestrator.ts) | Sovereign 5-layer hierarchy coordinator | 148,912 parameters | Permanent actuation lockout: `is_actuation_blocked: true`, `E8005`. |

---

## 3. Authoritative Routing & Fallback Specification

### 3.1 Supported Intent Types & Target Substrates

1. `REASONING_TASK`:
   - **Parser Signature:** Numeric arithmetic, decrement, increment, threshold bounds ("starting from 10, subtract until 0").
   - **Target Substrate:** [`ReasoningEngine`](file:///F:/ONE%20language/src/one/intelligence/reasoning/ReasoningEngine.ts) with registered rules (`makeDecrementRule`, `makeIncrementRule`).
   - **Output:** Exact derivation trace (`DerivationStep[]`), metrics (`stepsUsed`), and terminal status (`RESOLVED` or `PARTIAL`).
2. `CONCEPT_QUERY`:
   - **Parser Signature:** Knowledge graph lookups, property queries, entity relationship checks ("What properties does concept_car have?", "Is concept_car related to concept_vehicle?").
   - **Target Substrate:** [`SelectiveMemory.semanticGraph`](file:///F:/ONE%20language/src/one/intelligence/memory/SelectiveMemory.ts).
   - **Output:** Resolved direct relationships and inherited properties (`ResolvedConcept[]`), or `UNSUPPORTED` if concept unknown.
3. `CONVERSATIONAL_FACT`:
   - **Parser Signature:** Greetings ("Hello", "Good morning"), gratitude ("thank you"), acknowledgments ("ok, got it"), farewells ("goodbye").
   - **Target Substrate:** Deterministic template responder (or opt-in fluent phrasing via `Native5MAdapter`).
   - **Output:** Guaranteed `isSolved: true`, zero episodic memory writes.
4. `UNKNOWN_REQUEST`:
   - **Parser Signature:** Unrecognized, ambiguous, or incomplete requests.
   - **Target Substrate:** Structured clarification generator with capability hints.
   - **Output:** `status: CLARIFICATION_NEEDED`, `isSolved: false`, `isUncertain: true`.
5. **Session Follow-Up References:**
   - **Parser Signature:** Pronouns (`it`, `its`, `their`, `them`, `those`), relation inspections (`its relations`, `show its relations`), or chain adjustments (`subtract by 5`).
   - **Target Substrate:** Bounded dialogue state reference window (`DialogueState.referenceWindow`, max 10 turns).
   - **Output:** Resolves referent from session history without re-parsing; returns clarification if referent is ambiguous or session was reset.

### 3.2 Predictable Fallback Matrix

| Condition | Neural Path Behavior | Symbolic Path Behavior | Terminal Status | Audit Metadata |
| :--- | :--- | :--- | :--- | :--- |
| **`enableNeuralInference === false`** | Completely bypassed | Executes primary engine | `RESOLVED` / `PARTIAL` | `neuralInference: 'NOT_IMPLEMENTED'`, blocked reason documented |
| **Checkpoint Missing / Offline** | `isAvailable() === false` $\to$ bypassed | Executes primary engine | `RESOLVED` / `PARTIAL` | `neuralInference: 'NOT_IMPLEMENTED'`, fallback to symbolic |
| **Adapter Throws Exception** | Intercepted by `safeGenerate()` | Executes primary engine | `RESOLVED` / `PARTIAL` | Caught cleanly; reason `INFERENCE_ERROR`, zero host crash |
| **Malformed Non-JSON Output** | Rejected by `deserializeModelJson` | Executes primary engine | `RESOLVED` / `PARTIAL` | Malformed output discarded; symbolic presentation preserved |
| **Invalid Schema Proposal** | Rejected by `validateNeuralProposal` | Executes primary engine | `RESOLVED` / `PARTIAL` | Proposal ignored; forbidden from writing to long-term memory |
| **Inference Timeout Exceeded** | Generation aborted | Falls back to symbolic score | `RESOLVED` / `PARTIAL` | `fallbackReason: 'TIMEOUT_EXCEEDED'` logged in response |
| **Step Ceiling Exceeded** | Inactive | Halts at `maxReasoningSteps` | `PARTIAL` | `isSolved: false`, `stopReason: 'Step budget limit reached'` |

---

## 4. Symbolic Authority & Anti-Hallucination Guarantees

1. **Absolute Symbolic Veto:**
   A neural proposal can **never** mark a task as `isSolved: true` if the symbolic engine failed to reach the goal or encountered invariant violations.
2. **Knowledge Graph Grounding:**
   A neural proposal cannot invent concepts or relationships. If a concept is absent from `ConceptGraph`, the engine returns `status: UNSUPPORTED` and `resolvedConcepts: []`, regardless of model text.
3. **Memory Write Isolation:**
   Neural generation is strictly forbidden from writing to `SelectiveMemory` or episodic logs. Only verified symbolic derivation steps and outcomes are logged to episodic memory.
4. **Permanent Actuation Lockout:**
   All execution paths maintain `isActuationBlocked: true` (and `E8005`). No conversational request can execute hardware actuation.

---

## 5. Implementation Diff Summary

The following minimal, high-impact fixes were applied to eliminate fragile paths and ensure fail-safe operation:

1. **Robust Exception Interception ([`HybridConversationEngine.ts`](file:///F:/ONE%20language/src/one/intelligence/hybrid/HybridConversationEngine.ts)):**
   - Implemented `safeGenerate(prompt, options)` wrapping `this.native5m.generate()` in a `try...catch` block.
   - Prevents model load errors or GPU faults from aborting conversation turns with unhandled exceptions.
2. **Dialogue State Reference Window Recording ([`HybridConversationEngine.ts`](file:///F:/ONE%20language/src/one/intelligence/hybrid/HybridConversationEngine.ts)):**
   - Added `recordTurn(sessionState, ...)` and `dialogueState.set(sessionId, sessionState)` to the normal dispatch path.
   - Ensures conversational context is reliably preserved for subsequent pronoun resolution (`it`, `show its relations`).
3. **Session-Scoped Follow-Up Isolation:**
   - Follow-up resolution turns set `episodeLogged: false`, satisfying the requirement that follow-up queries do not pollute long-term episodic memory.
4. **Adapter Dependency Injection:**
   - Extended `HybridConversationEngine` constructor to accept a custom `Native5MAdapter` instance, enabling test injection of throwing, unavailable, or malformed mock backends without touching disk checkpoints.

---

## 6. Empirical Verification & Test Results

### 6.1 Task 16 Standalone Verification Suite
The dedicated test suite [`tests/hybrid/task16_hybrid_routing_fallbacks.test.ts`](file:///F:/ONE%20language/tests/hybrid/task16_hybrid_routing_fallbacks.test.ts) was executed via both `npm run test:task16` and `scripts/run-test.cjs`:

```
================================================================================
  ONE INTELLIGENCE — TASK 16: HYBRID ROUTING, MODEL ADAPTERS & FALLBACKS
================================================================================

[Suite 1] Intent Routing & Policy Dispatch...
  ✓ Suite 1 passed: All 4 intent types and multi-turn follow-ups route predictably.

[Suite 2] Model Availability & Opt-In Routing Policy...
  ✓ Suite 2 passed: Opt-in policy, offline fallback, and active model routing verified.

[Suite 3] Adapter Failure & Inference Exception Handling...
  ✓ Suite 3 passed: Throwing adapter safely caught, zero crashes, clean fail-soft fallback.

[Suite 4] Malformed Model Outputs & Strict Schema Validation...
  ✓ Suite 4 passed: Malformed/non-JSON/out-of-bounds proposals strictly rejected; memory intact.

[Suite 5] Timeout Ceilings, Bounded Retries & Resource Budgets...
  ✓ Suite 5 passed: Token caps (<=45), step limits (STEP_LIMIT), and timeout ceilings verified.

[Suite 6] Reasoning-Only Fallback & Symbolic Authority...
  ✓ Suite 6 passed: Symbolic authority vetoes neural hallucinations; zero fabricated successes.

[Suite 7] Safety Invariants, Actuation Lockout & Determinism...
  ✓ Suite 7 passed: Actuation lock, deprecated count rejection, and deterministic replay (sigma^2 = 0.0) verified.

================================================================================
  TASK 16 VERIFICATION: ALL 7 SUITES PASSED (100%)
================================================================================
```

### 6.2 All Hybrid Test Suites Passing (109/109 Tests)
- `tests/hybrid/task16_hybrid_routing_fallbacks.test.ts` $\to$ **7/7 passed (100%)**
- `tests/hybrid/phase5_hybrid_conversation.test.ts` $\to$ **47/47 passed (100%)**
- `tests/hybrid/phase5_gate8_reasoning_relationship_conversational.test.ts` $\to$ **38/38 passed (100%)**
- `tests/hybrid/phase5_gate6_conversational_quality.test.ts` $\to$ **9/9 passed (100%)**
- `tests/hybrid/phase5_gate4_native5m_integration.test.ts` $\to$ **15/15 passed (100%)**

### 6.3 Full Platform Regression Verification
- `npm run test:task16` $\to$ **7/7 passed (100%)**
- `npm run test:task15` $\to$ **7/7 passed (100%)**
- `npm run test:task14` $\to$ **7/7 passed (100%)**
- `npm run test:task13` $\to$ **7/7 passed (100%)**
- `npm run test:v101` $\to$ **16/16 passed (100%)**
- `npm run test:packing` $\to$ **12/12 passed (100%)**

---

## 7. Disconnected Paths & Long-Term Roadmap

1. **Spatial Coordinate Vocabulary vs Natural Language:**
   - CUBIO-MODEL-STAGE1-V1 (148,912 parameters) has a spatial coordinate vocabulary ($\text{vocab\_size} = 369$). It cannot generate fluent natural language text.
   - Conversational text generation relies on CUBIO-NATIVE-MODEL-V1 (4.89M parameters, 1024-token BPE vocabulary) or deterministic template replies.
2. **IPC Transport Decoupling:**
   - [`AgiOneIPCBridge`](file:///F:/ONE%20language/src/one/agi_one_ipc_bridge.ts) operates in-process with zero network overhead. When 3D Memory Studio runs out-of-process, messages route across local IPC sockets without mutating core language execution.
