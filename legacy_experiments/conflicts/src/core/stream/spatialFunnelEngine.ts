import { SpatialRingBuffer } from './spatialRingBuffer';
import { RSSGuard } from '../memory/rssGuard';

export interface StreamPipeConfig {
  sourceNodeId: string;
  targetNodeId: string;
  bufferMb: number;
  harmonicChunkSizeKB: number; // 384, 768, 1536 (369 aligned)
}

export class SpatialFunnelEngine {
  private funnels: Map<string, SpatialRingBuffer> = new Map();
  private rssGuard: RSSGuard;

  constructor(rssGuard: RSSGuard) {
    this.rssGuard = rssGuard;
  }

  public createFunnel(config: StreamPipeConfig): string {
    const pipeId = `${config.sourceNodeId}->${config.targetNodeId}`;
    
    // Ensure harmonic 369 alignment for chunk sizes
    if (config.harmonicChunkSizeKB % 3 !== 0) {
      throw new Error(`[Stream Error] Chunk size ${config.harmonicChunkSizeKB}KB must be 369 harmonic aligned.`);
    }

    const ringBuffer = new SpatialRingBuffer(config.bufferMb, this.rssGuard);
    this.funnels.set(pipeId, ringBuffer);
    
    return pipeId;
  }

  public pushData(pipeId: string, data: Uint8Array): boolean {
    const funnel = this.funnels.get(pipeId);
    if (!funnel) throw new Error(`[Stream Error] Funnel Pipe '${pipeId}' does not exist.`);
    return funnel.writeChunk(data);
  }

  public pullData(pipeId: string, outBuffer: Uint8Array): number {
    const funnel = this.funnels.get(pipeId);
    if (!funnel) throw new Error(`[Stream Error] Funnel Pipe '${pipeId}' does not exist.`);
    return funnel.readChunk(outBuffer);
  }
}
