/**
 * ONE Language — Deterministic Source Code Formatter
 * ===================================================
 * Formats ONE Language source code into clean, human-readable, consistent syntax:
 *   - 4-space indentation per nesting level
 *   - Consistent brace placement: opening brace on same line with single space
 *   - Standardized spacing around operators (+, -, *, /, ==, !=, <, <=, >, >=, &&, ||, =)
 *   - Comma followed by a single space in argument and parameter lists
 *   - Strips trailing whitespace and normalizes empty lines
 *   - Idempotent: format(format(code)) === format(code)
 *   - Full support for both Computational code and Declarative Spatial DSL
 */

export interface FormatterOptions {
  indentSize?: number;
  useTabs?: boolean;
}

export class OneFormatter {
  /**
   * Format source code with deterministic rules.
   */
  public static format(source: string, options: FormatterOptions = {}): string {
    const indentStr = options.useTabs ? '\t' : ' '.repeat(options.indentSize || 4);
    const rawLines = source.split(/\r?\n/);
    const formattedLines: string[] = [];

    let indentLevel = 0;
    let inCommentBlock = false;

    for (let i = 0; i < rawLines.length; i++) {
      let line = rawLines[i].trim();

      // Handle multiline comments
      if (line.startsWith('/*')) {
        inCommentBlock = true;
      }
      if (inCommentBlock) {
        formattedLines.push(indentStr.repeat(indentLevel) + line);
        if (line.endsWith('*/')) {
          inCommentBlock = false;
        }
        continue;
      }

      // Preserve empty lines (capped at maximum 1 consecutive empty line)
      if (line.length === 0) {
        if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
          formattedLines.push('');
        }
        continue;
      }

      // Preserve single line comments
      if (line.startsWith('//') || line.startsWith('#')) {
        formattedLines.push(indentStr.repeat(indentLevel) + line);
        continue;
      }

      // If line starts with 'else' and previous line was a closing brace '}', join them on same line
      if (line.startsWith('else') && formattedLines.length > 0 && formattedLines[formattedLines.length - 1].trim() === '}') {
        const prev = formattedLines.pop()!;
        const formattedLine = this.formatSingleLine(line);
        formattedLines.push(prev + ' ' + formattedLine);

        const openBraces = (line.match(/\{/g) || []).length;
        const closeBraces = (line.match(/\}/g) || []).length;
        indentLevel += openBraces - closeBraces;
        indentLevel = Math.max(0, indentLevel);
        continue;
      }

      // Handle closing braces on current line to adjust indent level before formatting line
      if (line.startsWith('}') || line.startsWith(']')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      // Apply syntactic spacing transformations
      const formattedLine = this.formatSingleLine(line);

      // Push line with current indentation
      formattedLines.push(indentStr.repeat(indentLevel) + formattedLine);

      // Handle opening braces at the end of the line to increase indent level for following lines
      // Count net braces change for lines containing both '{' and '}'
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;

      if (!line.startsWith('}') && !line.startsWith(']')) {
        indentLevel += openBraces - closeBraces;
        indentLevel = Math.max(0, indentLevel);
      } else {
        // Line started with closing brace, already decremented once
        indentLevel += openBraces - (closeBraces - 1);
        indentLevel = Math.max(0, indentLevel);
      }
    }

    // Trim trailing empty lines
    while (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] === '') {
      formattedLines.pop();
    }

    return formattedLines.join('\n') + '\n';
  }

  /**
   * Format a single line's tokens, operator spacing, and delimiters.
   */
  private static formatSingleLine(line: string): string {
    // Preserve string literals by placeholder replacement during operator normalization
    const stringLiterals: string[] = [];
    const sanitized = line.replace(/(["'])(?:(?=(\\?))\2[\s\S])*?\1/g, (match) => {
      stringLiterals.push(match);
      return `__STR_LIT_${stringLiterals.length - 1}__`;
    });

    let result = sanitized;

    // Normalize spaces around commas
    result = result.replace(/\s*,\s*/g, ', ');

    // Normalize colons (e.g. type annotations 'x: number', not 'x : number')
    result = result.replace(/\s*:\s*/g, ': ');

    // Normalize binary operators with clean single spaces around them
    // Operators: ==, !=, <=, >=, &&, ||, =>, ->
    result = result.replace(/\s*==\s*/g, ' == ');
    result = result.replace(/\s*!=\s*/g, ' != ');
    result = result.replace(/\s*<=\s*/g, ' <= ');
    result = result.replace(/\s*>=\s*/g, ' >= ');
    result = result.replace(/\s*&&\s*/g, ' && ');
    result = result.replace(/\s*\|\|\s*/g, ' || ');
    result = result.replace(/\s*=>\s*/g, ' => ');
    result = result.replace(/\s*->\s*/g, ' -> ');

    // Single-char comparisons (<, >), assignment (=), arithmetic (+, -, *, /, %)
    // Ensure we don't clobber multi-char operators already spaced
    result = result.replace(/(?<![=!<>&|])=(?![=><])/g, ' = ');
    result = result.replace(/(?<![<=-])<(?![<=])/g, ' < ');
    result = result.replace(/(?<![>=-])>(?![>=])/g, ' > ');
    result = result.replace(/(?<=\w|\d|\))\s*\+\s*(?=\w|\d|\()/g, ' + ');
    result = result.replace(/(?<=\w|\d|\))\s*-\s*(?=\w|\d|\()/g, ' - ');
    result = result.replace(/(?<=\w|\d|\))\s*\*\s*(?=\w|\d|\()/g, ' * ');
    result = result.replace(/(?<=\w|\d|\))\s*\/\s*(?=\w|\d|\()/g, ' / ');
    result = result.replace(/(?<=\w|\d|\))\s*%\s*(?=\w|\d|\()/g, ' % ');

    // Normalize spacing before opening brace: 'function add() {' or 'if x > 0 {'
    result = result.replace(/\s*\{/g, ' {');

    // Clean up multiple consecutive spaces (excluding indentation)
    result = result.replace(/  +/g, ' ');

    // Normalize 'else if' and 'else {'
    result = result.replace(/}\s*else\s*if/g, '} else if');
    result = result.replace(/}\s*else\s*\{/g, '} else {');

    // Restore string literals
    for (let idx = 0; idx < stringLiterals.length; idx++) {
      result = result.replace(`__STR_LIT_${idx}__`, stringLiterals[idx]);
    }

    return result.trim();
  }
}
