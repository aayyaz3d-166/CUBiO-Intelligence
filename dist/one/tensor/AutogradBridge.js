/**
 * CUBiO AI — ONE LANGUAGE — AUTOGRAD BRIDGE
 * ============================================
 * Module: @one/tensor/AutogradBridge
 *
 * Decoupled provider interface between Tensor primitives and the
 * Reverse-Mode Autograd Engine. Eliminates CommonJS require() calls in native ESM
 * while providing automatic, seamless autograd registration.
 */
import { AutogradTape } from './autograd/AutogradTape';
import { AutogradOps } from './autograd/AutogradOps';
class DefaultAutogradProvider {
    isRecording() {
        return AutogradTape.isRecording();
    }
    backward(tensor, grad, arena, retainGraph = false) {
        AutogradTape.getActiveTape().backward(tensor, grad, arena, retainGraph);
    }
    add(a, b, arena) {
        return AutogradOps.add(a, b, arena);
    }
    sub(a, b, arena) {
        return AutogradOps.sub(a, b, arena);
    }
    mul(a, b, arena) {
        return AutogradOps.mul(a, b, arena);
    }
    matmul(a, b, arena) {
        return AutogradOps.matmul(a, b, arena);
    }
    reduceSum(x, axis, keepdim = false, arena) {
        return AutogradOps.reduceSum(x, axis, keepdim, arena);
    }
    reduceMean(x, axis, keepdim = false, arena) {
        return AutogradOps.reduceMean(x, axis, keepdim, arena);
    }
    gelu(x, arena) {
        return AutogradOps.gelu(x, arena);
    }
    softmax(x, axis = -1, arena) {
        return AutogradOps.softmax(x, axis, arena);
    }
    relu(x, arena) {
        return AutogradOps.relu(x, arena);
    }
}
let activeProvider = new DefaultAutogradProvider();
export class AutogradBridge {
    static registerProvider(provider) {
        activeProvider = provider;
    }
    static getProvider() {
        return activeProvider;
    }
    static isRecording() {
        return activeProvider.isRecording();
    }
}
