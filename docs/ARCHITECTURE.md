# ONE LANGUAGE — MASTER ARCHITECTURE & FIVE-TIER ECOSYSTEM
**Specification Status:** LOCKED / IMPLEMENTED (Tasks 1–27)  
**Authority:** Chief Architect & Systems Engineering Team

---

## 1. Five-Tier System Architecture

The ONE Language sovereign computing fabric is organized into five decoupled tiers:

```mermaid
flowchart TD
    subgraph T1["Tier 1: ONE Intelligence Governance & Umbrella"]
        G1[AgiOneCoreOrchestrator]
        G2[Audit & Provenance Ledger]
        G3[Security & Actuation Safety Policy]
    end

    subgraph T2["Tier 2: 3D Memory Studio"]
        S1[Three.js / Orbit Visualizer]
        S2[Spatial Voxel Inspection Dashboard]
        S3[Telemetry & Performance Graph]
    end

    subgraph T3["Tier 3: AGI ONE Core Infrastructure"]
        C1[UnifiedCompiler / AST / Lexer]
        C2[UnifiedVM Stack Engine]
        C3[LinkerExecutablePacker .ox]
        C4[TimeTravelStateManager & WAL]
        C5[ExtremeMemoryVMAdapter 64KB Paging]
    end

    subgraph T4["Tier 4: CubiO Intelligence"]
        R1[ReasoningSession]
        R2[ModelReasoningAdapter]
        R3[HybridConversationEngine]
        R4[Native Rule Engine & A* Planner]
    end

    subgraph T5["Tier 5: Native CubiO Model"]
        M1[Deterministic Tensor Arena]
        M2[Reverse-Mode Autograd Engine]
        M3[INT4 Quantized Inference]
        M4[Harmonic 369 Spatial Lattice]
    end

    T1 --> T3
    T1 --> T4
    T2 <-->|AgiOneIPCBridge (Decoupled JSON-RPC)| T3
    T3 <-->|Instruction Dispatch| T4
    T4 <-->|Binary Protocol Bitstream| T5
```

### Tier Descriptions & Responsibilities

1. **Tier 1 — ONE Intelligence Governance & Umbrella:**
   - **Lead Module:** `AgiOneCoreOrchestrator` (`src/one/agi_one_core_orchestrator.ts`).
   - Manages top-level system lifecycle, boot sequences, subsystem health checks, and global fail-closed security policies. Ensures that the CLI operates 100% autonomously even when higher-level visualization services are absent.
2. **Tier 2 — 3D Memory Studio:**
   - **Lead Module:** `src/studio/test_native_3d_memory_studio.ts`.
   - Provides optional real-time 3D spatial orbit visualization, voxel grid memory mapping, and developer telemetry. Communicates strictly over decoupled IPC (`AgiOneIPCBridge`) to avoid embedding UI frameworks into the core compiler.
3. **Tier 3 — AGI ONE Core Infrastructure:**
   - **Lead Modules:** `UnifiedCompiler.ts`, `UnifiedVM.ts`, `LinkerExecutablePacker.ts`, `TimeTravelStateManager.ts`, `ExtremeMemoryVMAdapter.ts`.
   - The sovereign compiler and execution engine. Compiles `.one` source files into intermediate representation (`UnifiedIRProgram`), packages them into standalone `.ox` executables, executes them with deterministic memory gating (< 512 MB RSS), and provides bit-exact WAL time-travel rollback.
4. **Tier 4 — CubiO Intelligence:**
   - **Lead Modules:** `ReasoningSession.ts`, `ModelReasoningAdapter.ts`, `ReasoningEngine.ts`, `HybridConversationEngine.ts`.
   - Orchestrates multi-step reasoning, bounded forward-chaining hypothesis search, and plan derivation. Bridges symbolic language structures to binary bitstream sequences.
5. **Tier 5 — Native CubiO Model:**
   - **Lead Modules:** `src/core/model/`, `scratch/cubio_neural_lattice/`.
   - High-performance numeric computing substrate providing tensor arena allocations, reverse-mode autograd, sub-millisecond INT4 quantized inference (0.85 ms latency), and spatial harmonic alignment.

---

## 2. Dual-Repository Division & Ownership

