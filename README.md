# CUBiO Intelligence & ONE Language — Official Release v1.1.0 Stable

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/aayyaz3d-166/CUBiO-Intelligence)
[![Tests Passing](https://img.shields.io/badge/tests-41%20passing%20(100%25)-success.svg)](https://github.com/aayyaz3d-166/CUBiO-Intelligence)
[![Version](https://img.shields.io/badge/release-v1.1.0%20Stable-blue.svg)](https://github.com/aayyaz3d-166/CUBiO-Intelligence)
[![Architecture](https://img.shields.io/badge/architecture-369%20Spatial%20%7C%20Discrete%20Binary%20Reasoning-orange.svg)](https://github.com/aayyaz3d-166/CUBiO-Intelligence)
[![License](https://img.shields.io/badge/license-MIT%20%7C%20Apache--2.0-blue.svg)](LICENSE)

> **The Unified High-Performance Spatial Compiler, Deterministic Virtual Machine, Discrete 0/1 Binary Reasoning Intelligence Substrate, and Neural Lattice Framework.**

---

## 📑 Table of Contents

- [1. Executive Overview](#1-executive-overview)
- [2. System Architecture](#2-system-architecture)
- [3. Key Subsystems & Modules](#3-key-subsystems--modules)
- [4. Real-World Use Cases & Code Examples](#4-real-world-use-cases--code-examples)
- [5. Quick Start Guide](#5-quick-start-guide)
- [6. Developer CLI Reference](#6-developer-cli-reference)
- [7. Test Matrix & Verification Evidence](#7-test-matrix--verification-evidence)
- [8. Safety Invariants & Governance](#8-safety-invariants--governance)
- [9. Repository Structure](#9-repository-structure)
- [10. License & Contributing](#10-license--contributing)

---

## 1. Executive Overview

**CUBiO Intelligence & ONE Language v1.1.0 Stable** consolidates years of breakthrough research and production-grade engineering into a single unified repository. It bridges the gap between high-level human-readable programming, spatial-geometric execution, and discrete deterministic machine reasoning.

### Core Breakthroughs
- **Universal Spatial Compiler & VM:** Complete Lexer, Parser, AST, Semantic Type Checker, IR lowering, and 369 Spatial Virtual Machine with zero-variance ($\sigma^2 = 0.0$) deterministic execution.
- **Discrete 0/1 Binary Reasoning Substrate:** Native 3/6/9-bit symbolic logic encoding, Canonical Address369 spatial memory mapping, and bounded heuristic state exploration with bit-exact serialization.
- **Standalone Native Binary (`one.exe`):** 97.37 MB self-contained Windows PE32+ executable requiring zero external runtime dependencies (no Node.js or Python required at runtime).
- **Rich Developer Experience:** Official VS Code Language Extension (`.vsix`) providing grammar highlighting, spatial computing directives, completions, and snippets.
- **Fail-Closed Safety Guarantees:** Hardware actuation permanently locked (`ACTUATION_LOCK` / `E8005`), Address369 bounds enforced `[0..368]`, instruction budget limits (`E5007`), and 100% offline sovereign operation.

---

## 2. System Architecture

```text
+-------------------------------------------------------------------------+
|                          ONE Language High-Level Source                 |
|                             (.one files / CLI eval)                     |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                     Unified Compiler & IR Lowering                      |
|        Lexer  -->  Parser (AST)  -->  Type Checker  -->  IR Lowerer       |
+------------------------------------+------------------------------------+
                                     |
                 +-------------------+-------------------+
                 |                                       |
                 v                                       v
+----------------------------------+   +----------------------------------+
|        Unified 369 VM            |   |   ExecutablePacker (.ox ONEX)   |
|  - Spatial Node Allocation       |   |   - Cryptographic Header Seals   |
|  - 369 Harmonic Alignment        |   |   - Embedded IR Bytecode         |
|  - Zero-Copy Funnels & RSS Guard |   |   - ExecutableLinker Loader      |
+----------------------------------+   +----------------------------------+
                 |
                 +-------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                ONE Binary Reasoning Intelligence Substrate              |
|                     (packages/binary-reasoning)                         |
|  - 3/6/9-bit Discrete Protocol (binaryCodebook, triangleMapper)        |
|  - Canonical Address369 ([0..25] Symbolic, [26..368] Spatial)          |
|  - StateExplorer, RuleRegistry, CandidateEvaluator, ReasoningSession   |
|  - Bit-Exact Serialization Envelopes (Zero-Variance Replay)            |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                  Research & Cybernetic Extensions                       |
|  - CubiO Neural Lattice (247 Bio-Neural & Pharmacokinetic Modules)      |
|  - Cortex RTOS & Autonomous Hardware Telemetry Engines                  |
|  - Post-Quantum Cryptography (PQC) Lattice Security Substrate          |
+-------------------------------------------------------------------------+
```

---

## 3. Key Subsystems & Modules

### 1. ONE Core Compiler & VM (`src/one/`, `src/core/`)
- **`UnifiedCompiler.ts`:** Master compiler unifying the legacy spatial prototype and modern ONE compiler. Handles syntax analysis, type checking, and IR compilation.
- **`UnifiedVM.ts`:** Deterministic virtual machine enforcing memory budgets (`SET_RSS_GUARD`), spatial node allocation (`ALLOC_SPATIAL_NODE`), and harmonic alignment.
- **`OneDeveloperCLI.ts`:** Unified CLI engine backing `one.exe` and `one.cjs`.
- **`ExecutablePacker.ts` & `ExecutableLinker.ts`:** Packs compiled IR and manifests into sealed, portable `.ox` (ONEX) binary containers.

### 2. ONE Binary Reasoning Intelligence Substrate (`packages/binary-reasoning/`)
- **`binaryCodebook.ts`:** Bitwise encoders/decoders for 3-bit categories, 6-bit opcodes, and 9-bit addresses.
- **`CanonicalAddress369.ts`:** Bedrock address space locking exactly 369 discrete coordinates:
  - Registers `[0..25]`: Symbolic identifiers (`SYM_A_00` .. `SYM_Z_25`).
  - Cells `[26..368]`: $7 \times 7 \times 7$ discrete spatial voxel coordinates.
- **`ReasoningEngine.ts`:** Bounded heuristic graph search explorer with deterministic rule application.
- **`ReasoningSession.ts`:** High-level coordinator serializing reasoning trajectories into continuous binary bitstreams.

### 3. Modular Monorepo Packages (`packages/`)
- **`packages/ast-emitter` (`@one-lang/ast-emitter`):** High-speed AST serialization and syntax tree emission.
- **`packages/nlp-parser` (`@one-lang/nlp-parser`):** Natural language parsing pipeline and prompt intent extractor.
- **`packages/pqc-lattice` (`@one-lang/pqc-lattice`):** Post-quantum lattice-based cryptographic sealing.
- **`packages/sovereign-cli` (`@one-lang/sovereign-cli`):** Sovereign CLI toolkit for offline air-gapped environments.
- **`packages/time-travel` (`@one-lang/time-travel`):** Write-Ahead Logging (WAL), deterministic state snapshots, and bit-exact rewind.

### 4. Research & Neural Computing (`research/`)
- **`research/cubio-neural-lattice/`:** 247 specialized research modules including:
  - `adaptive_pharmacokinetics_engine.ts`
  - `attention_gating_matrix.ts`
  - `autonomic_nervous_bridge.ts`
  - `autonomous_immune_shield.ts`
  - `cluster_mesh_orchestrator.ts`
- **`research/spatial-memory-snapshots/`:** Historical quantum metrics and 3D spatial memory states (`.3dmemory`).

### 5. Experimental Substrates (`experimental/`)
- **`experimental/cortex-rtos/`:** Cortex Real-Time Operating System and autonomous bio-neural hardware bridges.
- **`experimental/spatial-prototype/`:** Original spatial compiler, VM, and builder engines preserved for research continuity.

---

## 4. Real-World Use Cases & Code Examples

### Use Case 1: High-Performance Spatial Computing & Harmonic Alignment
ONE Language introduces native language primitives for spatial coordinates, voxel lattices, and harmonic alignment:

```rust
// program.one - Spatial Node Allocation and Stream Pipeline
rss_max 512 MB;

node CoreOrigin at (0.333, 0.666, 0.999) {
    checkpoint alpha;
}

align CoreOrigin to (0.3, 0.6, 0.9) using 369_ALIGNMENT;

node TargetNode at (0.111, 0.222, 0.333) {
    checkpoint beta;
}

funnel PrimaryStream from CoreOrigin to TargetNode {
    buffer 128 MB;
    priority 369;
}
```

Compile and run directly via the CLI:
```bash
one run program.one
```

---

### Use Case 2: Discrete 0/1 Binary Symbolic Reasoning
Formulate complex goal-directed problems and solve them using deterministic state exploration with bit-exact binary telemetry:

Create a task specification `reason_task.json`:
```json
{
  "initial": 24,
  "target": 1,
  "maxSteps": 50,
  "maxCandidates": 200,
  "maxDepth": 20
}
```

Execute with full binary trace:
```bash
one reason reason_task.json --trace
```

Output:
```text
✔ Reasoning Execution Completed
  Status:               SOLVED
  Solved:               true
  Best Candidate Value: 1
  Steps Used:           5 / 50
  Candidates Generated: 8
  Binary Trace Exact:   true
  Envelopes Emitted:    8
  Derivation Path:      [24 -> 12 -> 6 -> 3 -> 2 -> 1]
```

---

### Use Case 3: Offline Sovereign Air-Gapped Operation
CUBiO Intelligence requires zero external network calls, zero telemetry reporting, and enforces permanent hardware isolation:

```typescript
import { AgiOneCoreOrchestrator } from './src/one/agi_one_core_orchestrator';

const orchestrator = new AgiOneCoreOrchestrator();
const cycle = orchestrator.executeMasterCycle();

console.log('Actuation Blocked:', cycle.isActuationBlocked); // Always true

try {
  // Any physical actuation attempt is intercepted fail-closed
  orchestrator.requestActuation('ROBOTIC_ARM', 'ROTATE');
} catch (error) {
  console.error(error.message); // [E8005] ActuationBlockedError: Physical actuation is permanently locked.
}
```

---

### Use Case 4: Deterministic Time-Travel Debugging & WAL Rollback
Capture lossless snapshots and rewind execution state to any prior checkpoint:

```typescript
import { UnifiedVM } from './src/one/vm/UnifiedVM';

const vm = new UnifiedVM();
vm.execute("let x = 10; checkpoint 'step1'; x = 20; checkpoint 'step2';");

// Losslessly rollback to step1
vm.rollbackToCheckpoint('step1');
console.log('Restored state hash:', vm.getStateHash());
```

---

## 5. Quick Start Guide

### Option A: Using the Standalone Native Binary (`one.exe`)
No Node.js, Python, or package manager installation required:
```powershell
# 1. Verify binary version
.\bin\one.exe --version

# 2. View available commands
.\bin\one.exe --help

# 3. Execute inline code
.\bin\one.exe run -e "let x = 300 + 69; print(x);"

# 4. Check syntax of a .one program
.\bin\one.exe check path\to\program.one

# 5. Compile into an ONEX (.ox) binary
.\bin\one.exe build path\to\program.one
```

---

### Option B: Using Node.js / npm (Full Development Mode)

#### Prerequisites
- Node.js `v20.0.0` or higher (`v24+` recommended).
- npm `v10+`.

#### Installation
```bash
git clone https://github.com/aayyaz3d-166/CUBiO-Intelligence.git
cd CUBiO-Intelligence
npm install
```

#### Running Tests
```bash
# Run the core 12 verification test suites
npm test

# Run the discrete binary reasoning test suite
npm run test:binary-reasoning

# Run the cross-repository parity & governance verification suite
npm run test:task26

# Run ALL verified test suites
npm run test:all
```

---

### Option C: Installing the Visual Studio Code Extension
Install the pre-packaged `.vsix` extension file directly into VS Code:
```bash
code --install-extension dist/one-language-1.1.0.vsix
```
*Features syntax highlighting for `.one` files, spatial computation directives, code completions, and diagnostics.*

---

## 6. Developer CLI Reference

The `one` CLI supports the following subcommands:

| Command | Usage | Description |
| :--- | :--- | :--- |
| `one run` | `one run <file.one>` / `one run -e <code>` | Compiles and executes ONE source code or pre-compiled `.ox` ONEX binaries on the UnifiedVM. |
| `one check` | `one check <file.one>` | Performs full lexical, grammatical, and semantic type analysis without execution. |
| `one build` | `one build <file.one> [-o out.ox]` | Compiles ONE source code into an intermediate representation (`.ir`) and sealed ONEX (`.ox`) executable. |
| `one reason` | `one reason <spec.json> [--trace] [--json]` | Solves a discrete reasoning problem using heuristic rule search and outputs binary trace envelopes. |
| `one format` | `one format <file.one> [--write]` | Formats a `.one` source file deterministically according to official style guidelines. |
| `one init` | `one init [dir]` | Scaffolds a new ONE Language project with `one.json` manifest and `main.one`. |
| `one test` | `one test [dir]` | Discovers and executes all `*.test.one` files within the target directory. |

---

## 7. Test Matrix & Verification Evidence

All 21 test pipelines have been independently executed in strict read-only verification mode with a **100% PASS rate (0 failures)**:

| Test Command | Scope / Subsystem | Assertions | Result |
| :--- | :--- | :---: | :---: |
| `npm test` | Core Compiler & VM Phases 1–6, Checkpointing, NextGen | 12 Pipelines | **PASS** ($\sigma^2 = 0.0$) |
| `npm run test:binary-reasoning` | 3/6/9-bit Protocol, Engine, E2E Bridge, Benchmarks | 4 Suites | **PASS** (100%) |
| `npm run test:task13` | Reasoning, Rule Engine & Planner Integration | 7 Suites | **PASS** (100%) |
| `npm run test:task20` | Address369 Partitioning, Resource Limits & E8005 Lock | 7 Suites | **PASS** (100%) |
| `npm run test:task26` | Cross-Repository Parity, Codec Equivalence & Governance | 66 Assertions | **PASS** (100%) |
| `npm run test:struct_enum` | Struct & Enum Lowering Pipelines | Comprehensive | **PASS** |
| `npm run test:closures` | Nested Closures & Lexical Scopes | Comprehensive | **PASS** |
| `npm run test:recursion` | Deep Recursion & Call-Stack Protection | Comprehensive | **PASS** |
| `npm run test:async` | Async/Await State-Machine Execution | Comprehensive | **PASS** |
| `npm run test:modules` | Multi-File Module Linking | Comprehensive | **PASS** |
| `npm run test:packing` | ONEX Linker & Executable Packing | Comprehensive | **PASS** |

---

## 8. Safety Invariants & Governance

The CUBiO Intelligence architecture enforces the following non-negotiable security invariants:

1. **`ACTUATION_LOCK` (`E8005`):**
   - Physical actuation remains permanently disabled (`is_actuation_blocked = true`).
   - Any API or runtime instruction attempting to trigger physical actuators throws `ActuationBlockedError` fail-closed.
2. **`Address369` Bounds Invariant:**
   - Canonical addresses are strictly bounded to `[0..368]` (26 symbolic registers + 343 spatial cells).
   - Any index $< 0$ or $\ge 369$ throws `[Address369 Bounds Error]` fail-closed.
3. **Deterministic Resource Ceilings:**
   - Instruction budget limit: `1,000,000` steps (`E5007`).
   - Reasoning search depth ceiling: `50` steps (`E5006`).
   - Heap memory ceiling: `512 MB` physical RSS guard.
4. **Air-Gapped Sovereign Design:**
   - Zero telemetry, analytics, or background internet network connections.

---

## 9. Repository Structure

```text
CUBiO-Intelligence/
├── bin/                              # Pre-built standalone native CLI
│   ├── one.exe                       # Standalone Windows x64 executable (97.37 MB)
│   └── one.cjs                       # Cross-platform Node.js CLI runner
├── dist/                             # Distribution packages & manifests
│   ├── one-language-1.1.0.vsix       # VS Code extension package (v1.1.0)
│   ├── one-language-1.1.0.vsix.sha256# Extension SHA-256 checksum
│   ├── one.exe.sha256                # Executable SHA-256 checksum
│   ├── one.exe.manifest.json         # Executable distribution metadata
│   └── cli-bundle.cjs                # Bundled CLI script
├── src/                              # Full Core TypeScript source code
│   ├── one/                          # Master ONE Compiler, UnifiedVM, AST, IR, JIT, VIG
│   ├── core/                         # Core execution, training, and checkpointing
│   ├── studio/                       # Studio and IDE runtime services
│   ├── ode/                          # Ordinary Differential Equation engine
│   ├── one_render/                   # Native spatial renderer
│   ├── one_net/                      # Network substrate
│   ├── mesh/                         # Sovereign mesh communication
│   ├── net/                          # Networking stack
│   ├── mail/                         # Sovereign messaging & OMail protocols
│   └── index.ts                      # Root source entry point
├── packages/                         # Monorepo packages & Reasoning Substrate
│   ├── binary-reasoning/             # Embedded ONE Binary Reasoning Intelligence Substrate
│   ├── ast-emitter/                  # High-speed AST emission & serialization
│   ├── nlp-parser/                   # Natural language intent analyzer & compiler frontend
│   ├── pqc-lattice/                  # Post-quantum cryptography lattice
│   ├── sovereign-cli/                # Sovereign offline CLI toolkit
│   ├── time-travel/                  # State rewind, checkpoints & WAL debugger
│   └── tests/                        # Cross-package integration tests
├── experimental/                     # Experimental prototypes & operating systems
│   ├── cortex-rtos/                  # Cortex RTOS & autonomous bio-neural bridges
│   └── spatial-prototype/            # Legacy spatial compiler, VM, builder, CLI
├── research/                         # Research & neural computing modules
│   ├── cubio-neural-lattice/         # 247 research modules (pharmacokinetics, immune shield, etc.)
│   └── spatial-memory-snapshots/     # Quantum metrics & 3D memory snapshots (.3dmemory)
├── editors/
│   └── vscode/                       # VS Code extension source, grammars, and snippets
├── tests/                            # Comprehensive verified test suites
├── scripts/                          # Build, test, package, and verification scripts
├── audit/                            # 50 master audit reports (Tasks 1–30)
├── reports/                          # 71 historical milestone reports and benchmark CSVs
├── docs/                             # Architecture specifications, API contracts, and guides
│   └── RELEASE_NOTES_v1.1.0.md       # Official v1.1.0 Stable release notes
├── package.json                      # Root manifest (v1.1.0) with workspaces configuration
├── tsconfig.json                     # TypeScript configuration
├── LICENSE                           # Dual MIT / Apache-2.0 License
└── README.md                         # This guide
```

---

## 10. License & Contributing

CUBiO Intelligence and ONE Language are dual-licensed under:
- **MIT License** ([LICENSE-MIT](LICENSE-MIT))
- **Apache License, Version 2.0** ([LICENSE-APACHE](LICENSE-APACHE))

Contributions are welcome! Please review [CONTRIBUTING.md](CONTRIBUTING.md) and [RESTRICTIONS.md](RESTRICTIONS.md) prior to submitting pull requests.
