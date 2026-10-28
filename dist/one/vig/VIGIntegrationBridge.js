/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/VIGIntegrationBridge
 * Specification: VIG Phase 8 Native Integration
 *
 * Explicit bridge interfaces and adapters connecting VIG with ONE Language
 * lexer/parser, AST/IR, and VM/runtime execution layers.
 */
import * as crypto from 'crypto';
import * as path from 'path';
import { VIGSecurityError, } from './types';
import { VIGCanonicalizer } from './VIGCanonicalizer';
import { VIGModel } from './VIGModel';
import { OneLexer } from '../oneLexer';
import { GrammarRouter } from '../router/GrammarRouter';
// ── 2. Parser & AST Bridge Implementation ───────────────────────────────────
export class VIGParserBridge {
    /**
     * Tokenizes ONE language source, routes grammar, and extracts VIG nodes and edges.
     */
    extractNodesFromOneSource(source, filePath) {
        const normContent = VIGCanonicalizer.normalizeLineEndings(source);
        const contentHash = crypto.createHash('sha256').update(normContent, 'utf8').digest('hex');
        let ast;
        try {
            const lexer = new OneLexer(normContent);
            const tokens = lexer.tokenize();
            const parseResult = GrammarRouter.parse(tokens);
            ast = parseResult.ast;
        }
        catch {
            // Syntax or lexing error tolerance: produce fallback file node
            const fileNode = VIGModel.createNode({
                kind: 'SOURCE_FILE',
                path: filePath,
                name: path.basename(filePath),
                contentHash,
                isExported: true,
            });
            return { nodes: [fileNode], edges: [] };
        }
        const astBridge = new VIGASTBridge();
        return astBridge.mapProgramASTToVIG(ast, filePath, contentHash);
    }
}
export class VIGASTBridge {
    /**
     * Maps a UnifiedProgramNode AST into content-addressed VIG nodes and directed edges.
     */
    mapProgramASTToVIG(ast, filePath, contentHash) {
        const normPath = VIGCanonicalizer.normalizePath(filePath);
        const nodes = [];
        const edges = [];
        // 1. Root File Node
        const fileNode = VIGModel.createNode({
            kind: 'SOURCE_FILE',
            path: normPath,
            name: path.basename(normPath),
            contentHash,
            isExported: true,
            metadata: {
                statementCount: ast.body.length,
            },
        });
        nodes.push(fileNode);
        // 2. Iterate statements to extract declarations & imports
        for (const stmt of ast.body) {
            if (stmt.kind === 'FunctionDeclaration') {
                const fnStmt = stmt;
                const fnPayload = `${fnStmt.name}:${fnStmt.params.map((p) => `${p.name}:${p.typeAnnotation ?? 'any'}`).join(',')}`;
                const fnHash = crypto.createHash('sha256').update(fnPayload, 'utf8').digest('hex');
                const fnNode = VIGModel.createNode({
                    kind: 'AST_DECLARATION',
                    path: normPath,
                    name: fnStmt.name,
                    contentHash: fnHash,
                    isExported: true,
                    metadata: {
                        declarationKind: 'function',
                        paramCount: fnStmt.params.length,
                        returnType: fnStmt.returnTypeAnnotation ?? 'any',
                    },
                });
                nodes.push(fnNode);
                // Directed Edge: File DEFINES_SYMBOL Function
                const definesEdge = VIGModel.createEdge({
                    sourceCid: fileNode.cid,
                    targetCid: fnNode.cid,
                    relation: 'DEFINES_SYMBOL',
                    isPublicApi: true,
                });
                edges.push(definesEdge);
            }
            else if (stmt.kind === 'ImportStatement') {
                const importStmt = stmt;
                const targetModulePath = importStmt.moduleName.endsWith('.one')
                    ? importStmt.moduleName
                    : `${importStmt.moduleName}.one`;
                const targetNorm = VIGCanonicalizer.normalizePath(targetModulePath);
                const placeholderHash = crypto
                    .createHash('sha256')
                    .update(`UNRESOLVED_IMPORT:${targetNorm}`, 'utf8')
                    .digest('hex');
                // Create target module placeholder node
                const targetNode = VIGModel.createNode({
                    kind: 'MODULE',
                    path: targetNorm,
                    name: importStmt.moduleName,
                    contentHash: placeholderHash,
                    isExported: true,
                    metadata: { isExternal: true },
                });
                nodes.push(targetNode);
                // Directed Edge: File IMPORTS TargetModule
                const importEdge = VIGModel.createEdge({
                    sourceCid: fileNode.cid,
                    targetCid: targetNode.cid,
                    relation: 'IMPORTS',
                    isPublicApi: true,
                    metadata: { alias: importStmt.alias },
                });
                edges.push(importEdge);
            }
        }
        return {
            nodes: Object.freeze(nodes),
            edges: Object.freeze(edges),
        };
    }
}
// ── 3. IR Bridge Implementation ─────────────────────────────────────────────
export class VIGIRBridge {
    /**
     * Computes a deterministic SHA-256 hash over lowered UnifiedIRProgram instructions.
     */
    computeIRHash(ir) {
        const fragments = [];
        for (const inst of ir.instructions) {
            const destStr = inst.destination ? `${inst.destination.kind}:${String(inst.destination.value)}` : '_';
            const srcStr = inst.sources.map((s) => `${s.kind}:${String(s.value)}`).join(',');
            fragments.push(`${inst.index}:${inst.opcode}:${destStr}:${srcStr}`);
        }
        const payload = `${ir.version}|${fragments.join(';')}`;
        return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
    }
    /**
     * Maps a UnifiedIRProgram into a VIG Node bound to its source file CID.
     */
    createIRNode(ir, sourceCid, filePath) {
        const irHash = this.computeIRHash(ir);
        const normPath = VIGCanonicalizer.normalizePath(filePath);
        return VIGModel.createNode({
            kind: 'MODULE',
            path: normPath,
            name: `${path.basename(normPath)}.ir`,
            contentHash: irHash,
            isExported: false,
            metadata: {
                instructionCount: ir.instructions.length,
                irVersion: ir.version,
                boundSourceCid: sourceCid,
            },
        });
    }
}
// ── 4. Runtime Execution Gate Bridge Implementation ─────────────────────────
export class VIGRuntimeBridge {
    /**
     * Evaluates verification preconditions before VM / JIT execution.
     * Fail-Closed Policy:
     * - Strict mode: blocks execution unless status is VERIFIED_PASS.
     * - Standard mode: allows baseline VM execution, returning non-blocking warnings.
     */
    async evaluateExecutionGate(sourcePath, vig, options = {}) {
        const strict = options.strictVerification ?? false;
        const warnings = [];
        // Fallback if VIG is disabled or unavailable
        if (!vig) {
            if (strict) {
                throw new VIGSecurityError(`Runtime execution blocked fail-closed: VIG verification is unavailable in strict mode for "${sourcePath}"`);
            }
            return Object.freeze({
                isAllowed: true,
                status: 'UNVERIFIED',
                sourcePath,
                boundCommitSha: '0000000000000000000000000000000000000000',
                reason: 'VIG service is not initialized; standard unverified execution permitted.',
                warnings: ['VIG verification unavailable'],
            });
        }
        // Query verified context from VIG
        const context = await vig.getVerifiedContext({ targetPath: sourcePath });
        const status = context.verificationStatus;
        if (status === 'VERIFIED_PASS') {
            return Object.freeze({
                isAllowed: true,
                status: 'VERIFIED_PASS',
                sourcePath,
                boundCommitSha: context.boundCommitSha,
                reason: 'Code snapshot and verification evidence are fresh and verified.',
                warnings: [],
            });
        }
        if (strict) {
            throw new VIGSecurityError(`Runtime execution blocked fail-closed: source "${sourcePath}" has verification status "${status}" (commit ${context.boundCommitSha.substring(0, 8)}).`);
        }
        if (status === 'STALE') {
            warnings.push(`Source or commit identity changed since last verification run.`);
        }
        else if (status === 'FAILED') {
            warnings.push(`One or more tests or typechecks failed on this snapshot.`);
        }
        else {
            warnings.push(`No verification evidence is on record for this source.`);
        }
        return Object.freeze({
            isAllowed: true,
            status,
            sourcePath,
            boundCommitSha: context.boundCommitSha,
            reason: `Verification status is "${status}". Allowed under standard execution mode.`,
            warnings,
        });
    }
}
