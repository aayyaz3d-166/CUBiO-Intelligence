# ONE Language — Official Release v1.1.0 Stable
## Master Unified Architecture & Intelligence Substrate

**Release Date:** October 28, 2026  
**Status:** PRODUCTION STABLE  
**Target:** Windows x64 PE32+ / Cross-Platform Node.js Runtime  
**Package:** `one-language` v1.1.0  
**License:** Dual-licensed under MIT and Apache-2.0  

---

## 1. Executive Summary

ONE Language v1.1.0 Stable represents the culmination of all architectural development, research prototypes, and binary reasoning integration across the ONE Language ecosystem. This unified release consolidates:

1. **ONE Language Core Compiler & VM (`src/one`, `src/core`, `bin/one.exe`):**
   - Lexer, Parser, AST, semantic type checker, IR lowering, and 369 spatial virtual machine.
   - Deterministic execution engine, dynamic JIT compilation, and zero-variance reverse-mode autograd.
   - High-throughput VIG (Verified Intelligence Graph) compilation provenance ledger.

2. **ONE Binary Reasoning Intelligence Substrate (`packages/binary-reasoning`):**
   - 3/6/9-bit discrete symbolic logic encoding and decoding (`binaryCodebook`, `triangleMapper`).
   - Canonical Address369 spatial memory mapping (369 discrete addresses: 26 registers + 343 spatial cells).
   - Deterministic `ReasoningEngine`, `RuleRegistry`, `CandidateEvaluator`, and `ReasoningSession`.
   - Zero runtime dependencies, 100% test pass rate across all verification suites.

3. **Modular Monorepo Packages (`packages/`):**
   - `packages/ast-emitter`: High-speed AST serialization and syntax graph emission.
   - `packages/nlp-parser`: Natural language parsing pipeline and prompt intent extractor.
   - `packages/pqc-lattice`: Post-quantum cryptography lattice security engine.
   - `packages/sovereign-cli`: Sovereign CLI framework and offline execution tooling.
   - `packages/time-travel`: Deterministic VM state recording, rewind, and WAL replay.
   - `packages/binary-reasoning`: Embedded complete discrete reasoning engine.

4. **Research & Biological Computing Substrates (`research/`):**
   - `research/cubio-neural-lattice`: 247 research modules covering adaptive pharmacokinetics, attention gating matrices, autonomic nervous bridges, autonomous immune shield, and cluster mesh orchestration.
   - `research/spatial-memory-snapshots`: Quantum metrics, telemetry, and spatial 3D memory snapshots (`.3dmemory`).

5. **Experimental & Operating Systems Substrates (`experimental/`):**
   - `experimental/cortex-rtos`: Cortex Real-Time Operating System and bio-neural hardware bridges.
   - `experimental/spatial-prototype`: Legacy spatial compiler, VM, CLI, and builder engines preserved for research continuity.

6. **Developer Tooling & Distribution Artifacts (`dist/`, `bin/`, `editors/`):**
   - `bin/one.exe`: 102 MB standalone native Windows PE32+ executable requiring zero external runtime dependencies.
   - `dist/one-language-1.1.0.vsix`: Official VS Code Language Extension with syntax highlighting, snippets, diagnostics, and LSP integration.
   - `scripts/`: Fully reproducible build, test, and packaging pipelines.

---

## 2. Directory Layout of the Unified Release

