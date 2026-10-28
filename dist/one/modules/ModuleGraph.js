import * as crypto from 'crypto';
import { OneLexer } from '../oneLexer';
import { GrammarRouter } from '../router/GrammarRouter';
import { VIGASTExtractor } from '../vig/VIGASTExtractor';
import { VIGCanonicalizer } from '../vig/VIGCanonicalizer';
export class ModuleGraph {
    modules = new Map();
    diagnostics = [];
    resolver;
    constructor(resolver) {
        this.resolver = resolver;
    }
    /**
     * Builds the dependency graph starting from the entry point file.
     */
    build(entryPointPath) {
        const normEntry = VIGCanonicalizer.normalizePath(this.resolver.resolve(entryPointPath, entryPointPath).resolvedPath ?? entryPointPath);
        const visited = new Set();
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
    hasErrors() {
        return this.diagnostics.some(d => d.code.startsWith('E4') || d.code.startsWith('E1') || d.code.startsWith('E2') || d.code.startsWith('E3'));
    }
    formatModuleDisplayPath(filePath) {
        const root = VIGCanonicalizer.normalizePath(this.resolver.getProjectRoot());
        if (filePath.startsWith(root)) {
            const rel = filePath.slice(root.length).replace(/^\/+/, '');
            return rel ? `./${rel}` : filePath;
        }
        return filePath;
    }
    loadModuleRecursive(filePath, inProgress) {
        if (this.modules.has(filePath))
            return;
        if (inProgress.has(filePath))
            return; // Cycle will be handled by detectCycles
        inProgress.add(filePath);
        let sourceText;
        try {
            sourceText = this.resolver.readSource(filePath);
        }
        catch (err) {
            this.diagnostics.push({
                code: 'E4002',
                message: `Failed to read module source file: '${filePath}': ${err.message}`,
                filePath,
            });
            return;
        }
        // Lex and Parse
        let ast;
        try {
            const lexer = new OneLexer(sourceText);
            const tokens = lexer.tokenize();
            const parseResult = GrammarRouter.parse(tokens);
            ast = parseResult.ast;
        }
        catch (err) {
            this.diagnostics.push({
                code: 'E1001',
                message: `Parse error in module '${filePath}': ${err.message}`,
                filePath,
            });
            return;
        }
        const contentHash = crypto.createHash('sha256').update(sourceText, 'utf8').digest('hex');
        const publicApiHash = VIGASTExtractor.computePublicApiHash(sourceText, filePath);
        const exportedSymbols = new Map();
        const importedModules = [];
        // Extract declarations and imports
        for (const stmt of ast.body) {
            // Direct ExportStatement
            if (stmt.kind === 'ExportStatement') {
                const expNode = stmt;
                if (expNode.declaration) {
                    this.registerExportDeclaration(expNode.declaration, exportedSymbols, filePath);
                }
                else if (expNode.specifiers) {
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
                        }
                        else {
                            exportedSymbols.set(symName, {
                                name: symName,
                                kind: 'variable',
                            });
                        }
                    }
                }
            }
            else if (stmt.isExported) {
                this.registerExportDeclaration(stmt, exportedSymbols, filePath);
            }
            // ImportStatement
            if (stmt.kind === 'ImportStatement') {
                const impNode = stmt;
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
        const record = {
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
    registerExportDeclaration(decl, exportedSymbols, filePath) {
        let symName = '';
        let kind = 'variable';
        if (decl.kind === 'FunctionDeclaration') {
            symName = decl.name;
            kind = 'function';
        }
        else if (decl.kind === 'StructDeclaration') {
            symName = decl.name;
            kind = 'struct';
        }
        else if (decl.kind === 'EnumDeclaration') {
            symName = decl.name;
            kind = 'enum';
        }
        else if (decl.kind === 'VariableDeclaration') {
            symName = decl.identifier;
            kind = 'variable';
        }
        if (!symName)
            return;
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
    validateImportReferences() {
        for (const mod of this.modules.values()) {
            for (const imp of mod.importedModules) {
                const depMod = this.modules.get(imp.resolvedPath);
                if (!depMod)
                    continue;
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
    detectCycles(entryPoint) {
        const visited = new Set();
        const recStack = [];
        const inStack = new Set();
        const dfs = (node) => {
            visited.add(node);
            recStack.push(node);
            inStack.add(node);
            const mod = this.modules.get(node);
            if (mod) {
                for (const imp of mod.importedModules) {
                    const target = imp.resolvedPath;
                    if (!visited.has(target)) {
                        const cycle = dfs(target);
                        if (cycle)
                            return cycle;
                    }
                    else if (inStack.has(target)) {
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
    topologicalSort(entryPoint) {
        const visited = new Set();
        const result = [];
        const dfs = (node) => {
            if (visited.has(node))
                return;
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
