/**
 * ONE Language — Phase 5 Gate 2: Hybrid Conversational Interface
 * Module: Deterministic Intent Parser (src/one/intelligence/hybrid/IntentParser.ts)
 *
 * Purely rule-based, regex-driven parser. Zero model inference.
 * All paths are O(1) string operations; no external I/O.
 */
import { UserIntentType, } from './types';
// ──────────────────────────────────────────────────────────────────────────────
// Internal pattern tables (compiled once at module load)
// ──────────────────────────────────────────────────────────────────────────────
const REASONING_PATTERNS = [
    {
        re: /find\s+(?:all\s+)?numbers?\s+(?:smaller|less)\s+than\s+(\d+(?:\.\d+)?)/i,
        goalDescription: 'Find numbers smaller than threshold',
        extractGoalValue: (m) => ({ input: parseFloat(m[1]) + 10, target: parseFloat(m[1]) }),
    },
    {
        re: /find\s+(?:all\s+)?numbers?\s+(?:greater|larger|more)\s+than\s+(\d+(?:\.\d+)?)/i,
        goalDescription: 'Find numbers greater than threshold',
        extractGoalValue: (m) => ({ input: parseFloat(m[1]) - 10, target: parseFloat(m[1]) }),
    },
    {
        re: /subtract\s+(?:until|to|down\s+to)\s+(\d+(?:\.\d+)?)\s+(?:from|starting\s+(?:from|at))?\s*(\d+(?:\.\d+)?)/i,
        goalDescription: 'Subtract until target reached',
        extractGoalValue: (m) => ({ input: parseFloat(m[2]), target: parseFloat(m[1]) }),
    },
    {
        re: /(?:starting\s+(?:from|at)\s+)?(\d+(?:\.\d+)?)\s*,?\s*subtract\s+until\s+(\d+(?:\.\d+)?)/i,
        goalDescription: 'Subtract from start until target',
        extractGoalValue: (m) => ({ input: parseFloat(m[1]), target: parseFloat(m[2]) }),
    },
    {
        re: /(?:count\s+(?:down|backwards?)\s+from\s+)?(\d+(?:\.\d+)?)\s+(?:down\s+)?to\s+(\d+(?:\.\d+)?)/i,
        goalDescription: 'Count down from start to target',
        extractGoalValue: (m) => ({ input: parseFloat(m[1]), target: parseFloat(m[2]) }),
    },
    {
        re: /(?:add|increment|increase)\s+(\d+(?:\.\d+)?)\s+until\s+(?:it\s+(?:reaches?|equals?|is))\s+(\d+(?:\.\d+)?)/i,
        goalDescription: 'Increment until target reached',
        extractGoalValue: (m) => ({ input: parseFloat(m[1]), target: parseFloat(m[2]) }),
    },
    {
        re: /(?:starting\s+(?:from|at)\s+)?(\d+(?:\.\d+)?)\s*,?\s*add\s+until\s+(\d+(?:\.\d+)?)/i,
        goalDescription: 'Add from start until target',
        extractGoalValue: (m) => ({ input: parseFloat(m[1]), target: parseFloat(m[2]) }),
    },
    {
        re: /(?:starting\s+(?:from|at))?\s*(\d+(?:\.\d+)?)\s*,?\s*(?:keep\s+)?(?:adding|incrementing)\s+(?:\d+\s+)?until\s+(\d+(?:\.\d+)?)/i,
        goalDescription: 'Keep adding until target',
        extractGoalValue: (m) => ({ input: parseFloat(m[1]), target: parseFloat(m[2]) }),
    },
    {
        re: /solve\s+(?:for\s+)?(\d+(?:\.\d+)?)\s+(?:reaching|equals?|=)\s+(\d+(?:\.\d+)?)/i,
        goalDescription: 'Solve for target value',
        extractGoalValue: (m) => ({ input: parseFloat(m[1]), target: parseFloat(m[2]) }),
    },
];
const CONCEPT_QUERY_PATTERNS = [
    { re: /what\s+(?:properties|attributes)\s+does\s+(\S+)\s+have/i },
    { re: /what\s+is\s+(\S+)/i },
    { re: /(?:is|are)\s+(\S+)\s+(?:a|an)\s+(\S+)/i, relationType: 'isA' },
    { re: /is\s+(\S+)\s+related\s+to\s+(\S+)/i },
    { re: /(?:how\s+is\s+)?(\S+)\s+(?:related|connected)\s+to\s+(\S+)/i },
    { re: /(?:what\s+does\s+)?(\S+)\s+(?:cause|causes)/i, relationType: 'causes' },
    { re: /(?:what\s+is\s+)?(\S+)\s+(?:part\s+of|belongs\s+to)/i, relationType: 'partOf' },
    { re: /(?:tell\s+me\s+about|describe|explain)\s+(\S+)/i },
    { re: /(?:concept|what\s+do\s+you\s+know\s+about)\s+(\S+)/i },
];
const GREETING_PATTERNS = [
    /^(?:hi|hello|hey|greetings|good\s+(?:morning|afternoon|evening|day))\b/i,
    /^(?:how\s+are\s+you|what['']s\s+up|wassup)\b/i,
    /^(?:thanks?|thank\s+you|thx)\b/i,
    /^(?:ok|okay|got\s+it|understood|sure)\b/i,
    /^(?:bye|goodbye|see\s+you)\b/i,
];
const FACT_STATEMENT_PATTERNS = [
    /^one\s+language\s+is/i,
    /^this\s+is\s+a\s+(?:test|check)/i,
];
const CONCEPT_STOPWORDS = new Set([
    'a', 'an', 'the', 'how', 'what', 'why', 'when', 'where', 'who', 'is', 'are', 'was', 'were',
    'do', 'does', 'did', 'can', 'could', 'would', 'should', 'to', 'of', 'in', 'on', 'for',
    'with', 'about', 'tell', 'me', 'explain', 'describe', 'you', 'your', 'i', 'my', 'we', 'our',
    'it', 'its', 'this', 'that', 'these', 'those', 'please', 'just', 'some', 'any', 'here', 'there',
    'happening', 'going', 'doing'
]);
// ──────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ──────────────────────────────────────────────────────────────────────────────
/** Extract all numeric tokens from a string. */
function extractNumbers(text) {
    return Array.from(text.matchAll(/\d+(?:\.\d+)?/g)).map((m) => parseFloat(m[0]));
}
/** Sanitise a raw word into a concept identifier (lowercase, no punctuation). */
function toConceptId(raw) {
    return raw.toLowerCase().replace(/[^a-z0-9_]/g, '');
}
// ──────────────────────────────────────────────────────────────────────────────
// IntentParser
// ──────────────────────────────────────────────────────────────────────────────
export class IntentParser {
    /**
     * Deterministically parse a natural-language string into a ParsedUserIntent.
     * Never throws; always returns a valid intent even if UNKNOWN_REQUEST.
     */
    parse(rawText) {
        const text = rawText.trim();
        const lowerText = text.toLowerCase();
        // 1. Greeting / conversational filler
        if (GREETING_PATTERNS.some((p) => p.test(text))) {
            return this.makeIntent(UserIntentType.CONVERSATIONAL_FACT, {}, rawText, 0.90, false);
        }
        // 2. Fact statement
        if (FACT_STATEMENT_PATTERNS.some((p) => p.test(text))) {
            return this.makeIntent(UserIntentType.CONVERSATIONAL_FACT, {}, rawText, 0.75, false);
        }
        // 3. Reasoning task patterns
        for (const pattern of REASONING_PATTERNS) {
            const m = text.match(pattern.re);
            if (m) {
                const extracted = pattern.extractGoalValue(m);
                const rawNumbers = extractNumbers(text);
                const entities = {
                    inputValue: extracted.input,
                    targetValue: extracted.target,
                    goalDescription: pattern.goalDescription,
                    rawNumbers,
                };
                return this.makeIntent(UserIntentType.REASONING_TASK, entities, rawText, 0.85, false);
            }
        }
        // 4. Concept query patterns
        for (const cpat of CONCEPT_QUERY_PATTERNS) {
            const m = text.match(cpat.re);
            if (m) {
                const rawToken = (m[1] ?? '').trim().toLowerCase();
                // If extracted token is a common English stopword (and not explicitly prefixed with concept_), reject as concept
                if (!rawToken.startsWith('concept_') && CONCEPT_STOPWORDS.has(rawToken)) {
                    continue;
                }
                const candidateId = toConceptId(rawToken);
                if (candidateId.length > 0) {
                    const entities = {
                        conceptId: candidateId.startsWith('concept_') ? candidateId : `concept_${candidateId}`,
                        relationType: cpat.relationType,
                    };
                    // If two capture groups, second is a related concept
                    if (m[2]) {
                        const rawSecond = (m[2] ?? '').trim().toLowerCase();
                        if (rawSecond.startsWith('concept_') || !CONCEPT_STOPWORDS.has(rawSecond)) {
                            entities.constraints = {};
                            const related = toConceptId(rawSecond);
                            entities.relatedConceptId = related.startsWith('concept_') ? related : `concept_${related}`;
                        }
                    }
                    return this.makeIntent(UserIntentType.CONCEPT_QUERY, entities, rawText, 0.80, false);
                }
            }
        }
        // 5. Numeric-only input → treat as reasoning seed, but clarification needed
        const nums = extractNumbers(lowerText);
        if (nums.length >= 2) {
            const entities = {
                inputValue: nums[0],
                targetValue: nums[1],
                rawNumbers: nums,
            };
            // Partial match; needs clarification to know the operation
            return this.makeIntent(UserIntentType.UNKNOWN_REQUEST, entities, rawText, 0.40, true);
        }
        // 6. Fallback: UNKNOWN_REQUEST
        return this.makeIntent(UserIntentType.UNKNOWN_REQUEST, {}, rawText, 0.10, true);
    }
    // ────────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ────────────────────────────────────────────────────────────────────────────
    makeIntent(intentType, entities, rawText, confidence, clarificationRequired) {
        return { intentType, entities, rawText, confidence, clarificationRequired };
    }
}
