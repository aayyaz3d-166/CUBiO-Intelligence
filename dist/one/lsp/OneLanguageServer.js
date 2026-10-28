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
export class OneLanguageServer {
    compiler;
    constructor() {
        this.compiler = new UnifiedCompiler({ checkOnly: true });
    }
    /**
     * Get syntax, semantic, and type diagnostics for a source file.
     */
    getDiagnostics(source) {
        const lspDiagnostics = [];
        let res;
        try {
            res = this.compiler.compile(source);
        }
        catch (err) {
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
                formattedText: DiagnosticFormatter.format({
                    code: d.code,
                    message: d.message,
                    line,
                    column,
                    expected: d.expected,
                    actual: d.received,
                }, source),
            });
        }
        return lspDiagnostics;
    }
    /**
     * Provide context-aware code completions at a given cursor position.
     */
    getCompletions(source, _position) {
        const completions = [];
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
        // 3. Document symbols (variables, functions, structs, and enums declared in source)
        try {
            const lexer = new OneLexer(source);
            const tokens = lexer.tokenize();
            const declaredIdentifiers = new Set();
            for (let i = 0; i < tokens.length; i++) {
                const t = tokens[i];
                if ((t.type === TokenType.KEYWORD_LET ||
                    t.type === TokenType.KEYWORD_CONST ||
                    t.type === TokenType.KEYWORD_FUNCTION ||
                    t.type === TokenType.KEYWORD_FN ||
                    t.type === TokenType.KEYWORD_STRUCT ||
                    t.type === TokenType.KEYWORD_ENUM) &&
                    i + 1 < tokens.length &&
                    tokens[i + 1].type === TokenType.IDENTIFIER) {
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
        }
        catch {
            // Return base completions if lexer encounters errors
        }
        return completions;
    }
    /**
     * Provide hover information (type signature / docs) for word under cursor.
     */
    getHover(source, position) {
        const word = this.getWordAtPosition(source, position);
        if (!word)
            return null;
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
        const keywords = {
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
        }
        return null;
    }
    /**
     * Find definition location for symbol under cursor.
     */
    getDefinition(source, position) {
        const word = this.getWordAtPosition(source, position);
        if (!word)
            return null;
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
    getWordAtPosition(source, position) {
        const lines = source.split(/\r?\n/);
        if (position.line < 1 || position.line > lines.length)
            return null;
        const line = lines[position.line - 1];
        const colIdx = position.column - 1;
        if (colIdx < 0 || colIdx >= line.length)
            return null;
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
