# ONE Intelligence — Cross-Repository Component Inventory

> **Document:** `CROSS_REPOSITORY_COMPONENT_INVENTORY.md`  
> **Mode:** Strict READ-ONLY Forensic Component Audit  
> **Scope:** `F:\ONE language` & `F:\one-binary-reasoning`  
> **Timestamp:** 2026-10-28T12:45:00+05:00  

---

## 1. Inventory Counting & Classification Rules

1. **Dual-Repository Counting Rule:** Components existing in both repositories are assigned a single shared cross-component identifier (`XCOMP-xx`) with both filepaths explicitly documented, preventing double-counting.
2. **Classification Definitions:**
   - **Production:** Authoritative, tested, and actively utilized by the primary toolchain or runtime.
   - **Partially Integrated:** Implemented and functional in isolation, with defined but incomplete runtime bridges to the core VM.
   - **Prototype:** Research or exploratory implementations (e.g. `scratch/` or legacy spatial VMs).
   - **Legacy:** Historical implementations superseded by newer architectures.
   - **Duplicate:** Controlled identical copies between repositories maintained under CI parity testing.
   - **Optional Service:** Decoupled peripheral modules (e.g. 3D Studio, Mesh, OMail) that run without impacting core offline CLI execution.
3. **Integration Status Definitions:**
   - **Verified:** Fully wired into the execution path and validated with passing automated test evidence.
   - **Partial:** Subsystem operational, but some higher-level connections use in-memory adapters or mock transports.
   - **Disconnected:** Implemented module exists, but core runtime execution does not invoke it.
   - **Missing:** Specified architectural concept with no substantive code implementation.

---

## 2. Complete Cross-Repository Component Matrix

