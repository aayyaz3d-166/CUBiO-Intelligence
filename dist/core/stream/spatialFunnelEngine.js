import { SpatialRingBuffer } from './spatialRingBuffer';
export class SpatialFunnelEngine {
    funnels = new Map();
    rssGuard;
    constructor(rssGuard) {
        this.rssGuard = rssGuard;
    }
    createFunnel(config) {
        const pipeId = `${config.sourceNodeId}->${config.targetNodeId}`;
        // Ensure harmonic 369 alignment for chunk sizes
        if (config.harmonicChunkSizeKB % 3 !== 0) {
            throw new Error(`[Stream Error] Chunk size ${config.harmonicChunkSizeKB}KB must be 369 harmonic aligned.`);
        }
        const ringBuffer = new SpatialRingBuffer(config.bufferMb, this.rssGuard);
        this.funnels.set(pipeId, ringBuffer);
        return pipeId;
    }
    pushData(pipeId, data) {
        const funnel = this.funnels.get(pipeId);
        if (!funnel)
            throw new Error(`[Stream Error] Funnel Pipe '${pipeId}' does not exist.`);
        return funnel.writeChunk(data);
    }
    pullData(pipeId, outBuffer) {
        const funnel = this.funnels.get(pipeId);
        if (!funnel)
            throw new Error(`[Stream Error] Funnel Pipe '${pipeId}' does not exist.`);
        return funnel.readChunk(outBuffer);
    }
}
