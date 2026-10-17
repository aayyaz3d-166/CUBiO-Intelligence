# ONE LANGUAGE — KNOWN LIMITATIONS

**Gate ID:** `GATE-26-ONE-LANGUAGE-V1-RELEASE`  
**Date:** 2026-10-11  
**Repository:** `F:\ONE language`  
**Mode:** RELEASE QUALIFICATION — EVIDENCE-DRIVEN

---

## 1. Purpose

This document records the known limitations of ONE LANGUAGE as of the v1.0 release qualification. Limitations are recorded only from actual code inspection and test evidence. Nothing is fabricated.

---

## 2. Documented Limitations

### 2.1 Goal-Directed Search Efficiency

**Status:** Independently demonstrated nahi.

The search algorithm (RuleRegistry → StateExplorer → CandidateEvaluator → ReasoningEngine) is bounded and terminates correctly, but the observed efficiency gains in GATE 8 arithmetic tests (e.g., 5→20, 18→3) come from parser recognition (e.g., "starting from X, add until Y" patterns), NOT from an optimized search algorithm. Code inspection confirms:

- ReasoningEngine.ts unchanged since Oct 10 18:41
- StateExplorer.ts unchanged since Oct 10 18:41
- CandidateEvaluator.ts unchanged since Oct 10 18:41
- RuleRegistry.ts unchanged since Oct 10 18:40
- No path in src/one/intelligence/reasoning/ was modified during this audit

**Impact:** The search efficiency gains are parser-recognition-only. The search algorithm is unchanged.

---

### 2.2 Gate 8 Arithmetic Gains

**Status:** Parser recognition se aaye.

The G8-P2-04 (5→20) test previously failed because the intent parser lacked a pattern for "starting from X, add until Y". Fixed in IntentParser.ts only. The underlying symbolic search engine was not modified. This is confirmed by:

- IntentParser.ts is the only file modified in this audit
- Search engine files retain their original modification timestamps (Oct 10)
- The search algorithm itself is deterministic and budget-enforcing

**Impact:** The improvement in G8-P2-04 is due solely to parser pattern recognition, not search algorithm changes.

---

### 2.3 Multi-Turn Dialogue Context

**Status:** Robustly established nahi.

The HybridConversationEngine processes one request at a time. No session-scoped state retention beyond episodic memory recording. Multi-turn dialogue tracking is not implemented.

**Impact:** The conversation parser handles single-request interactions only. No persistent dialogue memory.

---

### 2.4 Neural Inference as General Reasoning

**Status:** Demonstrate nahi gaya.

The model adapter (CUBIO-MODEL-STAGE1-V1) uses vocab_size=369 spatial coordinate tokens. It cannot generate natural-language text. All response paths default to symbolic/deterministic inference. enableNeuralInference=true is opt-in but produces no meaningful language output.

**Impact:** Neural inference is explicitly marked NOT IMPLEMENTED and is not part of the v1.0 release scope.

---

### 2.5 Concept Relationship Queries (Unknown Relationships)

**Status:** Fail safely karna chahiye.

Confirmed behavior:

- Unknown concept → UNSUPPORTED (not ERROR, no hallucination)
- Both exist but unrelated → explicit RESOLVED with "no known relationship", zero resolvedConcepts
- Code inspection confirms fail-closed behavior in HybridConversationEngine.dispatchConceptQuery()

**Impact:** Concept relationships are backed by actual graph data only; no invented facts.

---

### 2.6 Benchmarks / Generalization / General Intelligence

**Status:** Unseen generalization or general intelligence prove nahi karte.

Existing benchmarks measure:

- Deterministic numeric reasoning
- Concept graph traversal
- Conversational pattern matching
- Binary protocol compliance

None measure or claim general intelligence, open-domain reasoning, or cross-domain generalization.

**Impact:** The v1.0 scope is explicitly limited to the capabilities listed in V1_RELEASE_SCOPE.md.

---

### 2.7 Frontend/Backend Integration

**Status:** End-to-end tests ki zaroorat ho sakti hai.

No integrated frontend-backend test suite was identified in the repository. The architecture separates:

