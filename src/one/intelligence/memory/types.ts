/**
 * ONE Language — Phase 4: Concept Understanding & Selective Memory Layer
 * Module: Concept & Memory Data Types (src/one/intelligence/memory/types.ts)
 */

import { ReasoningRule } from '../reasoning/types';

/**
 * Concept Category Classification
 */
export type ConceptType =
  | 'OBJECT'
  | 'PROPERTY'
  | 'CATEGORY'
  | 'RULE'
  | 'EVENT'
  | 'STATE'
  | 'NUMERIC';

/**
 * Provenance of a Concept or Relationship
 */
export type ProvenanceKind =
  | 'USER_PROVIDED'
  | 'DERIVED_REASONING'
  | 'VERIFIED_FACT'
  | 'UNVERIFIED_HYPOTHESIS'
  | 'OBSERVED_EPISODE';

/**
 * Structured Concept Record
 */
export interface ConceptRecord {
  /** Stable unique identifier (e.g. 'concept_car', 'concept_wheels') */
  conceptId: string;
  /** Human-readable label or primary name */
  label: string;
  /** High-level type category */
  type: ConceptType;
  /** Structured attributes / properties */
  attributes: Record<string, unknown>;
  /** Origin provenance */
  source: ProvenanceKind;
  /** Documented confidence score in [0.0..1.0] */
  confidence: number;
  /** Revision version number */
  version: number;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Relationship Edge between two Concepts
 */
export enum SupportedRelationType {
  isA = 'isA',
  hasProperty = 'hasProperty',
  causes = 'causes',
  partOf = 'partOf',
  derivedFrom = 'derivedFrom',
  conflictsWith = 'conflictsWith',
}

/** Relationship Edge between two Concepts */
export interface RelationshipRecord {
  relationshipId: string;
  sourceConceptId: string;
  relationType: SupportedRelationType | string;
  targetConceptId: string;
  provenance: ProvenanceKind;
  confidence: number;
  version: number;
  createdAt: number;
}

/**
 * Four-Tier Memory Classification
 */
export enum MemoryTier {
  /** Temporary working context for current active reasoning task (cleaned up upon task finish) */
  WORKING = 'WORKING',
  /** Compact historical record of executed tasks and outcomes */
  EPISODIC = 'EPISODIC',
  /** Reusable concept graph, stable facts, and verified generalizations */
  SEMANTIC = 'SEMANTIC',
  /** Validated reusable reasoning transformation rules (integrated with RuleRegistry) */
  PROCEDURAL = 'PROCEDURAL',
}

/**
 * Working Memory Context Record
 */
export interface WorkingMemoryEntry<T = unknown> {
  key: string;
  value: T;
  createdAt: number;
  ttlMs?: number;
}

/**
 * Episodic Interaction Record
 */
export interface EpisodicRecord {
  episodeId: string;
  taskGoal: string;
  inputSummary: string;
  rulesApplied: string[];
  isSuccess: boolean;
  outcomeSummary: string;
  stepsUsed: number;
  timestamp: number;
}

/**
 * Rule Promotion Candidate Status
 */
export enum PromotionStatus {
  CANDIDATE = 'CANDIDATE',
  VALIDATED = 'VALIDATED',
  PROMOTED = 'PROMOTED',
  REJECTED = 'REJECTED',
  INVALIDATED = 'INVALIDATED',
}

/**
 * Candidate Rule Entry in Procedural Memory
 */
export interface ProceduralRuleEntry<T = unknown> {
  rule: ReasoningRule<T>;
  status: PromotionStatus;
  validationCount: number;
  counterExampleCount: number;
  utilityScore: number;
  promotedAt?: number;
  lastValidatedAt?: number;
}

/**
 * Memory Importance Signals for Selective Retention
 */
export interface MemoryImportanceSignals {
  /** Frequency of recurrence across independent episodes */
  recurrence: number;
  /** Demonstrated utility in solving tasks */
  utility: number;
  /** Verification confidence score */
  confidence: number;
  /** Age / freshness indicator */
  freshness: number;
}

/**
 * Memory Query Filter
 */
export interface MemoryQuery {
  conceptId?: string;
  relationType?: string;
  minConfidence?: number;
  tier?: MemoryTier;
  maxResults?: number;
}
