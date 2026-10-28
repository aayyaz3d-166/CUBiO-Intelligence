/**
 * CUBiO AI — ONE LANGUAGE — VERIFIED TENSOR TRAINING KERNELS
 * ============================================================
 * Kernel: AddKernel (Elementwise Addition & Bias Broadcasting)
 * Module: @one/tensor/kernels/AddKernel
 */
import { Tensor } from '../Tensor';
export class AddKernel {
    /**
     * Forward: C = A + B
     * Supports identical shapes or bias broadcasting (e.g. [M, N] + [N] or [M, N] + [1, N]).
     */
    static forward(A, B, arena) {
        AddKernel.validateShapes(A, B);
        // Standard identical shape
        if (A.ndim === B.ndim && A.shape.every((dim, idx) => dim === B.shape[idx])) {
            const out = arena ? arena.allocateTensor(A.shape) : Tensor.zeros(A.shape);
            const aData = A.data;
            const bData = B.data;
            const cData = out.data;
            for (let i = 0; i < A.size; i++) {
                cData[out.offset + i] = Math.fround(aData[A.offset + i] + bData[B.offset + i]);
            }
            return { output: out, ctx: { shapeA: [...A.shape], shapeB: [...B.shape] } };
        }
        // Bias broadcasting: A [M, N], B [N] or [1, N]
        const [M, N] = A.shape;
        const out = arena ? arena.allocateTensor([M, N]) : Tensor.zeros([M, N]);
        for (let i = 0; i < M; i++) {
            for (let j = 0; j < N; j++) {
                const aVal = A.get(i, j);
                const bVal = B.ndim === 1 ? B.get(j) : B.get(0, j);
                out.set(Math.fround(aVal + bVal), i, j);
            }
        }
        return { output: out, ctx: { shapeA: [...A.shape], shapeB: [...B.shape] } };
    }
    /**
     * Backward:
     * dA = dC
     * dB = dC (summed across broadcasted dimension if B was broadcasted)
     */
    static backward(dC, ctx, arena) {
        const { shapeA, shapeB } = ctx;
        const dA = arena ? arena.allocateTensor(shapeA) : Tensor.zeros(shapeA);
        const dB = arena ? arena.allocateTensor(shapeB) : Tensor.zeros(shapeB);
        if (shapeA.length === shapeB.length && shapeA.every((v, i) => v === shapeB[i])) {
            // Direct 1-to-1 copy
            dA.copyFrom(dC);
            dB.copyFrom(dC);
            return { dA, dB };
        }
        // Broadcast case: A [M, N], B [N] or [1, N]
        const [M, N] = shapeA;
        dA.copyFrom(dC);
        // Accumulate into dB
        dB.data.fill(0, dB.offset, dB.offset + dB.size);
        for (let i = 0; i < M; i++) {
            for (let j = 0; j < N; j++) {
                const g = dC.get(i, j);
                if (shapeB.length === 1) {
                    dB.set(Math.fround(dB.get(j) + g), j);
                }
                else {
                    dB.set(Math.fround(dB.get(0, j) + g), 0, j);
                }
            }
        }
        return { dA, dB };
    }
    /**
     * Canonical numerical reference.
     */
    static reference(A, B) {
        AddKernel.validateShapes(A, B);
        const ref = new Float32Array(A.size);
        if (A.ndim === B.ndim && A.shape.every((dim, idx) => dim === B.shape[idx])) {
            for (let i = 0; i < A.size; i++) {
                ref[i] = Math.fround(A.data[A.offset + i] + B.data[B.offset + i]);
            }
        }
        else {
            const [M, N] = A.shape;
            for (let i = 0; i < M; i++) {
                for (let j = 0; j < N; j++) {
                    const bVal = B.ndim === 1 ? B.get(j) : B.get(0, j);
                    ref[i * N + j] = Math.fround(A.get(i, j) + bVal);
                }
            }
        }
        return ref;
    }
    /**
     * Shape validation.
     */
    static validateShapes(A, B) {
        if (A.ndim === B.ndim && A.shape.every((dim, idx) => dim === B.shape[idx]))
            return;
        // Check 2D bias broadcasting [M, N] + [N] or [M, N] + [1, N]
        if (A.ndim === 2) {
            const [, N] = A.shape;
            if (B.ndim === 1 && B.shape[0] === N)
                return;
            if (B.ndim === 2 && B.shape[0] === 1 && B.shape[1] === N)
                return;
        }
        throw new Error(`Incompatible shapes for AddKernel: A [${A.shape}] and B [${B.shape}]`);
    }
}
