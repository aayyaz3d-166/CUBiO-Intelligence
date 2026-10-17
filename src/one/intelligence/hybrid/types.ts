/**
 * ONE Language — Phase 5 Gate 2: Hybrid Conversational Interface
 * Module: Shared Type Contracts (src/one/intelligence/hybrid/types.ts)
 *
 * All contracts here are synchronous and bounded.
 * Neural inference: NOT_IMPLEMENTED (model vocab=369 spatial tokens, not NLP).
 */

import { ReasoningStatus } from '../reasoning/types';
import { EpisodicRecord } from '../memory/types';

// ──────────────────────────────────────────────────────────────────────────────
// A. Intent Classification
// ──────────────────────────────────────────────────────────────────────────────

/**
 * High-level intent types the parser can resolve deterministically.
 * UNKNOWN_REQUEST is the fail-safe default for anything ambiguous.
 */
export enum UserIntentType {
  /** Numeric reasoning task dispatchable to Phase 3 ReasoningEngine */
  REASONING_TASK = 'REASONING_TASK',
  /** Concept/relationship query dispatchable to Phase 4 ConceptGraph */
  CONCEPT_QUERY = 'CONCEPT_QUERY',
  /** Simple factual statement or greeting; answered via template */
  CONVERSATIONAL_FACT = 'CONVERSATIONAL_FACT',
  /** Intent could not be confidently resolved; clarification required */
  UNKNOWN_REQUEST = 'UNKNOWN_REQUEST',
}

// ──────────────────────────────────────────────────────────────────────────────
// B. Extracted Entity Payload
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Entities extracted from user text by the deterministic IntentParser.
 * All fields are optional — only populated when reliably parseable.
 */
export interface ExtractedEntities {
  /** Numeric start value for reasoning tasks */
  inputValue?: number;
  /** Numeric target / threshold for reasoning goal */
  targetValue?: number;
  /** Human-readable description of the reasoning goal */
  goalDescription?: string;
  /** Concept identifier for concept-graph queries */
  conceptId?: string;
  /** Relationship type filter for concept queries */
  relationType?: string;
  /** Additional named constraints (e.g. { max: 100 }) */
  constraints?: Record<string, number>;
  /** Raw matched numeric tokens from text (diagnostic) */
  rawNumbers?: number[];
}

// ──────────────────────────────────────────────────────────────────────────────
// C. Parsed Intent
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Output of IntentParser.parse().
 * confidence is in [0.0..1.0]; values < 0.5 should trigger clarification.
 */
