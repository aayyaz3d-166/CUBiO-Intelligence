/**
 * ONE Language — Phase 4: Concept Understanding & Selective Memory Layer
 * Module: Concept & Memory Data Types (src/one/intelligence/memory/types.ts)
 */
/**
 * Relationship Edge between two Concepts
 */
export var SupportedRelationType;
(function (SupportedRelationType) {
    SupportedRelationType["isA"] = "isA";
    SupportedRelationType["hasProperty"] = "hasProperty";
    SupportedRelationType["causes"] = "causes";
    SupportedRelationType["partOf"] = "partOf";
    SupportedRelationType["derivedFrom"] = "derivedFrom";
    SupportedRelationType["conflictsWith"] = "conflictsWith";
})(SupportedRelationType || (SupportedRelationType = {}));
/**
 * Four-Tier Memory Classification
 */
export var MemoryTier;
(function (MemoryTier) {
    /** Temporary working context for current active reasoning task (cleaned up upon task finish) */
    MemoryTier["WORKING"] = "WORKING";
    /** Compact historical record of executed tasks and outcomes */
    MemoryTier["EPISODIC"] = "EPISODIC";
    /** Reusable concept graph, stable facts, and verified generalizations */
    MemoryTier["SEMANTIC"] = "SEMANTIC";
    /** Validated reusable reasoning transformation rules (integrated with RuleRegistry) */
    MemoryTier["PROCEDURAL"] = "PROCEDURAL";
})(MemoryTier || (MemoryTier = {}));
/**
 * Rule Promotion Candidate Status
 */
export var PromotionStatus;
(function (PromotionStatus) {
    PromotionStatus["CANDIDATE"] = "CANDIDATE";
    PromotionStatus["VALIDATED"] = "VALIDATED";
    PromotionStatus["PROMOTED"] = "PROMOTED";
    PromotionStatus["REJECTED"] = "REJECTED";
    PromotionStatus["INVALIDATED"] = "INVALIDATED";
})(PromotionStatus || (PromotionStatus = {}));