| ID | Exact Relative Path(s) | Responsibility & Public Entry Points | Dependencies & Dependents | Related Tests | Test Status | Classification | Integration Status | Evidence Reference |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| **`COMP-01`** | **ONE:** `src/one/oneLexer.ts` | Tokenizes `.one` source streams into typed lexemes. Entry point: `OneLexer.tokenize()`. | Dep: `OneToken`. Used by `GrammarRouter`. | `tests/compiler/struct_enum_lowering.test.ts` | **PASS** | Production | **Verified** | Line 24 in `src/one/oneLexer.ts` |
| **`COMP-02`** | **ONE:** `src/one/router/GrammarRouter.ts` | Dispatches tokens between declarative spatial and computational pipelines. Entry point: `GrammarRouter.route()`. | Dep: `OneLexer`. Used by `ComputationalParser`. | `src/one/test_one_language.ts` | **PASS** | Production | **Verified** | Line 16 in `GrammarRouter.ts` |
| **`COMP-03`** | **ONE:** `src/one/computational/ComputationalParser.ts` | Recursive descent AST parser for statements, structs, functions, loops. Entry point: `ComputationalParser.parse()`. | Dep: `UnifiedAST`. Used by `UnifiedCompiler`. | `tests/v101/v101_command_syntax.test.ts` | **PASS** | Production | **Verified** | Line 45 in `ComputationalParser.ts` |
| **`COMP-04`** | **ONE:** `src/one/types/TypeChecker.ts` | Validates static types, function signatures, and struct shapes. Entry point: `TypeChecker.check()`. | Dep: `UnifiedAST`. Used by `UnifiedCompiler`. | `tests/compiler/struct_enum_lowering.test.ts` | **PASS** | Production | **Verified** | Line 32 in `TypeChecker.ts` |
| **`COMP-05`** | **ONE:** `src/one/ir/IRLowering.ts` | Lowers AST into flat three-address bytecode (`UnifiedIRProgram`). Entry point: `IRLowering.lower()`. | Dep: `UnifiedIR`. Used by `UnifiedCompiler`. | `tests/compiler/nested_closures.test.ts` | **PASS** | Production | **Verified** | Line 58 in `IRLowering.ts` |
| **`COMP-06`** | **ONE:** `src/one/vm/UnifiedVM.ts` | Register-stack virtual machine with call frames, async queues, and safety guards. Entry point: `UnifiedVM.execute()`. | Dep: `UnifiedIR`, `DeterministicNumericOps`. | `tests/compiler/async_await.test.ts` | **PASS** | Production | **Verified** | Line 80 in `UnifiedVM.ts` |
| **`COMP-07`** | **ONE:** `src/one/compiler/LinkerExecutablePacker.ts` | Packages `UnifiedIRProgram` into `.ox` container with 64-byte header and SHA-256. Entry point: `LinkerExecutablePacker.pack()`. | Dep: `UnifiedIR`. Used by `OneDeveloperCLI`. | `tests/compiler/linker_executable_packing.test.ts` | **PASS** | Production | **Verified** | Line 35 in `LinkerExecutablePacker.ts` |
| **`COMP-08`** | **ONE:** `src/one/cli/OneDeveloperCLI.ts` | Developer CLI toolchain (`init`, `run`, `check`, `build`, `format`, `test`). Entry point: `OneDeveloperCLI.run()`. | Dep: `UnifiedCompiler`, `UnifiedVM`. | `tests/cli/developer_cli.test.ts` | **PASS** | Production | **Verified** | Line 40 in `OneDeveloperCLI.ts` |
| **`XCOMP-01`**| **ONE:** `src/one/address369_canonical.ts`<br>**OBR:** `src/shared/address369.ts` | Canonical Address369 map: `[0..25]` symbolic, `[26..368]` spatial grid, `[369..511]` reserved. | Dep: None. Used by all binary and memory modules. | `tests/governance/task26_cross_repository_parity_and_gap_resolution.test.ts` | **PASS** | Production (Duplicate) | **Verified** | Byte-for-byte identical (4,356 bytes) |
| **`XCOMP-02`**| **ONE:** `src/binary/binaryCodebook.ts`<br>**OBR:** `src/binary/binaryCodebook.ts` | 3-bit categories (8), 6-bit triangle opcodes (64), 9-bit ennea words (512). | Dep: `XCOMP-01`. Used by `BinaryDecoder`. | `tests/binary/binary_language.test.ts` | **PASS** | Production (Duplicate) | **Verified** | Parity verified in Task 26 |
| **`XCOMP-03`**| **ONE:** `src/binary/binaryEncoder.ts`<br>**OBR:** `src/binary/binaryEncoder.ts` | Serializes scalar primitives, opcodes, and coordinates into big-endian bitstrings. | Dep: `XCOMP-01`, `triangleMapper`. | `tests/binary/binary_language.test.ts` | **PASS** | Production (Duplicate) | **Verified** | Parity verified in Task 26 |
| **`XCOMP-04`**| **ONE:** `src/binary/binaryDecoder.ts`<br>**OBR:** `src/binary/binaryDecoder.ts` | Fail-closed bitstring deserializer with reserved pattern rejection. | Dep: `XCOMP-02`. Used by bridge. | `tests/binary/binary_language.test.ts` | **PASS** | Production (Duplicate) | **Verified** | Parity verified in Task 26 |
| **`XCOMP-05`**| **ONE:** `src/binary/triangleMapper.ts`<br>**OBR:** `src/binary/triangleMapper.ts` | Bijective 6-bit planar triangle geometry transformation. | Dep: None. Used by `binaryEncoder`. | `tests/binary/binary_language.test.ts` | **PASS** | Production (Duplicate) | **Verified** | Parity verified in Task 26 |
| **`XCOMP-06`**| **ONE:** `src/one/intelligence/reasoning/ReasoningEngine.ts`<br>**OBR:** `src/reasoning/ReasoningEngine.ts` | Bounded forward-chaining state search engine (A* heuristic derivation). | Dep: `RuleRegistry`, `StateExplorer`, `CandidateEvaluator`. | `tests/reasoning/reasoning_engine.test.ts` | **PASS** | Production (Duplicate) | **Verified** | Parity verified in Task 26 |
| **`XCOMP-07`**| **ONE:** `src/one/intelligence/reasoning/ReasoningSession.ts`<br>**OBR:** `src/integration/ReasoningSession.ts` | High-level reasoning coordinator; manages solving loops and binary trace generation. | Dep: `XCOMP-06`, `BinaryReasoningBridge`. | `tests/integration/bridge_e2e.test.ts` | **PASS** | Production (Duplicate) | **Verified** | Parity verified in Task 26 |
| **`COMP-09`** | **ONE:** `src/one/intelligence/reasoning/ModelReasoningAdapter.ts` | Bridges high-level VM reasoning requests to the binary reasoning session. Entry point: `solveGoalWithBinaryTrace()`. | Dep: `ReasoningSession`, `CubiOModel`. | `tests/reasoning/task14_model_reasoning_integration.test.ts` | **PASS** | Production | **Verified** | Line 25 in `ModelReasoningAdapter.ts` |
| **`COMP-10`** | **ONE:** `src/one/tensor/Tensor.ts` | Multidimensional strided tensor arena and vectorized arithmetic. | Dep: None. Used by autograd and CUBiO model. | `tests/tensor/task15_autograd_kernels_wasm.test.ts` | **PASS** | Production | **Verified** | Line 40 in `src/one/tensor/Tensor.ts` |
| **`COMP-11`** | **ONE:** `src/one/memory/extreme/ExtremeMemoryVMAdapter.ts` | 64 KB demand paging, LRU eviction, and lossless context reconstruction. | Dep: `MemoryPageManager`. Used by VM. | `tests/memory/task17_extreme_memory_vm_paging.test.ts` | **PASS** | Production | **Verified** | Line 30 in `ExtremeMemoryVMAdapter.ts` |
| **`COMP-12`** | **ONE:** `src/one/data/TimeTravelStateManager.ts` | Monotonic WAL transaction logging and bit-exact snapshot rollback ($\sigma^2 = 0.0$). | Dep: `CanonicalState`. Used by VM. | `tests/data/task18_canonical_state_time_travel.test.ts` | **PASS** | Production | **Verified** | Line 20 in `TimeTravelStateManager.ts` |
| **`COMP-13`** | **ONE:** `src/one/vig/VIGASTExtractor.ts` | Code property graph builder and Merkle provenance change ledger. | Dep: `UnifiedAST`. Used by `UnifiedCompiler`. | `tests/vig/task21_vig_compiler_provenance.test.ts` | **PASS** | Production | **Verified** | Line 15 in `VIGASTExtractor.ts` |
| **`COMP-14`** | **ONE:** `src/one/agi_one_core_orchestrator.ts` | Master five-tier orchestrator; system lifecycle, health checks, safety policies. | Dep: IPC, model registry, core VM. | `tests/orchestration/task19_five_tier_orchestrator.test.ts` | **PASS** | Production | **Verified** | Line 45 in `agi_one_core_orchestrator.ts` |
| **`COMP-15`** | **ONE:** `src/one/agi_one_ipc_bridge.ts` | Decoupled JSON-RPC IPC bridge with automated `[REDACTED_SECRET]` filtering. | Dep: `EventEmitter`. Used by Studio connector. | `tests/studio/task24_ipc_studio_rendering_interfaces.test.ts` | **PASS** | Production | **Verified** | Line 35 in `agi_one_ipc_bridge.ts` |
| **`COMP-16`** | **ONE:** `src/studio/test_native_3d_memory_studio.ts` | 3D Memory Studio supervisory visualizer; Three.js orbit inspection. | Dep: `COMP-15` (optional IPC). | `tests/studio/task24_ipc_studio_rendering_interfaces.test.ts` | **PASS** | Optional Service | **Verified** | Offline CLI operates without it |
| **`COMP-17`** | **ONE:** `src/mesh/`, `src/net/`, `src/mail/` | Multi-node spatial mesh, CubiODNS, and OMail cryptographic messaging. | Dep: Pure TS network abstractions. | `tests/net/task25_optional_subsystems_mesh_omail_dns_pqc.test.ts` | **PASS** | Optional Service | **Verified** | Standalone offline decoupled |
| **`COMP-18`** | **ONE:** `src/vm/cubioVM.ts` | Legacy spatial prototype VM (7x7x7 grid, entropy metrics, bitAgent). | Dep: Spatial prototype compiler. | `tests/verification.test.ts` | **PASS** | Prototype / Legacy | **Isolated** | Superseded by UnifiedVM |
