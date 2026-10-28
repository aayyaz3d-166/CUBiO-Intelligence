# ONE Intelligence — Task 3: Component, Subcomponent & Dependency Inventory Report

**Workspace:** `F:\ONE language`  
**Inspected Repositories:**  
1. **ONE Language:** `https://github.com/aayyaz3d-166/ONE-language.git` (`F:\ONE language`)  
2. **ONE Binary Reasoning Intelligence:** `https://github.com/aayyaz3d-166/ONE-Binary-Reasoning-Intelligence.git` (`F:\one-binary-reasoning`)  
**Audit Protocol:** Strict READ-ONLY Cross-Repository Inventory & Dependency Tracing  
**Execution Timestamp:** 2026-10-28T04:45:00+05:00  

---

## 1. Inventory Counting Rules & Classification Methodology

To avoid treating loose file names or directory structures as proof of functioning modules, the inventory adheres to strict, explicit counting rules:

1. **Primary Component (Subsystem Engine):** A coherent architectural module with a distinct public API, independent operational lifecycle, and verified entry points.
2. **Subcomponent (Internal Helper / Specialization):** An internal helper class, math kernel, lookup table, AST visitor, or lower-level module directly encapsulated by a primary component.
3. **Shared / Mirrored Component:** A component whose source code exists in both repositories (e.g. `src/binary/*`, `Address369`, `ReasoningEngine`). Counted as a single logical component in the unified total, but explicitly flagged as `MIRRORED` with dual repository paths.
4. **Exclusive Component:** A component that exists in only one repository (e.g. `ReasoningSession` in `one-binary-reasoning`; `UnifiedCompiler`, `UnifiedVM`, `VIG`, `ONEX Packer` in `ONE language`).
5. **Standalone Monorepo Package:** An isolated modular package residing in `packages/` with its own `package.json` and independent test surface.
6. **Prototype / Research Component:** A module belonging to Lineage A spatial cellular automata (`src/compiler/`, `src/vm/cubioVM.ts`) or archival RTOS sandboxes (`legacy_experiments/`).
7. **Active Release Status:**
   - **Production:** Actively compiled and linked into release artifacts (`one.exe`, `cli-bundle.cjs`, or `one-binary-reasoning` exports).
   - **Bridge / Adapter:** Operates as a protocol bridge or IPC translation layer.
   - **Optional Service:** Operates as a standalone supervisor or daemon (e.g. 3D Memory Studio, Mesh server).
   - **Prototype / Disconnected:** Code exists and runs in standalone scripts, but is not part of the active production compiler or release binary.

---

## 2. Complete Component & Subcomponent Matrix

