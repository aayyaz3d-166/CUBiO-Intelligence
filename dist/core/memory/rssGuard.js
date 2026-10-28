export class RSSGuard {
    maxLimitBytes;
    currentAllocatedBytes = 0;
    constructor(maxLimitMb = 512) {
        this.maxLimitBytes = maxLimitMb * 1024 * 1024;
    }
    allocate(bytes, label = 'Buffer') {
        if (this.currentAllocatedBytes + bytes > this.maxLimitBytes) {
            const requestedMb = ((this.currentAllocatedBytes + bytes) / (1024 * 1024)).toFixed(2);
            const capMb = (this.maxLimitBytes / (1024 * 1024)).toFixed(2);
            throw new Error(`[RSS Hardware Panic] Memory allocation request for '${label}' (${bytes} bytes) exceeds maximum limit (${requestedMb} MB > ${capMb} MB)`);
        }
        this.currentAllocatedBytes += bytes;
    }
    free(bytes) {
        this.currentAllocatedBytes = Math.max(0, this.currentAllocatedBytes - bytes);
    }
    getUsedBytes() {
        return this.currentAllocatedBytes;
    }
    getUsedMb() {
        return this.currentAllocatedBytes / (1024 * 1024);
    }
    getAllocatedMB() {
        return this.getUsedMb();
    }
}
