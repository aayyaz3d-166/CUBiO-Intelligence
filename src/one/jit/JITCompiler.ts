/**
 * CUBiO AI — ONE LANGUAGE — JIT COMPILER
 * =========================================
 * Module: @one/jit/JITCompiler
 * Gate: ONE-05 / JavaScript JIT Code Generation
 *
 * Compiles UnifiedIRProgram bytecode into high-speed V8 JIT-executable
 * JavaScript functions with slot-based variables and Tensor operations.
 */

import { UnifiedIRProgram } from '../ir/UnifiedIR';
import { VMExecutionResult, OneVMError } from '../vm/UnifiedVM';
import { JITSlotAllocator } from './JITSlotAllocator';
import { JITBytecodeEmitter, EmitterOptions } from './JITBytecodeEmitter';
import { createJITRuntimeContext, JITRuntimeContext } from './JITRuntimeContext';

export interface JITCompilerOptions extends EmitterOptions {
  cache?: boolean;
}

export interface JITExecutionOptions {
  initialGlobals?: Record<string, any>;
  customContext?: JITRuntimeContext;
}

export interface CompiledJITProgram {
  jsSource: string;
  executeFn: (ctx: JITRuntimeContext, slots: any[], initialGlobals?: Record<string, any>) => any;
  allocator: JITSlotAllocator;
  slotCount: number;
  run(options?: JITExecutionOptions): VMExecutionResult;
}

export class JITCompiler {
  private static compilationCache: Map<string, CompiledJITProgram> = new Map();

  /**
   * Compiles an IR program into a V8 JIT-executable function.
   */
  public static compile(
    program: UnifiedIRProgram,
    options: JITCompilerOptions = {}
  ): CompiledJITProgram {
    const useCache = options.cache !== false;
    const cacheKey = useCache ? JITCompiler.computeCacheKey(program) : '';

    if (useCache && JITCompiler.compilationCache.has(cacheKey)) {
      return JITCompiler.compilationCache.get(cacheKey)!;
    }

    const allocator = new JITSlotAllocator(program);
    const emitter = new JITBytecodeEmitter(program, allocator);
    const jsSource = emitter.emitJavaScript(options);

    // Instantiate function via safe Function constructor
    let executeFn: (ctx: JITRuntimeContext, slots: any[], initialGlobals?: Record<string, any>) => any;
    try {
      const factory = new Function(jsSource);
      executeFn = factory();
    } catch (err: any) {
      throw new Error(`Failed to compile generated JIT JavaScript: ${err.message}\n${jsSource}`);
    }

    const compiled: CompiledJITProgram = {
      jsSource,
      executeFn,
      allocator,
      slotCount: allocator.totalSlots,
      run(execOptions: JITExecutionOptions = {}): VMExecutionResult {
        const startMs = performance.now();
        const ctx = execOptions.customContext ?? createJITRuntimeContext();
        const slots = new Array(allocator.totalSlots).fill(0);

        try {
          const rawResult = executeFn(ctx, slots, execOptions.initialGlobals);
          const duration = performance.now() - startMs;

          return {
            success: true,
            output: [...rawResult.output],
            globals: rawResult.globals,
            instructionsExecuted: rawResult.instructionsExecuted,
            executionTimeMs: duration,
          };
        } catch (err: any) {
          const duration = performance.now() - startMs;
          if (err instanceof OneVMError) {
            return {
              success: false,
              output: [...ctx.output],
              globals: {},
              error: {
                code: err.code,
                message: err.message,
                pc: err.pc,
              },
              instructionsExecuted: 0,
              executionTimeMs: duration,
            };
          }
          return {
            success: false,
            output: [...ctx.output],
            globals: {},
            error: {
              code: 'E5999',
              message: err.message || 'JIT Execution Error',
              pc: 0,
            },
            instructionsExecuted: 0,
            executionTimeMs: duration,
          };
        }
      },
    };

    if (useCache && cacheKey) {
      JITCompiler.compilationCache.set(cacheKey, compiled);
    }

    return compiled;
  }

  /**
   * Convenience runner: compiles and executes in one call.
   */
  public static execute(
    program: UnifiedIRProgram,
    options: JITExecutionOptions & JITCompilerOptions = {}
  ): VMExecutionResult {
    const compiled = JITCompiler.compile(program, options);
    return compiled.run(options);
  }

  /**
   * Clears the compilation cache.
   */
  public static clearCache(): void {
    JITCompiler.compilationCache.clear();
  }

  private static computeCacheKey(program: UnifiedIRProgram): string {
    return `${program.version}#${program.instructions.length}#${program.instructions
      .map((i) => `${i.opcode}:${i.destination?.value || ''}:${i.sources.map((s) => s.value).join(',')}`)
      .join(';')}`;
  }
}
