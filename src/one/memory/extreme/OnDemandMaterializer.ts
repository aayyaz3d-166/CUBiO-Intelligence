/**
 * ONE Language — On-Demand Materializer
 * =====================================
 * Module: @one/memory/extreme/OnDemandMaterializer
 *
 * Implements Section 7 of Extreme-Scale 3D Memory Toolchain.
 * Provides lazy, bounded, tenant-safe materialization of virtual memory objects
 * without full-space expansion.
 */

import * as crypto from 'crypto';

export interface VirtualObjectDescriptor {
  readonly referenceUri: string;
  readonly tenantId: string;
  readonly canonicalAddress: number;
  readonly byteLength: number;
  readonly checksumSha256: string;
  readonly payloadFactory: () => Record<string, unknown>;
}

export interface MaterializedObject<T = Record<string, unknown>> {
  readonly referenceUri: string;
  readonly tenantId: string;
  readonly canonicalAddress: number;
  readonly data: T;
  readonly materializedAtMs: number;
  readonly accessCount: number;
  readonly isPinned: boolean;
}

export interface MaterializationStats {
  coldMaterializations: number;
  warmCacheHits: number;
  evictions: number;
  cacheHitRatio: number;
  activeMaterializedObjects: number;
  maxMaterializedObjects: number;
  meanLatencyMicros: number;
}

export class TenantSecurityError extends Error {
  constructor(message: string) {
    super(`[OnDemandMaterializer Tenant Security Error] ${message}`);
    this.name = 'TenantSecurityError';
  }
}

export class ChecksumIntegrityError extends Error {
  constructor(message: string) {
    super(`[OnDemandMaterializer Checksum Integrity Error] ${message}`);
    this.name = 'ChecksumIntegrityError';
  }
}

export class OnDemandMaterializer {
  private readonly descriptors: Map<string, VirtualObjectDescriptor> = new Map();
  private readonly activeCache: Map<string, MaterializedObject> = new Map();
  private readonly maxCacheSize: number;

  // Telemetry
  private coldMaterializations: number = 0;
  private warmCacheHits: number = 0;
  private evictions: number = 0;
  private totalLatencyMicros: number = 0;

  constructor(maxCacheSize: number = 1024) {
    this.maxCacheSize = maxCacheSize;
  }

  /**
   * Registers a virtual object descriptor without materializing it (zero RAM footprint).
   */
  public registerVirtualDescriptor(descriptor: VirtualObjectDescriptor): void {
    this.descriptors.set(descriptor.referenceUri, descriptor);
  }

  /**
   * Materializes an object on-demand.
   * Checks tenant security, validates checksum, and manages bounded LRU cache.
   */
  public materialize<T = Record<string, unknown>>(
    referenceUri: string,
    requestingTenantId: string = 'root'
  ): MaterializedObject<T> {
    const startNano = process.hrtime.bigint();

    // 1. Check warm cache
    const cached = this.activeCache.get(referenceUri);
    if (cached) {
      if (cached.tenantId !== requestingTenantId && requestingTenantId !== 'root') {
        throw new TenantSecurityError(`Tenant '${requestingTenantId}' denied access to '${referenceUri}' owned by '${cached.tenantId}'.`);
      }
      this.warmCacheHits++;
      (cached as { accessCount: number }).accessCount++;

      // Promote in LRU
      this.activeCache.delete(referenceUri);
      this.activeCache.set(referenceUri, cached);

      const endNano = process.hrtime.bigint();
      this.totalLatencyMicros += Number(endNano - startNano) / 1000.0;
      return cached as MaterializedObject<T>;
    }

    // 2. Fetch descriptor lazily
    const descriptor = this.descriptors.get(referenceUri);
    if (!descriptor) {
      throw new Error(`[OnDemandMaterializer Error] Unknown virtual reference '${referenceUri}'.`);
    }

    // 3. Tenant Boundary Validation
    if (descriptor.tenantId !== requestingTenantId && requestingTenantId !== 'root') {
      throw new TenantSecurityError(
        `Cross-tenant access violation: Tenant '${requestingTenantId}' attempted to materialize '${referenceUri}' belonging to '${descriptor.tenantId}'.`
      );
    }

    // 4. Cold Materialization
    this.coldMaterializations++;
    const rawData = descriptor.payloadFactory();

    // 5. Checksum Validation
    const serialized = JSON.stringify(rawData);
    const calculatedHash = crypto.createHash('sha256').update(serialized).digest('hex');
    if (descriptor.checksumSha256 && calculatedHash !== descriptor.checksumSha256) {
      throw new ChecksumIntegrityError(
        `Integrity check failed for '${referenceUri}': expected ${descriptor.checksumSha256}, got ${calculatedHash}`
      );
    }

    // 6. Enforce cache bound
    if (this.activeCache.size >= this.maxCacheSize) {
      this.evictOldest();
    }

    const materialized: MaterializedObject<T> = {
      referenceUri,
      tenantId: descriptor.tenantId,
      canonicalAddress: descriptor.canonicalAddress,
      data: rawData as unknown as T,
      materializedAtMs: Date.now(),
      accessCount: 1,
      isPinned: false,
    };

    this.activeCache.set(referenceUri, materialized as MaterializedObject);

    const endNano = process.hrtime.bigint();
    this.totalLatencyMicros += Number(endNano - startNano) / 1000.0;

    return materialized;
  }

  /**
   * Evicts the least recently accessed unpinned object.
   */
  public evictOldest(): boolean {
    for (const [key, obj] of this.activeCache.entries()) {
      if (!obj.isPinned) {
        this.activeCache.delete(key);
        this.evictions++;
        return true;
      }
    }
    return false;
  }

  /**
   * Explicit eviction by URI.
   */
  public evict(referenceUri: string): boolean {
    const deleted = this.activeCache.delete(referenceUri);
    if (deleted) this.evictions++;
    return deleted;
  }

  /**
   * Returns materialization statistics.
   */
  public getStats(): MaterializationStats {
    const totalRequests = this.coldMaterializations + this.warmCacheHits;
    const hitRatio = totalRequests > 0 ? this.warmCacheHits / totalRequests : 0;
    const meanLatency = totalRequests > 0 ? this.totalLatencyMicros / totalRequests : 0;

    return {
      coldMaterializations: this.coldMaterializations,
      warmCacheHits: this.warmCacheHits,
      evictions: this.evictions,
      cacheHitRatio: hitRatio,
      activeMaterializedObjects: this.activeCache.size,
      maxMaterializedObjects: this.maxCacheSize,
      meanLatencyMicros: meanLatency,
    };
  }

  /**
   * Clears the active working set.
   */
  public clear(): void {
    this.activeCache.clear();
  }
}
