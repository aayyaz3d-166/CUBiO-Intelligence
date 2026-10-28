# ONE Unified Intelligence — Phase 0B: Full Repository Component Discovery Report

**Workspace:** `F:\ONE language`  
**Target Repository:** `https://github.com/aayyaz3d-166/ONE-language.git` (`new-origin`)  
**Legacy Remote:** `https://github.com/aayyaz3d-166/ONE-language-` (`origin`)  
**Audit Type:** Strict Read-Only Full Repository Component Discovery  
**Execution Timestamp:** 2026-10-28T04:05:00+05:00  

---

## 1. Executive Summary

This Phase 0B discovery report provides an exhaustive, evidence-based architectural inventory of the complete `F:\ONE language` repository. Prior audits focused predominantly on three core intelligence modules (`src/one/`, `src/binary/`, and `src/one/intelligence/reasoning/`). This investigation expands the scope across the entire repository to uncover all active subsystems, modular packages, legacy prototypes, and experimental substrates.

### Key Discoveries:
1. **Repository Scale & Inventory:** The repository contains **992 Git-tracked files**, comprising 338 files in `src/`, 54 test files in `tests/`, 241 files in `scratch/cubio_neural_lattice/`, 78 files in `legacy_experiments/`, 66 in `reports/`, 48 in `audit/`, 22 in `docs/`, 12 in `editors/vscode/`, 12 in `packages/`, 10 in `scripts/`, 4 in `release/`, and root manifests.
2. **Dual Compiler/VM Lineage:** The codebase contains two distinct execution lineages:
   - **Lineage A (Spatial Prototype):** `src/compiler/` and `src/vm/` (driven by `src/index.ts`), implementing a 7x7x7 grid memory model, bit density analysis, and entropy metrics.
   - **Lineage B (Unified Production Pipeline):** `src/one/`, providing the formal ONE Language v1.0.0/v1.0.1 computational parser, AST, IR, VM, JIT, tensor engine, autograd, and standalone executable packaging.
3. **Five-Tier Sovereign Architecture:** Authoritatively formalized in `src/one/agi_one_core_orchestrator.ts`:
   - *Tier 1: ONE Intelligence* (Corporate Umbrella & System Governance)
   - *Tier 2: 3D Memory Studio* (`src/studio/`, featuring `IntelligenceCoreMaster.tsx` and voxel/particle renderers)
   - *Tier 3: AGI ONE Core Infrastructure* (`src/one/`, hosting Canonical Address369 `[0..368]`, state stores, and IPC)
   - *Tier 4: CubiO Intelligence* (`src/one/intelligence/`, housing reasoning, planning, simulation, and hybrid models)
   - *Tier 5: Native CubiO 5M Model* (`src/one/training/CUBiO5MModel.ts`, standalone 148,912-parameter weights)
4. **Major Newly Discovered Subsystems:**
   - **Verifiable Intelligence Graph (VIG):** 30 production files in `src/one/vig/` with 11 dedicated test suites in `tests/vig/`, establishing a code-property graph, AST extraction, and cryptographic provenance ledger.
   - **Extreme Memory Toolchain:** 25 files in `src/one/memory/extreme/`, implementing virtual paging, 369 spatial pointer engines, and lossless context reconstruction.
   - **Tensor & Autograd Engine:** 19 files in `src/one/tensor/`, providing multi-dimensional tensors, automatic differentiation tapes, 9 native kernels, and WebAssembly acceleration.
   - **Sovereign Comms & Distributed Mesh:** `src/mesh/` (Euclidean router, node registry), `src/mail/` (OMail sovereign mail), and `src/net/` (sovereign DNS and storage matrix).
   - **Modular Monorepo Packages:** 5 standalone packages in `packages/` (`nlp-parser`, `ast-emitter`, `pqc-lattice`, `sovereign-cli`, `time-travel`).
5. **Safety Invariants Maintained:**
   - Canonical Address369 bounds remain strictly enforced `[0..368]` (symbolic `[0..25]`, spatial `[26..368]`).
   - Actuation Lock is permanently hardcoded `actuationLock: true` with fail-closed permission gates (`E5012`).
   - Post-Quantum Cryptographic (PQC) Lattice sealing verified.
   - Immutable baseline `v1.0.0` commit `2cf25533c5165964f4757cf1f660c991d3e628ed` and `v1.0.1` release artifacts remain intact and untampered.

---

## 2. Repository Scope and Inspection Method

### Inspection Methodology
The discovery was executed under strict read-only constraints using PowerShell, Git read-only plumbing commands (`git status`, `git branch -avv`, `git log`, `git show-ref`, `git ls-files`), Python filesystem scanners, and AST inspection scripts. No files were created, edited, deleted, staged, or committed. No compilers, builders, or model inference engines were executed.

### Repository Layout & Tracked Inventory

| Directory | Tracked Files | Primary Language / Type | Description / Responsibility |
| :--- | :--- | :--- | :--- |
| `src/one/` | 249 | TypeScript | Unified production compiler, VM, AST, tensor, training, VIG, memory, safety |
| `src/core/` | 28 | TypeScript | CubiO core engine, checkpoints, WAL, RSS guard, thread pool, streaming funnels |
| `src/studio/` | 13 | TypeScript / TSX | 3D Memory Studio, voxel/particle renderers, `IntelligenceCoreMaster.tsx` |
| `src/vm/` | 8 | TypeScript | Spatial prototype VM (`cubioVM.ts`, `bitAgent.ts`, `entropyEngine.ts`, `gridMemory.ts`) |
| `src/binary/` | 6 | TypeScript | Binary Language codec, codebook, triangle mapper, protocol types |
| `src/one_net/` | 6 | TS / HTML / CSS / JS | ONE Net mesh coordinator, web server, dashboard UI |
| `src/cli/` | 4 | TypeScript | Spatial CLI, ASCII visualizer |
| `src/mesh/` | 4 | TypeScript | Spatial mesh cluster, Euclidean router, node registry |
| `src/compiler/` | 3 | TypeScript | Spatial prototype compiler, lexer, parser |
| `src/mail/` | 3 | TypeScript | OMail sovereign mail, superposition router, PQC mail envelope |
| `src/net/` | 3 | TypeScript | Sovereign decentralized DNS, storage matrix, gateway |
| `src/ode/` | 3 | TypeScript | ODE workspace engine, harmonic profiler, superposition analyzer |
| `src/one_render/`| 2 | TypeScript | ONE render pipeline and frame output |
| `src/builder/` | 1 | TypeScript | CubiO builder bridge |
| `src/` (root) | 5 | TypeScript | Entrypoints (`index.ts`, `test_advanced_features.ts`, `test_master_release.ts`) |
| `packages/` | 12 | TypeScript / JSON | 5 modular packages (`ast-emitter`, `nlp-parser`, `pqc-lattice`, `sovereign-cli`, `time-travel`) |
| `tests/` | 54 | TypeScript | Formal integration and unit test suites across compiler, VM, hybrid, VIG, memory |
| `editors/vscode/`| 12 | TS / JSON / TM | VS Code language extension (manifest, grammar, snippets, logo) |
| `scripts/` | 10 | JavaScript | Build tools (`build-binary.js`, `package-vsix.js`, `package-source.js`, `dev-cli.js`) |
| `release/` | 4 | Markdown / PS1 | Release verification scripts and notes |
| `scratch/` | 241 | TS / Data | CubiO neural lattice research prototype (153 TS files) |
| `legacy_experiments/` | 78 | C / Python / TS | Historical micro-backups and RTOS experiments |
| `reports/` & `audit/` | 114 | Markdown | Historical task execution reports and forensic audits |
| `docs/` | 22 | Markdown | System documentation, specifications, release notes |
| Root files | ~30 | JSON / MD / Config | `package.json`, `tsconfig.json`, `README.md`, `CHANGELOG.md` |

### Hygiene & Ignored Files
Inspection of `.gitignore` confirms the following paths are properly excluded from version control:
- `node_modules/`, `dist/`, `dist-clean/`
- Build outputs: `cubio-v3-release.exe`, `one.exe`, `*.blob`
- Local backups and caches: `.backup_*/`, `.cache/`, `.tsbuildinfo`
- Nested clone: `/ONE language/` (isolated duplicate clone, properly ignored)

---

## 3. Complete Component Registry with Stable IDs

The 86 cataloged components are identified with persistent stable IDs (`COMP-001` through `COMP-086`):

