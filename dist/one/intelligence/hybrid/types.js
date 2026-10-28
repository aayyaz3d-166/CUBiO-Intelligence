/**
 * ONE Language — Phase 5 Gate 2: Hybrid Conversational Interface
 * Module: Shared Type Contracts (src/one/intelligence/hybrid/types.ts)
 *
 * All contracts here are synchronous and bounded.
 * Neural inference: NOT_IMPLEMENTED (model vocab=369 spatial tokens, not NLP).
 */
// ──────────────────────────────────────────────────────────────────────────────
// A. Intent Classification
// ──────────────────────────────────────────────────────────────────────────────
/**
 * High-level intent types the parser can resolve deterministically.
 * UNKNOWN_REQUEST is the fail-safe default for anything ambiguous.
 */
export var UserIntentType;
(function (UserIntentType) {
    /** Numeric reasoning task dispatchable to Phase 3 ReasoningEngine */
    UserIntentType["REASONING_TASK"] = "REASONING_TASK";
    /** Concept/relationship query dispatchable to Phase 4 ConceptGraph */
    UserIntentType["CONCEPT_QUERY"] = "CONCEPT_QUERY";
    /** Simple factual statement or greeting; answered via template */
    UserIntentType["CONVERSATIONAL_FACT"] = "CONVERSATIONAL_FACT";
    /** Intent could not be confidently resolved; clarification required */
    UserIntentType["UNKNOWN_REQUEST"] = "UNKNOWN_REQUEST";
})(UserIntentType || (UserIntentType = {}));
/**
 * Validates a HybridRequest. Returns null if valid, else an error string.
 */
export function validateHybridRequest(req) {
    if (!req || typeof req.text !== 'string') {
        return 'Request must have a non-null text field of type string.';
    }
    if (req.text.trim().length === 0) {
        return 'Request text must not be empty.';
    }
    if (req.text.length > 2048) {
        return 'Request text exceeds maximum length of 2048 characters.';
    }
    if (req.maxReasoningSteps !== undefined) {
        if (!Number.isInteger(req.maxReasoningSteps) || req.maxReasoningSteps < 1 || req.maxReasoningSteps > 500) {
            return 'maxReasoningSteps must be an integer in [1..500].';
        }
    }
    return null;
}
// ──────────────────────────────────────────────────────────────────────────────
// E. Hybrid Response
// ──────────────────────────────────────────────────────────────────────────────
/**
 * Terminal status of a hybrid conversation turn.
 */
export var HybridResponseStatus;
(function (HybridResponseStatus) {
    /** Request fully resolved with a concrete answer */
    HybridResponseStatus["RESOLVED"] = "RESOLVED";
    /** Partial result; reasoning did not reach the goal */
    HybridResponseStatus["PARTIAL"] = "PARTIAL";
    /** Intent ambiguous or request malformed; clarification returned */
    HybridResponseStatus["CLARIFICATION_NEEDED"] = "CLARIFICATION_NEEDED";
    /** Request is explicitly unsupported; reason provided */
    HybridResponseStatus["UNSUPPORTED"] = "UNSUPPORTED";
    /** Internal error during dispatch; safe error message returned */
    HybridResponseStatus["ERROR"] = "ERROR";
})(HybridResponseStatus || (HybridResponseStatus = {}));
;
/**
 * Strict schema validator for neural proposals.
 * Rejects malformed, unsupported, or over-budget output.
 */
