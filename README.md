<div align="center">

# 🌌 ONE Language
**Deterministic Spatial Computing, Zero-OS Execution & Sovereign Architecture**

[![License](https://img.shields.io/badge/License-MIT%20OR%20Apache--2.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Release-v1.0.0-gold.svg)](https://github.com/aayyaz3d-166/ONE-language-/releases)
[![Platform](https://img.shields.io/badge/Platform-Windows%20x64-lightgrey.svg)](#system-requirements-windows)
[![VS Code](https://img.shields.io/badge/VS%20Code-Extension%20Available-purple.svg)](#visual-studio-code-extension-installation)

<br/>

<img src="assets/ONE-Language-Logo.png" alt="ONE Language Official Logo" width="220" />

<br/>
<br/>

</div>

---

## 🏛️ What is ONE Language?

**ONE Language** is a next-generation deterministic spatial programming language and sovereign computing architecture. Built from first principles to provide verifiable execution, rigorous safety boundaries, and high-performance computing, ONE replaces uncontrolled mutation and unpredictable concurrency with:

- **Harmonic Spatial Scheduling:** Structured actor scheduling with deterministic time horizons and strict resource containment.
- **Fail-Closed Hardware Actuation Lock:** Permanent safety guarantees (`actuationLock: true`) preventing unauthorized external actuation.
- **Address369 Canonical Memory:** Bounded deterministic spatial memory access strictly constrained to indices `[0..368]`.
- **Unified Developer Tooling:** Complete developer workflow with single-command scaffolding, static type checking, execution, bytecode compilation, deterministic formatting, and test automation.
- **Native Visual Studio Code Experience:** Full language server intelligence with real-time diagnostics, completions, hover docs, and syntax highlighting.

---

## 📦 Official v1.0.0 Release Artifacts

| Distribution Asset | Description | Size | Purpose |
| :--- | :--- | :--- | :--- |
| **`one.exe`** | Standalone Windows x64 CLI Executable | ~97 MB | Zero-dependency command-line compiler and VM |
| **`one-language-1.0.0.vsix`** | VS Code Extension Package | ~1.95 MB | Complete IDE language support and syntax highlighting |
| **`one-language-1.0.0-src.zip`** | Official Source Code Archive | ~1.38 MB | Verified, sanitized source release |
| **`ONE-Language-Logo.png`** | Official High-Resolution Brand Logo | 324 KB | Silver-and-gold triangular seal (1024×1024) |

---

## 💻 System Requirements (Windows)

- **Operating System:** Windows 10 (64-bit) or Windows 11 (64-bit).
- **Standalone Mode (`one.exe`):** No external runtimes or prerequisites required.
- **Developer / Source Mode:** Node.js $\ge$ 18.0.0 LTS and npm installed if building or running directly from TypeScript sources.
- **Editor (Optional):** Visual Studio Code $\ge$ 1.80.0 for IDE integration.

---

## 🚀 Quick-Start Guide

### 1. Running via Standalone Native Binary (`one.exe`)

Download `one.exe` from the [Releases](https://github.com/aayyaz3d-166/ONE-language-/releases) section and verify from PowerShell:

```powershell
# Verify CLI help
.\one.exe --help

# Execute an inline ONE expression immediately
.\one.exe run -e "let a = 21; let b = 2; print('Result: ' + string(a * b));"
```

### 2. Scaffold a New Project

Scaffold an idiomatic ONE project directory structure:

```powershell
.\one.exe init my-first-one-app
cd my-first-one-app
```

This creates:
- `one.project.json` — Project configuration manifest
- `src/main.one` — Entrypoint source file

### 3. Write ONE Language Code

Open `src/main.one` in your editor:

```one
module Geometry {
  export struct Point {
    x: int,
    y: int
  }

  export function createPoint(x: int, y: int): Point {
    let p = Point { x: x, y: y };
    return p;
  }
}

function main(): int {
  let pt = Geometry.createPoint(10, 20);
  print("Initialized point at x=" + string(pt.x) + ", y=" + string(pt.y));
  return 0;
}

main();
```

### 4. Check and Run

```powershell
# Perform static type checking and syntax validation without execution
.\one.exe check src/main.one

# Compile and execute on the UnifiedVM
.\one.exe run src/main.one
```

---

## 🛠️ Supported Developer CLI Commands

The `one` CLI provides six primary developer commands:

| Command | Usage | Description |
| :--- | :--- | :--- |
| **`init`** | `one init [dir]` | Scaffolds a new ONE Language project with manifest and starter source. |
| **`run`** | `one run <file.one>`<br/>`one run -e "<code>"` | Compiles and executes a ONE program on the UnifiedVM, or evaluates inline code. |
| **`check`** | `one check <file.one>` | Statically verifies syntax, scopes, and types without runtime execution. |
| **`build`** | `one build <file.one>` | Compiles ONE source code into a packaged Intermediate Representation (IR) artifact. |
| **`format`** | `one format <file.one>`<br/>`one format <file.one> --write` | Formats ONE source code deterministically (use `--write` to format in-place). |
| **`test`** | `one test [dir]` | Discovers and executes all `*.test.one` test suites in the target directory. |

---

## 🧩 Visual Studio Code Extension Installation

The ONE Language extension provides rich IDE language support for `.one` files.

### Option A: Install via VS Code Command Line (Recommended)
```powershell
code --install-extension one-language-1.0.0.vsix
```

### Option B: Install via Visual Studio Code UI
1. Launch Visual Studio Code.
2. Open the Extensions sidebar (`Ctrl+Shift+X`).
3. Click the **`...`** (Views and More Actions) menu in the top-right corner of the Extensions panel.
4. Select **Install from VSIX...**
5. Browse to and select `one-language-1.0.0.vsix`.
6. Reload or reopen VS Code. The official silver-and-gold ONE Language icon will appear in your installed extensions list.

### Features Included in the Extension
- **Syntax Highlighting:** TextMate grammar covering statements, declarations, types, modules, directives, and spatial tokens.
- **Language Intelligence:** In-process Language Server (`OneLanguageServer`) emitting syntax, semantic, and type diagnostics.
- **Snippets Catalog:** 16 built-in snippet templates for structs, enums, functions, modules, and spatial constructs.
- **Editor Commands:** `ONE: Run Current File` and `ONE: Check Current File Syntax & Types`.

---

## 🛡️ Core Safety Guarantees & Known Limitations

### 1. Fail-Closed Actuation Lock
- In accordance with sovereign safety guarantees, physical or external actuation directives (`actuate()`) trigger compile-time and runtime diagnostics fail-closed (`actuationLock: true`).

### 2. Address369 Canonical Boundaries
- Low-level addressable memory registers in ONE Language are strictly bounded within the range `[0..368]`. Access outside these indices is rejected fail-closed to prevent spatial buffer overrun.

### 3. Windows PowerShell Execution Policies
- If running development scripts from source using PowerShell, ensure your script execution policy allows local scripts:
  ```powershell
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
  ```

---

## 🧪 Running the Verification Suite (From Source)

For developers contributing to or verifying the ONE Language codebase from source:

```powershell
# Install development dependencies
npm install

# Run compiler and semantic lowering verification suite
node scripts/run-test.cjs tests/compiler/struct_enum_lowering.test.ts

# Package the VS Code extension
node scripts/package-vscode-extension.cjs
```

---

## 📄 License & Contributing

ONE Language is dual-licensed under the **MIT License** and the **Apache License, Version 2.0**:
- [`LICENSE`](LICENSE) — Dual-license summary
- [`LICENSE-MIT`](LICENSE-MIT) — MIT License full text
- [`LICENSE-APACHE`](LICENSE-APACHE) — Apache License 2.0 full text
- [`NOTICE`](NOTICE) — Attribution and legal notice
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — Contributor Covenant and contribution guidelines

Copyright © 2026 Ayyaz3D.
