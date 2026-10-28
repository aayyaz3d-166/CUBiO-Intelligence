# ONE LANGUAGE — PHASE 2 ARCHITECTURE & INTEGRATION SPECIFICATION
**Document Version:** 1.0.0  
**Phase:** Phase 2 Unified Compiler  
**Audit Standard:** Forensic Code, Tests, and Runtime Evidence Verification  
**Rule:** `CODE + TESTS + RUNTIME EVIDENCE > DOCUMENTATION > CLAIMS`  

---

## 1. Executive Summary

Phase 2 establishes the **Unified Compiler Architecture** for ONE Language. Prior to this phase, the repository possessed a verified Declarative Spatial DSL compiler for spatial coordinates, but general-purpose programming constructs (`let`, `function`, `if`, `while`, expressions) lived only as syntax tokens without an active compiler pipeline.

Phase 2 achieves the unified compilation pipeline:
```text
SOURCE
  ↓
OneLexer (Preserved & Extended)
  ↓
Token Stream
  ↓
Grammar Router (Deterministic Token Inspection)
  ↓
┌───────────────────────────────┐
│                               │
▼                               ▼
Declarative Parser       Computational Parser
(OneParser)              (ComputationalParser)
│                               │
└───────────────┬───────────────┘
                ↓
           Unified AST
                ↓
        Semantic Analysis (Scoped Symbol Table & Checks)
                ↓
           Type Checker (Static Type Inference & E2000 Errors)
                ↓
           IR Lowering (Linearized Intermediate Representation)
                ↓
            Unified IR
```

---

## 2. Core Pillars of Phase 2

### 2.1 Grammar Router
- Token-based deterministic classification (`src/one/router/GrammarRouter.ts`).
- Declarative tokens (`node`, `funnel`, `channel`, `rss_max`, `@Space`, `@Grid777`, `@memview`, `@Slice`, `@seal`) dispatch to `OneParser`.
- Computational tokens (`let`, `const`, `function`, `fn`, `if`, `while`, `for`, `return`, `print`, `import`) dispatch to `ComputationalParser`.
- Ambiguities resolve cleanly through leading token inspection.

### 2.2 Computational Parser & Pratt Expression Parser
- Located in `src/one/computational/ComputationalParser.ts`.
- Implements Pratt parsing with 11 formal precedence levels (`LOWEST` to `MEMBER`).
- Supports variables, constants, functions, if-else, while, for-in, arrays, objects, and expressions.
- Strictly avoids `eval()` or `Function()` constructor.

### 2.3 Canonical Unified AST
- Located in `src/one/ast/UnifiedAST.ts`.
- Provides uniform interfaces for programs, statements, expressions, and declarative nodes.
- Attaches `SourceSpan` (line, column) for precise diagnostics.
- `DeclarativeASTAdapter` (`src/one/ast/DeclarativeASTAdapter.ts`) adapts preexisting Declarative AST into Unified AST with bit-exact preservation.

### 2.4 Hierarchical Symbol Table & Semantic Analysis
- Located in `src/one/semantics/`.
- Scopes: Global, Function, Block.
- Checks: Undefined variables (`E3004`), duplicate definitions (`E3001`), parameter duplicates (`E3002`), arity mismatch (`E3005`), illegal top-level returns (`E3003`), constant reassignment (`E3008`), duplicate imports (`E3007`).

### 2.5 Static Type Checker
- Located in `src/one/types/`.
- Static typing covering `number`, `string`, `boolean`, `null`, `array`, `object`, `function`, `void`, `any`.
- Enforces explicit conversion rules (no silent number + string arithmetic).
- Emits structured `E2000`-series diagnostics.

### 2.6 Unified Intermediate Representation (IR)
- Located in `src/one/ir/`.
- Instructions: `CONST`, `LOAD`, `STORE`, `MOVE`, `ADD`, `SUB`, `MUL`, `DIV`, `MOD`, `CMP`, `CALL`, `RETURN`, `JUMP`, `JUMP_IF`, `PRINT`, `SPATIAL_OP`.
- Formatted disassembly available through `IRPrinter`.

---

## 3. Strict Boundary Enforcements

1. **Declarative DSL Preservation:** Preexisting Declarative DSL scripts run without any modification or syntax changes.
2. **Phase 3 Boundary:** VM execution of general-purpose arithmetic instructions is deferred to Phase 3. The compiler emits valid, typed IR ready for VM integration.
3. **Deterministic Spatial Execution:** Address369 slot algebra, 7x7x7 quantization, zero-variance ($\sigma^2=0.0$), and fail-closed actuation locks are fully preserved.
