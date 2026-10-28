export class SpatialRingBuffer {
    sharedBuffer;
    headerView;
    dataView;
    bufferMb;
    constructor(bufferMb, rssGuard) {
        this.bufferMb = bufferMb;
        const capacityBytes = bufferMb * 1024 * 1024;
        // Allocate physical memory under strict RSS Guard
        rssGuard.allocate(capacityBytes, `RingBuffer:${bufferMb}MB`);
        // Shared Array Buffer for Zero-Copy Thread Execution
        this.sharedBuffer = new SharedArrayBuffer(capacityBytes + 16);
        this.headerView = new Int32Array(this.sharedBuffer, 0, 4);
        this.dataView = new Uint8Array(this.sharedBuffer, 16, capacityBytes);
        // Initialize Header: [0: writeOffset, 1: readOffset, 2: capacityBytes, 3: droppedPackets]
        Atomics.store(this.headerView, 0, 0);
        Atomics.store(this.headerView, 1, 0);
        Atomics.store(this.headerView, 2, capacityBytes);
        Atomics.store(this.headerView, 3, 0);
    }
    /**
     * Creates a first-class zero-copy slice view directly over the underlying SharedArrayBuffer.
     */
    createMemoryView(byteOffset = 0, byteLength) {
        const capacity = Atomics.load(this.headerView, 2);
        const length = byteLength !== undefined ? Math.min(byteLength, capacity - byteOffset) : capacity - byteOffset;
        return new Uint8Array(this.sharedBuffer, 16 + byteOffset, length);
    }
    getSharedBuffer() {
        return this.sharedBuffer;
    }
    /**
     * Deterministic Write with Backpressure Signaling
     */
    writeChunk(chunk) {
        const capacity = Atomics.load(this.headerView, 2);
        const writePos = Atomics.load(this.headerView, 0);
        const readPos = Atomics.load(this.headerView, 1);
        const availableSpace = (readPos <= writePos)
            ? capacity - (writePos - readPos)
            : readPos - writePos;
        if (chunk.length > availableSpace) {
            // Backpressure Triggered: Buffer Full
            Atomics.add(this.headerView, 3, 1);
            return false;
        }
        // Zero-copy chunk write
        for (let i = 0; i < chunk.length; i++) {
            this.dataView[(writePos + i) % capacity] = chunk[i];
        }
        Atomics.store(this.headerView, 0, (writePos + chunk.length) % capacity);
        return true;
    }
    /**
     * Deterministic Read Operation
     */
    readChunk(dest) {
        const capacity = Atomics.load(this.headerView, 2);
        const writePos = Atomics.load(this.headerView, 0);
        const readPos = Atomics.load(this.headerView, 1);
        if (readPos === writePos)
            return 0; // Empty Buffer
        const availableData = (writePos >= readPos)
            ? writePos - readPos
            : capacity - readPos + writePos;
        const readSize = Math.min(dest.length, availableData);
        for (let i = 0; i < readSize; i++) {
            dest[i] = this.dataView[(readPos + i) % capacity];
        }
        Atomics.store(this.headerView, 1, (readPos + readSize) % capacity);
        return readSize;
    }
}
