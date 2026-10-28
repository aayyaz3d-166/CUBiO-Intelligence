# ONE Intelligence — Roadmap Dependency Graph

> **Document:** `ROADMAP_DEPENDENCY_GRAPH.md`  
> **Mode:** Strict READ-ONLY Forensic Dependency Mapping  
> **Scope:** Phases 0 through 7 (Tasks 1 through 30)  
> **Timestamp:** 2026-10-28T12:45:00+05:00  

---

## 1. Visual Dependency Graph (All 30 Tasks)

```mermaid
flowchart TD
    subgraph P0["Phase 0: Discovery & Audit"]
        T01["Task 01: Audit Repositories"] --> T02["Task 02: Verify Baselines"]
        T02 --> T03["Task 03: Inventory Components"]
        T03 --> T04["Task 04: Classify & Quarantine"]
    end

    subgraph P1["Phase 1: Architecture & Contracts"]
        T04 --> T05["Task 05: Master Architecture"]
        T05 --> T06["Task 06: Ownership Boundaries"]
        T06 --> T07["Task 07: Shared APIs & IPC"]
        T07 --> T08["Task 08: Execution Contracts"]
    end

    subgraph P2["Phase 2: Compiler & Binary Integration"]
        T08 --> T09["Task 09: Binary Codec & 369"]
        T09 --> T10["Task 10: IR to Container Pack"]
        T10 --> T11["Task 11: VM Dispatch Integration"]
        T08 --> T12["Task 12: Preserve Compatibility"]
    end

    subgraph P3["Phase 3: Reasoning & Neural Intelligence"]
        T09 & T12 --> T13["Task 13: Binary Reasoning"]
        T13 --> T14["Task 14: Reasoning + Model"]
        T14 --> T15["Task 15: Autograd & WASM"]
        T14 & T15 --> T16["Task 16: Hybrid Fallbacks"]
    end

    subgraph P4["Phase 4: Memory & Orchestration"]
        T11 --> T17["Task 17: Extreme Memory Paging"]
        T17 --> T18["Task 18: Canonical State & WAL"]
        T05 & T18 --> T19["Task 19: Core Orchestrator"]
        T19 --> T20["Task 20: Address369 & Safety"]
    end

    subgraph P5["Phase 5: Verification & Infrastructure"]
        T11 & T19 --> T21["Task 21: VIG Compiler Graph"]
        T19 & T20 --> T22["Task 22: Worker Pool & Limits"]
        T15 & T22 --> T23["Task 23: Datasets & Registry"]
        T07 & T19 --> T24["Task 24: IPC & Studio"]
        T19 & T24 --> T25["Task 25: Optional Subsystems"]
    end

    subgraph P6["Phase 6: Stabilization"]
        T13 & T16 & T18 & T20 & T21 & T22 & T23 & T24 & T25 --> T26["Task 26: Resolve Gaps"]
        T26 --> T27["Task 27: Full E2E Regression"]
        T27 --> T28["Task 28: Documentation & Build"]
    end

    subgraph P7["Phase 7: Release"]
        T28 --> T29["Task 29: Release Candidate Audit"]
        T29 -->|Gated on Owner Approval| T30["Task 30: Publish Release"]
    end
```

---

## 2. Critical Execution Path & Parallel Tracks

### 2.1 Critical Path Analysis
The primary critical path that determines release readiness spans:
$$\text{T01} \to \text{T04} \to \text{T05} \to \text{T08} \to \text{T11} \to \text{T17} \to \text{T18} \to \text{T19} \to \text{T20} \to \text{T26} \to \text{T27} \to \text{T28} \to \text{T29} \to \text{T30}$$
- **Current Position on Critical Path:** Execution has progressed through **Task 29** and is paused at the authorization gate for **Task 30**.

### 2.2 Parallel Development Tracks
Three independent tracks feed into the final stabilization convergence:
1. **Track A (Compiler, Memory & Container):** T10 $\to$ T11 $\to$ T17 $\to$ T18.
2. **Track B (Reasoning & Neural Intelligence):** T09 $\to$ T13 $\to$ T14 $\to$ T15 $\to$ T16.
3. **Track C (Infrastructure, VIG & Optional Services):** T21, T22, T23, T24, T25.

All three tracks converged into Task 26 for gap resolution and were regression-certified in Task 27.