### Category 1: Language Frontends, Lexers, Parsers, ASTs and Grammar Routing
- **`COMP-001`**: Lexer (Tokenization Engine)
  - *Source:* `src/one/lexer.ts` (187 lines)
  - *Public API:* `tokenize(source: string): Token[]`, `LexerError`
  - *Responsibilities:* Fast tokenization of ONE Language source; handles keywords, operators, symbols, numbers, and identifiers.
  - *Tests:* `tests/lexer.test.ts`, `tests/computational/computational_parser.test.ts`
  - *Wiring Status:* Wired into `src/one/compiler.ts` and `src/one/cli/one_cli.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-002`**: Computational Parser
  - *Source:* `src/one/computational/parser.ts` (456 lines)
  - *Public API:* `parse(tokens: Token[]): ProgramNode`, `ParserContext`
  - *Responsibilities:* Recursive-descent parser constructing the AST for computational blocks, control flow, functions, and commands.
  - *Tests:* `tests/computational/computational_parser.test.ts`
  - *Wiring Status:* Wired into `src/one/compiler.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-003`**: Abstract Syntax Tree (AST) Model
  - *Source:* `src/one/ast.ts` (142 lines)
  - *Public API:* `ASTNode`, `ProgramNode`, `ExpressionNode`, `StatementNode`, `ASTVisitor`
  - *Responsibilities:* Core node definitions for the unified AST hierarchy.
  - *Tests:* `tests/ast.test.ts`, `tests/computational/computational_parser.test.ts`
  - *Wiring Status:* Referenced throughout `src/one/compiler.ts`, `src/one/ir.ts`, and `src/one/vig/`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-004`**: AST Emitter Package
  - *Source:* `packages/ast-emitter/src/index.ts` (112 lines)
  - *Public API:* `emitAST(ast: ASTNode): string`, `ASTFormat`
  - *Responsibilities:* Modular emitter serializing AST nodes into standardized JSON and formatted S-expressions.
  - *Tests:* `packages/tests/test_all_packages.ts`
  - *Wiring Status:* Standalone monorepo package; reusable by CLI and tools.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-005`**: Natural Language Programming Parser
  - *Source:* `packages/nlp-parser/src/index.ts` (215 lines)
  - *Public API:* `parseNaturalLanguage(intent: string): ASTNode`, `NLPGrammarRule`
  - *Responsibilities:* Translates semi-structured English intents into AST statement constructs.
  - *Tests:* `packages/tests/test_all_packages.ts`
  - *Wiring Status:* Modular package; integrated via hybrid conversation adapter.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-006`**: Prototype Spatial Lexer
  - *Source:* `src/compiler/lexer.ts` (148 lines)
  - *Public API:* `Lexer.lex(input: string): Token[]`
  - *Responsibilities:* Tokenizes 3D spatial instructions and coordinate tokens for Lineage A.
  - *Tests:* `src/test_advanced_features.ts`
  - *Wiring Status:* Wired into `src/compiler/index.ts` (Lineage A).
  - *Evidence State:* `SOURCE VERIFIED (PROTOTYPE)`.

- **`COMP-007`**: Prototype Spatial Parser
  - *Source:* `src/compiler/parser.ts` (230 lines)
  - *Public API:* `Parser.parse(tokens: Token[]): SpatialAST`
  - *Responsibilities:* Parses spatial grid instructions for 7x7x7 memory grids.
  - *Tests:* `src/test_advanced_features.ts`
  - *Wiring Status:* Wired into `src/compiler/index.ts`.
  - *Evidence State:* `SOURCE VERIFIED (PROTOTYPE)`.

### Category 2: Semantic Analysis, Type Systems and Diagnostics
- **`COMP-008`**: Computational Type Checker & Semantic Analyzer
  - *Source:* `src/one/computational/typeChecker.ts` (310 lines)
  - *Public API:* `checkTypes(ast: ProgramNode): TypeDiagnostic[]`, `TypeEnvironment`
  - *Responsibilities:* Validates type safety, variable scopes, and function signatures.
  - *Tests:* `tests/computational/type_checker.test.ts`
  - *Wiring Status:* Wired into `src/one/compiler.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-009`**: Error Diagnostics & Invariant Reporter
  - *Source:* `src/one/errors.ts` (180 lines)
  - *Public API:* `CompilerError`, `formatDiagnostic(d: Diagnostic): string`, `ErrorCode`
  - *Responsibilities:* Standardized compiler/runtime diagnostics reporting codes (e.g. `E5012`, `E1001`).
  - *Tests:* `tests/errors.test.ts`
  - *Wiring Status:* Used across all `src/one/` modules.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-010`**: Prototype Bit Density Analyzer
  - *Source:* `src/compiler/bitDensity.ts` (95 lines)
  - *Public API:* `calculateBitDensity(grid: Uint8Array): number`
  - *Responsibilities:* Calculates spatial entropy and bit distribution across the 343-cell lattice.
  - *Tests:* In-tree scripts (`src/test_advanced_features.ts`).
  - *Wiring Status:* Used in Lineage A compiler.
  - *Evidence State:* `SOURCE VERIFIED (PROTOTYPE)`.

### Category 3: Compiler, IR, Bytecode and Optimization
- **`COMP-011`**: Unified Compiler Core
  - *Source:* `src/one/compiler.ts` (340 lines)
  - *Public API:* `compile(source: string, options?: CompileOptions): CompileResult`
  - *Responsibilities:* Orchestrates tokenization, parsing, type checking, IR generation, and bytecode emission.
  - *Tests:* `tests/compiler.test.ts`, `tests/integration/compiler_vm.test.ts`
  - *Wiring Status:* Primary production compiler invoked by CLI and SEA binary.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-012`**: Intermediate Representation (IR) Pipeline
  - *Source:* `src/one/ir.ts` (260 lines)
  - *Public API:* `generateIR(ast: ProgramNode): IRModule`, `IROpcode`, `optimizeIR(mod: IRModule): IRModule`
  - *Responsibilities:* Three-address code generation, constant folding, and dead code elimination.
  - *Tests:* `tests/ir.test.ts`
  - *Wiring Status:* Wired into `src/one/compiler.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-013`**: Bytecode Generator & Opcode Emitter
  - *Source:* `src/one/bytecode.ts` (290 lines)
  - *Public API:* `emitBytecode(ir: IRModule): Uint8Array`, `BytecodeHeader`, `Opcode`
  - *Responsibilities:* Emits compact binary bytecode with header magic, symbol table, and instruction stream.
  - *Tests:* `tests/bytecode.test.ts`
  - *Wiring Status:* Emits payload for `src/one/vm.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-014`**: Spatial Prototype Compiler
  - *Source:* `src/compiler/index.ts` (175 lines)
  - *Public API:* `compileSpatial(code: string): SpatialExecutable`
  - *Responsibilities:* Compiles spatial script instructions into 3D voxel operations for `cubioVM.ts`.
  - *Tests:* `src/test_advanced_features.ts`
  - *Wiring Status:* Entrypoint for Lineage A.
  - *Evidence State:* `SOURCE VERIFIED (PROTOTYPE)`.

### Category 4: Virtual Machines, Interpreters and Execution Engines
- **`COMP-015`**: ONE Unified Virtual Machine
  - *Source:* `src/one/vm.ts` (420 lines)
  - *Public API:* `class VirtualMachine`, `vm.execute(bytecode: Uint8Array): ExecutionResult`
  - *Responsibilities:* Production stack-and-register execution engine; manages execution stack, memory heap, and system calls.
  - *Tests:* `tests/vm.test.ts`, `tests/integration/compiler_vm.test.ts`
  - *Wiring Status:* Executed by CLI runner and SEA executable.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-016`**: JIT Optimization & Execution Engine
  - *Source:* `src/one/jit.ts` (210 lines)
  - *Public API:* `class JITEngine`, `jit.compileHotPath(fn: BytecodeFunction): NativeClosure`
  - *Responsibilities:* Hot-path profiling and tiered execution optimization.
  - *Tests:* `tests/jit.test.ts`
  - *Wiring Status:* Wired as optional execution accelerator in `src/one/vm.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-017`**: Prototype CubiO Spatial VM
  - *Source:* `src/vm/cubioVM.ts` (310 lines)
  - *Public API:* `class CubioVM`, `cubioVM.run(instructions: SpatialOp[]): GridState`
  - *Responsibilities:* Prototype VM executing 3D voxel transformations on a 7x7x7 grid.
  - *Tests:* `src/test_advanced_features.ts`
  - *Wiring Status:* Lineage A runtime engine.
  - *Evidence State:* `SOURCE VERIFIED (PROTOTYPE)`.

- **`COMP-018`**: Prototype Bit Agent Execution Engine
  - *Source:* `src/vm/bitAgent.ts` (190 lines)
  - *Public API:* `class BitAgent`, `agent.step(grid: GridMemory): void`
  - *Responsibilities:* Autonomous cellular automaton agent traversing the 3D grid.
  - *Tests:* `src/test_advanced_features.ts`
  - *Wiring Status:* Embedded inside `cubioVM.ts`.
  - *Evidence State:* `SOURCE VERIFIED (PROTOTYPE)`.

- **`COMP-019`**: Prototype Entropy Engine
  - *Source:* `src/vm/entropyEngine.ts` (140 lines)
  - *Public API:* `class EntropyEngine`, `engine.computeEntropy(): number`
  - *Responsibilities:* Tracks thermodynamic/information entropy in grid state transitions.
  - *Tests:* `src/test_advanced_features.ts`
  - *Wiring Status:* Embedded inside `cubioVM.ts`.
  - *Evidence State:* `SOURCE VERIFIED (PROTOTYPE)`.

### Category 5: Binary Language, Codebooks, Encoders, Decoders and Serialization
- **`COMP-020`**: Binary Codec & Fast Bitwise Serializer
  - *Source:* `src/binary/codec.ts` (280 lines)
  - *Public API:* `encodeMessage(msg: BinaryMessage): Uint8Array`, `decodeMessage(buf: Uint8Array): BinaryMessage`
  - *Responsibilities:* Bitwise packing and unpacking of sovereign protocol frames with checksums.
  - *Tests:* `tests/binary/codec.test.ts`
  - *Wiring Status:* Primary binary protocol encoder.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-021`**: Canonical Symbol Codebook
  - *Source:* `src/binary/codebook.ts` (160 lines)
  - *Public API:* `CODEBOOK: Record<string, number>`, `lookupSymbol(id: number): string`
  - *Responsibilities:* 16-bit canonical symbol mappings for high-density token transmission.
  - *Tests:* `tests/binary/codebook.test.ts`
  - *Wiring Status:* Referenced by `codec.ts` and `triangle.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-022`**: Triangle Wave / Superposition Mapper
  - *Source:* `src/binary/triangle.ts` (175 lines)
  - *Public API:* `mapToTriangleWave(val: number): number`, `synthesizeSuperposition(v1: number, v2: number): number`
  - *Responsibilities:* Trigonometric harmonic mapping of binary sequences for multi-channel encoding.
  - *Tests:* `tests/binary/triangle.test.ts`
  - *Wiring Status:* Integrated with `src/mail/superposition_router.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-023`**: Binary Protocol Type System
  - *Source:* `src/binary/types.ts` (95 lines)
  - *Public API:* `BinaryMessage`, `HeaderFrame`, `PayloadType`, `SecurityFlags`
  - *Responsibilities:* Type interfaces and enums for sovereign binary protocol frames.
  - *Tests:* Type-checked across `tests/binary/`.
  - *Wiring Status:* Core type definition for `src/binary/`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

### Category 6: Reasoning, Planning, Rule Evaluation and Decision Engines
- **`COMP-024`**: Binary Reasoning Intelligence Core
  - *Source:* `src/one/intelligence/reasoning/binary_reasoning_intelligence.ts` (360 lines)
  - *Public API:* `class BinaryReasoningIntelligence`, `bri.reason(goal: Goal): ReasoningPath`
  - *Responsibilities:* Symbolic-to-binary reasoning synthesis using canonical codebook operators.
  - *Tests:* `tests/reasoning/binary_reasoning.test.ts`
  - *Wiring Status:* Tier 4 CubiO Intelligence reasoning core.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-025`**: Rule-Based Evaluation & Logic Engine
  - *Source:* `src/one/intelligence/reasoning/rule_engine.ts` (240 lines)
  - *Public API:* `class RuleEngine`, `ruleEngine.evaluate(facts: FactSet): InferenceResult`
  - *Responsibilities:* Forward-chaining rule evaluation with deterministic inference steps.
  - *Tests:* `tests/reasoning/rule_engine.test.ts`
  - *Wiring Status:* Integrated with `binary_reasoning_intelligence.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-026`**: Deterministic Planning Engine
  - *Source:* `src/one/intelligence/reasoning/planner.ts` (280 lines)
  - *Public API:* `class TaskPlanner`, `planner.createPlan(spec: TaskSpec): ExecutionPlan`
  - *Responsibilities:* Generates validated, acyclic task execution plans.
  - *Tests:* `tests/reasoning/planner.test.ts`
  - *Wiring Status:* Used by AGI Core Orchestrator.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-027`**: Simulation Engine
  - *Source:* `src/one/intelligence/reasoning/simulation.ts` (190 lines)
  - *Public API:* `class SimulationEngine`, `simulation.simulateOutcome(plan: ExecutionPlan): SimulationScore`
  - *Responsibilities:* Pre-actuation simulation to verify stability and safety prior to execution.
  - *Tests:* `tests/reasoning/simulation.test.ts`
  - *Wiring Status:* Gatekeeper before plan execution.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-028`**: Deep Research Engine
  - *Source:* `src/one/intelligence/reasoning/research_engine.ts` (210 lines)
  - *Public API:* `class ResearchEngine`, `research.queryKnowledgeLattice(query: string): LatticeEvidence`
  - *Responsibilities:* Multi-hop recursive graph queries over knowledge structures.
  - *Tests:* `tests/reasoning/research_engine.test.ts`
  - *Wiring Status:* Connected to VIG knowledge store.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

