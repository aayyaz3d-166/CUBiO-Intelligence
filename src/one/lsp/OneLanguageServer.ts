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
import { OneFormatter, FormatterOptions } from '../formatter/OneFormatter';

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

export type LSPSymbolKind =
  | 'File'
  | 'Module'
  | 'Namespace'
  | 'Package'
  | 'Class'
  | 'Method'
  | 'Property'
  | 'Field'
  | 'Constructor'
  | 'Enum'
  | 'Interface'
  | 'Function'
  | 'Variable'
  | 'Constant'
  | 'String'
  | 'Number'
  | 'Boolean'
  | 'Array'
  | 'Object'
  | 'Key'
  | 'Null'
  | 'EnumMember'
  | 'Struct'
  | 'Event'
  | 'Operator'
  | 'TypeParameter';

export interface LSPDocumentSymbol {
  name: string;
  detail: string;
  kind: LSPSymbolKind;
  range: LSPRange;
  selectionRange: LSPRange;
  children?: LSPDocumentSymbol[];
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
    const lspDiagnostics: LSPDiagnostic[] = [];
    let res: any;

    try {
      res = this.compiler.compile(source);
    } catch (err: any) {
      const msg = err.message || String(err);
      const codeMatch = msg.match(/\[([E0-9]+)(?::\s*([^\]]+))?\]/);
      const lineColMatch = msg.match(/at line (\d+), column (\d+)/);
      const code = codeMatch ? codeMatch[1] : 'E1000';
      const line = lineColMatch ? parseInt(lineColMatch[1], 10) : 1;
      const column = lineColMatch ? parseInt(lineColMatch[2], 10) : 1;

