# ONE Intelligence — Proposed Roadmap Amendments & Governance Updates

> **Document:** `PROPOSED_ROADMAP_CHANGES.md`  
> **Mode:** Strict READ-ONLY Forensic Roadmap Update Proposal  
> **Scope:** Recommendations for Roadmap Refinements Across Phases 0 through 7  
> **Timestamp:** 2026-10-28T12:45:00+05:00  

---

## 1. Justified Roadmap Amendments (Evidence-Backed)

Based on the forensic audit of both repositories, the following concrete amendments to the 30-task roadmap are formally submitted for owner approval:

### Amendment 1: Disambiguate Executable Containers vs. Symbolic Reasoning Protocols (Tasks 10 & 11)
- **Current Ambiguity:** Early drafts suggested that the 3/6/9-bit protocol (`src/binary/`) would replace or serve as the instruction encoding of `UnifiedVM`.
- **Evidence-Backed Reality:**
  - `UnifiedVM` dispatches structured IR bytecode instructions (`CONST`, `LOAD`, `STORE`, `ADD`, `INPUT`, etc.) packaged inside the **`.ox` ONEX binary container** ([`LinkerExecutablePacker.ts`](file:///F:/ONE%20language/src/one/compiler/LinkerExecutablePacker.ts)).
  - The **3/6/9-bit binary protocol** is an optimized, big-endian symbolic serialization format used exclusively by the `BinaryReasoningBridge` to serialize reasoning trajectories and derivation traces.
- **Roadmap Amendment:** Update the task descriptions for Task 10 and Task 11 to reflect that `.ox` is the compiled executable container, while the 3/6/9-bit protocol is the symbolic reasoning serialization format. Do not force the two formats into a fragile hybrid.

### Amendment 2: Normalize Error Code Semantics (Task 20 & Task 28)
- **Current Ambiguity:** Phase 0B erroneously identified `E5012` as the actuation lockout error code.
- **Evidence-Backed Reality:**
  - `E8005` is the permanent actuation safety violation error code (enforced fail-closed in `UnifiedVM.ts`, `ExecutableValidator.ts`, and `VIGSecurityGuard.ts`).
  - `E5012` is the fail-closed error code for *standard input exhaustion* (depleted input queues).
- **Roadmap Amendment:** Explicitly annotate `E8005` as the primary actuation violation code and `E5012` as the I/O input exhaustion guard across all task acceptance criteria.

### Amendment 3: Formalize Dual-Repository CI Parity Strategy (Task 26)
- **Current Ambiguity:** Unclear whether to forcibly merge `F:\one-binary-reasoning` into `F:\ONE language` or keep them independent.
- **Evidence-Backed Reality:** `F:\one-binary-reasoning` is an independent, zero-dependency, ESM-clean library with active CI workflows and independent consumers. Forcibly deleting it would break existing downstream tooling.
- **Roadmap Amendment:** Formally adopt **Option A** (controlled duplicate substrate with continuous CI parity testing via `tests/governance/task26_cross_repository_parity_and_gap_resolution.test.ts`). Schedule formal monorepo workspace consolidation for Phase 2.

### Amendment 4: Establish Formal Phase 2 Deferred Enhancement Scope
- **Current Ambiguity:** Avoid stalling v1.0.1 release on non-blocking experimental features.
- **Roadmap Amendment:** Explicitly establish the **Phase 2 Scope Boundary** for the following deferred items:
  1. *NIST FIPS 203 (ML-KEM) and FIPS 204 (ML-DSA):* Upgrading OMail and state seals from HMAC SHA3-512/SHA-256 to hardware lattice algorithms.
  2. *WASM SIMD Low-Level Memory Kernels:* Upgrading from Node typed array buffer emulation to native WebAssembly LLVM bytecode.
  3. *Monorepo Workspaces:* Consolidating both repositories into a single workspace once downstream dependencies migrate.

### Amendment 5: Enforce Explicit Owner Authorization Gate on Task 30
- **Current Ambiguity:** Risk of unintended automated release publication.
- **Roadmap Amendment:** Require that Task 30 strictly enforce a **Publication Moratorium** until the repository owner explicitly confirms the target repositories, commit SHAs, release versions, artifact checksums, and rollback plans.

---

## 2. Updated Task Scope & Status Summary

| Task Range | Roadmap Phase | Primary Focus | Current Verified Status |
| :---: | :--- | :--- | :---: |
| **Tasks 1–4** | Phase 0: Discovery & Audit | Full repository survey, quarantine of legacy code | **100% COMPLETE** |
| **Tasks 5–8** | Phase 1: Unified Architecture | 5-tier architecture, ownership matrix, IPC contracts | **100% COMPLETE** |
| **Tasks 9–12** | Phase 2: Compiler & Binary | Codebooks, `.ox` container packing, VM execution | **100% COMPLETE** |
| **Tasks 13–16** | Phase 3: Reasoning & Neural | A* planner, CUBiO model adapter, autograd, fallbacks | **100% COMPLETE** |
| **Tasks 14–20** | Phase 4: Memory & Orchestration | 64 KB virtual paging, WAL rollback, Address369 | **100% COMPLETE** |
| **Tasks 21–25** | Phase 5: Verification & Infra | VIG Merkle ledger, worker pool, decoupled Studio/Mesh| **100% COMPLETE** |
| **Tasks 26–28** | Phase 6: Stabilization | Parity governance, full regression suite, docs | **100% COMPLETE** |
| **Task 29** | Phase 7: Release Readiness | Artifact inventory & SHA-256 verification | **100% COMPLETE** |
| **Task 30** | Phase 7: Release Publication | Owner authorization & publication execution | **BLOCKED (Awaiting Owner Review)** |
