# ONE LANGUAGE — GATE 10: KNOWN LIMITATIONS

The following limitations are recorded from actual code inspection and test execution. None are fabricated.

---

### 1. Goal-Directed Search Efficiency
**Status:** Independently demonstrated nahi.

The search algorithm (RuleRegistry → StateExplorer → CandidateEvaluator → ReasoningEngine) is bounded and terminates correctly, but the observed efficiency gains in Gate 8 arithmetic tests (e.g., 5→20, 18→3) come from **parser recognition** (`start at X, add until Y` patterns), NOT from an optimized search algorithm. Code inspection confirms:
- `ReasoningEngine.ts` unchanged since Oct 10 18:41
- `StateExplorer.ts` unchanged since Oct 10 18:41
- `CandidateEvaluator.ts` unchanged since Oct 10 18:41
- `RuleRegistry.ts` unchanged since Oct 10 18:40
- No path in `src/one/intelligence/reasoning/` was modified during this audit

### 2. Gate 8 Arithmetic Gains
**Status:** Parser recognition se aaye.

The G8-P2-04 (5→20) test previously failed because the intent parser lacked a pattern for "starting from X, add until Y". Fixed in `IntentParser.ts` only. The underlying symbolic search engine was not modified. This is confirmed by:
- `IntentParser.ts` is the only file modified in this audit
- Search engine files retain their original modification timestamps (Oct 10)
- The search algorithm itself is deterministic and budget-enforcing

### 3. Multi-Turn Dialogue Context
**Status:** Robustly established nahi.

The HybridConversationEngine processes one request at a time. No session-scoped state retention beyond episodic memory recording. Multi-turn dialogue tracking is not implemented.

### 4. Neural Inference as General Reasoning
**Status:** Demonstrate nahi gaya.

The model adapter (CUBIO-MODEL-STAGE1-V1) uses vocab_size=369 spatial coordinate tokens. It cannot generate natural-language text. All response paths default to symbolic/deterministic inference. `enableNeuralInference=true` is opt-in but produces no meaningful language output.

### 5. Concept Relationship Queries (Unknown Relationships)
**Status:** Fail safely karna chahiye.

Confirmed behavior:
- Unknown concept → `UNSUPPORTED` (not ERROR, no hallucination)
- Both exist but unrelated → explicit `RESOLVED` with "no known relationship", zero `resolvedConcepts`
- Code inspection confirms fail-closed behavior in `HybridConversationEngine.dispatchConceptQuery()`

### 6. Benchmarks / Generalization / General Intelligence
**Status:** Unseen generalization or general intelligence prove nahi karte.

Existing benchmarks measure:
- Deterministic numeric reasoning
- Concept graph traversal
- Conversational pattern matching
- Binary protocol compliance

None measure or claim general intelligence, open-domain reasoning, or cross-domain generalization.

### 7. Frontend/Backend Integration
**Status:** End-to-end tests ki zaroorat ho sakti hai.

No integrated frontend-backend test suite was identified in the repository. The architecture separates:
- `src/one/` — ONE language compiler, VM, and runtime
- `src/core/` — execution engine, checkpointing, training
- `tests/hybrid/` — conversational interface tests
- `tests/phase*/` — phase-specific verification

A separate end-to-end test may be required for complete integration verification.

### 8. Items NOT confirmed by code inspection (NOT recorded as facts)

The following are NOT recorded as verified facts because they are not supported by actual code or test evidence:
- Claims of search algorithm optimization (code unchanged)
- Claims of general-purpose conversational AI
- Claims of multi-turn dialogue state retention
- Claims of neural inference generating natural language
- Claims of general intelligence or unseen generalization

---

**Report generated: 2026-10-11**