- src/one/ — ONE language compiler, VM, and runtime
- src/core/ — execution engine, checkpointing, training
- tests/hybrid/ — conversational interface tests
- tests/phase*/ — phase-specific verification
- src/one_net/ui/ — Explorer UI (separate HTTP server, not wired into the release build)

A separate end-to-end test may be required for complete integration verification.

**Impact:** The Explorer UI and API are not included in the v1.0 release scope because they are not wired into the build and no E2E tests exist.

---

### 2.8 Items NOT Confirmed by Code Inspection (NOT Recorded as Facts)

The following are NOT recorded as verified facts because they are not supported by actual code or test evidence:

- Claims of search algorithm optimization (code unchanged)
- Claims of general-purpose conversational AI
- Claims of multi-turn dialogue state retention
- Claims of neural inference generating natural language
- Claims of general intelligence or unseen generalization
- Claims of the Explorer UI being wired into the release build (it is not)
- Claims of the API being part of the release build (it is not)

---

## 3. Environment and Reproducibility Limitations

### 3.1 Module Resolution (ESM Directory Imports)

The documented test command:

```powershell
npx ts-node --transpile-only tests/phase1_bridge_verification.test.ts
```

fails with ERR_MODULE_NOT_FOUND / ERR_UNSUPPORTED_DIR_IMPORT because the test files import ../src/... directory paths, and Node 26 ESM does not support directory imports without explicit .ts extensions or a --experimental-strip-types flag.

**Impact:** The test suite cannot be executed as documented in the current environment. This is a project-level module-resolution blocker.

**Proposed fix (not applied without authorization):** test files should import from src/... with explicit .ts extensions, or a tsconfig with allowImportingTsExtensions.

---

## 4. Limitations Specific to This Audit

### 4.1 Master Gate Directory

The master audit directory audit/master_gate10_gate26/ does not exist in the repository. No master gate10_gate26 baseline was provided.

**Impact:** The v1.0 release decision cannot reference a master gate baseline.

### 4.2 Gates 12–25

No reports exist for Gates 12–25. The evidence used for the v1.0 release decision is limited to:

- Gate 10 (baseline verified, 178/178 assertions pass)
- Gate 9 (independent verification, 98/98 assertions pass)
- The actual test suites listed in the qualification report

**Impact:** The complete v1.0 qualification cannot be finalized without re-running Gates 12–25 or providing their data.

### 4.3 Clean-Environment Reproducibility

The clean-environment test result is **NOT RUN** because the documented test command fails with module-resolution errors.

**Impact:** The test counts in this release qualification are based on the Gate 10 baseline (178/178 assertions pass) and code inspection, not on a fresh clean-environment test run.

---

## 5. Limitations Specific to the Explorer UI

### 5.1 UI Server

- The Explorer UI server (src/one_net/ui/server.js) boots and serves HTTP 200 on /api/status (verified via manual curl).
- The E2E test suite (tests/ui/explorer_ui.test.ts) is blocked by a spawn-path issue (references git-bash, which does not exist in this environment).
- The UI and its API are not wired into the release build (src/one_net/ui/ is a separate directory).

### 5.2 API Contracts

- The API endpoints (/api/status, /api/query, /api/trace, /api/concept-graph, /api/binary, /api/benchmark) are documented in server.ts comments.
- No E2E tests verify that the UI trace matches the engine trace (the E2E test suite is blocked).

---

## 6. Summary

| Limitation | Status |
|------------|--------|
| Goal-directed search efficiency | Parser recognition only (not algorithm) |
| Gate 8 arithmetic gains | Parser pattern recognition (not algorithm changes) |
| Multi-turn dialogue context | Not implemented |
| Neural inference | NOT IMPLEMENTED (vocab=369 spatial tokens) |
| Concept relationship queries | Fail safely (UNSUPPORTED for unknown; "no known relationship" for unrelated) |
| Benchmarks / generalization | None measure general intelligence |
| Frontend/backend integration | No integrated E2E test suite |
| Module resolution | Directory imports not supported by Node 26 ESM |
| Master gate10_gate26 | Not present |
| Gates 12–25 | Not started / not run |
| Explorer UI | Not wired into release build |
| API | Not wired into release build |

**All limitations are documented from actual code inspection and test evidence. None are fabricated.**
