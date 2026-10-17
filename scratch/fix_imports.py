import sys

p = 'src/one/intelligence/hybrid/HybridConversationEngine.ts'
s = open(p).read()

# Fix 1: Remove duplicate EpisodicRecord from ./types import and add to ../memory/types
old_imports = """import {
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
  EpisodicRecord,
} from './types';

// ──────────────────────────────────────────────────────────────────────────────
// Constants"""
new_imports = """import {
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
} from './types';

import { EpisodicRecord } from '../memory/types';

// ──────────────────────────────────────────────────────────────────────────────
// Constants"""
if old_imports in s:
    s = s.replace(old_imports, new_imports)
    print("Fix 1 applied")
else:
    print("Fix 1 FAILED - old_imports not found")
    sys.exit(1)

# Fix 2: add dispatchFollowUp method after recordSessionEpisode
anchor = """  // ──────────────────────────────────────────────────────────────────────────
  // Dispatch: Numeric Reasoning Task
  // ──────────────────────────────────────────────────────────────────────────"""
new_method = """  // ──────────────────────────────────────────────────────────────────────────
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
      };
    }

    // Case B: follow-up refers to a concept query ("its relations", "their relations").
    //  Show the relations of the previously resolved concept.  We do NOT invent a
    //  relationship — we only report what the Phase 4 graph says exists.
    const followUpLower = followUp.referenceTarget?.conceptId ?? '';
    const conceptId = followUpLower || (followUp.referenceTarget?.conceptId);

    // If the follow-up means "its relations", it refers to the most recent concept query.
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
        };
      }

      const directRels = graph.getDirectRelationships(priorConceptId, followUp.referenceTarget?.relationType);
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
        .join('\\n');

      return {
        status: HybridResponseStatus.RESOLVED,
        intentType: UserIntentType.CONCEPT_QUERY,
        naturalLanguageText: nlText,
        isSolved: true,
        isUncertain: false,
        resolvedConcepts,
        meta: this.makeMeta(sessionId, false),
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
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Dispatch: Numeric Reasoning Task
  // ──────────────────────────────────────────────────────────────────────────"""
if anchor in s:
    s = s.replace(anchor, new_method, 1)
    print("Fix 2 applied")
else:
    print("Fix 2 FAILED - anchor not found")
    sys.exit(1)

open(p, 'w').write(s)
print("WRITTEN")
