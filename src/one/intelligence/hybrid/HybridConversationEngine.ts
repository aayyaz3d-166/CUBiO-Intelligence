/**
 * ONE Language — Phase 5 Gate 2: Hybrid Conversational Interface
 * Module: Bounded Deterministic Conversation Engine
 *         (src/one/intelligence/hybrid/HybridConversationEngine.ts)
 *
 * Dispatch paths:
 *   REASONING_TASK  → Phase 3 ReasoningEngine (numeric, rule-based)
 *   CONCEPT_QUERY   → Phase 4 ConceptGraph (direct + multi-hop)
 *   CONVERSATIONAL_FACT → deterministic template responses
 *   UNKNOWN_REQUEST → explicit clarification response
 *
 * Neural inference: NOT_IMPLEMENTED
 *   Registered model CUBIO-MODEL-STAGE1-V1 has vocab_size=369 spatial tokens.
 *   It is NOT a natural-language model and cannot generate English text.
 *   This gap must be addressed in a future gate with a dedicated NLP model.
 */

import { SelectiveMemory } from '../memory/SelectiveMemory';
import { ReasoningEngine } from '../reasoning/ReasoningEngine';
import { RuleRegistry } from '../reasoning/RuleRegistry';
import { ReasoningInput,
  ReasoningRule,
  ReasoningStatus,
} from '../reasoning/types';
import { Native5MAdapter, Native5MGenerationOptions, Native5MGenerationResult } from './Native5MAdapter';
import { IntentParser } from './IntentParser';
import {
  DerivationStep,
  HybridRequest,
  HybridResponse,
  HybridResponseStatus,
  ParsedUserIntent,
  ReferenceEntity,
  ReferenceTarget,
  ResolvedConcept,
  UserIntentType,
  validateHybridRequest,
  DialogueState,
  createDialogueState,
  resolveFollowUpEntity,
  recordTurn,
  HybridResponse as HybridResponseT,
  NeuralProposal,
  validateNeuralProposal as validateNeuralProposalT,
} from './types';

import { EpisodicRecord } from '../memory/types';

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const DEFAULT_MAX_STEPS = 50;
const DEFAULT_MAX_CANDIDATES = 100;
const DEFAULT_MAX_DEPTH = 10;
const NEURAL_BLOCKED_REASON =
  'Registered model CUBIO-MODEL-STAGE1-V1 uses vocab_size=369 spatial coordinate tokens, ' +
  'not a natural-language vocabulary.';

// ──────────────────────────────────────────────────────────────────────────────
// Built-in numeric reasoning rules (registered once in constructor)
// ──────────────────────────────────────────────────────────────────────────────

function makeDecrementRule(step: number): ReasoningRule<number> {
  return {
    id: `rule_decrement_${step}`,
    description: `Decrement value by ${step}`,
    priority: 10 - step,
    isApplicable(value: number): boolean {
      return typeof value === 'number' && value > 0;
    },
    apply(value: number): number[] {
      return [value - step];
    },
  };
}

