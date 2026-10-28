/**
 * CUBiO AI — ONE LANGUAGE — OPTIMIZER STATE MANAGEMENT
 * =======================================================
 * Module: @one/training/OptimizerState
 * Gate: ONE-07 / Training Primitives & State Management
 *
 * Implements strictly typed optimizer state serialization, checksumming,
 * and sandbox copy isolation.
 */
/**
 * Computes a deterministic 32-bit FNV-1a hash across all moment buffers.
 */
export function computeMomentsChecksum(moments) {
    let hash = 0x811c9dc5;
    for (const record of moments) {
        const mInt = new Int32Array(record.m.buffer, record.m.byteOffset, record.m.length);
        const vInt = new Int32Array(record.v.buffer, record.v.byteOffset, record.v.length);
        const step = Math.max(1, Math.floor(record.size / 100));
        for (let i = 0; i < record.size; i += step) {
            hash ^= mInt[i];
            hash = Math.imul(hash, 0x01000193);
            hash ^= vInt[i];
            hash = Math.imul(hash, 0x01000193);
        }
    }
    return hash >>> 0;
}
/**
 * Deep-clones an optimizer state record into an isolated sandbox copy.
 */
export function cloneOptimizerState(state) {
    const clonedMoments = state.moments.map((rec) => ({
        paramIndex: rec.paramIndex,
        name: rec.name,
        size: rec.size,
        shape: [...rec.shape],
        m: new Float32Array(rec.m),
        v: new Float32Array(rec.v),
    }));
    return {
        stepCount: state.stepCount,
        lr: state.lr,
        beta1: state.beta1,
        beta2: state.beta2,
        eps: state.eps,
        weightDecay: state.weightDecay,
        moments: clonedMoments,
        checksum: state.checksum,
    };
}
