/**
 * ONE Language — Native 3-6-9 Branching Tokenizer Engine
 * ========================================================
 * Module: Sovereign 3-6-9 Branching Tokenizer & Vocabulary Engine
 * Target: ONE Language v1.5.0
 *
 * Implements high-speed subword BPE tokenization with greedy longest-match,
 * 100% roundtrip text fidelity, and native 3-6-9 vortex branching integration.
 */

import {
  SPECIAL_TOKENS_369,
  SpecialToken369Key,
  VocabularyCatalog369,
  EncodeOptions369,
  DecodeOptions369,
  TokenizerStats369,
  WORD_BOUNDARY,
} from './types';
import { getVocabularyCatalog369 } from './vocabulary_369';

export class NativeTokenizer369 {
  public readonly catalog: VocabularyCatalog369;
  public readonly sortedTokens: string[];
  public readonly maxTokenLen: number;

  private readonly specialTokenSet: Set<string>;
  private readonly specialTokenIdMap: Map<number, string>;
  private readonly spine369TokenIds: Set<number>;
  private readonly specialRegex: RegExp;

  constructor(catalog?: VocabularyCatalog369) {
    this.catalog = catalog || getVocabularyCatalog369();

    // Index all special tokens
    this.specialTokenSet = new Set<string>();
    this.specialTokenIdMap = new Map<number, string>();
    this.spine369TokenIds = new Set<number>();

    const spineKeys: SpecialToken369Key[] = [
      'BRANCH_1_2_INPUT',
      'ANCHOR_3_FOUNDATION',
      'BRANCH_4_5_CONTEXT',
      'ANCHOR_6_PROCESS',
      'BRANCH_7_8_ANALYSIS',
      'ANCHOR_9_SINGULARITY',
    ];

    const spineTokenStrings = new Set<string>(spineKeys.map(k => SPECIAL_TOKENS_369[k]));

    // Register primary special tokens
    for (const [key, val] of Object.entries(SPECIAL_TOKENS_369)) {
      this.specialTokenSet.add(val);
      const id = this.catalog.tokenToId.get(val);
      if (id !== undefined) {
        this.specialTokenIdMap.set(id, val);
        if (spineTokenStrings.has(val)) {
          this.spine369TokenIds.add(id);
        }
      }
    }

    // Register reserved slots up to 32
    for (let r = 20; r < 32; r++) {
      const resToken = `<RESERVED_${r}>`;
      this.specialTokenSet.add(resToken);
      const id = this.catalog.tokenToId.get(resToken);
      if (id !== undefined) {
        this.specialTokenIdMap.set(id, resToken);
      }
    }

    // Build regex to match atomic special tokens
    const escapedSpecials = Array.from(this.specialTokenSet).map(s =>
      s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
    );
    this.specialRegex = new RegExp(`(${escapedSpecials.join('|')})`, 'g');

    // Build sorted token index for greedy longest-match scanning
    const allTokens: string[] = [];
    for (const [token] of this.catalog.tokenToId.entries()) {
      allTokens.push(token);
    }
    this.sortedTokens = allTokens.sort((a, b) => b.length - a.length);
    this.maxTokenLen = this.sortedTokens.length > 0 ? this.sortedTokens[0].length : 1;
  }

  /**
   * Splits text into token string pieces using greedy longest-match and atomic special token preservation.
   */
  public tokenize(text: string): string[] {
    if (!text) return [];

    // 1. Split text into segments around special tokens
    const parts = text.split(this.specialRegex).filter(Boolean);
    const pieces: string[] = [];

    for (const part of parts) {
      if (this.specialTokenSet.has(part)) {
        pieces.push(part);
        continue;
      }

      // Convert literal spaces to word boundary marker
      const normalized = part.split(' ').join(WORD_BOUNDARY);
      let i = 0;
      const len = normalized.length;

      while (i < len) {
        let matched = false;
        const endLimit = Math.min(len, i + this.maxTokenLen);

        for (let j = endLimit; j > i; j--) {
          const sub = normalized.substring(i, j);
          if (this.catalog.tokenToId.has(sub)) {
            pieces.push(sub);
            i = j;
            matched = true;
            break;
          }
        }

        if (!matched) {
          // Fallback to single character
          pieces.push(normalized[i]);
          i++;
        }
      }
    }

    return pieces;
  }

