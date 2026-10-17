/**
 * ONE Language — Language Server Protocol Foundation
 * ===================================================
 * Core language intelligence capabilities:
 *   - Diagnostics (syntax, semantic, and type diagnostics with line/col positions)
 *   - Autocomplete / Code Completion (keywords, standard library APIs, in-scope variables & functions)
 *   - Hover Information (signatures, types, docstrings)
 *   - Go-to-Definition (resolves symbols to their definition declaration spans)
 */

import { UnifiedCompiler } from '../UnifiedCompiler';
import { DiagnosticFormatter } from '../diagnostics/DiagnosticFormatter';
import { ONE_BUILTIN_FUNCTIONS } from '../stdlib/OneStdLib';
import { OneLexer, TokenType } from '../oneLexer';

export interface LSPPosition {
  line: number;
  column: number;
}

export interface LSPRange {
  start: LSPPosition;
  end: LSPPosition;
}

export interface LSPDiagnostic {
  code: string;
  message: string;
  severity: 'Error' | 'Warning' | 'Information';
  range: LSPRange;
  formattedText: string;
}

export interface LSPCompletionItem {
  label: string;
  kind: 'Keyword' | 'Function' | 'Variable' | 'Module' | 'Constant';
  detail?: string;
  documentation?: string;
  insertText?: string;
}

export interface LSPHoverInfo {
  contents: string[];
  range?: LSPRange;
}

export interface LSPLocation {
  uri?: string;
  range: LSPRange;
}

export class OneLanguageServer {
  private compiler: UnifiedCompiler;

  constructor() {
    this.compiler = new UnifiedCompiler({ checkOnly: true });
  }

  /**
   * Get syntax, semantic, and type diagnostics for a source file.
   */
  public getDiagnostics(source: string): LSPDiagnostic[] {
    const res = this.compiler.compile(source);
    const lspDiagnostics: LSPDiagnostic[] = [];

    for (const d of res.diagnostics) {
      const line = d.line || 1;
      const column = d.column || 1;
      lspDiagnostics.push({
        code: d.code,
        message: d.message,
        severity: 'Error',
        range: {
          start: { line, column },
          end: { line, column: column + 1 },
        },
        formattedText: DiagnosticFormatter.format(
          {
            code: d.code,
            message: d.message,
            line,
            column,
            expected: (d as any).expected,
            actual: (d as any).received,
          },
          source
        ),
      });
    }

    return lspDiagnostics;
  }

  /**
   * Provide context-aware code completions at a given cursor position.
   */
  public getCompletions(source: string, _position: LSPPosition): LSPCompletionItem[] {
    const completions: LSPCompletionItem[] = [];

    // 1. Language Keywords
    const keywords = [
      'let', 'const', 'function', 'fn', 'if', 'else', 'while', 'for',
      'in', 'return', 'print', 'import', 'null', 'true', 'false',
      'node', 'funnel', 'channel', 'seal', 'rss_max',
    ];
    for (const kw of keywords) {
      completions.push({
        label: kw,
        kind: 'Keyword',
        detail: `Keyword: ${kw}`,
      });
    }

    // 2. Standard Library Functions
    for (const fnName of Object.keys(ONE_BUILTIN_FUNCTIONS)) {
      completions.push({
        label: fnName,
        kind: 'Function',
        detail: `(builtin) function ${fnName}(...args)`,
        documentation: `Standard library built-in: ${fnName}`,
        insertText: `${fnName}()`,
      });
    }

    // 3. Document symbols (variables and functions declared in source)
    try {
      const lexer = new OneLexer(source);
      const tokens = lexer.tokenize();
      const declaredIdentifiers = new Set<string>();

      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (
          (t.type === TokenType.KEYWORD_LET ||
            t.type === TokenType.KEYWORD_CONST ||
            t.type === TokenType.KEYWORD_FUNCTION ||
            t.type === TokenType.KEYWORD_FN) &&
          i + 1 < tokens.length &&
          tokens[i + 1].type === TokenType.IDENTIFIER
        ) {
          const id = tokens[i + 1].value;
          if (!declaredIdentifiers.has(id)) {
            declaredIdentifiers.add(id);
            const isFn = t.type === TokenType.KEYWORD_FUNCTION || t.type === TokenType.KEYWORD_FN;
            completions.push({
              label: id,
              kind: isFn ? 'Function' : 'Variable',
              detail: `${t.value} ${id}`,
            });
          }
        }
      }
    } catch {
      // Return base completions if lexer encounters errors
    }

