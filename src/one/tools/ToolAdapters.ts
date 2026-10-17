/**
 * ONE Language — Native Tool Adapters
 * ====================================
 * Module: @one/tools/ToolAdapters
 *
 * Wraps existing CUBiO specialized engines into the unified INativeTool contract,
 * enabling seamless execution, reflection, caching, and pipeline composition.
 *
 * Reused engines:
 *   - SpatialReasoningEngine
 *   - KnowledgeInferenceEngine
 *   - ProceduralVoxelWorldEngine
 *   - ProductionInferenceEngine
 *   - HarmonicAlignmentTrainer
 *   - NativeMemoryAPI
 */

import { INativeTool, ToolCategory, ToolExecutionContext, NativeToolResponse } from './INativeTool';
import {
  NativeValue,
  createNull,
  createBool,
  createInt,
  createFloat,
  createString,
  createArray,
  createRecord,
  toRaw,
  fromRaw,
} from '../runtime/NativeValues';
import { CanonicalSerializer } from '../data/CanonicalSerializer';
import { SpatialReasoningEngine, SpatialPoint3D } from '../../../scratch/cubio_neural_lattice/spatial_reasoning_engine';
import { KnowledgeInferenceEngine } from '../../../scratch/cubio_neural_lattice/knowledge_inference_engine';
import { ProceduralVoxelWorldEngine } from '../../../scratch/cubio_neural_lattice/procedural_voxel_world';
import { ProductionInferenceEngine } from '../../core/inference/productionInference';
import { RSSGuard } from '../../core/memory/rssGuard';
import { HarmonicAlignmentTrainer } from '../../core/training/harmonicAlignment';
import { NativeModelRegistry } from '../native_model_registry';
import { NativeMemoryAPI } from '../memory/NativeMemoryAPI';

// ── 1. Reasoning Tool Adapter ────────────────────────────────────────────────

export class ReasoningToolAdapter implements INativeTool {
  public readonly id = 'cubio:reasoning';
  public readonly category: ToolCategory = 'REASONING';
  public readonly version = '1.0.0';
  public readonly description = 'Deduces spatial relations (CONTAINS, INTERSECTS, HARMONIC_ALIGNED_369) and executes theorem proofs';
  public readonly isActuationBlocked = true;

  public execute(params: Record<string, NativeValue>, context: ToolExecutionContext): NativeToolResponse {
    const t0 = performance.now();
    try {
      const mode = params.mode ? String(toRaw(params.mode)) : 'SPATIAL';

      if (mode === 'SPATIAL') {
        const engine = new SpatialReasoningEngine();
        // Register regions from params if provided
        const regionsVal = params.regions ? toRaw(params.regions) : null;
        if (Array.isArray(regionsVal)) {
          for (const reg of regionsVal) {
            engine.registerRegion(reg.id, reg.min, reg.max);
          }
        } else {
          // Default baseline spatial regions
          engine.registerRegion('CoreAlpha', [0, 0, 0], [3, 3, 3]);
          engine.registerRegion('SensorBeta', [1, 1, 1], [2, 2, 2]);
        }

        const deductions = engine.executeDeductiveChain();
        const latency = performance.now() - t0;
        const resultVal = fromRaw(deductions);
        const stateHash = CanonicalSerializer.packEnvelope(deductions).payloadHash;

        return {
          toolId: this.id,
          success: true,
          result: resultVal,
          latencyMs: latency,
          stateHash,
        };
      }

      return {
        toolId: this.id,
        success: false,
        result: createNull(),
        latencyMs: performance.now() - t0,
        stateHash: '0xERROR',
        error: `Unsupported reasoning mode '${mode}'.`,
      };
    } catch (err: any) {
      return {
        toolId: this.id,
        success: false,
        result: createNull(),
        latencyMs: performance.now() - t0,
        stateHash: '0xERROR',
        error: err.message,
      };
    }
  }
}

// ── 2. Simulation Tool Adapter ───────────────────────────────────────────────

export class SimulationToolAdapter implements INativeTool {
  public readonly id = 'cubio:simulation';
  public readonly category: ToolCategory = 'SIMULATION';
  public readonly version = '1.0.0';
  public readonly description = 'Generates deterministic 7x7x7 (343-cell) spatial voxel chunks with pseudo-random noise';
  public readonly isActuationBlocked = true;

