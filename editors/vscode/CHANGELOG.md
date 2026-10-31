# Changelog

All notable changes to the ONE Language Visual Studio Code extension will be documented in this file.

## [1.5.0] - 2026-10-31

### 🔮 Sovereign 3-6-9 Branching Tokenizer & Vocabulary Engine
- **Sovereign 3-6-9 Tokenizer:** Zero third-party cloud/npm dependencies (no HuggingFace, no TikToken). Pure sovereign mathematical tokenization.
- **Vortex Branching Hierarchy:** Mathematical tokens representing the central 3-6-9 spine:
  - Branch (1, 2) -> Anchor 3 (Input & Observation -> Foundation)
  - Branch (4, 5) -> Anchor 6 (Context & Memory -> Process & Logic)
  - Branch (7, 8) -> Anchor 9 (Analysis & Verification -> Singularity)
- **High-Capacity Vocabulary (8,192 Tokens):** Exact power-of-2 boundary ($2^{13}$) with deterministic SHA-256 manifest hash `20d87a8714cf4447e7320aa58c4b15a443792aede85faf6984f1105badac0c89`.
- **100% Roundtrip Text Fidelity:** Guaranteed zero `<UNK>` tokens on standard English dialogue, complete ASCII 0..127 safety floor, and exact bit-level decoding.
- **High Performance Int32Array Buffers:** Direct C-speed tensor buffer serialization for model training and real-time inference.

## [1.4.0] - 2026-10-30

### 🌐 OLTO Native Reactive Frontend Subsystem & AI App Generator
- **OLTO Language Support:** Added syntax highlighting (`olto.tmLanguage.json`), bracket matching, and auto-closing configuration for `.olto` files.
- **Declarative Reactive Components:** Full IDE support for `component`, `page`, `state`, `computed`, `action`, and standard UI primitives.
- **Standard UI Snippets:** Built-in snippets `olto-comp`, `olto-page`, `olto-state`, `olto-computed`, and `olto-action`.
- **ECHO-1 AI Bridge:** Query ECHO-1 to generate complete frontend apps from natural language (`one olto ai "..."`).
- **Live-Reload Development Server:** Launch instant-recompile server via `one olto dev <file.olto>`.
- **Zero-Dependency Web Bundling:** One-click compilation to standalone zero-dependency HTML applications.
- **Sovereign Service Bridge:** Seamless typed RPC/IPC connecting OLTO frontends with backend `.one` services.

## [1.3.1] - 2026-10-29

### 🤖 Built-in ECHO-1 Autonomous Offline AI Copilot & Visual Studio Marketplace Release
- **All-in-One Self-Contained VSIX:** Complete embedded 24.56 MB local AI model (`echo1_best_loss.cubiomodel`) included directly inside extension package.
- **Dedicated Sidebar Panel:** ONE Language Studio Activity Bar with instant AI queries and quick syntax guides.
- **100% Offline Local CPU Inference:** Zero cloud API or internet requirement.

## [1.3.0] - 2026-10-29

### 🤖 Built-in ECHO-1 Autonomous Offline AI Copilot
- **100% Offline Local Neural Intelligence:** Embedded the complete 4.89M parameter neural model checkpoint (`echo1_best_loss.cubiomodel`, 24.56 MB) directly inside the extension package. Zero cloud or external API calls required.
- **Global Keybinding (`Ctrl+Shift+I` / `Cmd+Shift+I`):** Instant prompt dialog to query ECHO-1 for ONE Language syntax, functions, spatial computing, or architecture questions.
- **One-Click Code Insertion:** Directly insert generated code snippets into the active editor or copy them to clipboard.
- **Status Bar Integration:** Added `$(sparkle) Ask ECHO-1` quick launcher on the VS Code status bar.
- **Smart Compiler Error Auto-Fixer:** Automatically intercepts compiler syntax errors (`E1001` - `E1016`) and runtime errors, providing clear explanations and actionable fix recommendations.
- **Activity Bar Panel:** Added dedicated **ECHO-1 Offline AI Assistant** sidebar panel with quick syntax guides, model architecture inspection, and instant queries.

## [1.2.0] - 2026-10-28

### 🚀 Qplayer Runtime & One Binary Intelligence (.obi)
- **Qplayer Execution Engine:** Added support for executing high-throughput register VM bytecodes at up to 204.08M ops/sec.
- **Status Bar Engine Switcher:** One-click engine switching between **Qplayer Runtime** and **UnifiedVM**.
- **Compact Bytecode Packaging:** Build and run ultra-compact One Binary Intelligence (`.obi`) containers (~95 to 110 bytes, 94.9% bytecode reduction).
- **Activity Bar Studio:** Added "Environments & Runtimes", "Packages & Substrates", and "Spatial Memory & Safety" sidebar panels.

## [1.0.1] - 2026-10-28

### Added
- Syntax highlighting grammar for ONE Language v1.0.1 commands:
  - Variable declaration (`one's name = value;`)
  - Variable mutation (`one set name = value;`)
  - Output statement (`one out expression;`)
  - Input statement (`one in target;`)
  - Increment / Decrement (`one up name [by expr];`, `one down name [by expr];`)
  - Conditionals (`one if condition { ... } one else { ... }`)
  - Loops (`one repeat count { ... }`, `one repeat while condition { ... }`)
  - Loop break (`one stop;`)
  - Function definitions (`one make name(...) { ... }`)
  - Return / Completion (`one way expr;`, `one done;`)
  - Equality operator (`left one is right`)
- 16 new code snippets for all v1.0.1 command syntax patterns.

## [1.0.0] - 2026-10-26

### Added
- Initial release of ONE Language extension for Visual Studio Code.
- `.one` file association and language configuration (comments, brackets, auto-closing pairs).
- Comprehensive TextMate grammar for keywords, spatial directives, structs, enums, strings, and operators.
- 16 productivity code snippets for functions, structs, enums, loops, spatial nodes, and channels.
- Integrated diagnostics provider powered by `OneLanguageServer`.
- Intelligent autocomplete, hover documentation, and go-to-definition providers.
- Integrated editor commands: `ONE: Run Current File` and `ONE: Check Current File Syntax & Types`.