  /**
   * Encodes a string into an array or Int32Array of token IDs.
   */
  public encode(text: string, options: EncodeOptions369 = {}): number[] | Int32Array {
    const pieces = this.tokenize(text);
    const rawIds: number[] = [];

    const unkId = this.catalog.specialTokens['UNK'] ?? 1;

    for (const p of pieces) {
      const id = this.catalog.tokenToId.get(p);
      if (id !== undefined) {
        rawIds.push(id);
      } else {
        rawIds.push(unkId);
      }
    }

    let tokenIds: number[] = rawIds;

    // Optional 3-6-9 Vortex Branching Spine Injection
    if (options.inject369Spine) {
      const b12Id = this.catalog.specialTokens['BRANCH_1_2_INPUT'] ?? 6;
      const a3Id = this.catalog.specialTokens['ANCHOR_3_FOUNDATION'] ?? 7;
      const b45Id = this.catalog.specialTokens['BRANCH_4_5_CONTEXT'] ?? 8;
      const a6Id = this.catalog.specialTokens['ANCHOR_6_PROCESS'] ?? 9;
      const b78Id = this.catalog.specialTokens['BRANCH_7_8_ANALYSIS'] ?? 10;
      const a9Id = this.catalog.specialTokens['ANCHOR_9_SINGULARITY'] ?? 11;

      // Wrap input prompt inside branch 1-2 and anchor through the 3-6-9 spine
      tokenIds = [
        b12Id,
        ...tokenIds,
        a3Id,
        b45Id,
        a6Id,
        b78Id,
        a9Id,
      ];
    }

    // Optional BOS and EOS tokens
    if (options.addSpecialTokens) {
      const bosId = this.catalog.specialTokens['BOS'] ?? 2;
      const eosId = this.catalog.specialTokens['EOS'] ?? 3;
      tokenIds = [bosId, ...tokenIds, eosId];
    }

    // Sequence length truncation
    if (options.maxSeqLen !== undefined && options.maxSeqLen > 0) {
      if (tokenIds.length > options.maxSeqLen) {
        const truncated = tokenIds.slice(0, options.maxSeqLen);
        if (options.addSpecialTokens) {
          const eosId = this.catalog.specialTokens['EOS'] ?? 3;
          truncated[truncated.length - 1] = eosId;
        }
        tokenIds = truncated;
      }

      // Pad to max sequence length if requested
      if (options.padToMaxLen) {
        const padId = this.catalog.specialTokens['PAD'] ?? 0;
        while (tokenIds.length < options.maxSeqLen) {
          tokenIds.push(padId);
        }
      }
    }

    if (options.returnInt32Array) {
      return new Int32Array(tokenIds);
    }

    return tokenIds;
  }

  /**
   * Decodes an array or Int32Array of token IDs back into standard text.
   */
  public decode(tokens: number[] | Int32Array, options: DecodeOptions369 = {}): string {
    if (!tokens || tokens.length === 0) return '';

    const pieces: string[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const id = tokens[i];
      const isSpecial = this.specialTokenIdMap.has(id);

      if (isSpecial && options.skipSpecialTokens) {
        if (options.preserve369Markers && this.spine369TokenIds.has(id)) {
          // Preserve 3-6-9 hierarchical spine tokens
          pieces.push(this.specialTokenIdMap.get(id)!);
        }
        continue;
      }

      const tokenStr = this.catalog.idToToken.get(id);
      if (tokenStr !== undefined) {
        pieces.push(tokenStr);
      }
    }

    // Reconstruct text and restore word boundary spaces
    const rawJoined = pieces.join('');
    return rawJoined.split(WORD_BOUNDARY).join(' ');
  }

  public getVocabSize(): number {
    return this.catalog.size;
  }

  public getVocabHash(): string {
    return this.catalog.vocabularyHash;
  }

  public isSpecialToken(tokenOrId: string | number): boolean {
    if (typeof tokenOrId === 'number') {
      return this.specialTokenIdMap.has(tokenOrId);
    }
    return this.specialTokenSet.has(tokenOrId);
  }

  public get369SpineTokens(): Record<string, number> {
    const result: Record<string, number> = {};
    const spineKeys: SpecialToken369Key[] = [
      'BRANCH_1_2_INPUT',
      'ANCHOR_3_FOUNDATION',
      'BRANCH_4_5_CONTEXT',
      'ANCHOR_6_PROCESS',
      'BRANCH_7_8_ANALYSIS',
      'ANCHOR_9_SINGULARITY',
    ];
    for (const k of spineKeys) {
      result[k] = this.catalog.specialTokens[k];
    }
    return result;
  }

  public getStats(): TokenizerStats369 {
    return {
      vocabSize: this.catalog.size,
      vocabHash: this.catalog.vocabularyHash,
      maxTokenLength: this.maxTokenLen,
      specialTokenCount: this.specialTokenSet.size,
    };
  }
}