  public execute(params: Record<string, NativeValue>, context: ToolExecutionContext): NativeToolResponse {
    const t0 = performance.now();
    try {
      const seed = params.seed ? Number(toRaw(params.seed)) : 369;
      const cx = params.cx ? Number(toRaw(params.cx)) : 0;
      const cy = params.cy ? Number(toRaw(params.cy)) : 0;
      const cz = params.cz ? Number(toRaw(params.cz)) : 0;

      const engine = new ProceduralVoxelWorldEngine(seed);
      const chunk = engine.generateChunk(cx, cy, cz);

      const latency = performance.now() - t0;
      const payload = {
        chunkId: chunk.chunkId,
        chunkCoord: chunk.chunkCoord,
        activeEnergyNodesCount: chunk.activeEnergyNodesCount,
        cellsCount: chunk.cells.length,
        checksum: chunk.checksum,
      };

      const resultVal = fromRaw(payload);
      const stateHash = CanonicalSerializer.packEnvelope(payload).payloadHash;

      return {
        toolId: this.id,
        success: true,
        result: resultVal,
        latencyMs: latency,
        stateHash,
      };
    } catch (err: any) {
      return {
        toolId: this.id,
        success: false,
        result: createNull(),
        latencyMs: performance.now() - t0,
        stateHash: '0xERROR',
        error: err.message,
      };
    }
  }
}

// ── 3. Knowledge Tool Adapter ────────────────────────────────────────────────

export class KnowledgeToolAdapter implements INativeTool {
  public readonly id = 'cubio:knowledge';
  public readonly category: ToolCategory = 'KNOWLEDGE';
  public readonly version = '1.0.0';
  public readonly description = 'Asserts facts, registers rules, and executes deterministic forward-chaining theorem proving';
  public readonly isActuationBlocked = true;

  public execute(params: Record<string, NativeValue>, context: ToolExecutionContext): NativeToolResponse {
    const t0 = performance.now();
    try {
      const engine = new KnowledgeInferenceEngine();
      const factsRaw = params.facts ? toRaw(params.facts) : [];
      if (Array.isArray(factsRaw)) {
        for (const f of factsRaw) {
          engine.assertFact(f.subject, f.predicate, f.object, f.confidence ?? 1.0);
        }
      }

      const rulesRaw = params.rules ? toRaw(params.rules) : [];
      if (Array.isArray(rulesRaw)) {
        for (const r of rulesRaw) {
          engine.registerRule(r);
        }
      }

      const proofSteps = engine.inferNewKnowledge();
      const latency = performance.now() - t0;
      const resultVal = fromRaw(proofSteps);
      const stateHash = CanonicalSerializer.packEnvelope(proofSteps).payloadHash;

      return {
        toolId: this.id,
        success: true,
        result: resultVal,
        latencyMs: latency,
        stateHash,
      };
    } catch (err: any) {
      return {
        toolId: this.id,
        success: false,
        result: createNull(),
        latencyMs: performance.now() - t0,
        stateHash: '0xERROR',
        error: err.message,
      };
    }
  }
}

// ── 4. Multimodal Tool Adapter ───────────────────────────────────────────────

export class MultimodalToolAdapter implements INativeTool {
  public readonly id = 'cubio:multimodal';
  public readonly category: ToolCategory = 'MULTIMODAL';
  public readonly version = '1.0.0';
  public readonly description = 'Executes sub-millisecond INT4 model inference and inspects authoritative model weights';
  public readonly isActuationBlocked = true;

  public execute(params: Record<string, NativeValue>, context: ToolExecutionContext): NativeToolResponse {
    const t0 = performance.now();
    try {
      const promptTokens = params.promptTokenCount ? Number(toRaw(params.promptTokenCount)) : 512;
      const maxOutputTokens = params.maxOutputTokens ? Number(toRaw(params.maxOutputTokens)) : 128;

      const rssGuard = new RSSGuard(512 * 1024 * 1024);
      const engine = new ProductionInferenceEngine(rssGuard);

      const infResult = engine.executeInference({ promptTokenCount: promptTokens, maxOutputTokens });

      const latency = performance.now() - t0;
      const payload = {
        modelId: NativeModelRegistry.AUTHORITATIVE_MODEL_ID,
        paramCount: NativeModelRegistry.AUTHORITATIVE_PARAM_COUNT,
        inferenceLatencyMs: infResult.latencyMs,
        memoryFootprintMB: infResult.memoryFootprintMB,
        outputStatus: infResult.outputStatus,
      };

      const resultVal = fromRaw(payload);
      const stateHash = CanonicalSerializer.packEnvelope(payload).payloadHash;

      return {
        toolId: this.id,
        success: true,
        result: resultVal,
        latencyMs: latency,
        stateHash,
      };
    } catch (err: any) {
      return {
        toolId: this.id,
        success: false,
        result: createNull(),
        latencyMs: performance.now() - t0,
        stateHash: '0xERROR',
        error: err.message,
      };
    }
  }
}

// ── 5. Training Tool Adapter ─────────────────────────────────────────────────

export class TrainingToolAdapter implements INativeTool {
  public readonly id = 'cubio:training';
  public readonly category: ToolCategory = 'TRAINING';
  public readonly version = '1.0.0';
  public readonly description = 'Executes SFT and DPO harmonic alignment passes with beta hyperparameter and 369 spatial bounds';
  public readonly isActuationBlocked = true;

