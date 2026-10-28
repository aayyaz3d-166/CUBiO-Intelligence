# ONE Intelligence — Task 1: Dual-Repository Forensic Audit Report

**Workspace:** `F:\ONE language`  
**Target Repositories:**  
1. **ONE Language:** `https://github.com/aayyaz3d-166/ONE-language.git` (`F:\ONE language`)  
2. **ONE Binary Reasoning Intelligence:** `https://github.com/aayyaz3d-166/ONE-Binary-Reasoning-Intelligence.git` (`F:\one-binary-reasoning`)  
**Audit Protocol:** Strict READ-ONLY Forensic Investigation  
**Execution Timestamp:** 2026-10-28T04:38:00+05:00  

---

## 1. Repository Baseline Report

### Repository 1: ONE Language (`one-language-core`)
- **Workspace Location:** `F:\ONE language`
- **Primary Package Name:** `one-language-core` (`package.json`)
- **Version:** `1.0.1` (`private: true`, `type: module`)
- **Git State:**
  - **Current Branch:** `integration/v1.0.1-local`
  - **HEAD Commit:** `fcce5745428e0637ef53d278453aed12cc4bcde2` (`merge: integrate feat/v1.0.1-command-syntax into integration/v1.0.1-local`)
  - **Working Tree Status:** 100% clean (0 modified, 0 staged, 0 untracked files in tracked paths).
- **Remotes:**
  - `new-origin`: `https://github.com/aayyaz3d-166/ONE-language.git` (fetch & push)
  - `origin`: `https://github.com/aayyaz3d-166/ONE-language-` (fetch & push)
- **Live Remote State (`git ls-remote new-origin` verified):**
  - `HEAD` & `refs/heads/stabilization/phase-1-fixes`: `5f9dc99b9aa90f76edabbc21f4caa3a456a765c3`
  - `refs/heads/feat/v1.0.1-command-syntax`: `fdfefd11d8a749959172aa2b9e0e51b1e1f47da3`
  - `refs/pull/1/head`: `fdfefd11d8a749959172aa2b9e0e51b1e1f47da3`
  - Annotated tag `v1.0.0` (`a035615...`): points to `2cf25533c5165964f4757cf1f660c991d3e628ed`
  - Annotated tag `v1.0.1` (`1ba399e...`): points to `5f9dc99b9aa90f76edabbc21f4caa3a456a765c3`
- **Build & Release Metadata:**
  - Release binaries located in `dist/` and `dist/v1.0.1-rc/`.
  - Packaged standalone executable: `one.exe` (102,059,520 bytes, SHA-256 `479186ca87f55781825df05f5603ac3747ada4c2e9aa78de9e3cd233a993020e`).
  - Packaged VS Code extension: `one-language-1.0.1.vsix` (2,047,908 bytes, SHA-256 `33c8f6c59fd04acafc514d0d7be4cc80ed397352348a7425fafa349ac00c5b0d`).
  - Source archive: `one-language-1.0.1-src.zip` (1,996,348 bytes, SHA-256 `925fb6cf562378afb824fe6709740018c554238b069e5beb5144260851846ed5`).
  - CLI bundle: `cli-bundle.cjs` (10,506,575 bytes, SHA-256 `8adff0ef2e03e4513cca17d375990c1c89014a6d97bbf219e619ed70cd65ce06`).

### Repository 2: ONE Binary Reasoning Intelligence (`one-binary-reasoning`)
- **Workspace Location:** `F:\one-binary-reasoning`
- **Primary Package Name:** `one-binary-reasoning` (`package.json`)
- **Version:** `1.0.0` (`license: MIT OR Apache-2.0`, `type: module`)
- **Git State:**
  - **Current Branch:** `main`
  - **HEAD Commit:** `61bf3cb1f997ac22a7e44e4b6cbd416f30015054` (`docs: add project logo and update repository branding`)
  - **Initial Commit:** `39017a9e5cc7422d60ddc796b22f95fcdf606c49` (`feat: initial commit of ONE Binary 0/1 Reasoning Intelligence`)
  - **Working Tree Status:** 100% clean (`nothing to commit, working tree clean`).
- **Remotes:**
  - `origin`: `https://github.com/aayyaz3d-166/ONE-Binary-Reasoning-Intelligence.git` (fetch & push)
- **Live Remote State (`git ls-remote origin` verified):**
  - `HEAD` & `refs/heads/main`: `61bf3cb1f997ac22a7e44e4b6cbd416f30015054`
  - No remote tags.
- **Build & CI Infrastructure:**
  - Zero external runtime dependencies (`dependencies: {}`).
  - Developer tooling: `typescript ^5.4.5`, `@types/node ^20.12.7`.
  - CI Workflow: `.github/workflows/ci.yml` running Node.js 18, 20, 22 matrix executing typecheck, test, and benchmark scripts.
  - Zero-dependency in-memory test harness: `scripts/test_runner.cjs`.

