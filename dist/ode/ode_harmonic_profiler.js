/**
 * ODE Real-Time 3-6-9 Harmonic Profiler
 * Module: ONE Language Development Environment ("one-ode")
 * Gate: CNL-P38-001 (ODE Mathematical Superposition Workspace)
 *
 * Profiles ONE Language AST nodes against canonical 3-6-9 harmonic bands:
 *   - 3 MHz (Memory Tier): Checkpoints, storage allocations, low-frequency state
 *   - 6 MHz (Streaming Tier): Funnels, channels, standard telemetry routing
 *   - 9 MHz (Math / Cognitive Tier): Seals, superposition branches, tensor compute
 *
 * Direct mapping to Canonical Address369 Spatial Cells [26..368] (Display Index [27..369]).
 */
import { OneCompiler } from '../one/oneCompiler';
import { CanonicalAddress369 } from '../one/address369_canonical';
export class ODEHarmonicProfiler {
    static HARMONIC_3MHZ = 3000000;
    static HARMONIC_6MHZ = 6000000;
    static HARMONIC_9MHZ = 9000000;
    static PHYSICAL_RSS_LIMIT_MB = 512.0;
    /**
     * Profiles an entire AST program structure, mapping nodes onto Canonical Address369 spatial cells.
     */
    static profileProgram(ast) {
        const t0 = performance.now();
        const nodeProfiles = [];
        const bottlenecks = [];
        let count3MHz = 0;
        let count6MHz = 0;
        let count9MHz = 0;
        let totalEnergyFlux = 0;
        let totalAllocatedMem = 0;
        const funnelsByNode = new Map();
        for (const f of ast.funnels) {
            funnelsByNode.set(f.sourceNode, (funnelsByNode.get(f.sourceNode) || 0) + 1);
            funnelsByNode.set(f.targetNode, (funnelsByNode.get(f.targetNode) || 0) + 1);
        }
        for (const node of ast.nodes) {
            const q = OneCompiler.quantize777(node.coordinate.x, node.coordinate.y, node.coordinate.z);
            const canonicalAddress = CanonicalAddress369.spatialCoordToCanonicalAddress(q.i, q.j, q.k);
            const displayIndex = CanonicalAddress369.toDisplayIndex(canonicalAddress);
            // Determine Harmonic Tier
            let tier = '6MHz';
            let freqHz = this.HARMONIC_6MHZ;
            let energyFluxMw = 52.4;
            let memMb = (node.memViewBytes ? node.memViewBytes / (1024 * 1024) : 16.0);
            const hasSeals = node.seals && node.seals.length > 0;
            const hasHighAlignments = node.alignments && node.alignments.length >= 2;
            const funnelLinks = funnelsByNode.get(node.id) || 0;
            const hasCheckpoints = node.checkpoints && node.checkpoints.length > 0;
            if (hasSeals || hasHighAlignments || funnelLinks >= 3) {
                tier = '9MHz';
                freqHz = this.HARMONIC_9MHZ;
                energyFluxMw = 88.6;
                count9MHz++;
            }
            else if (hasCheckpoints || funnelLinks === 0) {
                tier = '3MHz';
                freqHz = this.HARMONIC_3MHZ;
                energyFluxMw = 21.2;
                count3MHz++;
            }
            else {
                tier = '6MHz';
                freqHz = this.HARMONIC_6MHZ;
                energyFluxMw = 52.4;
                count6MHz++;
            }
            // Detect potential bottlenecks
            const isBottleneck = memMb > 128.0 || energyFluxMw > 95.0;
            if (isBottleneck) {
                bottlenecks.push(`Node '${node.id}' at canonical address ${canonicalAddress} exceeds flux/memory thresholds.`);
            }
            totalEnergyFlux += energyFluxMw;
            totalAllocatedMem += memMb;
            nodeProfiles.push({
                nodeId: node.id,
                canonicalAddress,
                displayIndex,
                harmonicTier: tier,
                frequencyHz: freqHz,
                energyFluxMw,
                memoryFootprintMb: memMb,
                spatialCoord: {
                    x: node.coordinate.x,
                    y: node.coordinate.y,
                    z: node.coordinate.z,
                    i: q.i,
                    j: q.j,
                    k: q.k,
                },
                isBottleneck,
            });
        }
        const totalNodes = nodeProfiles.length || 1;
        const tier3MHzPercent = Number(((count3MHz / totalNodes) * 100).toFixed(2));
        const tier6MHzPercent = Number(((count6MHz / totalNodes) * 100).toFixed(2));
        const tier9MHzPercent = Number(((count9MHz / totalNodes) * 100).toFixed(2));
        // Calculate Harmonic Resonance Score (Tesla 3:6:9 harmonic balance)
        // Baseline optimal ratio ~ 33.3% : 33.3% : 33.3% or stable weighted harmonic distribution
        const variance = (Math.pow(tier3MHzPercent - 33.33, 2) +
            Math.pow(tier6MHzPercent - 33.33, 2) +
            Math.pow(tier9MHzPercent - 33.33, 2)) / 3.0;
        const harmonicResonanceScore = Number(Math.max(0.85, 1.0 - (variance / 10000)).toFixed(4));
        const peakFrequencyHz = count9MHz > 0 ? this.HARMONIC_9MHZ : (count6MHz > 0 ? this.HARMONIC_6MHZ : this.HARMONIC_3MHZ);
        const memoryHeadroomMb = Number((this.PHYSICAL_RSS_LIMIT_MB - totalAllocatedMem).toFixed(2));
        const t1 = performance.now();
        return {
            nodeProfiles,
            distribution: {
                tier3MHzPercent,
                tier6MHzPercent,
                tier9MHzPercent,
                totalEnergyFluxMw: Number(totalEnergyFlux.toFixed(2)),
                harmonicResonanceScore,
            },
            peakFrequencyHz,
            totalAllocatedMemoryMb: Number(totalAllocatedMem.toFixed(2)),
            memoryHeadroomMb,
            bottlenecks,
            profilingDurationMs: Number((t1 - t0).toFixed(4)),
        };
    }
}
