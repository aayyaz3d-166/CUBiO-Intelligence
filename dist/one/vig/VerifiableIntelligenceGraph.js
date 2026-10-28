/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/VerifiableIntelligenceGraph
 * Specification: VIG Phase 1 Design & Phase 6 Security Hardening
 *
 * Sovereign, read-only public API service facade, strict runtime RBAC,
 * path traversal protection, single-writer / multiple-reader concurrency,
 * and fail-closed crash recovery.
 */
import * as fs from 'fs';
import * as path from 'path';
import { VIGValidationError, } from './types';
import { VIGCanonicalizer } from './VIGCanonicalizer';
import { VIGGraphStore } from './VIGGraphStore';
import { VIGImpactTracker } from './VIGImpactTracker';
import { VIGManifestManager } from './VIGManifestManager';
import { VIGProvenanceLedger } from './VIGProvenanceLedger';
import { VIGChangeScanner } from './VIGChangeScanner';
import { VIGInvalidator } from './VIGInvalidator';
import { VIGSecurityGuard } from './VIGSecurityGuard';
import { VIGLockManager } from './VIGLockManager';
import { VIGRecoveryManager } from './VIGRecoveryManager';
export class VerifiableIntelligenceGraph {
    repoRoot;
    vigDir;
    manifestPath;
    graphPath;
    evidencePath;
    walPath;
    graphStore;
    manifest = null;
    evidenceLedger = null;
    constructor(options = {}) {
        if (typeof options.systemSecret === 'string') {
            VIGSecurityGuard.configureSystemSecret(options.systemSecret);
        }
        this.repoRoot = path.resolve(options.repoRoot ?? process.cwd());
        this.vigDir = path.resolve(options.vigDir ?? path.join(this.repoRoot, '.vig'));
        this.manifestPath = path.join(this.vigDir, 'manifest.json');
        this.graphPath = path.join(this.vigDir, 'graph.json');
        this.evidencePath = path.join(this.vigDir, 'evidence.json');
        this.walPath = path.join(this.vigDir, 'provenance.wal.json');
        this.graphStore = new VIGGraphStore();
        if (options.autoRecoverOnStartup !== false) {
            this.recoverStartupState();
        }
        this.loadStateFailClosed();
    }
    // ── State Loading & Fail-Closed Recovery ───────────────────────────────────
    /**
     * Sweeps stale temporary files and cleans dead lock records on startup.
     */
    recoverStartupState() {
        VIGRecoveryManager.performStartupRecovery(this.vigDir);
    }
    /**
     * Loads manifest, graph, and evidence from disk fail-closed.
     * If any file is corrupted, it is quarantined and rejected without trusting invalid state.
     */
    loadStateFailClosed() {
        // 1. Load manifest
        if (fs.existsSync(this.manifestPath)) {
            try {
                this.manifest = VIGManifestManager.loadManifest(this.manifestPath);
            }
            catch (err) {
                VIGRecoveryManager.quarantineCorruptFile(this.manifestPath, err.message);
                this.manifest = null;
            }
        }
        // 2. Load graph store
        if (fs.existsSync(this.graphPath)) {
            try {
                const raw = fs.readFileSync(this.graphPath, 'utf8');
                const restored = VIGGraphStore.deserialize(raw);
                this.graphStore.clear();
                for (const node of restored.getAllNodes()) {
                    this.graphStore.addNode(node);
                }
                for (const edge of restored.getAllEdges()) {
                    this.graphStore.addEdge(edge);
                }
            }
            catch (err) {
                VIGRecoveryManager.quarantineCorruptFile(this.graphPath, err.message);
                this.graphStore.clear();
            }
        }
        // 3. Load evidence ledger
        if (fs.existsSync(this.evidencePath)) {
            try {
                this.evidenceLedger = VIGProvenanceLedger.loadEvidenceLedger(this.evidencePath);
            }
            catch (err) {
                VIGRecoveryManager.quarantineCorruptFile(this.evidencePath, err.message);
                this.evidenceLedger = null;
            }
        }
    }
    // ── Public Accessors ────────────────────────────────────────────────────────
    get store() {
        return this.graphStore;
    }
    get currentManifest() {
        return this.manifest;
    }
    get currentEvidenceLedger() {
        return this.evidenceLedger;
    }
    // ── 1. Read-Only API: queryImpact ──────────────────────────────────────────
    /**
     * Evaluates the downstream impact of code changes.
     * Accessible by SYSTEM_CORE, ANALYZER_AGENT, and EXTERNAL_SKILL.
     */
    async queryImpact(request, context) {
        const startTime = Date.now();
        // 1. Security Authorization & Actuation Lockout
        if (context) {
            VIGSecurityGuard.assertCanRead(context, 'queryImpact');
        }
        VIGSecurityGuard.assertNoActuation(request, 'queryImpact');
        if (!request || !Array.isArray(request.changedPaths)) {
            throw new VIGValidationError('queryImpact requires a valid "changedPaths" array');
        }
        // 2. Path Traversal & Containment Checks
        const validatedPaths = [];
        for (const rawPath of request.changedPaths) {
            const safePath = VIGSecurityGuard.assertSafeRepositoryPath(rawPath, this.repoRoot);
            validatedPaths.push(safePath);
        }
        // 3. Multiple-Reader Telemetry Tracking
        const exitRead = VIGLockManager.enterRead();
        try {
            // Find all nodes corresponding to changed paths
            const rootCids = [];
            const changedNodes = [];
            for (const p of validatedPaths) {
                const nodes = this.graphStore.getNodesByPath(p);
                for (const n of nodes) {
                    rootCids.push(n.cid);
                    changedNodes.push(n);
                }
            }
            if (rootCids.length === 0) {
                return Object.freeze({
                    isNoOp: true,
                    changedNodes: [],
                    affectedModules: [],
                    requiredTestSuites: [],
                    isPublicApiBreached: false,
                    analysisLatencyMs: Date.now() - startTime,
                });
            }
            // Compute impact via VIGImpactTracker static method
            const impactReport = VIGImpactTracker.computeDownstreamImpact(rootCids, this.graphStore, {
                maxDepth: request.maxDepth ?? 50,
                includeTests: request.includeTests ?? true,
            });
            const affectedModules = impactReport.affectedNodes.filter((n) => n.kind === 'SOURCE_FILE' || n.kind === 'MODULE');
            const requiredTestSuites = impactReport.requiredTestSuites.map((t) => t.path);
            return Object.freeze({
                isNoOp: impactReport.affectedNodes.length === 0,
                changedNodes,
                affectedModules,
                requiredTestSuites,
                isPublicApiBreached: impactReport.isPublicApiBreached,
                analysisLatencyMs: Date.now() - startTime,
            });
        }
        finally {
            exitRead();
        }
    }
    // ── 2. Read-Only API: getVerifiedContext ────────────────────────────────────
    /**
     * Retrieves verified code context, dependencies, dependents, and evidence.
     * Accessible by SYSTEM_CORE, ANALYZER_AGENT, and EXTERNAL_SKILL.
     */
    async getVerifiedContext(request, context) {
        // 1. Security Authorization & Actuation Lockout
        if (context) {
            VIGSecurityGuard.assertCanRead(context, 'getVerifiedContext');
        }
        VIGSecurityGuard.assertNoActuation(request, 'getVerifiedContext');
        if (!request.targetPath && !request.symbolName) {
            throw new VIGValidationError('getVerifiedContext requires either "targetPath" or "symbolName"');
        }
        if (request.targetPath) {
            VIGSecurityGuard.assertSafeRepositoryPath(request.targetPath, this.repoRoot);
        }
        // 2. Multiple-Reader Telemetry Tracking
        const exitRead = VIGLockManager.enterRead();
        try {
            // Find target node
            let targetNode = null;
            if (request.targetPath) {
                const norm = VIGCanonicalizer.normalizePath(request.targetPath, this.repoRoot);
                const nodes = this.graphStore.getNodesByPath(norm);
                if (request.symbolName) {
                    targetNode = nodes.find((n) => n.name === request.symbolName) ?? null;
                }
                else {
                    targetNode = nodes.find((n) => n.kind === 'SOURCE_FILE') ?? nodes[0] ?? null;
                }
            }
            else if (request.symbolName) {
                targetNode =
                    this.graphStore.getAllNodes().find((n) => n.name === request.symbolName) ?? null;
            }
            // Dependencies and dependents
            const dependencies = [];
            const dependents = [];
            if (targetNode) {
                const outgoingEdges = this.graphStore.getOutgoingEdges(targetNode.cid);
                for (const edge of outgoingEdges) {
                    const dep = this.graphStore.getNode(edge.targetCid);
                    if (dep)
                        dependencies.push(dep);
                }
                const incomingEdges = this.graphStore.getIncomingEdges(targetNode.cid);
                for (const edge of incomingEdges) {
                    const dep = this.graphStore.getNode(edge.sourceCid);
                    if (dep)
                        dependents.push(dep);
                }
            }
            // Git anchor
            let boundCommitSha = '0000000000000000000000000000000000000000';
            let isWorkingTreeClean = false;
            try {
                const anchor = VIGProvenanceLedger.resolveGitCommitAnchor(this.repoRoot);
                boundCommitSha = anchor.commitSha;
                isWorkingTreeClean = anchor.isWorkingTreeClean;
            }
            catch {
                // Fallback if git is not accessible in current environment
            }
            // Latest evidence & verification status
            const lastEvidence = VIGProvenanceLedger.getLatestEvidenceRecord(this.evidenceLedger);
            const graphRootSeal = this.graphStore.computeRootSeal();
            const verificationStatus = VIGProvenanceLedger.evaluateVerificationStatus(lastEvidence, boundCommitSha, graphRootSeal, isWorkingTreeClean);
            return Object.freeze({
                node: targetNode,
                dependencies,
                dependents,
                boundCommitSha,
                verificationStatus,
                lastEvidence,
            });
        }
        finally {
            exitRead();
        }
    }
    // ── 3. Read-Only API: getGraphAnchor ────────────────────────────────────────
    /**
     * Retrieves the current graph Merkle root seal and Git commit anchor.
     * Accessible by SYSTEM_CORE, ANALYZER_AGENT, and EXTERNAL_SKILL.
     */
    async getGraphAnchor(context) {
        if (context) {
            VIGSecurityGuard.assertCanRead(context, 'getGraphAnchor');
        }
        const exitRead = VIGLockManager.enterRead();
        try {
            let commitSha = '0000000000000000000000000000000000000000';
            let baselineTag = 'v0.1.0-baseline';
            let isClean = false;
            try {
                const anchor = VIGProvenanceLedger.resolveGitCommitAnchor(this.repoRoot);
                commitSha = anchor.commitSha;
                baselineTag = anchor.baselineTag;
                isClean = anchor.isWorkingTreeClean;
            }
            catch { }
            return Object.freeze({
                rootCID: this.graphStore.computeRootSeal(),
                commitSha,
                baselineTag,
                isClean,
                totalNodes: this.graphStore.nodeCount,
                totalEdges: this.graphStore.edgeCount,
            });
        }
        finally {
            exitRead();
        }
    }
    // ── 4. Mutation API: updateIndex ───────────────────────────────────────────
    /**
     * Scans repository changes, invalidates affected graph segments, and persists manifest.
     * Strictly restricted to SYSTEM_CORE. Unauthorized roles cause VIGAccessDeniedError
     * and ZERO state mutation.
     */
    async updateIndex(context, options = {}) {
        // 1. Strict Runtime RBAC Enforcement & Actuation Lockout
        VIGSecurityGuard.assertCanMutate(context, 'updateIndex');
        VIGSecurityGuard.assertNoActuation(options, 'updateIndex');
        // 2. Exclusive Single-Writer Lock Acquisition
        return await VIGLockManager.executeWithWriteLock(this.vigDir, context.agentId, async () => {
            // Run change scan
            const scanResult = VIGChangeScanner.scanRepository(this.repoRoot, this.manifest, {
                forceFullHash: options.forceFullHash,
            });
            if (scanResult.isNoOp && !options.force) {
                return Object.freeze({
                    isNoOp: true,
                    invalidatedCids: [],
                    reindexedFiles: [],
                    removedCids: [],
                    affectedDownstreamNodes: [],
                    requiredTestSuites: [],
                    isPublicApiBreached: false,
                    manifestUpdated: false,
                    durationMs: scanResult.instrumentation.scanDurationMs,
                });
            }
            // Apply invalidation and re-indexing
            const fileReader = (filePath) => {
                try {
                    return fs.readFileSync(path.resolve(this.repoRoot, filePath), 'utf8');
                }
                catch {
                    return undefined;
                }
            };
            const { result, updatedManifest } = VIGInvalidator.invalidateAndReindex(scanResult, this.graphStore, fileReader, this.manifest);
            // Persist updated manifest atomically
            VIGManifestManager.saveManifest(updatedManifest, this.manifestPath);
            this.manifest = updatedManifest;
            // Save graph atomically
            this.saveGraphInternal();
            return result;
        });
    }
    // ── 5. Mutation API: recordEvidence ────────────────────────────────────────
    /**
     * Records test and typecheck verification evidence in the durable Merkle ledger and WAL.
     * Strictly restricted to SYSTEM_CORE. Unauthorized roles cause VIGAccessDeniedError
     * and ZERO state mutation.
     */
    async recordEvidence(context, evidence) {
        // 1. Strict Runtime RBAC Enforcement & Actuation Lockout
        VIGSecurityGuard.assertCanMutate(context, 'recordEvidence');
        VIGSecurityGuard.assertNoActuation(evidence, 'recordEvidence');
        // 2. Exclusive Single-Writer Lock Acquisition
        return await VIGLockManager.executeWithWriteLock(this.vigDir, context.agentId, async () => {
            let currentClean = false;
            try {
                const anchor = VIGProvenanceLedger.resolveGitCommitAnchor(this.repoRoot);
                currentClean = anchor.isWorkingTreeClean;
            }
            catch { }
            const evidenceRecord = VIGProvenanceLedger.createEvidenceRecord({
                commitSha: evidence.commitSha,
                graphRootSeal: evidence.graphRootSeal || this.graphStore.computeRootSeal(),
                isWorkingTreeClean: evidence.isWorkingTreeClean !== undefined ? evidence.isWorkingTreeClean : currentClean,
                typecheckPassed: evidence.typecheckPassed,
                typecheckErrorCount: evidence.typecheckErrorCount,
                testSuites: evidence.testSuites,
                provenanceSeal: evidence.provenanceSeal,
                evaluatedAt: evidence.evaluatedAt,
                overallPassed: evidence.overallPassed,
            });
            // Append to WAL
            VIGProvenanceLedger.appendEvidenceToWAL(evidenceRecord, this.walPath);
            // Append to sealed evidence ledger
            const currentRecords = this.evidenceLedger?.evidenceRecords
                ? [...this.evidenceLedger.evidenceRecords]
                : [];
            const updatedRecords = [
                evidenceRecord,
                ...currentRecords.filter((r) => r.evidenceId !== evidenceRecord.evidenceId),
            ];
            this.evidenceLedger = VIGProvenanceLedger.createLedger(updatedRecords);
            VIGProvenanceLedger.saveEvidenceLedger(this.evidenceLedger, this.evidencePath);
            return evidenceRecord;
        });
    }
    // ── Internal Atomic Storage Helpers ────────────────────────────────────────
    /**
     * Atomically persists the serialized graph using Windows-compatible replacement.
     */
    saveGraphInternal() {
        if (!fs.existsSync(this.vigDir)) {
            fs.mkdirSync(this.vigDir, { recursive: true });
        }
        const tempPath = path.join(this.vigDir, `graph.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).substring(2, 8)}`);
        const serialized = this.graphStore.serializeToString(true);
        fs.writeFileSync(tempPath, serialized, 'utf8');
        VIGManifestManager.atomicReplaceFileSync(tempPath, this.graphPath);
    }
}