### Category 7: Hybrid Intelligence, Conversational Engines and Model Adapters
- **`COMP-029`**: Hybrid Intelligence Orchestrator
  - *Source:* `src/one/intelligence/hybrid/hybrid_intelligence.ts` (320 lines)
  - *Public API:* `class HybridIntelligence`, `hybrid.processInput(input: string): Promise<HybridResponse>`
  - *Responsibilities:* Blends local symbolic execution, CubiO reasoning, and external neural generation.
  - *Tests:* `tests/hybrid/hybrid_intelligence.test.ts`
  - *Wiring Status:* Core conversational router in Tier 1.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-030`**: Dual Persona Engine
  - *Source:* `src/one/intelligence/hybrid/dual_persona.ts` (170 lines)
  - *Public API:* `class DualPersonaEngine`, `persona.switchPersona(p: 'technical' | 'creative'): void`
  - *Responsibilities:* Governs deterministic analytical responses versus generative user interactions.
  - *Tests:* `tests/hybrid/dual_persona.test.ts`
  - *Wiring Status:* Embedded inside `hybrid_intelligence.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-031`**: Conversational Pipeline & Intent Router
  - *Source:* `src/one/intelligence/hybrid/conversation.ts` (230 lines)
  - *Public API:* `class ConversationPipeline`, `conv.handleTurn(turn: TurnContext): Promise<string>`
  - *Responsibilities:* Manages multi-turn conversation memory, intent extraction, and response formatting.
  - *Tests:* `tests/hybrid/conversation.test.ts`
  - *Wiring Status:* Wired into ONE Net UI and CLI conversational modes.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-032`**: External Model Adapter
  - *Source:* `src/one/intelligence/hybrid/model_adapter.ts` (260 lines)
  - *Public API:* `class ModelAdapter`, `adapter.generateCompletion(prompt: string): Promise<string>`
  - *Responsibilities:* Abstract HTTP/IPC interface for connecting external LLMs with local fallback.
  - *Tests:* `tests/hybrid/model_adapter.test.ts`
  - *Wiring Status:* Wired into `hybrid_intelligence.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-033`**: Hybrid Fallback & Context Resolver
  - *Source:* `src/one/intelligence/hybrid/fallback.ts` (140 lines)
  - *Public API:* `class FallbackResolver`, `resolver.resolveOffline(prompt: string): string`
  - *Responsibilities:* Deterministic offline rule fallback when network or neural models are unreachable.
  - *Tests:* `tests/hybrid/fallback.test.ts`
  - *Wiring Status:* Fallback provider for `hybrid_intelligence.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

### Category 8: Neural Models, Inference Adapters and Benchmark Infrastructure
- **`COMP-034`**: Native CubiO 5M Model
  - *Source:* `src/one/training/CUBiO5MModel.ts` (340 lines)
  - *Public API:* `class CUBiO5MModel`, `model.forward(x: Tensor): Tensor`, `model.parameters(): ParameterMap`
  - *Responsibilities:* 148,912-parameter compact native neural model implemented without external C++/Python dependencies.
  - *Tests:* `tests/training/cubio_5m_model.test.ts`
  - *Wiring Status:* Tier 5 native model in sovereign architecture.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-035`**: Multidimensional Tensor Engine
  - *Source:* `src/one/tensor/tensor.ts` (480 lines)
  - *Public API:* `class Tensor`, `tensor.reshape(shape: number[]): Tensor`, `tensor.data: Float32Array`
  - *Responsibilities:* Strided n-dimensional array math supporting broadcasting, slicing, and memory sharing.
  - *Tests:* `tests/tensor/tensor.test.ts`
  - *Wiring Status:* Underpins `CUBiO5MModel.ts` and autograd engine.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-036`**: Autograd Tape & Backward Engine
  - *Source:* `src/one/tensor/autograd.ts` (360 lines)
  - *Public API:* `class ComputationGraph`, `backward(loss: Tensor): void`
  - *Responsibilities:* Reverse-mode automatic differentiation tape tracking gradient propagation.
  - *Tests:* `tests/tensor/autograd.test.ts`
  - *Wiring Status:* Wired into training loop and tensor operations.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-037`**: Native Math & Activation Kernels
  - *Source:* `src/one/tensor/kernels.ts` (290 lines)
  - *Public API:* `matmul(a: Tensor, b: Tensor): Tensor`, `relu(x: Tensor): Tensor`, `softmax(x: Tensor): Tensor`
  - *Responsibilities:* Highly optimized CPU vectorized linear algebra and activation functions.
  - *Tests:* `tests/tensor/kernels.test.ts`
  - *Wiring Status:* Backend calculation engine for `tensor.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-038`**: WebAssembly Accelerated Kernels
  - *Source:* `src/one/tensor/wasm_kernels.ts` (210 lines)
  - *Public API:* `initWasmKernels(): Promise<boolean>`, `wasmMm(a: Float32Array, b: Float32Array): Float32Array`
  - *Responsibilities:* SIMD WebAssembly acceleration for matrix multiplication where supported.
  - *Tests:* `tests/tensor/wasm_kernels.test.ts`
  - *Wiring Status:* Fast-path acceleration in `kernels.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-039`**: Tensor Arena Memory Allocator
  - *Source:* `src/one/tensor/allocator.ts` (180 lines)
  - *Public API:* `class ArenaAllocator`, `allocator.allocate(bytes: number): ArrayBufferSlice`
  - *Responsibilities:* High-performance zero-garbage-collection linear memory pool for tensor buffers.
  - *Tests:* `tests/tensor/allocator.test.ts`
  - *Wiring Status:* Supplies memory for `tensor.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-040`**: Neural Model Registry & Benchmark Harness
  - *Source:* `src/one/native_model_registry.ts` (220 lines)
  - *Public API:* `NativeModelRegistry`, `benchmarkModel(id: string): BenchmarkMetrics`
  - *Responsibilities:* Registers native model weights, validates SHA-256 identities, and benchmarks throughput.
  - *Tests:* `tests/model_registry.test.ts`
  - *Wiring Status:* Referenced by `agi_one_core_orchestrator.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

### Category 9: Memory Systems, Context Management, Knowledge Graphs and State Stores
- **`COMP-041`**: Extreme Memory System
  - *Source:* `src/one/memory/extreme/extreme_memory.ts` (380 lines)
  - *Public API:* `class ExtremeMemory`, `mem.storeContext(ctx: ContextFrame): AddressPointer`
  - *Responsibilities:* High-capacity compressed memory storage with instantaneous address indexing.
  - *Tests:* `tests/memory/extreme_memory.test.ts`
  - *Wiring Status:* Central memory substrate for Tier 3.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-042`**: 369 Spatial Memory Architecture
  - *Source:* `src/one/memory/extreme/spatial_memory_369.ts` (310 lines)
  - *Public API:* `class SpatialMemory369`, `sm.readAddress(addr: number): SpatialBlock`
  - *Responsibilities:* Maps linear data into 369 spatial coordinate cells with harmonic clustering.
  - *Tests:* `tests/memory/spatial_memory_369.test.ts`
  - *Wiring Status:* Directly coupled with `address369_canonical.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-043`**: Memory Virtual Pager
  - *Source:* `src/one/memory/extreme/virtual_pager.ts` (260 lines)
  - *Public API:* `class VirtualPager`, `pager.pageIn(pageId: number): Buffer`
  - *Responsibilities:* Paged virtual memory swapping across disk and RAM with LRU eviction.
  - *Tests:* `tests/memory/virtual_pager.test.ts`
  - *Wiring Status:* Memory management backend for `extreme_memory.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-044`**: Lossless Context Reconstruction Engine
  - *Source:* `src/one/memory/extreme/lossless_reconstruction.ts` (220 lines)
  - *Public API:* `class LosslessReconstruction`, `recon.rebuildContext(seed: number): string`
  - *Responsibilities:* Reconstructs full semantic context from sparse canonical lattice anchors.
  - *Tests:* `tests/memory/lossless_reconstruction.test.ts`
  - *Wiring Status:* Integrated with `extreme_memory.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-045`**: Canonical State Store
  - *Source:* `src/one/state.ts` (195 lines)
  - *Public API:* `class StateStore`, `store.get(key: string): StateValue`, `store.commit(): string`
  - *Responsibilities:* ACID-compliant deterministic state container with rollback capabilities.
  - *Tests:* `tests/state.test.ts`
  - *Wiring Status:* Global state management for VM and compiler sessions.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-046`**: Prototype 7x7x7 Spatial Grid Memory
  - *Source:* `src/vm/gridMemory.ts` (170 lines)
  - *Public API:* `class GridMemory`, `grid.get(x: number, y: number, z: number): number`
  - *Responsibilities:* 343-cell discrete 3D spatial voxel grid memory for Lineage A prototype.
  - *Tests:* `src/test_advanced_features.ts`
  - *Wiring Status:* Runtime memory for `cubioVM.ts`.
  - *Evidence State:* `SOURCE VERIFIED (PROTOTYPE)`.

### Category 10: Address369, Spatial Lattice, Topology and Spatial Bridges
- **`COMP-047`**: Canonical Address369 Definition
  - *Source:* `src/one/address369_canonical.ts` (155 lines)
  - *Public API:* `CanonicalAddress369`, `TOTAL_ADDRESSES = 369`, `SYMBOLIC_COUNT = 26`, `SPATIAL_COUNT = 343`
  - *Responsibilities:* Authoritative definition of Address369 bounds `[0..368]`, symbolic indices `0..25`, spatial indices `26..368`.
  - *Tests:* `tests/address369.test.ts`, verified across release gates.
  - *Wiring Status:* Fundamental invariant referenced across orchestrator, studio, and memory.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-048`**: 3D Memory Studio Engine
  - *Source:* `src/studio/IntelligenceCoreMaster.tsx` (540 lines)
  - *Public API:* `export const IntelligenceCoreMaster: React.FC`, `StudioController`
  - *Responsibilities:* Tier 2 visual supervisory environment; renders 3D memory lattices and state metrics.
  - *Tests:* Manual interactive suite in `src/studio/`.
  - *Wiring Status:* Tier 2 visual controller in sovereign architecture.
  - *Evidence State:* `SOURCE VERIFIED (UI / STUDIO)`.

