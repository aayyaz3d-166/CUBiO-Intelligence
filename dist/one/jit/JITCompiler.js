/**
 * CUBiO AI — ONE LANGUAGE — JIT COMPILER
 * =========================================
 * Module: @one/jit/JITCompiler
 * Gate: ONE-05 / JavaScript JIT Code Generation
 *
 * Compiles UnifiedIRProgram bytecode into high-speed V8 JIT-executable
 * JavaScript functions with slot-based variables and Tensor operations.
 */
import { OneVMError } from '../vm/UnifiedVM';
import { JITSlotAllocator } from './JITSlotAllocator';
import { JITBytecodeEmitter } from './JITBytecodeEmitter';
import { createJITRuntimeContext } from './JITRuntimeContext';
export class JITCompiler {
    static compilationCache = new Map();
    /**
     * Compiles an IR program into a V8 JIT-executable function.
     */
    static compile(program, options = {}) {
        const useCache = options.cache !== false;
        const cacheKey = useCache ? JITCompiler.computeCacheKey(program) : '';
        if (useCache && JITCompiler.compilationCache.has(cacheKey)) {
            return JITCompiler.compilationCache.get(cacheKey);
        }
        const allocator = new JITSlotAllocator(program);
        const emitter = new JITBytecodeEmitter(program, allocator);
        const jsSource = emitter.emitJavaScript(options);
        // Instantiate function via safe Function constructor
        let executeFn;
        try {
            const factory = new Function(jsSource);
            executeFn = factory();
        }
        catch (err) {
            throw new Error(`Failed to compile generated JIT JavaScript: ${err.message}\n${jsSource}`);
        }
        const compiled = {
            jsSource,
            executeFn,
            allocator,
            slotCount: allocator.totalSlots,
            run(execOptions = {}) {
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
                }
                catch (err) {
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
    static execute(program, options = {}) {
        const compiled = JITCompiler.compile(program, options);
        return compiled.run(options);
    }
    /**
     * Clears the compilation cache.
     */
    static clearCache() {
        JITCompiler.compilationCache.clear();
    }
    static computeCacheKey(program) {
        return `${program.version}#${program.instructions.length}#${program.instructions
            .map((i) => `${i.opcode}:${i.destination?.value || ''}:${i.sources.map((s) => s.value).join(',')}`)
            .join(';')}`;
    }
}
