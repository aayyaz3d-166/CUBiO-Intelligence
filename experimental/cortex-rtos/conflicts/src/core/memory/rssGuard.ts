export class RSSGuard {
  private readonly maxLimitBytes: number;
  private currentAllocatedBytes: number = 0;

  constructor(maxLimitMb: number = 512) {
    this.maxLimitBytes = maxLimitMb * 1024 * 1024;
  }

  public allocate(bytes: number, label: string = 'Buffer'): void {
    if (this.currentAllocatedBytes + bytes > this.maxLimitBytes) {
      const requestedMb = ((this.currentAllocatedBytes + bytes) / (1024 * 1024)).toFixed(2);
      const capMb = (this.maxLimitBytes / (1024 * 1024)).toFixed(2);
      throw new Error(
        `[RSS Hardware Panic] Memory allocation request for '${label}' (${bytes} bytes) exceeds maximum limit (${requestedMb} MB > ${capMb} MB)`
      );
    }
    this.currentAllocatedBytes += bytes;
  }

  public free(bytes: number): void {
    this.currentAllocatedBytes = Math.max(0, this.currentAllocatedBytes - bytes);
  }

  public getUsedBytes(): number {
    return this.currentAllocatedBytes;
  }

  public getUsedMb(): number {
    return this.currentAllocatedBytes / (1024 * 1024);
  }

  public getAllocatedMB(): number {
    return this.getUsedMb();
  }

  /** Topology-aware: enforce per-node RSS caps within the mesh. */
  public checkNodeAllocation(nodeId: string, requestedBytes: number, maxPerNodeMb: number = 64): void {
    const maxBytes = maxPerNodeMb * 1024 * 1024;
    if (requestedBytes > maxBytes) {
      throw new Error(
        `[RSS Mesh Violation] Node '${nodeId}' allocation (${requestedBytes} bytes) exceeds per-node cap (${maxPerNodeMb} MB)`
      );
    }
    this.allocate(requestedBytes, `Node:${nodeId}`);
  }

  /** Topology-aware: enforce per-funnel stream caps. */
  public checkFunnelAllocation(funnelId: string, requestedBytes: number, maxPerFunnelMb: number = 256): void {
    const maxBytes = maxPerFunnelMb * 1024 * 1024;
    if (requestedBytes > maxBytes) {
      throw new Error(
        `[RSS Mesh Violation] Funnel '${funnelId}' allocation (${requestedBytes} bytes) exceeds per-funnel cap (${maxPerFunnelMb} MB)`
      );
    }
    this.allocate(requestedBytes, `Funnel:${funnelId}`);
  }

  /** Allocate with mesh-aware label tracking. */
  public allocateMesh(bytes: number, category: 'node' | 'funnel' | 'stream', id: string): void {
    this.allocate(bytes, `[${category.toUpperCase()}]:${id}`);
  }
}
