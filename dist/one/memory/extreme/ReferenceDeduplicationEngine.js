/**
 * ONE Language — Reference Deduplication Engine
 * ===============================================
 * Module: @one/memory/extreme/ReferenceDeduplicationEngine
 *
 * Implements Section 8 of Extreme-Scale 3D Memory Toolchain.
 * Enforces "STORE ONCE -> REFERENCE EVERYWHERE".
 *
 * CRITICAL SCIENTIFIC PRINCIPLE:
 *   Zero heuristic or similarity-based deduplication.
 *   Deduplication strictly requires bit-exact SHA-256 state equality
 *   and canonical equivalence.
 */
import * as crypto from 'crypto';
export class ReferenceDeduplicationEngine {
    // Store Once: stateHash -> DeduplicatedEntry
    store = new Map();
    // Reference Everywhere: referenceHandle -> stateHash
    referenceTable = new Map();
    totalRawIngestedBytes = 0;
    totalRawObjectsCount = 0;
    /**
     * Ingests an object into the deduplication store.
     * If bit-exact identical bytes already exist, creates a lightweight reference handle.
     */
    storeOrReference(referenceHandle, payload) {
        const bytes = typeof payload === 'string' ? new TextEncoder().encode(payload) : payload;
        const byteLen = bytes.length;
        this.totalRawObjectsCount++;
        this.totalRawIngestedBytes += byteLen;
        // Cryptographic state hash
        const stateHash = crypto.createHash('sha256').update(bytes).digest('hex');
        const existing = this.store.get(stateHash);
        if (existing) {
            // Bit-exact verification to prevent theoretical hash collisions
            if (this.areBuffersEqual(existing.payload, bytes)) {
                existing.referenceCount++;
                this.referenceTable.set(referenceHandle, stateHash);
                return stateHash;
            }
        }
        // New unique object
        const entry = {
            canonicalId: `canon_${stateHash.substring(0, 16)}`,
            stateHashSha256: stateHash,
            byteLength: byteLen,
            payload: new Uint8Array(bytes), // Clone to retain immutable snapshot
            referenceCount: 1,
            firstReferencedMs: Date.now(),
        };
        this.store.set(stateHash, entry);
        this.referenceTable.set(referenceHandle, stateHash);
        return stateHash;
    }
    /**
     * Resolves a reference handle to its underlying payload.
     */
    resolve(referenceHandle) {
        const hash = this.referenceTable.get(referenceHandle);
        if (!hash)
            return undefined;
        const entry = this.store.get(hash);
        return entry ? entry.payload : undefined;
    }
    /**
     * Releases a reference handle. Evicts stored entry if referenceCount drops to 0.
     */
    releaseReference(referenceHandle) {
        const hash = this.referenceTable.get(referenceHandle);
        if (!hash)
            return false;
        this.referenceTable.delete(referenceHandle);
        const entry = this.store.get(hash);
        if (entry) {
            entry.referenceCount--;
            if (entry.referenceCount <= 0) {
                this.store.delete(hash);
            }
        }
        return true;
    }
    /**
     * Generates a rigorous deduplication and compression metrics report.
     */
    getReport() {
        let dedupedBytes = 0;
        for (const entry of this.store.values()) {
            dedupedBytes += entry.byteLength;
        }
        // Overhead: ~64 bytes per reference handle in table + ~64 bytes per store entry
        const metadataBytes = this.referenceTable.size * 64 + this.store.size * 64;
        const effectiveBytes = dedupedBytes + metadataBytes;
        const savings = Math.max(0, this.totalRawIngestedBytes - effectiveBytes);
        const ratio = effectiveBytes > 0 ? this.totalRawIngestedBytes / effectiveBytes : 1.0;
        const efficiency = this.totalRawIngestedBytes > 0 ? (savings / this.totalRawIngestedBytes) * 100 : 0.0;
        return {
            totalRawObjects: this.totalRawObjectsCount,
            uniqueCanonicalObjects: this.store.size,
            rawTotalBytes: this.totalRawIngestedBytes,
            deduplicatedStorageBytes: dedupedBytes,
            metadataOverheadBytes: metadataBytes,
            effectiveStoredBytes: effectiveBytes,
            netByteSavings: savings,
            compressionRatio: ratio,
            deduplicationEfficiencyPercent: efficiency,
        };
    }
    /**
     * Bit-exact buffer comparison.
     */
    areBuffersEqual(a, b) {
        if (a.length !== b.length)
            return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i])
                return false;
        }
        return true;
    }
    getUniqueCount() {
        return this.store.size;
    }
    getReferenceCount() {
        return this.referenceTable.size;
    }
}
