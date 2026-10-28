import * as crypto from 'crypto';
import { OneLexer } from '../oneLexer';
import { GrammarRouter } from '../router/GrammarRouter';
import {
  UnifiedProgramNode,
  UnifiedStatementNode,
  ImportStatementNode,
  ExportStatementNode,
  FunctionDeclarationNode,
  StructDeclarationNode,
  EnumDeclarationNode,
  VariableDeclarationNode,
} from '../ast/UnifiedAST';
import { VIGASTExtractor } from '../vig/VIGASTExtractor';
import { VIGCanonicalizer } from '../vig/VIGCanonicalizer';
import { ModuleResolver } from './ModuleResolver';

export interface ModuleDiagnostic {
  code: string;
  message: string;
  filePath?: string;
  line?: number;
  column?: number;
}

export interface ExportedSymbolInfo {
  name: string;
  kind: 'function' | 'struct' | 'enum' | 'variable';
  declaration?: UnifiedStatementNode;
  signature?: string;
}

export interface ModuleRecord {
  filePath: string;
  sourceText: string;
  ast: UnifiedProgramNode;
  contentHash: string;
  publicApiHash: string;
  exportedSymbols: Map<string, ExportedSymbolInfo>;
  importedModules: Array<{
    specifier: string;
    resolvedPath: string;
    alias?: string;
    isNamespace?: boolean;
    specifiers?: Array<{ name: string; alias?: string }>;
  }>;
  importedPublicApiHashes: Record<string, string>;
}

export class ModuleGraph {
  public readonly modules: Map<string, ModuleRecord> = new Map();
  public readonly diagnostics: ModuleDiagnostic[] = [];
  private readonly resolver: ModuleResolver;

  constructor(resolver: ModuleResolver) {
    this.resolver = resolver;
  }

  /**
   * Builds the dependency graph starting from the entry point file.
   */
  public build(entryPointPath: string): {
    success: boolean;
    entryPoint: string;
    sortedModules: ModuleRecord[];
    diagnostics: ModuleDiagnostic[];
  } {
    const normEntry = VIGCanonicalizer.normalizePath(
      this.resolver.resolve(entryPointPath, entryPointPath).resolvedPath ?? entryPointPath
    );

    const visited = new Set<string>();
    this.loadModuleRecursive(normEntry, visited);

    if (this.hasErrors()) {
      return {
        success: false,
        entryPoint: normEntry,
        sortedModules: [],
        diagnostics: this.diagnostics,
      };
    }

    // 1. Detect circular dependencies
    const cycle = this.detectCycles(normEntry);
    if (cycle) {
      this.diagnostics.push({
        code: 'E4004',
        message: `Circular module dependency detected: ${cycle.map(p => this.formatModuleDisplayPath(p)).join(' -> ')}`,
        filePath: normEntry,
      });
      return {
        success: false,
        entryPoint: normEntry,
        sortedModules: [],
        diagnostics: this.diagnostics,
      };
    }

    // 2. Validate named imports against exported symbols
    this.validateImportReferences();

    // 3. Populate importedPublicApiHashes for each module
    for (const mod of this.modules.values()) {
      for (const imp of mod.importedModules) {
        const depMod = this.modules.get(imp.resolvedPath);
        if (depMod) {
          mod.importedPublicApiHashes[imp.specifier] = depMod.publicApiHash;
        }
      }
    }

    if (this.hasErrors()) {
      return {
        success: false,
        entryPoint: normEntry,
        sortedModules: [],
        diagnostics: this.diagnostics,
      };
    }

    // 4. Topological sort (dependencies before dependents)
    const sorted = this.topologicalSort(normEntry);

    return {
      success: true,
      entryPoint: normEntry,
      sortedModules: sorted,
      diagnostics: this.diagnostics,
    };
  }

  private hasErrors(): boolean {
    return this.diagnostics.some(d =>
      d.code.startsWith('E4') || d.code.startsWith('E1') || d.code.startsWith('E2') || d.code.startsWith('E3')
    );
  }

  private formatModuleDisplayPath(filePath: string): string {
    const root = VIGCanonicalizer.normalizePath(this.resolver.getProjectRoot());
    if (filePath.startsWith(root)) {
      const rel = filePath.slice(root.length).replace(/^\/+/, '');
      return rel ? `./${rel}` : filePath;
    }
    return filePath;
  }

