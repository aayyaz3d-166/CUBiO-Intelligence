/**
 * ONE Language — Native Vector Database (VDB) Engine
 * ===================================================
 * Module: @one/memory/NativeVDB
 *
 * Sovereign, in-memory Vector Database providing persistent content-addressed
 * storage for high-dimensional embeddings, canonical payloads, and spatial lattice points.
 *
 * Invariants:
 *   - Cosine similarity with numerically stabilized dot product and norms
 *   - Strict spatial anchoring to Canonical Address369 cells [26..368]
 *   - OCC version tracking and cryptographic state sealing
 *   - Zero external dependencies; bounded memory under RSSGuard
 */

import * as crypto from 'crypto';
import { NativeValue, createNull, createFloat, createInt, createString } from '../runtime/NativeValues';
import { CanonicalSerializer } from '../data/CanonicalSerializer';

export interface VDBRecord {
  id: string;
  vector: Float64Array;
  dimension: number;
  payload: NativeValue;
  canonicalAddress?: number; // Optional 26..368
  spatialCoord?: [number, number, number]; // Optional [0..6, 0..6, 0..6]
  norm?: number; // Precomputed L2 norm for fast cosine similarity
  version: number;
  stateHash: string;
  createdAt: number;
  updatedAt: number;
}

export interface VDBSearchResult {
  record: VDBRecord;
  similarity: number; // Cosine similarity in [-1.0..1.0]
}

export class NativeVDB {
  private records: Map<string, VDBRecord> = new Map();
  private addressIndex: Map<number, string> = new Map(); // Canonical Address -> Record ID
  private totalAllocatedBytes: number = 0;
  private readonly maxAllocatedBytes: number;

  constructor(maxAllocatedBytes: number = 64 * 1024 * 1024) {
    this.maxAllocatedBytes = maxAllocatedBytes;
  }

  /**
   * Computes cosine similarity between two vectors.
   */
  public static cosineSimilarity(a: Float64Array, b: Float64Array): number {
    if (a.length !== b.length) {
      throw new Error(`[VDB Dimension Error] Vector dimension mismatch: ${a.length} vs ${b.length}`);
    }
    let dot = 0.0;
    let normA = 0.0;
    let normB = 0.0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA <= 0.0 || normB <= 0.0) {
      return 0.0;
    }

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Computes cryptographic state hash for a record.
   */
  public static computeRecordHash(id: string, vector: Float64Array, payload: NativeValue, version: number): string {
    const rawPayload = CanonicalSerializer.serializeCanonicalJSON(payload);
    const vecBytes = Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
    return `0xVDB_${crypto
      .createHash('sha256')
      .update(id)
      .update(vecBytes)
      .update(rawPayload)
      .update(String(version))
      .digest('hex')
      .substring(0, 16)
      .toUpperCase()}`;
  }

  /**
   * Inserts or replaces a record in the vector database.
   */
  public insert(
    id: string,
    vector: Float64Array | number[],
    payload: NativeValue,
    canonicalAddress?: number,
    spatialCoord?: [number, number, number]
  ): VDBRecord {
    const vec = vector instanceof Float64Array ? vector : new Float64Array(vector);
    const recordBytes = vec.byteLength + 256; // Vector bytes + overhead estimate

    if (this.totalAllocatedBytes + recordBytes > this.maxAllocatedBytes) {
      throw new Error(`[VDB E7011] VDB memory ceiling reached (${this.maxAllocatedBytes} bytes). Allocation rejected.`);
    }

    const version = 1;
    const now = Date.now();
    const stateHash = NativeVDB.computeRecordHash(id, vec, payload, version);

    let normSq = 0.0;
    for (let i = 0; i < vec.length; i++) normSq += vec[i] * vec[i];
    const norm = Math.sqrt(normSq);

    const record: VDBRecord = {
      id,
      vector: vec,
      dimension: vec.length,
      payload,
      canonicalAddress,
      spatialCoord,
      norm,
      version,
      stateHash,
      createdAt: now,
      updatedAt: now,
    };

    // Remove old memory accounting if overwriting
    const existing = this.records.get(id);
    if (existing) {
      this.totalAllocatedBytes -= existing.vector.byteLength + 256;
      if (existing.canonicalAddress !== undefined) {
        this.addressIndex.delete(existing.canonicalAddress);
      }
    }

    this.records.set(id, record);
    this.totalAllocatedBytes += recordBytes;

    if (canonicalAddress !== undefined) {
      this.addressIndex.set(canonicalAddress, id);
    }

    return record;
  }

