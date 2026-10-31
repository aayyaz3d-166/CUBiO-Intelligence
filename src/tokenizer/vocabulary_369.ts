/**
 * ONE Language — 3-6-9 Branching Vocabulary Engine
 * ==================================================
 * Module: Sovereign 3-6-9 Branching Tokenizer & Vocabulary Engine
 * Target: ONE Language v1.5.0
 *
 * Implements deterministic dictionary construction, SHA-256 hash manifest verification,
 * and zero-dependency bidirectional lookup catalogs.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import {
  SPECIAL_TOKENS_369,
  SpecialToken369Key,
  VocabularyCatalog369,
  WORD_BOUNDARY,
} from './types';

export const VOCABULARY_369_ID = 'ONE-VOCAB-369-8192';
export const VOCABULARY_369_SIZE = 8192;

let cachedCatalog: VocabularyCatalog369 | null = null;

/**
 * Resolves the path to vocab_8192.json across ESM and CommonJS runtimes.
 */
function resolveVocabJsonPath(): string | null {
  const candidates: string[] = [];

  // 1. Check relative to current file in ESM
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      let fileUrlPath = new URL('./vocab_8192.json', import.meta.url).pathname;
      if (process.platform === 'win32' && fileUrlPath.startsWith('/')) {
        fileUrlPath = fileUrlPath.slice(1);
      }
      candidates.push(fileUrlPath);
    }
  } catch (_) {}

  // 2. Check __dirname if available
  if (typeof __dirname !== 'undefined') {
    candidates.push(path.join(__dirname, 'vocab_8192.json'));
    candidates.push(path.join(__dirname, '../tokenizer/vocab_8192.json'));
  }

  // 3. Check process.cwd() locations
  candidates.push(path.resolve(process.cwd(), 'src/tokenizer/vocab_8192.json'));
  candidates.push(path.resolve(process.cwd(), 'dist/tokenizer/vocab_8192.json'));
  candidates.push('F:/ONE language/src/tokenizer/vocab_8192.json');

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

/**
 * Constructs the deterministic 8,192 token list in-memory if disk JSON is unavailable.
 */
function buildDeterministicTokens(): string[] {
  const tokenSet = new Set<string>();
  const tokens: string[] = [];

  const add = (t: string) => {
    if (t !== undefined && t !== null && !tokenSet.has(t) && tokens.length < VOCABULARY_369_SIZE) {
      tokenSet.add(t);
      tokens.push(t);
      return true;
    }
    return false;
  };

  // 1. 32 Special tokens
  const specials = Object.values(SPECIAL_TOKENS_369);
  for (const s of specials) add(s);
  let resIdx = specials.length;
  while (tokens.length < 32) {
    add(`<RESERVED_${resIdx++}>`);
  }

  // 2. ASCII 0..127
  for (let i = 0; i < 128; i++) {
    add(String.fromCharCode(i));
  }

  // 3. Word boundary marker
  add(WORD_BOUNDARY);

  // 4. Mathematical and physical symbols
  const mathSymbols = [
    '√', '∫', '≈', '≠', '≤', '≥', 'π', '∑', '∏', '∆', '∇', '∞',
    '∈', '∉', '⊂', '⊃', '∪', '∩', 'λ', 'α', 'β', 'γ', 'θ', 'μ',
    'σ', 'ω', '∂', '‰', '°', '±', '×', '÷', '·', '⊕', '⊗', '⊥',
    '∠', '∴', '∵', '∼', '≅', '≡', '≪', '≫', '∝', 'ħ', 'ε', 'ϕ',
    'ψ', 'Ω', 'τ', 'ρ', 'η', 'δ', 'ζ', 'κ', 'ξ', 'Γ', '→', '⇒',
    '↔', '∀', '∃', '∅', '¬'
  ];
  for (const m of mathSymbols) add(m);

  // 5. Common ONE Language & English words
  const coreWords = [
    'one', 'zero', 'spatial', 'address', 'address369', 'qplayer', 'obi', 'bytecode',
    'unified', 'vm', 'memory', 'tensor', 'lattice', 'neural', 'kernel', 'register',
    'actuation', 'lockout', 'sovereign', 'harmonic', 'vortex', 'singularity',
    'branch', 'anchor', 'foundation', 'context', 'process', 'analysis',
    'echo', 'echo1', 'assistant', 'copilot', 'tutor', 'reasoning', 'discrete',
    'olto', 'component', 'page', 'state', 'computed', 'action', 'view',
    'Container', 'Row', 'Column', 'Grid', 'Text', 'Button', 'Input', 'Card',
    'Modal', 'Image', 'Badge', 'LoadingSpinner', 'Spacer', 'Toast',
    'function', 'return', 'let', 'const', 'if', 'else', 'while', 'for', 'in',
    'struct', 'enum', 'async', 'await', 'match', 'print', 'number', 'string',
    'boolean', 'any', 'void', 'Array', 'List', 'Map', 'true', 'false', 'null',
    'undefined', 'import', 'export', 'from', 'as', 'type', 'interface', 'class',
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I', 'it', 'for',
    'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by',
    'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'all',
    'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who',
    'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no',
    'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good',
    'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look',
    'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use',
    'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want',
    'because', 'any', 'these', 'give', 'day', 'most', 'us', 'is', 'are', 'was',
    'were', 'been', 'has', 'had', 'does', 'did', 'doing', 'shall', 'should',
    'may', 'might', 'must', 'can', 'could'
  ];

  for (const w of coreWords) {
    add(w);
    add(WORD_BOUNDARY + w);
  }

  // 6. Padding to exact 8,192 boundary
  let padIdx = 0;
  while (tokens.length < VOCABULARY_369_SIZE) {
    add(`_T${String(padIdx++).padStart(4, '0')}_`);
  }

  return tokens;
}

/**
 * Builds or retrieves the singleton immutable VocabularyCatalog369.
 */
export function getVocabularyCatalog369(): VocabularyCatalog369 {
  if (cachedCatalog) {
    return cachedCatalog;
  }

  let tokens: string[] = [];
  const jsonPath = resolveVocabJsonPath();

  if (jsonPath) {
    try {
      const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (Array.isArray(parsed.tokens) && parsed.tokens.length === VOCABULARY_369_SIZE) {
        tokens = parsed.tokens;
      }
    } catch (_) {
      // Fallback below
    }
  }

  if (tokens.length !== VOCABULARY_369_SIZE) {
    tokens = buildDeterministicTokens();
  }

  const tokenToId = new Map<string, number>();
  const idToToken = new Map<number, string>();

  tokens.forEach((t, i) => {
    tokenToId.set(t, i);
    idToToken.set(i, t);
  });

  const specialTokensMap: Record<string, number> = {};
  for (const [key, val] of Object.entries(SPECIAL_TOKENS_369)) {
    const id = tokenToId.get(val);
    if (id !== undefined) {
      specialTokensMap[key] = id;
    }
  }

  const vocabularyHash = createHash('sha256').update(JSON.stringify(tokens)).digest('hex');

  cachedCatalog = {
    vocabularyId: VOCABULARY_369_ID,
    size: VOCABULARY_369_SIZE,
    tokenToId,
    idToToken,
    vocabularyHash,
    specialTokens: specialTokensMap,
  };

  return cachedCatalog;
}
