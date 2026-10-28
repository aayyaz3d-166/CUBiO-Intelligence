# ONE LANGUAGE — V1.0 RELEASE SCOPE

**Gate ID:** `GATE-26-ONE-LANGUAGE-V1-RELEASE`  
**Date:** 2026-10-11  
**Authoritative repository:** `F:\ONE language`  
**Proposed scope:** for review and approval before public distribution

---

## 1. Purpose

This document proposes the v1.0 release scope for ONE LANGUAGE. The scope is derived from actual code inspection and test evidence. It covers only capabilities that are demonstrated by tests and code. No feature is advertised solely because a roadmap or report mentions it.

**The v1.0 scope is NOT FINAL.** It is a proposal for review. Approval is required before public distribution of a v1.0 release candidate.

---

## 2. Scope Method

For each capability, the following method was used:

1. Read the source code to find the implementation.
2. Read the test suite to find the evidence.
3. Run the test suite (where feasible) to verify the evidence.
4. Classify the capability as SUPPORTED, LIMITED, EXPERIMENTAL, NOT IMPLEMENTED, or NOT VERIFIED.

---

## 3. Proposed v1.0 Scope

### 3.1 Core (SUPPORTED)

| # | Capability | Evidence | Status |
|---|-----------|----------|--------|
| 1 | Binary encoding and decoding using the documented protocol | binaryEncoder.ts, binaryDecoder.ts — compiled and present in dist/ | SUPPORTED |
| 2 | 369-address spatial mapping and supported grid operations | OneAddress369, GridMemory — 343-cell 7x7x7 grid, Phase 1 suite | SUPPORTED |
| 3 | Bounded symbolic reasoning for supported rule sets | RuleRegistry, StateExplorer, CandidateEvaluator, ReasoningEngine — Phase 3 suite | SUPPORTED |
| 4 | Supported concept graph queries | ConceptGraph.ts — Phase 4 suite, pairwise query safety verified | SUPPORTED |
| 5 | Supported conversation parsing and fallback behavior | HybridConversationEngine.ts, IntentParser.ts — deterministic regex-based parser | LIMITED (no multi-turn context) |

### 3.2 Experimental / Not Implemented (EXCLUDED from v1.0)

| # | Capability | Evidence | Status |
|---|-----------|----------|--------|
| 6 | Reasoning traces (structured derivation, replayable, bounded, deterministic) | GATE 13 reference; not implemented | NOT IMPLEMENTED |
| 7 | Dialogue memory / session-scoped state retention | GATE 14 reference; not implemented | NOT IMPLEMENTED |
| 8 | Neural integration (explicitly call blocked) | Native5MAdapter is stub-wrapped; isAvailable()=false; model vocab=369 spatial tokens, not NLP | NOT IMPLEMENTED |
| 9 | Explorer UI (web frontend) | src/one_net/ui/ created as separate Node.js HTTP server; not wired into the release build; E2E tests blocked | PARTIALLY IMPLEMENTED / EXPERIMENTAL |
| 10 | API (REST endpoints) | src/one_net/ui/server.ts endpoints documented; not wired into the release build; E2E tests blocked | PARTIALLY IMPLEMENTED / EXPERIMENTAL |

### 3.3 Not Verified (NOT VERIFIED)

| # | Capability | Reason |
|---|-----------|--------|
| 11 | Performance optimization (GATE 21) | Profiling not captured |
| 12 | Security threat-model (GATE 22) | Action item for future gate |
| 13 | Public demo release (GATE 24) | Partial packaging; v1.0 scope not approved |

---

## 4. Scope Read-Back

The v1.0 release scope as proposed:

1. **Binary encoding and decoding** — SUPPORTED.
2. **369-address spatial mapping and grid operations** — SUPPORTED.
3. **Bounded symbolic reasoning** — SUPPORTED.
4. **Concept graph queries** — SUPPORTED.
5. **Conversation parsing and fallback** — LIMITED (single-request, no persistent session).
6. **Reasoning traces** — NOT IMPLEMENTED.
7. **Dialogue memory** — NOT IMPLEMENTED.
8. **Neural integration** — NOT IMPLEMENTED (blocked).
9. **Explorer UI** — EXPERIMENTAL/PARTIALLY IMPLEMENTED (isolated HTTP server, not in release build).
10. **API** — EXPERIMENTAL/PARTIALLY IMPLEMENTED (isolated HTTP server, not in release build).
11. **Gates 12–25** — NOT STARTED; excluded from v1.0 scope (not required).

**Read-back completed.** The scope is a minimal, evidence-based subset of the repository. It does not include any feature that is not demonstrated by tests or code inspection.

---

## 5. Approval Required

The v1.0 scope proposed above requires explicit approval before public distribution.

**Approval is required for:**

- The set of 11 capabilities listed in Section 3.
- The exclusion of Gates 12–25 from the release scope.
- The exclusion of neural integration, Explorer UI, and API from the release candidate.
- The documented limitations (Section 6 of the qualification report).

**No public distribution will occur without explicit approval.**
