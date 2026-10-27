# ONE Language — Release Scope & Boundary Restrictions

## 1. Context: Historical Demo Restrictions vs. Open-Source Release

Earlier development snapshots and demo packages (such as the Gate 24 Explorer UI release) were restricted to a minimal demo service (`src/one_net/ui/`), while the compiler, virtual machine, and binary protocol were held as protected, unreleased components.

Under the current **ONE Language v1.0.0** release, those historical demo restrictions on software source code are **superseded**. The core software toolchain is released as open source under the terms of the project's dual license (`MIT OR Apache-2.0`).

## 2. Open-Source Software Scope

The dual license (`MIT OR Apache-2.0`) applies to all software source code contained within this repository:
- **Compiler & Toolchain:** Lexer, parser, AST structures, semantic analyzer, type checker, and IR lowering engine (`src/one/`).
- **Runtime & Execution:** Virtual Machine (`src/one/vm/UnifiedVM.ts`), native runtime, and built-in standard modules.
- **Developer CLI & Scaffolding:** CLI entry points (`bin/one.cjs`, `OneDeveloperCLI.ts`) and project scaffolding commands.
- **IDE Support:** VS Code extension (`editors/vscode/`) and Language Server (`src/one/lsp/OneLanguageServer.ts`).
- **Binary Protocols & Formats:** Deterministic binary encoder, decoder, codebook, and executable packer logic (`src/one/packer/`, `*.ox` artifact support).
- **Core Modular Subpackages:** Modular packages in `packages/*` (`@one-lang/ast-emitter`, `@one-lang/nlp-parser`, `@one-lang/pqc-lattice`, `@one-lang/sovereign-cli`, `@one-lang/time-travel`).
- **Verification Suites & Documentation:** Test suites and developer specifications.

## 3. Excluded Assets & Boundaries

The following assets are **NOT included** in this open-source release and are **NOT granted** under the software license:

1. **Neural Network Checkpoints & Weights:**
   - Pre-trained neural weights, biases, and serialized model checkpoints (such as `one_lm_best.cubiomodel`) are excluded from this release.
   - The runtime adapter (`Native5MAdapter.ts`) executes safely with rule-based fallback when checkpoints are absent.
   - Rights to external model checkpoints and training parameters remain subject to separate ownership and clearance reviews and are not granted under this software license.

2. **Training Datasets & Raw Corpus Data:**
   - Training datasets, benchmark corpora, and raw evaluation datasets are excluded from this distribution.

3. **External Repositories & Data Volumes:**
   - This release is strictly self-contained within `F:\ONE language`. External paths and volumes (such as `F:\3D memory studio\ONE language` and `E:\ONE_language_baseline`) are outside the release boundary.

4. **Internal Development Residue:**
   - Internal development artifacts—including pre-phase micro-backups (`.backup_*`), nested clone directories (`ONE language/`), consolidation experiments (`legacy_experiments/`), and internal forensic logs (`audit/`, `reports/`)—are internal records and are excluded from clean public source distribution tarballs.

## 4. Architectural Invariants & Safety Confinement

ONE Language maintains immutable architectural invariants:
- **Address369 Confinement:** The canonical coordinate address space remains bounded to `[0..368]` (343 discrete cells, 26 directional shifts).
- **VIG Separation:** Visual Instruction Grammar (VIG) rules remain strictly partitioned.
- **Hardware Actuation Lock:** The fail-closed hardware actuation lock (`actuationLock: true`) is hardwired to prevent unauthorized physical actuation.
