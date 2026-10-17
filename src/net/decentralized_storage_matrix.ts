/**
 * Decentralized Storage Matrix
 * Module: ONE Language Network ("one-web" / "one-storage")
 * Gate: CNL-P36-001 (One Intelligence Product Suite)
 *
 * Content-addressed 3D voxel storage matrix chunking web pages,
 * bytecode binaries, and static assets across Canonical Address369 spatial cells [26..368].
 */

import { CanonicalAddress369 } from '../one/address369_canonical';
import * as crypto from 'crypto';

export interface StorageShard {
  shardIndex: number;
  totalShards: number;
  canonicalAddress: number; // 26..368
  displayIndex: number;     // 27..369
  spatialCoord: { i: number; j: number; k: number };
  shardData: string;        // Base64 or text chunk
  shardHash: string;
}

export interface AssetManifest {
  contentId: string;
  contentType: string;
  totalSizeBytes: number;
  rootHash: string;
  shardCount: number;
  shards: StorageShard[];
  storedAt: number;
}

export interface RetrievedAsset {
  contentId: string;
  contentType: string;
  content: string;
  totalSizeBytes: number;
  rootHash: string;
  integrityVerified: boolean;
  retrievalLatencyMs: number;
}

export class DecentralizedStorageMatrix {
  private assetRegistry: Map<string, AssetManifest> = new Map();
  private shardStore: Map<number, StorageShard[]> = new Map(); // Canonical Address -> Shards
  private totalStoredBytes: number = 0;
  private readonly MAX_STORAGE_BYTES: number = 64 * 1024 * 1024; // 64 MB storage ceiling

  /**
   * Stores an asset by chunking it across Canonical Address369 spatial cells.
   */
  public storeAsset(
    contentId: string,
    contentType: string,
    rawContent: string,
    baseSpatialAddress: number = 26
  ): AssetManifest {
    const rawBuffer = Buffer.from(rawContent, 'utf-8');
    const totalSizeBytes = rawBuffer.length;

    if (this.totalStoredBytes + totalSizeBytes > this.MAX_STORAGE_BYTES) {
      throw new Error(`[Storage Matrix Quota Exceeded] Current: ${this.totalStoredBytes} bytes, adding: ${totalSizeBytes} bytes.`);
    }

    const rootHash = crypto.createHash('sha256').update(rawBuffer).digest('hex');

    // Chunking into voxel-sized shards (~512 bytes per shard)
    const chunkSize = 512;
    const shardCount = Math.max(1, Math.ceil(totalSizeBytes / chunkSize));
    const shards: StorageShard[] = [];

    for (let s = 0; s < shardCount; s++) {
      const start = s * chunkSize;
      const end = Math.min(start + chunkSize, totalSizeBytes);
      const chunkBuffer = rawBuffer.subarray(start, end);
      const shardData = chunkBuffer.toString('base64');
      const shardHash = crypto.createHash('sha256').update(chunkBuffer).digest('hex');

      // Distribute across spatial cells [26..368] sequentially
      const canonicalAddress = CanonicalAddress369.SPATIAL_START + ((baseSpatialAddress - 26 + s) % CanonicalAddress369.SPATIAL_COUNT);
      const displayIndex = CanonicalAddress369.toDisplayIndex(canonicalAddress);
      const spatialCoord = CanonicalAddress369.canonicalAddressToSpatialCoord(canonicalAddress);

      const shard: StorageShard = {
        shardIndex: s,
        totalShards: shardCount,
        canonicalAddress,
        displayIndex,
        spatialCoord,
        shardData,
        shardHash
      };

      shards.push(shard);

      // Save to spatial cell store
      const existing = this.shardStore.get(canonicalAddress) || [];
      existing.push(shard);
      this.shardStore.set(canonicalAddress, existing);
    }

    const manifest: AssetManifest = {
      contentId,
      contentType,
      totalSizeBytes,
      rootHash,
      shardCount,
      shards,
      storedAt: Date.now()
    };

    this.assetRegistry.set(contentId, manifest);
    this.totalStoredBytes += totalSizeBytes;
    return manifest;
  }

  /**
   * Fetches and reassembles an asset from spatial shards with hash integrity validation.
   */
  public fetchAsset(contentId: string): RetrievedAsset {
    const t0 = performance.now();
    const manifest = this.assetRegistry.get(contentId);
    if (!manifest) {
      throw new Error(`[Storage Error] Asset '${contentId}' not found in decentralized storage matrix.`);
    }

    const buffers: Buffer[] = [];
    for (const shard of manifest.shards) {
      const chunkBuf = Buffer.from(shard.shardData, 'base64');
      const checkHash = crypto.createHash('sha256').update(chunkBuf).digest('hex');
      if (checkHash !== shard.shardHash) {
        throw new Error(`[Storage Corruption] Shard ${shard.shardIndex} hash mismatch: expected ${shard.shardHash}, got ${checkHash}`);
      }
      buffers.push(chunkBuf);
    }

    const reassembledBuffer = Buffer.concat(buffers);
    const reassembledHash = crypto.createHash('sha256').update(reassembledBuffer).digest('hex');
    const integrityVerified = reassembledHash === manifest.rootHash;
    const t1 = performance.now();
    const retrievalLatencyMs = Number((t1 - t0).toFixed(4));

    if (!integrityVerified) {
      throw new Error(`[Storage Integrity Violation] Root hash mismatch for asset: ${contentId}`);
    }

    return {
      contentId,
      contentType: manifest.contentType,
      content: reassembledBuffer.toString('utf-8'),
      totalSizeBytes: manifest.totalSizeBytes,
      rootHash: manifest.rootHash,
      integrityVerified,
      retrievalLatencyMs
    };
  }

  public getTotalStoredBytes(): number {
    return this.totalStoredBytes;
  }

  public getAssetCount(): number {
    return this.assetRegistry.size;
  }

  public listManifests(): AssetManifest[] {
    return Array.from(this.assetRegistry.values());
  }
}
