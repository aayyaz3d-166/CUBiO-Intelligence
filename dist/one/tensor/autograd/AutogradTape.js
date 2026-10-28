/**
 * CUBiO AI — ONE LANGUAGE — REVERSE-MODE AUTOGRAD TAPE
 * =====================================================
 * Module: @one/tensor/autograd/AutogradTape
 * Gate: ONE-04 / Reverse-Mode Automatic Differentiation
 *
 * Implements a memory-safe reverse-mode computation tape that records
 * forward graph executions, executes reverse topological traversal,
 * accumulates gradients into Tensor storage, and cleans up tape memory.
 */
import { Tensor } from '../Tensor';
export class AutogradTape {
    entries = [];
    nextId = 0;
    _isRecording = true;
    static globalDefaultTape = new AutogradTape();
    static tapeStack = [AutogradTape.globalDefaultTape];
    static globalRecordingEnabled = true;
    constructor() { }
    /**
     * Retrieves the currently active AutogradTape from the tape stack.
     */
    static getActiveTape() {
        return AutogradTape.tapeStack[AutogradTape.tapeStack.length - 1];
    }
    /**
     * Checks whether autograd tape recording is currently active.
     */
    static isRecording() {
        return AutogradTape.globalRecordingEnabled && AutogradTape.getActiveTape().isRecording;
    }
    /**
     * Executes a block within an isolated tape context.
     */
    static withTape(fn) {
        const newTape = new AutogradTape();
        AutogradTape.tapeStack.push(newTape);
        try {
            return fn(newTape);
        }
        finally {
            newTape.cleanUp();
            AutogradTape.tapeStack.pop();
        }
    }
    /**
     * Executes a block with gradient recording disabled.
     */
    static noGrad(fn) {
        const prev = AutogradTape.globalRecordingEnabled;
        AutogradTape.globalRecordingEnabled = false;
        try {
            return fn();
        }
        finally {
            AutogradTape.globalRecordingEnabled = prev;
        }
    }
    /**
     * Resets the default global tape.
     */
    static resetDefaultTape() {
        AutogradTape.globalDefaultTape.cleanUp();
    }
    get isRecording() {
        return this._isRecording;
    }
    set isRecording(val) {
        this._isRecording = val;
    }
    get count() {
        return this.entries.length;
    }
    /**
     * Records a new operation entry onto the computation tape.
     */
    record(entrySpec) {
        if (!this._isRecording || !AutogradTape.globalRecordingEnabled) {
            return;
        }
        // Only record if at least one input requires gradient
        const hasGradInput = entrySpec.inputs.some((t) => t.requiresGrad);
        if (!hasGradInput) {
            return;
        }
        const entry = {
            ...entrySpec,
            id: this.nextId++,
        };
        // Mark output as requiring grad and link entry
        entry.output.requiresGrad = true;
        entry.output.gradFn = entry;
        this.entries.push(entry);
    }
    /**
     * Executes reverse-mode automatic differentiation starting from the root tensor.
     *
     * @param root The scalar objective or target loss tensor.
     * @param rootGrad Optional upstream incoming gradient tensor. Defaults to 1.0 for scalar.
     * @param arena Optional TensorMemoryArena for temporary allocations.
     * @param retainGraph If false (default), tape entries and saved activations are cleared after backward.
     */
    backward(root, rootGrad, arena, retainGraph = false) {
        if (rootGrad === undefined) {
            if (root.size !== 1) {
                throw new Error(`Implicit gradient creation is only valid for scalar outputs (got shape [${root.shape.join(', ')}]). ` +
                    `Provide an explicit rootGrad tensor for vector/matrix outputs.`);
            }
            rootGrad = arena ? arena.allocateTensor(root.shape) : Tensor.zeros(root.shape);
            rootGrad.data[rootGrad.offset] = 1.0;
        }
        else {
            if (rootGrad.size !== root.size) {
                throw new Error(`Root gradient size mismatch: root size (${root.size}) !== rootGrad size (${rootGrad.size})`);
            }
        }
        // Initialize root gradient
        this.accumulateGrad(root, rootGrad, arena);
        // Reverse topological traversal through recorded operations
        for (let i = this.entries.length - 1; i >= 0; i--) {
            const entry = this.entries[i];
            const dOut = entry.output.grad;
            if (!dOut) {
                // Output gradient was never propagated or is zero
                continue;
            }
            // Compute input gradients via kernel adjoint closure
            const inputGrads = entry.backward(dOut, arena);
            if (inputGrads.length !== entry.inputs.length) {
                throw new Error(`Backward closure for '${entry.opName}' returned ${inputGrads.length} gradients, expected ${entry.inputs.length}`);
            }
            // Accumulate gradients into inputs
            for (let j = 0; j < entry.inputs.length; j++) {
                const input = entry.inputs[j];
                const inGrad = inputGrads[j];
                if (input && input.requiresGrad && inGrad) {
                    this.accumulateGrad(input, inGrad, arena);
                }
            }
        }
        // Clean up tape if not retaining computation graph
        if (!retainGraph) {
            this.cleanUp();
        }
    }
    /**
     * Accumulates incoming gradient into target tensor.
     * Formula: target.grad += deltaGrad (using float32 precision).
     */
    accumulateGrad(target, deltaGrad, arena) {
        if (target.grad === null) {
            target.grad = deltaGrad.clone(arena);
        }
        else {
            if (target.grad.size !== deltaGrad.size) {
                throw new Error(`Gradient accumulation dimension mismatch: target shape [${target.grad.shape}] vs delta shape [${deltaGrad.shape}]`);
            }
            const gData = target.grad.data;
            const dData = deltaGrad.data;
            const gOff = target.grad.offset;
            const dOff = deltaGrad.offset;
            for (let i = 0; i < target.grad.size; i++) {
                gData[gOff + i] = Math.fround(gData[gOff + i] + dData[dOff + i]);
            }
        }
    }
    /**
     * Cleans up all recorded tape entries and clears saved activations to free memory.
     */
    cleanUp() {
        for (const entry of this.entries) {
            entry.cleanUp();
        }
        this.entries = [];
        this.nextId = 0;
    }
}
