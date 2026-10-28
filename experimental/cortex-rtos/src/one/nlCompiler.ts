/**
 * Phase 6C — NL2ONE Compiler (Full Pipeline)
 *
 * Accepts a natural-language string, translates it to ONE Language source
 * via the NL parser + code generator, then runs it through the full
 * Lexer → Parser → Compiler → VM pipeline with structured error handling.
 */

import { NLParser } from './nlParser';
import { NLCodeGenerator } from './nlCodeGenerator';
import { OneLexer } from './oneLexer';
import { OneParser } from './oneParser';
import { OneCompiler } from './oneCompiler';
import { CubiOVirtualMachine } from '../core/engine/cubioVM';

export type NL2ONEPhase = 'nl_parser' | 'code_generator' | 'lexer' | 'parser' | 'compiler' | 'vm' | 'success';

export interface NL2ONEError {
  success: false;
  phase: NL2ONEPhase;
  error: string;
  originalInput: string;
  generatedCode?: string;
}

export interface NL2ONESuccess {
  success: true;
  phase: 'success';
  originalInput: string;
  generatedCode: string;
  vmState: ReturnType<CubiOVirtualMachine['getVMState']>;
  output?: any;
}

export type NL2ONEResult = NL2ONEError | NL2ONESuccess;

export class NL2ONECompiler {
  private nlParser: NLParser;
  private codeGenerator: NLCodeGenerator;

  constructor() {
    this.nlParser = new NLParser();
    this.codeGenerator = new NLCodeGenerator();
  }

  /**
   * Run the full NL → ONE → VM pipeline.
   */
  public compileAndExecute(nlInput: string): NL2ONEResult {
    try {
      // ── Phase 1: NL Parse ─────────────────────────────────────────────
      const parsed = this.nlParser.parse(nlInput);
      if (parsed.intent === 'UNKNOWN' && parsed.confidence < 0.3) {
        return {
          success: false,
          phase: 'nl_parser',
          error: `Could not understand intent from: "${nlInput}"`,
          originalInput: nlInput,
        };
      }

      // ── Phase 2: Code Generation ──────────────────────────────────────
      const generatedCode = this.codeGenerator.generate(parsed);
      if (generatedCode.startsWith('// [NL2ONE Error]')) {
        return {
          success: false,
          phase: 'code_generator',
          error: generatedCode.replace('// [NL2ONE Error] ', ''),
          originalInput: nlInput,
          generatedCode,
        };
      }

      // ── Phase 3: Lexer ────────────────────────────────────────────────
      let tokens;
      try {
        const lexer = new OneLexer(generatedCode);
        tokens = lexer.tokenize();
      } catch (err: any) {
        return {
          success: false,
          phase: 'lexer',
          error: `Lexer failed: ${err.message || String(err)}`,
          originalInput: nlInput,
          generatedCode,
        };
      }

      // ── Phase 4: Parser ───────────────────────────────────────────────
      let ast;
      try {
        const parser = new OneParser(tokens);
        ast = parser.parse();
      } catch (err: any) {
        return {
          success: false,
          phase: 'parser',
          error: `Parser failed: ${err.message || String(err)}`,
          originalInput: nlInput,
          generatedCode,
        };
      }

      // ── Phase 5: Compiler ─────────────────────────────────────────────
      let executableAST;
      try {
        const compiler = new OneCompiler(ast);
        executableAST = compiler.compile();
      } catch (err: any) {
        return {
          success: false,
          phase: 'compiler',
          error: `Compiler failed: ${err.message || String(err)}`,
          originalInput: nlInput,
          generatedCode,
        };
      }

      // ── Phase 6: VM Execution ─────────────────────────────────────────
      let vmState;
      try {
        const vm = new CubiOVirtualMachine();
        vm.execute(executableAST);
        vmState = vm.getVMState();
      } catch (err: any) {
        return {
          success: false,
          phase: 'vm',
          error: `VM execution failed: ${err.message || String(err)}`,
          originalInput: nlInput,
          generatedCode,
        };
      }

      return {
        success: true,
        phase: 'success',
        originalInput: nlInput,
        generatedCode,
        vmState,
      };
    } catch (err: any) {
      return {
        success: false,
        phase: 'nl_parser',
        error: `Unexpected pipeline error: ${err.message || String(err)}`,
        originalInput: nlInput,
      };
    }
  }
}

/**
 * Convenience: one-shot NL → execute → return VM state.
 */
export function nl2oneExecute(nlInput: string): NL2ONEResult {
  const compiler = new NL2ONECompiler();
  return compiler.compileAndExecute(nlInput);
}