---

## 2. Source-Backed Component and Test Inventory

### 1. `F:\one-binary-reasoning` Component Inventory

| File Path | Lines | Key Symbols / Exports | Responsibility | Evidence Status |
| :--- | :--- | :--- | :--- | :--- |
| `src/binary/types.ts` | 75 | `BitCategory`, `TriangleOpcode`, `TrianglePositions`, `SupportedBinaryValue`, `BinaryError` | Core enums and type contracts for 3/6/9-bit protocol. | Verified Source |
| `src/binary/binaryCodebook.ts` | 132 | `BinaryCodebook`, `TABLE_3BIT`, `TABLE_6BIT`, `TABLE_9BIT` | Exact lookup tables: 8 3-bit categories, 64 6-bit opcodes, 512 9-bit addresses. | Verified Source |
| `src/binary/binaryEncoder.ts` | 108 | `BinaryEncoder` | Big-endian bitstring serializer for primitives, floats, strings, Address369, opcodes. | Verified Source |
| `src/binary/binaryDecoder.ts` | 163 | `BinaryDecoder`, `DecodeResult` | Stream/offset decoder asserting fail-closed rejection of reserved patterns. | Verified Source |
| `src/binary/triangleMapper.ts` | 86 | `TriangleMapper` | Bijective planar geometric mapping between 6-bit codes and triangle vertices/edges. | Verified Source |
| `src/shared/address369.ts` | 119 | `CanonicalAddress369`, `Address369Info` | Canonical memory coordinate engine: symbolic `[0..25]`, spatial `[26..368]`. | Verified Source |
| `src/reasoning/types.ts` | 220 | `DecisionSignal`, `Candidate`, `ReasoningRule`, `ReasoningInput`, `ReasoningResult` | State explorer data structures and 0/1 decision signal definitions. | Verified Source |
| `src/reasoning/RuleRegistry.ts` | 88 | `RuleRegistry` | Dynamic rule registration and categorization container. | Verified Source |
| `src/reasoning/CandidateEvaluator.ts` | 140 | `CandidateEvaluator` | Evaluates candidates, checks hard constraints, and ranks deterministically. | Verified Source |
| `src/reasoning/StateExplorer.ts` | 159 | `StateExplorer` | Bounded forward-search state space explorer with cycle detection. | Verified Source |
| `src/reasoning/ReasoningEngine.ts` | 285 | `ReasoningEngine` | Core solver enforcing step limits, depth bounds, and candidate ceilings. | Verified Source |
| `src/integration/BinaryReasoningBridge.ts` | 68 | `BinaryReasoningBridge` | Serializes reasoning tokens into binary envelopes and verifies roundtrip decoding. | Verified Source |
| `src/integration/ReasoningSession.ts` | 116 | `ReasoningSession`, `SolvedBinaryBundle` | High-level coordinator solving problems and generating bit-exact binary traces. | **OBR Exclusive** |

### 2. `F:\one-binary-reasoning` Test Suite Inventory

| Test File | Test Count / Details | Execution Command | Result |
| :--- | :--- | :--- | :--- |
| `tests/binary/binary_language.test.ts` | 11 test cases: 3-bit, 6-bit, 9-bit enumeration, triangle roundtrip, fail-closed errors. | `node scripts/test_runner.cjs tests/binary/binary_language.test.ts` | **PASS (11/11, 100%)** |
| `tests/reasoning/reasoning_engine.test.ts` | 5 suites (A through E): acceptance/rejection, rule reuse, deduplication, loop safety, binary protocol v1. | `node scripts/test_runner.cjs tests/reasoning/reasoning_engine.test.ts` | **PASS (Suites A-E, 100%)** |
| `tests/integration/bridge_e2e.test.ts` | 5 integration tests: trajectory serialization, continuous bitstream decode, `ReasoningSession`. | `node scripts/test_runner.cjs tests/integration/bridge_e2e.test.ts` | **PASS (5/5, 100%)** |
| `tests/reasoning/reasoning_benchmark.ts` | 7 deterministic benchmarks (BM-01 to BM-07): linear search, generalization, pruning, ceilings. | `node scripts/test_runner.cjs tests/reasoning/reasoning_benchmark.ts` | **PASS (7/7, 100%)** |

### 3. `F:\ONE language` Core Subsystems & Key Files

