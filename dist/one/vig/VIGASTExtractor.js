/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/VIGASTExtractor
 * Specification: VIG Phase 3 Dependency Graph & Impact Tracking
 *
 * Implements actual parser/AST-based source file and symbol extraction,
 * directed edge generation (IMPORTS, CALLS, EXTENDS_OR_IMPLEMENTS,
 * DEFINES_SYMBOL, TESTS_MODULE), and resilient handling of unresolved imports.
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import ts from 'typescript';
import { VIGCanonicalizer } from './VIGCanonicalizer';
import { VIGModel } from './VIGModel';
export class VIGASTExtractor {
    /**
     * Extracts nodes and intra-file edges from source code in memory.
     */
    static extractFromSource(filePath, sourceText, options = {}) {
        const normalizedPath = VIGCanonicalizer.normalizePath(filePath);
        const normalizedText = VIGCanonicalizer.normalizeLineEndings(sourceText);
        const contentHash = crypto.createHash('sha256').update(normalizedText, 'utf8').digest('hex');
        const nodes = [];
        const edges = [];
        const unresolvedImports = [];
        const diagnostics = [];
        const isTest = this.isTestFilePath(normalizedPath);
        const fileKind = isTest ? 'TEST_SUITE' : 'SOURCE_FILE';
        const fileName = path.basename(normalizedPath);
        // 1. Create File Node
        const fileNode = VIGModel.createNode({
            kind: fileKind,
            path: normalizedPath,
            name: fileName,
            contentHash,
            isExported: true,
            metadata: {
                isTest,
                byteLength: Buffer.byteLength(normalizedText, 'utf8'),
            },
        });
        nodes.push(fileNode);
        // If it's a .one file, parse using declarative parser or fallback
        if (normalizedPath.endsWith('.one')) {
            this.extractOneLanguageFile(fileNode, normalizedText, nodes, edges, diagnostics, unresolvedImports, options);
            return { nodes, edges, unresolvedImports, diagnostics };
        }
        // 2. Parse TypeScript / JavaScript AST
        let sourceFile;
        try {
            sourceFile = ts.createSourceFile(normalizedPath, normalizedText, ts.ScriptTarget.Latest, true, // setParentNodes
            ts.ScriptKind.TS);
        }
        catch (err) {
            diagnostics.push({
                level: 'error',
                message: `Failed to parse source file: ${err.message}`,
                path: normalizedPath,
            });
            return { nodes, edges, unresolvedImports, diagnostics };
        }
        // Record TypeScript syntax/parse diagnostics if any
        const parseDiagnostics = sourceFile.parseDiagnostics;
        if (Array.isArray(parseDiagnostics) && parseDiagnostics.length > 0) {
            for (const diag of parseDiagnostics) {
                const msg = typeof diag.messageText === 'string'
                    ? diag.messageText
                    : diag.messageText?.messageText ?? 'Syntax error';
                diagnostics.push({
                    level: 'warning',
                    message: `Syntax diagnostic: ${msg}`,
                    path: normalizedPath,
                    code: String(diag.code),
                });
            }
        }
        // Symbol registry within this file: name -> VIGNode
        const localSymbols = new Map();
        const pendingCalls = [];
        const pendingInheritance = [];
        // 3. Traverse Top-Level AST Statements
        for (const statement of sourceFile.statements) {
            if (ts.isFunctionDeclaration(statement) && statement.name) {
                const symNode = this.createSymbolNode(normalizedPath, statement.name.text, statement, sourceFile);
                nodes.push(symNode);
                localSymbols.set(symNode.name, symNode);
                // DEFINES_SYMBOL: file -> function
                edges.push(VIGModel.createEdge({
                    sourceCid: fileNode.cid,
                    targetCid: symNode.cid,
                    relation: 'DEFINES_SYMBOL',
                    isPublicApi: symNode.isExported,
                }));
                // Scan calls within function body
                if (options.extractCalls !== false && statement.body) {
                    this.scanCalls(statement.body, symNode.cid, sourceFile, pendingCalls);
                }
            }
            else if (ts.isClassDeclaration(statement) && statement.name) {
                const classNode = this.createSymbolNode(normalizedPath, statement.name.text, statement, sourceFile);
                nodes.push(classNode);
                localSymbols.set(classNode.name, classNode);
                edges.push(VIGModel.createEdge({
                    sourceCid: fileNode.cid,
                    targetCid: classNode.cid,
                    relation: 'DEFINES_SYMBOL',
                    isPublicApi: classNode.isExported,
                }));
                // Class heritage (extends / implements)
                if (options.extractInheritance !== false && statement.heritageClauses) {
                    for (const clause of statement.heritageClauses) {
                        for (const typeNode of clause.types) {
                            if (ts.isIdentifier(typeNode.expression)) {
                                pendingInheritance.push({
                                    subClassCid: classNode.cid,
                                    targetName: typeNode.expression.text,
                                    isPublicApi: classNode.isExported,
                                });
                            }
                        }
                    }
                }
                // Methods within class
                for (const member of statement.members) {
                    if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
                        const methodName = `${classNode.name}.${member.name.text}`;
                        const methodNode = this.createSymbolNode(normalizedPath, methodName, member, sourceFile);
                        nodes.push(methodNode);
                        localSymbols.set(methodName, methodNode);
                        edges.push(VIGModel.createEdge({
                            sourceCid: classNode.cid,
                            targetCid: methodNode.cid,
                            relation: 'DEFINES_SYMBOL',
                            isPublicApi: classNode.isExported,
                        }));
                        if (options.extractCalls !== false && member.body) {
                            this.scanCalls(member.body, methodNode.cid, sourceFile, pendingCalls);
                        }
                    }
                }
            }
            else if (ts.isInterfaceDeclaration(statement)) {
                const ifaceNode = this.createSymbolNode(normalizedPath, statement.name.text, statement, sourceFile);
                nodes.push(ifaceNode);
                localSymbols.set(ifaceNode.name, ifaceNode);
                edges.push(VIGModel.createEdge({
                    sourceCid: fileNode.cid,
                    targetCid: ifaceNode.cid,
                    relation: 'DEFINES_SYMBOL',
                    isPublicApi: ifaceNode.isExported,
                }));
                if (options.extractInheritance !== false && statement.heritageClauses) {
                    for (const clause of statement.heritageClauses) {
                        for (const typeNode of clause.types) {
                            if (ts.isIdentifier(typeNode.expression)) {
                                pendingInheritance.push({
                                    subClassCid: ifaceNode.cid,
                                    targetName: typeNode.expression.text,
                                    isPublicApi: ifaceNode.isExported,
                                });
                            }
                        }
                    }
                }
            }
            else if (ts.isTypeAliasDeclaration(statement)) {
                const typeNode = this.createSymbolNode(normalizedPath, statement.name.text, statement, sourceFile);
                nodes.push(typeNode);
                localSymbols.set(typeNode.name, typeNode);
                edges.push(VIGModel.createEdge({
                    sourceCid: fileNode.cid,
                    targetCid: typeNode.cid,
                    relation: 'DEFINES_SYMBOL',
                    isPublicApi: typeNode.isExported,
                }));
            }
            else if (ts.isVariableStatement(statement)) {
                const isExported = this.hasExportModifier(statement);
                for (const decl of statement.declarationList.declarations) {
                    if (ts.isIdentifier(decl.name)) {
                        const varNode = this.createSymbolNode(normalizedPath, decl.name.text, decl, sourceFile, isExported);
                        nodes.push(varNode);
                        localSymbols.set(varNode.name, varNode);
                        edges.push(VIGModel.createEdge({
                            sourceCid: fileNode.cid,
                            targetCid: varNode.cid,
                            relation: 'DEFINES_SYMBOL',
                            isPublicApi: varNode.isExported,
                        }));
                    }
                }
            }
            else if (ts.isImportDeclaration(statement)) {
                const specifier = statement.moduleSpecifier?.text;
                if (specifier) {
                    const loc = this.getSourceLocation(statement, sourceFile);
                    const resolvedPath = this.resolveModulePath(normalizedPath, specifier, options.knownFiles);
                    if (resolvedPath) {
                        if (options.nodeResolver) {
                            const targetNode = options.nodeResolver(resolvedPath);
                            if (targetNode) {
                                try {
                                    edges.push(VIGModel.createEdge({
                                        sourceCid: fileNode.cid,
                                        targetCid: targetNode.cid,
                                        relation: 'IMPORTS',
                                        isPublicApi: false,
                                    }));
                                    if (fileNode.kind === 'TEST_SUITE' && targetNode.kind !== 'TEST_SUITE') {
                                        edges.push(VIGModel.createEdge({
                                            sourceCid: fileNode.cid,
                                            targetCid: targetNode.cid,
                                            relation: 'TESTS_MODULE',
                                            isPublicApi: false,
                                        }));
                                    }
                                }
                                catch {
                                    // Ignore duplicate edges
                                }
                            }
                        }
                    }
                    else {
                        unresolvedImports.push({
                            sourcePath: normalizedPath,
                            specifier,
                            reason: specifier.startsWith('.') ? 'Local file not found' : 'External package dependency',
                            location: loc,
                        });
                    }
                }
            }
            else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
                // Re-export (e.g. export * from './foo' or export { bar } from './baz')
                const specifier = statement.moduleSpecifier?.text;
                if (specifier) {
                    const loc = this.getSourceLocation(statement, sourceFile);
                    const resolvedPath = this.resolveModulePath(normalizedPath, specifier, options.knownFiles);
                    if (resolvedPath) {
                        if (options.nodeResolver) {
                            const targetNode = options.nodeResolver(resolvedPath);
                            if (targetNode) {
                                try {
                                    edges.push(VIGModel.createEdge({
                                        sourceCid: fileNode.cid,
                                        targetCid: targetNode.cid,
                                        relation: 'IMPORTS',
                                        isPublicApi: true, // Re-export affects public API contracts
                                    }));
                                }
                                catch {
                                    // Ignore duplicate edges
                                }
                            }
                        }
                    }
                    else {
                        unresolvedImports.push({
                            sourcePath: normalizedPath,
                            specifier,
                            reason: 'Re-exported module not resolved',
                            location: loc,
                        });
                    }
                }
            }
        }
        // 3.5. Scan Dynamic import() expressions and CommonJS require() dependencies
        this.scanDynamicImports(sourceFile, fileNode, normalizedPath, options, edges, unresolvedImports, diagnostics);
        // 4. Resolve Local Intra-File CALLS
        for (const call of pendingCalls) {
            const callee = localSymbols.get(call.calleeName);
            if (callee) {
                try {
                    edges.push(VIGModel.createEdge({
                        sourceCid: call.callerCid,
                        targetCid: callee.cid,
                        relation: 'CALLS',
                        isPublicApi: false,
                    }));
                }
                catch (err) {
                    // Ignore duplicate edges or referential edge conflicts
                }
            }
        }
        // 5. Resolve Local Intra-File EXTENDS_OR_IMPLEMENTS
        for (const inh of pendingInheritance) {
            const parentNode = localSymbols.get(inh.targetName);
            if (parentNode) {
                try {
                    edges.push(VIGModel.createEdge({
                        sourceCid: inh.subClassCid,
                        targetCid: parentNode.cid,
                        relation: 'EXTENDS_OR_IMPLEMENTS',
                        isPublicApi: inh.isPublicApi,
                    }));
                }
                catch (err) {
                    // Ignore duplicates
                }
            }
        }
        return {
            nodes,
            edges,
            unresolvedImports,
            diagnostics,
        };
    }
    /**
     * Multi-file project extraction: parses a set of files, resolves cross-file
     * IMPORTS, TESTS_MODULE, and external dependency links.
     */
    static extractProject(fileMap, options = {}) {
        const knownFiles = new Set(Array.from(fileMap.keys()).map((p) => VIGCanonicalizer.normalizePath(p)));
        const mergedOptions = { ...options, knownFiles };
        const allNodes = [];
        const allEdges = [];
        const allUnresolved = [];
        const allDiagnostics = [];
        // Map: normalizedPath -> file VIGNode
        const fileNodeMap = new Map();
        // Map: normalizedPath -> (symbolName -> VIGNode)
        const fileSymbolsMap = new Map();
        // Pending cross-file edges to link
        const pendingCrossEdges = [];
        // Pass 1: Parse every file and collect file & symbol nodes
        for (const [rawPath, content] of fileMap.entries()) {
            const normPath = VIGCanonicalizer.normalizePath(rawPath);
            const res = this.extractFromSource(normPath, content, mergedOptions);
            for (const node of res.nodes) {
                allNodes.push(node);
                if (node.kind === 'SOURCE_FILE' || node.kind === 'TEST_SUITE') {
                    fileNodeMap.set(node.path, node);
                }
                else if (node.kind === 'AST_DECLARATION') {
                    let syms = fileSymbolsMap.get(node.path);
                    if (!syms) {
                        syms = new Map();
                        fileSymbolsMap.set(node.path, syms);
                    }
                    syms.set(node.name, node);
                }
            }
            for (const edge of res.edges) {
                allEdges.push(edge);
            }
            for (const diag of res.diagnostics) {
                allDiagnostics.push(diag);
            }
            // Collect cross-file imports for Pass 2
            this.collectCrossFileDependencies(normPath, content, pendingCrossEdges);
        }
        // Pass 2: Resolve Cross-File Edges
        for (const pending of pendingCrossEdges) {
            const resolvedPath = this.resolveModulePath(pending.sourcePath, pending.targetSpecifier, knownFiles);
            if (!resolvedPath) {
                allUnresolved.push({
                    sourcePath: pending.sourcePath,
                    specifier: pending.targetSpecifier,
                    reason: pending.targetSpecifier.startsWith('.') ? 'Module file not found in project set' : 'External package import',
                    location: pending.location,
                });
                continue;
            }
            const targetFileNode = fileNodeMap.get(resolvedPath);
            if (!targetFileNode) {
                allUnresolved.push({
                    sourcePath: pending.sourcePath,
                    specifier: pending.targetSpecifier,
                    reason: `Resolved path "${resolvedPath}" has no indexed file node`,
                    location: pending.location,
                });
                continue;
            }
            // 1. Add IMPORTS edge: sourceFile -> targetFile
            try {
                const importEdge = VIGModel.createEdge({
                    sourceCid: pending.sourceCid,
                    targetCid: targetFileNode.cid,
                    relation: 'IMPORTS',
                    isPublicApi: pending.isPublicApi,
                });
                allEdges.push(importEdge);
            }
            catch (err) {
                // Duplicate edge or conflict
            }
            // 2. If source is a TEST_SUITE and target is in src/ (or not test), add TESTS_MODULE edge
            const sourceFileNode = fileNodeMap.get(pending.sourcePath);
            if (sourceFileNode &&
                this.isTestFilePath(sourceFileNode.path) &&
                !this.isTestFilePath(targetFileNode.path)) {
                try {
                    const testEdge = VIGModel.createEdge({
                        sourceCid: sourceFileNode.cid,
                        targetCid: targetFileNode.cid,
                        relation: 'TESTS_MODULE',
                        isPublicApi: false,
                    });
                    allEdges.push(testEdge);
                }
                catch (err) {
                    // Duplicate edge
                }
            }
            // 3. Cross-file Symbol CALLS or EXTENDS if targetSymbolName specified
            if (pending.targetSymbolName) {
                const targetSymbols = fileSymbolsMap.get(resolvedPath);
                const targetSymNode = targetSymbols?.get(pending.targetSymbolName);
                if (targetSymNode) {
                    try {
                        const symEdge = VIGModel.createEdge({
                            sourceCid: pending.sourceCid,
                            targetCid: targetSymNode.cid,
                            relation: pending.relation,
                            isPublicApi: pending.isPublicApi,
                        });
                        allEdges.push(symEdge);
                    }
                    catch (err) {
                        // Duplicate
                    }
                }
            }
        }
        return {
            nodes: allNodes,
            edges: allEdges,
            unresolvedImports: allUnresolved,
            diagnostics: allDiagnostics,
        };
    }
    /**
     * Safely populates an existing VIGGraphStore with extraction results.
     * Ensures nodes are inserted first before edges to guarantee referential integrity.
     */
    static populateGraphStore(extraction, store) {
        let nodesAdded = 0;
        let edgesAdded = 0;
        // 1. Insert nodes
        for (const node of extraction.nodes) {
            if (store.addNode(node)) {
                nodesAdded++;
            }
        }
        // 2. Insert edges
        for (const edge of extraction.edges) {
            try {
                store.addEdge(edge);
                edgesAdded++;
            }
            catch (err) {
                // Skip edges with missing referents or conflict errors
            }
        }
        return { nodesAdded, edgesAdded };
    }
    /**
     * Computes a deterministic SHA-256 signature hash of all exported declarations
     * (classes, interfaces, types, exported functions, public class members).
     * Used to distinguish internal private body changes from public API signature changes.
     * If parsing fails or syntax is invalid, returns 'INVALID_PARSE_ERROR' rather than hashing raw file content.
     */
    static computePublicApiHash(sourceText, filePath) {
        return this.extractPublicApi(sourceText, filePath).publicApiHash;
    }
    /**
     * Extracts public API signatures and parse status from TypeScript or ONE Language source code.
     * Distinguishes valid files from syntax errors without resorting to raw content hashing.
     */
    static extractPublicApi(sourceText, filePath) {
        const norm = VIGCanonicalizer.normalizeLineEndings(sourceText);
        if (filePath?.endsWith('.one') || this.isOneLanguageSource(norm, filePath)) {
            return this.extractOnePublicDeclarations(norm);
        }
        let sf;
        try {
            sf = ts.createSourceFile(filePath ?? 'source.ts', norm, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
        }
        catch (err) {
            return {
                status: 'INVALID',
                publicApiHash: 'INVALID_PARSE_ERROR',
                signatures: [],
                error: err.message,
                isOneLanguage: false,
            };
        }
        // Check for parse/syntax errors in TypeScript AST
        const parseDiagnostics = sf.parseDiagnostics;
        const hasSyntaxError = Array.isArray(parseDiagnostics) &&
            parseDiagnostics.some((d) => d.category === ts.DiagnosticCategory.Error || d.category === 1);
        if (hasSyntaxError) {
            const firstError = parseDiagnostics.find((d) => d.category === ts.DiagnosticCategory.Error || d.category === 1);
            const msg = typeof firstError?.messageText === 'string'
                ? firstError.messageText
                : firstError?.messageText?.messageText ?? 'Syntax error';
            return {
                status: 'INVALID',
                publicApiHash: 'INVALID_PARSE_ERROR',
                signatures: [],
                error: msg,
                isOneLanguage: false,
            };
        }
        const signatures = [];
        for (const stmt of sf.statements) {
            if (ts.isFunctionDeclaration(stmt) && this.hasExportModifier(stmt) && stmt.name) {
                // Collect function name, params, and return type (excluding implementation body!)
                const params = stmt.parameters
                    .map((p) => `${p.name.getText(sf)}:${p.type ? p.type.getText(sf).trim() : 'any'}`)
                    .join(',');
                const ret = stmt.type ? stmt.type.getText(sf).trim() : 'void';
                signatures.push(`fn:${stmt.name.text}(${params}):${ret}`);
            }
            else if (ts.isClassDeclaration(stmt) && this.hasExportModifier(stmt) && stmt.name) {
                // Class heritage
                const heritage = stmt.heritageClauses?.map((h) => h.getText(sf).trim()).join(';') ?? '';
                // Public/protected members only (excluding method bodies!)
                const members = [];
                for (const m of stmt.members) {
                    const isPrivate = m.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.PrivateKeyword);
                    if (!isPrivate && m.name) {
                        const memberName = m.name.getText(sf);
                        if (ts.isMethodDeclaration(m)) {
                            const params = m.parameters
                                .map((p) => `${p.name.getText(sf)}:${p.type ? p.type.getText(sf).trim() : 'any'}`)
                                .join(',');
                            const ret = m.type ? m.type.getText(sf).trim() : 'void';
                            members.push(`m:${memberName}(${params}):${ret}`);
                        }
                        else if (ts.isPropertyDeclaration(m)) {
                            const typ = m.type ? m.type.getText(sf).trim() : 'any';
                            members.push(`prop:${memberName}:${typ}`);
                        }
                    }
                }
                members.sort();
                signatures.push(`class:${stmt.name.text}:${heritage}{${members.join(';')}}`);
            }
            else if (ts.isInterfaceDeclaration(stmt) && this.hasExportModifier(stmt)) {
                signatures.push(`interface:${stmt.getText(sf).trim()}`);
            }
            else if (ts.isTypeAliasDeclaration(stmt) && this.hasExportModifier(stmt)) {
                signatures.push(`type:${stmt.getText(sf).trim()}`);
            }
            else if (ts.isVariableStatement(stmt) && this.hasExportModifier(stmt)) {
                for (const d of stmt.declarationList.declarations) {
                    const name = d.name.getText(sf);
                    const typ = d.type ? d.type.getText(sf).trim() : 'any';
                    signatures.push(`var:${name}:${typ}`);
                }
            }
            else if (ts.isExportDeclaration(stmt)) {
                signatures.push(`reexport:${stmt.getText(sf).trim()}`);
            }
        }
        signatures.sort();
        const payload = signatures.join('\n');
        const publicApiHash = crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
        return {
            status: 'VALID',
            publicApiHash,
            signatures,
            isOneLanguage: false,
        };
    }
    /**
     * Native ONE Language public declaration and signature extractor.
     * Parses modules, constants, structs, enums, native classes (public members),
     * functions, declarative nodes, and imports without TypeScript AST bias.
     */
    static extractOnePublicDeclarations(sourceText) {
        const norm = VIGCanonicalizer.normalizeLineEndings(sourceText);
        // 1. Delimiter balance check
        const delim = this.checkDelimiters(norm);
        if (!delim.balanced) {
            return {
                status: 'INVALID',
                publicApiHash: 'INVALID_PARSE_ERROR',
                signatures: [],
                error: delim.reason,
                isOneLanguage: true,
            };
        }
        // 2. Strip comments (preserving code strings and newlines)
        const clean = this.stripComments(norm);
        const signatures = [];
        // 3. Modules: module Name { ... } or module Name;
        const modMatches = clean.matchAll(/\bmodule\s+([A-Za-z0-9_.]+)/g);
        for (const m of modMatches) {
            signatures.push(`module:${m[1]}`);
        }
        // 4. Imports: import 'path' or import Name from 'path'
        const importMatches = clean.matchAll(/\bimport\s+([^;\n]+)/g);
        for (const m of importMatches) {
            signatures.push(`import:${m[1].trim()}`);
        }
        // 5. Constants: const NAME: Type = ...
        const constMatches = clean.matchAll(/\b(?:export\s+)?const\s+([A-Za-z0-9_]+)\s*:\s*([A-Za-z0-9_<>]+)/g);
        for (const m of constMatches) {
            signatures.push(`const:${m[1]}:${m[2]}`);
        }
        // 6. Structs: struct Name { fields... }
        const structRegex = /\b(?:export\s+)?struct\s+([A-Za-z0-9_]+)\s*\{([^}]*)\}/g;
        let sMatch;
        while ((sMatch = structRegex.exec(clean)) !== null) {
            const structName = sMatch[1];
            const body = sMatch[2];
            const fields = [];
            const fieldRegex = /([A-Za-z0-9_]+)\s*:\s*([A-Za-z0-9_<>\[\]]+)/g;
            let fMatch;
            while ((fMatch = fieldRegex.exec(body)) !== null) {
                fields.push(`${fMatch[1]}:${fMatch[2]}`);
            }
            fields.sort();
            signatures.push(`struct:${structName}{${fields.join(',')}}`);
        }
        // 7. Enums: enum Name { variants... }
        const enumRegex = /\b(?:export\s+)?enum\s+([A-Za-z0-9_]+)\s*\{([^}]*)\}/g;
        let eMatch;
        while ((eMatch = enumRegex.exec(clean)) !== null) {
            const enumName = eMatch[1];
            const body = eMatch[2];
            const variants = body
                .split(/[,;\n]/)
                .map((v) => v.trim())
                .filter((v) => v.length > 0 && /^[A-Za-z0-9_]+$/.test(v));
            variants.sort();
            signatures.push(`enum:${enumName}{${variants.join(',')}}`);
        }
        // 8. Classes: (native\s+)?class Name { ... }
        const classStartRegex = /(?:native\s+)?class\s+([A-Za-z0-9_]+)[^{]*\{/g;
        let cStartMatch;
        while ((cStartMatch = classStartRegex.exec(clean)) !== null) {
            const className = cStartMatch[1];
            const openBraceIdx = clean.indexOf('{', cStartMatch.index);
            let bCount = 1;
            let endBraceIdx = openBraceIdx + 1;
            while (endBraceIdx < clean.length && bCount > 0) {
                if (clean[endBraceIdx] === '{')
                    bCount++;
                else if (clean[endBraceIdx] === '}')
                    bCount--;
                endBraceIdx++;
            }
            const classBody = clean.slice(openBraceIdx + 1, endBraceIdx - 1);
            const members = [];
            // Methods: (public|private)?\s*method\s+name(params): retType
            const methodRegex = /(?:(public|private)\s+)?method\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*(?::\s*([A-Za-z0-9_<>\[\]]+))?/g;
            let mMatch;
            while ((mMatch = methodRegex.exec(classBody)) !== null) {
                const vis = mMatch[1] || 'public';
                if (vis === 'private')
                    continue;
                const mName = mMatch[2];
                const params = mMatch[3].replace(/\s+/g, '').replace(/,/g, ', ');
                const retType = (mMatch[4] || 'Void').trim();
                members.push(`m:${mName}(${params}):${retType}`);
            }
            // Constructor: constructor(params)
            const ctorRegex = /constructor\s*\(([^)]*)\)/g;
            let ctorMatch;
            while ((ctorMatch = ctorRegex.exec(classBody)) !== null) {
                const params = ctorMatch[1].replace(/\s+/g, '').replace(/,/g, ', ');
                members.push(`ctor:(${params})`);
            }
            // Public fields: public (field\s+)?name: Type;
            const pubFieldRegex = /public\s+(?:field\s+)?([A-Za-z0-9_]+)\s*:\s*([A-Za-z0-9_<>\[\]]+)/g;
            let pfMatch;
            while ((pfMatch = pubFieldRegex.exec(classBody)) !== null) {
                members.push(`prop:${pfMatch[1]}:${pfMatch[2]}`);
            }
            members.sort();
            signatures.push(`class:${className}{${members.join(';')}}`);
        }
        // 9. Top-level functions: fn name(params): retType
        const fnRegex = /\b(?:export\s+)?fn\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*(?::\s*([A-Za-z0-9_<>\[\]]+))?/g;
        let fnMatch;
        while ((fnMatch = fnRegex.exec(clean)) !== null) {
            const fnName = fnMatch[1];
            const params = fnMatch[2].replace(/\s+/g, '').replace(/,/g, ', ');
            const retType = (fnMatch[3] || 'Void').trim();
            signatures.push(`fn:${fnName}(${params}):${retType}`);
        }
        // 10. Declarative constructs: node, funnel, channel, seal, slice
        const nodeMatches = clean.matchAll(/\bnode\s+([A-Za-z0-9_]+)/g);
        for (const m of nodeMatches)
            signatures.push(`node:${m[1]}`);
        const funnelMatches = clean.matchAll(/\bfunnel\s+([A-Za-z0-9_]+)/g);
        for (const m of funnelMatches)
            signatures.push(`funnel:${m[1]}`);
        const channelMatches = clean.matchAll(/\bchannel\s+([A-Za-z0-9_]+)/g);
        for (const m of channelMatches)
            signatures.push(`channel:${m[1]}`);
        const sealMatches = clean.matchAll(/\bseal\s+([A-Za-z0-9_]+)/g);
        for (const m of sealMatches)
            signatures.push(`seal:${m[1]}`);
        const sliceMatches = clean.matchAll(/\bslice\s+([A-Za-z0-9_]+)/g);
        for (const m of sliceMatches)
            signatures.push(`slice:${m[1]}`);
        signatures.sort();
        const payload = signatures.join('\n');
        const publicApiHash = crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
        return {
            status: 'VALID',
            publicApiHash,
            signatures,
            isOneLanguage: true,
        };
    }
    // ── AST Helpers ─────────────────────────────────────────────────────────────
    static createSymbolNode(filePath, name, astNode, sourceFile, explicitExport) {
        const isExported = explicitExport !== undefined
            ? explicitExport
            : this.hasExportModifier(astNode);
        const location = this.getSourceLocation(astNode, sourceFile);
        const nodeText = astNode.getText(sourceFile);
        const contentHash = crypto.createHash('sha256').update(nodeText, 'utf8').digest('hex');
        return VIGModel.createNode({
            kind: 'AST_DECLARATION',
            path: filePath,
            name,
            contentHash,
            location,
            isExported,
            metadata: {
                syntaxKind: ts.SyntaxKind[astNode.kind],
            },
        });
    }
    static scanCalls(body, callerCid, sourceFile, calls) {
        const visit = (node) => {
            if (ts.isCallExpression(node)) {
                let calleeName;
                if (ts.isIdentifier(node.expression)) {
                    calleeName = node.expression.text;
                }
                else if (ts.isPropertyAccessExpression(node.expression) &&
                    ts.isIdentifier(node.expression.name)) {
                    calleeName = node.expression.name.text;
                }
                if (calleeName) {
                    calls.push({
                        callerCid,
                        calleeName,
                        location: this.getSourceLocation(node, sourceFile),
                    });
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(body);
    }
    static scanDynamicImports(sourceFile, fileNode, normalizedPath, options, edges, unresolvedImports, diagnostics) {
        const seenSpecifiers = new Set();
        const visit = (node) => {
            if (ts.isCallExpression(node)) {
                const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
                const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
                if (isDynamicImport || isRequire) {
                    const loc = this.getSourceLocation(node, sourceFile);
                    const firstArg = node.arguments[0];
                    if (!firstArg) {
                        unresolvedImports.push({
                            sourcePath: normalizedPath,
                            specifier: '<empty>',
                            reason: 'Empty dynamic import or require call',
                            location: loc,
                        });
                    }
                    else if (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg)) {
                        const specifier = firstArg.text;
                        if (!seenSpecifiers.has(specifier)) {
                            seenSpecifiers.add(specifier);
                            const resolvedPath = this.resolveModulePath(normalizedPath, specifier, options.knownFiles);
                            if (resolvedPath) {
                                if (options.nodeResolver) {
                                    const targetNode = options.nodeResolver(resolvedPath);
                                    if (targetNode) {
                                        try {
                                            edges.push(VIGModel.createEdge({
                                                sourceCid: fileNode.cid,
                                                targetCid: targetNode.cid,
                                                relation: 'IMPORTS',
                                                isPublicApi: false,
                                            }));
                                            if (fileNode.kind === 'TEST_SUITE' && targetNode.kind !== 'TEST_SUITE') {
                                                edges.push(VIGModel.createEdge({
                                                    sourceCid: fileNode.cid,
                                                    targetCid: targetNode.cid,
                                                    relation: 'TESTS_MODULE',
                                                    isPublicApi: false,
                                                }));
                                            }
                                        }
                                        catch {
                                            // duplicate edge
                                        }
                                    }
                                }
                            }
                            else {
                                unresolvedImports.push({
                                    sourcePath: normalizedPath,
                                    specifier,
                                    reason: specifier.startsWith('.') ? 'Local file not found' : 'External package dependency',
                                    location: loc,
                                });
                            }
                        }
                    }
                    else {
                        // Computed argument
                        const exprText = firstArg.getText(sourceFile);
                        unresolvedImports.push({
                            sourcePath: normalizedPath,
                            specifier: exprText,
                            reason: 'Computed dynamic import specifier cannot be statically resolved',
                            location: loc,
                        });
                        diagnostics.push({
                            level: 'info',
                            message: `Computed dynamic import specifier cannot be statically resolved: ${exprText}`,
                            path: normalizedPath,
                            location: loc,
                        });
                    }
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
    }
    static collectCrossFileDependencies(sourcePath, content, pending) {
        const fileCid = VIGModel.createNode({
            kind: this.isTestFilePath(sourcePath) ? 'TEST_SUITE' : 'SOURCE_FILE',
            path: sourcePath,
            name: path.basename(sourcePath),
            contentHash: crypto.createHash('sha256').update(content, 'utf8').digest('hex'),
            isExported: true,
        }).cid;
        if (sourcePath.endsWith('.one')) {
            const importMatches = content.matchAll(/\bimport\s+['"]([^'"]+)['"]/g);
            for (const m of importMatches) {
                pending.push({
                    sourceCid: fileCid,
                    targetSpecifier: m[1],
                    sourcePath,
                    relation: 'IMPORTS',
                    isPublicApi: false,
                });
            }
            return;
        }
        let sf;
        try {
            sf = ts.createSourceFile(sourcePath, content, ts.ScriptTarget.Latest, true);
        }
        catch {
            return;
        }
        const seenSpecifiers = new Set();
        for (const statement of sf.statements) {
            if (ts.isImportDeclaration(statement)) {
                const specifier = statement.moduleSpecifier?.text;
                if (specifier && !seenSpecifiers.has(specifier)) {
                    seenSpecifiers.add(specifier);
                    pending.push({
                        sourceCid: fileCid,
                        targetSpecifier: specifier,
                        sourcePath,
                        relation: 'IMPORTS',
                        isPublicApi: false,
                        location: this.getSourceLocation(statement, sf),
                    });
                }
            }
            else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
                const specifier = statement.moduleSpecifier?.text;
                if (specifier && !seenSpecifiers.has(specifier)) {
                    seenSpecifiers.add(specifier);
                    pending.push({
                        sourceCid: fileCid,
                        targetSpecifier: specifier,
                        sourcePath,
                        relation: 'IMPORTS',
                        isPublicApi: true, // Re-export affects public API contracts
                        location: this.getSourceLocation(statement, sf),
                    });
                }
            }
        }
        // Dynamic import() and CommonJS require()
        const visit = (node) => {
            if (ts.isCallExpression(node)) {
                const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
                const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
                if (isDynamicImport || isRequire) {
                    const firstArg = node.arguments[0];
                    if (firstArg && (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg))) {
                        const specifier = firstArg.text;
                        if (!seenSpecifiers.has(specifier)) {
                            seenSpecifiers.add(specifier);
                            pending.push({
                                sourceCid: fileCid,
                                targetSpecifier: specifier,
                                sourcePath,
                                relation: 'IMPORTS',
                                isPublicApi: false,
                                location: this.getSourceLocation(node, sf),
                            });
                        }
                    }
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(sf);
    }
    static resolveModulePath(fromFilePath, specifier, knownFiles) {
        if (!specifier.startsWith('.')) {
            // Non-relative import (e.g. 'fs', 'crypto', 'typescript')
            return null;
        }
        const fromDir = path.dirname(fromFilePath);
        let resolved = path.join(fromDir, specifier).replace(/\\/g, '/');
        // Remove any trailing .js if present (CommonJS/ESM rewrite)
        if (resolved.endsWith('.js')) {
            resolved = resolved.slice(0, -3);
        }
        const candidates = [
            resolved + '.ts',
            resolved + '.tsx',
            resolved + '.js',
            resolved + '/index.ts',
            resolved + '/index.js',
            resolved,
        ];
        if (knownFiles) {
            for (const cand of candidates) {
                const normCand = VIGCanonicalizer.normalizePath(cand);
                if (knownFiles.has(normCand)) {
                    return normCand;
                }
            }
            if (process.platform === 'win32') {
                for (const cand of candidates) {
                    const lower = cand.toLowerCase();
                    for (const kf of knownFiles) {
                        if (kf.toLowerCase() === lower) {
                            return kf;
                        }
                    }
                }
            }
        }
        // Try filesystem if knownFiles was not provided or candidate not in memory
        for (const cand of candidates) {
            if (fs.existsSync(cand)) {
                return VIGCanonicalizer.normalizePath(cand);
            }
        }
        return null;
    }
    static isOneLanguageSource(sourceText, filePath) {
        if (filePath && filePath.endsWith('.one'))
            return true;
        return (/\bmodule\s+[A-Za-z0-9_.]+\s*\{/.test(sourceText) ||
            /\bnative\s+class\b/.test(sourceText) ||
            /\bstruct\s+[A-Za-z0-9_]+\s*\{/.test(sourceText));
    }
    static checkDelimiters(src) {
        let inString = false;
        let stringChar = '';
        let escape = false;
        let inLineComment = false;
        let inBlockComment = false;
        let braceCount = 0;
        let parenCount = 0;
        for (let i = 0; i < src.length; i++) {
            const c = src[i];
            const next = src[i + 1];
            if (inLineComment) {
                if (c === '\n')
                    inLineComment = false;
                continue;
            }
            if (inBlockComment) {
                if (c === '*' && next === '/') {
                    inBlockComment = false;
                    i++;
                }
                continue;
            }
            if (inString) {
                if (escape) {
                    escape = false;
                }
                else if (c === '\\') {
                    escape = true;
                }
                else if (c === stringChar) {
                    inString = false;
                }
                continue;
            }
            if (c === '/' && next === '/') {
                inLineComment = true;
                i++;
                continue;
            }
            if (c === '#') {
                inLineComment = true;
                continue;
            }
            if (c === '/' && next === '*') {
                inBlockComment = true;
                i++;
                continue;
            }
            if (c === '"' || c === "'") {
                inString = true;
                stringChar = c;
                continue;
            }
            if (c === '{')
                braceCount++;
            else if (c === '}') {
                braceCount--;
                if (braceCount < 0)
                    return { balanced: false, reason: 'Unexpected closing brace }' };
            }
            else if (c === '(')
                parenCount++;
            else if (c === ')') {
                parenCount--;
                if (parenCount < 0)
                    return { balanced: false, reason: 'Unexpected closing parenthesis )' };
            }
        }
        if (braceCount !== 0)
            return { balanced: false, reason: `Unclosed brace (missing ${braceCount} '}')` };
        if (parenCount !== 0)
            return { balanced: false, reason: `Unclosed parenthesis (missing ${parenCount} ')')` };
        return { balanced: true };
    }
    static stripComments(src) {
        let out = '';
        let inString = false;
        let stringChar = '';
        let escape = false;
        let inLineComment = false;
        let inBlockComment = false;
        for (let i = 0; i < src.length; i++) {
            const c = src[i];
            const next = src[i + 1];
            if (inLineComment) {
                if (c === '\n') {
                    inLineComment = false;
                    out += '\n';
                }
                continue;
            }
            if (inBlockComment) {
                if (c === '*' && next === '/') {
                    inBlockComment = false;
                    i++;
                }
                continue;
            }
            if (inString) {
                out += c;
                if (escape) {
                    escape = false;
                }
                else if (c === '\\') {
                    escape = true;
                }
                else if (c === stringChar) {
                    inString = false;
                }
                continue;
            }
            if (c === '/' && next === '/') {
                inLineComment = true;
                i++;
                continue;
            }
            if (c === '#') {
                inLineComment = true;
                continue;
            }
            if (c === '/' && next === '*') {
                inBlockComment = true;
                i++;
                continue;
            }
            if (c === '"' || c === "'") {
                inString = true;
                stringChar = c;
                out += c;
                continue;
            }
            out += c;
        }
        return out;
    }
    static extractOneLanguageFile(fileNode, text, nodes, edges, diagnostics, unresolvedImports, options) {
        const delim = this.checkDelimiters(text);
        if (!delim.balanced) {
            diagnostics.push({
                level: 'error',
                message: `ONE Language parse error: ${delim.reason}`,
                path: fileNode.path,
            });
            return;
        }
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('#') || line.startsWith('//'))
                continue;
            // Module: module Name {
            const modMatch = line.match(/^module\s+([A-Za-z0-9_.]+)/i);
            if (modMatch) {
                const modName = modMatch[1];
                const symNode = VIGModel.createNode({
                    kind: 'AST_DECLARATION',
                    path: fileNode.path,
                    name: modName,
                    contentHash: crypto.createHash('sha256').update(line, 'utf8').digest('hex'),
                    location: { startLine: i + 1, startColumn: 1, endLine: i + 1, endColumn: line.length + 1 },
                    isExported: true,
                    metadata: { oneLanguageConstruct: 'Module' },
                });
                nodes.push(symNode);
                edges.push(VIGModel.createEdge({
                    sourceCid: fileNode.cid,
                    targetCid: symNode.cid,
                    relation: 'DEFINES_SYMBOL',
                    isPublicApi: true,
                }));
                continue;
            }
            // Const: const NAME: Type = ...
            const constMatch = line.match(/^const\s+([A-Za-z0-9_]+)\s*:\s*([A-Za-z0-9_<>]+)/i);
            if (constMatch) {
                const cName = constMatch[1];
                const symNode = VIGModel.createNode({
                    kind: 'AST_DECLARATION',
                    path: fileNode.path,
                    name: cName,
                    contentHash: crypto.createHash('sha256').update(line, 'utf8').digest('hex'),
                    location: { startLine: i + 1, startColumn: 1, endLine: i + 1, endColumn: line.length + 1 },
                    isExported: true,
                    metadata: { oneLanguageConstruct: 'Constant', type: constMatch[2] },
                });
                nodes.push(symNode);
                edges.push(VIGModel.createEdge({
                    sourceCid: fileNode.cid,
                    targetCid: symNode.cid,
                    relation: 'DEFINES_SYMBOL',
                    isPublicApi: true,
                }));
                continue;
            }
            // Struct: struct Name {
            const structMatch = line.match(/^struct\s+([A-Za-z0-9_]+)/i);
            if (structMatch) {
                const sName = structMatch[1];
                const symNode = VIGModel.createNode({
                    kind: 'AST_DECLARATION',
                    path: fileNode.path,
                    name: sName,
                    contentHash: crypto.createHash('sha256').update(line, 'utf8').digest('hex'),
                    location: { startLine: i + 1, startColumn: 1, endLine: i + 1, endColumn: line.length + 1 },
                    isExported: true,
                    metadata: { oneLanguageConstruct: 'Struct' },
                });
                nodes.push(symNode);
                edges.push(VIGModel.createEdge({
                    sourceCid: fileNode.cid,
                    targetCid: symNode.cid,
                    relation: 'DEFINES_SYMBOL',
                    isPublicApi: true,
                }));
                continue;
            }
            // Enum: enum Name {
            const enumMatch = line.match(/^enum\s+([A-Za-z0-9_]+)/i);
            if (enumMatch) {
                const eName = enumMatch[1];
                const symNode = VIGModel.createNode({
                    kind: 'AST_DECLARATION',
                    path: fileNode.path,
                    name: eName,
                    contentHash: crypto.createHash('sha256').update(line, 'utf8').digest('hex'),
                    location: { startLine: i + 1, startColumn: 1, endLine: i + 1, endColumn: line.length + 1 },
                    isExported: true,
                    metadata: { oneLanguageConstruct: 'Enum' },
                });
                nodes.push(symNode);
                edges.push(VIGModel.createEdge({
                    sourceCid: fileNode.cid,
                    targetCid: symNode.cid,
                    relation: 'DEFINES_SYMBOL',
                    isPublicApi: true,
                }));
                continue;
            }
            // Class / Native Class: (native )?class Name {
            const classMatch = line.match(/^(?:native\s+)?class\s+([A-Za-z0-9_]+)/i);
            if (classMatch) {
                const cName = classMatch[1];
                const symNode = VIGModel.createNode({
                    kind: 'AST_DECLARATION',
                    path: fileNode.path,
                    name: cName,
                    contentHash: crypto.createHash('sha256').update(line, 'utf8').digest('hex'),
                    location: { startLine: i + 1, startColumn: 1, endLine: i + 1, endColumn: line.length + 1 },
                    isExported: true,
                    metadata: { oneLanguageConstruct: 'Class' },
                });
                nodes.push(symNode);
                edges.push(VIGModel.createEdge({
                    sourceCid: fileNode.cid,
                    targetCid: symNode.cid,
                    relation: 'DEFINES_SYMBOL',
                    isPublicApi: true,
                }));
                continue;
            }
            // Declarative nodes: node, funnel, channel, seal, slice
            const spatialMatch = line.match(/^(node|funnel|channel|seal|slice)\s+([A-Za-z0-9_]+)/i);
            if (spatialMatch) {
                const kindName = spatialMatch[1].toLowerCase();
                const nodeName = spatialMatch[2];
                const symNode = VIGModel.createNode({
                    kind: 'AST_DECLARATION',
                    path: fileNode.path,
                    name: nodeName,
                    contentHash: crypto.createHash('sha256').update(line, 'utf8').digest('hex'),
                    location: { startLine: i + 1, startColumn: 1, endLine: i + 1, endColumn: line.length + 1 },
                    isExported: true,
                    metadata: { oneLanguageConstruct: kindName },
                });
                nodes.push(symNode);
                edges.push(VIGModel.createEdge({
                    sourceCid: fileNode.cid,
                    targetCid: symNode.cid,
                    relation: 'DEFINES_SYMBOL',
                    isPublicApi: true,
                }));
                continue;
            }
            // Function: fn FunctionName() or export fn FunctionName()
            const fnMatch = line.match(/^(?:export\s+)?fn\s+([A-Za-z0-9_]+)/i);
            if (fnMatch) {
                const fnName = fnMatch[1];
                const isExported = line.toLowerCase().startsWith('export ');
                const symNode = VIGModel.createNode({
                    kind: 'AST_DECLARATION',
                    path: fileNode.path,
                    name: fnName,
                    contentHash: crypto.createHash('sha256').update(line, 'utf8').digest('hex'),
                    location: { startLine: i + 1, startColumn: 1, endLine: i + 1, endColumn: line.length + 1 },
                    isExported,
                    metadata: { oneLanguageConstruct: 'Function' },
                });
                nodes.push(symNode);
                edges.push(VIGModel.createEdge({
                    sourceCid: fileNode.cid,
                    targetCid: symNode.cid,
                    relation: 'DEFINES_SYMBOL',
                    isPublicApi: isExported,
                }));
                continue;
            }
            // Import: import 'specifier' or import Module from 'specifier'
            const importMatch = line.match(/^import\s+(?:.*?from\s+)?['"]([^'"]+)['"]/i);
            if (importMatch && unresolvedImports) {
                const specifier = importMatch[1];
                const loc = { startLine: i + 1, startColumn: 1, endLine: i + 1, endColumn: line.length + 1 };
                const resolvedPath = this.resolveModulePath(fileNode.path, specifier, options?.knownFiles);
                if (resolvedPath && options?.nodeResolver) {
                    const targetNode = options.nodeResolver(resolvedPath);
                    if (targetNode) {
                        try {
                            edges.push(VIGModel.createEdge({
                                sourceCid: fileNode.cid,
                                targetCid: targetNode.cid,
                                relation: 'IMPORTS',
                                isPublicApi: false,
                            }));
                        }
                        catch {
                            // duplicate
                        }
                    }
                }
                else {
                    unresolvedImports.push({
                        sourcePath: fileNode.path,
                        specifier,
                        reason: specifier.startsWith('.') ? 'Local file not found' : 'External package dependency',
                        location: loc,
                    });
                }
            }
        }
    }
    static hasExportModifier(node) {
        if (node.modifiers) {
            return node.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
        }
        return false;
    }
    static getSourceLocation(node, sf) {
        const start = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        const end = sf.getLineAndCharacterOfPosition(node.getEnd());
        return {
            startLine: start.line + 1,
            startColumn: start.character + 1,
            endLine: end.line + 1,
            endColumn: end.character + 1,
        };
    }
    static isTestFilePath(normPath) {
        const p = normPath.toLowerCase();
        return p.startsWith('tests/') || p.includes('.test.') || p.includes('_test.');
    }
}
