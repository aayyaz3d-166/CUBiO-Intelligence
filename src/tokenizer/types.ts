/**
 * ONE Language — 3-6-9 Branching Tokenizer & Vocabulary Engine Types
 * =================================================================
 * Module: Sovereign 3-6-9 Branching Tokenizer & Vocabulary Engine
 * Target: ONE Language v1.5.0
 *
 * Implements high-capacity, zero-dependency tokenization with mathematical
 * 3-6-9 vortex branching hierarchy and high-frequency English fluency.
 */

export const WORD_BOUNDARY = '\u2581'; // Word-boundary marker

export const SPECIAL_TOKENS_369 = {
  // Control
  PAD: '<PAD>',
  UNK: '<UNK>',
  BOS: '<BOS>',
  EOS: '<EOS>',
  SEP: '<SEP>',
  MASK: '<MASK>',

  // 3-6-9 Hierarchical Spine
  BRANCH_1_2_INPUT: '<BRANCH_1_2_INPUT>',           // Observation & Identity
  ANCHOR_3_FOUNDATION: '<ANCHOR_3_FOUNDATION>',     // State / Subject Anchor
  BRANCH_4_5_CONTEXT: '<BRANCH_4_5_CONTEXT>',       // Memory & Adaptive Transition
  ANCHOR_6_PROCESS: '<ANCHOR_6_PROCESS>',           // Active Logic Transformation
  BRANCH_7_8_ANALYSIS: '<BRANCH_7_8_ANALYSIS>',     // Verification & Harmonic Check
  ANCHOR_9_SINGULARITY: '<ANCHOR_9_SINGULARITY>',   // Collapsed Truth / Conclusion

  // ONE Language Binary Integration
  BIN_TYPE_NULL: '<BIN_TYPE_NULL>',                 // 000
  BIN_TYPE_BOOL: '<BIN_TYPE_BOOL>',                 // 001
  BIN_TYPE_INT: '<BIN_TYPE_INT>',                   // 010
  BIN_TYPE_FLOAT: '<BIN_TYPE_FLOAT>',               // 011
  BIN_TYPE_TEXT: '<BIN_TYPE_TEXT>',                 // 100
  BIN_TYPE_ADDR369: '<BIN_TYPE_ADDR369>',           // 101
  BIN_TYPE_OPCODE: '<BIN_TYPE_OPCODE>',             // 110
  BIN_TYPE_CONTROL: '<BIN_TYPE_CONTROL>',           // 111
} as const;

export type SpecialToken369Key = keyof typeof SPECIAL_TOKENS_369;

export interface VocabularyCatalog369 {
  vocabularyId: string;
  size: number;
  tokenToId: Map<string, number>;
  idToToken: Map<number, string>;
  vocabularyHash: string;
  specialTokens: Record<string, number>;
}

export interface EncodeOptions369 {
  addSpecialTokens?: boolean;
  maxSeqLen?: number;
  padToMaxLen?: boolean;
  inject369Spine?: boolean; // Automatically wrap prompt in 1-2 -> 3 -> 4-5 -> 6 -> 7-8 -> 9
  returnInt32Array?: boolean;
}

export interface DecodeOptions369 {
  skipSpecialTokens?: boolean;
  preserve369Markers?: boolean;
}

export interface TokenizerStats369 {
  vocabSize: number;
  vocabHash: string;
  maxTokenLength: number;
  specialTokenCount: number;
}
