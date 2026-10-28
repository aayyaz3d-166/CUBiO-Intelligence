/**
 * ONE Language — Native Tool Interfaces
 * =====================================
 * Module: @one/tools/INativeTool
 *
 * Defines the standard contract for all sovereign native tools in One Language.
 * Ensures zero-variance invocation semantics, parameter typing, and cryptographic seals.
 */

import { NativeValue } from '../runtime/NativeValues';
import { NativeMemoryAPI } from '../memory/NativeMemoryAPI';

export type ToolCategory =
  | 'MEMORY'
  | 'REASONING'
  | 'SIMULATION'
  | 'KNOWLEDGE'
  | 'MULTIMODAL'
  | 'TRAINING'
  | 'SPATIAL';

export interface ToolExecutionContext {
  caller: string;
  timestamp: number;
  memoryAPI?: NativeMemoryAPI;
  skipCache?: boolean;
}

export interface NativeToolResponse {
  toolId: string;
  success: boolean;
  result: NativeValue;
  latencyMs: number;
  stateHash: string;
  error?: string;
}

export interface INativeTool {
  readonly id: string;
  readonly category: ToolCategory;
  readonly version: string;
  readonly description: string;
  readonly isActuationBlocked: boolean; // Sovereign safety invariant

  /**
   * Executes the tool with typed parameter values.
   */
  execute(params: Record<string, NativeValue>, context: ToolExecutionContext): NativeToolResponse;
}
