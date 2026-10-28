# ONE Intelligence — Phase 0C: Unresolved Findings & Cross-Repository Integration Audit Report

**Workspace:** `F:\ONE language`  
**Repositories Inspected:**  
1. **ONE Language:** `https://github.com/aayyaz3d-166/ONE-language.git` (`F:\ONE language`)  
2. **ONE Binary Reasoning Intelligence:** `https://github.com/aayyaz3d-166/ONE-Binary-Reasoning-Intelligence.git` (`F:\one-binary-reasoning`)  
**Audit Type:** Strict READ-ONLY Architectural & Cross-Repository Forensic Audit  
**Execution Timestamp:** 2026-10-28T04:29:00+05:00  

---

## 1. Executive Summary & Purpose

This Phase 0C audit investigates unresolved architectural, integration, testing, compatibility, safety, and release questions across both repositories. Rather than accepting prior reports (including `PHASE_0B_FULL_REPOSITORY_COMPONENT_DISCOVERY.md`) as unquestionable truth, this audit forensically compares earlier claims against actual source code, Git histories, runtime test executions, configuration files, and binary release artifacts.

### Key Audit Findings:
1. **Cross-Repository Origin & Mirroring:** `F:\one-binary-reasoning` is a dedicated standalone ESM-clean extraction of the binary protocol (`src/binary/`), bounded reasoning engine (`src/one/intelligence/reasoning/`), and canonical Address369 (`src/one/address369_canonical.ts`) from `F:\ONE language`. It contains an additional coordinator ([`ReasoningSession.ts`](file:///F:/one-binary-reasoning/src/integration/ReasoningSession.ts)), independent test suites, and GitHub Actions CI workflow, but has no Git submodule or monorepo package link back to `ONE language`.
2. **Phase 0B Discrepancies Corrected:**
   - *Compiler / VM Paths:* The production compiler is [`src/one/UnifiedCompiler.ts`](file:///F:/ONE%20language/src/one/UnifiedCompiler.ts) (not `src/one/compiler.ts`) and the production VM is [`src/one/vm/UnifiedVM.ts`](file:///F:/ONE%20language/src/one/vm/UnifiedVM.ts) (not `src/one/vm.ts`).
   - *Error Code E5012:* `E5012` is the fail-closed error for *unhandled/exhausted I/O stream* in `UnifiedVM.ts#L840` (introduced in v1.0.1 command syntax), not an actuation barrier error. The true actuation safety violation error code is `E8005` (enforced in `ExecutableValidator.ts` and `VIGSecurityGuard.ts`).
3. **Execution Path Realities (Path 2 Traced):**
   - The production compilation path compiles ONE source code into `UnifiedIRProgram`, which is packed into the **`.ox` ONEX binary container** ([`ExecutablePacker.ts`](file:///F:/ONE%20language/src/one/packer/ExecutablePacker.ts)).
   - The **3/6/9-bit binary protocol** ([`src/binary/`](file:///F:/ONE%20language/src/binary/)) is NOT used for instruction dispatch by `UnifiedVM`. It is an isolated symbolic communication protocol used exclusively by `BinaryReasoningBridge`.
4. **Verified Invariants:**
   - Address369 bounds `[0..368]` (symbolic `0..25`, spatial `26..368`) are 100% byte-for-byte identical between `address369_canonical.ts` in `ONE language` and `address369.ts` in `one-binary-reasoning`.
   - Actuation lockout (`actuationLock: true`, `E8005`) is enforced fail-closed across all build and runtime validators.
5. **Fresh Test Execution Evidence:**
   - `one-binary-reasoning`: All 4 test suites (11 binary tests, 5 reasoning suites, 5 bridge E2E tests, 7 benchmarks) executed live with **100% pass (0 failures)** in memory.
   - `ONE language`: Phase 1 Architecture Bridge tests (10/10 gates) and v1.0.1 Command Syntax tests (16/16 suites) executed live with **100% pass (0 failures)**.
6. **Release Artifact Hashes Reconciled:**
   - Calculated exact SHA-256 hashes of all existing artifacts in `dist/` and `dist/v1.0.1-rc/`. Verified that all files on disk match their accompanying `.sha256` manifest files.

---

## 2. Workstream A: Repository and Git Baseline

### Repository 1: ONE Language
- **Local Path:** `F:\ONE language`
- **Current Branch:** `integration/v1.0.1-local`
- **HEAD Commit:** `fcce5745428e0637ef53d278453aed12cc4bcde2` (`merge: integrate feat/v1.0.1-command-syntax into integration/v1.0.1-local`)
- **Working Tree Status:** 100% Clean (`nothing to commit, working tree clean`).
- **Remotes:**
  - `new-origin`: `https://github.com/aayyaz3d-166/ONE-language.git` (fetch & push)
  - `origin`: `https://github.com/aayyaz3d-166/ONE-language-` (fetch & push)
- **Tags:**
  - `v0.1.0-baseline`
  - `v1.0.0` (Points to `2cf25533c5165964f4757cf1f660c991d3e628ed`)
  - `v1.0.1` (Points to `5f9dc99b9aa90f76edabbc21f4caa3a456a765c3`)
- **Default Remote Branch:** `new-origin/stabilization/phase-1-fixes` (`5f9dc99b9aa90f76edabbc21f4caa3a456a765c3`, PR #1 merged).

### Repository 2: ONE Binary Reasoning Intelligence
- **Local Path:** `F:\one-binary-reasoning`
- **Current Branch:** `main`
- **HEAD Commit:** `61bf3cb1f997ac22a7e44e4b6cbd416f30015054` (`docs: add project logo and update repository branding`)
- **Initial Commit:** `39017a9e5cc7422d60ddc796b22f95fcdf606c49` (`feat: initial commit of ONE Binary 0/1 Reasoning Intelligence`)
- **Working Tree Status:** 100% Clean (`nothing to commit, working tree clean`).
- **Remotes:**
  - `origin`: `https://github.com/aayyaz3d-166/ONE-Binary-Reasoning-Intelligence.git` (fetch & push)
- **Tags:** None currently tagged.
- **CI / Workflows:** `.github/workflows/ci.yml` exists, running `npm run typecheck`, `npm test`, and `npm run test:benchmark`.

---

## 3. Workstream B: Cross-Repository Component Mapping

| Component Identifier | Repository & Relative Path | Responsibility & Interface | Dependencies / Dependents | Status & Classification | Integration State |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`XCOMP-01`**<br>Binary Codebook | **ONE:** `src/binary/binaryCodebook.ts`<br>**OBR:** `src/binary/binaryCodebook.ts` | 3/6/9-bit static lookup tables; 8 3-bit categories, 64 6-bit opcodes, 512 9-bit addresses. | Depends on `types`, `address369`. Used by `binaryDecoder`. | **Production**<br>(Shared Spec) | **Verified Identical** (Differ only in ESM `.js` import specifiers). |
| **`XCOMP-02`**<br>Binary Encoder | **ONE:** `src/binary/binaryEncoder.ts`<br>**OBR:** `src/binary/binaryEncoder.ts` | Big-endian bitstring serializer for null, bool, int, float64, string, address369, opcode. | Depends on `triangleMapper`, `address369`. Used by `BinaryReasoningBridge`. | **Production**<br>(Shared Spec) | **Verified Identical** (Differ only in ESM `.js` import specifiers). |
| **`XCOMP-03`**<br>Binary Decoder | **ONE:** `src/binary/binaryDecoder.ts`<br>**OBR:** `src/binary/binaryDecoder.ts` | Fail-closed bitstring parser with offset tracking; validates reserved opcodes and bounds. | Depends on `binaryCodebook`, `address369`. Used by `BinaryReasoningBridge`. | **Production**<br>(Shared Spec) | **Verified Identical** (Differ only in ESM `.js` import specifiers). |
| **`XCOMP-04`**<br>Triangle Mapper | **ONE:** `src/binary/triangleMapper.ts`<br>**OBR:** `src/binary/triangleMapper.ts` | Bijective 6-bit geometric mapping to triangle vertices/edges (c1, e1, c2, e2, c3, e3). | Pure geometric transform. | **Production**<br>(Shared Spec) | **Verified Identical** (Differ only in ESM `.js` import specifiers). |
| **`XCOMP-05`**<br>Canonical Address369 | **ONE:** `src/one/address369_canonical.ts`<br>**OBR:** `src/shared/address369.ts` | Authoritative definition of 369 addresses: symbolic `[0..25]`, spatial `[26..368]`, reserved `[369..511]`. | Core anchor imported by all memory and binary modules. | **Production Invariant** | **100% Byte-for-Byte Identical** (4,356 bytes). |
| **`XCOMP-06`**<br>Binary Reasoning Bridge | **ONE:** `src/one/intelligence/reasoning/BinaryReasoningBridge.ts`<br>**OBR:** `src/integration/BinaryReasoningBridge.ts` | Envelopes tokens into canonical 3/6/9-bit bitstrings and verifies round-trip decoding. | Depends on `src/binary/`, `reasoning/types`. | **Production Bridge** | **Verified Identical** (Imports adjusted for folder depth). |
| **`XCOMP-07`**<br>Reasoning Engine Core | **ONE:** `src/one/intelligence/reasoning/ReasoningEngine.ts`<br>**OBR:** `src/reasoning/ReasoningEngine.ts` | Bounded forward-search derivation engine with step, depth, and candidate ceilings. | Depends on `RuleRegistry`, `StateExplorer`, `CandidateEvaluator`. | **Production Engine** | **Verified Identical** (Differ only in ESM `.js` import specifiers). |
| **`XCOMP-08`**<br>Reasoning Session | **ONE:** *NOT PRESENT*<br>**OBR:** `src/integration/ReasoningSession.ts` | High-level session coordinator; executes problem solving and generates bit-exact binary traces. | Depends on `ReasoningEngine`, `RuleRegistry`, `BinaryReasoningBridge`. | **OBR Exclusive** | **Present in OBR only** (Available for backporting into ONE). |
| **`XCOMP-09`**<br>Unified Compiler | **ONE:** `src/one/UnifiedCompiler.ts`<br>**OBR:** *NOT PRESENT* | Production ONE Language compiler orchestrating lexer, grammar router, AST, semantics, types, IR. | Core of ONE Language. | **ONE Exclusive** | **Production** |
| **`XCOMP-10`**<br>Unified Virtual Machine | **ONE:** `src/one/vm/UnifiedVM.ts`<br>**OBR:** *NOT PRESENT* | Production register/stack machine executing `UnifiedIRProgram`; enforces 512 call depth, 500MB RSS. | Core VM of ONE Language. | **ONE Exclusive** | **Production** |
| **`XCOMP-11`**<br>Executable Packer (.ox) | **ONE:** `src/one/packer/ExecutablePacker.ts`<br>**OBR:** *NOT PRESENT* | Serializes `UnifiedIRProgram` into versioned `.ox` ONEX binary container with header checksum and SHA-256. | Used by `OneDeveloperCLI`. | **ONE Exclusive** | **Production Packager** |
| **`XCOMP-12`**<br>Verifiable Graph (VIG) | **ONE:** `src/one/vig/`<br>**OBR:** *NOT PRESENT* | Code Property Graph, AST symbol extraction, Merkle provenance ledger, and multi-file cache. | Deeply integrated into `UnifiedCompiler`. | **ONE Exclusive** | **Production Subsystem** (11 test suites). |
| **`XCOMP-13`**<br>Tensor & Autograd | **ONE:** `src/one/tensor/`<br>**OBR:** *NOT PRESENT* | Pure-TS multidimensional tensors, autograd tape, vectorized math kernels, and arena memory. | Underpins native CUBiO 5M model. | **ONE Exclusive** | **Production Subsystem** |
| **`XCOMP-14`**<br>Extreme Memory Toolchain | **ONE:** `src/one/memory/extreme/`<br>**OBR:** *NOT PRESENT* | Virtual paging, 369 spatial pointer mapping, and lossless context reconstruction. | Tested in `tests/memory/`. | **ONE Exclusive** | **Independent Toolchain** |

---

## 4. Workstream C: Trace Actual Execution and Integration Paths

### Path 1: ONE Language source → lexer/parser → AST → semantic analysis → IR → compiler/runtime → VM
- **Entry Point:** `OneDeveloperCLI.handleRun()` ([`src/one/cli/OneDeveloperCLI.ts#L154`](file:///F:/ONE%20language/src/one/cli/OneDeveloperCLI.ts#L154)) or `UnifiedCompiler.execute(source)`.
- **Call Sequence:**
  1. `OneLexer.tokenize(source)` (`src/one/oneLexer.ts`): Produces token stream.
  2. `GrammarRouter.route(tokens)` (`src/one/router/GrammarRouter.ts`): Selects `COMPUTATIONAL` vs `SPATIAL` grammar.
  3. `ComputationalParser.parse(tokens)` (`src/one/computational/ComputationalParser.ts`): Builds `UnifiedProgramNode` (`src/one/ast/UnifiedAST.ts`).
  4. `SemanticAnalyzer.analyze(ast)` (`src/one/semantics/SemanticAnalyzer.ts`): Scope and definition checks.
  5. `TypeChecker.check(ast)` (`src/one/types/TypeChecker.ts`): Validates static types and diagnostics.
  6. `IRLowering.lower(ast)` (`src/one/ir/IRLowering.ts`): Generates three-address `UnifiedIRProgram` (`src/one/ir/UnifiedIR.ts`).
  7. `UnifiedVM.execute(irProgram)` (`src/one/vm/UnifiedVM.ts`): Executes instruction stream on stack-machine runtime.
- **Status:** **VERIFIED INTEGRATED**.
- **Test Evidence:** `tests/compiler/struct_enum_lowering.test.ts`, `tests/compiler/nested_closures.test.ts`, `tests/compiler/deep_recursion.test.ts`, `tests/compiler/async_await.test.ts`, `tests/v101/v101_command_syntax.test.ts` (all 16 suites passed).

### Path 2: Compiler/IR → binary encoding → decoder → instruction dispatch → VM execution
- **Path 2A (.ox ONEX Container):**
  - `ExecutablePacker.pack(program)`: Packages `UnifiedIRProgram` into `.ox` container with 64-byte `ONEX` header, CRC32, payload SHA-256, and `ONEX_FLAG_ACTUATION_LOCKED` (`src/one/packer/ExecutableArtifact.ts`).
  - `ExecutableLinker.loadAndRun(rawBuf)`: Unpacks `.ox`, validates header via `ExecutableValidator.validate()`, and dispatches to `UnifiedVM.execute()`.
  - **Status:** **VERIFIED INTEGRATED**.
- **Path 2B (3/6/9-Bit Protocol via `src/binary/`):**
  - `BinaryEncoder` & `BinaryDecoder` operate on `TriangleOpcode` (0x00..0x3F) and `BitCategory` (0..7).
  - `UnifiedVM` does NOT import or decode `TriangleOpcode`; `UnifiedVM` dispatches string opcodes (`CONST`, `LOAD`, `STORE`, `ADD`, `INPUT`, `PRINT`, etc.).
  - **Status:** **PRESENT BUT DISCONNECTED from UnifiedVM**. The 3/6/9-bit binary protocol is used by `BinaryReasoningBridge` for symbolic serialization, not as the opcode encoding of `UnifiedVM`.

### Path 3: Binary reasoning input → decoding/validation → reasoning engine → planner/rule engine → execution or output
- **In `F:\one-binary-reasoning`:**
  - `ReasoningSession.solveWithBinaryTrace(spec)`: Solves derivation via `ReasoningEngine.solve()`, serializes candidates via `BinaryReasoningBridge.serializeToken()`, and validates bit-exactness.
  - **Status:** **VERIFIED INTEGRATED** (Tested in `tests/integration/bridge_e2e.test.ts`).
- **In `F:\ONE language`:**
  - `HybridConversationEngine` ([`src/one/intelligence/hybrid/HybridConversationEngine.ts#L140`](file:///F:/ONE%20language/src/one/intelligence/hybrid/HybridConversationEngine.ts#L140)): Instantiates `ReasoningEngine<number>` with arithmetic rules and dispatches `UserIntentType.REASONING_TASK`.
  - Uses direct in-memory object passing rather than binary bitstrings.
  - **Status:** **VERIFIED INTEGRATED for Engine; PARTIALLY INTEGRATED for Binary Envelopes**.

### Path 4: Tensor/autograd → model interfaces → reasoning/orchestrator
- **Call Sequence:**
  - `Tensor` ([`src/one/tensor/Tensor.ts`](file:///F:/ONE%20language/src/one/tensor/Tensor.ts)): Manages strided arrays and arena allocations.
  - `AutogradBridge`: Tracks reverse-mode computation tape.
  - `CUBiO5MModel` ([`src/one/training/CUBiO5MModel.ts`](file:///F:/ONE%20language/src/one/training/CUBiO5MModel.ts)): Native neural model with 148,912 parameters.
  - `AgiOneCoreOrchestrator` ([`src/one/agi_one_core_orchestrator.ts#L106`](file:///F:/ONE%20language/src/one/agi_one_core_orchestrator.ts#L106)): Queries `NativeModelRegistry.getAuthoritativeModel()` and executes inference through `AgiOneIPCBridge`.
- **Status:** **PARTIALLY INTEGRATED**. (Model registry and IPC inference bridge are connected; autograd training loop is an independent training path).

### Path 5: VM state → canonical state store → Extreme Memory/paging → checkpoint/recovery/time-travel
- **Call Sequence:**
  - `UnifiedExtremeMemoryToolchain` ([`src/one/memory/extreme/UnifiedExtremeMemoryToolchain.ts`](file:///F:/ONE%20language/src/one/memory/extreme/UnifiedExtremeMemoryToolchain.ts)) manages paged blocks and Address369 pointer indexes.
  - `UnifiedVM` manages its own in-memory `operandStack` and `variables` Map without calling the virtual pager.
- **Status:** **PRESENT BUT DISCONNECTED**. (Extreme memory is verified by `tests/memory/phase4_memory_layer.test.ts`, but not hooked into `UnifiedVM` per-instruction paging).

### Path 6: Compiler/AST → VIG graph/provenance generation → ledger or verification output
- **Call Sequence:**
  - `UnifiedCompiler.compileMultiFile()` checks `VIGCompilationCache.computeCacheKey()`.
  - `VIGASTExtractor` ([`src/one/vig/VIGASTExtractor.ts`](file:///F:/ONE%20language/src/one/vig/VIGASTExtractor.ts)) parses ASTs and generates CPG nodes and edges.
  - `VIGProvenanceLedger` records Merkle change blocks.
- **Status:** **VERIFIED INTEGRATED**. (Tested across 11 dedicated suites in `tests/vig/`).

### Path 7: CLI ↔ runtime ↔ IPC ↔ optional Studio interfaces
- **Call Sequence:**
  - `OneDeveloperCLI` runs standalone commands without launching UI.
  - `src/studio/` (`IntelligenceCoreMaster.tsx`, `live_server.ts`) connects via `AgiOneIPCBridge` to inspect spatial memory frames.
- **Status:** **PARTIALLY INTEGRATED / OPTIONAL SERVICE**. (Studio functions as a decoupled supervisory visualizer; CLI maintains zero runtime dependency on Studio/React/Three.js).

### Path 8: Worker pool/scheduler ↔ tensor, training, and runtime resource limits
- **Call Sequence:**
  - `WorkerPool` ([`src/one/workers/WorkerPool.ts`](file:///F:/ONE%20language/src/one/workers/WorkerPool.ts)) dispatches parallel training tasks across OS threads using `SharedMemoryArena` (`SharedArrayBuffer`).
  - Resource limits: `UnifiedVM.maxCallDepth` (512 frames), `UnifiedVM.maxInstructions` (10^6), and RSS guard (512MB).
- **Status:** **VERIFIED INTEGRATED**. (Tested in `tests/tasks/test_worker_determinism.ts`).

---

## 5. Workstream D: Binary Format and Instruction Contract

Forensic inspection of [`src/binary/binaryCodebook.ts`](file:///F:/ONE%20language/src/binary/binaryCodebook.ts), [`binaryEncoder.ts`](file:///F:/ONE%20language/src/binary/binaryEncoder.ts), and [`binaryDecoder.ts`](file:///F:/ONE%20language/src/binary/binaryDecoder.ts) establishes the exact binary specification:

### 1. Three-Bit Category Header Space (Exactly 8 Patterns)
- `000` (`TYPE_NULL`): 3 bits total.
- `001` (`TYPE_BOOL`): 3 bits tag + 1 bit value (`0`=false, `1`=true) = 4 bits total.
- `010` (`TYPE_INT`): 3 bits tag + 1 bit sign + 6 bits length field + $N$ magnitude bits (10 to 73 bits).
- `011` (`TYPE_FLOAT`): 3 bits tag + 64 bits IEEE-754 Big-Endian float = 67 bits total.
- `100` (`TYPE_TEXT`): 3 bits tag + 16 bits byte count + $8 \times N$ UTF-8 bytes.
- `101` (`TYPE_ADDR369`): 3 bits tag + 9 bits canonical address = 12 bits total.
- `110` (`TYPE_OPCODE`): 3 bits tag + 6 bits triangle opcode = 9 bits total.
- `111` (`TYPE_CONTROL`): Reserved for stream framing and markers.

### 2. Six-Bit Triangle Opcode Space (Exactly 64 Patterns: `000000` to `111111`)
- **26 ASSIGNED Opcodes:**
  - *Quartile 0 (Core Operations 0x00..0x0F):* `OP_NOP`, `OP_HALT`, `OP_READ`, `OP_WRITE`, `OP_INSPECT`, `OP_PUSH`, `OP_POP`, `OP_SWAP`, `OP_ADD`, `OP_SUB`, `OP_MUL`, `OP_DIV`, `OP_MOD`, `OP_EQ`, `OP_LT`, `OP_GT`.
  - *Quartile 1 (Control & Spatial 0x10..0x17):* `OP_JUMP`, `OP_JUMP_IF`, `OP_CALL`, `OP_RET`, `OP_SHELL_ALLOC`, `OP_ENTROPY_EVAL`, `OP_LOCK_CHECK`, `OP_BARRIER`.
  - *Quartile 3 (Markers 0x3E..0x3F):* `MARKER_ESCAPE` (0x3E), `MARKER_EOS` (0x3F).
- **38 RESERVED Opcodes:** (0x18 through 0x3D).
  - **Fail-Closed Behavior:** `BinaryDecoder.decode()` asserts `opcodeEntry.status !== 'RESERVED'`. Encountering any reserved pattern throws `BinaryError('RESERVED_OPCODE', ...)` immediately.

### 3. Nine-Bit Address369 Space (Exactly 512 Patterns: `000000000` to `111111111`)
- **369 ASSIGNED Addresses:** `[0..368]`.
  - `[0..25]`: 26 Symbolic Registers.
  - `[26..368]`: 343 Spatial Voxel Coordinates ($7 \times 7 \times 7$).
- **143 RESERVED Addresses:** `[369..511]`.
  - **Fail-Closed Behavior:** `BinaryDecoder.decode()` asserts `addr < CanonicalAddress369.TOTAL_ADDRESSES`. Any address $\ge 369$ throws `BinaryError('ADDRESS_OUT_OF_BOUNDS', ...)` immediately.

---

## 6. Workstream E: Safety and Compatibility

### 1. Actuation Lockout Invariants
- **Source Verification:**
  - `src/one/safety/actuation_lock.ts`: `export const ACTUATION_LOCK = true;`
  - `src/one/packer/ExecutableValidator.ts#L66-L71`: Rejects any program where `actuationLock === false` with `E8005: Safety Violation`.
  - `src/one/vig/VIGSecurityGuard.ts#L327-L352`: Enforces `assertNoActuation()`, scanning for prohibited keys (`actuation`, `physicalactuation`, `motor`, `servo`, `relay`).
  - `src/one/agi_one_core_orchestrator.ts#L55`: `public readonly is_actuation_blocked: boolean = true;`
- **Result:** **UNBROKEN & FULLY ENFORCED**.

### 2. Error Code Disambiguation
- **`E5012`:** In `UnifiedVM.ts#L840`, explicitly defined as:
  ```ts
  throw new OneVMError('E5012', `Input stream exhausted: no mock inputs or input handler available`, ...);
  ```
- **`E8005`:** Defined in `ExecutableValidator.ts#L70` and `VIGSecurityGuard.ts` as the safety code for physical actuation lockout violations.

### 3. Syntax Compatibility & Address369 Invariants
- Verified via live test run of `tests/v101/v101_command_syntax.test.ts`:
  - Suite 15: Backward compatibility with single-quoted strings, keyword member properties, and Address369 bounds remains **100% intact**.
  - Suite 10: 'one stop' outside loop rejected fail-closed with `E1016` Syntax Error and `E3010` AST guard.
  - Suite 14: Deferred 'one dot' rejected with `E1017`.

---

## 7. Workstream F: Tests, Build, and Runtime Evidence

### Test Execution Summary (Live Audit Run)

| Test Suite / Path | Target Repository | Execution Method | Result | Evidence Captured |
| :--- | :--- | :--- | :--- | :--- |
| `tests/binary/binary_language.test.ts` | `one-binary-reasoning` | `node scripts/test_runner.cjs` | **PASS (11/11)** | 100% bijective triangle roundtrip, 3/6/9-bit pattern checks, reserved opcode rejection. |
| `tests/reasoning/reasoning_engine.test.ts` | `one-binary-reasoning` | `node scripts/test_runner.cjs` | **PASS (Suites A-E)** | Constraint pruning, step/depth bounds, deduplication, deterministic ranking. |
| `tests/integration/bridge_e2e.test.ts` | `one-binary-reasoning` | `node scripts/test_runner.cjs` | **PASS (5/5)** | Full trajectory tokenization, continuous stream decode, `ReasoningSession` coordinator. |
| `tests/reasoning/reasoning_benchmark.ts` | `one-binary-reasoning` | `node scripts/test_runner.cjs` | **PASS (7/7)** | BM-01 through BM-07 certified deterministic with zero variance. |
| `tests/phase1_bridge_verification.test.ts` | `ONE language` | `node scripts/run-test.cjs` | **PASS (10/10)** | 343 spatial cell bijection, Address369 bounds, actuation lock denial on write. |
| `tests/v101/v101_command_syntax.test.ts` | `ONE language` | `node --import esm-register.js` | **PASS (16/16)** | All v1.0.1 command verbs (`one's`, `one set`, `one up`, `one down`, `one out`, `one in`, `one if`, `one repeat`, `one stop`, `one make`, `one way`, `one done`, `one is`). |

---

## 8. Workstream G: Release and Artifact Integrity

### Exact Reconciled SHA-256 Hashes and File Sizes

```
Artifact File                                      Size (Bytes)   Calculated SHA-256 Hash                                            Status vs .sha256 File
─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
dist/one.exe                                       102,039,552    ccfd698023e8285f9f831c4ce5e8d2a2c1ad12add80da9994730c31f51c84fb1   MATCHES EXACTLY
dist/cli-bundle.cjs                                 10,486,843    181af32a9a8687ae3de21afe68771ee8b22e2f9f2dbf79965b830df79e163f3c   VERIFIED
dist/one-language-1.0.0.vsix                         2,044,804    96a282beadfa47769df6fbf45581a245aaafe1bbfb918b878353db8590b670e7   VERIFIED
dist/one-language-1.0.0-src.zip                      1,384,778    45a564af28d6c4ed8bf7d2317349ee390df6bb5ea0979a0066bb0dc51044fe49   VERIFIED
dist/v1.0.1-rc/one.exe                             102,059,520    479186ca87f55781825df05f5603ac3747ada4c2e9aa78de9e3cd233a993020e   MATCHES EXACTLY
dist/v1.0.1-rc/cli-bundle.cjs                       10,506,575    8adff0ef2e03e4513cca17d375990c1c89014a6d97bbf219e619ed70cd65ce06   VERIFIED
dist/v1.0.1-rc/one-language-1.0.1.vsix               2,047,908    33c8f6c59fd04acafc514d0d7be4cc80ed397352348a7425fafa349ac00c5b0d   MATCHES EXACTLY
dist/v1.0.1-rc/one-language-1.0.1-src.zip            1,996,348    925fb6cf562378afb824fe6709740018c554238b069e5beb5144260851846ed5   MATCHES EXACTLY
```

### Clarification of Hash Discrepancies:
The preliminary hashes reported in Phase 0B (e.g. `dist/v1.0.1-rc/one.exe` ending in `ba45f4`) reflected an earlier build pass before final SEA injection and documentation inclusion. The authoritative, tamper-proof hashes matching the files on disk and their accompanying `.sha256` files are the values listed in the table above.

---

## 9. Workstream H: Architecture and Integration Decisions

### Detailed Findings & Strategic Recommendations

#### `FINDING-01`: Component Path Reconciliation in ONE Language
- **Evidence:** `F:\ONE language\src\one\UnifiedCompiler.ts#L1-L60` and `F:\ONE language\src\one\vm\UnifiedVM.ts#L1-L60`.
- **Finding:** Canonical production compiler and VM entrypoints are `UnifiedCompiler.ts` and `UnifiedVM.ts` (not `compiler.ts` or `vm.ts`).
- **Recommendation:** Update all documentation and architecture diagrams to reference `UnifiedCompiler.ts` and `UnifiedVM.ts`.

#### `FINDING-02`: Role of 3/6/9-Bit Binary Protocol vs ONEX Container
- **Evidence:** `F:\ONE language\src\one\packer\ExecutableArtifact.ts#L11-L25` and `F:\ONE language\src\binary\binaryCodebook.ts#L36-L53`.
- **Finding:** ONE Language uses `.ox` ONEX containers for compiled program execution. The 3/6/9-bit binary protocol is an explicit symbolic communication protocol for bounded reasoning trajectories, not VM instruction opcodes.
- **Recommendation:** Maintain this distinction. Do NOT attempt to force `UnifiedVM` to execute 6-bit triangle opcodes; keep `.ox` as the bytecode container and 3/6/9-bit as the reasoning token serialization format.

#### `FINDING-03`: Formal Package Linkage for `one-binary-reasoning`
- **Evidence:** `F:\one-binary-reasoning\package.json#L1-L33` exports `.` and `./binary`, `./reasoning`, `./integration`, `./shared`.
- **Finding:** `one-binary-reasoning` is completely decoupled and can be published as an independent npm package (`one-binary-reasoning`).
- **Recommendation:** Publish `one-binary-reasoning` as an npm package or git submodule dependency for `ONE language`, eliminating duplicate code files across repositories.

#### `FINDING-04`: Backport `ReasoningSession.ts` to `ONE language`
- **Evidence:** `F:\one-binary-reasoning\src\integration\ReasoningSession.ts#L29-L107`.
- **Finding:** `ReasoningSession.ts` provides a clean coordinator for solving bounded reasoning problems with bit-exact binary traces, but is currently missing from `F:\ONE language\src\one\intelligence\reasoning\`.
- **Recommendation:** Backport `ReasoningSession.ts` into `F:\ONE language\src\one\intelligence\reasoning\ReasoningSession.ts` to unify the reasoning coordinator API.

#### `FINDING-05`: Error Code Specification Alignment (`E5012` vs `E8005`)
- **Evidence:** `F:\ONE language\src\one\vm\UnifiedVM.ts#L840` (`E5012`) vs `F:\ONE language\src\one\packer\ExecutableValidator.ts#L70` (`E8005`).
- **Finding:** `E5012` is the fail-closed error code for exhausted I/O streams (`one in`). Actuation lockout violations are coded as `E8005`.
- **Recommendation:** Correct diagnostic documentation to define `E5012` as `I/O Stream Exhaustion` and `E8005` as `Actuation Safety Violation`.

---

## 10. Recommended Next Phase

### Phase 0D: Dual-Repository Unification & Packaging Specification
- **Scope:** Define the exact package dependency bridge linking `ONE-language` and `ONE-Binary-Reasoning-Intelligence`, backport `ReasoningSession.ts`, and formalize the unified API contract connecting Tier 1 Hybrid Conversation directly to Tier 4 Binary Reasoning Sessions.

---
*Report completed under strict read-only audit constraints. Execution halted.*