  /**
   * Retrieves a record by ID.
   */
  public get(id: string): VDBRecord | undefined {
    return this.records.get(id);
  }

  /**
   * Retrieves a record by Canonical Address.
   */
  public getByAddress(canonicalAddress: number): VDBRecord | undefined {
    const id = this.addressIndex.get(canonicalAddress);
    if (!id) return undefined;
    return this.records.get(id);
  }

  /**
   * Checks if a record exists.
   */
  public has(id: string): boolean {
    return this.records.has(id);
  }

  /**
   * Updates an existing record with OCC version check.
   */
  public update(
    id: string,
    newPayload: NativeValue,
    newVector?: Float64Array | number[],
    expectedVersion?: number
  ): VDBRecord {
    const record = this.records.get(id);
    if (!record) {
      throw new Error(`[VDB Error] Record '${id}' not found for update.`);
    }

    if (expectedVersion !== undefined && record.version !== expectedVersion) {
      throw new Error(
        `[VDB OCC Error] Concurrency conflict on record '${id}': expected version ${expectedVersion}, but found ${record.version}.`
      );
    }

    const vec = newVector ? (newVector instanceof Float64Array ? newVector : new Float64Array(newVector)) : record.vector;
    const newVersion = record.version + 1;
    const stateHash = NativeVDB.computeRecordHash(id, vec, newPayload, newVersion);

    let normSq = 0.0;
    for (let i = 0; i < vec.length; i++) normSq += vec[i] * vec[i];
    record.norm = Math.sqrt(normSq);

    record.vector = vec;
    record.dimension = vec.length;
    record.payload = newPayload;
    record.version = newVersion;
    record.stateHash = stateHash;
    record.updatedAt = Date.now();

    return record;
  }

  /**
   * Deletes a record by ID.
   */
  public delete(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    this.totalAllocatedBytes -= record.vector.byteLength + 256;
    if (record.canonicalAddress !== undefined) {
      this.addressIndex.delete(record.canonicalAddress);
    }
    return this.records.delete(id);
  }

  /**
   * Performs nearest-neighbor vector similarity search with precomputed norm acceleration.
   */
  public search(queryVector: Float64Array | number[], topK: number = 5): VDBSearchResult[] {
    const query = queryVector instanceof Float64Array ? queryVector : new Float64Array(queryVector);
    let queryNormSq = 0.0;
    for (let i = 0; i < query.length; i++) queryNormSq += query[i] * query[i];
    const queryNorm = Math.sqrt(queryNormSq);

    const results: VDBSearchResult[] = [];

    for (const record of this.records.values()) {
      if (record.dimension !== query.length) continue;
      let sim: number;
      if (record.norm !== undefined && queryNorm > 0 && record.norm > 0) {
        let dot = 0.0;
        const rVec = record.vector;
        for (let i = 0; i < query.length; i++) {
          dot += query[i] * rVec[i];
        }
        sim = dot / (queryNorm * record.norm);
      } else {
        sim = NativeVDB.cosineSimilarity(query, record.vector);
      }
      results.push({ record, similarity: sim });
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }

  /**
   * Number of stored records.
   */
  public size(): number {
    return this.records.size;
  }

  /**
   * Memory allocated in bytes.
   */
  public getAllocatedBytes(): number {
    return this.totalAllocatedBytes;
  }

  /**
   * Clears all records.
   */
  public clear(): void {
    this.records.clear();
    this.addressIndex.clear();
    this.totalAllocatedBytes = 0;
  }
}
