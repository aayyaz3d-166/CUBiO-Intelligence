/**
 * CUBiO AI — ONE LANGUAGE — NATIVE INTELLIGENCE TOOLING
 * =====================================================
 * Module: @one/intelligence/runtime/UniversalToolSDK
 *
 * Implements Capability 58: Universal Native Tool SDK
 * Provides a fluent, type-safe builder API for defining, validating,
 * and registering sovereign native tools into CUBiO runtime.
 */

import { INativeTool, ToolCategory, ToolExecutionContext, NativeToolResponse } from '../../tools/INativeTool';
import { NativeToolRegistry } from '../../tools/NativeToolRegistry';
import { NativeValue, createNull, toRaw, fromRaw } from '../../runtime/NativeValues';
import { CanonicalSerializer } from '../../data/CanonicalSerializer';

export interface ParamSchema {
  name: string;
  type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ARRAY' | 'RECORD' | 'ANY';
  required: boolean;
  defaultValue?: unknown;
  description?: string;
}

export type ToolExecutorFn = (params: Record<string, NativeValue>, context: ToolExecutionContext) => unknown;

export class NativeToolBuilder {
  private toolId: string = '';
  private toolCategory: ToolCategory = 'REASONING';
  private toolVersion: string = '1.0.0';
  private toolDescription: string = '';
  private paramSchemas: Map<string, ParamSchema> = new Map();
  private executor?: ToolExecutorFn;

  public static create(id: string): NativeToolBuilder {
    const builder = new NativeToolBuilder();
    builder.toolId = id;
    return builder;
  }

  public category(cat: ToolCategory): this {
    this.toolCategory = cat;
    return this;
  }

  public version(ver: string): this {
    this.toolVersion = ver;
    return this;
  }

  public description(desc: string): this {
    this.toolDescription = desc;
    return this;
  }

  public param(name: string, type: ParamSchema['type'], required: boolean = true, defaultValue?: unknown, description?: string): this {
    this.paramSchemas.set(name, { name, type, required, defaultValue, description });
    return this;
  }

  public handler(fn: ToolExecutorFn): this {
    this.executor = fn;
    return this;
  }

  public build(): INativeTool {
    if (!this.toolId) throw new Error('Tool ID is required.');
    if (!this.executor) throw new Error(`Executor handler required for tool '${this.toolId}'.`);

    const id = this.toolId;
    const cat = this.toolCategory;
    const ver = this.toolVersion;
    const desc = this.toolDescription;
    const schemas = new Map(this.paramSchemas);
    const exec = this.executor;

    const toolInstance: INativeTool = {
      id,
      category: cat,
      version: ver,
      description: desc,
      isActuationBlocked: true, // Permanent fail-closed invariant

      execute(params: Record<string, NativeValue>, context: ToolExecutionContext): NativeToolResponse {
        const t0 = performance.now();
        try {
          // 1. Schema Validation
          for (const [pName, schema] of schemas.entries()) {
            if (schema.required && (!(pName in params) || params[pName] === undefined)) {
              if (schema.defaultValue !== undefined) {
                params[pName] = fromRaw(schema.defaultValue);
              } else {
                throw new Error(`[SDK Error] Missing required parameter '${pName}' for tool '${id}'.`);
              }
            }
          }

          // 2. Execute Handler
          const rawResult = exec(params, context);
          const resultVal = fromRaw(rawResult);
          const latency = performance.now() - t0;
          const envelope = CanonicalSerializer.packEnvelope(rawResult);

          return {
            toolId: id,
            success: true,
            result: resultVal,
            latencyMs: latency,
            stateHash: envelope.payloadHash,
          };
        } catch (err: any) {
          return {
            toolId: id,
            success: false,
            result: createNull(),
            latencyMs: performance.now() - t0,
            stateHash: '0xERROR',
            error: err.message,
          };
        }
      },
    };

    // Auto-register with NativeToolRegistry
    NativeToolRegistry.getInstance().registerTool(toolInstance);
    return toolInstance;
  }
}