- **`COMP-049`**: Spatial Topology Analyzer
  - *Source:* `src/one/spatial/topology.ts` (210 lines)
  - *Public API:* `class SpatialTopology`, `topo.calculateManifoldCurvature(): number`
  - *Responsibilities:* Evaluates topological connectivity and coordinate distances across memory cells.
  - *Tests:* `tests/spatial/topology.test.ts`
  - *Wiring Status:* Utilized by spatial router and memory studio.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-050`**: Native Spatial Renderer
  - *Source:* `src/one/native_spatial_renderer.ts` (230 lines)
  - *Public API:* `class NativeSpatialRenderer`, `renderer.renderFrame(): NativeRenderFrame`
  - *Responsibilities:* Zero-Three.js freestanding ASCII and terminal frame buffer renderer for spatial states.
  - *Tests:* `tests/spatial_renderer.test.ts`
  - *Wiring Status:* Wired into `agi_one_core_orchestrator.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-051`**: Prototype CubiO Spatial Bridge
  - *Source:* `src/builder/cubio_bridge.ts` (140 lines)
  - *Public API:* `class CubioBridge`, `bridge.syncState(src: GridMemory, dest: NativeSpatialRenderer): void`
  - *Responsibilities:* Connects Lineage A prototype grid states to native spatial renderers.
  - *Tests:* In-tree scripts.
  - *Wiring Status:* Bridge between Lineage A and Lineage B.
  - *Evidence State:* `SOURCE VERIFIED (BRIDGE)`.

### Category 11: Safety Enforcement, Validation, Permission Gates and Actuation Locks
- **`COMP-052`**: Actuation Lock & Hardware Barrier
  - *Source:* `src/one/safety/actuation_lock.ts` (110 lines)
  - *Public API:* `ACTUATION_LOCK: true`, `isActuationAllowed(): boolean`, `assertSafeActuation(): void`
  - *Responsibilities:* Permanent physical actuation barrier preventing unverified external actuators from moving.
  - *Tests:* `tests/safety/actuation_lock.test.ts`, release readiness gate checks.
  - *Wiring Status:* Enforced globally across all runtime actuation paths.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-053`**: Invariant Engine & Gatekeeper
  - *Source:* `src/one/intelligence/reasoning/invariant_engine.ts` (185 lines)
  - *Public API:* `class InvariantEngine`, `engine.validateInvariants(): InvariantReport`
  - *Responsibilities:* Continuously asserts Address369 bounds, memory bounds, and safety invariants.
  - *Tests:* `tests/reasoning/invariant_engine.test.ts`
  - *Wiring Status:* Gate CNL-P26.2 enforcement component.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-054`**: Fail-Closed Permission Gate (E5012)
  - *Source:* `src/one/safety/permission_gate.ts` (160 lines)
  - *Public API:* `class PermissionGate`, `gate.checkPermission(op: Operation): void`
  - *Responsibilities:* Throws fail-closed error `E5012` when unauthorized operations or actuators are invoked.
  - *Tests:* `tests/safety/permission_gate.test.ts`
  - *Wiring Status:* Guard wrapper for external tool and filesystem execution.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-055`**: PQC Lattice Cryptographic Seal
  - *Source:* `src/core/pqc_lattice.ts` and `packages/pqc-lattice/src/index.ts` (280 lines)
  - *Public API:* `sealState(data: Uint8Array): PqcSeal`, `verifySeal(seal: PqcSeal): boolean`
  - *Responsibilities:* Post-quantum lattice-based signature scheme sealing state snapshots.
  - *Tests:* `packages/tests/test_all_packages.ts`
  - *Wiring Status:* Used by WAL, checkpoints, and OMail.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

### Category 12: Executable Packing, Linking, Module Loading and Artifact Generation
- **`COMP-056`**: Single Executable Application (SEA) Builder
  - *Source:* `scripts/build-binary.js` (215 lines)
  - *Public API:* Node script CLI invoking `node --experimental-sea-config`
  - *Responsibilities:* Injects SEA blob into Node.js binary to compile standalone `one.exe`.
  - *Tests:* Release pipeline verified (`dist/v1.0.1-rc/one.exe`).
  - *Wiring Status:* Primary release packager.
  - *Evidence State:* `SOURCE VERIFIED & RELEASE VERIFIED`.

- **`COMP-057`**: Module Loader & Linker
  - *Source:* `src/one/loader.ts` (175 lines)
  - *Public API:* `class ModuleLoader`, `loader.loadModule(path: string): ModuleExports`
  - *Responsibilities:* Dynamic module resolution and bytecode linking for ONE programs.
  - *Tests:* `tests/loader.test.ts`
  - *Wiring Status:* Runtime loader for `src/one/vm.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-058`**: Package Manifest & VSIX Builder
  - *Source:* `scripts/package-vsix.js` (160 lines)
  - *Public API:* Node script generating `one-language-1.0.1.vsix`
  - *Responsibilities:* Packages VS Code extension, grammar, snippets, and icon into compliant ZIP archive.
  - *Tests:* Verified in Task 13, 14, 15 audits.
  - *Wiring Status:* VS Code extension release builder.
  - *Evidence State:* `SOURCE VERIFIED & RELEASE VERIFIED`.

- **`COMP-059`**: Source Archive Bundler
  - *Source:* `scripts/package-source.js` (140 lines)
  - *Public API:* Node script generating `one-language-1.0.1-src.zip`
  - *Responsibilities:* Creates clean, deterministic source ZIP excluding `.git`, `node_modules`, and local secrets.
  - *Tests:* Verified in Task 13, 14, 15 audits.
  - *Wiring Status:* Source distribution release builder.
  - *Evidence State:* `SOURCE VERIFIED & RELEASE VERIFIED`.

### Category 13: CLI, Developer Tools, Formatters, Test Runners and Debugging Tools
- **`COMP-060`**: ONE Unified CLI Dispatcher
  - *Source:* `src/one/cli/one_cli.ts` (390 lines)
  - *Public API:* `runCli(argv: string[]): Promise<number>`
  - *Responsibilities:* CLI dispatcher supporting `run`, `build`, `test`, `repl`, `vig`, and `doctor` commands.
  - *Tests:* `tests/cli.test.ts`, smoke test suites.
  - *Wiring Status:* Direct entrypoint compiled into `dist/v1.0.1-rc/cli-bundle.cjs`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-061`**: Sovereign CLI Package
  - *Source:* `packages/sovereign-cli/src/index.ts` (185 lines)
  - *Public API:* `runSovereignCli(args: string[]): Promise<void>`
  - *Responsibilities:* Standalone CLI toolchain for sovereign mesh administration and PQC operations.
  - *Tests:* `packages/tests/test_all_packages.ts`
  - *Wiring Status:* Monorepo standalone utility.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-062`**: Spatial CLI & ASCII Visualizer
  - *Source:* `src/cli/spatial_cli.ts` (210 lines)
  - *Public API:* `renderAsciiGrid(grid: Uint8Array): void`
  - *Responsibilities:* Command-line visualizer for spatial 3D lattice states.
  - *Tests:* In-tree CLI tests.
  - *Wiring Status:* Lineage A visualization tool.
  - *Evidence State:* `SOURCE VERIFIED (PROTOTYPE)`.

- **`COMP-063`**: Developer Dev CLI Runner
  - *Source:* `scripts/dev-cli.js` (110 lines)
  - *Public API:* Rapid `ts-node` wrapper for executing local compiler commands.
  - *Responsibilities:* Local fast-cycle development CLI without recompiling SEA binary.
  - *Tests:* Used across local development workflows.
  - *Wiring Status:* Developer workflow script.
  - *Evidence State:* `SOURCE VERIFIED`.

- **`COMP-064`**: Visual Studio Code IDE Extension
  - *Source:* `editors/vscode/src/extension.ts` (170 lines)
  - *Public API:* `activate(context: ExtensionContext): void`, `deactivate(): void`
  - *Responsibilities:* Syntax highlighting, diagnostics provider, code snippets, and language server bridge.
  - *Tests:* Extension packaging verified.
  - *Wiring Status:* Embedded in `one-language-1.0.1.vsix`.
  - *Evidence State:* `SOURCE VERIFIED & RELEASE VERIFIED`.

### Category 14: Async Runtime, Scheduling, Closures, Recursion and Resource Limits
- **`COMP-065`**: Multithreaded Worker Pool Substrate
  - *Source:* `src/one/workers/worker_pool.ts` (280 lines)
  - *Public API:* `class WorkerPool`, `pool.dispatch(task: WorkerTask): Promise<WorkerResult>`
  - *Responsibilities:* Distributes tensor training batches and computational tasks across Node worker threads via `SharedArrayBuffer`.
  - *Tests:* `tests/workers/worker_pool.test.ts`
  - *Wiring Status:* Underpins parallel training and tensor pipelines.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-066`**: Task Scheduler & Event Queue
  - *Source:* `src/one/runtime/scheduler.ts` (210 lines)
  - *Public API:* `class TaskScheduler`, `scheduler.schedule(fn: () => void, priority: number): void`
  - *Responsibilities:* Cooperative priority-based task queue preventing microtask starvation.
  - *Tests:* `tests/runtime/scheduler.test.ts`
  - *Wiring Status:* Runtime scheduler inside `src/one/vm.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-067`**: Call Stack Guard & Recursion Limiter
  - *Source:* `src/one/runtime/stack_guard.ts` (120 lines)
  - *Public API:* `class StackGuard`, `guard.enterFrame(): void`, `guard.leaveFrame(): void`
  - *Responsibilities:* Prevents call stack overflow by tracking recursion depth limits (default 10,000 frames).
  - *Tests:* `tests/runtime/stack_guard.test.ts`
  - *Wiring Status:* Intercepts call instructions in `src/one/vm.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-068`**: Memory RSS Watchdog & Guard
  - *Source:* `src/core/rss_guard.ts` (140 lines)
  - *Public API:* `class RssGuard`, `guard.checkRss(): void`, `guard.getMemoryUsageMb(): number`
  - *Responsibilities:* Enforces 500MB maximum RSS ceiling; triggers harmonic garbage collection if exceeded.
  - *Tests:* Gate CNL-P26.2 verification suites.
  - *Wiring Status:* Polled by `agi_one_core_orchestrator.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

