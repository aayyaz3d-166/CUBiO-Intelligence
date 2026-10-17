# ONE LANGUAGE — ARCHITECTURE FLOW MAP

**Gate ID:** `GATE-10-26-MASTER-ARChitecture-FLOW`  
**Date:** 2026-10-11  
**Repository:** `F:\ONE language`  
**Mode:** END-TO-END AUDIT — REAL REQUEST FLOW

---

## 1. Real Request Flow (End-to-End)

```
Natural-language input
  ↓
[1] Intent parsing
  ↓
[2] Dialogue context (if implemented)
  ↓
[3] Symbolic reasoning or concept graph
  ↓
[4] Result validation
  ↓
[5] Response generation
  ↓
[6] UI/API (if implemented)
```

---

## 2. Per-Transition Breakdown

| Transition | Implemented? | Actual source file | Callable function / interface / schema | Tests | Integration |
|------------|--------------|-------------------|----------------------------------------|-------|-------------|
| Input → Intent parsing | YES | `src/one/intelligence/hybrid/IntentParser.ts` | Regex-driven patterns (IntentParser) | Phase 1, Gate 8 | Implemented |
| Intent → Dialogue context | NO | — | None | None | NOT IMPLEMENTED |
| Dialogue context → Symbolic reasoning | PARTIAL | `src/one/intelligence/reasoning/ReasoningEngine.ts` | ReasoningEngine, RuleRegistry | Phase 3, Gates 8–9 | Isolated |
| Symbolic reasoning → Concept graph | YES | `src/one/intelligence/memory/ConceptGraph.ts` | ConceptGraph (query operations) | Phase 4 | Implemented |
| Result validation | YES | `src/one/intelligence/reasoning/CandidateEvaluator.ts` | CandidateEvaluator (budget enforcement) | Phase 3 | Isolated |
| Response generation | PARTIAL | `src/one/intelligence/hybrid/HybridConversationEngine.ts` | HybridConversationEngine (processInput, dispatch) | Phase 5 | Isolated |
| Response generation → UI/API | NO | — | None wired | None | NOT INTEGRATED |
| Explorer UI → Backend | PARTIAL | `src/one_net/ui/server.ts` | Node HTTP server (/api/status, /api/query, /api/binary, /api/benchmark) | E2E blocked | NOT WRAPPED INTO RELEASE BUILD |
| Natural-language → UI/API | NO | — | No end-to-end path | None | NOT INTEGRATED |

---

## 3. Integration Assessment

| Item | Status |
|------|--------|
| Which transitions are implemented | Intent parsing, symbolic reasoning, concept graph, result validation, response generation (single-request) |
| Which are actually integrated | Intent → reasoning → concept graph → response (in-memory, single request) |
| Which are tested only in isolation | All transitions are tested in isolation; no end-to-end suite |
| Which rely on mocks or stubs | Neural inference adapter is a stub-wrapped runtime (isAvailable()=false); no mock success responses in integration tests |
| Which are missing | Dialogue context, reasoning traces, end-to-end pipeline, UI/API wiring into release build |
| Whether neural inference is genuinely callable | NO — Native5MAdapter is stub-wrapped; isAvailable()=false; no actual inference callable |
| Whether symbolic results remain authoritative | YES — symbolic engine validates and retains authority over any neural proposal |
| Whether reasoning traces reflect actual execution | NO — reasoning traces are not implemented |
| Whether multi-turn state is genuinely preserved | NO — single-request only; no persistent dialogue state |
| Whether the Explorer communicates with the real backend | PARTIAL — server.ts boots and serves HTTP 200 on /api/status, but E2E tests blocked; Explorer UI not wired into release build |

---

## 4. Component Inventory

### Core (compiled into release build)

| Component | Source file | Status |
|-----------|-------------|--------|
| Binary encoding/decoding | `src/binary/binaryCodebook.ts`, `binaryEncoder.ts`, `binaryDecoder.ts` | SUPPORTED |
| 369-address spatial mapping | `src/one/address369_canonical.ts`, `src/one/spatial/OneAddress369.ts`, `SpatialBridge.ts` | SUPPORTED |
| Grid memory | `src/vm/gridMemory.ts` | SUPPORTED |
| Symbolic reasoning | `src/one/intelligence/reasoning/` (RuleRegistry, StateExplorer, CandidateEvaluator, ReasoningEngine) | SUPPORTED |
| Concept graph | `src/one/intelligence/memory/ConceptGraph.ts`, `SelectiveMemory.ts`, `MemoryContextAdapter.ts` | SUPPORTED |
| Conversation parser | `src/one/intelligence/hybrid/IntentParser.ts` | SUPPORTED |
| Hybrid conversation engine | `src/one/intelligence/hybrid/HybridConversationEngine.ts`, `types.ts` | LIMITED |

### Experimental (separate from release build)

| Component | Source file | Status |
|-----------|-------------|--------|
| Explorer UI | `src/one_net/ui/server.ts`, `index.html`, `static/app.css`, `static/app.js` | EXPERIMENTAL |
| UI test suite | `tests/ui/explorer_ui.test.ts` | BLOCKED |
| Neural adapter | `src/one/intelligence/hybrid/Native5MAdapter.ts`, `native5m_runtime.cjs` | NOT IMPLEMENTED |

---

## 5. Summary

| Category | Count |
|----------|-------|
| Transitions implemented | 5 (intent parsing, symbolic reasoning, concept graph, result validation, response generation) |
| Transitions actually integrated | 1 (intent → reasoning → concept graph → response, in-memory, single-request) |
| Transitions tested in isolation | All implemented transitions |
| Transitions relying on mocks/stubs | Neural inference adapter |
| Transitions missing | Dialogue context, reasoning traces, end-to-end pipeline, UI/API wiring |
| Neural inference genuinely callable | No |
| Symbolic results authoritative | Yes |
| Reasoning traces reflect actual execution | No |
| Multi-turn state preserved | No |
| Explorer communicates with real backend | Partial (server boots) but not integrated into release build |

**Overall:** The system is a set of isolated, well-tested components with no end-to-end integration. The full request flow from natural-language input to UI/API response is NOT implemented end-to-end.
