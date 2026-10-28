/**
 * ONE Language — Lossless Reconstruction Engine
 * ==============================================
 * Module: @one/memory/extreme/LosslessReconstructionEngine
 *
 * Implements Section 16 of Extreme-Scale 3D Memory Toolchain.
 * Executes the complete lossless verification pipeline:
 *
 *   SOURCE -> ENCODE -> STORE -> REFERENCE -> DECODE -> RECONSTRUCT -> SHA-256 COMPARE
 *
 * MANDATORY RULE:
 *   If originalSha256 !== reconstructedSha256, LOSSLESS_RECONSTRUCTION = FAIL.
 *   State-hash equality is NEVER used as a substitute for bit-exact payload recovery.
 */
import * as crypto from 'crypto';
import { ReferenceDeduplicationEngine } from './ReferenceDeduplicationEngine';
export class LosslessReconstructionEngine {
    dedupStore;
    constructor(dedupStore) {
        this.dedupStore = dedupStore ?? new ReferenceDeduplicationEngine();
    }
    /**
     * Runs the full 6-stage end-to-end reconstruction pipeline over a payload.
     */
    verifyLosslessPipeline(payload, referenceKey = `ref_${Date.now()}`) {
        const startTime = Date.now();
        // Stage 1: Source
        const sourceLen = payload.length;
        const sourceSha = crypto.createHash('sha256').update(payload).digest('hex');
        // Stage 2 & 3: Encode & Store
        const stateHash = this.dedupStore.storeOrReference(referenceKey, payload);
        // Stage 4: Reference handle
        const handle = referenceKey;
        // Stage 5 & 6: Decode & Reconstruct
        const reconstructedPayload = this.dedupStore.resolve(handle);
        if (!reconstructedPayload) {
            return {
                pipelineId: `pipe_${handle}`,
                payloadBytes: sourceLen,
                originalSha256: sourceSha,
                reconstructedSha256: 'NONE',
                isLosslessVerified: false,
                roundTripLatencyMs: Date.now() - startTime,
                verdict: 'LOSSLESS_FAIL',
            };
        }
        // Stage 7: SHA-256 Compare
        const reconSha = crypto.createHash('sha256').update(reconstructedPayload).digest('hex');
        const isLossless = sourceSha === reconSha && sourceLen === reconstructedPayload.length;
        return {
            pipelineId: `pipe_${handle}`,
            payloadBytes: sourceLen,
            originalSha256: sourceSha,
            reconstructedSha256: reconSha,
            isLosslessVerified: isLossless,
            roundTripLatencyMs: Date.now() - startTime,
            verdict: isLossless ? 'LOSSLESS_CERTIFIED' : 'LOSSLESS_FAIL',
        };
    }
}
