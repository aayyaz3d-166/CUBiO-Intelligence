# ONE Language — Official Release v1.2 Stable
### Sovereign Computational Language & Qplayer Execution Architecture

**Version**: `1.2.0 Stable`  
**Distribution Target**: Standalone Windows x64 & Cross-Platform Node Engine  
**Engines Included**: 
1. **UnifiedVM** (Standard Canonical Execution Fabric)
2. **Qplayer Runtime** (High-Throughput One Binary Intelligence `.obi` Engine — 7.7M ops/sec)

---

## 1. Quickstart & CLI Usage

### Running Code
To run a `.one` source file using the standard UnifiedVM:
```powershell
bin\one.cmd run examples\01_hello_world\main.one
```
*(Or via Node: `node bin/one.cjs run examples/01_hello_world/main.one`)*

### Running with Qplayer Acceleration
To run with Qplayer's optimized register-machine and DAG logic scheduler:
```powershell
bin\one.cmd run examples\02_qplayer_obi\compute.one --engine=qplayer
```

### Compiling to One Binary Intelligence (.obi)
Compile ONE source into an ultra-compact, bit-packed binary:
```powershell
bin\one.cmd build examples\02_qplayer_obi\compute.one --target=obi
```
This produces `compute.obi` (~95 to 110 bytes), which is **~94% smaller** than conventional JSON IR containers.

### Executing Compiled .obi Binary
Run the native `.obi` binary directly:
```powershell
bin\one.cmd run examples\02_qplayer_obi\compute.obi
```

---

## 2. Visual Studio Code Extension (v1.2.0)

This distribution includes the official VS Code extension delivering a complete development experience comparable to the Microsoft Python extension:

* **Package**: `dist/one-language-1.2.0.vsix` (1.97 MB)
* **Features**:
  * Full `.one` syntax highlighting and TextMate grammar.
  * In-process Language Server (diagnostics, autocompletion, hover docs, go-to-definition).
  * Document Outline, Breadcrumbs, and deterministic formatting (`Shift+Alt+F`).
  * Status Bar Indicator: `$(zap) ONE v1.2.0`.
  * Dedicated Run, Check, Build, and Qplayer actions.

### Installation in VS Code
Run in PowerShell or Terminal:
```powershell
code --install-extension "dist\one-language-1.2.0.vsix" --force
```

---

## 3. Distribution Directory Structure

```
one language official release v 1.2 Stable/
├── bin/
│   ├── one.exe                # Native Windows x64 binary
│   ├── one.cjs                # Developer CLI executable launcher
│   └── one.cmd                # Windows Command prompt script
├── dist/
│   ├── one-language-1.2.0.vsix # Packaged VS Code extension
│   ├── one-language-1.2.0.vsix.sha256
│   └── one.exe
├── src/
│   ├── one/                   # Core compiler, Lexer, Parser, AST, Semantics, Types, Spatial, VM
│   └── qplayer/               # Qplayer Runtime, OBI Binary Engine, Graph Optimizer
├── examples/
│   ├── 01_hello_world/        # Standard greeting sample
│   ├── 02_qplayer_obi/        # Qplayer computational pipeline sample
│   └── 03_spatial_address369/ # Address369 spatial memory sample
├── tests/                     # Full regression & Qplayer test suites
├── verify-v1.2.cjs            # Self-contained health check verification script
├── README.md                  # This file
├── RELEASE_NOTES_v1.2.0.md    # Detailed v1.2 release notes
└── CHECKSUMS.sha256           # Cryptographic file verification digests
```

---

## 4. Safety Invariants & Boundary Guards

* **ACTUATION_LOCK**: Hardware actuation remains locked fail-closed at compile-time and runtime.
* **Address369 Model**: Spatial memory addresses are sovereign and strictly confined to range `[0..368]`. Addresses outside this range fail closed with `E8005`.
* **Resource Bounds**: Infinite loop protection (`1,000,000` instructions cap) and RSS memory guards (`512 MB`) are enforced deterministically.
