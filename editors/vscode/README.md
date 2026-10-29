<div align="center">

<img src="https://raw.githubusercontent.com/aayyaz3d-166/CUBiO-Intelligence/main/assets/ONE-Language-Logo.png" alt="ONE Language Logo" width="160" style="margin-bottom: 12px;"/>

# ONE Language for Visual Studio Code
### The Official Language Pack with Built-In Offline AI Assistant (ECHO-1)

[![Version](https://img.shields.io/badge/version-1.3.0--stable-blue.svg?style=for-the-badge&logo=visualstudiocode)](https://github.com/aayyaz3d-166/CUBiO-Intelligence)
[![AI Assistant](https://img.shields.io/badge/ECHO--1-100%25%20Offline%20AI-success.svg?style=for-the-badge&logo=sparkles)](https://github.com/aayyaz3d-166/CUBiO-Intelligence)
[![Embedded Brain](https://img.shields.io/badge/Model-24.56%20MB%20Local-purple.svg?style=for-the-badge)](https://github.com/aayyaz3d-166/CUBiO-Intelligence)
[![License](https://img.shields.io/badge/license-MIT%20%7C%20Apache--2.0-lightgrey.svg?style=for-the-badge)](LICENSE)

<br/>

Delivering a professional, all-in-one developer environment for **ONE Language** (`.one`) featuring built-in offline artificial intelligence, compiler diagnostics, syntax highlighting, autocompletion, hover docs, and one-click execution.

</div>

---

## 🤖 Built-in ECHO-1 Offline AI Copilot

Unlike extensions that require external API keys, OpenAI accounts, or active internet connections, **ONE Language v1.3.0 carries its own 24.56 MB neural model directly inside this extension**.

### How to use ECHO-1:
1. **Global Shortcut**: Press `Ctrl + Shift + I` (or `Cmd + Shift + I` on macOS) anywhere in VS Code.
2. **Status Bar**: Click the **`$(sparkle) Ask ECHO-1`** item at the bottom right.
3. **One-Click Insert**: Choose **"Insert into Editor"** to immediately paste generated code snippets.

```mermaid
graph LR
    User["Developer (Ctrl+Shift+I)"] --> Prompt["Prompt: 'how to declare variables?'"]
    Prompt --> ECHO1["ECHO-1 Neural Subsystem (100% Offline)"]
    ECHO1 --> Snippet["Generated Code + Roman Urdu Tip (~50ms)"]
    Snippet --> Editor["Insert into Active Editor"]
```

---

## ✨ Features

### 1. 🎨 Full TextMate Syntax Highlighting
* **Spatial Directives:** `@Space`, `@Grid777`, `@Slice`, `@memview`, `@seal`, `@gossip`, `@actuation_lock`
* **Declarations:** `let`, `const`, `struct`, `enum`, `class`, `function`, `fn`, `native`
* **Control Flow & Async:** `if`, `else`, `while`, `for`, `return`, `async`, `await`
* **Multi-File Modules:** `module`, `import`, `export`, `from`, `as`

### 2. ⚡ Real-Time Compiler Diagnostics & Smart Auto-Fixer
* Instant error highlighting on edit and save (`checkOnSave: true`).
* Intercepts `E1001`-`E1016` syntax errors and provides actionable fix guidance powered by ECHO-1.
* Invariant validation for `ACTUATION_LOCK` and Address369 boundary guards (`[0..368]`).

### 3. 🔍 Autocomplete, Hover Docs & Outline
* **Contextual Suggestions:** Keywords, spatial primitives, and standard library functions (`len`, `push`, `pop`, `readFile`, `writeFile`).
* **Hover Tooltips:** Rich markdown hover documentation for keywords, types, and function signatures.
* **Document Outline:** Jump between functions, structs, and variables with the Symbol Outline view.

### 4. 🚀 Execution & Qplayer Engine Switcher
* **Switch Engine with 1 Click:** Toggle between **Qplayer Runtime** (204M ops/sec fast `.obi` execution) and **UnifiedVM** (Address369 deterministic spatial memory).
* **One-Click Run:** Press `Ctrl + F5` to run the active file instantly.
* **Build Containers:** Press `Ctrl + Shift + B` to compile to `.ox` or `.obi`.

---

## ⌨️ Default Keybindings

| Command | Shortcut (Windows/Linux) | Shortcut (macOS) | Description |
| :--- | :--- | :--- | :--- |
| **Ask ECHO-1 Copilot** | `Ctrl + Shift + I` | `Cmd + Shift + I` | Query the 100% offline AI Assistant |
| **Run Current File** | `Ctrl + F5` | `Cmd + F5` | Execute active `.one` document |
| **Check Syntax & Types** | `Shift + F5` | `Shift + F5` | Static type analysis & linting |
| **Build Executable** | `Ctrl + Shift + B` | `Cmd + Shift + B` | Compile to standalone container |
| **Format Document** | `Shift + Alt + F` | `Shift + Option + F` | Deterministic code formatting |

---

## 📋 Requirements
* Visual Studio Code version **1.80.0** or higher.
* No internet connection or API keys required — ECHO-1 runs 100% locally.

---

## 📜 License
Licensed under either the **Apache License, Version 2.0** or the **MIT License** at your option.
