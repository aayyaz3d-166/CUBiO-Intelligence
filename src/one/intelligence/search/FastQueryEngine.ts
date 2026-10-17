/**
 * CUBiO AI — ONE LANGUAGE — NATIVE INTELLIGENCE TOOLING
 * =====================================================
 * Module: @one/intelligence/search/FastQueryEngine
 *
 * Implements Capabilities 1–5:
 *   1. Fast Query Engine (sub-millisecond multi-attribute indexing)
 *   2. Advanced Retrieval Engine (hybrid spatial + vector + lexical retrieval)
 *   3. Semantic Search Engine (cosine similarity KNN via NativeVDB)
 *   4. Knowledge Search (fact/rule queries via KnowledgeInferenceEngine)
 *   5. Cross-Domain Search (federated querying across Spatial, VDB, and Knowledge)
 */

import { NativeMemoryAPI, StoredRecordInfo } from '../../memory/NativeMemoryAPI';
import { NativeVDB, VDBSearchResult } from '../../memory/NativeVDB';
import { OneAddress369 } from '../../spatial/OneAddress369';
import { KnowledgeInferenceEngine } from '../../lattice/knowledge_inference_engine';
import { NativeValue, toRaw, fromRaw, isEqual } from '../../runtime/NativeValues';
import { CanonicalSerializer } from '../../data/CanonicalSerializer';

export type QueryPredicate = (record: Record<string, unknown>) => boolean;

export interface HybridSearchQuery {
  textOrKey?: string;
  vector?: number[];
  spatialCoord?: [number, number, number];
  attributes?: Record<string, unknown>;
  predicate?: QueryPredicate;
  maxResults?: number;
  minScore?: number;
}

export interface HybridSearchResult {
  id: string;
  domain: 'MEMORY' | 'SPATIAL' | 'KNOWLEDGE';
  score: number;
  payload: unknown;
  spatialAddress?: number;
  similarity?: number;
}

export interface CrossDomainSearchResponse {
  query: string;
  totalMatches: number;
  executionTimeMs: number;
  results: HybridSearchResult[];
  domainBreakdown: {
    memoryMatches: number;
    spatialMatches: number;
    knowledgeMatches: number;
  };
  stateHash: string;
}

export class FastQueryEngine {
  private memoryAPI: NativeMemoryAPI;
  private vdb: NativeVDB;
  private knowledgeEngine: KnowledgeInferenceEngine;
  private assertedFacts: Array<{ subject: string; predicate: string; object: string; confidence: number }> = [];

  // Secondary attribute indices: attributeName -> (attributeValue -> Set of recordIds)
  private attributeIndices: Map<string, Map<string, Set<string>>> = new Map();

  constructor(memoryAPI?: NativeMemoryAPI, vdb?: NativeVDB) {
    this.memoryAPI = memoryAPI ?? new NativeMemoryAPI();
    this.vdb = vdb ?? new NativeVDB();
    this.knowledgeEngine = new KnowledgeInferenceEngine();
  }

  // ── Capability 1: Fast Query Engine with Attribute Indexing ────────────────

