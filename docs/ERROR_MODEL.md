# ONE LANGUAGE — ERROR MODEL SPECIFICATION v0.1
**Specification Lock:** Phase 1  
**Authority:** Compiler Engineer & Quality Architect

---

## 1. Diagnostic Formatting Standard

All ONE LANGUAGE compiler and runtime errors adhere to a structured, human-readable format:

```text
[ERROR_CODE]: Description of error

  Line <L>, Column <C>:
    <Source Line Snippet>
    ^^^^^

Hint: Actionable suggestion for the developer.
```

---

## 2. Canonical Error Categories

### 2.1 Lexical Errors (`E1000..E1999`)
- `E1001`: Unexpected character in input stream.
- `E1002`: Unterminated string literal.
- `E1003`: Invalid numerical format.

### 2.2 Syntax / Parser Errors (`E2000..E2999`)
- `E2001`: Unexpected token encountered during parsing.
- `E2002`: Missing semicolon after directive.
- `E2003`: Unclosed block delimiter (missing `}` or `)`).
- `E2004`: Invalid property inside node declaration.

### 2.3 Semantic & Spatial Errors (`E3000..E3999`)
- `E3001`: Duplicate spatial node identifier.
- `E3002`: Spatial coordinate out of bounds (must be in $[0.0, 1.0]$).
- `E3003`: Discrete `@Grid777` index out of bounds (must be integer $\in [0..6]$).
- `E3004`: Unresolved stream endpoint (references undefined node).

### 2.4 Resource & Memory Errors (`E4000..E4999`)
- `E4001`: Requested memory cap exceeds physical 512 MB ceiling.
- `E4002`: Total static allocations exceed declared memory budget.
- `E4003`: Dynamic allocation exceeds active `RSSGuard` ceiling.

### 2.5 Security & Hardware Errors (`E5000..E5999`)
- `E5001`: Physical hardware actuation violation (`ActuationBlockedError`).
- `E5002`: Simulated entropy detected in `@NoSimulation` routine.
- `E5003`: Hardware sensor offline / physical telemetry unavailable.