| Subsystem | Key Production Files | Responsibility |
| :--- | :--- | :--- |
| **Compiler & Lexer** | `src/one/oneLexer.ts`<br>`src/one/router/GrammarRouter.ts`<br>`src/one/computational/ComputationalParser.ts`<br>`src/one/ast/UnifiedAST.ts`<br>`src/one/semantics/SemanticAnalyzer.ts`<br>`src/one/types/TypeChecker.ts`<br>`src/one/ir/IRLowering.ts`<br>`src/one/UnifiedCompiler.ts` | Production compilation pipeline converting ONE Language syntax into verified `UnifiedIRProgram`. |
| **Virtual Machine** | `src/one/vm/UnifiedVM.ts` (1,566 lines) | Production stack-and-register execution runtime with call frames, locals, and resource limits. |
| **Executable Packager** | `src/one/packer/ExecutableArtifact.ts`<br>`src/one/packer/ExecutablePacker.ts`<br>`src/one/packer/ExecutableLinker.ts`<br>`src/one/packer/ExecutableValidator.ts` | Canonical `.ox` (ONEX) binary container serialization, checksumming, and actuation lockout assertion. |
| **Binary Protocol** | `src/binary/binaryCodebook.ts`<br>`src/binary/binaryEncoder.ts`<br>`src/binary/binaryDecoder.ts`<br>`src/binary/triangleMapper.ts`<br>`src/binary/types.ts` | Mirrored 3/6/9-bit protocol specification (identical to `one-binary-reasoning`). |
| **Reasoning Engine** | `src/one/intelligence/reasoning/ReasoningEngine.ts`<br>`src/one/intelligence/reasoning/RuleRegistry.ts`<br>`src/one/intelligence/reasoning/StateExplorer.ts`<br>`src/one/intelligence/reasoning/CandidateEvaluator.ts`<br>`src/one/intelligence/reasoning/BinaryReasoningBridge.ts` | Core reasoning algorithms (mirrored from `one-binary-reasoning`, lacking `ReasoningSession.ts`). |
| **Hybrid Intelligence**| `src/one/intelligence/hybrid/HybridConversationEngine.ts`<br>`src/one/intelligence/hybrid/IntentParser.ts` | Blends conversational intent routing with numeric reasoning execution. |
| **VIG Graph System** | `src/one/vig/VIGASTExtractor.ts`<br>`src/one/vig/VerifiableIntelligenceGraph.ts`<br>`src/one/vig/VIGProvenanceLedger.ts`<br>`src/one/vig/VIGCompilationCache.ts` | Code Property Graph, symbol extraction, Merkle change tracking, and compiler caching. |
| **Tensor & Autograd** | `src/one/tensor/Tensor.ts`<br>`src/one/tensor/AutogradBridge.ts`<br>`src/one/tensor/TensorArena.ts`<br>`src/one/training/CUBiO5MModel.ts` | Pure-TypeScript multidimensional tensors, autograd tape, and 148,912-parameter native model. |
| **Developer CLI** | `src/one/cli/OneDeveloperCLI.ts`<br>`scripts/dev-cli.js`<br>`bin/one.cjs` | Command dispatcher for `one init`, `run`, `check`, `build`, `format`, `test`. |

---

## 3. Audit-Claim Verification Matrix

| Claim ID | Source Claim (from Phase 0B / Phase 0C) | Verified Reality from Source Evidence | Classification | Forensic Justification & Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **CLM-01** | Production compiler is located at `src/one/compiler.ts`. | Compiler is located at `src/one/UnifiedCompiler.ts` (334 lines) and `src/one/oneCompiler.ts` (289 lines). `src/one/compiler.ts` does not exist. | **CONTRADICTORY / OUTDATED** | Confirmed by filesystem scan and import inspection in `src/one/cli/OneDeveloperCLI.ts#L15`. |
| **CLM-02** | Production VM is located at `src/one/vm.ts` (420 lines). | Production VM is `src/one/vm/UnifiedVM.ts` (1,566 lines, 63 KB). `src/one/vm.ts` does not exist. | **CONTRADICTORY / OUTDATED** | Confirmed by filesystem scan and `UnifiedCompiler.ts#L9`. |
| **CLM-03** | ONE Language bytecode compiles into 3/6/9-bit triangle opcodes for VM execution. | `UnifiedVM` dispatches string opcodes (`CONST`, `LOAD`, `ADD`, `INPUT`, etc.) from `UnifiedIRProgram`. It does not decode `TriangleOpcode`. | **UNSUPPORTED / FALSE** | Confirmed by `UnifiedVM.ts#L25-L30`. The 3/6/9-bit protocol is an isolated symbolic data protocol. |
| **CLM-04** | Error code `E5012` is a physical actuation barrier failure. | `E5012` is explicitly defined in `UnifiedVM.ts#L840` as `Input stream exhausted`. The actuation violation code is `E8005`. | **CONTRADICTORY** | `UnifiedVM.ts#L840` throws `E5012` on unhandled `INPUT`. `ExecutableValidator.ts#L70` throws `E8005` on actuation failure. |
| **CLM-05** | Canonical Address369 bounds `[0..368]` are universally enforced. | Exact bounds `[0..368]` are enforced across both repos. | **VERIFIED** | `src/one/address369_canonical.ts` and `src/shared/address369.ts` are 100% byte-for-byte identical (4,356 bytes). |
| **CLM-06** | Actuation lockout `actuationLock: true` is permanently active. | Permanent lockout is hardcoded and validated fail-closed across validators. | **VERIFIED** | `actuation_lock.ts` (`ACTUATION_LOCK = true`), `ExecutableValidator.ts#L66`, `VIGSecurityGuard.ts#L327`. |
| **CLM-07** | `one-binary-reasoning` is an independent GitHub repository. | Independent repo located at `F:\one-binary-reasoning` tracking remote `https://github.com/aayyaz3d-166/ONE-Binary-Reasoning-Intelligence.git`. | **VERIFIED** | `git remote -v` and `git status` confirm independent Git root, history, and CI. |
| **CLM-08** | Preliminary v1.0.1 artifact hashes matched release notes. | Phase 0B reported preliminary hashes (e.g. `one.exe` ending in `ba45f4`), but files on disk match `.sha256` manifests (e.g. `one.exe` ending in `3020e`). | **RECONCILED** | Fresh SHA-256 calculation matches `dist/v1.0.1-rc/*.sha256` manifest files exactly. |
| **CLM-09** | VIG is an active production subsystem in ONE Language. | 30 production files in `src/one/vig/`, wired into `UnifiedCompiler.ts` cache, with 11 passing test suites. | **VERIFIED** | `UnifiedCompiler.ts#L13`, `tests/vig/` (11 test suites). |
| **CLM-10** | `ReasoningSession.ts` exists in both repositories. | `ReasoningSession.ts` exists ONLY in `F:\one-binary-reasoning\src\integration\ReasoningSession.ts`. | **UNSUPPORTED / FALSE** | Search in `F:\ONE language` confirmed `ReasoningSession.ts` is absent. |

