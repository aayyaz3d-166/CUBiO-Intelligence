/**
 * CUBiO AI — ONE LANGUAGE — AUTOGRAD BRIDGE
 * ============================================
 * Module: @one/tensor/AutogradBridge
 *
 * Decoupled provider interface between Tensor primitives and the
 * Reverse-Mode Autograd Engine. Eliminates CommonJS require() calls in native ESM
 * while providing automatic, seamless autograd registration.
 */

import type { Tensor } from './Tensor';
import type { TensorMemoryArena } from './TensorArena';
import { AutogradTape } from './autograd/AutogradTape';
import { AutogradOps } from './autograd/AutogradOps';

export interface IAutogradProvider {
  isRecording(): boolean;
  backward(tensor: Tensor, grad?: Tensor, arena?: TensorMemoryArena, retainGraph?: boolean): void;
  add(a: Tensor, b: Tensor, arena?: TensorMemoryArena): Tensor;
  sub(a: Tensor, b: Tensor, arena?: TensorMemoryArena): Tensor;
  mul(a: Tensor, b: Tensor, arena?: TensorMemoryArena): Tensor;
  matmul(a: Tensor, b: Tensor, arena?: TensorMemoryArena): Tensor;
  reduceSum(x: Tensor, axis?: number, keepdim?: boolean, arena?: TensorMemoryArena): Tensor;
  reduceMean(x: Tensor, axis?: number, keepdim?: boolean, arena?: TensorMemoryArena): Tensor;
  gelu(x: Tensor, arena?: TensorMemoryArena): Tensor;
  softmax(x: Tensor, axis?: number, arena?: TensorMemoryArena): Tensor;
  relu(x: Tensor, arena?: TensorMemoryArena): Tensor;
}

class DefaultAutogradProvider implements IAutogradProvider {
  public isRecording(): boolean {
    return AutogradTape.isRecording();
  }

  public backward(tensor: Tensor, grad?: Tensor, arena?: TensorMemoryArena, retainGraph: boolean = false): void {
    AutogradTape.getActiveTape().backward(tensor, grad, arena, retainGraph);
  }

  public add(a: Tensor, b: Tensor, arena?: TensorMemoryArena): Tensor {
    return AutogradOps.add(a, b, arena);
  }

  public sub(a: Tensor, b: Tensor, arena?: TensorMemoryArena): Tensor {
    return AutogradOps.sub(a, b, arena);
  }

  public mul(a: Tensor, b: Tensor, arena?: TensorMemoryArena): Tensor {
    return AutogradOps.mul(a, b, arena);
  }

  public matmul(a: Tensor, b: Tensor, arena?: TensorMemoryArena): Tensor {
    return AutogradOps.matmul(a, b, arena);
  }

  public reduceSum(x: Tensor, axis?: number, keepdim: boolean = false, arena?: TensorMemoryArena): Tensor {
    return AutogradOps.reduceSum(x, axis, keepdim, arena);
  }

  public reduceMean(x: Tensor, axis?: number, keepdim: boolean = false, arena?: TensorMemoryArena): Tensor {
    return AutogradOps.reduceMean(x, axis, keepdim, arena);
  }

  public gelu(x: Tensor, arena?: TensorMemoryArena): Tensor {
    return AutogradOps.gelu(x, arena);
  }

  public softmax(x: Tensor, axis: number = -1, arena?: TensorMemoryArena): Tensor {
    return AutogradOps.softmax(x, axis, arena);
  }

  public relu(x: Tensor, arena?: TensorMemoryArena): Tensor {
    return AutogradOps.relu(x, arena);
  }
}

let activeProvider: IAutogradProvider = new DefaultAutogradProvider();

export class AutogradBridge {
  public static registerProvider(provider: IAutogradProvider): void {
    activeProvider = provider;
  }

  public static getProvider(): IAutogradProvider {
    return activeProvider;
  }

  public static isRecording(): boolean {
    return activeProvider.isRecording();
  }
}
