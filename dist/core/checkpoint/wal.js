export class WriteAheadLog {
    logStream = [];
    sequenceCounter = 0;
    /**
     * Computes a deterministic bit-exact 32-bit FNV-1a hash of arbitrary state data.
     */
    computeStateHash(data) {
        const jsonStr = JSON.stringify(data);
        let hash = 0x811c9dc5;
        for (let i = 0; i < jsonStr.length; i++) {
            hash ^= jsonStr.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    }
    append(nodeId, operation, stateData) {
        this.sequenceCounter++;
        const payloadHash = this.computeStateHash(stateData);
        const record = {
            sequenceId: this.sequenceCounter,
            nodeId,
            operation,
            payloadHash,
            timestamp: 369 * this.sequenceCounter, // Deterministic synthetic clock step (σ² = 0.0)
            stateData: JSON.parse(JSON.stringify(stateData)),
        };
        this.logStream.push(record);
        return record;
    }
    getLogStream() {
        return this.logStream;
    }
    getSequenceCount() {
        return this.sequenceCounter;
    }
    clear() {
        this.logStream = [];
        this.sequenceCounter = 0;
    }
}
