# ONE LANGUAGE — PHASE 2 FORENSIC BASELINE AUDIT
**Phase:** Phase 2 Unified Compiler  
**Audit Standard:** Forensic Code, Tests, and Runtime Evidence Verification  
**Rule:** `CODE + TESTS + RUNTIME EVIDENCE > DOCUMENTATION > CLAIMS`  
**Execution Timestamp:** 2026-09-10T11:40:00Z  

---

## 1. Verified Baseline Test Results

Before any code modification or implementation for Phase 2, the complete existing test corpus was executed and verified against the live environment:

* **Core Pipeline Test Targets (`npm test`):** 12 / 12 test targets passing (100% PASS)
  - `test:phase1` (`src/one/test_one_language.ts`) — Lexer, AST Parser, Spatial Bounds
  - `test:phase2` (`src/core/test_phase2_execution.ts`) — CubiO VM, Memory Allocation, $\sigma^2=0.0$
  - `test:phase3` (`src/test_phase3_streaming.ts`) — Zero-Copy Streaming Funnels, Ring Buffers
  - `test:phase4` (`src/core/test_phase4_checkpointing.ts`) — WAL Snapshots, State Rollback
  - `test:phase5` (`src/mesh/test_phase5_mesh.ts`) — 3D Spatial Mesh Routing, Harmonic Weights
  - `test:phase6` (`src/cli/test_phase6_cli.ts`) — CLI Toolchain, Orbit 3D Visualizer
  - `test:step63_64` (`src/core/training/test_step63_64.ts`) — Dataset Streaming, Deduplication Funnels
  - `test:step65_66` (`src/core/training/test_step65_66.ts`) — Fault-Tolerant WAL, Pretraining Scheduler
  - `test:step67_68` (`src/core/training/test_step67_68.ts`) — DPO Harmonic Alignment, INT4 Inference Mock
  - `test:step69_70` (`src/test_master_release.ts`) — 18-Metric Benchmark Table, 8-Layer Merkle
  - `test:advanced` (`src/test_advanced_features.ts`) — 7x7x7 Voxel Grid, Gossip Channels, Seals
  - `test:step1_nextgen` (`src/test_step1_nextgen.ts`) — PQC Lattice Seals, Self-Healing Decay
* **Sovereign Gate Engineering Corpus (CNL-P26.3 – CNL-P26.12):** 427 / 427 assertions passing (100% PASS)
* **Phase 1 Specification Conformance Suite (`npm run test:spec`):** 35 / 35 assertions passing (100% PASS)
* **Total Verified Baseline:** **462 / 462 PASS**

---

## 2. Current Architecture Inspection

### 2.1 Lexical Analyzer (`src/one/oneLexer.ts`)
* **Tokens Recognized:**
  - Spatial Keywords: `node`, `@Space`, `@Grid777`, `@Slice`, `@memview`, `stream`, `align`, `checkpoint`, `seal`, `@seal`, `funnel`, `channel`, `@gossip`, `rss_max`, `@assert_rss`, `@actuation_lock`, `true`, `false`.
  - Computational Keywords (tokenized since Phase 1 lock): `module`, `struct`, `const`, `native`, `class`, `constructor`, `method`, `let`, `for`, `if`, `else`, `private`, `public`, `Cast`, `Sqrt`, `Clamp`, `Int`, `Int32`, `Float32`, `Bool`, `Void`.
  - Literals & Symbols: Strings, numbers, 2-char operators (`->`, `=>`, `..`, `==`), 1-char symbols (`|`, `=`, `:`, `;`, `,`, `.`, `<`, `>`, `+`, `-`, `*`, `/`, `(`, `)`, `{`, `}`, `[`, `]`).
* **Behavior:** Strips whitespace and single-line `//` comments. Throws `[Lexer Error]` on unexpected characters.

### 2.2 Declarative Parser (`src/one/oneParser.ts`)
* **Grammar:** Strict recursive-descent parser for spatial nodes, memory limits, actuation locks, funnels, gossip channels, and spatial slices.
* **AST Output:** `ProgramNode`, `NodeDeclarationNode`, `FunnelDeclarationNode`, `ChannelDeclarationNode`, `SealDeclarationNode`, `SpatialSliceNode`.
* **Limitation:** Throws syntax error when encountering computational statements (`let`, `function`, expressions, statements).