```text
one language official release v 1.1 Stable/
├── bin/
│   ├── one.exe                   # Standalone native compiler/VM CLI (102 MB)
│   └── one.cjs                   # Cross-platform Node.js CLI runner
├── dist/
│   ├── one.exe                   # Certified standalone executable
│   ├── one.exe.sha256            # Executable checksum
│   ├── one.exe.manifest.json     # Executable distribution manifest
│   ├── one-language-1.1.0.vsix   # Certified VS Code extension package
│   ├── one-language-1.1.0.vsix.manifest.json
│   ├── one-language-1.1.0.vsix.sha256
│   ├── cli-bundle.cjs            # Standalone CLI bundled code
│   └── sea-prep.blob             # Single Executable Application blob
├── src/
│   ├── one/                      # Master modern ONE compiler, VM, AST, IR, JIT, VIG
│   ├── core/                     # Core runtime, training, checkpointing
│   ├── studio/                   # Studio & IDE runtime services
│   ├── ode/                      # Ordinary Differential Equation engine
│   ├── one_render/               # Native spatial rendering substrate
│   ├── one_net/                  # Network substrate
│   ├── mesh/                     # Sovereign mesh communication
│   ├── net/                      # Networking protocols
│   ├── mail/                     # Sovereign messaging & OMail protocols
│   └── index.ts                  # Root source entry point
├── packages/
│   ├── ast-emitter/              # AST emission & serialization
│   ├── binary-reasoning/         # Embedded ONE Binary Reasoning Substrate
│   ├── nlp-parser/               # Natural language parser & compiler frontend
│   ├── pqc-lattice/              # Post-quantum cryptography lattice
│   ├── sovereign-cli/            # Sovereign offline CLI toolkit
│   ├── time-travel/              # Time-travel state debugger
│   └── tests/                    # Cross-package integration tests
├── experimental/
│   ├── cortex-rtos/              # Cortex RTOS and autonomous bio-neural bridges
│   └── spatial-prototype/        # Spatial prototype compiler, VM, builder, CLI
├── research/
│   ├── cubio-neural-lattice/     # 247 research modules (pharmacokinetics, immune shield, etc.)
│   └── spatial-memory-snapshots/ # Quantum metrics and .3dmemory snapshots
├── editors/
│   └── vscode/                   # VS Code extension source, grammars, and snippets
├── tests/                        # 41 comprehensive verified test suites
├── scripts/                      # Build, test, package, and validation scripts
├── audit/                        # Complete 50-report master audit & verification trail
├── reports/                      # 71 historical milestone reports and benchmark CSVs
├── docs/                         # Official documentation, API contracts, whitepapers
├── package.json                  # Root manifest (v1.1.0) with workspace configuration
├── tsconfig.json                 # TypeScript build configuration
├── LICENSE                       # Dual MIT / Apache-2.0 License
└── README.md                     # Comprehensive Getting Started & User Guide
```

---

## 3. Verified Safety Invariants & Security Gates

All core safety invariants remain strictly enforced across the unified codebase:
1. **`ACTUATION_LOCK` (`E8005`):** Physical actuation commands remain strictly blocked (`is_actuation_blocked = true`) across `SovereignWebGateway`, `AgiOneCoreOrchestrator`, and `ExtremeMemoryVMAdapter`. Any attempt to actuate physical actuators throws `ActuationBlockedError` fail-closed.
2. **`Address369` Invariant:** All symbolic addresses and spatial memory coordinates strictly reside within `[0..368]`. Any out-of-bounds index is rejected fail-closed with `BinaryError(INVALID_ADDRESS)`.
3. **Resource Ceilings:** Instruction execution limit (`1,000,000` steps), heap allocation limit (`512 MB`), reasoning depth limit (`50`), and candidate expansion ceiling (`100`) are deterministically bounded.
4. **Offline Core:** The core compiler, VM, and binary reasoning engine operate 100% offline with zero external network calls.

---

## 4. Quick Start Guide

### Running with Native Standalone Executable (No Node.js Required)
```powershell
# Check version
.\bin\one.exe --version

# Display help and commands
.\bin\one.exe --help

# Run a reasoning session
.\bin\one.exe reason "sample_spec.json"
```

### Running with Node.js / npm
```powershell
# Run the complete core verification test suite
npm test

# Run the binary reasoning test suite
npm run test:binary-reasoning

# Run the cross-repo governance & parity verification suite
npm run test:task26

# Run all test suites
npm run test:all
```

### Installing the VS Code Extension
```powershell
code --install-extension dist/one-language-1.1.0.vsix
```
