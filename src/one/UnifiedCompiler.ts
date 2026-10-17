import { OneLexer, Token } from './oneLexer';
import { GrammarRouter, RoutingDecision, GrammarKind } from './router/GrammarRouter';
import { UnifiedProgramNode } from './ast/UnifiedAST';
import { SemanticAnalyzer, SemanticDiagnostic } from './semantics/SemanticAnalyzer';
import { TypeChecker, TypeDiagnostic } from './types/TypeChecker';
import { IRLowering } from './ir/IRLowering';
import { IRPrinter } from './ir/IRPrinter';
import { UnifiedIRProgram } from './ir/UnifiedIR';
import { UnifiedVM, VMExecutionResult } from './vm/UnifiedVM';

export interface CompilerMetrics {
  lexTimeMs: number;
  parseTimeMs: number;
  semanticTimeMs: number;
  typeCheckTimeMs: number;
  irLowerTimeMs: number;
  totalTimeMs: number;
}

export interface UnifiedCompilerOptions {
  emitIR?: boolean;
  checkOnly?: boolean;
  execute?: boolean;
  executionMode?: 'jit' | 'interp' | 'auto';
}

export interface UnifiedCompilerResult {
  success: boolean;
  tokens: Token[];
  routing: RoutingDecision;
  ast: UnifiedProgramNode;
  ir?: UnifiedIRProgram;
  irText?: string;
  diagnostics: Array<SemanticDiagnostic | TypeDiagnostic>;
  vmResult?: VMExecutionResult;
  metrics: CompilerMetrics;
}

export class UnifiedCompiler {
  private options: UnifiedCompilerOptions;

  constructor(options: UnifiedCompilerOptions = {}) {
    this.options = options;
  }

  public compile(source: string): UnifiedCompilerResult {
    const totalStart = performance.now();

    // 1. Lexical Analysis
    const lexStart = performance.now();
    const lexer = new OneLexer(source);
    const tokens = lexer.tokenize();
    const lexTimeMs = performance.now() - lexStart;

    // 2. Grammar Routing & Parsing
    const parseStart = performance.now();
    const { ast, decision } = GrammarRouter.parse(tokens);
    const parseTimeMs = performance.now() - parseStart;

    // 3. Semantic Analysis
    const semStart = performance.now();
    const semanticAnalyzer = new SemanticAnalyzer();
    const semanticResult = semanticAnalyzer.analyze(ast);
    const semanticTimeMs = performance.now() - semStart;

    // 4. Type Checking
    const typeStart = performance.now();
    const typeChecker = new TypeChecker();
    const typeResult = typeChecker.check(ast);
    const typeCheckTimeMs = performance.now() - typeStart;

    const allDiagnostics: Array<SemanticDiagnostic | TypeDiagnostic> = [
      ...semanticResult.diagnostics,
      ...typeResult.diagnostics,
    ];

    const hasErrors = allDiagnostics.length > 0;

    // 5. IR Lowering
    let ir: UnifiedIRProgram | undefined = undefined;
    let irText: string | undefined = undefined;
    let irLowerTimeMs = 0;

    if (!hasErrors && !this.options.checkOnly) {
      const irStart = performance.now();
      const irLowering = new IRLowering();
      ir = irLowering.lower(ast);
      irLowerTimeMs = performance.now() - irStart;

      if (this.options.emitIR) {
        irText = IRPrinter.print(ir);
      }
    }

    // 6. VM / JIT Execution (if requested)
    let vmResult: VMExecutionResult | undefined = undefined;
    if (ir && this.options.execute) {
      const { UnifiedExecutionEngine } = require('./jit/UnifiedExecutionEngine');
      vmResult = UnifiedExecutionEngine.execute(ir, { mode: this.options.executionMode ?? 'interp' });
    }

    const totalTimeMs = performance.now() - totalStart;

    return {
      success: !hasErrors && (vmResult ? vmResult.success : true),
      tokens,
      routing: decision,
      ast,
      ir,
      irText,
      diagnostics: allDiagnostics,
      vmResult,
      metrics: {
        lexTimeMs,
        parseTimeMs,
        semanticTimeMs,
        typeCheckTimeMs,
        irLowerTimeMs,
        totalTimeMs,
      },
    };
  }

  /**
   * Directly compile and execute ONE source code on UnifiedVM.
   */
  public execute(source: string): { compilation: UnifiedCompilerResult; vmResult?: VMExecutionResult } {
    const compilation = this.compile(source);
    if (!compilation.success || !compilation.ir) {
      return { compilation };
    }
    const vm = new UnifiedVM();
    const vmResult = vm.execute(compilation.ir);
    return { compilation, vmResult };
  }
}
