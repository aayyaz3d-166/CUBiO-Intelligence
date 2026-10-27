# ONE Language v1.0.1 Release Notes

**Release Version:** `1.0.1`  
**Date:** October 28, 2026  
**Architecture:** ONE Language Core Compiler, VM, Native Execution Engine, and Tooling  
**Compatibility Baseline:** v1.0.0 (`2cf25533c5165964f4757cf1f660c991d3e628ed`)  

---

## Overview

ONE Language version 1.0.1 introduces a simpler, natural-language-inspired minimal command syntax alongside fail-closed I/O safeguards, enhanced loop control, and upgraded editor tooling, while maintaining 100% backward compatibility with canonical v1.0.0 programs.

---

## Key Features & Enhancements

### 1. Minimal Command Syntax
Version 1.0.1 introduces intuitive top-level command keywords that lower directly into the existing canonical AST and IR representation:

- **Variable Declaration (`one's`):**
  ```one
  one's counter = 0;
  one's limit: int = 100;
  ```
- **Variable Mutation (`one set`):**
  ```one
  one set counter = counter + 1;
  ```
- **Standard Output (`one out`):**
  ```one
  one out counter;
  one out "Process completed";
  ```
- **Standard Input (`one in`):**
  ```one
  one in username;
  ```
- **Increment / Decrement (`one up`, `one down`):**
  ```one
  one up counter;          // counter += 1
  one up counter by 5;     // counter += 5
  one down counter by 2;   // counter -= 2
  ```
- **Conditionals (`one if`, `one else`):**
  ```one
  one if counter > 10 {
    one out "Above threshold";
  } one else {
    one out "Within bounds";
  }
  ```
- **Bounded & Conditional Loops (`one repeat`):**
  ```one
  one repeat 5 {
    one out "Repeating fixed count";
  }

  one repeat while counter < 10 {
    one up counter;
  }
  ```
- **Loop Control (`one stop`):**
  ```one
  one repeat while true {
    one up counter;
    one if counter one is 5 {
      one stop;
    }
  }
  ```
- **Functions & Returns (`one make`, `one way`, `one done`):**
  ```one
  one make square(n) {
    one way n * n;
  }

  one make log_header() {
    one out "=== Header ===";
    one done;
  }
  ```
- **Equality Comparison Operator (`one is`):**
  ```one
  one if status one is "READY" {
    one out "System armed";
  }
  ```

---

### 2. Fail-Closed Input Handling (`E5012`)
The `INPUT` opcode implementation in `UnifiedVM` has been hardened to eliminate silent empty string fabrication:
- Consumes mock inputs from a FIFO queue when provided.
- Dispatches to custom input handlers when configured.
- When inputs are absent or queues exhausted, execution halts fail-closed with runtime error `E5012`:
  `[E5012] Input stream exhausted: no mock inputs or input handler available`.
- Preserves explicit empty string inputs (`""`) provided by callers.
- Scoping rules correctly isolate local function variables from global scope during input binding.

---

### 3. Diagnostic Consistency & Parser Fail-Fast
- `one stop;` used outside loop constructs is rejected at compile time with normalized syntax error:
  `[E1016: Syntax Error] 'one stop' can only be used inside a loop`.
- Programmatic AST construction is guarded by semantic diagnostic `E3010`.

---

### 4. Developer Experience & VS Code Extension v1.0.1
- **Official Icon:** The VS Code extension includes the official high-resolution `ONE-Language-Logo.png`.
- **TextMate Highlighting:** Full syntax highlighting for all v1.0.1 commands and keywords.
- **Snippets:** 16 context-aware code snippets for rapid authoring of v1.0.1 constructs.
- **Development CLI Runner:** Non-destructive `npm run one:dev` runner allows local testing without modifying the immutable release bundle.

---

## Backward Compatibility & Invariants

- **Full Backward Compatibility:** All existing v1.0.0 programs using canonical C-style syntax (`let`, `const`, `fn`, `function`, `print`, `if/else`, `while`, `return`) compile and execute identically.
- **Address369 Boundaries:** Canonical spatial addressing boundaries `[0..368]` remain 100% preserved.
- **Actuation Lock:** The strict `actuationLock: true` invariant remains active across all runtime execution paths.
- **Determinism:** Bit-exact determinism $\sigma^2 = 0.0$ is verified across all test suites.