The ecosystem is distributed across two companion repositories with clear ownership boundaries:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   REPOSITORY BOUNDARY                                  │
├──────────────────────────────────────────┬─────────────────────────────────────────────┤
│ Primary Repo: F:\ONE language            │ Companion Repo: F:\one-binary-reasoning     │
├──────────────────────────────────────────┼─────────────────────────────────────────────┤
│ - Sovereign Language Specification       │ - Canonical Binary Language Protocol        │
│ - Computational Lexer, Parser & AST      │   (3-bit tag, 6-bit opcode, 9-bit address)  │
│ - Intermediate Representation (IR)       │ - 0/1 Reasoning Intelligence Engine         │
│ - UnifiedVM Virtual Machine              │ - Native Rule-Based Engine & A* Planner     │
│ - Linker & .ox Container Packaging       │ - Binary Reasoning Bridge & Bitstream Ops   │
│ - Developer CLI (one.exe standalone)     │ - 7 Deterministic Reasoning Benchmarks      │
│ - VS Code IDE Extension (.vsix)          │   (BM-01 to BM-07, σ² = 0.0)                │
│ - CanonicalState & TimeTravel WAL        │ - Zero runtime dependencies                 │
│ - ExtremeMemory Virtual Paging (64 KB)   │                                             │
│ - AgiOneIPCBridge & 3D Memory Studio     │                                             │
└──────────────────────────────────────────┴─────────────────────────────────────────────┘
```

### Cross-Repository Integration Contract
- `F:\one-binary-reasoning` publishes the canonical binary substrate (`BinaryEncoder`, `BinaryDecoder`, `RuleEngine`, `TriangleOpcode`, `BitCategory`).
- `F:\ONE language` imports or references this substrate via `ModelReasoningAdapter` and `ReasoningSession`.
- CI parity is guaranteed via `tests/governance/task26_cross_repository_parity_and_gap_resolution.test.ts` (66 assertions confirming bit-for-bit equivalence).

---

## 3. Compiler/VM vs. Binary Reasoning Protocol Boundary

| Dimension | Compiler & UnifiedVM Domain | Binary Reasoning Protocol Domain |
| :--- | :--- | :--- |
| **Data Representation** | Rich AST Nodes, IR Bytecode, Call Frames, Scope Maps | Continuous Big-Endian Bitstrings (e.g. 213-bit streams) |
| **Framing Format** | Structured 64-byte ONEX header, IR instruction records | 3-bit type tag + 6-bit planar opcode + 9-bit address |
| **Execution Model** | Imperative stack-and-frame dispatch, async microtasks | Bounded heuristic state-space search (A* graph exploration) |
| **Memory Access** | Symbolic variables (`Map<string, VMValue>`), closures | Flat canonical Address369 pointers `[0..368]` |
| **Error Handling** | Throws `OneVMError` (`E1000`–`E8007`) with line/col and PC | Returns deterministic derivation status (`0` fail / `1` pass) |

---

## 4. API & IPC Contracts (`AgiOneIPCBridge`)

Communication between the core engine and external observers is governed by JSON-RPC style frame envelopes:

### 4.1 Message Envelope Schema
```typescript
interface IPCMessage<T = unknown> {
  id: string;              // Unique request identifier (UUID or monotonic sequence)
  method: IPCMethod;       // Operation name
  params: T;               // Strongly typed payload
  authToken?: string;      // Optional auth token (automatically redacted across bridge)
  timestamp: number;       // Unix millisecond timestamp
}

type IPCMethod =
  | 'GET_SYSTEM_HEALTH'
  | 'GET_CANONICAL_STATE'
  | 'DISPATCH_INSTRUCTION'
  | 'QUERY_VOXEL_GRID'
  | 'SEAL_STATE_SNAPSHOT'
  | 'ROLLBACK_TO_SNAPSHOT';
```

### 4.2 Security & Redaction Guarantees
- The IPC bridge automatically scans outgoing payload fields. Any field whose key matches `/token|key|secret|pass|auth/i` has its value replaced with `"[REDACTED_SECRET]"`.
- All operations are fail-closed: if an incoming message contains malformed JSON or an unknown method, the bridge emits an error frame without crashing the core process.

---

## 5. Canonical State & Time-Travel Engine

The `TimeTravelStateManager` manages reproducible state evolution:
- **Write-Ahead Logging (WAL):** Every state modification appends a record with a strictly monotonic sequence number ($S_{i+1} = S_i + 1$).
- **Rolling Snapshots:** Point-in-time full snapshots serialize the VM environment, spatial cell assignments, and register contents into immutable JSON buffers sealed with SHA-256 hashes.
- **Rollback Invariant:** Rolling back to a previous snapshot restores the exact heap and register state ($\sigma^2 = 0.0$ state drift), allowing complete time-travel debugging.