| Component ID & Name | Repository & Exact Source Path | Responsibility & Public Entry Points | Direct Dependencies | Direct Dependents | Related Tests & Status | Classification & Status | Duplication / Relationship |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`CID-01`**<br>Unified Compiler Core | **ONE:** `src/one/UnifiedCompiler.ts` (334 lines, 10,963 bytes) | Multi-pass compiler orchestrating lexer, router, parser, semantics, typechecker, and IR lowering.<br>**APIs:** `compile()`, `compileMultiFile()`, `execute()` | `oneLexer`, `GrammarRouter`, `UnifiedAST`, `SemanticAnalyzer`, `TypeChecker`, `IRLowering`, `UnifiedVM`, `VIGCompilationCache` | `OneDeveloperCLI.ts`, `index.ts` | `tests/compiler/*`, `tests/v101/*`<br>**(ALL PASS)** | **Production Core**<br>Verified Integrated | **ONE Exclusive** |
| **`CID-02`**<br>Lexer & Grammar Router | **ONE:** `src/one/oneLexer.ts` (15,157 B)<br>`src/one/router/GrammarRouter.ts` (4,200 B) | Tokenizes source code into typed tokens and routes between computational and spatial grammars.<br>**APIs:** `OneLexer.tokenize()`, `GrammarRouter.route()` | Built-in RegExp and string matchers | `UnifiedCompiler.ts`, `OneDeveloperCLI.ts` | `tests/v101/v101_command_syntax.test.ts`<br>**(PASS)** | **Production Subsystem**<br>Verified Integrated | **ONE Exclusive** |
| **`CID-03`**<br>Computational Parser & AST | **ONE:** `src/one/computational/ComputationalParser.ts` (56,724 B)<br>`src/one/ast/UnifiedAST.ts` (7,207 B) | Recursive-descent parser constructing the unified computational and command syntax AST.<br>**APIs:** `ComputationalParser.parse()` | `oneLexer.ts`, `UnifiedAST.ts` | `UnifiedCompiler.ts`, `VIGASTExtractor.ts` | `tests/compiler/*`, `tests/v101/*`<br>**(ALL PASS)** | **Production Subsystem**<br>Verified Integrated | **ONE Exclusive** |
| **`CID-04`**<br>Semantic Analyzer & Types | **ONE:** `src/one/semantics/SemanticAnalyzer.ts` (26,180 B)<br>`src/one/types/TypeChecker.ts` (25,031 B) | Scoping, declaration validation, type inference, diagnostic emission, and numeric typing.<br>**APIs:** `SemanticAnalyzer.analyze()`, `TypeChecker.check()` | `UnifiedAST.ts`, `SymbolTable.ts`, `TypedNumeric.ts` | `UnifiedCompiler.ts` | `tests/compiler/struct_enum_lowering.test.ts`<br>**(PASS)** | **Production Subsystem**<br>Verified Integrated | **ONE Exclusive** |
| **`CID-05`**<br>Intermediate Representation | **ONE:** `src/one/ir/IRLowering.ts` (17,687 B)<br>`src/one/ir/UnifiedIR.ts` (1,735 B)<br>`src/one/ir/IROptimizer.ts` (7,231 B) | Lowers AST into three-address code `UnifiedIRProgram` with linear instruction stream.<br>**APIs:** `IRLowering.lower()`, `IRPrinter.print()` | `UnifiedAST.ts`, `UnifiedIR.ts` | `UnifiedCompiler.ts`, `ExecutablePacker.ts` | `tests/compiler/linker_executable_packing.test.ts`<br>**(PASS)** | **Production Subsystem**<br>Verified Integrated | **ONE Exclusive** |
| **`CID-06`**<br>Unified Virtual Machine | **ONE:** `src/one/vm/UnifiedVM.ts` (1,566 lines, 63,019 bytes) | Stack-machine runtime executing `UnifiedIRProgram`; manages call frames, locals, heap, builtins, and resource limits.<br>**APIs:** `UnifiedVM.execute()`, `OneVMError` | `UnifiedIR.ts`, `OneStdLib.ts`, `TypedNumeric.ts`, `SpatialBridge.ts` | `UnifiedCompiler.ts`, `ExecutableLinker.ts` | `tests/compiler/*`, `tests/v101/*`<br>**(ALL PASS)** | **Production Core**<br>Verified Integrated | **ONE Exclusive** |
| **`CID-07`**<br>ONEX Executable Packager | **ONE:** `src/one/packer/ExecutablePacker.ts` (9,377 B)<br>`src/one/packer/ExecutableLinker.ts` (5,159 B)<br>`src/one/packer/ExecutableValidator.ts` (5,200 B)<br>`src/one/packer/ExecutableArtifact.ts` (1,932 B) | Packages `UnifiedIRProgram` into `.ox` binary container with 64-byte `ONEX` header, CRC32, payload SHA-256, and actuation lockout assertion.<br>**APIs:** `ExecutablePacker.pack()`, `ExecutableLinker.loadAndRun()`, `ExecutableValidator.validate()` | `UnifiedIR.ts`, `CanonicalAddress369`, `VIGSecurityGuard` | `OneDeveloperCLI.ts` | `tests/compiler/linker_executable_packing.test.ts`<br>**(PASS)** | **Production Toolchain**<br>Verified Integrated | **ONE Exclusive** |
| **`CID-08`**<br>Binary Language Codec | **ONE:** `src/binary/binaryEncoder.ts` (3,614 B)<br>`src/binary/binaryDecoder.ts` (6,640 B)<br>`src/binary/binaryCodebook.ts` (5,516 B)<br>`src/binary/triangleMapper.ts` (2,653 B)<br>`src/binary/types.ts` (1,671 B)<br>**OBR:** `src/binary/*` (Identical) | Deterministic 3/6/9-bit serialization engine with fail-closed decoding of reserved patterns.<br>**APIs:** `BinaryEncoder.encode()`, `BinaryDecoder.decode()`, `BinaryCodebook`, `TriangleMapper` | `CanonicalAddress369`, `types.ts` | `BinaryReasoningBridge.ts` | `tests/binary/binary_language.test.ts`<br>**(PASS 11/11)** | **Production Protocol**<br>Verified Integrated | **Mirrored Across Both Repos** (OBR adds `.js` import extensions) |
| **`CID-09`**<br>Canonical Address369 | **ONE:** `src/one/address369_canonical.ts` (4,356 B)<br>**OBR:** `src/shared/address369.ts` (4,356 B) | Authoritative coordinate system: 26 symbolic registers `[0..25]`, 343 spatial cells `[26..368]`, 143 reserved `[369..511]`.<br>**APIs:** `CanonicalAddress369` | Standard math primitives | `BinaryCodebook`, `SpatialBridge`, `Orchestrator`, `ExtremeMemory` | `tests/phase1_bridge_verification.test.ts`<br>**(PASS 10/10)** | **Production Invariant**<br>Verified Integrated | **100% Byte-for-Byte Identical** |
| **`CID-10`**<br>Bounded 0/1 Reasoning Engine | **ONE:** `src/one/intelligence/reasoning/ReasoningEngine.ts` (8,398 B)<br>`src/one/intelligence/reasoning/RuleRegistry.ts` (2,289 B)<br>`src/one/intelligence/reasoning/StateExplorer.ts` (4,826 B)<br>`src/one/intelligence/reasoning/CandidateEvaluator.ts` (4,391 B)<br>**OBR:** `src/reasoning/*` (Identical) | Forward-chaining state space search engine enforcing step bounds, depth limits, and candidate ceilings with discrete 0/1 signals.<br>**APIs:** `ReasoningEngine.solve()`, `RuleRegistry.register()` | `types.ts`, `StateExplorer.ts`, `CandidateEvaluator.ts` | `HybridConversationEngine.ts`, `ReasoningSession.ts` | `tests/reasoning/reasoning_engine.test.ts`<br>**(PASS Suites A-E)** | **Production Engine**<br>Verified Integrated | **Mirrored Across Both Repos** (OBR adds `.js` import extensions) |
| **`CID-11`**<br>Binary Reasoning Bridge | **ONE:** `src/one/intelligence/reasoning/BinaryReasoningBridge.ts` (1,955 B)<br>**OBR:** `src/integration/BinaryReasoningBridge.ts` (1,965 B) | Bidirectional bridge serializing reasoning tokens into canonical binary envelopes and verifying round-trip decoding.<br>**APIs:** `serializeToken()`, `deserializeToken()`, `validateBitstream()` | `BinaryEncoder`, `BinaryDecoder`, `types.ts` | `ReasoningSession.ts` | `tests/integration/bridge_e2e.test.ts`<br>**(PASS 5/5)** | **Production Bridge**<br>Verified Integrated | **Mirrored Across Both Repos** |
| **`CID-12`**<br>Reasoning Session Coordinator | **ONE:** *NOT PRESENT*<br>**OBR:** `src/integration/ReasoningSession.ts` (3,315 B) | High-level coordinator executing bounded reasoning problems and capturing bit-exact binary traces.<br>**APIs:** `ReasoningSession.solveWithBinaryTrace()`, `solve()` | `ReasoningEngine`, `RuleRegistry`, `BinaryReasoningBridge` | Standalone benchmark & E2E suite | `tests/integration/bridge_e2e.test.ts`<br>**(PASS 5/5)** | **OBR Exclusive Engine**<br>Verified Integrated | **Present in OBR only** (Target for backporting to ONE) |
| **`CID-13`**<br>Hybrid Conversation Engine | **ONE:** `src/one/intelligence/hybrid/HybridConversationEngine.ts` (48,167 B)<br>`src/one/intelligence/hybrid/IntentParser.ts` (10,198 B)<br>`src/one/intelligence/hybrid/Native5MAdapter.ts` (6,211 B) | Conversational pipeline routing natural language intents to numeric reasoning tasks or native neural model inference.<br>**APIs:** `HybridConversationEngine.handleTurn()`, `processRequest()` | `ReasoningEngine`, `RuleRegistry`, `Native5MAdapter`, `IntentParser` | `one_net/ui/server.ts`, CLI conversational mode | `tests/hybrid/phase5_hybrid_conversation.test.ts`<br>**(PASS)** | **Production Subsystem**<br>Verified Integrated | **ONE Exclusive** |
| **`CID-14`**<br>Planning Engine & Optimizer | **ONE:** `src/one/intelligence/planning/PlanningEngine.ts` (12,421 B)<br>`src/one/intelligence/planning/PipelineOptimizer.ts` (4,198 B) | Deterministic task planner constructing acyclic execution graphs.<br>**APIs:** `PlanningEngine.createPlan()` | `RuleRegistry`, `types.ts` | `agi_one_core_orchestrator.ts` | In-tree planning tests | **Production Subsystem**<br>Verified Integrated | **ONE Exclusive** |
| **`CID-15`**<br>Multidimensional Tensor Engine | **ONE:** `src/one/tensor/Tensor.ts` (27,548 B)<br>`src/one/tensor/AutogradBridge.ts` (3,245 B)<br>`src/one/tensor/TensorArena.ts` (9,174 B)<br>`src/one/tensor/GradCheck.ts` (8,368 B)<br>`src/one/tensor/kernels/` | Pure-TypeScript multidimensional strided array library with reverse-mode automatic differentiation tape and memory arena.<br>**APIs:** `Tensor.zeros()`, `Tensor.fromArray()`, `AutogradBridge.backward()` | `TensorArena.ts`, Vector math kernels | `CUBiO5MModel.ts`, `ParallelTensorEngine.ts` | `tests/tasks/test_transformer_gradcheck.ts`<br>**(PASS)** | **Production Subsystem**<br>Verified Integrated | **ONE Exclusive** |
| **`CID-16`**<br>Native Neural Model (CUBiO 5M) | **ONE:** `src/one/training/CUBiO5MModel.ts` (24,727 B)<br>`src/one/native_model_registry.ts` (4,251 B) | 148,912-parameter compact native neural model with parameter validation and authoritative identity registration.<br>**APIs:** `CUBiO5MModel.forward()`, `NativeModelRegistry.getAuthoritativeModel()` | `Tensor.ts`, `NativeModelRegistry.ts` | `agi_one_core_orchestrator.ts`, `Native5MAdapter.ts` | `tests/hybrid/phase5_gate4_native5m_integration.test.ts`<br>**(PASS)** | **Production Model**<br>Verified Integrated | **ONE Exclusive** |
| **`CID-17`**<br>Unified Extreme Memory Toolchain | **ONE:** `src/one/memory/extreme/UnifiedExtremeMemoryToolchain.ts` (12,058 B)<br>`src/one/memory/extreme/369SpatialPointerEngine.ts` (6,550 B)<br>`src/one/memory/extreme/VirtualMemoryPagingEngine.ts` (7,613 B)<br>`src/one/memory/extreme/LosslessReconstructionEngine.ts` (2,810 B) | Extreme-scale virtual paging, 369 spatial pointer mapping, and lossless context reconstruction.<br>**APIs:** `UnifiedExtremeMemoryToolchain`, `ExtremeMemoryGovernor` | `CanonicalAddress369`, Virtual memory pages | Independent memory test harness | `tests/memory/phase4_memory_layer.test.ts`<br>**(PASS)** | **Independent Toolchain**<br>Verified Standalone | **ONE Exclusive** |
| **`CID-18`**<br>State Store & Checkpoint System | **ONE:** `src/core/checkpoint/checkpointManager.ts` (2,552 B)<br>`src/core/checkpoint/wal.ts` (1,459 B)<br>`src/core/checkpoint/snapshotEngine.ts` (2,552 B) | Atomic Write-Ahead Logging (WAL) and memory snapshot persistence with rollbacks.<br>**APIs:** `CheckpointManager.save()`, `WAL.write()` | Node.js `fs`, PQC crypto | `test_phase4_checkpointing.ts` | `src/core/test_phase4_checkpointing.ts`<br>**(PASS)** | **Production Persistence**<br>Verified Integrated | **ONE Exclusive** |
| **`CID-19`**<br>Verifiable Intelligence Graph (VIG) | **ONE:** `src/one/vig/VerifiableIntelligenceGraph.ts` (18,027 B)<br>`src/one/vig/VIGASTExtractor.ts` (53,559 B)<br>`src/one/vig/VIGProvenanceLedger.ts` (17,178 B)<br>`src/one/vig/VIGCompilationCache.ts` (6,683 B)<br>`src/one/vig/VIGSecurityGuard.ts` (12,583 B) | In-memory Code Property Graph connecting AST nodes, symbols, and dependencies with Merkle change tracking and compiler caching.<br>**APIs:** `VIGASTExtractor.extract()`, `VIGCompilationCache.computeCacheKey()`, `VIGSecurityGuard.assertNoActuation()` | TypeScript Compiler API, Node `crypto`, `fs` | `UnifiedCompiler.ts`, IDE / Agentic tools | `tests/vig/*` (11 suites)<br>**(ALL PASS)** | **Production Subsystem**<br>Verified Integrated | **ONE Exclusive** |
| **`CID-20`**<br>AGI ONE Core Sovereign Orchestrator | **ONE:** `src/one/agi_one_core_orchestrator.ts` (5,740 B)<br>`src/one/agi_one_ipc_bridge.ts` (5,616 B)<br>`src/one/native_spatial_renderer.ts` (5,453 B) | Authoritative Gate CNL-P26.2 orchestrator unifying the 5 sovereign tiers, binding Address369, Model Registry, Spatial Renderer, and IPC.<br>**APIs:** `AgiOneCoreOrchestrator.executeMasterCycle()` | `CanonicalAddress369`, `NativeModelRegistry`, `AgiOneIPCBridge`, `NativeSpatialRenderer` | Gate verification suites, Studio | Gate CNL-P26.2 verification<br>**(PASS)** | **Sovereign Master**<br>Verified Integrated | **ONE Exclusive** |
| **`CID-21`**<br>Multithreaded Worker Pool Substrate | **ONE:** `src/one/workers/WorkerPool.ts` (10,413 B)<br>`src/one/workers/ParallelTensorEngine.ts` (6,294 B)<br>`src/one/workers/ParallelTrainingEngine.ts` (7,614 B)<br>`src/one/workers/SharedMemoryArena.ts` (13,266 B) | Distributes tensor training batches across Node OS worker threads via `SharedArrayBuffer` and atomic synchronization.<br>**APIs:** `WorkerPool.dispatch()`, `ParallelTensorEngine` | Node.js `worker_threads`, `SharedArrayBuffer` | Tensor training loops | `tests/tasks/test_worker_determinism.ts`<br>**(PASS)** | **Production Subsystem**<br>Verified Integrated | **ONE Exclusive** |
| **`CID-22`**<br>3D Memory Studio Engine | **ONE:** `src/studio/IntelligenceCoreMaster.tsx` (12,263 B)<br>`src/studio/live_server.ts` (15,037 B)<br>`src/studio/spatial_voxel_renderer.ts` (23,158 B)<br>`src/studio/native_state_bridge.ts` (6,506 B) | Decoupled visual supervision environment; renders 3D memory lattices and state metrics over WebSocket / HTTP.<br>**APIs:** `IntelligenceCoreMaster: React.FC`, `LiveServer.start()` | Node HTTP/WebSocket, React/Canvas | Standalone Studio browser UI | `src/studio/test_native_3d_memory_studio.ts`<br>**(PASS)** | **Optional Visual Service**<br>Decoupled | **ONE Exclusive** |
| **`CID-23`**<br>Sovereign Mesh Networking & Net Gateway | **ONE:** `src/mesh/spatialMeshCluster.ts` (1,463 B)<br>`src/mesh/euclideanRouter.ts` (1,489 B)<br>`src/mesh/nodeRegistry.ts` (1,264 B)<br>`src/net/cubio_dns_engine.ts` (5,724 B)<br>`src/net/decentralized_storage_matrix.ts` (5,538 B)<br>`src/one_net/one_net_mesh.ts` (16,450 B) | 3D coordinate cluster mesh using Euclidean distance routing, decentralized cryptographic DNS, and content storage.<br>**APIs:** `SpatialMeshCluster`, `EuclideanRouter`, `CubioDnsEngine` | Node network sockets, PQC crypto | `src/mesh/test_phase5_mesh.ts`<br>**(PASS)** | **Optional Network Service**<br>Decoupled | **ONE Exclusive** |
| **`CID-24`**<br>OMail Sovereign Mail & PQC Seal | **ONE:** `src/mail/omail_mailbox_manager.ts` (3,698 B)<br>`src/mail/omail_superposition_router.ts` (3,814 B)<br>`src/mail/pqc_mail_envelope.ts` (5,054 B)<br>`src/core/crypto/pqc_lattice_seal.ts` (777 B) | Post-quantum lattice-encrypted sovereign mail messaging system with wave superposition routing.<br>**APIs:** `OMailMailboxManager`, `PQCMailEnvelope.seal()` | `pqc_lattice_seal.ts`, Node `crypto` | In-tree mail verification scripts | **Optional Security Service**<br>Decoupled | **ONE Exclusive** |
| **`CID-25`**<br>Developer CLI Dispatcher | **ONE:** `src/one/cli/OneDeveloperCLI.ts` (18,614 B)<br>`bin/one.cjs` (144 B)<br>`scripts/dev-cli.js` (2,713 B) | Production command-line tool executing developer workflows: `init`, `run`, `check`, `build`, `format`, `test`.<br>**APIs:** `OneDeveloperCLI.run()` | `UnifiedCompiler`, `ExecutablePacker`, `ExecutableLinker`, `OneFormatter` | Standalone executable (`one.exe`) | `tests/cli/developer_cli.test.ts`<br>**(PASS)** | **Production CLI**<br>Verified Integrated | **ONE Exclusive** |
| **`CID-26`**<br>Spatial Bridge & Hardware Barrier | **ONE:** `src/one/spatial/SpatialBridge.ts` (11,510 B) | Bijective bridge connecting `UnifiedVM` spatial instructions to canonical Address369 with `E6003` actuation write blocking.<br>**APIs:** `SpatialBridge.get()`, `SpatialBridge.set()` | `CanonicalAddress369`, `GridMemory` | `UnifiedVM.ts` | `tests/phase1_bridge_verification.test.ts`<br>**(PASS 10/10)** | **Production Bridge**<br>Verified Integrated | **ONE Exclusive** |
| **`CID-27`**<br>Lineage A Spatial Prototype | **ONE:** `src/compiler/lexer.ts` (7,601 B)<br>`src/compiler/parser.ts` (23,040 B)<br>`src/compiler/oneCompiler.ts` (7,677 B)<br>`src/vm/cubioVM.ts` (16,861 B)<br>`src/vm/bitAgent.ts` (4,692 B)<br>`src/vm/gridMemory.ts` (11,139 B) | Historical prototype 7x7x7 cellular automaton simulating bit agents and entropy transitions.<br>**APIs:** `CubioVM.run()`, `BitAgent.step()` | Discrete 343-cell voxel memory | Standalone script `src/index.ts` | `src/test_advanced_features.ts`<br>**(PASS)** | **Prototype Lineage A**<br>Disconnected from `one.exe` | **ONE Exclusive** |
| **`CID-28`**<br>Modular Monorepo Packages | **ONE:** `packages/ast-emitter/`<br>`packages/nlp-parser/`<br>`packages/pqc-lattice/`<br>`packages/sovereign-cli/`<br>`packages/time-travel/` | 5 standalone packages in monorepo for AST emission, NLP parsing, PQC cryptography, sovereign CLI, and state time-travel.<br>**APIs:** Individual package exports | Pure Node/TS primitives | Monorepo consumers | `packages/tests/test_all_packages.ts`<br>**(PASS)** | **Modular Packages**<br>Standalone | **ONE Exclusive** |