      lspDiagnostics.push({
        code,
        message: msg,
        severity: 'Error',
        range: {
          start: { line, column },
          end: { line, column: column + 1 },
        },
        formattedText: msg,
      });
      return lspDiagnostics;
    }

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
      'struct', 'enum', 'async', 'await', 'export', 'module',
    ];
    for (const kw of keywords) {
      completions.push({
        label: kw,
        kind: 'Keyword',
        detail: `Keyword: ${kw}`,
      });
    }

    // 2. Primitive & Spatial Types
    const types = [
      'Int', 'Int32', 'Int64', 'Float', 'Float32', 'Float64',
      'Bool', 'String', 'Void', 'Address369', 'VoxelCoord', 'any', 'number', 'boolean', 'string',
    ];
    for (const ty of types) {
      completions.push({
        label: ty,
        kind: 'Variable',
        detail: `Type: ${ty}`,
      });
    }

    // 3. Spatial Directives
    const spatialDirectives = [
      '@Space', '@Grid777', '@Slice', '@memview', '@seal', '@gossip', '@assert_rss', '@actuation_lock', '369_ALIGNMENT',
    ];
    for (const sd of spatialDirectives) {
      completions.push({
        label: sd,
        kind: 'Constant',
        detail: `Spatial Directive: ${sd}`,
      });
    }

    // 4. Standard Library Functions
    for (const fnName of Object.keys(ONE_BUILTIN_FUNCTIONS)) {
      completions.push({
        label: fnName,
        kind: 'Function',
        detail: `(builtin) function ${fnName}(...args)`,
        documentation: `Standard library built-in: ${fnName}`,
        insertText: `${fnName}()`,
      });
    }

    // 5. Document symbols (variables, functions, structs, and enums declared in source)
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
            t.type === TokenType.KEYWORD_FN ||
            t.type === TokenType.KEYWORD_STRUCT ||
            t.type === TokenType.KEYWORD_ENUM) &&
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
      struct: 'Declares a strongly-typed data structure.',
      enum: 'Declares an enumerated type with discrete named variants.',
      async: 'Marks an asynchronous function declaration.',
      await: 'Suspends execution until an asynchronous promise resolves.',
      export: 'Exports declarations across module boundaries.',
      module: 'Declares a modular namespace boundary.',
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
      if (stmt.kind === 'StructDeclaration' && (stmt as any).name === word) {
        const fields = ((stmt as any).fields || []).map((f: any) => `  ${f.name}: ${f.typeAnnotation};`).join('\n');
        return {
          contents: [
            `\`\`\`one\nstruct ${(stmt as any).name} {\n${fields}\n}\n\`\`\``,
            `User-defined data structure.`,
          ],
        };
      }
      if (stmt.kind === 'EnumDeclaration' && (stmt as any).name === word) {
        const variants = ((stmt as any).variants || []).map((v: any) => `  ${v.name} = ${v.value}`).join(',\n');
        return {
          contents: [
            `\`\`\`one\nenum ${(stmt as any).name} {\n${variants}\n}\n\`\`\``,
            `User-defined enumerated type.`,
          ],
        };
      }
      if (stmt.kind === 'DeclarativeSpatialNode') {
        const p = (stmt as any).payload;
        if (p?.id === word) {
          return {
            contents: [
              `\`\`\`one\nspatial ${(stmt as any).nodeType} ${p.id}\n\`\`\``,
              `Spatial computing ${(stmt as any).nodeType} entity.`,
            ],
          };
        }
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

      if ((stmt.kind === 'StructDeclaration' || stmt.kind === 'EnumDeclaration') && (stmt as any).name === word) {
        const span = (stmt as any).span;
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
   * Provide document outline / symbols for active document.
   */
  public getDocumentSymbols(source: string): LSPDocumentSymbol[] {
    const symbols: LSPDocumentSymbol[] = [];
    try {
      const res = this.compiler.compile(source);
      if (!res.ast?.body) return symbols;

      for (const stmt of res.ast.body) {
        const span = (stmt as any).span || {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 1 },
        };
        const range: LSPRange = {
          start: { line: span.start.line, column: span.start.column },
          end: { line: span.end.line, column: span.end.column },
        };

        if (stmt.kind === 'FunctionDeclaration') {
          const fnParams = (stmt as any).params?.map((p: any) => p.name).join(', ') || '';
          symbols.push({
            name: (stmt as any).name,
            detail: `(${fnParams}) -> ${(stmt as any).returnTypeAnnotation || 'void'}`,
            kind: 'Function',
            range,
            selectionRange: range,
          });
        } else if (stmt.kind === 'VariableDeclaration') {
          symbols.push({
            name: (stmt as any).identifier,
            detail: (stmt as any).typeAnnotation || (stmt as any).inferredType || ((stmt as any).isConst ? 'const' : 'let'),
            kind: (stmt as any).isConst ? 'Constant' : 'Variable',
            range,
            selectionRange: range,
          });
        } else if (stmt.kind === 'StructDeclaration') {
          const children: LSPDocumentSymbol[] = [];
          if (Array.isArray((stmt as any).fields)) {
            for (const f of (stmt as any).fields) {
              const fSpan = f.span || span;
              const fRange: LSPRange = {
                start: { line: fSpan.start.line, column: fSpan.start.column },
                end: { line: fSpan.end.line, column: fSpan.end.column },
              };
              children.push({
                name: f.name,
                detail: f.typeAnnotation || 'field',
                kind: 'Field',
                range: fRange,
                selectionRange: fRange,
              });
            }
          }
          symbols.push({
            name: (stmt as any).name,
            detail: 'struct',
            kind: 'Struct',
            range,
            selectionRange: range,
            children,
          });
        } else if (stmt.kind === 'EnumDeclaration') {
          const children: LSPDocumentSymbol[] = [];
          if (Array.isArray((stmt as any).variants)) {
            for (const v of (stmt as any).variants) {
              const vSpan = v.span || span;
              const vRange: LSPRange = {
                start: { line: vSpan.start.line, column: vSpan.start.column },
                end: { line: vSpan.end.line, column: vSpan.end.column },
              };
              children.push({
                name: v.name,
                detail: String(v.value),
                kind: 'EnumMember',
                range: vRange,
                selectionRange: vRange,
              });
            }
          }
          symbols.push({
            name: (stmt as any).name,
            detail: 'enum',
            kind: 'Enum',
            range,
            selectionRange: range,
            children,
          });
        } else if (stmt.kind === 'DeclarativeSpatialNode') {
          const payload = (stmt as any).payload;
          const nodeType = (stmt as any).nodeType || 'Node';
          symbols.push({
            name: payload?.id || `${nodeType}`,
            detail: `spatial ${nodeType}`,
            kind: nodeType === 'Node' ? 'Class' : 'Interface',
            range,
            selectionRange: range,
          });
        }
      }
    } catch {
      // In case of syntax errors, return partial symbols or fallback
    }
    return symbols;
  }

  /**
   * Deterministically formats ONE Language source code.
   */
  public formatDocument(source: string, options?: FormatterOptions): string {
    return OneFormatter.format(source, options);
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
