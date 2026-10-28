/**
 * ONE Language — Phase 3: 0/1 Reasoning Intelligence Engine
 * Module: Reasoning Types & Data Structures (src/one/intelligence/reasoning/types.ts)
 */
/**
 * Categorical Decision Outcome
 */
export var DecisionOutcome;
(function (DecisionOutcome) {
    DecisionOutcome["ACCEPT"] = "ACCEPT";
    DecisionOutcome["REJECT"] = "REJECT";
    DecisionOutcome["DEFER"] = "DEFER";
})(DecisionOutcome || (DecisionOutcome = {}));
/**
 * High-Level Status of the Reasoning Result
 */
export var ReasoningStatus;
(function (ReasoningStatus) {
    ReasoningStatus["SOLVED"] = "SOLVED";
    ReasoningStatus["PARTIAL"] = "PARTIAL";
    ReasoningStatus["EXHAUSTED"] = "EXHAUSTED";
    ReasoningStatus["STEP_LIMIT"] = "STEP_LIMIT";
    ReasoningStatus["CANDIDATE_LIMIT"] = "CANDIDATE_LIMIT";
    ReasoningStatus["DEPTH_LIMIT"] = "DEPTH_LIMIT";
    ReasoningStatus["CANCELLED"] = "CANCELLED";
    ReasoningStatus["INVALID_INPUT"] = "INVALID_INPUT";
    ReasoningStatus["ERROR"] = "ERROR";
})(ReasoningStatus || (ReasoningStatus = {}));
/**
 * Reasoning Policy Strategy
 */
export var ReasoningPolicy;
(function (ReasoningPolicy) {
    ReasoningPolicy["BREADTH_FIRST"] = "BREADTH_FIRST";
    ReasoningPolicy["DEPTH_FIRST"] = "DEPTH_FIRST";
    ReasoningPolicy["GREEDY_BEST_FIRST"] = "GREEDY_BEST_FIRST";
})(ReasoningPolicy || (ReasoningPolicy = {}));