    return completions;
  }

  /**
   * Provide hover information (type signature / docs) for word under cursor.
   */
  public getHover(source: string, position: LSPPosition): LSPHoverInfo | null {
    const word = this.getWordAtPosition(source, position);
    if (!word) return null;

    // Check if standard library built-in
    if (word in ONE_BUILTIN_FUNCTIONS) {
      return {
        contents: [
          `\`\`\`one\n(builtin) function ${word}(...args)\n\`\`\``,
          `Standard Library built-in utility.`,
        ],
      };
    }

    // Check if language keyword
    const keywords: Record<string, string> = {
      let: 'Declares a mutable block-scoped variable.',
      const: 'Declares an immutable block-scoped constant.',
      function: 'Declares a callable named function.',
      fn: 'Alias for function declaration.',
      if: 'Conditional branching statement.',
      else: 'Alternative branch for conditional statement.',
      while: 'Repeats execution while condition evaluates to true.',
      for: 'Iterates through elements of an iterable sequence.',
      return: 'Exits function execution returning optional value.',
      print: 'Outputs formatted representation of an expression to standard output.',
      node: 'Declares a spatial computing node within 343-voxel lattice.',
      funnel: 'Establishes streaming pipeline between spatial nodes.',
      channel: 'Configures gossip channel between spatial nodes.',
      seal: 'Emits cryptographic Merkle state seal snapshot.',
    };

    if (keywords[word]) {
      return {
        contents: [`\`\`\`one\nkeyword ${word}\n\`\`\``, keywords[word]],
      };
    }

    // Check user-declared symbols in AST
    const res = this.compiler.compile(source);
    for (const stmt of res.ast.body) {
      if (stmt.kind === 'VariableDeclaration' && stmt.identifier === word) {
        return {
          contents: [
            `\`\`\`one\n${stmt.isConst ? 'const' : 'let'} ${stmt.identifier}${stmt.typeAnnotation ? ': ' + stmt.typeAnnotation : ''}\n\`\`\``,
            `Inferred type: \`${stmt.inferredType || 'any'}\``,
          ],
        };
      }
      if (stmt.kind === 'FunctionDeclaration' && stmt.name === word) {
        const params = stmt.params.map((p) => `${p.name}${p.typeAnnotation ? ': ' + p.typeAnnotation : ''}`).join(', ');
        const ret = stmt.returnTypeAnnotation ? `: ${stmt.returnTypeAnnotation}` : '';
        return {
          contents: [
            `\`\`\`one\nfunction ${stmt.name}(${params})${ret}\n\`\`\``,
            `Function defined in current module.`,
          ],
        };
      }
    }

    return null;
  }

  /**
   * Find definition location for symbol under cursor.
   */
  public getDefinition(source: string, position: LSPPosition): LSPLocation | null {
    const word = this.getWordAtPosition(source, position);
    if (!word) return null;

    const res = this.compiler.compile(source);

    for (const stmt of res.ast.body) {
      if (stmt.kind === 'VariableDeclaration' && stmt.identifier === word) {
        const span = stmt.span;
        if (span) {
          return {
            range: {
              start: { line: span.start.line, column: span.start.column },
              end: { line: span.end.line, column: span.end.column },
            },
          };
        }
      }

      if (stmt.kind === 'FunctionDeclaration' && stmt.name === word) {
        const span = stmt.span;
        if (span) {
          return {
            range: {
              start: { line: span.start.line, column: span.start.column },
              end: { line: span.end.line, column: span.end.column },
            },
          };
        }
      }
    }

    return null;
  }

  /**
   * Extract the identifier / word token at the specified line and column.
   */
  private getWordAtPosition(source: string, position: LSPPosition): string | null {
    const lines = source.split(/\r?\n/);
    if (position.line < 1 || position.line > lines.length) return null;

    const line = lines[position.line - 1];
    const colIdx = position.column - 1;
    if (colIdx < 0 || colIdx >= line.length) return null;

    // Expand left and right to find word boundaries
    let start = colIdx;
    while (start > 0 && /[\w$]/.test(line[start - 1])) {
      start--;
    }
    let end = colIdx;
    while (end < line.length && /[\w$]/.test(line[end])) {
      end++;
    }

    const word = line.slice(start, end).trim();
    return word.length > 0 ? word : null;
  }
}