function makeIncrementRule(step: number): ReasoningRule<number> {
  return {
    id: `rule_increment_${step}`,
    description: `Increment value by ${step}`,
    priority: 10 - step,
    isApplicable(value: number): boolean {
      return typeof value === 'number' && isFinite(value);
    },
    apply(value: number): number[] {
      return [value + step];
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// HybridConversationEngine
// ──────────────────────────────────────────────────────────────────────────────

export class HybridConversationEngine {
  private readonly parser: IntentParser;
  private readonly numericRegistry: RuleRegistry<number>;
  private readonly numericEngine: ReasoningEngine<number>;
  private readonly decrementEngine: ReasoningEngine<number>;
  private readonly incrementEngine: ReasoningEngine<number>;
  private readonly native5m: Native5MAdapter;
  /** Per-session dialogue state: bounded reference windows for follow-up resolution (GATE 14) */
  private readonly dialogueState: Map<string, DialogueState> = new Map();

  constructor(
    private readonly memory: SelectiveMemory,
    private readonly _genericEngine?: ReasoningEngine<unknown>,
    customCheckpointPathOrAdapter?: string | Native5MAdapter,
  ) {
    this.parser = new IntentParser();

    // Build a dedicated numeric reasoning engine with default arithmetic rules
    this.numericRegistry = new RuleRegistry<number>();
    const decrementRegistry = new RuleRegistry<number>();
    const incrementRegistry = new RuleRegistry<number>();

    const dec1 = makeDecrementRule(1);
    const dec2 = makeDecrementRule(2);
    const dec5 = makeDecrementRule(5);
    const inc1 = makeIncrementRule(1);
    const inc2 = makeIncrementRule(2);
    const inc5 = makeIncrementRule(5);

    this.numericRegistry.register(dec1);
    this.numericRegistry.register(dec2);
    this.numericRegistry.register(dec5);
    this.numericRegistry.register(inc1);
    this.numericRegistry.register(inc2);
    this.numericRegistry.register(inc5);

    decrementRegistry.register(dec1);
    decrementRegistry.register(dec2);
    decrementRegistry.register(dec5);

    incrementRegistry.register(inc1);
    incrementRegistry.register(inc2);
    incrementRegistry.register(inc5);

    this.numericEngine = new ReasoningEngine<number>(this.numericRegistry);
    this.decrementEngine = new ReasoningEngine<number>(decrementRegistry);
    this.incrementEngine = new ReasoningEngine<number>(incrementRegistry);

    // Initialize Native 5M-v2 adapter (isolated, fail-safe)
    if (customCheckpointPathOrAdapter instanceof Native5MAdapter) {
      this.native5m = customCheckpointPathOrAdapter;
    } else if (typeof customCheckpointPathOrAdapter === 'string') {
      this.native5m = new Native5MAdapter(customCheckpointPathOrAdapter);
    } else {
      this.native5m = Native5MAdapter.getInstance();
    }
  }

  /**
   * Safely generate neural completion text, catching any model/GPU exceptions.
   */
  private safeGenerate(prompt: string, options: Native5MGenerationOptions): Native5MGenerationResult {
    try {
      return this.native5m.generate(prompt, options);
    } catch (err: any) {
      return {
        text: '',
        tokenIds: [],
        epistemicStatus: 'UNKNOWN',
        latencyMs: 0,
        isModelOutput: false,
        error: `Inference exception: ${err?.message ?? String(err)}`,
      };
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Process a HybridRequest synchronously and return a bounded HybridResponse.
   * Never throws; all errors are captured in the response.
   */
  public processInput(req: HybridRequest): HybridResponse {
    // 1. Validate request
    const validationError = validateHybridRequest(req);
    if (validationError !== null) {
      return this.makeError(validationError, req.sessionId);
    }

    // 2. Parse intent
    let intent: ParsedUserIntent;
    try {
      intent = this.parser.parse(req.text);
    } catch (err: unknown) {
      return this.makeError(`Intent parsing failed: ${String(err)}`, req.sessionId);
    }

    // N5: If the intent is a follow-up pronoun/reference, resolve it against the
    //     session's dialogue state BEFORE dispatch.  Ambiguous or unknown
    //     references yield a clarification response and never invent a relationship.
    const sessionId = req.sessionId ?? `anon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const sessionState = this.dialogueState.get(sessionId) ?? createDialogueState(sessionId);

    // Detect follow-up mentions in the current turn
    let followUp: ReferenceEntity | undefined;
    const lowerText = req.text.toLowerCase().trim();
    const isPurePronoun = ['it', 'its', 'their', 'them', 'those'].includes(lowerText);
    const isPureRelationFollowUp = ['its relations', 'their relations', 'show its relations', 'show their relations', 'relations'].includes(lowerText);
    const isNumericFollowUp = /^(?:subtract|add|decrease|increase|decrement|increment)\s+(?:by\s+)?\d+/i.test(lowerText) || lowerText === 'chain';

    if (isPurePronoun || isPureRelationFollowUp || isNumericFollowUp || lowerText.includes('chain')) {
      followUp = resolveFollowUpEntity(sessionState, req.text, sessionState);
      if (!followUp && (isPurePronoun || isPureRelationFollowUp)) {
        return {
          status: HybridResponseStatus.CLARIFICATION_NEEDED,
          intentType: UserIntentType.UNKNOWN_REQUEST,
          naturalLanguageText:
            `I could not resolve what "${req.text}" refers to because I do not have a visible numeric chain or concept in this session. Please restate the starting value and target or specify the concept.`,
          isSolved: false,
          isUncertain: true,
          meta: this.makeMeta(sessionId, false),
          episodeLogged: false,
        };
      }
    }

    if (followUp) {
      // Follow-up detected: answer it, do NOT re-parse the text as a new intent.
      const followUpResponse = this.dispatchFollowUp(followUp, req, sessionId, sessionState);
      // Record turn before returning
      recordTurn(sessionState, req.text, followUp.lastIntentType, req.taskHints ?? intent.entities);
      this.dialogueState.set(sessionId, sessionState);
      followUpResponse.meta.sessionId = sessionId;
      followUpResponse.meta.episodeLogged = false;
      followUpResponse.episodeLogged = false;
      return followUpResponse;
    }

    // 3. Dispatch (normal path)
    let response: HybridResponse;
    try {
      switch (intent.intentType) {
        case UserIntentType.REASONING_TASK:
          response = this.dispatchReasoning(intent, req);
          break;
        case UserIntentType.CONCEPT_QUERY:
          response = this.dispatchConceptQuery(intent, req);
          break;
        case UserIntentType.CONVERSATIONAL_FACT:
          response = this.dispatchConversationalFact(intent, req);
          break;
        case UserIntentType.UNKNOWN_REQUEST:
          response = this.dispatchUnknown(intent, req);
          break;
        default:
          response = this.makeError(`Unhandled intent type: ${intent.intentType}`, req.sessionId);
          break;
      }
    } catch (err: unknown) {
      response = this.makeError(`Dispatch error: ${String(err)}`, req.sessionId);
    }

    // Record turn in dialogueState for session reference window
    recordTurn(sessionState, req.text, intent.intentType, req.taskHints ?? intent.entities);
    this.dialogueState.set(sessionId, sessionState);
    if (!response.meta.sessionId) {
      response.meta.sessionId = sessionId;
    }
    return response;
  }

  /** Session-activated: reset all dialogue state for a named session (GATE 14). */
  public resetSession(sessionId: string): void {
    this.dialogueState.delete(sessionId);
  }

  /** Record an episodic entry for a session (delegates to persistent memory). */
  private recordSessionEpisode(sessionId: string | undefined, episode: EpisodicRecord): void {
    if (sessionId) {
      const log = this.dialogueState.get(sessionId)?.episodicLog ?? [];
      log.push(episode);
      this.dialogueState.set(sessionId, { ...this.dialogueState.get(sessionId)!, episodicLog: log });
      this.memory.recordEpisode(episode);
    } else {
      this.memory.recordEpisode(episode);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Dispatch: Follow-Up Resolution (GATE 14)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Resolves a follow-up reference to a concrete entity and returns the answer.
   * Correctly handles "it", "its", "their", "them", "those", "its relations",
   * "their relations", and numeric-chain follow-ups.  Returns a clarification
   * response when the reference is ambiguous or points to no prior turn.
   */
  private dispatchFollowUp(
    followUp: ReferenceEntity,
    req: HybridRequest,
    sessionId: string,
    sessionState: DialogueState,
  ): HybridResponse {
    // Case A: follow-up refers to the numeric reasoning chain (a "chain" that
    //         was already computed in a prior turn).  Re-solve deterministically
    //         using the stored start/target so the same result is reproduced.
    if (followUp.isNumericChain && followUp.lastIntentType === UserIntentType.REASONING_TASK) {
      // Re-create a minimal reasoning request from the stored context.
      // The follow-up only carries the lastIntentType; the actual start/target
      // values were in the prior turn's entities.  Re-derive them from the
      // session reference window's most recent numeric turn.
      const priorTurn = sessionState.referenceWindow[sessionState.referenceWindow.length - 1];
      const priorEntities = priorTurn?.entities ?? {};

      let storedStart: number | undefined;
      let storedTarget: number | undefined;
      let goalDescription: string | undefined;

      // If the prior turn was a REASONING_TASK, the reference window holds the
      // extracted entities.  But the reference window stores only the parsed
      // entities; the prior dispatch carried the actual start/target.  We
      // reconstruct by re-running the same numeric resolution that the parser
      // produced, and treat the follow-up as an answer about that chain.
      if (priorEntities.inputValue !== undefined && priorEntities.targetValue !== undefined) {
        storedStart = priorEntities.inputValue;
        storedTarget = priorEntities.targetValue;
        goalDescription = priorEntities.goalDescription ?? `Reach ${storedTarget} from ${storedStart}`;
      } else {
        // No numeric chain to resolve; this is ambiguous.
        return {
          status: HybridResponseStatus.CLARIFICATION_NEEDED,
          intentType: UserIntentType.UNKNOWN_REQUEST,
          naturalLanguageText:
            'I cannot answer this follow-up because I do not have a visible numeric chain ' +
            'in this session. Please restate the starting value and target.',
          isSolved: false,
          isUncertain: true,
          meta: this.makeMeta(sessionId, false),
          episodeLogged: false,
        };
      }

      const maxSteps = req.maxReasoningSteps ?? DEFAULT_MAX_STEPS;
      const isDecrement = storedStart > storedTarget;
      const isIncrement = storedStart < storedTarget;
      const isAlreadyAtGoal = storedStart === storedTarget;

      if (isAlreadyAtGoal) {
        return {
          status: HybridResponseStatus.RESOLVED,
          intentType: UserIntentType.REASONING_TASK,
          naturalLanguageText: `The chain for "${goalDescription}" is already complete at ${storedStart}. No steps needed.`,
          isSolved: true,
          isUncertain: false,
          derivation: [],
          stepsUsed: 0,
          stopReason: 'Goal already satisfied at input',
          reasoningStatus: ReasoningStatus.SOLVED,
          meta: this.makeMeta(sessionId, false),
          episodeLogged: false,
        };
      }

      const spec: ReasoningInput<number> = {
        input: storedStart,
        goal: (v: number) => {
          if (isDecrement) return v <= storedTarget;
          return v >= storedTarget;
        },
        goalDescription,
        constraints: [
          (v: number) => isDecrement ? (v <= storedStart && v >= storedTarget - 1000) : (v >= storedStart && v <= storedTarget + 1000),
        ],
        maxSteps,
        maxCandidates: DEFAULT_MAX_CANDIDATES,
        maxDepth: DEFAULT_MAX_DEPTH,
      };

      const selectedEngine = isDecrement
        ? this.decrementEngine
        : isIncrement
        ? this.incrementEngine
        : this.numericEngine;

      const result = selectedEngine.solve(spec);

      const derivation: DerivationStep[] = result.rankedCandidates
        .slice(0, 20)
        .map(({ candidate, evaluation }) => ({
          stepIndex: candidate.stepIndex,
          ruleId: candidate.ruleId,
          value: candidate.value,
          derivation: candidate.derivation,
          decision: evaluation.decision,
        }));

      const bestValue = result.bestCandidate?.value;
      const derivationSummary = result.isSolved
        ? `Reached ${bestValue} from ${storedStart} in ${result.metrics.stepsUsed} step(s).`
        : `Best achieved value: ${bestValue ?? 'none'} after ${result.metrics.stepsUsed} step(s). Goal not fully reached.`;

      const nlText = result.isSolved
        ? `✓ Follow-up resolved: ${derivationSummary}`
        : `Partial result: ${derivationSummary} Status: ${result.status}. Reason: ${result.stopReason}.`;

      const episodeLogged = result.metrics.stepsUsed > 0;
      if (episodeLogged) {
        const episode: EpisodicRecord = {
          episodeId: `ep_reasoning_${Date.now()}`,
          taskGoal: goalDescription,
          inputSummary: `follow-up=chain, start=${storedStart}, target=${storedTarget}`,
          rulesApplied: result.rankedCandidates.slice(0, 5).map((r) => r.candidate.ruleId),
          isSuccess: result.isSolved,
          outcomeSummary: derivationSummary,
          stepsUsed: result.metrics.stepsUsed,
          timestamp: Date.now(),
        };
        this.memory.recordEpisode(episode);
      }

      return {
        status: result.isSolved ? HybridResponseStatus.RESOLVED : HybridResponseStatus.PARTIAL,
        intentType: UserIntentType.REASONING_TASK,
        naturalLanguageText: nlText,
        isSolved: result.isSolved,
        isUncertain: !result.isSolved,
        derivation,
        stepsUsed: result.metrics.stepsUsed,
        stopReason: result.stopReason,
        reasoningStatus: result.status,
        meta: this.makeMeta(sessionId, episodeLogged),
        episodeLogged,
      };
    }

    // Case B: follow-up refers to a concept query ("its relations", "their relations").
    //  Show the relations of the previously resolved concept.  We do NOT invent a
    //  relationship — we only report what the Phase 4 graph says exists.
    const followUpLower = followUp.referenceTarget?.conceptId ?? '';
    const priorTurn = sessionState.referenceWindow[sessionState.referenceWindow.length - 1];
    if (followUp.referenceTarget && priorTurn?.intentType === UserIntentType.CONCEPT_QUERY) {
      const priorConceptId = priorTurn.entities.conceptId;
      if (!priorConceptId) {
        return {
          status: HybridResponseStatus.CLARIFICATION_NEEDED,
          intentType: UserIntentType.UNKNOWN_REQUEST,
          naturalLanguageText:
            'I could not identify which concept you are asking about. ' +
            'Please name a specific concept, e.g. "What properties does concept_car have?"',
          isSolved: false,
          isUncertain: true,
          meta: this.makeMeta(sessionId, false),
          episodeLogged: false,
        };
      }

      const graph = this.memory.semanticGraph;
      const sourceConcept = graph.getConcept(priorConceptId);
      if (!sourceConcept) {
        return {
          status: HybridResponseStatus.UNSUPPORTED,
          intentType: UserIntentType.CONCEPT_QUERY,
          naturalLanguageText:
            `I don't have information about the concept "${priorConceptId}". ` +
            `No concept with that identifier exists in the knowledge graph.`,
          isSolved: false,
          isUncertain: false,
          resolvedConcepts: [],
          meta: this.makeMeta(sessionId, false),
          episodeLogged: false,
        };
      }

      const directRels = graph.getDirectRelationships(priorConceptId, followUp.relationType);
      const resolvedConcepts: ResolvedConcept[] = [
        {
          conceptId: sourceConcept.conceptId,
          label: sourceConcept.label,
          confidence: sourceConcept.confidence,
          inferenceDepth: 0,
        },
      ];

      for (const rel of directRels.slice(0, 20)) {
        const targetConcept = graph.getConcept(rel.targetConceptId);
        resolvedConcepts.push({
          conceptId: rel.targetConceptId,
          label: targetConcept?.label ?? rel.targetConceptId,
          relationType: rel.relationType,
          targetConceptId: rel.targetConceptId,
          confidence: rel.confidence,
          inferenceDepth: 1,
        });
      }

      const nlText = [
        `Fact: "${sourceConcept.label}" has the following relations:`,
        ...directRels.map(
          (r) => `  • ${r.relationType} → ${graph.getConcept(r.targetConceptId)?.label ?? r.targetConceptId} (confidence: ${r.confidence.toFixed(2)})`,
        ),
        directRels.length === 0 ? '  (no direct relations found in the knowledge graph)' : '',
      ]
        .filter(Boolean)
        .join('\n');

      return {
        status: HybridResponseStatus.RESOLVED,
        intentType: UserIntentType.CONCEPT_QUERY,
        naturalLanguageText: nlText,
        isSolved: true,
        isUncertain: false,
        resolvedConcepts,
        meta: this.makeMeta(sessionId, false),
        episodeLogged: false,
      };
    }

    // Case C: no prior turn for the reference, or reference is ambiguous.
    return {
      status: HybridResponseStatus.CLARIFICATION_NEEDED,
      intentType: UserIntentType.UNKNOWN_REQUEST,
      naturalLanguageText:
        'I could not resolve this reference. ' +
        'Please restate the reference with enough context, e.g. "the concept_car relationships" or "starting from 10, subtract until 0".',
      isSolved: false,
      isUncertain: true,
      meta: this.makeMeta(sessionId, false),
      episodeLogged: false,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Dispatch: Numeric Reasoning Task
  // ──────────────────────────────────────────────────────────────────────────

  private dispatchReasoning(intent: ParsedUserIntent, req: HybridRequest): HybridResponse {
    const { entities } = intent;

    // Validate entities
    if (entities.inputValue === undefined || entities.targetValue === undefined) {
      return {
        status: HybridResponseStatus.CLARIFICATION_NEEDED,
        intentType: UserIntentType.REASONING_TASK,
        naturalLanguageText:
          `I understood this as a numeric reasoning task ("${entities.goalDescription ?? 'unknown goal'}") ` +
          `but I could not extract both a start value and a target value. ` +
          `Please rephrase, e.g. "starting from 10, subtract until 0".`,
        isSolved: false,
        isUncertain: true,
        meta: this.makeMeta(req.sessionId, false, false, undefined),
        episodeLogged: false,
      };
    }

    const startValue = entities.inputValue;
    const targetValue = entities.targetValue;
    const maxSteps = req.maxReasoningSteps ?? DEFAULT_MAX_STEPS;

    // Determine goal direction
    const isDecrement = startValue > targetValue;
    const isIncrement = startValue < targetValue;
    const isAlreadyAtGoal = startValue === targetValue;

    if (isAlreadyAtGoal) {
      return {
        status: HybridResponseStatus.RESOLVED,
        intentType: UserIntentType.REASONING_TASK,
        naturalLanguageText: `The starting value ${startValue} is already equal to the target ${targetValue}. No steps needed.`,
        isSolved: true,
        isUncertain: false,
        derivation: [],
        stepsUsed: 0,
        stopReason: 'Goal already satisfied at input',
        reasoningStatus: ReasoningStatus.SOLVED,
        meta: this.makeMeta(req.sessionId, false, false, undefined),
        episodeLogged: false,
      };
    }

    const spec: ReasoningInput<number> = {
      input: startValue,
      goal: (v: number) => {
        if (isDecrement) return v <= targetValue;
        return v >= targetValue;
      },
      goalDescription: entities.goalDescription ?? `Reach ${targetValue} from ${startValue}`,
      constraints: [
        // Bounded directional constraint: prune search states diverging away from goal
        (v: number) => isDecrement ? (v <= startValue && v >= targetValue - 1000) : (v >= startValue && v <= targetValue + 1000),
      ],
      maxSteps,
      maxCandidates: DEFAULT_MAX_CANDIDATES,
      maxDepth: DEFAULT_MAX_DEPTH,
    };

    // Goal-directed engine selection: when direction is unambiguous, use the directional engine
    const selectedEngine = isDecrement
      ? this.decrementEngine
      : isIncrement
      ? this.incrementEngine
      : this.numericEngine;

    const result = selectedEngine.solve(spec);

    // Render derivation steps
    const derivation: DerivationStep[] = result.rankedCandidates
      .slice(0, 20)
      .map(({ candidate, evaluation }) => ({
        stepIndex: candidate.stepIndex,
        ruleId: candidate.ruleId,
        value: candidate.value,
        derivation: candidate.derivation,
        decision: evaluation.decision,
      }));

    // Build the best-path chain from the best candidate's derivation
    const bestValue = result.bestCandidate?.value;
    const derivationSummary = result.isSolved
      ? `Reached ${bestValue} from ${startValue} in ${result.metrics.stepsUsed} step(s).`
      : `Best achieved value: ${bestValue ?? 'none'} after ${result.metrics.stepsUsed} step(s). Goal not fully reached.`;

    let nlText = result.isSolved
      ? `✓ Goal reached. ${derivationSummary} (${entities.goalDescription ?? ''}).`
      : `Partial result. ${derivationSummary} ` +
        `Status: ${result.status}. Reason: ${result.stopReason}.`;

    const episodeLogged = result.metrics.stepsUsed > 0;
    if (episodeLogged) {
      const episode: EpisodicRecord = {
        episodeId: `ep_reasoning_${Date.now()}`,
        taskGoal: entities.goalDescription ?? `Reach ${targetValue}`,
        inputSummary: `start=${startValue}, target=${targetValue}`,
        rulesApplied: result.rankedCandidates.slice(0, 5).map((r) => r.candidate.ruleId),
        isSuccess: result.isSolved,
        outcomeSummary: derivationSummary,
        stepsUsed: result.metrics.stepsUsed,
        timestamp: Date.now(),
      };
      // GATE 16 SAFETY GATE:
      // Never record neural output to episodic memory.  Episodic memory records
      // only deterministic symbolic outcomes (derivation steps, rules applied).
      this.memory.recordEpisode(episode);
    }

    // GATE 16 OPT-IN NEURAL PATH:
    // Neural inference is opt-in (enableNeuralInference: true).  It may only
    // embellish the natural-language presentation.  It NEVER writes to
    // long-term memory, NEVER overrides symbolic results, and NEVER replaces
    // the symbolic derivation.  Structured facts remain authoritative.
    let neuralInfo: {
      attempted: boolean;
      proposal: NeuralProposal | undefined;
      proposalValid: boolean;
      modelLatch: string | undefined;
      reason: string | undefined;
    } = {
      attempted: false,
      proposal: undefined,
      proposalValid: false,
      modelLatch: undefined,
      reason: undefined,
    };

    // If neural inference is NOT explicitly enabled, or the model is
    // unavailable, skip neural path entirely (safe fallback).
    if (req.enableNeuralInference === true && this.native5m.isAvailable()) {
      const gen = this.safeGenerate(
        `Reasoning task: start=${startValue}, target=${targetValue}. ` +
        `Derive the chain to reach the target using +1/-1 steps. ` +
        `Return a JSON object with: { text, isSolved, stepsUsed }`,
        {
          maxTokens: 45,
          temperature: 0.1,
          topK: 40,
          repetitionPenalty: 1.2,
        }
      );

      if (gen.isModelOutput && gen.text.length > 0) {
        // Validate model output against the strict schema (GATE 16).
        // Neural text must not directly write to long-term memory or override
        // symbolic results.  The symbolic engine is the authority.
        const prop: unknown = this.deserializeModelJson(gen.text);
        if (this.validateNeuralProposal(prop)) {
          const validated = prop as NeuralProposal;
          neuralInfo = {
            attempted: true,
            proposal: validated,
            proposalValid: true,
            modelLatch: gen.isModelOutput ? gen.text.slice(0, 8) : undefined,
            reason: undefined,
          };
          // Fallback to symbolic result for factual correctness.
          // Neural may only decorate the NL text, never change the facts.
          const symText = result.isSolved
            ? `✓ Goal reached. ${derivationSummary}`
            : `Partial result. ${derivationSummary} Status: ${result.status}. Reason: ${result.stopReason}.`;
          nlText = `${validated.structuredAnswer!.text}  [symbolic: ${symText}]`;
        } else {
          // Malformed output: reject, fall back to pure symbolic path.
          neuralInfo = {
            attempted: true,
            proposal: undefined,
            proposalValid: false,
            modelLatch: gen.text.slice(0, 8),
            reason: 'MALFORMED_OUTPUT',
          };
          nlText = result.isSolved
            ? `✓ Goal reached. ${derivationSummary}`
            : `Partial result. ${derivationSummary} Status: ${result.status}. Reason: ${result.stopReason}.`;
        }
      } else {
        // Model threw or returned empty: safe fallback.
        neuralInfo = {
          attempted: true,
          proposal: undefined,
          proposalValid: false,
          modelLatch: undefined,
          reason: 'MODEL_UNAVAILABLE',
        };
        nlText = result.isSolved
          ? `✓ Goal reached. ${derivationSummary}`
          : `Partial result. ${derivationSummary} Status: ${result.status}. Reason: ${result.stopReason}.`;
      }
    }

    return {
      status: result.isSolved ? HybridResponseStatus.RESOLVED : HybridResponseStatus.PARTIAL,
      intentType: UserIntentType.REASONING_TASK,
      naturalLanguageText: nlText,
      isSolved: result.isSolved,
      isUncertain: !result.isSolved,
      derivation,
      stepsUsed: result.metrics.stepsUsed,
      stopReason: result.stopReason,
      reasoningStatus: result.status,
      meta: this.makeMeta(req.sessionId, episodeLogged, neuralInfo.attempted, neuralInfo.attempted ? (neuralInfo.proposal ? 1 : 0) : undefined),
      episodeLogged,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Dispatch: Concept Query
  // ──────────────────────────────────────────────────────────────────────────

  private dispatchConceptQuery(intent: ParsedUserIntent, req: HybridRequest): HybridResponse {
    const { entities } = intent;
    const conceptId = entities.conceptId;

    if (!conceptId) {
      return {
        status: HybridResponseStatus.CLARIFICATION_NEEDED,
        intentType: UserIntentType.CONCEPT_QUERY,
        naturalLanguageText:
          `I recognized a concept query but could not identify which concept you are asking about. ` +
          `Please name a specific concept (e.g. "What is concept_car?").`,
        isSolved: false,
        isUncertain: true,
        meta: this.makeMeta(req.sessionId, false, false, undefined),
        episodeLogged: false,
      };
    }

    const graph = this.memory.semanticGraph;

    // Check if this is a pairwise relationship query (e.g. "Is X related to Y?")
    const relatedConceptId = (entities as any).relatedConceptId as string | undefined;

    // Direct concept lookup for source concept
    const concept = graph.getConcept(conceptId);
    if (!concept) {
      return {
        status: HybridResponseStatus.UNSUPPORTED,
        intentType: UserIntentType.CONCEPT_QUERY,
        naturalLanguageText:
          `I don't have information about the concept "${conceptId}". ` +
          `No concept with that identifier exists in the knowledge graph.`,
        isSolved: false,
        isUncertain: false,
        resolvedConcepts: [],
        meta: this.makeMeta(req.sessionId, false, false, undefined),
        episodeLogged: false,
      };
    }

    // Pairwise query validation (P1): If target concept specified, verify it exists and check relationship
    if (relatedConceptId) {
      const targetConcept = graph.getConcept(relatedConceptId);
      if (!targetConcept) {
        return {
          status: HybridResponseStatus.UNSUPPORTED,
          intentType: UserIntentType.CONCEPT_QUERY,
          naturalLanguageText:
            `I don't have information about the target concept "${relatedConceptId}". ` +
            `Cannot determine relationship between "${concept.label}" and an unknown concept.`,
          isSolved: false,
          isUncertain: false,
          resolvedConcepts: [],
          meta: this.makeMeta(req.sessionId, false, false, undefined),
          episodeLogged: false,
        };
      }

      // Check direct relationships in either direction
      const directFromSource = graph.getDirectRelationships(conceptId);
      const directRel = directFromSource.find((r) => r.targetConceptId === relatedConceptId);

      const directFromTarget = graph.getDirectRelationships(relatedConceptId);
      const reverseRel = directFromTarget.find((r) => r.targetConceptId === conceptId);

      // Check multi-hop inherited properties from source
      const inheritedProps = graph.inferInheritedProperties(conceptId, 3);
      const inheritedRel = inheritedProps.find((p) => p.propertyConceptId === relatedConceptId);

      const isRelated = !!(directRel || reverseRel || inheritedRel);

      if (isRelated) {
        const resolvedList: ResolvedConcept[] = [
          { conceptId: concept.conceptId, label: concept.label, confidence: concept.confidence, inferenceDepth: 0 },
          { conceptId: targetConcept.conceptId, label: targetConcept.label, confidence: targetConcept.confidence, inferenceDepth: directRel ? 1 : (inheritedRel ? 2 : 1) },
        ];
        const relDescription = directRel
          ? `Direct relationship: ${concept.label} --[${directRel.relationType}]--> ${targetConcept.label}`
          : inheritedRel
          ? `Inferred relationship: ${concept.label} inherited ${targetConcept.label} via ${inheritedRel.viaRelation}`
          : `Connected relationship: ${targetConcept.label} --[${reverseRel!.relationType}]--> ${concept.label}`;

        return {
          status: HybridResponseStatus.RESOLVED,
          intentType: UserIntentType.CONCEPT_QUERY,
          naturalLanguageText: `Yes, "${concept.label}" is related to "${targetConcept.label}".\n${relDescription}.`,
          isSolved: true,
          isUncertain: false,
          resolvedConcepts: resolvedList,
          meta: this.makeMeta(req.sessionId, false, false, undefined),
          episodeLogged: false,
        };
      } else {
        return {
          status: HybridResponseStatus.RESOLVED,
          intentType: UserIntentType.CONCEPT_QUERY,
          naturalLanguageText: `No known relationship found between "${concept.label}" and "${targetConcept.label}" in the current knowledge graph.`,
          isSolved: true,
          isUncertain: false,
          resolvedConcepts: [],
          meta: this.makeMeta(req.sessionId, false, false, undefined),
          episodeLogged: false,
        };
      }
    }

    const resolvedConcepts: ResolvedConcept[] = [
      {
        conceptId: concept.conceptId,
        label: concept.label,
        confidence: concept.confidence,
        inferenceDepth: 0,
      },
    ];

    // Direct relationships
    const directRels = graph.getDirectRelationships(conceptId, entities.relationType);
    for (const rel of directRels.slice(0, 20)) {
      const targetConcept = graph.getConcept(rel.targetConceptId);
      resolvedConcepts.push({
        conceptId: rel.targetConceptId,
        label: targetConcept?.label ?? rel.targetConceptId,
        relationType: rel.relationType,
        targetConceptId: rel.targetConceptId,
        confidence: rel.confidence,
        inferenceDepth: 1,
      });
    }

    // Multi-hop inherited properties (depth ≤ 3)
    const inherited = graph.inferInheritedProperties(conceptId, 3);
    for (const inh of inherited.slice(0, 15)) {
      const exists = resolvedConcepts.some((r) => r.conceptId === inh.propertyConceptId && r.inferenceDepth > 0);
      if (!exists) {
        const propConcept = graph.getConcept(inh.propertyConceptId);
        resolvedConcepts.push({
          conceptId: inh.propertyConceptId,
          label: propConcept?.label ?? inh.propertyConceptId,
          relationType: `inherited:${inh.viaRelation}`,
          confidence: inh.confidence,
          inferenceDepth: inh.derivation.split('->').length - 1,
        });
      }
    }

    // Build natural-language summary
    const directLines = directRels.map(
      (r) => `  • ${r.relationType} → ${graph.getConcept(r.targetConceptId)?.label ?? r.targetConceptId} (confidence: ${r.confidence.toFixed(2)})`,
    );
    const inheritedLines = resolvedConcepts
      .filter((r) => r.inferenceDepth > 1)
      .slice(0, 5)
      .map((r) => `  • ${r.relationType} → ${r.label} (inferred, depth ${r.inferenceDepth}, confidence: ${r.confidence.toFixed(2)})`);

    let nlText = [
      `Concept: "${concept.label}" (${concept.type}, confidence: ${concept.confidence.toFixed(2)})`,
      directLines.length > 0 ? `Direct relationships:\n${directLines.join('\n')}` : 'No direct relationships found.',
      inheritedLines.length > 0 ? `Inherited properties:\n${inheritedLines.join('\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    // GATE 16 OPT-IN NEURAL PATH (concept queries):
    // Neural inference is opt-in only.  It may only decorate the natural-language
    // presentation.  It NEVER writes to long-term memory, NEVER overrides the
    // symbolic graph result, and NEVER replaces the resolved concepts.
    if (req.enableNeuralInference === true && this.native5m.isAvailable()) {
      const gen = this.safeGenerate(
        `Concept query: conceptId=${conceptId}, relationType=${entities.relationType ?? 'all'}. ` +
        `Return a JSON object with: { text, resolvedConcepts, isSolved }`,
        {
          maxTokens: 45,
          temperature: 0.1,
          topK: 40,
          repetitionPenalty: 1.2,
        }
      );

      if (gen.isModelOutput && gen.text.length > 0) {
        const prop: unknown = this.deserializeModelJson(gen.text);
        if (this.validateNeuralProposal(prop)) {
          const validated = prop as NeuralProposal;
          nlText = `${validated.structuredAnswer!.text}  [graph: ${nlText}]`;
        } else {
          // Malformed: reject, fall back to pure symbolic path.
          nlText = `Graph: ${nlText}`;
        }
      }
    }

    return {
      status: HybridResponseStatus.RESOLVED,
      intentType: UserIntentType.CONCEPT_QUERY,
      naturalLanguageText: nlText,
      isSolved: true,
      isUncertain: false,
      resolvedConcepts,
      meta: this.makeMeta(req.sessionId, false, false, undefined),
      episodeLogged: false,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Dispatch: Conversational Fact / Greeting
  // ──────────────────────────────────────────────────────────────────────────

  private dispatchConversationalFact(intent: ParsedUserIntent, req: HybridRequest): HybridResponse {
    let nlText: string;
    let neuralInferenceMs: number | undefined;
    let neuralUsed = false;

    // Use Native 5M model for fluent natural language if explicitly enabled and model available
    const useNeural = req.enableNeuralInference === true;
    if (useNeural && this.native5m.isAvailable()) {
      const gen = this.safeGenerate(intent.rawText, {
        maxTokens: 35,
        temperature: 0.1,
        repetitionPenalty: 1.2,
      });

      if (gen.isModelOutput && gen.text.length > 0) {
        nlText = gen.text;
        neuralInferenceMs = gen.latencyMs;
        neuralUsed = true;
      } else {
        nlText = this.fallbackConversationalText(intent.rawText);
      }
    } else {
      nlText = this.fallbackConversationalText(intent.rawText);
    }

    return {
      status: HybridResponseStatus.RESOLVED,
      intentType: UserIntentType.CONVERSATIONAL_FACT,
      naturalLanguageText: nlText,
      isSolved: true,
      isUncertain: false,
      meta: this.makeMeta(req.sessionId, false, neuralUsed, neuralInferenceMs),
      episodeLogged: false,
    };
  }

  private fallbackConversationalText(rawText: string): string {
    const text = rawText.toLowerCase();
    if (/^(?:hi|hello|hey|greetings|good\s+(?:morning|afternoon|evening|day))/i.test(text)) {
      return 'Hello! I am ONE Language Hybrid Intelligence Engine. I can reason over numbers and query the concept graph. How can I help?';
    } else if (/thanks?|thank\s+you/i.test(text)) {
      return 'You\'re welcome!';
    } else if (/bye|goodbye|see\s+you/i.test(text)) {
      return 'Goodbye!';
    } else if (/how\s+are\s+you|what['']s\s+up|wassup/i.test(text)) {
      return 'I am an inference engine — stateless between sessions but ready to reason!';
    } else if (/^(?:ok|okay|got\s+it|understood|sure)/i.test(text)) {
      return 'Understood!';
    }
    return 'Noted. If you have a reasoning task or concept query, I\'m ready.';
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Dispatch: Unknown / Clarification
  // ──────────────────────────────────────────────────────────────────────────

  private dispatchUnknown(intent: ParsedUserIntent, req: HybridRequest): HybridResponse {
    const { entities } = intent;
    let hint = '';
    if (entities.rawNumbers && entities.rawNumbers.length >= 2) {
      hint = ` (I found numbers ${entities.rawNumbers.slice(0, 3).join(', ')} in your message — did you mean a counting or arithmetic task?)`;
    }

    const defaultClarification =
      `I could not determine what you are asking${hint}. ` +
      `Supported requests:\n` +
      `  • Numeric reasoning: "starting from 10, subtract until 0"\n` +
      `  • Concept queries: "What properties does concept_car have?"\n` +
      `  • Greetings and simple questions\n` +
      `Please rephrase your request.`;

    let nlText = defaultClarification;
    let neuralUsed = false;
    let neuralInferenceMs: number | undefined;

    // P3: Optional neural rephrasing of clarification when explicitly requested
    const useNeural = req.enableNeuralInference === true;
    if (useNeural && this.native5m.isAvailable()) {
      const prompt = `Please clarify how I can assist with reasoning or concept queries: "${intent.rawText.slice(0, 100)}"`;
      const gen = this.safeGenerate(prompt, {
        maxTokens: 35,
        temperature: 0.1,
        repetitionPenalty: 1.2,
      });

      if (gen.isModelOutput && gen.text.length > 5) {
        // Safe bounded presentation: combine conversational neural intro with strict capabilities
        nlText = `${gen.text}\n\n${defaultClarification}`;
        neuralUsed = true;
        neuralInferenceMs = gen.latencyMs;
      }
    }

    return {
      status: HybridResponseStatus.CLARIFICATION_NEEDED,
      intentType: UserIntentType.UNKNOWN_REQUEST,
      naturalLanguageText: nlText,
      isSolved: false,
      isUncertain: true,
      meta: this.makeMeta(req.sessionId, false, neuralUsed, neuralInferenceMs),
      episodeLogged: false,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Error response factory
  // ──────────────────────────────────────────────────────────────────────────

  private makeError(message: string, sessionId?: string): HybridResponse {
    return {
      status: HybridResponseStatus.ERROR,
      intentType: UserIntentType.UNKNOWN_REQUEST,
      naturalLanguageText: `[Error] ${message}`,
      isSolved: false,
      isUncertain: false,
      meta: this.makeMeta(sessionId, false),
      episodeLogged: false,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Meta block factory
  // ──────────────────────────────────────────────────────────────────────────

  private makeMeta(
    sessionId: string | undefined,
    episodeLogged: boolean,
    neuralUsed: boolean = false,
    neuralInferenceMs?: number
  ): HybridResponse['meta'] {
    if (neuralUsed) {
      return {
        timestamp: new Date().toISOString(),
        neuralInference: 'VERIFIED',
        neuralModelId: 'CUBIO-NATIVE-MODEL-V1-4.89M',
        neuralInferenceBlockedReason: 'Neural generation active via Native 5M-v2 (CUBIO-NATIVE-MODEL-V1)',
        neuralInferenceMs,
        sessionId,
        episodeLogged,
      };
    }

    const blockedReason = NEURAL_BLOCKED_REASON;

    return {
      timestamp: new Date().toISOString(),
      neuralInference: 'NOT_IMPLEMENTED',
      neuralInferenceBlockedReason: blockedReason,
      sessionId,
      episodeLogged,
    };
  }

  /**
   * Safely deserialize JSON string emitted by the neural model.
   * Returns parsed object or null if malformed or non-JSON.
   */
  private deserializeModelJson(text: string): unknown {
    try {
      const trimmed = text.trim();
      const firstBrace = trimmed.indexOf('{');
      const lastBrace = trimmed.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      }
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  /**
   * Delegates to the strict schema validator imported from ./types.
   */
  private validateNeuralProposal(proposal: unknown): proposal is NeuralProposal {
    return validateNeuralProposalT(proposal);
  }
}