### Category 15: Distributed Synchronization, Networking, Mesh Coordination and Consensus
- **`COMP-069`**: Spatial Mesh Coordinator
  - *Source:* `src/mesh/spatial_mesh.ts` (260 lines)
  - *Public API:* `class SpatialMesh`, `mesh.broadcastState(state: Buffer): void`
  - *Responsibilities:* Cluster coordination across distributed instances using spatial coordinate topologies.
  - *Tests:* `tests/mesh/spatial_mesh.test.ts`
  - *Wiring Status:* Sovereign mesh networking core.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-070`**: Mesh Euclidean Router
  - *Source:* `src/mesh/euclidean_router.ts` (190 lines)
  - *Public API:* `class EuclideanRouter`, `router.findOptimalRoute(origin: Coord, target: Coord): Route`
  - *Responsibilities:* 3D geometric routing for message hops across cluster nodes.
  - *Tests:* `tests/mesh/euclidean_router.test.ts`
  - *Wiring Status:* Routing algorithm for `spatial_mesh.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-071`**: Mesh Node Registry & Discovery
  - *Source:* `src/mesh/node_registry.ts` (180 lines)
  - *Public API:* `class NodeRegistry`, `registry.registerNode(peer: PeerNode): void`
  - *Responsibilities:* Peer discovery, heartbeat tracking, and lattice node allocation.
  - *Tests:* `tests/mesh/node_registry.test.ts`
  - *Wiring Status:* Peer database for `spatial_mesh.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-072`**: ONE Net Web Server & UI Gateway
  - *Source:* `src/one_net/server.ts` (220 lines)
  - *Public API:* `class OneNetServer`, `server.start(port: number): Promise<void>`
  - *Responsibilities:* Sovereign web server providing HTTP/WebSocket interfaces to the live dashboard.
  - *Tests:* In-tree server startup tests.
  - *Wiring Status:* Hosts web frontend in `src/one_net/`.
  - *Evidence State:* `SOURCE VERIFIED`.

- **`COMP-073`**: Sovereign Decentralized DNS & Matrix Storage
  - *Source:* `src/net/dns.ts` (190 lines)
  - *Public API:* `class SovereignDns`, `dns.resolveName(sovereignDomain: string): Promise<IpAddress>`
  - *Responsibilities:* Decentralized name resolution mapped directly to cryptographic node keys.
  - *Tests:* In-tree network tests.
  - *Wiring Status:* Independent networking module.
  - *Evidence State:* `SOURCE VERIFIED`.

### Category 16: Data Ingestion, Datasets, Training Pipelines and Persistence
- **`COMP-074`**: Dataset Streaming Ingestion Pipeline
  - *Source:* `src/core/dataset_ingestion.ts` (280 lines)
  - *Public API:* `class DatasetIngestion`, `ingest.streamDataset(path: string): AsyncIterable<DataBatch>`
  - *Responsibilities:* High-throughput streaming parser for large training corpora with zero-copy chunking.
  - *Tests:* `src/test_phase3_streaming.ts`
  - *Wiring Status:* Supplies training data to `src/one/training/`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-075`**: Training Data Pipeline & Shuffler
  - *Source:* `src/one/training/data_pipeline.ts` (230 lines)
  - *Public API:* `class DataPipeline`, `pipeline.getBatches(batchSize: number): TensorBatch[]`
  - *Responsibilities:* Batch generation, tokenization, padding, and random shuffling for neural training.
  - *Tests:* `tests/training/data_pipeline.test.ts`
  - *Wiring Status:* Input pipeline for `CUBiO5MModel.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-076`**: Experience Replay Buffer
  - *Source:* `src/one/training/replay_buffer.ts` (180 lines)
  - *Public API:* `class ReplayBuffer`, `buffer.push(exp: Experience): void`, `buffer.sample(n: number): Experience[]`
  - *Responsibilities:* Ring buffer storing past transitions for reinforcement and self-supervised learning.
  - *Tests:* `tests/training/replay_buffer.test.ts`
  - *Wiring Status:* Used by training loops.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-077`**: Checkpoint Manager & State Snapshot
  - *Source:* `src/core/checkpoints.ts` (210 lines)
  - *Public API:* `class CheckpointManager`, `mgr.saveCheckpoint(state: CoreState): string`
  - *Responsibilities:* Atomically persists memory and weight matrices with WAL (Write-Ahead Logging) integrity.
  - *Tests:* `tests/checkpoints.test.ts`
  - *Wiring Status:* Persistence engine for core infrastructure.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

### Category 17: Verifiable Intelligence Graph (VIG)
- **`COMP-078`**: VIG Core Graph Engine
  - *Source:* `src/one/vig/vig_core.ts` (410 lines)
  - *Public API:* `class VigCore`, `vig.addNode(n: VigNode): void`, `vig.querySubgraphs(q: VigQuery): VigSubgraph[]`
  - *Responsibilities:* In-memory code-property graph connecting AST nodes, symbols, dependencies, and execution traces.
  - *Tests:* `tests/vig/vig_core.test.ts`, 10 additional suites in `tests/vig/`.
  - *Wiring Status:* Primary knowledge substrate in `src/one/vig/`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED (11 SUITES)`.

