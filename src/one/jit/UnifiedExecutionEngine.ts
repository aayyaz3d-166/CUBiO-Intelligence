/**
 * CUBiO AI — ONE LANGUAGE — UNIFIED EXECUTION ENGINE
 * ====================================================
 * Module: @one/jit/UnifiedExecutionEngine
 * Gate: ONE-05 / JavaScript JIT Code Generation
 *
 * Provides a dual execution orchestrator supporting both V8 JIT compilation
 * and the UnifiedVM interpreter with automated fallback and parity checking.
 */

import { UnifiedIRProgram } from '../ir/UnifiedIR';
import { UnifiedVM, VMExecutionResult, VMOptions } from '../vm/UnifiedVM';
import { JITCompiler, JITCompilerOptions } from './JITCompiler';

export type ExecutionMode = 'jit' | 'interp' | 'auto';

export interface ExecutionEngineOptions extends JITCompilerOptions {
  mode?: ExecutionMode;
  fallbackOnError?: boolean;
  initialGlobals?: Record<string, any>;
  vmOptions?: VMOptions;
}

export interface ParityComparisonResult {
  matches: boolean;
  jitResult: VMExecutionResult;
  interpResult: VMExecutionResult;
  divergences: string[];
}

export class UnifiedExecutionEngine {
  /**
   * Executes a UnifiedIRProgram with selected mode and automatic fallback.
   */
  public static execute(
    program: UnifiedIRProgram,
    options: ExecutionEngineOptions = {}
  ): VMExecutionResult {
    const mode = options.mode ?? 'auto';
    const fallback = options.fallbackOnError !== false;

    if (mode === 'interp') {
      const vm = new UnifiedVM();
      return vm.execute(program, options.vmOptions);
    }

    if (mode === 'jit') {
      return JITCompiler.execute(program, options);
    }

    // mode === 'auto'
    try {
      const jitRes = JITCompiler.execute(program, options);
      if (jitRes.success) {
        return jitRes;
      }
      if (fallback) {
        const vm = new UnifiedVM();
        return vm.execute(program, options.vmOptions);
      }
      return jitRes;
    } catch {
      if (fallback) {
        const vm = new UnifiedVM();
        return vm.execute(program, options.vmOptions);
      }
      throw new Error('JIT execution failed and fallback is disabled');
    }
  }

  /**
   * Compares the JIT execution results with the Interpreter execution results
   * for identical numerical and behavioral semantics.
   */
  public static verifyParity(program: UnifiedIRProgram): ParityComparisonResult {
    // 1. Run on Interpreter
    const vm = new UnifiedVM();
    const interpResult = vm.execute(program);

    // 2. Run on JIT
    const jitResult = JITCompiler.execute(program);

    const divergences: string[] = [];

    // Compare success status
    if (interpResult.success !== jitResult.success) {
      divergences.push(
        `Success mismatch: Interpreter (${interpResult.success}) vs JIT (${jitResult.success})`
      );
    }

    // Compare output length & strings
    if (interpResult.output.length !== jitResult.output.length) {
      divergences.push(
        `Output count mismatch: Interpreter (${interpResult.output.length}) vs JIT (${jitResult.output.length})`
      );
    } else {
      for (let i = 0; i < interpResult.output.length; i++) {
        if (interpResult.output[i] !== jitResult.output[i]) {
          divergences.push(
            `Output line ${i} mismatch: '${interpResult.output[i]}' vs '${jitResult.output[i]}'`
          );
        }
      }
    }

    // Compare globals
    const allKeys = new Set([
      ...Object.keys(interpResult.globals),
      ...Object.keys(jitResult.globals),
    ]);

    for (const key of allKeys) {
      const iVal = interpResult.globals[key];
      const jVal = jitResult.globals[key];

      if (typeof iVal === 'number' && typeof jVal === 'number') {
        const diff = Math.abs(iVal - jVal);
        if (diff > 1e-5 && !Object.is(iVal, jVal)) {
          divergences.push(
            `Numeric global '${key}' mismatch: Interpreter (${iVal}) vs JIT (${jVal}), diff=${diff}`
          );
        }
      } else if (JSON.stringify(iVal) !== JSON.stringify(jVal)) {
        divergences.push(
          `Global '${key}' mismatch: Interpreter (${JSON.stringify(iVal)}) vs JIT (${JSON.stringify(jVal)})`
        );
      }
    }

    return {
      matches: divergences.length === 0,
      jitResult,
      interpResult,
      divergences,
    };
  }
}