  /**
   * Indexes a record for instant multi-attribute querying.
   */
  public indexRecord(id: string, record: Record<string, unknown>): void {
    for (const [key, val] of Object.entries(record)) {
      if (val === null || val === undefined) continue;
      const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);

      let keyIndex = this.attributeIndices.get(key);
      if (!keyIndex) {
        keyIndex = new Map();
        this.attributeIndices.set(key, keyIndex);
      }

      let idSet = keyIndex.get(strVal);
      if (!idSet) {
        idSet = new Set();
        keyIndex.set(strVal, idSet);
      }
      idSet.add(id);
    }
  }

  /**
   * Removes a record from the attribute index.
   */
  public deindexRecord(id: string, record: Record<string, unknown>): void {
    for (const [key, val] of Object.entries(record)) {
      const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
      const keyIndex = this.attributeIndices.get(key);
      if (keyIndex) {
        const idSet = keyIndex.get(strVal);
        if (idSet) {
          idSet.delete(id);
          if (idSet.size === 0) keyIndex.delete(strVal);
        }
      }
    }
  }

  /**
   * Fast lookup: Returns IDs matching all specified attribute values in O(1) / sub-millisecond.
   */
  public queryByAttributes(attributes: Record<string, unknown>): string[] {
    const keys = Object.keys(attributes);
    if (keys.length === 0) return [];

    let matchingIds: Set<string> | null = null;

    for (const key of keys) {
      const val = attributes[key];
      const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
      const keyIndex = this.attributeIndices.get(key);
      const currentSet = keyIndex?.get(strVal);

      if (!currentSet || currentSet.size === 0) {
        return []; // Intersection is empty
      }

      if (matchingIds === null) {
        matchingIds = new Set(currentSet);
      } else {
        // Intersect
        const nextSet = new Set<string>();
        for (const id of matchingIds) {
          if (currentSet.has(id)) nextSet.add(id);
        }
        matchingIds = nextSet;
        if (matchingIds.size === 0) return [];
      }
    }

    return matchingIds ? Array.from(matchingIds) : [];
  }

  // ── Capability 2: Advanced Hybrid Retrieval ────────────────────────────────

  /**
   * Executes hybrid retrieval combining semantic vectors, spatial proximity, and attributes.
   */
  public advancedRetrieve(query: HybridSearchQuery): HybridSearchResult[] {
    const results: HybridSearchResult[] = [];
    const maxResults = query.maxResults ?? 10;
    const minScore = query.minScore ?? 0.0;

    // 1. Vector semantic search if vector provided
    if (query.vector && query.vector.length > 0) {
      const vdbResults = this.vdb.search(query.vector, maxResults * 2);
      for (const vr of vdbResults) {
        let score = vr.similarity;

        // Boost score if spatial coordinate matches
        if (query.spatialCoord && vr.record.canonicalAddress !== undefined) {
          if (OneAddress369.isSpatial(vr.record.canonicalAddress)) {
            const targetCoord = OneAddress369.addressToCoord(vr.record.canonicalAddress);
            const dist = OneAddress369.distanceManhattan(
              { i: query.spatialCoord[0], j: query.spatialCoord[1], k: query.spatialCoord[2] },
              targetCoord
            );
            // Proximity bonus: maximum 0.2 boost for distance 0, decaying to 0
            const spatialBonus = Math.max(0, (18 - dist) / 90);
            score += spatialBonus;
          }
        }

        if (score >= minScore) {
          results.push({
            id: vr.record.id,
            domain: 'MEMORY',
            score: Number(score.toFixed(4)),
            payload: vr.record.payload ? toRaw(vr.record.payload) : null,
            spatialAddress: vr.record.canonicalAddress,
            similarity: vr.similarity,
          });
        }
      }
    }

    // 2. Attribute search if attributes provided
    if (query.attributes) {
      const attrMatches = this.queryByAttributes(query.attributes);
      for (const id of attrMatches) {
        // Avoid duplicate if already found by vector search
        const existing = results.find((r) => r.id === id);
        if (existing) {
          existing.score += 0.3; // Attribute confirmation boost
        } else {
          const loaded = this.memoryAPI.load(id);
          results.push({
            id,
            domain: 'MEMORY',
            score: 0.85,
            payload: loaded ? toRaw(loaded) : null,
          });
        }
      }
    }

    // Sort descending by score and cap at maxResults
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, maxResults);
  }

  // ── Capability 3: Semantic Search Engine (KNN Cosine Similarity) ───────────

  /**
   * Pure semantic similarity search.
   */
  public semanticSearch(vector: number[], topK: number = 5): VDBSearchResult[] {
    return this.vdb.search(vector, topK);
  }

  // ── Capability 4: Knowledge Search ─────────────────────────────────────────

  /**
   * Asserts facts and queries knowledge graph forward-chaining deductions.
   */
  public assertKnowledge(subject: string, predicate: string, object: string, confidence: number = 1.0): void {
    this.assertedFacts.push({ subject, predicate, object, confidence });
    this.knowledgeEngine.assertFact(subject, predicate, object, confidence);
  }

  public searchKnowledge(subject?: string, predicate?: string, object?: string): Array<{
    subject: string;
    predicate: string;
    object: string;
    confidence: number;
  }> {
    return this.assertedFacts.filter((f) => {
      if (subject && f.subject !== subject) return false;
      if (predicate && f.predicate !== predicate) return false;
      if (object && f.object !== object) return false;
      return true;
    });
  }

  // ── Capability 5: Cross-Domain Federated Search ────────────────────────────

  /**
   * Executes unified search federating Memory, 369 Spatial, and Knowledge domains.
   */
  public crossDomainSearch(queryText: string, options: {
    vector?: number[];
    spatialCoord?: [number, number, number];
    maxResults?: number;
  } = {}): CrossDomainSearchResponse {
    const t0 = performance.now();
    const maxResults = options.maxResults ?? 15;
    const allResults: HybridSearchResult[] = [];

    // 1. Memory / VDB Domain
    if (options.vector) {
      const memMatches = this.vdb.search(options.vector, 5);
      for (const m of memMatches) {
        allResults.push({
          id: m.record.id,
          domain: 'MEMORY',
          score: m.similarity,
          payload: m.record.payload ? toRaw(m.record.payload) : null,
          spatialAddress: m.record.canonicalAddress,
          similarity: m.similarity,
        });
      }
    }

    // 2. Spatial Lattice Domain
    if (options.spatialCoord) {
      const [x, y, z] = options.spatialCoord;
      const canonicalAddr = OneAddress369.coordToAddress(x, y, z);
      const dispIdx = OneAddress369.toDisplayIndex(canonicalAddr);
      const neighbors = OneAddress369.getNeighbors6(x, y, z);

      allResults.push({
        id: `spatial_cell_${canonicalAddr}`,
        domain: 'SPATIAL',
        score: 1.0,
        payload: {
          canonicalAddress: canonicalAddr,
          displayIndex: dispIdx,
          coord: [x, y, z],
          neighborCount: neighbors.length,
          harmonicResonance: OneAddress369.harmonicResonance(canonicalAddr),
        },
        spatialAddress: canonicalAddr,
      });
    }

    // 3. Knowledge Graph Domain
    const knowledgeMatches = this.assertedFacts.filter(
      (f) => f.subject.includes(queryText) || f.predicate.includes(queryText) || f.object.includes(queryText)
    );
    for (const km of knowledgeMatches) {
      allResults.push({
        id: `fact_${km.subject}_${km.predicate}`,
        domain: 'KNOWLEDGE',
        score: km.confidence,
        payload: km,
      });
    }

    const duration = performance.now() - t0;
    allResults.sort((a, b) => b.score - a.score);
    const topResults = allResults.slice(0, maxResults);

    const memoryCount = topResults.filter((r) => r.domain === 'MEMORY').length;
    const spatialCount = topResults.filter((r) => r.domain === 'SPATIAL').length;
    const knowledgeCount = topResults.filter((r) => r.domain === 'KNOWLEDGE').length;

    const envelope = CanonicalSerializer.packEnvelope({
      query: queryText,
      count: topResults.length,
      memoryCount,
      spatialCount,
      knowledgeCount,
    });

    return {
      query: queryText,
      totalMatches: topResults.length,
      executionTimeMs: duration,
      results: topResults,
      domainBreakdown: {
        memoryMatches: memoryCount,
        spatialMatches: spatialCount,
        knowledgeMatches: knowledgeCount,
      },
      stateHash: envelope.payloadHash,
    };
  }
}
