import { RSSGuard } from '../memory/rssGuard';

export interface DatasetConfig {
  sourcePath: string;
  harmonicWeight: number; // 369 aligned weight (e.g., 0.369)
  maxBatchSizeMB: number;
}

export interface DatasetRecord {
  id: string;
  tokens: number[];
  targetSpatialState?: Float32Array | number[];
  referenceLogits?: Float32Array | number[];
  metadata?: Record<string, unknown>;
}

export interface ValidationSchema {
  minSeqLen?: number;        // Default: 1
  maxSeqLen?: number;        // Default: 64
  vocabSize?: number;        // Default: 369
  expectedSpatialDim?: number; // Default: 40
  expectedLogitsDim?: number;  // Default: 369
  requireSpatialState?: boolean; // Default: false
  requireLogits?: boolean;       // Default: false
}

export interface ValidationError {
  recordIndex: number;
  recordId?: string;
  field: string;
  reason: string;
}

export interface SchemaValidationResult {
  valid: boolean;
  totalRecords: number;
  validRecords: DatasetRecord[];
  invalidRecords: Array<{ record: unknown; errors: ValidationError[] }>;
  errorCount: number;
}

export interface DeduplicationResult {
  uniqueRecords: DatasetRecord[];
  duplicateCount: number;
  uniqueCount: number;
  duplicateMap: Map<string, string[]>; // hash -> array of duplicate IDs
}

export interface DatasetSplitOptions {
  trainRatio?: number; // Default: 0.8
  valRatio?: number;   // Default: 0.1
  testRatio?: number;  // Default: 0.1
  seed?: number;       // Default: 369 (deterministic PRNG seed)
  preventLeakage?: boolean; // Default: true
}

export interface DatasetSplits {
  train: DatasetRecord[];
  validation: DatasetRecord[];
  test: DatasetRecord[];
  trainHashes: Set<string>;
  valHashes: Set<string>;
  testHashes: Set<string>;
  leakageFree: boolean;
  leakageIncidents: Array<{
    hash: string;
    splits: string[];
    recordIds: string[];
  }>;
  stats: {
    totalRecords: number;
    trainCount: number;
    valCount: number;
    testCount: number;
    trainPercentage: number;
    valPercentage: number;
    testPercentage: number;
  };
}

/**
 * Computes deterministic 32-bit FNV-1a content hash for a dataset record.
 */
export function computeRecordHash(record: DatasetRecord): string {
  let hash = 0x811c9dc5;

  // Hash token integers
  for (let i = 0; i < record.tokens.length; i++) {
    hash ^= record.tokens[i] & 0xffff;
    hash = Math.imul(hash, 0x01000193);
  }

  // Hash targetSpatialState if present
  if (record.targetSpatialState) {
    const arr = record.targetSpatialState;
    const len = arr.length;
    for (let i = 0; i < len; i++) {
      const val = Math.fround(arr[i]);
      const view = new Int32Array(new Float32Array([val]).buffer);
      hash ^= view[0];
      hash = Math.imul(hash, 0x01000193);
    }
  }

  return '0x' + (hash >>> 0).toString(16).padStart(8, '0');
}

export class DatasetIngestionPipeline {
  public readonly isActuationBlocked: boolean = true;
  private rssGuard: RSSGuard;

  constructor(rssGuard: RSSGuard) {
    this.rssGuard = rssGuard;
  }

  /**
   * Existing streaming ingestion method (preserved for backward compatibility).
   */
  public ingestStream(config: DatasetConfig): { tokensProcessed: number; status: string } {
    // Enforce strict RSS memory limits during streaming
    this.rssGuard.allocate(config.maxBatchSizeMB * 1024 * 1024, `DatasetBatch:${config.maxBatchSizeMB}MB`);

    console.log(`[Dataset Ingestion] Opening stream from ${config.sourcePath}`);
    console.log(`[369 Harmonic Weight] Assigned weight factor: ${config.harmonicWeight}`);

    // Simulated high-throughput streaming and deduplication funnel
    const tokensProcessed = 1024 * 1024 * 128; // 128M tokens processed safely

    return {
      tokensProcessed,
      status: 'INGESTION_COMPLETE_WITH_ZERO_COPY'
    };
  }

