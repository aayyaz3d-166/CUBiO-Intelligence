# ONE LANGUAGE — ARCHITECTURE REQUEST FLOW MAP

**Date:** 2026-10-11  
**Scope:** Gates 10–26 Audit  

---

## 1. End-to-End Request Pipeline

```
[User Input String]
        │
        ▼
[IntentParser.ts: parse()] 
  ├── RegEx Pattern Matching
  ├── Stopword Filtering
  └── Entity Extraction (inputValue, targetValue, conceptId, relatedConceptId)
        │
        ▼
[HybridConversationEngine.ts: processInput()]
  ├── 1. Request Validation (validateHybridRequest)
  │
  ├── 2. REASONING_TASK ─────────► [ReasoningEngine.ts: solve()]
  │                                  ├── Directional Pruning Engine (inc / dec)
  │                                  ├── StateExplorer.ts (FIFO BFS queue)
  │                                  ├── CandidateEvaluator.ts (constraints & goal check)
  │                                  └── Bounded Candidate Derivation
  │
  ├── 3. CONCEPT_QUERY ──────────► [ConceptGraph.ts]
  │                                  ├── Direct Edge Retrieval (getDirectRelationships)
  │                                  ├── Multi-Hop Property Inference (depth ≤ 3)
  │                                  └── Pairwise Concept Validation (both IDs verified)
  │
  ├── 4. CONVERSATIONAL_FACT ────► [Template Generator / Native 5M Adapter]
  │                                  ├── Opt-in Native 5M Inference (bounded ≤ 45 tokens)
  │                                  └── Deterministic Fallback Templates ("Hello!", "Understood!")
  │
  └── 5. UNKNOWN_REQUEST ────────► [Clarification Generator]
                                     └── Structured Guidance Response
        │
        ▼
[Episodic Logging (SelectiveMemory.ts)] (Reasoning episodes recorded; greetings excluded)
        │
        ▼
[HybridResponse JSON Object]
```

---

## 2. Transition Implementation & Verification Matrix

| Transition Step | Component / Source | Interface / Method | Actual Implementation Status | Integration Status |
|---|---|---|---|---|
| Natural Language Parsing | `IntentParser.ts` | `parse(text: string): ParsedUserIntent` | **IMPLEMENTED** | Integrated with Hybrid engine |
| Bounded Symbolic Reasoning | `ReasoningEngine.ts` | `solve(spec: ReasoningInput): ReasoningResult` | **IMPLEMENTED** | Integrated via `dispatchReasoning` |
| Concept Graph Traversal | `ConceptGraph.ts` | `getConcept()`, `getDirectRelationships()` | **IMPLEMENTED** | Integrated via `dispatchConceptQuery` |
| Pairwise Edge Verification | `HybridConversationEngine.ts` | `dispatchConceptQuery()` (P1 logic) | **IMPLEMENTED** | Integrated (fails closed if concept missing) |
| Multi-turn Dialogue Context | `None` | N/A | **NOT IMPLEMENTED** | Single-turn request-response only |
| Reasoning Trace Replay | `None` | N/A | **PARTIAL** | Candidates logged; replay API missing |
| Neural Model Inference | `Native5MAdapter.ts` | `generate(prompt, options)` | **IMPLEMENTED (LIMITED)** | Integrated as wording generator only |
| Explorer UI Web Server | `src/one_net/ui/server.ts` | HTTP API `/api/status`, `/api/query` | **PROTOTYPE** | Isolated; not wired to core build or E2E tests |
