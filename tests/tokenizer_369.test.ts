/**
 * ONE Language — 3-6-9 Branching Tokenizer & Vocabulary Verification Suite
 * =========================================================================
 * Target: ONE Language v1.5.0
 * Verifies:
 *   1. 3-6-9 Special Tokens & Hierarchical Spine Schema
 *   2. Exact Power-of-2 Vocabulary Capacity (8,192 tokens) & SHA-256 Manifest
 *   3. High-Frequency Natural English Encoding without <UNK>
 *   4. 100% Bit-Exact Roundtrip Fidelity (decode(encode(text)) === text)
 *   5. 3-6-9 Vortex Branching Spine Injection (1-2 -> 3 -> 4-5 -> 6 -> 7-8 -> 9)
 *   6. Sequence Truncation, Padding, and Int32Array Buffer Output
 *   7. Zero External Dependencies & Sovereign Architecture Invariants
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import {
  NativeTokenizer369,
  getVocabularyCatalog369,
  SPECIAL_TOKENS_369,
  WORD_BOUNDARY,
  VOCABULARY_369_SIZE,
} from '../src/tokenizer/index';

function runTestSuite() {
  console.log('================================================================================');
  console.log('  ONE LANGUAGE v1.5.0 — SOVEREIGN 3-6-9 TOKENIZER VERIFICATION SUITE');
  console.log('================================================================================\n');

  const catalog = getVocabularyCatalog369();
  const tokenizer = new NativeTokenizer369(catalog);

  // ── Test 1: Special Tokens & 3-6-9 Spine Integrity ──────────────────────────
  console.log('[Test 1] Verifying 3-6-9 Hierarchical Spine & Special Tokens Schema...');
  
  // Verify control tokens
  assert.strictEqual(SPECIAL_TOKENS_369.PAD, '<PAD>');
  assert.strictEqual(SPECIAL_TOKENS_369.UNK, '<UNK>');
  assert.strictEqual(SPECIAL_TOKENS_369.BOS, '<BOS>');
  assert.strictEqual(SPECIAL_TOKENS_369.EOS, '<EOS>');
  assert.strictEqual(SPECIAL_TOKENS_369.SEP, '<SEP>');
  assert.strictEqual(SPECIAL_TOKENS_369.MASK, '<MASK>');

  // Verify 3-6-9 Hierarchical Spine
  assert.strictEqual(SPECIAL_TOKENS_369.BRANCH_1_2_INPUT, '<BRANCH_1_2_INPUT>');
  assert.strictEqual(SPECIAL_TOKENS_369.ANCHOR_3_FOUNDATION, '<ANCHOR_3_FOUNDATION>');
  assert.strictEqual(SPECIAL_TOKENS_369.BRANCH_4_5_CONTEXT, '<BRANCH_4_5_CONTEXT>');
  assert.strictEqual(SPECIAL_TOKENS_369.ANCHOR_6_PROCESS, '<ANCHOR_6_PROCESS>');
  assert.strictEqual(SPECIAL_TOKENS_369.BRANCH_7_8_ANALYSIS, '<BRANCH_7_8_ANALYSIS>');
  assert.strictEqual(SPECIAL_TOKENS_369.ANCHOR_9_SINGULARITY, '<ANCHOR_9_SINGULARITY>');

  // Verify Binary Types
  assert.strictEqual(SPECIAL_TOKENS_369.BIN_TYPE_NULL, '<BIN_TYPE_NULL>');
  assert.strictEqual(SPECIAL_TOKENS_369.BIN_TYPE_BOOL, '<BIN_TYPE_BOOL>');
  assert.strictEqual(SPECIAL_TOKENS_369.BIN_TYPE_INT, '<BIN_TYPE_INT>');
  assert.strictEqual(SPECIAL_TOKENS_369.BIN_TYPE_FLOAT, '<BIN_TYPE_FLOAT>');
  assert.strictEqual(SPECIAL_TOKENS_369.BIN_TYPE_TEXT, '<BIN_TYPE_TEXT>');
  assert.strictEqual(SPECIAL_TOKENS_369.BIN_TYPE_ADDR369, '<BIN_TYPE_ADDR369>');
  assert.strictEqual(SPECIAL_TOKENS_369.BIN_TYPE_OPCODE, '<BIN_TYPE_OPCODE>');
  assert.strictEqual(SPECIAL_TOKENS_369.BIN_TYPE_CONTROL, '<BIN_TYPE_CONTROL>');

  // Verify ID mappings
  assert.strictEqual(catalog.tokenToId.get('<PAD>'), 0);
  assert.strictEqual(catalog.tokenToId.get('<UNK>'), 1);
  assert.strictEqual(catalog.tokenToId.get('<BOS>'), 2);
  assert.strictEqual(catalog.tokenToId.get('<EOS>'), 3);
  assert.strictEqual(catalog.tokenToId.get('<BRANCH_1_2_INPUT>'), 6);
  assert.strictEqual(catalog.tokenToId.get('<ANCHOR_3_FOUNDATION>'), 7);
  assert.strictEqual(catalog.tokenToId.get('<BRANCH_4_5_CONTEXT>'), 8);
  assert.strictEqual(catalog.tokenToId.get('<ANCHOR_6_PROCESS>'), 9);
  assert.strictEqual(catalog.tokenToId.get('<BRANCH_7_8_ANALYSIS>'), 10);
  assert.strictEqual(catalog.tokenToId.get('<ANCHOR_9_SINGULARITY>'), 11);

  console.log('  ✓ All 3-6-9 Tokens Verified: PASS\n');

  // ── Test 2: Vocabulary Size & Deterministic SHA-256 Manifest ─────────────
  console.log('[Test 2] Verifying Exact Power-of-2 Capacity (8,192) & SHA-256 Manifest...');
  assert.strictEqual(catalog.size, 8192, `Expected vocabulary size 8192, got ${catalog.size}`);
  assert.strictEqual(tokenizer.getVocabSize(), 8192);
  assert.strictEqual(catalog.tokenToId.size, 8192);
  assert.strictEqual(catalog.idToToken.size, 8192);
  assert.strictEqual(typeof catalog.vocabularyHash, 'string');
  assert.strictEqual(catalog.vocabularyHash.length, 64, 'SHA-256 hash must be 64 hex characters');

  console.log(`  ✓ Vocabulary Catalog ID: ${catalog.vocabularyId}`);
  console.log(`  ✓ Exact Power-of-2 Size: ${catalog.size} tokens`);
  console.log(`  ✓ SHA-256 Manifest Hash: ${catalog.vocabularyHash}`);
  console.log('  ✓ Vocabulary Capacity & Hash Manifest: PASS\n');

  // ── Test 3: Natural English Fluency & 0 <UNK> Guarantee ──────────────────
  console.log('[Test 3] Testing Natural English Fluency without <UNK> tokens...');
  const conversationalQuery = "Hello, how are you?";
  const encodedIds = tokenizer.encode(conversationalQuery) as number[];

  assert.ok(Array.isArray(encodedIds), 'Encode should return an array of numbers');
  assert.ok(encodedIds.length > 0, 'Encoded tokens must not be empty');
  
  const unkId = catalog.specialTokens['UNK'];
  for (let i = 0; i < encodedIds.length; i++) {
    assert.notStrictEqual(
      encodedIds[i],
      unkId,
      `Token at index ${i} was resolved to <UNK> for query '${conversationalQuery}'`
    );
  }

  const pieces = tokenizer.tokenize(conversationalQuery);
  console.log(`  Query:  "${conversationalQuery}"`);
  console.log(`  Tokens: [${pieces.map(p => JSON.stringify(p)).join(', ')}]`);
  console.log(`  IDs:    [${encodedIds.join(', ')}]`);
  console.log('  ✓ Zero <UNK> tokens detected for standard English dialogue: PASS\n');

  // ── Test 4: 100% Roundtrip Text Fidelity ─────────────────────────────────
  console.log('[Test 4] Testing 100% Bit-Exact Roundtrip Text Fidelity (decode(encode(t)) === t)...');
  const testCorpus = [
    "Hello, how are you?",
    "The quick brown fox jumps over the lazy dog.",
    "function compute(x: number, y: number): number { return x * 369 + y; }",
    "3 + 6 = 9; √16 = 4; π ≈ 3.14159; E = mc^2; ∫ f(x) dx",
    "Multiline text\n  with two leading spaces\tand a tab, plus   multiple   spaces.",
    "OLTO Component: <Container padding={24}><Button label=\"Click\" /></Container>",
    "Sovereign 3-6-9 memory addressing within slots [0..368] strictly enforced.",
    "https://one-language.org/v1.5.0/runtime?engine=qplayer&throughput=204Mops",
    "kya hal hai? ONE Language ab bohot tez aur sovereign ho chuki hai!",
    "Nested (parentheses [brackets {braces}]) and symbols: @ # $ % ^ & * _ + - = | \\ / ~ `",
  ];

  for (let idx = 0; idx < testCorpus.length; idx++) {
    const originalText = testCorpus[idx];
    const encoded = tokenizer.encode(originalText) as number[];
    const decoded = tokenizer.decode(encoded);

    assert.strictEqual(
      decoded,
      originalText,
      `Roundtrip mismatch at corpus index ${idx}:\nExpected: ${JSON.stringify(originalText)}\nGot:      ${JSON.stringify(decoded)}`
    );
  }

  console.log(`  ✓ Verified ${testCorpus.length} diverse technical, mathematical & dialogue texts.`);
  console.log('  ✓ Roundtrip Text Fidelity: 100% PASS\n');

  // ── Test 5: 3-6-9 Vortex Branching Spine Injection ───────────────────────
  console.log('[Test 5] Testing 3-6-9 Vortex Branching Spine Hierarchy Injection...');
  const promptText = "Calculate sovereign harmonic resonance";
  const spineTokens = tokenizer.encode(promptText, { inject369Spine: true }) as number[];

  // Structure: BRANCH_1_2_INPUT -> prompt -> ANCHOR_3 -> BRANCH_4_5 -> ANCHOR_6 -> BRANCH_7_8 -> ANCHOR_9
  assert.strictEqual(spineTokens[0], catalog.specialTokens['BRANCH_1_2_INPUT']);
  assert.strictEqual(spineTokens[spineTokens.length - 5], catalog.specialTokens['ANCHOR_3_FOUNDATION']);
  assert.strictEqual(spineTokens[spineTokens.length - 4], catalog.specialTokens['BRANCH_4_5_CONTEXT']);
  assert.strictEqual(spineTokens[spineTokens.length - 3], catalog.specialTokens['ANCHOR_6_PROCESS']);
  assert.strictEqual(spineTokens[spineTokens.length - 2], catalog.specialTokens['BRANCH_7_8_ANALYSIS']);
  assert.strictEqual(spineTokens[spineTokens.length - 1], catalog.specialTokens['ANCHOR_9_SINGULARITY']);

  // Decode with preserve369Markers
  const decodedSpine = tokenizer.decode(spineTokens, {
    skipSpecialTokens: true,
    preserve369Markers: true,
  });

  assert.ok(decodedSpine.includes('<BRANCH_1_2_INPUT>'));
  assert.ok(decodedSpine.includes('<ANCHOR_3_FOUNDATION>'));
  assert.ok(decodedSpine.includes('<ANCHOR_9_SINGULARITY>'));
  assert.ok(decodedSpine.includes(promptText));

  console.log('  ✓ 3-6-9 Branching Hierarchy & Mathematical Spine Injection: PASS\n');

  // ── Test 6: Truncation, Padding, & Int32Array Output ──────────────────────
  console.log('[Test 6] Testing Max Length Truncation, Padding, and Int32Array Buffer Output...');
  const longText = "ONE Language is a high performance sovereign computing substrate designed from scratch.";
  
  // Truncation with special tokens
  const truncated = tokenizer.encode(longText, {
    maxSeqLen: 8,
    addSpecialTokens: true,
  }) as number[];
  assert.strictEqual(truncated.length, 8);
  assert.strictEqual(truncated[0], catalog.specialTokens['BOS']);
  assert.strictEqual(truncated[7], catalog.specialTokens['EOS']);

  // Padding to max length
  const padded = tokenizer.encode("Short query", {
    maxSeqLen: 16,
    padToMaxLen: true,
  }) as number[];
  assert.strictEqual(padded.length, 16);
  assert.strictEqual(padded[15], catalog.specialTokens['PAD']);

  // Int32Array return
  const int32Buffer = tokenizer.encode("Fast buffer test", {
    returnInt32Array: true,
  });
  assert.ok(int32Buffer instanceof Int32Array, 'Buffer should be an instance of Int32Array');
  assert.ok(int32Buffer.length > 0);

  console.log('  ✓ Buffer Truncation, Padding & Int32Array Output: PASS\n');

  // ── Test 7: Zero External Dependencies & Architecture Guard ───────────────
  console.log('[Test 7] Verifying Zero External Dependencies Guard...');
  const tokenizerSourcePath = path.resolve('src/tokenizer/native_tokenizer_369.ts');
  const vocabSourcePath = path.resolve('src/tokenizer/vocabulary_369.ts');
  const typesSourcePath = path.resolve('src/tokenizer/types.ts');

  const sources = [
    fs.readFileSync(tokenizerSourcePath, 'utf8'),
    fs.readFileSync(vocabSourcePath, 'utf8'),
    fs.readFileSync(typesSourcePath, 'utf8'),
  ];

  const forbiddenImports = ['huggingface', 'tiktoken', 'sentencepiece', 'axios', 'express', '@xenova'];
  for (const src of sources) {
    for (const forbidden of forbiddenImports) {
      assert.ok(
        !src.toLowerCase().includes(forbidden),
        `Violation: Found forbidden external dependency '${forbidden}' in tokenizer sources!`
      );
    }
  }

  console.log('  ✓ Zero External Dependencies Guard: PASS\n');

  console.log('================================================================================');
  console.log('  ALL 7 TOKENIZER VERIFICATION SUITES PASSED (100%)');
  console.log('  ONE LANGUAGE v1.5.0 TOKENIZER & VOCABULARY ENGINE OPERATIONAL');
  console.log('================================================================================');
}

runTestSuite();
