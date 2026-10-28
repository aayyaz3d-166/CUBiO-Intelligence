/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Module: @one/vig/VIGSourceQueryEngine
 * Specification: VIG Phase 8 Native Integration
 *
 * Provides high-level change-impact queries and verification evidence
 * correlation for compiler tools, LSP, and developer workflows.
 */
import { VIGCanonicalizer } from './VIGCanonicalizer';
export class VIGSourceQueryEngine {
    /**
     * Evaluates the downstream transitive impact of modifying a specific source file.
     */
    static async querySourceImpact(sourcePath, vig, context) {
        const startTime = performance.now();
        const normPath = VIGCanonicalizer.normalizePath(sourcePath, vig.repoRoot);
        const impact = await vig.queryImpact({
            changedPaths: [normPath],
            includeTests: true,
        }, context);
        const affectedDownstreamPaths = impact.affectedModules.map((m) => m.path);
        return Object.freeze({
            sourcePath: normPath,
            isPublicApiBreached: impact.isPublicApiBreached,
            affectedDownstreamPaths,
            affectedDownstreamNodes: impact.affectedModules,
            requiredTestSuites: impact.requiredTestSuites,
            analysisDurationMs: performance.now() - startTime,
        });
    }
    /**
     * Queries verification status and connects historical evidence to a target module.
     */
    static async queryModuleVerification(modulePath, vig, context) {
        const normPath = VIGCanonicalizer.normalizePath(modulePath, vig.repoRoot);
        const verifiedContext = await vig.getVerifiedContext({ targetPath: normPath }, context);
        const anchor = await vig.getGraphAnchor(context);
        const associatedTestSuites = verifiedContext.lastEvidence?.testSuites.map((s) => s.suitePath) ?? [];
        return Object.freeze({
            modulePath: normPath,
            status: verifiedContext.verificationStatus,
            boundCommitSha: anchor.commitSha,
            isWorkingTreeClean: anchor.isClean,
            verifiedAt: verifiedContext.lastEvidence?.evaluatedAt,
            lastEvidenceId: verifiedContext.lastEvidence?.evidenceId,
            associatedTestSuites,
        });
    }
}