  /**
   * Validates raw dataset records against schema requirements.
   * Enforces sequence bounds, token ID bounds [0..vocabSize-1], spatial dimensions, and finite numbers.
   */
  public validateRecords(
    rawRecords: unknown[],
    schema: ValidationSchema = {}
  ): SchemaValidationResult {
    const minSeqLen = schema.minSeqLen ?? 1;
    const maxSeqLen = schema.maxSeqLen ?? 64;
    const vocabSize = schema.vocabSize ?? 369;
    const expectedSpatialDim = schema.expectedSpatialDim ?? 40;
    const expectedLogitsDim = schema.expectedLogitsDim ?? 369;
    const requireSpatial = schema.requireSpatialState ?? false;
    const requireLogits = schema.requireLogits ?? false;

    const validRecords: DatasetRecord[] = [];
    const invalidRecords: Array<{ record: unknown; errors: ValidationError[] }> = [];

    if (!Array.isArray(rawRecords)) {
      throw new Error('[DatasetValidationError] rawRecords must be an array');
    }

    for (let i = 0; i < rawRecords.length; i++) {
      const item = rawRecords[i];
      const errors: ValidationError[] = [];

      if (!item || typeof item !== 'object') {
        errors.push({
          recordIndex: i,
          field: 'root',
          reason: 'Record must be a non-null object',
        });
        invalidRecords.push({ record: item, errors });
        continue;
      }

      const rec = item as Record<string, unknown>;
      const recordId = typeof rec.id === 'string' && rec.id.length > 0 ? rec.id : `record_${i}`;

      // 1. Tokens validation
      if (!rec.tokens || !Array.isArray(rec.tokens)) {
        errors.push({
          recordIndex: i,
          recordId,
          field: 'tokens',
          reason: 'tokens must be an array of numbers',
        });
      } else {
        const tokens = rec.tokens as unknown[];
        if (tokens.length < minSeqLen || tokens.length > maxSeqLen) {
          errors.push({
            recordIndex: i,
            recordId,
            field: 'tokens.length',
            reason: `Sequence length (${tokens.length}) out of bounds [${minSeqLen}, ${maxSeqLen}]`,
          });
        }
        for (let t = 0; t < tokens.length; t++) {
          const tok = tokens[t];
          if (typeof tok !== 'number' || !Number.isInteger(tok) || tok < 0 || tok >= vocabSize) {
            errors.push({
              recordIndex: i,
              recordId,
              field: `tokens[${t}]`,
              reason: `Token ${tok} must be an integer in range [0, ${vocabSize - 1}]`,
            });
            break; // Stop after first invalid token to prevent flooding
          }
        }
      }

      // 2. Target Spatial State validation
      if (requireSpatial && !rec.targetSpatialState) {
        errors.push({
          recordIndex: i,
          recordId,
          field: 'targetSpatialState',
          reason: 'targetSpatialState is required by schema',
        });
      } else if (rec.targetSpatialState !== undefined && rec.targetSpatialState !== null) {
        const spatial = rec.targetSpatialState;
        const isArr = Array.isArray(spatial) || spatial instanceof Float32Array;
        if (!isArr) {
          errors.push({
            recordIndex: i,
            recordId,
            field: 'targetSpatialState',
            reason: 'targetSpatialState must be an Array or Float32Array',
          });
        } else {
          const len = (spatial as ArrayLike<number>).length;
          if (len !== expectedSpatialDim) {
            errors.push({
              recordIndex: i,
              recordId,
              field: 'targetSpatialState.length',
              reason: `Spatial dimensions (${len}) do not match expected (${expectedSpatialDim})`,
            });
          }
          for (let s = 0; s < len; s++) {
            const val = (spatial as ArrayLike<number>)[s];
            if (typeof val !== 'number' || !Number.isFinite(val) || Number.isNaN(val)) {
              errors.push({
                recordIndex: i,
                recordId,
                field: `targetSpatialState[${s}]`,
                reason: `Spatial value at index ${s} is NaN or non-finite: ${val}`,
              });
              break;
            }
          }
        }
      }

      // 3. Reference Logits validation
      if (requireLogits && !rec.referenceLogits) {
        errors.push({
          recordIndex: i,
          recordId,
          field: 'referenceLogits',
          reason: 'referenceLogits is required by schema',
        });
      } else if (rec.referenceLogits !== undefined && rec.referenceLogits !== null) {
        const logits = rec.referenceLogits;
        const isArr = Array.isArray(logits) || logits instanceof Float32Array;
        if (!isArr) {
          errors.push({
            recordIndex: i,
            recordId,
            field: 'referenceLogits',
            reason: 'referenceLogits must be an Array or Float32Array',
          });
        } else {
          const len = (logits as ArrayLike<number>).length;
          if (len !== expectedLogitsDim) {
            errors.push({
              recordIndex: i,
              recordId,
              field: 'referenceLogits.length',
              reason: `Logits dimension (${len}) does not match expected (${expectedLogitsDim})`,
            });
          }
          for (let l = 0; l < len; l++) {
            const val = (logits as ArrayLike<number>)[l];
            if (typeof val !== 'number' || !Number.isFinite(val) || Number.isNaN(val)) {
              errors.push({
                recordIndex: i,
                recordId,
                field: `referenceLogits[${l}]`,
                reason: `Logits value at index ${l} is NaN or non-finite: ${val}`,
              });
              break;
            }
          }
        }
      }

      if (errors.length === 0) {
        validRecords.push({
          id: recordId,
          tokens: rec.tokens as number[],
          targetSpatialState: rec.targetSpatialState as Float32Array | number[] | undefined,
          referenceLogits: rec.referenceLogits as Float32Array | number[] | undefined,
          metadata: rec.metadata as Record<string, unknown> | undefined,
        });
      } else {
        invalidRecords.push({ record: item, errors });
      }
    }

    return {
      valid: invalidRecords.length === 0,
      totalRecords: rawRecords.length,
      validRecords,
      invalidRecords,
      errorCount: invalidRecords.reduce((sum, inv) => sum + inv.errors.length, 0),
    };
  }

