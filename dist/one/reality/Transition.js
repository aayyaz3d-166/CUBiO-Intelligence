/**
 * ONE Language — State Transition
 * ================================
 * Module: @one/reality/Transition
 *
 * Implements the TRANSITION primitive representing a directed causal delta
 * from an origin state to a successor state within a worldline.
 */
import * as crypto from 'crypto';
import { toRaw } from '../runtime/NativeValues';
import { CanonicalSerializer } from '../data/CanonicalSerializer';
export class StateTransition {
    transitionId;
    fromStateId;
    toStateId;
    action;
    params;
    cost;
    tick;
    signature;
    constructor(options) {
        this.transitionId = options.transitionId;
        this.fromStateId = options.fromStateId;
        this.toStateId = options.toStateId;
        this.action = options.action;
        this.params = options.params ?? {};
        this.cost = options.cost ?? 1.0;
        this.tick = options.tick;
        this.signature = StateTransition.computeSignature(this.fromStateId, this.toStateId, this.action, this.params, this.tick);
    }
    /**
     * Deterministically computes a cryptographic signature for this transition.
     */
    static computeSignature(fromStateId, toStateId, action, params, tick) {
        const rawParams = {};
        for (const [k, v] of Object.entries(params)) {
            rawParams[k] = toRaw(v);
        }
        const paramsJSON = CanonicalSerializer.serializeCanonicalJSON(rawParams);
        return `0xTRANS_${crypto
            .createHash('sha256')
            .update(fromStateId)
            .update(toStateId)
            .update(action)
            .update(paramsJSON)
            .update(String(tick))
            .digest('hex')
            .substring(0, 16)
            .toUpperCase()}`;
    }
    /**
     * Checks whether this transition connects state A to state B.
     */
    connects(from, to) {
        return this.fromStateId === from && this.toStateId === to;
    }
    /**
     * Estimates memory footprint in bytes.
     */
    estimateMemoryBytes() {
        return 192 + this.action.length + Object.keys(this.params).length * 48;
    }
}
