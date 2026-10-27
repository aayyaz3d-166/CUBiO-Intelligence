import { OneLexer, Token } from './oneLexer';
import { GrammarRouter, RoutingDecision, GrammarKind } from './router/GrammarRouter';
import { UnifiedProgramNode } from './ast/UnifiedAST';
import { SemanticAnalyzer, SemanticDiagnostic } from './semantics/SemanticAnalyzer';
import { TypeChecker, TypeDiagnostic } from './types/TypeChecker';
import { IRLowering } from './ir/IRLowering';
import { IRPrinter } from './ir/IRPrinter';
import { UnifiedIRProgram } from './ir/UnifiedIR';
import { UnifiedVM, VMExecutionResult, VMOptions } from './vm/UnifiedVM';
import { ModuleResolver } from './modules/ModuleResolver';
import { ModuleGraph, ModuleDiagnostic, ModuleRecord } from './modules/ModuleGraph';
import { MultiFileLinker } from './modules/MultiFileLinker';
import { VIGCompilationCache } from './vig/VIGCompilationCache';

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

export interface MultiFileCompilerOptions extends UnifiedCompilerOptions {
  projectRoot?: string;
  virtualFiles?: Map<string, string> | Record<string, string>;
  compilationCache?: VIGCompilationCache;
  compilerVersion?: string;
  vmOptions?: VMOptions;
}

export interface MultiFileCompilationResult {
  success: boolean;
  entryPoint: string;
  graph?: ModuleGraph;
  sortedModules?: ModuleRecord[];
  linkedIR?: UnifiedIRProgram;
  diagnostics: Array<SemanticDiagnostic | TypeDiagnostic | ModuleDiagnostic>;
  cacheMetrics?: {
    hits: number;
    misses: number;
  };
  vmResult?: VMExecutionResult;
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
  public execute(
    source: string,
    vmOptions?: VMOptions
  ): { compilation: UnifiedCompilerResult; vmResult?: VMExecutionResult } {
    const compilation = this.compile(source);
    if (!compilation.success || !compilation.ir) {
      return { compilation };
    }
    const vm = new UnifiedVM();
    const vmResult = vm.execute(compilation.ir, vmOptions);
    return { compilation, vmResult };
  }

  /**
   * Compiles a multi-file ONE Language program starting from an entry point file.
   * Resolves imports, validates cycle-freedom and containment, checks VIG compilation cache,
   * lowers IR, and links into a unified executable program.
   */
  public compileMultiFile(
    entryPoint: string,
    options: MultiFileCompilerOptions = {}
  ): MultiFileCompilationResult {
    const resolver = new ModuleResolver({
      projectRoot: options.projectRoot,
      virtualFiles: options.virtualFiles,
    });

    const graph = new ModuleGraph(resolver);
    const buildResult = graph.build(entryPoint);

    if (!buildResult.success) {
      return {
        success: false,
        entryPoint: buildResult.entryPoint,
        graph,
        diagnostics: buildResult.diagnostics,
      };
    }

    const allDiagnostics: Array<SemanticDiagnostic | TypeDiagnostic | ModuleDiagnostic> = [
      ...buildResult.diagnostics,
    ];

    const cache = options.compilationCache;
    let hits = 0;
    let misses = 0;
    const moduleIRs = new Map<string, UnifiedIRProgram>();

    // Compile modules in topological order (dependencies before dependents)
    for (const mod of buildResult.sortedModules) {
      const cacheKey = VIGCompilationCache.computeCacheKey({
        contentHash: mod.contentHash,
        compilerVersion: options.compilerVersion ?? 'v0.1.0-vig',
        importedPublicApiHashes: mod.importedPublicApiHashes,
      });

      if (cache && cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        if (cached && cached.ir) {
          moduleIRs.set(mod.filePath, cached.ir);
          hits++;
          continue;
        }
      }

      misses++;

      // Collect exported symbols from dependencies
      const extStructs: any[] = [];
      const extEnums: any[] = [];
      const extFunctions: Array<{ name: string; paramCount?: number; returnTypeAnnotation?: string }> = [];
      const extTypes = new Map<string, any>();

      for (const imp of mod.importedModules) {
        const depMod = buildResult.sortedModules.find(m => m.filePath === imp.resolvedPath);
        if (depMod) {
          for (const [symName, info] of depMod.exportedSymbols.entries()) {
            if (info.declaration?.kind === 'StructDeclaration') {
              const sDecl = info.declaration as any;
              extStructs.push(sDecl);
              if (imp.isNamespace && imp.alias) {
                extStructs.push({ ...sDecl, name: `${imp.alias}.${sDecl.name}` });
              }
            } else if (info.declaration?.kind === 'EnumDeclaration') {
              const eDecl = info.declaration as any;
              extEnums.push(eDecl);
              if (imp.isNamespace && imp.alias) {
                extEnums.push({ ...eDecl, name: `${imp.alias}.${eDecl.name}` });
              }
            } else if (info.declaration?.kind === 'FunctionDeclaration') {
              const fnDecl = info.declaration as any;
              extFunctions.push({
                name: fnDecl.name,
                paramCount: fnDecl.params.length,
                returnTypeAnnotation: fnDecl.returnTypeAnnotation,
              });
              if (imp.isNamespace && imp.alias) {
                extFunctions.push({
                  name: `${imp.alias}.${fnDecl.name}`,
                  paramCount: fnDecl.params.length,
                  returnTypeAnnotation: fnDecl.returnTypeAnnotation,
                });
              }
            }
          }
        }
      }

      // Semantic Analysis
      const semAnalyzer = new SemanticAnalyzer();
      const semResult = semAnalyzer.analyze(mod.ast, {
        structs: extStructs,
        enums: extEnums,
        functions: extFunctions,
      });

      // Type Checking
      const typeChecker = new TypeChecker();
      const typeResult = typeChecker.check(mod.ast, extTypes);

      allDiagnostics.push(...semResult.diagnostics, ...typeResult.diagnostics);

      if (!semResult.isValid || !typeResult.isValid) {
        return {
          success: false,
          entryPoint: buildResult.entryPoint,
          graph,
          sortedModules: buildResult.sortedModules,
          diagnostics: allDiagnostics,
          cacheMetrics: { hits, misses },
        };
      }

      // IR Lowering
      const irLowering = new IRLowering();
      const ir = irLowering.lower(mod.ast);
      moduleIRs.set(mod.filePath, ir);

      if (cache) {
        cache.put(cacheKey, mod.filePath, mod.ast, ir, mod.publicApiHash);
      }
    }

    // Link modules
    const linkedIR = MultiFileLinker.link(
      buildResult.sortedModules,
      moduleIRs,
      buildResult.entryPoint
    );

    let vmResult: VMExecutionResult | undefined = undefined;
    if (options.execute) {
      const vm = new UnifiedVM();
      vmResult = vm.execute(linkedIR, options.vmOptions);
    }

    return {
      success: allDiagnostics.length === 0 && (vmResult ? vmResult.success : true),
      entryPoint: buildResult.entryPoint,
      graph,
      sortedModules: buildResult.sortedModules,
      linkedIR,
      diagnostics: allDiagnostics,
      cacheMetrics: { hits, misses },
      vmResult,
    };
  }

  /**
   * Compiles and executes a multi-file ONE Language program on UnifiedVM.
   */
  public executeMultiFile(
    entryPoint: string,
    options: MultiFileCompilerOptions = {}
  ): MultiFileCompilationResult {
    return this.compileMultiFile(entryPoint, { ...options, execute: true });
  }
}