export interface ParsedUserIntent {
  intentType: UserIntentType;
  entities: ExtractedEntities;
  /** Original user text, preserved verbatim for audit */
  rawText: string;
  /** Parser confidence in the resolved intent [0.0..1.0] */
  confidence: number;
  /** When true, engine must return a clarification response */
  clarificationRequired: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// D. Hybrid Request & Validation
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Inbound request to the HybridConversationEngine.
 * Callers may optionally pass structured task hints; free-text is always allowed.
 */
export interface HybridRequest {
  /** Natural-language or structured text from the user */
  text: string;
  /** Optional session identifier for working-memory scoping */
  sessionId?: string;
  /** Optional caller-provided task hints (pre-parsed entities override parser) */
  taskHints?: Partial<ExtractedEntities>;
  /** Hard cap on reasoning steps for this request (default: 50) */
  maxReasoningSteps?: number;
  /** Explicitly toggle neural generation (default: false to preserve Gate 2 baseline unless requested) */
  enableNeuralInference?: boolean;
}

/**
 * Validates a HybridRequest. Returns null if valid, else an error string.
 */
export function validateHybridRequest(req: HybridRequest): string | null {
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
export enum HybridResponseStatus {
  /** Request fully resolved with a concrete answer */
  RESOLVED = 'RESOLVED',
  /** Partial result; reasoning did not reach the goal */
  PARTIAL = 'PARTIAL',
  /** Intent ambiguous or request malformed; clarification returned */
  CLARIFICATION_NEEDED = 'CLARIFICATION_NEEDED',
  /** Request is explicitly unsupported; reason provided */
  UNSUPPORTED = 'UNSUPPORTED',
  /** Internal error during dispatch; safe error message returned */
  ERROR = 'ERROR',
}

/**
 * Derivation step surfaced in the response for a REASONING_TASK.
 */
export interface DerivationStep {
  stepIndex: number;
  ruleId: string;
  value: unknown;
  derivation: string;
  decision: string;
}

/**
 * Resolved concept fact surfaced in the response for a CONCEPT_QUERY.
 */
export interface ResolvedConcept {
  conceptId: string;
  label: string;
  relationType?: string;
  targetConceptId?: string;
  confidence: number;
  inferenceDepth: number;
}

/**
 * Outbound response from the HybridConversationEngine.
 */
export interface HybridResponse {
  /** Terminal status of this response */
  status: HybridResponseStatus;
  /** Resolved intent type (mirrors ParsedUserIntent.intentType) */
  intentType: UserIntentType;
  /** Human-readable natural-language answer */
  naturalLanguageText: string;
  /** Whether the goal was fully satisfied */
  isSolved: boolean;
  /** Whether the answer is uncertain (requires user verification) */
  isUncertain: boolean;
  /** Derivation trace for REASONING_TASK responses */
  derivation?: DerivationStep[];
  /** Steps consumed by reasoning engine */
  stepsUsed?: number;
  /** Stopping reason from engine */
  stopReason?: string;
  /** Reasoning engine status enum value */
  reasoningStatus?: ReasoningStatus;
  /** Concept facts resolved for CONCEPT_QUERY responses */
  resolvedConcepts?: ResolvedConcept[];
  /** Metadata block: always present, used for auditing */
  meta: {
    /** ISO timestamp of response */
    timestamp: string;
    /** Neural inference status */
    neuralInference: 'VERIFIED' | 'FALLBACK_REGEX' | 'NOT_IMPLEMENTED';
    /** Reason neural path is unavailable or note on verified model */
    neuralInferenceBlockedReason: string;
    /** Verified model identifier when neural inference is used */
    neuralModelId?: string;
    /** Neural generation latency in milliseconds */
    neuralInferenceMs?: number;
    /** Session identifier echoed from request */
    sessionId?: string;
    /** Whether this turn was recorded in episodic memory */
    episodeLogged: boolean;
  };  /** Whether this turn was recorded in episodic memory */
  episodeLogged: boolean;
};

// ──────────────────────────────────────────────────────────────────────────────
// G. Neural Inference Opt-In Contracts (GATE 16)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Strict JSON schema that the neural model's proposal must satisfy before it
 * can be admitted into the symbolic pipeline.  The schema is intentionally
 * narrow and closed: the model may only propose wording or structured intent,
 * never write to long-term memory or override symbolic results.
 */
export interface NeuralProposal {
  /** Arbitrary-but-constraining label surfaced to the symbolic engine */
  source: 'native5m';
  /** Unified intent that the symbolic engine will resolve */
  intent: UserIntentType;
  /** Extracted entities (mirrors ExtractedEntities; optional fields allowed) */
  entities?: Partial<ExtractedEntities>;
  /** Structured answer in a deterministic, machine-readable form */
  structuredAnswer?: {
    text: string;
    isSolved: boolean;
  };
  /** Provenance token so errors can be traced back to the model run */
  provenance?: string;
  /** Model-emitted confidence, clamped to a bounded range for safety */
  confidence: number;
}

/**
 * Strict schema validator for neural proposals.
 * Rejects malformed, unsupported, or over-budget output.
 */
export function validateNeuralProposal(proposal: unknown): proposal is NeuralProposal {
  if (proposal === null || typeof proposal !== 'object') {
    return false;
  }
  const p = proposal as Record<string, unknown>;

  // Required fields
  if (typeof p.source !== 'string' || p.source !== 'native5m') return false;
  if (typeof p.intent !== 'string') return false;
  if (typeof p.confidence !== 'number') return false;

  // Intent must be a documented, symbolic-compatible type
  const validIntents = Object.values(UserIntentType);
  if (!validIntents.includes(p.intent as UserIntentType)) return false;

  // Confidence must be bounded and meaningful; reject over-confident garbage
  if (p.confidence < 0 || p.confidence > 1) return false;

  // Structurally permitted sub-fields
  if (p.entities !== undefined) {
    const e = p.entities as Record<string, unknown>;
    if (e.inputValue !== undefined && typeof e.inputValue !== 'number') return false;
    if (e.targetValue !== undefined && typeof e.targetValue !== 'number') return false;
    if (e.conceptId !== undefined && typeof e.conceptId !== 'string') return false;
    if (e.relationType !== undefined && typeof e.relationType !== 'string') return false;
    if (e.goalDescription !== undefined && typeof e.goalDescription !== 'string') return false;
    if (Object.keys(e).some((k) => !['inputValue', 'targetValue', 'goalDescription', 'conceptId', 'relationType', 'constraints', 'rawNumbers'].includes(k))) {
      return false;
    }
  }

  if (p.structuredAnswer !== undefined) {
    const sa = p.structuredAnswer as Record<string, unknown>;
    if (typeof sa.text !== 'string') return false;
    if (typeof sa.isSolved !== 'boolean') return false;
  }

  if (p.provenance !== undefined && typeof p.provenance !== 'string') return false;

  return true;
}



// ──────────────────────────────────────────────────────────────────────────────
// F. Dialogue State for Session-Scoped Follow-Ups (GATE 14)
// ──────────────────────────────────────────────────────────────────────────────

/** A resolved concept in a CONCEPT_QUERY response. */
export interface ReferenceTarget {
  conceptId: string;
  label: string;
}

/** Entity used to resolve a follow-up mention. */
export interface ReferenceEntity {
  referenceTarget?: ReferenceTarget;
  relationType?: string;
  /** If true, the follow-up refers to a numeric reasoning chain (most recent REASONING_TASK) */
  isNumericChain: boolean;
  /** Last intent type resolved in the session */
  lastIntentType: UserIntentType;
}

/** Per-session dialogue state: the cross-request context the engine keeps in memory.
 *  Deliberately bounded: working memory is cleared on session reset or TTL expiry;
 *  implicit reference resolution only uses the most recent turns of a session.
 */
export interface DialogueState {
  /** Stable session identifier */
  sessionId: string;
  /** Turn-count for this session (bounded: reference window keeps the last 10 turns) */
  turnCount: number;
  /** Reference window: most recent parsed turns, used for pronoun resolution */
  referenceWindow: Array<{
    turn: number;
    rawText: string;
    intentType: UserIntentType;
    entities: ExtractedEntities;
    confidence: number;
    clarificationRequired: boolean;
  }>;
  /** Episodic log scoped to this session (delegates to SelectiveMemory) */
  episodicLog?: EpisodicRecord[];
}

/** Creates a new empty dialogue state for a session. */
export function createDialogueState(sessionId: string): DialogueState {
  return {
    sessionId,
    turnCount: 0,
    referenceWindow: [],
  };
}

/** Prune the reference window to the most recent N turns. */
export function pruneReferenceWindow(
  window: DialogueState['referenceWindow'],
  maxTurns: number = 10,
): void {
  if (window.length <= maxTurns) return;
  window.splice(0, window.length - maxTurns);
}

/** Resolve a follow-up mention to a concrete entity. Returns undefined when ambiguous.
 *  Scans the session's reference window (falls back to the fallback session's window).
 *  Correctly handles "it", "its", "their", "them", "their relations", "show its relations",
 *  and numeric-chain follow-ups.
 */
export function resolveFollowUpEntity(
  state: DialogueState,
  mention: string,
  fallbackSession: DialogueState,
): ReferenceEntity | undefined {
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
    } else if (latest.intentType === UserIntentType.REASONING_TASK && latest.entities.inputValue !== undefined) {
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
export function recordTurn(
  state: DialogueState,
  rawText: string,
  intentType: UserIntentType,
  entities: ExtractedEntities,
): void {
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