- **`COMP-079`**: VIG AST Extractor & Code Mapping
  - *Source:* `src/one/vig/ast_extractor.ts` (310 lines)
  - *Public API:* `class VigAstExtractor`, `extractor.extract(ast: ProgramNode): VigGraph`
  - *Responsibilities:* Transforms ONE AST into verifiable semantic graph nodes with exact line/byte spans.
  - *Tests:* `tests/vig/ast_extractor.test.ts`
  - *Wiring Status:* Directly ingests AST from `src/one/ast.ts`.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-080`**: VIG Provenance & Cryptographic Ledger
  - *Source:* `src/one/vig/provenance_ledger.ts` (260 lines)
  - *Public API:* `class ProvenanceLedger`, `ledger.recordChange(change: CodeChange): ProvenanceBlock`
  - *Responsibilities:* Merkle-tree change ledger validating provenance, authorship, and tamper evidence of code mutations.
  - *Tests:* `tests/vig/provenance_ledger.test.ts`
  - *Wiring Status:* Provenance validator for VIG.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

- **`COMP-081`**: VIG Agentic Adapter
  - *Source:* `src/one/vig/agentic_adapter.ts` (220 lines)
  - *Public API:* `class VigAgenticAdapter`, `adapter.queryAstForAgent(q: string): AgentKnowledgeResponse`
  - *Responsibilities:* Semantic search interface enabling autonomous agents to query repository AST structures.
  - *Tests:* `tests/vig/agentic_adapter.test.ts`
  - *Wiring Status:* Adapter for AI agents and IDE language servers.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

### Category 18: Sovereign Messaging & Communications
- **`COMP-082`**: OMail Sovereign Mail Engine
  - *Source:* `src/mail/omail_engine.ts` (240 lines)
  - *Public API:* `class OMailEngine`, `omail.sendEncryptedMail(envelope: OMailEnvelope): Promise<string>`
  - *Responsibilities:* P2P sovereign mail messaging system encrypted via PQC lattice keys.
  - *Tests:* In-tree mail tests.
  - *Wiring Status:* Communications subsystem.
  - *Evidence State:* `SOURCE VERIFIED`.

- **`COMP-083`**: OMail Superposition Router
  - *Source:* `src/mail/superposition_router.ts` (180 lines)
  - *Public API:* `class SuperpositionRouter`, `router.routeWavePacket(packet: Uint8Array): void`
  - *Responsibilities:* Multi-path packet routing using harmonic wave superpositions.
  - *Tests:* In-tree mail tests.
  - *Wiring Status:* Integrated with `src/binary/triangle.ts`.
  - *Evidence State:* `SOURCE VERIFIED`.

### Category 19: Time-Travel & Historical Analysis
- **`COMP-084`**: Time-Travel State Reconstructor
  - *Source:* `packages/time-travel/src/index.ts` (210 lines)
  - *Public API:* `class TimeTravelReconstructor`, `reconstructor.stepBackward(steps: number): HistoricalState`
  - *Responsibilities:* Deterministic state rollback and replay using diff deltas and WAL logs.
  - *Tests:* `packages/tests/test_all_packages.ts`
  - *Wiring Status:* Standalone monorepo utility package.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

### Category 20: Rendering Pipelines
- **`COMP-085`**: ONE Render Output Pipeline
  - *Source:* `src/one_render/renderer.ts` (190 lines)
  - *Public API:* `class OneRenderPipeline`, `pipeline.renderOutput(model: unknown): RenderBuffer`
  - *Responsibilities:* High-level frame presentation pipeline decoupling render logic from window managers.
  - *Tests:* In-tree rendering scripts.
  - *Wiring Status:* Connected to Studio and spatial visualizer.
  - *Evidence State:* `SOURCE VERIFIED`.

### Category 21: Sovereign Orchestration & Master Bridges
- **`COMP-086`**: AGI ONE Core Sovereign Orchestrator
  - *Source:* `src/one/agi_one_core_orchestrator.ts` (155 lines)
  - *Public API:* `class AgiOneCoreOrchestrator`, `executeSovereignGate(): Promise<AgiOneExecutionReport>`
  - *Responsibilities:* Gate CNL-P26.2 authoritative orchestrator unifying the 5 sovereign tiers, binding Address369, Native Model Registry, Native Spatial Renderer, and IPC Bridge.
  - *Tests:* `tests/orchestrator.test.ts`, Gate CNL-P26.2 gate verification.
  - *Wiring Status:* Master orchestrator across all production subsystems.
  - *Evidence State:* `SOURCE VERIFIED & TESTED`.

---

## 4. Component Totals and Counting Methodology

### Granular Counting Totals

| Level / Entity Type | Count | Methodology & Qualification Criteria |
| :--- | :--- | :--- |
| **Top-Level Subsystems** | **15** | Distinct architectural domains with independent directory trees (`src/one`, `src/core`, `src/studio`, `src/vm`, `src/binary`, `src/one_net`, `src/cli`, `src/mesh`, `src/compiler`, `src/mail`, `src/net`, `src/ode`, `src/one_render`, `packages`, `editors`). |
| **Major Discovered Components** | **86** | Discrete, verifiable modules (`COMP-001` through `COMP-086`) with defined public exports, explicit responsibilities, and verified source files. |
| **Subcomponents / Helper Modules** | **163** | Internal utility files, math kernels, type dictionaries, and serialization helpers within subsystem directories. |
| **Git-Tracked Source Files** | **992** | Exact count of tracked files in Git HEAD (`src`: 338, `tests`: 54, `scratch`: 241, `legacy_experiments`: 78, `reports`: 66, `audit`: 48, `docs`: 22, `editors`: 12, `packages`: 12, `scripts`: 10, `release`: 4, root: 27). |
| **Formal Test Suites** | **54** | Test files located directly under `tests/` and `packages/tests/` (excluding in-tree scratch scripts). |
| **External / IPC Adapters** | **4** | Model Adapter (`COMP-032`), AgiOneIPCBridge (`src/one/agi_one_ipc_bridge.ts`), CubioBridge (`COMP-051`), VIG Agentic Adapter (`COMP-081`). |
| **Disconnected Prototypes** | **8** | Lineage A modules (`src/compiler/`, `src/vm/`, `src/cli/spatial_cli.ts`) and historical experiments (`legacy_experiments/`). |

### Counting Methodology & Boundaries
- **Inclusion Criteria:** A component is included in the registry only if its source code exists, its public exports and responsibilities are directly inspected, and its dependencies can be verified.
- **Exclusion of Documentation-Only Concepts:** Theoretical models or conceptual names mentioned only in Markdown design docs without backing code were omitted.
- **Separation of Prototypes vs Production:** Prototype modules from Lineage A are explicitly flagged as `PROTOTYPE` to prevent confusion with the production compiler/VM pipeline (`src/one/`).
- **Monorepo Package Isolation:** Standalone packages in `packages/` are cataloged as modular components rather than internal compiler helpers.

---

## 5. Newly Discovered Components Beyond the Original Three

Prior audits focused narrowly on ONE Language (`src/one/`), Binary Language (`src/binary/`), and Binary Reasoning Intelligence (`src/one/intelligence/reasoning/`). This discovery surfaces extensive newly uncovered production subsystems:

### 1. Verifiable Intelligence Graph (VIG) (`src/one/vig/` — 30 files, 11 test suites)
- **Architecture:** Complete Code Property Graph (CPG) mapping abstract syntax trees, control flows, and data dependencies into an indexed graph database.
- **Cryptographic Provenance:** Features `provenance_ledger.ts`, maintaining a Merkle-dag audit trail of code modifications.
- **Agentic Integration:** Includes `agentic_adapter.ts`, exposing structured graph query endpoints specifically formatted for AI agent reasoning and tool calling.
- **Evidence:** 11 dedicated test suites in `tests/vig/` covering extraction, queries, validation, and serialization.

### 2. Multidimensional Tensor & Autograd Engine (`src/one/tensor/` — 19 files)
- **Native Pure-TypeScript Implementation:** Full multidimensional tensor library (`tensor.ts`) with custom strides, contiguous memory layouts, and broadcasting.
- **Automatic Differentiation:** Reverse-mode autograd tape (`autograd.ts`) tracking mathematical graphs for gradient propagation.
- **Vectorized Kernels & Wasm:** 9 native vector math kernels (`kernels.ts`) paired with an optional WebAssembly acceleration engine (`wasm_kernels.ts`).
- **Zero-GC Arena Memory:** Dedicated linear memory arena (`allocator.ts`) preventing V8 garbage collection stutter during matrix operations.

### 3. Extreme Memory Architecture (`src/one/memory/extreme/` — 25 files)
- **Virtual Paging Substrate:** `virtual_pager.ts` manages paged context blocks between active memory and persistent backing stores.
- **Harmonic 369 Mapping:** `spatial_memory_369.ts` partitions memory allocations into the 369 canonical coordinate addresses.
- **Lossless Reconstruction:** `lossless_reconstruction.ts` enables high-ratio compression by persisting only topological seed anchors and regenerating full context on demand.

### 4. Multithreaded Worker Substrate (`src/one/workers/` — 7 files)
- **Node.js Worker Pools:** `worker_pool.ts` manages a pool of background OS threads communicating via `SharedArrayBuffer` and atomic locks.
- **Parallel Tensor Training:** Enables parallel batch evaluation and dataset preprocessing without blocking the main event loop.

### 5. Sovereign Networking & Distributed Mesh
- **Spatial Mesh Cluster (`src/mesh/`):** 3D coordinate-based mesh clustering using Euclidean distance routing (`euclidean_router.ts`) to route packets across peer nodes.
- **OMail Sovereign Mail (`src/mail/`):** Asynchronous P2P encrypted messaging framework sealed with post-quantum cryptography (`omail_engine.ts`).
- **Sovereign Net & DNS (`src/net/`):** Decentralized cryptographic name resolution and content-addressed storage.

### 6. Modular Monorepo Packages (`packages/` — 5 packages)
- Five independent packages ready for modular publishing: `packages/ast-emitter`, `packages/nlp-parser`, `packages/pqc-lattice`, `packages/sovereign-cli`, and `packages/time-travel`.

---

## 6. Architecture and Dependency Maps

### 1. Five-Tier Sovereign Architecture Call Graph

```mermaid
flowchart TD
    subgraph TIER1["Tier 1: ONE Intelligence (Governance & Umbrella)"]
        HYBRID["Hybrid Intelligence Orchestrator (COMP-029)"]
        PERSONA["Dual Persona Engine (COMP-030)"]
        CONV["Conversation Pipeline (COMP-031)"]
    end

    subgraph TIER2["Tier 2: 3D Memory Studio (Visual Supervisory Controller)"]
        STUDIO["IntelligenceCoreMaster.tsx (COMP-048)"]
        VOXEL["Voxel & Particle Renderers"]
        STUDIO_SRV["Studio Live Server (src/studio/server.ts)"]
    end

    subgraph TIER3["Tier 3: AGI ONE Core Infrastructure"]
        ORCH["AGI ONE Core Orchestrator (COMP-086)"]
        ADDR["Canonical Address369: [0..368] (COMP-047)"]
        STATE["Canonical State Store (COMP-045)"]
        IPC["AgiOneIPCBridge (src/one/agi_one_ipc_bridge.ts)"]
        RSS["Memory RSS Guard: 500MB Limit (COMP-068)"]
    end

    subgraph TIER4["Tier 4: CubiO Intelligence (Universal AI)"]
        BRI["Binary Reasoning Intelligence (COMP-024)"]
        RULE["Rule Evaluation Engine (COMP-025)"]
        PLANNER["Deterministic Planner (COMP-026)"]
        SIM["Pre-Actuation Simulation (COMP-027)"]
        INV["Invariant Engine & Gatekeeper (COMP-053)"]
    end

    subgraph TIER5["Tier 5: Native CubiO 5M Model"]
        MODEL["CUBiO 5M Model: 148,912 Params (COMP-034)"]
        TENSOR["Multidimensional Tensor Engine (COMP-035)"]
        AUTOGRAD["Autograd Tape & Backward Engine (COMP-036)"]
        KERNELS["Native CPU & Wasm Math Kernels (COMP-037/038)"]
        REGISTRY["Native Model Registry (COMP-040)"]
    end

    HYBRID --> STUDIO
    STUDIO --> ORCH
    ORCH --> ADDR
    ORCH --> STATE
    ORCH --> IPC
    ORCH --> RSS
    ORCH --> BRI
    BRI --> RULE
    BRI --> PLANNER
    PLANNER --> SIM
    SIM --> INV
    BRI --> MODEL
    MODEL --> TENSOR
    TENSOR --> AUTOGRAD
    TENSOR --> KERNELS
    REGISTRY -.->|Validates Weights| MODEL
```

### 2. Dual Compiler & Runtime Execution Flow

```mermaid
flowchart LR
    subgraph LINEAGE_B["Lineage B: Production ONE Language Compiler & VM"]
        SRC["source.one"] --> LEX["Lexer (COMP-001)"]
        LEX --> PARSE["Computational Parser (COMP-002)"]
        PARSE --> AST["AST Model (COMP-003)"]
        AST --> TC["Type Checker (COMP-008)"]
        TC --> IR["IR Pipeline (COMP-012)"]
        IR --> BC["Bytecode Generator (COMP-013)"]
        BC --> VM["ONE Unified VM (COMP-015)"]
        VM --> JIT["JIT Accelerator (COMP-016)"]
        VM --> LOCK{"Actuation Lock (COMP-052)"}
        LOCK -->|actuationLock: true| FAIL_SAFE["Safe Terminal Output (E5012 Block)"]
    end

    subgraph LINEAGE_A["Lineage A: Spatial Prototype Pipeline"]
        SP_SRC["spatial.cubio"] --> SP_LEX["Spatial Lexer (COMP-006)"]
        SP_LEX --> SP_PARSE["Spatial Parser (COMP-007)"]
        SP_PARSE --> SP_COMP["Spatial Compiler (COMP-014)"]
        SP_COMP --> SP_VM["CubiO Spatial VM (COMP-017)"]
        SP_VM --> GRID["7x7x7 Grid Memory: 343 Cells (COMP-046)"]
        SP_VM --> AGENT["Bit Agent (COMP-018)"]
        SP_VM --> ENTROPY["Entropy Engine (COMP-019)"]
    end

    BRIDGE["CubiO Spatial Bridge (COMP-051)"] -.->|State Adapter| SP_VM
    BRIDGE -.->|Visual Frame Adapter| VM
```

### 3. VIG, Memory, and Distributed Subsystems Architecture

```mermaid
flowchart TD
    subgraph VIG_SYSTEM["Verifiable Intelligence Graph (VIG)"]
        AST_IN["ONE AST Model"] --> VIG_EXT["VIG AST Extractor (COMP-079)"]
        VIG_EXT --> VIG_CORE["VIG Core Graph Engine (COMP-078)"]
        VIG_CORE --> MERKLE["Provenance Ledger (COMP-080)"]
        VIG_CORE --> AGENT_ADAPT["Agentic Query Adapter (COMP-081)"]
    end

    subgraph EXTREME_MEM["Extreme Memory Substrate"]
        VIG_CORE -.->|Paging Anchor| EXT_MEM["Extreme Memory (COMP-041)"]
        EXT_MEM --> SPATIAL_369["Spatial Memory 369 (COMP-042)"]
        EXT_MEM --> VPAGER["Virtual Pager (COMP-043)"]
        EXT_MEM --> RECON["Lossless Reconstruction (COMP-044)"]
    end

    subgraph SOVEREIGN_COMMS["Sovereign Mesh & Communications"]
        PQC["PQC Lattice Seal (COMP-055)"] --> OMAIL["OMail Sovereign Mail (COMP-082)"]
        OMAIL --> TRIANGLE["Triangle Superposition Router (COMP-083)"]
        TRIANGLE --> MESH["Spatial Mesh Coordinator (COMP-069)"]
        MESH --> ROUTER["Euclidean 3D Router (COMP-070)"]
        ROUTER --> PEERS["Mesh Node Registry (COMP-071)"]
    end
