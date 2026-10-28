/**
 * ONE Language — Developer Diagnostics Formatter
 * ===============================================
 * Transforms compiler and runtime errors into human-friendly, actionable diagnostic
 * messages with code frames, line snippets, caret markers, and helpful hints.
 */

export interface FormattableDiagnostic {
  code: string;
  message: string;
  expected?: string;
  actual?: string;
  line?: number;
  column?: number;
  hint?: string;
}

export class DiagnosticFormatter {
  /**
   * Produce a structured, human-friendly error report for a single diagnostic.
   */
  public static format(diagnostic: FormattableDiagnostic, sourceCode?: string): string {
    const lines: string[] = [];
    const title = this.getTitleForCode(diagnostic.code);

    lines.push(`[${diagnostic.code}] ${title}: ${diagnostic.message}`);

    if (diagnostic.expected && diagnostic.actual) {
      lines.push('');
      lines.push(`  Expected: ${diagnostic.expected}`);
      lines.push(`  Received: ${diagnostic.actual}`);
    }

    if (diagnostic.line !== undefined) {
      lines.push('');
      lines.push(`  Line ${diagnostic.line}${diagnostic.column !== undefined ? `, Column ${diagnostic.column}` : ''}:`);

      if (sourceCode) {
        const codeSnippet = this.extractCodeFrame(sourceCode, diagnostic.line, diagnostic.column || 1);
        lines.push(codeSnippet);
      }
    }

    const hint = diagnostic.hint || this.getHintForCode(diagnostic.code, diagnostic);
    if (hint) {
      lines.push('');
      lines.push(`  Hint: ${hint}`);
    }

    return lines.join('\n');
  }

  /**
   * Format multiple diagnostics into a single composite report.
   */
  public static formatAll(diagnostics: FormattableDiagnostic[], sourceCode?: string): string {
    if (diagnostics.length === 0) {
      return 'No diagnostics reported.';
    }

    const separator = '\n' + '─'.repeat(60) + '\n';
    return diagnostics.map((d) => this.format(d, sourceCode)).join(separator);
  }

  /**
   * Extract a formatted code frame with line number and caret (^) pointer.
   */
  public static extractCodeFrame(source: string, line: number, column: number): string {
    const sourceLines = source.split(/\r?\n/);
    if (line < 1 || line > sourceLines.length) {
      return '';
    }

    const targetLine = sourceLines[line - 1];
    const linePrefix = `    ${line} | `;
    const indent = ' '.repeat(linePrefix.length + Math.max(0, column - 1));

    return `${linePrefix}${targetLine}\n${indent}^`;
  }

  /**
   * Derive a category title based on standard ONE diagnostic codes.
   */
  public static getTitleForCode(code: string): string {
    if (code.startsWith('E1')) return 'Syntax Error';
    if (code.startsWith('E2')) return 'Type Mismatch Error';
    if (code.startsWith('E3')) return 'Semantic Error';
    if (code.startsWith('E4')) return 'Compiler IR Error';
    if (code.startsWith('E5')) return 'VM Runtime Error';
    return 'Compiler Diagnostic';
  }

  /**
   * Provide actionable developer hints based on error category and context.
   */
  public static getHintForCode(code: string, diag?: FormattableDiagnostic): string {
    switch (code) {
      case 'E1001':
        return "Declare variables with an identifier after 'let' or 'const' (e.g., 'let count = 0').";
      case 'E1002':
        return "Constants declared with 'const' must be initialized immediately with a value.";
      case 'E1003':
        return "Provide a valid identifier for your function (e.g., 'function calculate(x) { ... }').";
      case 'E1004':
        return "Check parameter list in function declaration for missing or malformed names.";
      case 'E1005':
        return "Ensure matching closing delimiter exists.";
      case 'E2001':
        return 'Ensure the assigned value matches the declared variable type, or remove explicit type annotation for automatic inference.';
      case 'E2002':
        return "Incompatible operand types for binary operator. String concatenation uses '+' while numeric math requires numbers.";
      case 'E2003':
        return 'Check the arguments passed to the function call against its declared parameter types.';
      case 'E2004':
        return 'Ensure all return statements within the function return a value conforming to the declared return type.';
      case 'E2005':
        return "Conditions in 'if' and 'while' statements must evaluate to a boolean (true/false).";
      case 'E3001':
        return 'Variable was already declared in this scope. Remove duplicate declaration or use assignment to update it.';
      case 'E3002':
        return 'Function parameter names must be unique within the parameter list.';
      case 'E3003':
        return "The 'return' statement can only be used inside a function body.";
      case 'E3004':
        return "Check the spelling of the identifier or ensure it is declared with 'let' prior to usage.";
      case 'E3005':
        return 'Verify the number of arguments provided matches the declared parameter count.';
      case 'E3007':
        return 'Remove duplicate import of this module.';
      case 'E3008':
        return "Identifiers declared with 'const' are immutable. Use 'let' if you need to reassign this variable.";
      case 'E5001':
        return 'Division or modulo by zero is undefined. Add a guard check before dividing.';
      case 'E5004':
        return 'Variable not defined in active frame or global environment.';
      case 'E5005':
        return 'Target function is not declared or not registered in the VM.';
      case 'E5006':
        return 'Recursion exceeded maximum call stack depth (512 frames). Check base case termination.';
      case 'E5007':
        return 'Loop exceeded 1,000,000 instruction budget. Ensure loop counter or condition advances towards termination.';
      default:
        return 'Review compiler syntax and type specifications.';
    }
  }
}
