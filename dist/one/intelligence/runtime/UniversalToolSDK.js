/**
 * CUBiO AI — ONE LANGUAGE — NATIVE INTELLIGENCE TOOLING
 * =====================================================
 * Module: @one/intelligence/runtime/UniversalToolSDK
 *
 * Implements Capability 58: Universal Native Tool SDK
 * Provides a fluent, type-safe builder API for defining, validating,
 * and registering sovereign native tools into CUBiO runtime.
 */
import { NativeToolRegistry } from '../../tools/NativeToolRegistry';
import { createNull, fromRaw } from '../../runtime/NativeValues';
import { CanonicalSerializer } from '../../data/CanonicalSerializer';
export class NativeToolBuilder {
    toolId = '';
    toolCategory = 'REASONING';
    toolVersion = '1.0.0';
    toolDescription = '';
    paramSchemas = new Map();
    executor;
    static create(id) {
        const builder = new NativeToolBuilder();
        builder.toolId = id;
        return builder;
    }
    category(cat) {
        this.toolCategory = cat;
        return this;
    }
    version(ver) {
        this.toolVersion = ver;
        return this;
    }
    description(desc) {
        this.toolDescription = desc;
        return this;
    }
    param(name, type, required = true, defaultValue, description) {
        this.paramSchemas.set(name, { name, type, required, defaultValue, description });
        return this;
    }
    handler(fn) {
        this.executor = fn;
        return this;
    }
    build() {
        if (!this.toolId)
            throw new Error('Tool ID is required.');
        if (!this.executor)
            throw new Error(`Executor handler required for tool '${this.toolId}'.`);
        const id = this.toolId;
        const cat = this.toolCategory;
        const ver = this.toolVersion;
        const desc = this.toolDescription;
        const schemas = new Map(this.paramSchemas);
        const exec = this.executor;
        const toolInstance = {
            id,
            category: cat,
            version: ver,
            description: desc,
            isActuationBlocked: true, // Permanent fail-closed invariant
            execute(params, context) {
                const t0 = performance.now();
                try {
                    // 1. Schema Validation
                    for (const [pName, schema] of schemas.entries()) {
                        if (schema.required && (!(pName in params) || params[pName] === undefined)) {
                            if (schema.defaultValue !== undefined) {
                                params[pName] = fromRaw(schema.defaultValue);
                            }
                            else {
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
                }
                catch (err) {
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