  public execute(params: Record<string, NativeValue>, context: ToolExecutionContext): NativeToolResponse {
    const t0 = performance.now();
    try {
      const method = (params.method ? String(toRaw(params.method)) : 'DPO') as 'SFT' | 'DPO';
      const beta = params.beta ? Number(toRaw(params.beta)) : 0.1;
      const lr = params.learningRate ? Number(toRaw(params.learningRate)) : 0.0001;

      const rssGuard = new RSSGuard(512 * 1024 * 1024);
      const trainer = new HarmonicAlignmentTrainer(rssGuard);

      const trainResult = trainer.optimizeAlignment({ method, betaDPO: beta, learningRate: lr });

      const latency = performance.now() - t0;
      const payload = {
        method,
        status: trainResult.status,
        divergenceMetric: trainResult.divergenceMetric,
        isActuationBlocked: true,
      };

      const resultVal = fromRaw(payload);
      const stateHash = CanonicalSerializer.packEnvelope(payload).payloadHash;

      return {
        toolId: this.id,
        success: true,
        result: resultVal,
        latencyMs: latency,
        stateHash,
      };
    } catch (err: any) {
      return {
        toolId: this.id,
        success: false,
        result: createNull(),
        latencyMs: performance.now() - t0,
        stateHash: '0xERROR',
        error: err.message,
      };
    }
  }
}

// ── 6. Memory Tool Adapter ───────────────────────────────────────────────────

export class MemoryToolAdapter implements INativeTool {
  public readonly id = 'cubio:memory';
  public readonly category: ToolCategory = 'MEMORY';
  public readonly version = '1.0.0';
  public readonly description = 'Dispatches native memory primitives: STORE, LOAD, REFERENCE, UPDATE, CACHE, PAGE, EVICT';
  public readonly isActuationBlocked = true;
  private memoryAPI: NativeMemoryAPI;

  constructor(memoryAPI?: NativeMemoryAPI) {
    this.memoryAPI = memoryAPI ?? new NativeMemoryAPI();
  }

  public execute(params: Record<string, NativeValue>, context: ToolExecutionContext): NativeToolResponse {
    const t0 = performance.now();
    const mem = context.memoryAPI ?? this.memoryAPI;
    const action = params.action ? String(toRaw(params.action)).toUpperCase() : 'LOAD';

    try {
      let resultVal: NativeValue = createNull();

      switch (action) {
        case 'STORE': {
          const id = String(toRaw(params.id ?? createString('key_0')));
          const payload = params.payload ?? createNull();
          const vec = params.vector ? (toRaw(params.vector) as number[]) : [0, 0, 0];
          const addr = params.canonicalAddress ? Number(toRaw(params.canonicalAddress)) : undefined;
          const info = mem.store(id, payload, vec, addr);
          resultVal = fromRaw(info);
          break;
        }

        case 'LOAD': {
          const id = String(toRaw(params.id ?? createString('key_0')));
          const val = mem.load(id);
          resultVal = val ?? createNull();
          break;
        }

        case 'UPDATE': {
          const id = String(toRaw(params.id ?? createString('key_0')));
          const payload = params.payload ?? createNull();
          const expVer = params.expectedVersion ? Number(toRaw(params.expectedVersion)) : undefined;
          const info = mem.update(id, payload, undefined, expVer);
          resultVal = fromRaw(info);
          break;
        }

        case 'CACHE': {
          const key = String(toRaw(params.key ?? createString('cache_0')));
          const val = params.value ?? createNull();
          const pin = params.pin ? Boolean(toRaw(params.pin)) : false;
          const entry = mem.cacheValue(key, val, 128, pin);
          resultVal = fromRaw({ key: entry.key, isPinned: entry.isPinned, sizeBytes: entry.sizeBytes });
          break;
        }

        case 'PAGE': {
          let range: [number, number] = [0, 0];
          if (params.canonicalAddressRange) {
            const rawRange = toRaw(params.canonicalAddressRange);
            if (Array.isArray(rawRange) && rawRange.length >= 2) {
              range = [Number(rawRange[0]), Number(rawRange[1])];
            }
          }
          const pin = params.pin ? Boolean(toRaw(params.pin)) : false;
          const page = mem.allocatePage(range, pin);
          resultVal = fromRaw({ pageId: page.pageId, pageSizeBytes: page.pageSizeBytes, isPinned: page.isPinned });
          break;
        }

        case 'EVICT': {
          const key = params.key ? String(toRaw(params.key)) : undefined;
          const evicted = mem.evict(key);
          resultVal = createBool(evicted);
          break;
        }

        default:
          throw new Error(`[MemoryToolAdapter Error] Unknown memory action '${action}'.`);
      }

      const latency = performance.now() - t0;
      const stateHash = CanonicalSerializer.packEnvelope(toRaw(resultVal)).payloadHash;

      return {
        toolId: this.id,
        success: true,
        result: resultVal,
        latencyMs: latency,
        stateHash,
      };
    } catch (err: any) {
      return {
        toolId: this.id,
        success: false,
        result: createNull(),
        latencyMs: performance.now() - t0,
        stateHash: '0xERROR',
        error: err.message,
      };
    }
  }
}