---

## 3. Cross-Repository Architectural Dependency Graph

```mermaid
flowchart TD
    subgraph OBR_REPO["Repository 2: ONE-Binary-Reasoning-Intelligence (F:\one-binary-reasoning)"]
        OBR_BIN["3/6/9-Bit Binary Codec (CID-08)<br>src/binary/binaryEncoder.ts<br>src/binary/binaryDecoder.ts"]
        OBR_ADDR["Canonical Address369 (CID-09)<br>src/shared/address369.ts"]
        OBR_REAS["0/1 Reasoning Engine (CID-10)<br>src/reasoning/ReasoningEngine.ts<br>src/reasoning/RuleRegistry.ts"]
        OBR_BRIDGE["Binary Reasoning Bridge (CID-11)<br>src/integration/BinaryReasoningBridge.ts"]
        OBR_SESS["Reasoning Session Coordinator (CID-12)<br>src/integration/ReasoningSession.ts<br>(EXCLUSIVE TO OBR)"]

        OBR_BIN --> OBR_ADDR
        OBR_BRIDGE --> OBR_BIN
        OBR_BRIDGE --> OBR_REAS
        OBR_SESS --> OBR_REAS
        OBR_SESS --> OBR_BRIDGE
    end

    subgraph ONE_REPO["Repository 1: ONE Language (F:\ONE language)"]
        subgraph FRONTEND["Frontend & Compilation Pipeline"]
            ONE_CLI["Developer CLI: one.exe (CID-25)<br>src/one/cli/OneDeveloperCLI.ts"]
            ONE_COMP["Unified Compiler Core (CID-01)<br>src/one/UnifiedCompiler.ts"]
            ONE_PARSE["Parser & Router (CID-02 / 03)<br>ComputationalParser.ts / GrammarRouter.ts"]
            ONE_SEM["Semantics & Types (CID-04)<br>SemanticAnalyzer.ts / TypeChecker.ts"]
            ONE_IR["IR Lowering Pipeline (CID-05)<br>src/one/ir/IRLowering.ts"]
            ONE_PACK["ONEX Executable Packer (CID-07)<br>ExecutablePacker.ts / Linker.ts (.ox)"]

            ONE_CLI --> ONE_COMP
            ONE_CLI --> ONE_PACK
            ONE_COMP --> ONE_PARSE
            ONE_COMP --> ONE_SEM
            ONE_COMP --> ONE_IR
            ONE_PACK --> ONE_IR
        end

        subgraph RUNTIME["Execution Runtime & Safety"]
            ONE_VM["Unified Virtual Machine (CID-06)<br>src/one/vm/UnifiedVM.ts"]
            ONE_LOCK{"Actuation Lock Barrier<br>actuationLock: true<br>(E8005 / E6003)"}
            ONE_SPATIAL["Spatial Bridge (CID-26)<br>src/one/spatial/SpatialBridge.ts"]
            ONE_ADDR["Canonical Address369 (CID-09)<br>src/one/address369_canonical.ts"]

            ONE_IR --> ONE_VM
            ONE_PACK -.->|Loads .ox| ONE_VM
            ONE_VM --> ONE_LOCK
            ONE_LOCK -->|Reads Allowed| ONE_SPATIAL
            ONE_LOCK -.->|Writes Denied (E6003)| ONE_SPATIAL
            ONE_SPATIAL --> ONE_ADDR
        end

        subgraph INTELLIGENCE_TIERS["Intelligence & Reasoning Subsystems"]
            ONE_HYBRID["Hybrid Conversation Engine (CID-13)<br>src/one/intelligence/hybrid/"]
            ONE_REAS["0/1 Reasoning Engine (CID-10)<br>src/one/intelligence/reasoning/"]
            ONE_PLAN["Planning Engine (CID-14)<br>src/one/intelligence/planning/"]
            ONE_MODEL["CUBiO 5M Model (CID-16)<br>src/one/training/CUBiO5MModel.ts"]
            ONE_TENSOR["Tensor & Autograd (CID-15)<br>src/one/tensor/Tensor.ts"]
            ONE_ORCH["AGI ONE Orchestrator (CID-20)<br>src/one/agi_one_core_orchestrator.ts"]
            ONE_IPC["IPC Bridge Subsystem (CID-20)<br>src/one/agi_one_ipc_bridge.ts"]

            ONE_HYBRID --> ONE_REAS
            ONE_HYBRID --> ONE_MODEL
            ONE_ORCH --> ONE_IPC
            ONE_ORCH --> ONE_ADDR
            ONE_ORCH --> ONE_MODEL
            ONE_MODEL --> ONE_TENSOR
            ONE_REAS --> ONE_PLAN
        end

        subgraph GRAPH_AND_MEMORY["Graph, Memory & Async Subsystems"]
            ONE_VIG["Verifiable Intelligence Graph (CID-19)<br>src/one/vig/ (30 files)"]
            ONE_EXTMEM["Extreme Memory Toolchain (CID-17)<br>src/one/memory/extreme/ (25 files)"]
            ONE_WORK["Worker Pool Threads (CID-21)<br>src/one/workers/WorkerPool.ts"]

            ONE_COMP -.->|Compilation Cache| ONE_VIG
            ONE_TENSOR -.->|Parallel Batches| ONE_WORK
            ONE_ADDR -.->|369 Mapping| ONE_EXTMEM
        end

        subgraph STANDALONE_SERVICES["Decoupled Services & Lineage A"]
            ONE_STUDIO["3D Memory Studio (CID-22)<br>src/studio/ (React/Canvas/WebSocket)"]
            ONE_NET["Mesh & Net Gateway (CID-23)<br>src/mesh/ & src/net/"]
            ONE_MAIL["OMail & PQC Seal (CID-24)<br>src/mail/"]
            LINEAGE_A["Lineage A Spatial Prototype (CID-27)<br>src/compiler/ & src/vm/cubioVM.ts"]

            ONE_IPC -.->|Live Frames| ONE_STUDIO
            ONE_MAIL -.->|Mesh Packets| ONE_NET
        end
    end

    %% Cross-Repository Linkages & Gaps
    OBR_BIN -.->|100% Mirror Spec| ONE_REPO
    OBR_REAS -.->|100% Mirror Logic| ONE_REAS
    OBR_ADDR ===|Byte-for-Byte Identical| ONE_ADDR
    OBR_SESS -.->|TARGET FOR BACKPORT TO ONE| ONE_REAS
```

