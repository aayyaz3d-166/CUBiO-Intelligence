/**
 * OLTO Frontend Compiler Pipeline Entrypoint
 * ============================================
 */

import { OltoLexer, OltoToken } from './OltoLexer';
import { OltoParser } from './OltoParser';
import { OltoProgram } from './OltoAST';
import { OltoSemanticAnalyzer, OltoDiagnostic } from './OltoSemanticAnalyzer';

export * from './OltoAST';
export * from './OltoLexer';
export * from './OltoParser';
export * from './OltoSemanticAnalyzer';

export interface OltoCompilationResult {
  success: boolean;
  ast?: OltoProgram;
  diagnostics: OltoDiagnostic[];
}

export class OltoCompiler {
  public static compile(source: string): OltoCompilationResult {
    try {
      const lexer = new OltoLexer(source);
      const tokens = lexer.tokenize();

      const parser = new OltoParser(tokens);
      const ast = parser.parse();

      const analyzer = new OltoSemanticAnalyzer(ast);
      const diagnostics = analyzer.analyze();

      const hasErrors = diagnostics.some((d) => d.severity === 'Error');
      return {
        success: !hasErrors,
        ast,
        diagnostics,
      };
    } catch (err: any) {
      return {
        success: false,
        diagnostics: [
          {
            code: 'E9000',
            message: err.message || String(err),
            line: 1,
            column: 1,
            severity: 'Error',
          },
        ],
      };
    }
  }
}
