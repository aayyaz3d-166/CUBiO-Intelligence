/**
 * ONE Language — Information Recoverability Tester
 * =================================================
 * Module: @one/memory/extreme/InformationRecoverabilityTester
 *
 * Implements Section 15 of Extreme-Scale 3D Memory Toolchain.
 * CRITICAL SCIENTIFIC AUDIT COMPONENT.
 *
 * Formally validates whether encoded/virtualized memory representations can be
 * reconstructed bit-for-bit, byte-for-byte into their original form.
 *
 * SCIENTIFIC MANDATE:
 *   If exact reconstruction is impossible, FAILS the lossless claim.
 *   Proves that high-entropy random data cannot be compressed losslessly
 *   into a sub-entropy representation.
 */
import * as crypto from 'crypto';
export class InformationRecoverabilityTester {
    /**
     * Tests bit-exact recoverability between original data and a reconstruction pipeline.
     */
    static testRecoverability(datasetName, originalData, reconstructedData) {
        const origLen = originalData.length;
        const reconLen = reconstructedData.length;
        const origSha = crypto.createHash('sha256').update(originalData).digest('hex');
        const reconSha = crypto.createHash('sha256').update(reconstructedData).digest('hex');
        const entropy = this.calculateEntropy(originalData);
        let mismatchedBytes = 0;
        const minLen = Math.min(origLen, reconLen);
        for (let i = 0; i < minLen; i++) {
            if (originalData[i] !== reconstructedData[i]) {
                mismatchedBytes++;
            }
        }
        const missingBytes = Math.abs(origLen - reconLen);
        const totalCorrupted = mismatchedBytes + missingBytes;
        const lossPct = origLen > 0 ? (totalCorrupted / origLen) * 100.0 : 0.0;
        const isBitExact = origSha === reconSha && origLen === reconLen;
        const isByteExact = isBitExact;
        let claimStatus = 'PASS';
        let failureReason = undefined;
        if (!isBitExact) {
            claimStatus = 'FAIL';
            failureReason = `Reconstruction failed SHA-256 match. Original: ${origSha.substring(0, 12)}..., Reconstructed: ${reconSha.substring(0, 12)}... (Loss: ${lossPct.toFixed(2)}%)`;
        }
        return {
            datasetName,
            originalBytesLength: origLen,
            reconstructedBytesLength: reconLen,
            isBitExactMatch: isBitExact,
            isByteExactMatch: isByteExact,
            lossPercentage: lossPct,
            missingBytesCount: missingBytes,
            originalSha256: origSha,
            reconstructedSha256: reconSha,
            entropyBitsPerByte: entropy,
            losslessClaimStatus: claimStatus,
            failureReason,
        };
    }
    /**
     * Evaluates Shannon entropy.
     */
    static calculateEntropy(data) {
        if (data.length === 0)
            return 0.0;
        const counts = new Uint32Array(256);
        for (let i = 0; i < data.length; i++)
            counts[data[i]]++;
        let ent = 0.0;
        const len = data.length;
        for (let b = 0; b < 256; b++) {
            if (counts[b] > 0) {
                const p = counts[b] / len;
                ent -= p * Math.log2(p);
            }
        }
        return ent;
    }
    /**
     * Generates synthetic datasets for negative and positive control testing.
     */
    static generateTestPayload(type, sizeBytes = 4096) {
        const buf = new Uint8Array(sizeBytes);
        switch (type) {
            case 'STRUCTURED_LOW_ENTROPY':
                // Repetitive 369 harmonic pattern
                for (let i = 0; i < sizeBytes; i++) {
                    buf[i] = (i % 3 === 0) ? 3 : (i % 6 === 0) ? 6 : 9;
                }
                break;
            case 'HIGH_ENTROPY_RANDOM':
            case 'WHITE_NOISE':
                crypto.randomFillSync(buf);
                break;
            case 'ADVERSARIAL_COLLISION':
                // Near-identical buffers with 1 bit difference
                buf.fill(0xaa);
                buf[sizeBytes - 1] = 0xab;
                break;
        }
        return buf;
    }
}
