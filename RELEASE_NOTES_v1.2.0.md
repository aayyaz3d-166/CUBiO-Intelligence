# ONE Language Release Notes — v1.2.0 Stable
**Release Date**: October 28, 2026  
**Status**: Certified Production Stable Distribution  
**Key Feature**: Qplayer Execution Architecture & One Binary Intelligence (OBI v1.0)

---

## What's New in v1.2.0

### 1. Qplayer Execution Runtime
* Introduced **Qplayer**, a next-generation computational execution engine for ONE Language.
* Replaces flat linear execution with a **Dependency-Directed Computational Graph (DAG)**.
* Built-in semantics-preserving logic optimizer featuring compile-time constant folding and dead-code elimination.
* Throughput benchmark: **7,709,336 instructions per second** (~7.7M ops/sec).

### 2. One Binary Intelligence (OBI v1.0) Format
* Custom virtual instruction format utilizing bit-packed 32-bit words:
  * **3-bit Category**: 8 major execution domains.
  * **6-bit Opcode**: 64 specialized operations per domain.
  * **9-bit Harmonic Operand**: Virtual registers ($r_0..r_{511}$) and harmonic values, directly accommodating Address369 ($0..368$).
* CRC32 cryptographic checksum integrity on instruction streams.
* **~93.8% to 94.9% reduction in binary file size** compared to JSON IR containers.

### 3. Dual-Engine Developer CLI
* `one run <file.one>`: Executes with canonical UnifiedVM.
* `one run <file.one> --engine=qplayer`: Executes with high-throughput Qplayer engine.
* `one build <file.one> --target=obi`: Compiles ONE source directly into standalone `.obi` binary.
* `one run <file.obi>`: Directly executes compiled `.obi` binaries.

### 4. VS Code Extension v1.2.0
* Upgraded extension to `v1.2.0` with 11 registered commands.
* Dedicated actions: Run with Qplayer, Build .obi, Run .obi.
* Status Bar quick menu: `$(zap) ONE v1.2.0`.
* Complete Language Server Protocol intelligence (diagnostics, autocomplete, hover, formatting, document symbols).

### 5. Verified Safety Invariants
* Permanent enforcement of `ACTUATION_LOCK`.
* Address369 boundaries ($[0..368]$) strictly validated with `E8005` error handling.
* Zero regressions against historical v1.0.0 and v1.1.0 baselines.
