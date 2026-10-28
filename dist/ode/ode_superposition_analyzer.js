/**
 * ODE Mathematical Superposition Analyzer
 * Module: ONE Language Development Environment ("one-ode")
 * Gate: CNL-P38-001 (ODE Mathematical Superposition Workspace)
 *
 * Analyzes ONE Language AST structures for mathematical superposition states,
 * harmonic alignment constraints (3-6-9 MHz), and probabilistic execution vectors.
 */
export class ODESuperpositionAnalyzer {
    /**
     * Evaluates an AST for mathematical superposition execution vectors.
     */
    static analyzeProgram(ast) {
        const t0 = performance.now();
        const branches = [];
        const nodes = ast.nodes;
        const funnels = ast.funnels;
        const maxRssMb = ast.rssMaxLimitMB || 512;
        const isRssCompliant = maxRssMb <= 512;
        const funnelCount = funnels.length;
        // Calculate normalized superposition amplitudes
        const baseAmp = funnelCount > 0 ? Number((1.0 / Math.sqrt(funnelCount)).toFixed(5)) : 1.0;
        for (let f = 0; f < funnels.length; f++) {
            const funnel = funnels[f];
            // Frequency weighting based on buffer size and priority
            let freqHz = 6000000; // 6 MHz default
            if (funnel.bufferMb <= 64)
                freqHz = 3000000; // 3 MHz lightweight
            else if (funnel.bufferMb >= 128)
                freqHz = 9000000; // 9 MHz heavy stream
            branches.push({
                branchId: `BRANCH_${funnel.id}`,
                sourceNodeId: funnel.sourceNode,
                targetNodeId: funnel.targetNode,
                bufferMb: funnel.bufferMb,
                probabilityAmplitude: baseAmp,
                harmonicConstraintHz: freqHz,
                isGossip: funnel.isGossip || false,
            });
        }
        const stateCoherenceNorm = branches.length > 0
            ? Number(branches.reduce((acc, b) => acc + b.probabilityAmplitude * b.probabilityAmplitude, 0).toFixed(4))
            : 1.0;
        const dominantBranchId = branches.length > 0 ? branches[0].branchId : 'NONE';
        const t1 = performance.now();
        return {
            totalNodes: nodes.length,
            totalFunnels: funnels.length,
            maxRssMb,
            isRssCompliant,
            branches,
            stateCoherenceNorm,
            dominantBranchId,
            analysisLatencyMs: Number((t1 - t0).toFixed(4)),
        };
    }
}
