# ONE LANGUAGE — EVOLUTION ROADMAP (v0.1 TO v1.0)
**Specification Lock:** Phase 1  
**Authority:** Language Architect & Core Engineering Steering Committee

---

## 1. Phase Progression Overview

```text
┌────────────────────────────────────────────────────────┐
│  Phase 1: Language Specification v0.1 & Contract Lock  │  ◄── [CURRENT]
├────────────────────────────────────────────────────────┤
│  Phase 2: Universal Parser Unification & Expressions   │
├────────────────────────────────────────────────────────┤
│  Phase 3: Functions, Scopes & Computational VM Opcodes │
├────────────────────────────────────────────────────────┤
│  Phase 4: Native Module Packaging & Standard Library   │
├────────────────────────────────────────────────────────┤
│  Phase 5: Developer Toolchain, LSP & Interactive Web   │
├────────────────────────────────────────────────────────┤
│  Phase 6: Production Ecosystem & Silicon Synthesis     │
└────────────────────────────────────────────────────────┘
```

---

## 2. Milestone Deliverables

### Phase 1: Specification v0.1 & Baseline Lock (Current)
- Complete baseline audit (427/427 tests verified).
- Official contracts established: `ONE_LANGUAGE_SPEC_v0.1.md`, `BACKWARD_COMPATIBILITY.md`, `KEYWORDS.md`, `TYPES.md`, `SYNTAX.md`, `SEMANTICS.md`, `AST.md`, `COMPILER.md`, `RUNTIME.md`, `ERROR_MODEL.md`, `SECURITY_MODEL.md`, `VERSIONING.md`.
- Conformance test suite establishing golden contract fixtures.

### Phase 2: Universal Parser Unification
- Extend `OneParser.ts` to parse `module`, `struct`, `let`, `const`, and arithmetic expressions.
- Parse all canonical `.one` programs in `src/one/programs/` directly into structured ASTs.
- Eliminate ad-hoc string regex matching in companion compilers.

### Phase 3: Computational Virtual Machine
- Implement arithmetic (`OP_ADD`, `OP_SUB`, etc.) and variable storage opcodes in `CubiOVirtualMachine.ts`.
- Introduce lexical scopes and function activation frames.

### Phase 4: Native Module Packaging & Standard Library
- Formalize import/export semantics across multi-file ONE programs.
- Expose power grid dynamics, wave slowdown, and QED photon flux as first-class standard library modules.

### Phase 5: Developer Experience, LSP & Web Engine
- Build Language Server Protocol (LSP) providing real-time syntax highlighting, type checking, and hover documentation.
- Implement zero-dependency web playground for browser execution.

### Phase 6: Production Ecosystem & Silicon Synthesis
- True RISC-V 64 freestanding machine code compilation.
- Complete synthesizable Verilog processor core.
