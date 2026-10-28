# ONE LANGUAGE — GRAMMAR ROUTER SPECIFICATION
**Document Version:** 1.0.0  
**Phase:** Phase 2 Unified Compiler Lock  
**Standard:** Deterministic Token-Based Grammar Routing  
**Rule:** `CODE + TESTS + RUNTIME EVIDENCE > DOCUMENTATION > CLAIMS`  

---

## 1. Executive Summary

The **Grammar Router** is the front-line classification and dispatch engine of the ONE Language Unified Compiler pipeline. It accepts a raw token stream from `OneLexer` and deterministically routes the program to either:
1. **Declarative Spatial Parser** (`src/one/oneParser.ts`)
2. **Computational Systems Parser** (`src/one/computational/ComputationalParser.ts`)

The Grammar Router guarantees **100% backward compatibility** with preexisting Declarative Spatial DSL syntax while safely unlocking the Computational Programming Language.

---

## 2. Architectural Architecture

```text
Source Code (.one)
       │
       ▼
   OneLexer
       │
       ▼
  Token Stream
       │
       ▼
 ┌───────────────────────────────┐
 │        Grammar Router         │
 │ (Deterministic Token Analysis)│
 └───────────────┬───────────────┘
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
 Declarative Parser   Computational Parser
 (OneParser)          (ComputationalParser)
       │                   │
       ▼                   ▼
 Declarative AST      Computational AST
       │                   │
       └─────────┬─────────┘
                 ▼
          Unified AST
```

---

## 3. Strict Routing Rules

The router operates strictly on token kinds and values. It **NEVER** uses heuristic guessing, regex patterns on source strings, or non-deterministic mechanisms.

### 3.1 Declarative Grammar Trigger Tokens
If the token stream's leading significant tokens contain any of the following spatial/declarative keywords, the program is routed to the **Declarative Spatial Parser**:

| Token Type | Keyword / Token | Declarative Purpose |
| :--- | :--- | :--- |
| `KEYWORD_NODE` | `node` | Spatial node declaration with coordinates |
| `KEYWORD_FUNNEL` | `funnel` | Unidirectional memory stream definition |
| `KEYWORD_CHANNEL` | `channel` | P2P gossip mesh channel definition |
| `KEYWORD_RSS_MAX` | `rss_max` | Global physical RSS ceiling (MB) |
| `KEYWORD_ASSERT_RSS`| `@assert_rss` | Compile-time static allocation assertion |
| `KEYWORD_ACTUATION_LOCK`| `@actuation_lock` | Zero-trust fail-closed hardware lock |
| `KEYWORD_SLICE` | `@Slice` | Spatial bounding-box query slice |
| `KEYWORD_SEAL` | `seal` / `@seal` | Cryptographic state snapshot seal |
| `KEYWORD_SPACE` | `@Space` | Continuous $[0,1]^3$ coordinate binding |
| `KEYWORD_GRID777` | `@Grid777` | Discrete $7\times 7\times 7$ voxel quantization |
| `KEYWORD_MEMVIEW` | `@memview` | Zero-copy shared memory buffer slice |

### 3.2 Computational Grammar Trigger Tokens
If the token stream's leading significant tokens contain any of the following general computational keywords, the program is routed to the **Computational Parser**:

| Token Type | Keyword | Computational Purpose |
| :--- | :--- | :--- |
| `KEYWORD_LET` | `let` | Mutable variable declaration |
| `KEYWORD_CONST` | `const` | Immutable constant declaration |
| `KEYWORD_FUNCTION` / `KEYWORD_FN` | `function`, `fn` | Function declaration |
| `KEYWORD_RETURN` | `return` | Function return statement |
| `KEYWORD_IF` | `if` | Conditional branching statement |
| `KEYWORD_ELSE` | `else` | Conditional alternative branch |
| `KEYWORD_WHILE` | `while` | Pre-condition loop construct |
| `KEYWORD_FOR` | `for` | Collection iterator loop construct |
| `KEYWORD_PRINT` | `print` | Standard output / telemetry emission |
| `KEYWORD_IMPORT` | `import` | Module import declaration |
| `KEYWORD_MODULE` | `module` | Sovereign module namespace |
| `KEYWORD_STRUCT` | `struct` | Composite record layout |
| `KEYWORD_CLASS` | `class` | Sovereign system class |
| `KEYWORD_NATIVE` | `native` | Hardware/bare-metal binding |

### 3.3 Expressions and Ambiguity Resolution
- If the program begins with an expression (such as an identifier, number, string, array `[`, or object `{`), it is routed to the **Computational Parser**.
- If the token stream is empty or contains only comments/whitespace, it defaults to an empty **Computational** program.
- If a syntax sequence cannot be parsed by the selected parser, the parser emits an official `E1000`-series diagnostic rather than guessing or silently mutating the AST.

---

## 4. Verification Evidence

The routing engine is verified by test suite `test_phase2_unified_compiler.ts`:
- `UC01`: Proves spatial node declaration routes to Declarative Parser.
- `UC02`: Proves `let` declaration routes to Computational Parser.
- `UC03`: Proves `function` declaration routes to Computational Parser.
- `UC04`: Proves `rss_max` directive routes to Declarative Parser.
- `UC05`: Proves `print` statement routes to Computational Parser.
- `UC41`: Proves comprehensive Declarative Spatial DSL script compiles seamlessly through the unified router.
