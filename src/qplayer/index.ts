/**
 * ONE Language — Qplayer Execution Architecture
 * ==============================================
 * index.ts: Qplayer Public Architecture Facade & High-Level APIs
 */

import { OneLexer } from '../one/oneLexer';
import { GrammarRouter } from '../one/router/GrammarRouter';
import { QGraphLowering } from './graph/QGraphLowering';
import { QBinaryEncoder } from './binary/QBinaryEncoder';
import { QBinaryDecoder } from './binary/QBinaryDecoder';
import { QBinaryValidator } from './binary/QBinaryValidator';
import { QplayerRuntime, QplayerOptions, QplayerExecutionResult } from './runtime/QplayerRuntime';
import { OBIProgram } from './spec/OBISpec';

export * from './spec/OBISpec';
export * from './binary/QBinaryEncoder';
export * from './binary/QBinaryDecoder';
export * from './binary/QBinaryValidator';
export * from './graph/QGraph';
export * from './graph/QGraphOptimizer';
export * from './graph/QGraphLowering';
export * from './runtime/QplayerRuntime';
export * from './jit/QJITCompiler';
export * from './parallel/QSpatialParallelScheduler';

export class Qplayer {
  /**
   * Compiles ONE source code into an optimized One Binary Intelligence (.obi) stream.
   */
  public static compileToOBI(source: string): Buffer {
    const lexer = new OneLexer(source);
    const tokens = lexer.tokenize();
    const { ast } = GrammarRouter.parse(tokens);

    const graph = QGraphLowering.buildGraphFromAST(ast);
    const obiProgram = QGraphLowering.lowerGraphToOBI(graph);

    return QBinaryEncoder.encode(obiProgram.instructions, obiProgram.constants);
  }

  /**
   * Directly compiles and executes a ONE source program on the Qplayer runtime.
   */
  public static execute(source: string, options?: QplayerOptions): QplayerExecutionResult {
    const obiBuffer = this.compileToOBI(source);
    const runtime = new QplayerRuntime(options);
    return runtime.executeBuffer(obiBuffer);
  }

  /**
   * Executes a pre-compiled OBI binary buffer on the Qplayer runtime.
   */
  public static runBinary(buffer: Buffer, options?: QplayerOptions): QplayerExecutionResult {
    const runtime = new QplayerRuntime(options);
    return runtime.executeBuffer(buffer);
  }
}