---

## 4. Critical Unknowns and Blockers

### Blocker 1: Repository Decoupling & Source Drift Risk
- **Issue:** The binary language files (`src/binary/*`) and reasoning algorithms (`src/reasoning/*`) are manually duplicated between `F:\ONE language` and `F:\one-binary-reasoning`.
- **Risk:** Any future bug fix, opcode addition, or protocol update made in one repository will cause silent drift in the other unless a formal package dependency or submodule link is established.

### Blocker 2: Missing `ReasoningSession.ts` in `ONE language`
- **Issue:** `ReasoningSession.ts` is the standard coordinator for executing bounded reasoning problems and capturing bit-exact binary traces. It was authored in `one-binary-reasoning` but was never backported to `ONE language`.
- **Impact:** `ONE language` cannot run high-level binary reasoning sessions through a clean, unified API without re-implementing the session logic.

### Blocker 3: Lack of CLI Dispatcher for Binary Reasoning
- **Issue:** `OneDeveloperCLI` supports `run`, `check`, `build`, `format`, `test`, and `init`. It has no verb (e.g. `one reason` or `one solve`) to invoke the reasoning engine directly from the command line.

### Blocker 4: Disambiguation of Compiled Executables vs Binary Envelopes
- **Issue:** Historical documentation blurred the boundary between compiled executable bytecode (`.ox` ONEX files) and 3/6/9-bit reasoning bitstreams.
- **Clarification:** `.ox` is the compiled bytecode container for the VM. 3/6/9-bit is the reasoning data serialization protocol. They serve orthogonal purposes and must remain separate.

---

## 5. Recommended Dependencies & Roadmap for Task 2

To proceed safely with integration without mutating existing release artifacts:

1. **Dependency 1 (Backport `ReasoningSession.ts`):**
   - Copy `F:\one-binary-reasoning\src\integration\ReasoningSession.ts` into `F:\ONE language\src\one\intelligence\reasoning\ReasoningSession.ts`.
   - Update its import specifiers to point to `F:\ONE language`'s local paths (`../../../../src/binary` and `./types`).

2. **Dependency 2 (CLI Integration Bridge):**
   - Add a dedicated handler `handleReason` in `src/one/cli/OneDeveloperCLI.ts` allowing developers to execute bounded reasoning specifications via `one reason <spec.json>` or `one reason -e "<goal>"`.

3. **Dependency 3 (Package Manifest Linking):**
   - In `F:\one-binary-reasoning\package.json`, ensure it can be consumed either as an npm dependency (`"one-binary-reasoning": "file:../one-binary-reasoning"`) or as a standalone submodule.

4. **Dependency 4 (Safety Gate Verification):**
   - Ensure all tests in both repositories continue to pass 100%, Address369 bounds remain `[0..368]`, and `actuationLock: true` remains completely inviolate.

---
*Task 1 forensic audit complete. All repositories and artifacts remain untouched. Execution halted.*
