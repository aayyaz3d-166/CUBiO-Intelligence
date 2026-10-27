import * as fs from 'fs';
import * as path from 'path';
import { UnifiedCompiler, MultiFileCompilerOptions, MultiFileCompilationResult } from '../UnifiedCompiler';
import { UnifiedIRProgram } from '../ir/UnifiedIR';
import { ExecutablePacker, OnePackerError } from './ExecutablePacker';
import { ONEX_FLAG_MULTI_FILE_LINKED } from './ExecutableArtifact';
import { UnifiedVM, VMExecutionResult, VMOptions } from '../vm/UnifiedVM';
import { NativeRuntime, NativeRuntimeResult } from '../runtime/NativeRuntime';

export interface LinkAndPackOptions extends MultiFileCompilerOptions {
  outputPath?: string;
  writeArtifact?: boolean;
  rssMaxLimitMB?: number;
}

export interface LinkAndPackResult {
  success: boolean;
  entryPoint: string;
  artifactBuffer?: Buffer;
  artifactPath?: string;
  ir?: UnifiedIRProgram;
  diagnostics: any[];
  vmResult?: VMExecutionResult;
}

export class ExecutableLinker {
  /**
   * Compiles source code (single-file or multi-file dependency graph),
   * links into unified IR, and packages into a versioned ONEX binary artifact (.ox).
   */
  public static linkAndPack(
    entryPoint: string,
    options: LinkAndPackOptions = {}
  ): LinkAndPackResult {
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

      let artifactPath: string | undefined = undefined;
      if (options.outputPath || options.writeArtifact) {
        artifactPath = options.outputPath ?? entryPoint.replace(/\.one$/, '.ox');
        const resolvedPath = path.resolve(options.projectRoot ?? process.cwd(), artifactPath);
        fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
        fs.writeFileSync(resolvedPath, artifactBuffer);
      }

      let vmResult: VMExecutionResult | undefined = undefined;
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
    } catch (err: any) {
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
  public static loadAndRun(
    artifactOrPath: Buffer | string,
    vmOptions?: VMOptions
  ): { success: boolean; ir?: UnifiedIRProgram; vmResult?: VMExecutionResult; error?: string } {
    try {
      let buffer: Buffer;
      if (typeof artifactOrPath === 'string') {
        const resolved = path.resolve(artifactOrPath);
        if (!fs.existsSync(resolved)) {
          return {
            success: false,
            error: `Artifact file not found: ${resolved}`,
          };
        }
        buffer = fs.readFileSync(resolved);
      } else {
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
    } catch (err: any) {
      return {
        success: false,
        error: err.message || String(err),
      };
    }
  }

  /**
   * Loads a packed ONEX binary artifact (.ox) and executes on NativeRuntime.
   */
  public static loadAndRunNative(
    artifactOrPath: Buffer | string
  ): { success: boolean; ir?: UnifiedIRProgram; runtimeResult?: NativeRuntimeResult; error?: string } {
    try {
      let buffer: Buffer;
      if (typeof artifactOrPath === 'string') {
        const resolved = path.resolve(artifactOrPath);
        if (!fs.existsSync(resolved)) {
          return {
            success: false,
            error: `Artifact file not found: ${resolved}`,
          };
        }
        buffer = fs.readFileSync(resolved);
      } else {
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
    } catch (err: any) {
      return {
        success: false,
        error: err.message || String(err),
      };
    }
  }
}