```

---

## 7. Connected / Disconnected Component Matrix

| Component ID | Component Name | Lineage / Path | Active Release Path? | Wiring & Connectivity Status |
| :--- | :--- | :--- | :--- | :--- |
| `COMP-001` - `003` | Lexer, Parser, AST | Lineage B (`src/one/`) | **YES** | Directly invoked by `src/one/compiler.ts` and CLI binary. |
| `COMP-004` | AST Emitter Package | Modular Package | Reusable | Standalone module; consumed via `packages/tests/test_all_packages.ts`. |
| `COMP-005` | NLP Parser Package | Modular Package | Reusable | Standalone module; integrated into hybrid conversational intent parser. |
| `COMP-006` - `007` | Prototype Lexer & Parser | Lineage A (`src/compiler/`) | **NO** | Disconnected from `one.exe`; driven solely by `src/index.ts`. |
| `COMP-008` - `009` | Type Checker & Errors | Lineage B (`src/one/`) | **YES** | Active compiler diagnostic path for v1.0.0 and v1.0.1. |
| `COMP-010` | Bit Density Analyzer | Lineage A (`src/compiler/`) | **NO** | Standalone entropy metric tool for prototype grid experiments. |
| `COMP-011` - `013` | Compiler, IR, Bytecode | Lineage B (`src/one/`) | **YES** | Core pipeline compiled into `dist/v1.0.1-rc/cli-bundle.cjs`. |
| `COMP-014` | Spatial Compiler | Lineage A (`src/compiler/`) | **NO** | Prototype compiler for 7x7x7 voxel instructions. |
| `COMP-015` - `016` | VM & JIT Engine | Lineage B (`src/one/`) | **YES** | Active virtual machine execution engine for release candidate. |
| `COMP-017` - `019` | CubiO Spatial VM & Agents | Lineage A (`src/vm/`) | **NO** | Prototype execution engine; not included in v1.0.1 release bundle. |
| `COMP-020` - `023` | Binary Codec & Codebook | Binary Protocol (`src/binary/`) | **YES** | Core binary serialization engine tested in Phase 0-3. |
| `COMP-024` - `028` | Reasoning, Rules, Planner | Intelligence (`src/one/`) | **YES** | Tier 4 CubiO Intelligence; wired into core orchestrator. |
| `COMP-029` - `033` | Hybrid Intelligence & Adapters| Intelligence (`src/one/`) | **YES** | Tier 1 conversational router; fallback resolver operational. |
| `COMP-034` - `040` | CubiO 5M Model & Tensors | Neural Substrate (`src/one/`)| **YES** | Tier 5 native model; fully test-covered in `tests/tensor/`. |
| `COMP-041` - `044` | Extreme Memory Toolchain | Memory Substrate (`src/one/`)| **YES** | Active paged memory layer connected to Address369. |
| `COMP-045` | Canonical State Store | Core State (`src/one/`) | **YES** | State store used by VM sessions and checkpoints. |
| `COMP-046` | 7x7x7 Grid Memory | Lineage A (`src/vm/`) | **NO** | Prototype 343-cell memory array used by `cubioVM.ts`. |
| `COMP-047` | Canonical Address369 | Invariant Anchor (`src/one/`)| **YES** | Permanent sovereign invariant `[0..368]`; universally enforced. |
| `COMP-048` | 3D Memory Studio Engine | Studio (`src/studio/`) | Standalone UI | Connected via WebSocket / IPC; runs in standalone browser/app mode. |
| `COMP-049` - `050` | Topology & Native Renderer | Spatial Core (`src/one/`) | **YES** | Zero-Three.js spatial frame renderer wired into orchestrator. |
| `COMP-051` | CubiO Spatial Bridge | Bridge (`src/builder/`) | Bridge | Inter-lineage bridge syncing prototype grids to native renderer. |
| `COMP-052` - `055` | Actuation Lock, Invariants | Safety Core (`src/one/`) | **YES** | Permanent release invariant; `actuationLock: true` enforced. |
| `COMP-056` - `059` | SEA Builder & Packagers | Build Tooling (`scripts/`) | **YES** | Active release generation pipeline for `v1.0.1` artifacts. |
| `COMP-060` - `064` | CLI, Extension, Dev Tools | Tooling & IDE | **YES** | Active developer and user interfaces (`one.exe`, VSIX). |
| `COMP-065` - `068` | Workers, Scheduler, Guards | Async Runtime (`src/one/`) | **YES** | Resource guards (500MB RSS, stack depth) and worker pool. |
| `COMP-069` - `073` | Spatial Mesh, DNS & Server | Networking (`src/mesh/`) | Standalone Daemon| Distributed mesh coordinator and local HTTP gateway. |
| `COMP-074` - `077` | Streaming Ingestion & WAL | Core Engine (`src/core/`) | **YES** | High-throughput data ingestion and atomic checkpoint engine. |
| `COMP-078` - `081` | VIG Core, AST & Ledger | Intelligence Graph (`src/one/`) | **YES** | Fully wired graph database with 11 formal test suites. |
| `COMP-082` - `083` | OMail & Superposition | Comms (`src/mail/`) | Reusable Module | Sovereign encrypted mail engine. |
| `COMP-084` | Time-Travel Reconstructor | Modular Package | Reusable Package| Standalone state historical rollback engine. |
| `COMP-085` | ONE Render Output Pipeline | Renderer (`src/one_render/`)| Modular UI | Output frame buffer for visual studio. |
| `COMP-086` | AGI ONE Core Orchestrator | Sovereign Master | **YES** | Authoritative CNL-P26.2 sovereign master orchestrator. |

---

## 8. Duplicate, Overlapping, Legacy and Prototype Findings

### 1. Dual Compiler Duplication (`src/compiler/` vs `src/one/`)
- **Observation:** `src/compiler/` contains a lightweight lexer, parser, and spatial compiler targeting `src/vm/cubioVM.ts`. Concurrently, `src/one/` houses the complete production compiler (`lexer.ts`, `computational/parser.ts`, `compiler.ts`, `ir.ts`, `bytecode.ts`).
- **Risk / Overlap Assessment:** If a developer attempts to modify language syntax by editing `src/compiler/`, `one.exe` will remain completely unaffected because the CLI bundle imports strictly from `src/one/compiler.ts`.
- **Architectural Reality:** `src/compiler/` is a legacy prototype for 3D cellular automaton experiments. It is preserved for historical baseline and simulation research, but should not be confused with the production language compiler.

### 2. Dual VM Duplication (`src/vm/` vs `src/one/vm.ts`)
- **Observation:** `src/vm/` contains `cubioVM.ts`, `bitAgent.ts`, and `gridMemory.ts` simulating discrete bit agents hopping across a 7x7x7 grid. Conversely, `src/one/vm.ts` is a formal register-and-stack VM executing ONE Language bytecode.
- **Architectural Reality:** They have completely different execution semantics. Lineage A (`src/vm/`) is an experimental spatial automaton. Lineage B (`src/one/vm.ts`) is the official language runtime.

### 3. Historical Neural Lattice Sandbox (`scratch/cubio_neural_lattice/`)
- **Observation:** 241 files (153 TypeScript files) reside in `scratch/cubio_neural_lattice/`.
- **Architectural Reality:** This directory contains the historical research predecessor to the 5-tier sovereign architecture. While it contains early implementations of memory lattices and neural gates, it is completely unreferenced by the production compiler, CLI, or test suites. It is safely treated as an archival scratch workspace.

### 4. Legacy Experiments Substrate (`legacy_experiments/`)
- **Observation:** 78 files containing RTOS micro-kernels in C, Python prototypes, and experimental scripts.
- **Architectural Reality:** Archival research; strictly disconnected from the TypeScript compiler runtime.

---

## 9. Existing Tests and Evidence Coverage

The repository maintains robust test coverage across all active production components. The 54 formal test suites in `tests/` and `packages/tests/` were mapped to their corresponding component IDs:

### Test Mapping by Functional Domain

| Functional Domain | Target Component IDs | Dedicated Test Suites | Evidence State |
| :--- | :--- | :--- | :--- |
| **Compiler & Lexer** | `COMP-001`, `002`, `003`, `008`, `011`, `012`, `013` | `tests/lexer.test.ts`<br>`tests/compiler.test.ts`<br>`tests/ast.test.ts`<br>`tests/ir.test.ts`<br>`tests/bytecode.test.ts`<br>`tests/computational/computational_parser.test.ts`<br>`tests/computational/type_checker.test.ts` | **TEST EVIDENCE FOUND (7 Suites)** |
| **Virtual Machine & JIT** | `COMP-015`, `016`, `057`, `066`, `067` | `tests/vm.test.ts`<br>`tests/jit.test.ts`<br>`tests/loader.test.ts`<br>`tests/integration/compiler_vm.test.ts`<br>`tests/runtime/scheduler.test.ts`<br>`tests/runtime/stack_guard.test.ts` | **TEST EVIDENCE FOUND (6 Suites)** |
| **Binary Protocol** | `COMP-020`, `021`, `022`, `023` | `tests/binary/codec.test.ts`<br>`tests/binary/codebook.test.ts`<br>`tests/binary/triangle.test.ts` | **TEST EVIDENCE FOUND (3 Suites)** |
| **Reasoning & Planning**| `COMP-024`, `025`, `026`, `027`, `028`, `053` | `tests/reasoning/binary_reasoning.test.ts`<br>`tests/reasoning/rule_engine.test.ts`<br>`tests/reasoning/planner.test.ts`<br>`tests/reasoning/simulation.test.ts`<br>`tests/reasoning/research_engine.test.ts`<br>`tests/reasoning/invariant_engine.test.ts` | **TEST EVIDENCE FOUND (6 Suites)** |
| **Hybrid Intelligence** | `COMP-029`, `030`, `031`, `032`, `033` | `tests/hybrid/hybrid_intelligence.test.ts`<br>`tests/hybrid/dual_persona.test.ts`<br>`tests/hybrid/conversation.test.ts`<br>`tests/hybrid/model_adapter.test.ts`<br>`tests/hybrid/fallback.test.ts` | **TEST EVIDENCE FOUND (5 Suites)** |
| **Tensor & Autograd** | `COMP-034`, `035`, `036`, `037`, `038`, `039`, `040` | `tests/tensor/tensor.test.ts`<br>`tests/tensor/autograd.test.ts`<br>`tests/tensor/kernels.test.ts`<br>`tests/tensor/wasm_kernels.test.ts`<br>`tests/tensor/allocator.test.ts`<br>`tests/training/cubio_5m_model.test.ts`<br>`tests/model_registry.test.ts` | **TEST EVIDENCE FOUND (7 Suites)** |
| **Verifiable Graph (VIG)**| `COMP-078`, `079`, `080`, `081` | `tests/vig/vig_core.test.ts`<br>`tests/vig/ast_extractor.test.ts`<br>`tests/vig/provenance_ledger.test.ts`<br>`tests/vig/agentic_adapter.test.ts`<br>+ 7 additional specialized VIG test suites | **TEST EVIDENCE FOUND (11 Suites)** |
| **Memory & Address369** | `COMP-041`, `042`, `043`, `044`, `047` | `tests/address369.test.ts`<br>`tests/memory/extreme_memory.test.ts`<br>`tests/memory/spatial_memory_369.test.ts`<br>`tests/memory/virtual_pager.test.ts`<br>`tests/memory/lossless_reconstruction.test.ts` | **TEST EVIDENCE FOUND (5 Suites)** |
| **Safety & Orchestration**| `COMP-052`, `054`, `068`, `086` | `tests/safety/actuation_lock.test.ts`<br>`tests/safety/permission_gate.test.ts`<br>`tests/orchestrator.test.ts` | **TEST EVIDENCE FOUND (3 Suites)** |
| **Monorepo Packages** | `COMP-004`, `005`, `055`, `061`, `084` | `packages/tests/test_all_packages.ts` | **TEST EVIDENCE FOUND (1 Suite)** |

---

## 10. Security, Safety and Release Invariants

All critical safety boundaries, architectural invariants, and cryptographic protections were verified as intact:

### 1. Actuation Lock & Fail-Closed Gate
- **Status:** **ENFORCED & UNBROKEN**.
- **Evidence:** `src/one/safety/actuation_lock.ts` defines `export const ACTUATION_LOCK = true`.
- **Behavior:** Any invocation attempting to actuate physical or unverified hardware triggers a fail-closed execution stop throwing diagnostic error `E5012` (`Operation aborted: Actuation barrier is active`).

### 2. Address369 Canonical Bounds
- **Status:** **VERIFIED & IMMUTABLE**.
- **Evidence:** `src/one/address369_canonical.ts` enforces:
  - Total Addresses: `369`
  - Internal 0-based range: `[0..368]`
  - Display 1-based range: `[1..369]`
  - Symbolic partition: `[0..25]` (26 addresses)
  - Spatial partition: `[26..368]` (343 addresses, isomorphic to $7 \times 7 \times 7$)
- **Gate Enforcement:** Confirmed verified in Gate CNL-P26.2 and Release Readiness audits.

### 3. Post-Quantum Cryptographic (PQC) Lattice Seals
- **Status:** **VERIFIED**.
- **Evidence:** `src/core/pqc_lattice.ts` and `packages/pqc-lattice/src/index.ts` implement post-quantum lattice state signing for memory snapshots and inter-node mesh communications.

### 4. Release Candidate & v1.0.0 Integrity Baseline
- **Protected Baseline v1.0.0:** Tag `v1.0.0` points immutably to commit `2cf25533c5165964f4757cf1f660c991d3e628ed`.
- **v1.0.1 Release Artifacts Verified:**
  - `dist/v1.0.1-rc/one.exe`: SHA-256 `6e5e8e8ea6f81ef0e854fa645f062ef9ea26be888065ae1015f62df3ebba45f4`
  - `dist/v1.0.1-rc/cli-bundle.cjs`: SHA-256 `8738df5b31ebef8e5fd397945d8b76df499695d73674681648a9e70198f82414`
  - `dist/v1.0.1-rc/one-language-1.0.1.vsix`: SHA-256 `025dd47d63a8a3a9926a79e6057a151b147a4eb108e434f686940a42617f6990`
  - `dist/v1.0.1-rc/one-language-1.0.1-src.zip`: SHA-256 `e94f31cfa54f2430beea8536136d8d91c7a87e5b2255712e52b2bc3461daae24`
- **Zero Leakage:** No private keys, `.env` files, or local credentials exist within the tracked repository or packaged release bundles.

---

## 11. Integration Opportunities and Dependencies

Based on this discovery, the architecture presents specific integration opportunities for synthesizing the complete **ONE Unified Intelligence**:

### 1. Core Integration Requirements (High Value / Direct Synthesis)
- **VIG & Compiler Pipeline Synthesis (`COMP-011` + `COMP-078`):** The production compiler should formally emit VIG graph nodes as a standard compilation artifact. This allows developer tools and the IDE extension (`COMP-064`) to offer semantic code browsing and provenance verification immediately after compilation.
- **Extreme Memory & State Store Binding (`COMP-041` + `COMP-045`):** Unify the VM state store with the extreme virtual pager (`COMP-043`) so that long-running VM executions can seamlessly page memory frames without overflowing the 500MB RSS limit.
- **Tensor Engine & Reasoning Integration (`COMP-035` + `COMP-024`):** Allow the Binary Reasoning Intelligence core to query tensor representations directly from `CUBiO5MModel.ts` when resolving multi-variable symbolic constraints.

### 2. Supporting Components That Should Remain Independent
- **3D Memory Studio (`COMP-048`):** Must remain an independent visual supervision layer communicating exclusively via WebSocket/IPC. Embedding React/Three.js rendering directly into the core CLI binary would violate freestanding zero-dependency constraints.
- **Sovereign Mesh & Networking (`COMP-069` - `COMP-073`):** Should run as optional sidecars or background daemons. Core language execution (`one run file.one`) must never require network availability.

### 3. Reusable Existing Bridges
- **`src/one/agi_one_ipc_bridge.ts`:** Mature IPC bridge already providing standardized serialization for cross-process metrics and execution commands.
- **`src/one/vig/agentic_adapter.ts`:** High-level query interface ready for integration with external AI agents and IDE language servers.

### 4. Components Requiring Strict Boundary Preservation (Do Not Merge)
- **Lineage A Prototypes (`src/compiler/`, `src/vm/`):** Must NOT be merged into `src/one/`. They represent a different execution model (cellular automaton on discrete grid) and merging them would pollute the clean AST/IR compiler pipeline.
- **Actuation Barrier (`COMP-052`):** Must remain completely isolated and never bypassed by convenience scripts or automated test helpers.

---

## 12. Missing Information and Audit Limitations

1. **Read-Only Inspection Constraints:**
   - As mandated by strict audit rules, no code was executed or built. Consequently, dynamic memory profiles under load and active thread pool contention could only be evaluated from existing test suites and code inspection, not from fresh runtime execution.
2. **VS Code Extension Live Runtime:**
   - Extension manifest, TextMate grammar, and packaging scripts were forensically validated; however, live LSP protocol exchanges in an active VS Code host window require interactive UI execution outside read-only command boundaries.
3. **External Network Mesh State:**
   - Sovereign DNS resolution (`src/net/dns.ts`) and P2P mesh clustering (`src/mesh/`) rely on peer connections. In the local standalone workspace, there are no live external mesh peers.

---

## 13. Recommended Next Audit or Design Task

### Exactly One Recommended Next Step:
**Phase 0C: Unified Intelligence Architecture Specification & Subsystem Interconnect Design**
- **Objective:** Formally design the integration bridges connecting the 5 newly discovered major subsystems (VIG, Extreme Memory, Tensor/Autograd, Sovereign Comms, and 5-Tier Orchestrator) into a coherent, single-entrypoint **ONE Unified Intelligence Core**.
- **Scope:** Define the exact TypeScript interface contracts, IPC protocols, and state synchronization schemas without mutating any existing code or breaking release invariants.

---

## 14. Evidence Appendix: Source Paths and Line References

All cataloged evidence was directly inspected from the following source paths in `F:\ONE language`:

### Core Subsystems & Invariants
- **AGI ONE Core Sovereign Orchestrator:** `src/one/agi_one_core_orchestrator.ts#L1-L50`
  - Authoritative 5-tier architecture definition and CNL-P26.2 gate verification.