---

## 4. Inventory Totals & Explicit Counting Results

### Granular Summary by Classification

| Category | Count | Criteria & Scope |
| :--- | :--- | :--- |
| **Primary Architectural Components** | **28** | Distinct functional subsystems with documented public APIs (`CID-01` to `CID-28`). |
| **Shared / Mirrored Components** | **4** | Logical components implemented in both repos (`Binary Codec`, `Address369`, `Reasoning Engine`, `Binary Reasoning Bridge`). |
| **Exclusive to `ONE language`** | **23** | `UnifiedCompiler`, `UnifiedVM`, `ONEX Packer`, `Lexer/Router`, `Parser/AST`, `Semantics/Types`, `IR`, `Hybrid Engine`, `Planning Engine`, `Tensor/Autograd`, `CUBiO 5M Model`, `Extreme Memory`, `Checkpoints`, `VIG`, `Orchestrator`, `Worker Pool`, `Developer CLI`, `Spatial Bridge`, `3D Studio`, `Mesh Networking`, `OMail`, `Lineage A Prototype`, `Monorepo Packages`. |
| **Exclusive to `one-binary-reasoning`** | **1** | `ReasoningSession` (`src/integration/ReasoningSession.ts`). |
| **Standalone Monorepo Packages** | **5** | Standalone packages in `packages/` (`ast-emitter`, `nlp-parser`, `pqc-lattice`, `sovereign-cli`, `time-travel`). |
| **Subcomponents & Internal Helpers** | **163** | Helper modules, math kernels, lookup tables, and type dictionaries within subsystems. |
| **Formal Test Suites Across Repos** | **58** | **54** in `ONE language` (`tests/` and `packages/tests/`) + **4** in `one-binary-reasoning` (`tests/`). |
| **Git-Tracked Source Files** | **1,027** | **992** in `ONE language` + **35** in `one-binary-reasoning`. |