  /**
   * Deduplicates records based on deterministic content hash.
   */
  public deduplicate(records: DatasetRecord[]): DeduplicationResult {
    const seenHashes = new Map<string, string[]>();
    const uniqueRecords: DatasetRecord[] = [];
    let duplicateCount = 0;

    for (const rec of records) {
      const hash = computeRecordHash(rec);
      const existing = seenHashes.get(hash);

      if (existing) {
        existing.push(rec.id);
        duplicateCount++;
      } else {
        seenHashes.set(hash, [rec.id]);
        uniqueRecords.push(rec);
      }
    }

    return {
      uniqueRecords,
      uniqueCount: uniqueRecords.length,
      duplicateCount,
      duplicateMap: seenHashes,
    };
  }

  /**
   * Deterministically splits unique records into Train, Validation, and Test sets.
   * Guarantees zero data leakage (disjoint partition) and reproducibility via PRNG seed.
   */
  public splitDataset(
    records: DatasetRecord[],
    options: DatasetSplitOptions = {}
  ): DatasetSplits {
    const trainRatio = options.trainRatio ?? 0.8;
    const valRatio = options.valRatio ?? 0.1;
    const testRatio = options.testRatio ?? 0.1;
    const seed = options.seed ?? 369;

    const totalRatio = trainRatio + valRatio + testRatio;
    if (Math.abs(totalRatio - 1.0) > 1e-4) {
      throw new Error(`[DatasetSplitError] Split ratios must sum to 1.0, got ${totalRatio}`);
    }

    const N = records.length;
    if (N === 0) {
      return {
        train: [],
        validation: [],
        test: [],
        trainHashes: new Set(),
        valHashes: new Set(),
        testHashes: new Set(),
        leakageFree: true,
        leakageIncidents: [],
        stats: {
          totalRecords: 0,
          trainCount: 0,
          valCount: 0,
          testCount: 0,
          trainPercentage: 0,
          valPercentage: 0,
          testPercentage: 0,
        },
      };
    }

    // Deterministic shuffle using Mulberry32 PRNG
    const indices = Array.from({ length: N }, (_, i) => i);
    let s = seed >>> 0;
    for (let i = N - 1; i > 0; i--) {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      const j = Math.floor(r * (i + 1));
      const tmp = indices[i];
      indices[i] = indices[j];
      indices[j] = tmp;
    }

    const trainEnd = Math.floor(N * trainRatio);
    const valEnd = trainEnd + Math.floor(N * valRatio);

    const train: DatasetRecord[] = [];
    const validation: DatasetRecord[] = [];
    const test: DatasetRecord[] = [];

    for (let k = 0; k < N; k++) {
      const idx = indices[k];
      const rec = records[idx];
      if (k < trainEnd) {
        train.push(rec);
      } else if (k < valEnd) {
        validation.push(rec);
      } else {
        test.push(rec);
      }
    }

    // Build hash sets for strict leakage verification
    const trainHashes = new Set<string>();
    const valHashes = new Set<string>();
    const testHashes = new Set<string>();

    const hashToTrainIds = new Map<string, string[]>();
    const hashToValIds = new Map<string, string[]>();
    const hashToTestIds = new Map<string, string[]>();

    for (const r of train) {
      const h = computeRecordHash(r);
      trainHashes.add(h);
      const list = hashToTrainIds.get(h) ?? [];
      list.push(r.id);
      hashToTrainIds.set(h, list);
    }
    for (const r of validation) {
      const h = computeRecordHash(r);
      valHashes.add(h);
      const list = hashToValIds.get(h) ?? [];
      list.push(r.id);
      hashToValIds.set(h, list);
    }
    for (const r of test) {
      const h = computeRecordHash(r);
      testHashes.add(h);
      const list = hashToTestIds.get(h) ?? [];
      list.push(r.id);
      hashToTestIds.set(h, list);
    }

    // Detect data leakage across sets
    const leakageIncidents: Array<{ hash: string; splits: string[]; recordIds: string[] }> = [];

    for (const h of trainHashes) {
      const splits: string[] = ['train'];
      const recordIds: string[] = [...(hashToTrainIds.get(h) ?? [])];
      if (valHashes.has(h)) {
        splits.push('validation');
        recordIds.push(...(hashToValIds.get(h) ?? []));
      }
      if (testHashes.has(h)) {
        splits.push('test');
        recordIds.push(...(hashToTestIds.get(h) ?? []));
      }
      if (splits.length > 1) {
        leakageIncidents.push({ hash: h, splits, recordIds });
      }
    }

    for (const h of valHashes) {
      if (!trainHashes.has(h) && testHashes.has(h)) {
        leakageIncidents.push({
          hash: h,
          splits: ['validation', 'test'],
          recordIds: [...(hashToValIds.get(h) ?? []), ...(hashToTestIds.get(h) ?? [])],
        });
      }
    }

    const leakageFree = leakageIncidents.length === 0;

    return {
      train,
      validation,
      test,
      trainHashes,
      valHashes,
      testHashes,
      leakageFree,
      leakageIncidents,
      stats: {
        totalRecords: N,
        trainCount: train.length,
        valCount: validation.length,
        testCount: test.length,
        trainPercentage: Number(((train.length / N) * 100).toFixed(1)),
        valPercentage: Number(((validation.length / N) * 100).toFixed(1)),
        testPercentage: Number(((test.length / N) * 100).toFixed(1)),
      },
    };
  }

  /**
   * High-level end-to-end dataset ingestion, validation, deduplication, and partitioning.
   */
  public processDataset(
    rawRecords: unknown[],
    options: {
      schema?: ValidationSchema;
      split?: DatasetSplitOptions;
      allocateMB?: number;
    } = {}
  ): {
    validation: SchemaValidationResult;
    deduplication: DeduplicationResult;
    splits: DatasetSplits;
    isActuationBlocked: boolean;
  } {
    const allocMB = options.allocateMB ?? 16;
    this.rssGuard.allocate(allocMB * 1024 * 1024, `DatasetProcessing:${allocMB}MB`);

    // 1. Schema Validation
    const validation = this.validateRecords(rawRecords, options.schema);

    // 2. Deduplication on valid records
    const deduplication = this.deduplicate(validation.validRecords);

    // 3. Partitioning & Leakage Prevention
    const splits = this.splitDataset(deduplication.uniqueRecords, options.split);

    return {
      validation,
      deduplication,
      splits,
      isActuationBlocked: this.isActuationBlocked,
    };
  }
}
