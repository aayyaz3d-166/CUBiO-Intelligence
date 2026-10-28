import * as fs from 'fs';
import * as path from 'path';
import { UnifiedCompiler } from '../UnifiedCompiler';
import { ExecutablePacker, OnePackerError } from './ExecutablePacker';
import { ONEX_FLAG_MULTI_FILE_LINKED } from './ExecutableArtifact';
import { UnifiedVM } from '../vm/UnifiedVM';
import { NativeRuntime } from '../runtime/NativeRuntime';
export class ExecutableLinker {
    /**
     * Compiles source code (single-file or multi-file dependency graph),
     * links into unified IR, and packages into a versioned ONEX binary artifact (.ox).
     */
    static linkAndPack(entryPoint, options = {}) {
        const compiler = new UnifiedCompiler();
        const compilation = compiler.compileMultiFile(entryPoint, options);
        if (!compilation.success || !compilation.linkedIR) {
            return {
                success: false,
                entryPoint,
                diagnostics: compilation.diagnostics,
            };
        }
        try {
            const isMulti = Boolean(compilation.sortedModules && compilation.sortedModules.length > 1);
            const flags = isMulti ? ONEX_FLAG_MULTI_FILE_LINKED : 0;
            const artifactBuffer = ExecutablePacker.pack(compilation.linkedIR, {
                flags,
                rssMaxLimitMB: options.rssMaxLimitMB,
            });
            let artifactPath = undefined;
            if (options.outputPath || options.writeArtifact) {
                artifactPath = options.outputPath ?? entryPoint.replace(/\.one$/, '.ox');
                const resolvedPath = path.resolve(options.projectRoot ?? process.cwd(), artifactPath);
                fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
                fs.writeFileSync(resolvedPath, artifactBuffer);
            }
            let vmResult = undefined;
            if (options.execute) {
                const vm = new UnifiedVM();
                vmResult = vm.execute(compilation.linkedIR, options.vmOptions);
            }
            return {
                success: true,
                entryPoint,
                artifactBuffer,
                artifactPath,
                ir: compilation.linkedIR,
                diagnostics: compilation.diagnostics,
                vmResult,
            };
        }
        catch (err) {
            return {
                success: false,
                entryPoint,
                diagnostics: [
                    ...compilation.diagnostics,
                    {
                        code: err instanceof OnePackerError ? err.code : 'E8003',
                        message: err.message || String(err),
                    },
                ],
            };
        }
    }
    /**
     * Loads a packed ONEX binary artifact (.ox), verifies integrity and safety,
     * and executes on UnifiedVM.
     */
    static loadAndRun(artifactOrPath, vmOptions) {
        try {
            let buffer;
            if (typeof artifactOrPath === 'string') {
                const resolved = path.resolve(artifactOrPath);
                if (!fs.existsSync(resolved)) {
                    return {
                        success: false,
                        error: `Artifact file not found: ${resolved}`,
                    };
                }
                buffer = fs.readFileSync(resolved);
            }
            else {
                buffer = artifactOrPath;
            }
            // Unpack with fail-closed validation
            const ir = ExecutablePacker.unpack(buffer);
            // Execute on UnifiedVM
            const vm = new UnifiedVM();
            const vmResult = vm.execute(ir, vmOptions);
            return {
                success: vmResult.success,
                ir,
                vmResult,
            };
        }
        catch (err) {
            return {
                success: false,
                error: err.message || String(err),
            };
        }
    }
    /**
     * Loads a packed ONEX binary artifact (.ox) and executes on NativeRuntime.
     */
    static loadAndRunNative(artifactOrPath) {
        try {
            let buffer;
            if (typeof artifactOrPath === 'string') {
                const resolved = path.resolve(artifactOrPath);
                if (!fs.existsSync(resolved)) {
                    return {
                        success: false,
                        error: `Artifact file not found: ${resolved}`,
                    };
                }
                buffer = fs.readFileSync(resolved);
            }
            else {
                buffer = artifactOrPath;
            }
            const ir = ExecutablePacker.unpack(buffer);
            const runtime = new NativeRuntime();
            const runtimeResult = runtime.execute(ir);
            return {
                success: runtimeResult.success,
                ir,
                runtimeResult,
            };
        }
        catch (err) {
            return {
                success: false,
                error: err.message || String(err),
            };
        }
    }
}