### 2.3 Declarative Compiler (`src/one/oneCompiler.ts`)
* **Lowering:** Translates `ProgramNode` into `ExecutableCubiOAST` containing `ExecutableInstruction[]`.
* **Static Checks:** Validates memory limits ($\le 512$ MB), spatial bounds ($[0,1]^3$), duplicate node IDs, unresolved stream endpoints.
* **Quantization:** `quantize777` and `unquantize777` map continuous $[0,1]^3$ to discrete 7x7x7 lattice voxels $[0..6]^3$ ($0..342$).

### 2.4 Virtual Machine (`src/core/engine/cubioVM.ts`)
* **Role:** Deterministic spatial resource allocator and coordinator.
* **Opcodes:** 10 implemented opcodes (`SET_RSS_GUARD`, `ALLOC_SPATIAL_NODE`, `ALLOC_VOXEL_GRID`, `MAP_ZERO_COPY_VIEW`, `ALIGN_HARMONIC`, `OPEN_FUNNEL_STREAM`, `OPEN_GOSSIP_CHANNEL`, `SEAL_CRYPTOGRAPHIC_SNAPSHOT`, `QUERY_SPATIAL_SLICE`, `ASSERT_RESOURCE_LIMITS`).
* **Invariants:** Bit-exact determinism ($\sigma^2=0.0$), 512 MB physical RSS cap, fail-closed actuation locks.

### 2.5 Address369 (`src/one/address369_canonical.ts`)
* **Slots:** 369 total address slots:
  - 0..25: Symbolic Registers A..Z (`SYM_A_00` .. `SYM_Z_25`).
  - 26..368: Spatial Lattice Voxels ($7\times 7\times 7 = 343$ cells).

---

## 3. Architecture Transition & Scope of Phase 2

### 3.1 Transition Target
```text
OLD (Phase 1 Baseline):
Source -> Lexer -> Declarative Parser -> Declarative Compiler -> CubiO VM

NEW (Phase 2 Unified Compiler):
Source -> Lexer -> Grammar Router -> [Declarative Parser | Computational Parser]
                                                ↓
                                           Unified AST
                                                ↓
                                        Semantic Analyzer (Symbol Table & Scopes)
                                                ↓
                                           Type Checker (E2000 Series Diagnostics)
                                                ↓
                                            Unified IR (Serializable, Typed)
```

### 3.2 Key Deliverables
1. **Grammar Router:** Deterministic token-based classifier routing source to Declarative Parser or Computational Parser.
2. **Computational Parser:** Full Pratt-style precedence parser for variables (`let`, `const`), functions, conditionals (`if`/`else`), loops (`for`, `while`), arrays, objects, and expressions (`+`, `-`, `*`, `/`, `%`, `==`, `!=`, `<`, `<=`, `>`, `>=`, `&&`, `||`, `!`).
3. **Unified AST:** Canonical AST representations bridging existing Declarative AST and new Computational AST, with source spans (line, col).
4. **Semantic Analysis:** Symbol tables supporting global, function, and block scopes, duplicate declaration checks, undefined identifier checks, function arity, and return reachability.
5. **Static Type Checker:** Type inference and checking for `number`, `string`, `boolean`, `null`, `array`, `object`, `function`, issuing `E2000`-series diagnostics.
6. **Unified IR:** Typed, deterministic, serializable Intermediate Representation with instructions (`CONST`, `LOAD`, `STORE`, `MOVE`, `ADD`, `SUB`, `MUL`, `DIV`, `CMP`, `CALL`, `RETURN`, `JUMP`, `JUMP_IF`, `PRINT`, `SPATIAL_OP`).
7. **Compatibility Adapter:** Wraps existing Declarative AST into Unified AST and IR without breaking any of the 462 passing tests.
8. **Phase 2 Conformance Test Suite:** Rigorous unit and integration test suites proving all computational and declarative features.

---

## 4. Protected Compatibility Boundaries

The following files are canonical and protected against breaking changes:
* `src/one/oneLexer.ts`
* `src/one/oneParser.ts`
* `src/one/oneCompiler.ts`
* `src/core/engine/cubioVM.ts`
* `src/one/address369_canonical.ts`

All new Phase 2 architectures will be introduced non-destructively through dedicated modules under `src/one/router/`, `src/one/computational/`, `src/one/ast/`, `src/one/semantics/`, `src/one/types/`, and `src/one/ir/`.
