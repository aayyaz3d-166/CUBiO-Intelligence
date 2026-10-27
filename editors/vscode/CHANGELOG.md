# Changelog

All notable changes to the ONE Language Visual Studio Code extension will be documented in this file.

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
- 16 new code snippets for all v1.0.1 command syntax patterns (`ones`, `oneset`, `oneout`, `onein`, `oneup`, `onedown`, `oneif`, `onerepeat`, `onerepeatwhile`, `onestop`, `onemake`, `oneway`, `onedone`, `oneis`).
- Official ONE Language icon registered in extension manifest.

## [1.0.0] - 2026-10-26

### Added
- Initial release of ONE Language extension for Visual Studio Code.
- `.one` file association and language configuration (comments, brackets, auto-closing pairs).
- Comprehensive TextMate grammar for keywords, spatial directives, structs, enums, strings, and operators.
- 16 productivity code snippets for functions, structs, enums, loops, spatial nodes, and channels.
- Integrated diagnostics provider powered by `OneLanguageServer`.
- Intelligent autocomplete, hover documentation, and go-to-definition providers.
- Integrated editor commands: `ONE: Run Current File` and `ONE: Check Current File Syntax & Types`.