  private loadModuleRecursive(filePath: string, inProgress: Set<string>): void {
    if (this.modules.has(filePath)) return;
    if (inProgress.has(filePath)) return; // Cycle will be handled by detectCycles
    inProgress.add(filePath);

    let sourceText: string;
    try {
      sourceText = this.resolver.readSource(filePath);
    } catch (err: any) {
      this.diagnostics.push({
        code: 'E4002',
        message: `Failed to read module source file: '${filePath}': ${err.message}`,
        filePath,
      });
      return;
    }

    // Lex and Parse
    let ast: UnifiedProgramNode;
    try {
      const lexer = new OneLexer(sourceText);
      const tokens = lexer.tokenize();
      const parseResult = GrammarRouter.parse(tokens);
      ast = parseResult.ast;
    } catch (err: any) {
      this.diagnostics.push({
        code: 'E1001',
        message: `Parse error in module '${filePath}': ${err.message}`,
        filePath,
      });
      return;
    }

    const contentHash = crypto.createHash('sha256').update(sourceText, 'utf8').digest('hex');
    const publicApiHash = VIGASTExtractor.computePublicApiHash(sourceText, filePath);
    const exportedSymbols = new Map<string, ExportedSymbolInfo>();
    const importedModules: ModuleRecord['importedModules'] = [];

    // Extract declarations and imports
    for (const stmt of ast.body) {
      // Direct ExportStatement
      if (stmt.kind === 'ExportStatement') {
        const expNode = stmt as ExportStatementNode;
        if (expNode.declaration) {
          this.registerExportDeclaration(expNode.declaration, exportedSymbols, filePath);
        } else if (expNode.specifiers) {
          for (const spec of expNode.specifiers) {
            const symName = spec.alias || spec.name;
            if (exportedSymbols.has(symName)) {
              this.diagnostics.push({
                code: 'E4003',
                message: `Duplicate export of symbol '${symName}' in module '${filePath}'`,
                filePath,
                line: spec.span?.start.line,
                column: spec.span?.start.column,
              });
            } else {
              exportedSymbols.set(symName, {
                name: symName,
                kind: 'variable',
              });
            }
          }
        }
      } else if ((stmt as any).isExported) {
        this.registerExportDeclaration(stmt, exportedSymbols, filePath);
      }

      // ImportStatement
      if (stmt.kind === 'ImportStatement') {
        const impNode = stmt as ImportStatementNode;
        const res = this.resolver.resolve(impNode.moduleName, filePath);
        if (!res.success || !res.resolvedPath) {
          this.diagnostics.push({
            code: res.errorCode || 'E4002',
            message: res.error || `Module not found: '${impNode.moduleName}'`,
            filePath,
            line: impNode.span?.start.line,
            column: impNode.span?.start.column,
          });
          continue;
        }

        importedModules.push({
          specifier: impNode.moduleName,
          resolvedPath: res.resolvedPath,
          alias: impNode.alias,
          isNamespace: impNode.isNamespace,
          specifiers: impNode.specifiers?.map(s => ({ name: s.name, alias: s.alias })),
        });

        // Recursively load imported module
        this.loadModuleRecursive(res.resolvedPath, inProgress);
      }
    }

    const record: ModuleRecord = {
      filePath,
      sourceText,
      ast,
      contentHash,
      publicApiHash,
      exportedSymbols,
      importedModules,
      importedPublicApiHashes: {},
    };

    this.modules.set(filePath, record);
    inProgress.delete(filePath);
  }

  private registerExportDeclaration(
    decl: UnifiedStatementNode,
    exportedSymbols: Map<string, ExportedSymbolInfo>,
    filePath: string
  ): void {
    let symName = '';
    let kind: ExportedSymbolInfo['kind'] = 'variable';

    if (decl.kind === 'FunctionDeclaration') {
      symName = (decl as FunctionDeclarationNode).name;
      kind = 'function';
    } else if (decl.kind === 'StructDeclaration') {
      symName = (decl as StructDeclarationNode).name;
      kind = 'struct';
    } else if (decl.kind === 'EnumDeclaration') {
      symName = (decl as EnumDeclarationNode).name;
      kind = 'enum';
    } else if (decl.kind === 'VariableDeclaration') {
      symName = (decl as VariableDeclarationNode).identifier;
      kind = 'variable';
    }

    if (!symName) return;

    if (exportedSymbols.has(symName)) {
      this.diagnostics.push({
        code: 'E4003',
        message: `Duplicate export of symbol '${symName}' in module '${filePath}'`,
        filePath,
        line: decl.span?.start.line,
        column: decl.span?.start.column,
      });
      return;
    }

    exportedSymbols.set(symName, {
      name: symName,
      kind,
      declaration: decl,
    });
  }

  private validateImportReferences(): void {
    for (const mod of this.modules.values()) {
      for (const imp of mod.importedModules) {
        const depMod = this.modules.get(imp.resolvedPath);
        if (!depMod) continue;

        if (imp.specifiers && imp.specifiers.length > 0) {
          for (const spec of imp.specifiers) {
            if (!depMod.exportedSymbols.has(spec.name)) {
              this.diagnostics.push({
                code: 'E4005',
                message: `Symbol '${spec.name}' is not exported by module '${this.formatModuleDisplayPath(depMod.filePath)}'`,
                filePath: mod.filePath,
              });
            }
          }
        }
      }
    }
  }

  private detectCycles(entryPoint: string): string[] | null {
    const visited = new Set<string>();
    const recStack: string[] = [];
    const inStack = new Set<string>();

    const dfs = (node: string): string[] | null => {
      visited.add(node);
      recStack.push(node);
      inStack.add(node);

      const mod = this.modules.get(node);
      if (mod) {
        for (const imp of mod.importedModules) {
          const target = imp.resolvedPath;
          if (!visited.has(target)) {
            const cycle = dfs(target);
            if (cycle) return cycle;
          } else if (inStack.has(target)) {
            // Cycle detected!
            const cycleStart = recStack.indexOf(target);
            return [...recStack.slice(cycleStart), target];
          }
        }
      }

      recStack.pop();
      inStack.delete(node);
      return null;
    };

    return dfs(entryPoint);
  }

  private topologicalSort(entryPoint: string): ModuleRecord[] {
    const visited = new Set<string>();
    const result: ModuleRecord[] = [];

    const dfs = (node: string) => {
      if (visited.has(node)) return;
      visited.add(node);

      const mod = this.modules.get(node);
      if (mod) {
        for (const imp of mod.importedModules) {
          dfs(imp.resolvedPath);
        }
        result.push(mod);
      }
    };

    dfs(entryPoint);
    return result;
  }
}
