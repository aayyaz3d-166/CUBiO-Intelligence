# ONE Language for Visual Studio Code

Official Visual Studio Code extension providing rich language intelligence and editing support for **ONE Language** (`.one`) source files.

---

## Features

### 1. Syntax Highlighting
Full TextMate grammar support for the dual declarative-spatial and computational paradigms of ONE Language:
- **Spatial Computing Directives:** `@Space`, `@Grid777`, `@Slice`, `@memview`, `@seal`, `@gossip`, `@assert_rss`, `@actuation_lock`
- **Spatial Declarations:** `node`, `stream`, `align`, `checkpoint`, `seal`, `funnel`, `channel`, `rss_max`
- **Declarations:** `let`, `const`, `struct`, `enum`, `class`, `constructor`, `method`, `function`, `fn`, `native`, `private`, `public`
- **Control Flow & Async:** `if`, `else`, `while`, `for`, `return`, `async`, `await`
- **Multi-File Modules:** `module`, `import`, `export`, `from`, `as`
- **Operators & Flow:** Funnel (`->`), Align (`=>`), comparison, arithmetic, and logical operators
- **Standard Library:** Built-in functions (`len`, `push`, `pop`, `keys`, `values`, `readFile`, `writeFile`, etc.)

### 2. Real-Time Diagnostics
Integrated with ONE Language's compiler and semantic analyzer:
- Instant syntax error detection with line and column highlighting
- Type-checking diagnostics and missing symbol detection
- Actuation lockout and Address369 boundary validation

### 3. Contextual Autocomplete & Completions
- Language keywords and spatial directives
- Standard library built-ins with signatures
- Local variables and functions declared in the current document

### 4. Hover Documentation
- Hover over keywords to view language documentation
- Hover over functions and variables to view inferred types and signatures

### 5. Go-to-Definition
- Jump directly to variable, parameter, and function declarations in the file

### 6. Rich Code Snippets
Built-in snippets for rapid development:
- `fn` / `fn-async`: Function declarations
- `struct`: Data struct definitions
- `enum`: Numeric/symbolic enums
- `node`: 343-voxel spatial node definitions
- `channel`: Gossip channel connections
- `seal`: Merkle state checkpoints and cryptographic seals
- `import` / `export`: Multi-file module statements

### 7. Editor Commands
- `ONE: Run Current File` — Execute the active `.one` file on UnifiedVM
- `ONE: Check Current File Syntax & Types` — Run static type checking and analysis

---

## Requirements
- Visual Studio Code version **1.80.0** or higher.

---

## Known Limitations
- **Language Server Architecture:** Language intelligence operates via an integrated in-process compiler engine (`OneLanguageServer`). Standalone JSON-RPC stdio daemon support is planned for future distributed tooling releases.
- **Cross-File Definition Jumps:** Go-to-definition currently navigates symbols within the active workspace document.

---

## License
MIT OR Apache-2.0
