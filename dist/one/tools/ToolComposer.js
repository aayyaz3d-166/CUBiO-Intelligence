/**
 * ONE Language — Native Tool Composer
 * ====================================
 * Module: @one/tools/ToolComposer
 *
 * Enables sovereign composition of multiple native tools into atomic pipelines.
 * Chains outputs to inputs deterministically while preserving fail-closed invariants.
 */
import { createArray, fromRaw, toRaw } from '../runtime/NativeValues';
import { CanonicalSerializer } from '../data/CanonicalSerializer';
export class ToolComposer {
    /**
     * Executes a sequential pipeline of tools.
     */
    static executeSequential(steps, initialParams, context) {
        const t0 = performance.now();
        const stepResults = [];
        let currentInput = initialParams;
        let lastResult = createArray([]);
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const params = step.parameterMapper ? step.parameterMapper(lastResult) : { ...currentInput, ...(step.staticParams ?? {}) };
            const resp = step.tool.execute(params, context);
            stepResults.push(resp);
            if (!resp.success) {
                return {
                    success: false,
                    totalLatencyMs: performance.now() - t0,
                    stepResults,
                    finalResult: resp.result,
                    pipelineStateHash: '0xPIPELINE_FAILED',
                    failedStepIndex: i,
                    error: `Pipeline failed at step ${i} (${step.tool.id}): ${resp.error}`,
                };
            }
            lastResult = resp.result;
        }
        const totalLatency = performance.now() - t0;
        const hashes = stepResults.map((r) => r.stateHash);
        const pipelineHash = CanonicalSerializer.packEnvelope({ hashes, totalLatency }).payloadHash;
        return {
            success: true,
            totalLatencyMs: totalLatency,
            stepResults,
            finalResult: lastResult,
            pipelineStateHash: pipelineHash,
        };
    }
    /**
     * Executes multiple tools concurrently or in parallel, collecting all results.
     */
    static executeParallel(tools, context) {
        const t0 = performance.now();
        const stepResults = [];
        let allSuccess = true;
        let firstError;
        for (let i = 0; i < tools.length; i++) {
            const { tool, params } = tools[i];
            const resp = tool.execute(params, context);
            stepResults.push(resp);
            if (!resp.success && allSuccess) {
                allSuccess = false;
                firstError = `Parallel execution failed at tool '${tool.id}': ${resp.error}`;
            }
        }
        const totalLatency = performance.now() - t0;
        const finalResult = fromRaw(stepResults.map((r) => toRaw(r.result)));
        const pipelineHash = CanonicalSerializer.packEnvelope(stepResults.map((r) => r.stateHash)).payloadHash;
        return {
            success: allSuccess,
            totalLatencyMs: totalLatency,
            stepResults,
            finalResult,
            pipelineStateHash: pipelineHash,
            error: firstError,
        };
    }
}
