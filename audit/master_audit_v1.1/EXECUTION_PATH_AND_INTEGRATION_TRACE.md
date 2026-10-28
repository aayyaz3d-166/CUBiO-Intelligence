# ONE Intelligence — Execution Path & Integration Trace Audit

> **Document:** `EXECUTION_PATH_AND_INTEGRATION_TRACE.md`  
> **Mode:** Strict READ-ONLY Forensic Execution Path Tracing  
> **Scope:** `F:\ONE language` & `F:\one-binary-reasoning`  
> **Timestamp:** 2026-10-28T12:45:00+05:00  

---

## 1. Architectural Distinction: ONEX Container vs. 3/6/9-Bit Binary Protocol

A critical architectural distinction verified during this forensic audit:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        CORE BINARY ARCHITECTURE RECONCILIATION                         │
├──────────────────────────────────────────┬─────────────────────────────────────────────┤
│ 1. ONEX (.ox) Container Format           │ 2. 3/6/9-Bit Binary Language Protocol       │
├──────────────────────────────────────────┼─────────────────────────────────────────────┤
│ • Role: Compiled executable distribution │ • Role: Symbolic reasoning serialization    │
│ • Container: 64-byte binary header       │ • Format: Continuous big-endian bitstream   │
│   (Magic 0x4F4E4558, flags, entrypoint,  │   (3-bit category, 6-bit planar triangle    │
│   section table, payload SHA-256)        │   opcode, 9-bit Address369 pointer)         │
│ • VM Relation: Direct container loaded   │ • VM Relation: Independent symbolic format  │
│   and executed by UnifiedVM              │   bridged via ModelReasoningAdapter         │
│ • Target: File storage & native linking  │ • Target: Real-time reasoning trajectories  │
└──────────────────────────────────────────┴─────────────────────────────────────────────┘
```
**Conclusion:** The 3/6/9-bit binary protocol is **NOT** the instruction encoding of `UnifiedVM`. `UnifiedVM` dispatches structured intermediate representation instructions (`CONST`, `LOAD`, `STORE`, `ADD`, `INPUT`, etc.) packaged in `.ox` containers. The two formats are orthogonal, purpose-built, and correctly decoupled.

---

## 2. Detailed Trace of Paths A through J

### Path A: ONE Source $\to$ Lexer $\to$ AST $\to$ Semantics $\to$ IR $\to$ UnifiedVM
- **Entry Point:** [`OneDeveloperCLI.handleRun()`](file:///F:/ONE%20language/src/one/cli/OneDeveloperCLI.ts#L154) or `UnifiedCompiler.execute()`.
- **Function Call Sequence:**
  1. `OneLexer.tokenize(source)`: Generates `OneToken[]`.
  2. `GrammarRouter.route(tokens)`: Routes to `ComputationalParser`.
  3. `ComputationalParser.parse(tokens)`: Constructs `UnifiedProgramNode` AST.
  4. `SemanticAnalyzer.analyze(ast)`: Validates variable declarations and scopes.
  5. `TypeChecker.check(ast)`: Static type validation (`E2001` on mismatch).
  6. `IRLowering.lower(ast)`: Emits three-address `UnifiedIRProgram`.
  7. `UnifiedVM.execute(irProgram)`: Executes bytecode on call-frame stack engine.
- **Data Contract:** `string` (source) $\to$ `OneToken[]` $\to$ `UnifiedProgramNode` $\to$ `UnifiedIRProgram` $\to$ `VMValue`.
- **Validation Points:** Semicolon checks (`E2002`), sealed struct mutation (`E5008`), recursion depth guard $\le 512$ (`E5006`), instruction budget $\le 10^6$ (`E5007`).
- **Tests & Result:** `test:struct_enum`, `test:closures`, `test:recursion`, `test:async`, `test:v101` $\to$ **PASS (100%)**.

### Path B: UnifiedIRProgram $\to$ ONEX Packing $\to$ Validation $\to$ Loading $\to$ Execution
- **Entry Point:** [`LinkerExecutablePacker.pack()`](file:///F:/ONE%20language/src/one/compiler/LinkerExecutablePacker.ts#L35) / `ExecutableLinker.loadAndRun()`.
- **Function Call Sequence:**
  1. `LinkerExecutablePacker.pack(program)`: Computes payload SHA-256, constructs 64-byte header (`ONEX_MAGIC = 0x4F4E4558`, version 1, flags with `ACTUATION_LOCK`).
  2. `ExecutableValidator.validate(buffer)`: Validates magic (`E8001`), version (`E8002`), header CRC (`E8003`), SHA-256 (`E8004`), actuation lock flag (`E8005`).
  3. `ExecutableLinker.unpack(buffer)`: Deserializes section table into `UnifiedIRProgram`.
  4. `UnifiedVM.execute(program)`: Executes instructions directly from container.
- **Data Contract:** `UnifiedIRProgram` $\leftrightarrow$ `Uint8Array` (.ox container) $\to$ `UnifiedVM`.
- **Validation Points:** Header magic bytes, SHA-256 digest, actuation lock flag in byte 48.
- **Tests & Result:** `test:packing` (12/12 suites) $\to$ **PASS (100%)**.

### Path C: Reasoning Request $\to$ BinaryReasoningBridge $\to$ Protocol $\to$ Result
- **Entry Point:** [`ReasoningSession.solveWithBinaryTrace()`](file:///F:/ONE%20language/src/one/intelligence/reasoning/ReasoningSession.ts#L45).
- **Function Call Sequence:**
  1. `ReasoningSession.solveWithBinaryTrace(spec)`: Initializes `StateExplorer` and `RuleRegistry`.
  2. `ReasoningEngine.solve(spec)`: Executes A* heuristic search across registered rules.
  3. `BinaryReasoningBridge.serializeToken()`: Converts derivation candidate states into 3/6/9-bit bitstrings using `BinaryEncoder`.
  4. `BinaryDecoder.decode()`: Parses continuous bitstream back into structured states; verifies bit-exact identity ($\sigma^2 = 0.0$).
- **Data Contract:** `ReasoningProblemSpec<T>` $\to$ `DerivationTrace<T>` $\to$ `string` (continuous bitstream) $\to$ `ReasoningResultBundle`.
- **Validation Points:** Big-endian framing, reserved opcode rejection (`RESERVED_OPCODE`), candidate budget ceiling.
- **Tests & Result:** `tests/integration/bridge_e2e.test.ts` (OBR) & `test:task13` (ONE) $\to$ **PASS (100%)**.

### Path D: Hybrid Reasoning $\to$ Model Registry $\to$ CUBiO Model $\to$ Planner
- **Entry Point:** [`ModelReasoningAdapter.solveGoalWithBinaryTrace()`](file:///F:/ONE%20language/src/one/intelligence/reasoning/ModelReasoningAdapter.ts#L30).
- **Function Call Sequence:**
  1. `ModelReasoningAdapter` queries `NativeModelRegistry.getAuthoritativeModel()`.
  2. Validates certified parameter count (148,912 parameters).
  3. Instantiates `ReasoningSession` and passes neural heuristic bounds to rule evaluator.
  4. Reconstructs plan into VM-callable instructions.
- **Tests & Result:** `test:task14`, `test:task16` $\to$ **PASS (100%)**.

### Path E: Tensor/Autograd $\to$ Training Pipeline $\to$ Checkpoints
- **Entry Point:** [`src/one/tensor/AutogradBridge.ts`](file:///F:/ONE%20language/src/one/tensor/AutogradBridge.ts) / `src/core/training/`.
- **Function Call Sequence:**
  1. `Tensor.create()` allocates contiguous buffer in typed array arena.
  2. Operation records computational graph node on backward tape.
  3. `AutogradBridge.backward()` computes reverse-mode gradients via chain rule.
  4. Pretraining scheduler writes loss checkpoint to WAL.
- **Tests & Result:** `test:task15`, `test:step63_64`, `test:step65_66`, `test:step67_68` $\to$ **PASS (100%)**.

### Path F: VM State $\to$ Extreme Memory Paging $\to$ Canonical State $\to$ Time-Travel
- **Entry Point:** [`ExtremeMemoryVMAdapter`](file:///F:/ONE%20language/src/one/memory/extreme/ExtremeMemoryVMAdapter.ts) & [`TimeTravelStateManager`](file:///F:/ONE%20language/src/one/data/TimeTravelStateManager.ts).
- **Function Call Sequence:**
  1. VM variable access triggers 64 KB page lookup via `MemoryPageManager`.
  2. Page faults dynamically load or evict blocks while maintaining physical RSS $< 512$ MB.
  3. State change triggers `TimeTravelStateManager.recordStep()` appending to monotonic WAL.
  4. Rollback via `TimeTravelStateManager.rollbackTo(snapshotId)` restores exact heap state ($\sigma^2 = 0.0$).
- **Tests & Result:** `test:task17`, `test:task18` $\to$ **PASS (100%)**.

### Path G: Compiler/AST $\to$ VIG Graph $\to$ Provenance Ledger
- **Entry Point:** [`src/one/vig/VIGASTExtractor.ts`](file:///F:/ONE%20language/src/one/vig/VIGASTExtractor.ts).
- **Function Call Sequence:**
  1. AST nodes are mapped into Code Property Graph (CPG) nodes and edges.
  2. Hashes computed for incremental caching (`VIGCompilationCache`).
  3. Merkle ledger links build state to Git commit anchor (`0x369_SEAL`).
- **Tests & Result:** `test:task21` (7 suites) $\to$ **PASS (100%)**.

### Path H: CLI/Runtime $\leftrightarrow$ IPC $\leftrightarrow$ Optional Studio
- **Entry Point:** [`AgiOneIPCBridge.sendMessage()`](file:///F:/ONE%20language/src/one/agi_one_ipc_bridge.ts).
- **Function Call Sequence:**
  1. Core runtime emits JSON-RPC framed telemetry.
  2. IPC bridge redacts sensitive tokens (`[REDACTED_SECRET]`).
  3. Dispatches to Studio client if connected; silently drops frames if disconnected (fail-soft).
- **Tests & Result:** `test:task24` (88 assertions) $\to$ **PASS (100%)**.

### Path I: Worker Pool/Scheduler $\leftrightarrow$ Resource Guards
- **Entry Point:** [`WorkerPool.dispatch()`](file:///F:/ONE%20language/src/one/workers/WorkerPool.ts).
- **Function Call Sequence:**
  1. Distributes parallel work using 64-byte aligned `SharedArrayBuffer` memory.
  2. Enforces physical 512 MB RSS ceiling; recovers from worker termination cleanly.
- **Tests & Result:** `test:task22` (7 suites) $\to$ **PASS (100%)**.

### Path J: Optional Services $\leftrightarrow$ Core Runtime Offline Decoupling
- **Entry Point:** `OneDeveloperCLI.run()`.
- **Validation:** CLI compiles and runs `.one` source files with 0 network calls, 0 socket binds, and 0 external service dependencies. Optional services (Mesh, DNS, OMail) execute only when explicitly invoked.
- **Tests & Result:** `test:task25` (166 assertions) $\to$ **PASS (100%)**.