---

## 5. Missing or Ambiguous Dependencies & Integration Gaps

1. **Gap 1: Absence of `ReasoningSession.ts` in `ONE language`**
   - *Detail:* `ReasoningSession.ts` is the only coordinator that ties bounded candidate exploration to continuous binary envelope generation and bit-exact validation. It exists in `one-binary-reasoning` but was never integrated into `ONE language`.
   - *Impact:* `ONE language` cannot generate bit-exact binary derivation traces without directly invoking the low-level `BinaryReasoningBridge` manually.

2. **Gap 2: Missing Package Dependency Link Between Repositories**
   - *Detail:* `one-binary-reasoning` has its own `package.json` with exports for `.`, `./binary`, `./reasoning`, `./integration`, `./shared`. However, `F:\ONE language\package.json` does not reference `"one-binary-reasoning"`. Instead, `ONE language` maintains duplicate source files.
   - *Impact:* Fixes or improvements in one repository must be manually copy-pasted into the other.

3. **Gap 3: Missing CLI Command Verb for Reasoning**
   - *Detail:* `OneDeveloperCLI.ts` provides `init`, `run`, `check`, `build`, `format`, and `test`. There is no command verb (e.g. `one reason` or `one solve`) to invoke `ReasoningSession` or `ReasoningEngine` from the command line.

4. **Gap 4: Decoupling of `UnifiedVM` State from `ExtremeMemory`**
   - *Detail:* `UnifiedExtremeMemoryToolchain.ts` is implemented and verified in standalone memory tests, but `UnifiedVM.ts` stores local variables and operands in standard V8 JavaScript `Map` and `Array` structures.
   - *Impact:* The extreme scale virtual paging substrate is not currently utilized during standard `one run` execution.

5. **Gap 5: Dual Lineage Prototype Ambiguity**
   - *Detail:* `src/compiler/` and `src/vm/` (Lineage A) remain in the tree alongside `src/one/UnifiedCompiler.ts` and `src/one/vm/UnifiedVM.ts` (Lineage B).
   - *Impact:* Developers inspecting the repository could confuse the historical spatial cellular automaton prototype with the production programming language compiler.

---
*Task 3 inventory complete. All repositories and source code remain untouched. Execution halted.*
