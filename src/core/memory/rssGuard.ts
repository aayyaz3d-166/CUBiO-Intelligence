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
}