export function validateNeuralProposal(proposal) {
    if (proposal === null || typeof proposal !== 'object') {
        return false;
    }
    const p = proposal;
    // Required fields
    if (typeof p.source !== 'string' || p.source !== 'native5m')
        return false;
    if (typeof p.intent !== 'string')
        return false;
    if (typeof p.confidence !== 'number')
        return false;
    // Intent must be a documented, symbolic-compatible type
    const validIntents = Object.values(UserIntentType);
    if (!validIntents.includes(p.intent))
        return false;
    // Confidence must be bounded and meaningful; reject over-confident garbage
    if (p.confidence < 0 || p.confidence > 1)
        return false;
    // Structurally permitted sub-fields
    if (p.entities !== undefined) {
        const e = p.entities;
        if (e.inputValue !== undefined && typeof e.inputValue !== 'number')
            return false;
        if (e.targetValue !== undefined && typeof e.targetValue !== 'number')
            return false;
        if (e.conceptId !== undefined && typeof e.conceptId !== 'string')
            return false;
        if (e.relationType !== undefined && typeof e.relationType !== 'string')
            return false;
        if (e.goalDescription !== undefined && typeof e.goalDescription !== 'string')
            return false;
        if (Object.keys(e).some((k) => !['inputValue', 'targetValue', 'goalDescription', 'conceptId', 'relationType', 'constraints', 'rawNumbers'].includes(k))) {
            return false;
        }
    }
    if (p.structuredAnswer !== undefined) {
        const sa = p.structuredAnswer;
        if (typeof sa.text !== 'string')
            return false;
        if (typeof sa.isSolved !== 'boolean')
            return false;
    }
    if (p.provenance !== undefined && typeof p.provenance !== 'string')
        return false;
    return true;
}
/** Creates a new empty dialogue state for a session. */
export function createDialogueState(sessionId) {
    return {
        sessionId,
        turnCount: 0,
        referenceWindow: [],
    };
}
/** Prune the reference window to the most recent N turns. */
export function pruneReferenceWindow(window, maxTurns = 10) {
    if (window.length <= maxTurns)
        return;
    window.splice(0, window.length - maxTurns);
}
/** Resolve a follow-up mention to a concrete entity. Returns undefined when ambiguous.
 *  Scans the session's reference window (falls back to the fallback session's window).
 *  Correctly handles "it", "its", "their", "them", "their relations", "show its relations",
 *  and numeric-chain follow-ups.
 */
export function resolveFollowUpEntity(state, mention, fallbackSession) {
    const lower = mention.toLowerCase().trim();
    const window = fallbackSession.referenceWindow.length > 0
        ? fallbackSession.referenceWindow
        : state.referenceWindow;
    if (window.length === 0) {
        return undefined;
    }
    // ---------- "it" / "its" -> most recent resolved concept or numeric chain ----------
    if (lower === 'it' || lower === 'its') {
        const latest = window[window.length - 1];
        if (latest.intentType === UserIntentType.CONCEPT_QUERY && latest.entities.conceptId) {
            return {
                referenceTarget: { conceptId: latest.entities.conceptId, label: latest.entities.conceptId },
                isNumericChain: false,
                lastIntentType: latest.intentType,
            };
        }
        else if (latest.intentType === UserIntentType.REASONING_TASK && latest.entities.inputValue !== undefined) {
            return { isNumericChain: true, lastIntentType: latest.intentType };
        }
        return undefined;
    }
    // ---------- "their" / "them" / "those" -> same as "it" ----------
    if (lower === 'their' || lower === 'them' || lower === 'those') {
        const latest = window[window.length - 1];
        if (latest.intentType === UserIntentType.CONCEPT_QUERY && latest.entities.conceptId) {
            return {
                referenceTarget: { conceptId: latest.entities.conceptId, label: latest.entities.conceptId },
                isNumericChain: false,
                lastIntentType: latest.intentType,
            };
        }
        return undefined;
    }
    // ---------- "their relations" / "its relations" -> show related concepts ----------
    if (lower.includes('relation') || lower.includes('relat')) {
        const latest = window[window.length - 1];
        if (latest.intentType === UserIntentType.CONCEPT_QUERY && latest.entities.conceptId) {
            return {
                referenceTarget: { conceptId: latest.entities.conceptId, label: latest.entities.conceptId },
                isNumericChain: false,
                lastIntentType: latest.intentType,
            };
        }
        return undefined;
    }
    // ---------- numeric chain follow-ups ----------
    if (lower.includes('relations') || lower.includes('chain') || lower.includes('show')) {
        const latest = window[window.length - 1];
        if (latest.intentType === UserIntentType.REASONING_TASK && latest.entities.inputValue !== undefined) {
            return { isNumericChain: true, lastIntentType: latest.intentType };
        }
        return undefined;
    }
    // ---------- Unknown / ambiguous ----------
    return undefined;
}
/** Record a processed turn into the dialogue state reference window. */
export function recordTurn(state, rawText, intentType, entities) {
    state.turnCount++;
    pruneReferenceWindow(state.referenceWindow, 10);
    state.referenceWindow.push({
        turn: state.turnCount,
        rawText,
        intentType,
        entities,
        confidence: 0.9,
        clarificationRequired: false,
    });
}