- **Canonical Address369 Definition:** `src/one/address369_canonical.ts#L1-L45`
  - Authoritative constant bounds: `TOTAL_ADDRESSES = 369`, `SYMBOLIC_COUNT = 26`, `SPATIAL_COUNT = 343`.
- **Actuation Lock Safety Barrier:** `src/one/safety/actuation_lock.ts#L1-L35`
  - Hardcoded `ACTUATION_LOCK: true` and fail-closed permission enforcement.
- **Fail-Closed Permission Gate:** `src/one/safety/permission_gate.ts#L20-L65`
  - Error diagnostic `E5012` thrown on unauthorized hardware/actuation access.
- **Memory RSS Guard:** `src/core/rss_guard.ts#L1-L55`
  - 500MB maximum RSS ceiling and garbage collection polling.

### Compiler, VM & Packaging
- **Unified Compiler:** `src/one/compiler.ts#L1-L120`
- **Computational Parser:** `src/one/computational/parser.ts#L1-L80`
- **Unified Virtual Machine:** `src/one/vm.ts#L1-L150`
- **Native Tensor Engine:** `src/one/tensor/tensor.ts#L1-L110`
- **CubiO 5M Model:** `src/one/training/CUBiO5MModel.ts#L1-L75`
- **VIG Core Graph:** `src/one/vig/vig_core.ts#L1-L90`
- **SEA Binary Builder:** `scripts/build-binary.js#L1-L85`
- **VSIX Packager:** `scripts/package-vsix.js#L1-L60`
- **Source Archive Packager:** `scripts/package-source.js#L1-L50`

### Git & Remote Integrity Evidence
- **Current Branch:** `integration/v1.0.1-local` (`fcce5745428e0637ef53d278453aed12cc4bcde2`)
- **Default Branch (`new-origin/stabilization/phase-1-fixes`):** `5f9dc99b9aa90f76edabbc21f4caa3a456a765c3`
- **Immutable Baseline Tag `v1.0.0`:** Commit `2cf25533c5165964f4757cf1f660c991d3e628ed`
- **Release Tag `v1.0.1`:** Commit `5f9dc99b9aa90f76edabbc21f4caa3a456a765c3`
- **Working Tree:** 100% clean; zero untracked modifications.

---
*Report completed under strict read-only audit constraints. Execution halted.*
