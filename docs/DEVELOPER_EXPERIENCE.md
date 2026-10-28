# ONE LANGUAGE — SPECIFICATION: DEVELOPER EXPERIENCE (DX)
**Document ID:** `ONE-SPEC-016`  
**Version:** `0.1.0-DX`  
**Status:** `LOCKED / IMPLEMENTED (Phase 4)`  
**Authors:** Senior Developer Experience Architect & Tooling Engineer  

---

## 1. Ergonomic Syntax

ONE Language supports clean, modern, semicolon-free syntax designed for developer speed and clarity:

```one
let name = "Ayyaz"
let age = 29

if age >= 18 {
    print name
}

function add(a, b) {
    return a + b
}
```

- Semicolons are purely optional.
- Parameter and return type annotations are optional and inferred automatically when omitted.
- Full type safety is maintained by static type inference.

---

## 2. Human-Friendly Compiler Diagnostics

The `DiagnosticFormatter` renders structured diagnostic messages with highlighted titles, expected vs. received types, source code frames with caret pointers, and actionable guidance:

```text
[E2001] Type Mismatch Error: Type mismatch

  Expected: number
  Received: string

  Line 4, Column 10:
    4 | result = age + name
                 ^

  Hint: Ensure the assigned value matches the declared variable type, or remove explicit type annotation for automatic inference.
```

---

## 3. Standard Library Foundation

A zero-eval, deterministic foundation of built-in standard library utilities:

- **String (`StdString`):** `length`, `toLowerCase`, `toUpperCase`, `trim`, `split`, `slice`, `replace`, `includes`, `charAt`.
- **Number (`StdNumber`):** `parseInt`, `parseFloat`, `toFixed`, `isNaN`, `isFinite`.
- **Boolean (`StdBoolean`):** `parse`, `toString`.
- **Array (`StdArray`):** `length`, `push`, `pop`, `shift`, `unshift`, `join`, `slice`, `indexOf`, `reverse`, `len`.
- **Object (`StdObject`):** `keys`, `values`, `entries`, `hasKey`.
- **Math (`StdMath`):** `abs`, `sqrt`, `pow`, `sin`, `cos`, `tan`, `floor`, `ceil`, `round`, `min`, `max`, `PI`, `E`.
- **JSON (`StdJSON`):** `stringify`, `parse`.
- **DateTime (`StdDateTime`):** `now`, `timestamp`, `iso`.
- **File I/O (`StdIO`):** `readText`, `writeText`, `exists`.

---

## 4. Developer Command Line Interface (CLI)

```bash
# Scaffold a new project
one init my-app

# Run a source file
one run src/main.one

# Static syntax & type check without executing
one check src/main.one

# Compile to intermediate representation artifact
one build src/main.one

# Format code deterministically
one format src/main.one --write

# Run test files
one test
```

---

## 5. Deterministic Code Formatter

`OneFormatter` provides idempotent, deterministic formatting:
- 4-space block indentation.
- Standardized operator spacing (`a + b * c`, `x == y`, `age >= 18`).
- Normalized comma and colon spacing (`add(a, b)`, `x: number`).
- Normalization of `else if` and `else` blocks (`} else if {`, `} else {`).
- Complete preservation of declarative spatial directives (`@Space`, `node`, `funnel`, `seal`).
- Guaranteed idempotence: `format(format(src)) === format(src)`.

---

## 6. Language Server Protocol (LSP) Foundation

- **Diagnostics:** Full syntax, semantic, and type diagnostic reporting with exact ranges.
- **Completions:** Contextual keyword suggestions, standard library built-ins, and declared local symbols.
- **Hover:** Markdown documentation with inferred types, parameter lists, and keyword docstrings.
- **Go-to-Definition:** Symbol definition lookup resolving identifiers to their declaration spans.
