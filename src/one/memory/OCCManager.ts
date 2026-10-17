/**
 * ONE Language — Optimistic Concurrency Control (OCC) Engine
 * ==========================================================
 * Module: @one/memory/OCCManager
 *
 * Enforces sovereign, lock-free concurrency control across memory mutations.
 * Tracks read sets and write sets during transactions, validating version invariants
 * before atomic commit. Rejects conflicting mutations fail-closed.
 */

export interface OCCObjectMeta {
  key: string;
  version: number;
  lastCommittedAt: number;
  commitHash: string;
}

export interface OCCTransaction {
  txId: string;
  readSet: Map<string, number>; // key -> observed version
  writeSet: Map<string, unknown>; // key -> new payload
  startedAt: number;
  status: 'ACTIVE' | 'COMMITTED' | 'ABORTED' | 'CONFLICT';
}

export class OCCManager {
  private versions: Map<string, OCCObjectMeta> = new Map();
  private activeTx: Map<string, OCCTransaction> = new Map();

  /**
   * Registers or initializes an object's version tag.
   */
  public register(key: string, initialVersion: number = 1, initialHash: string = '0xINIT'): OCCObjectMeta {
    const meta: OCCObjectMeta = {
      key,
      version: initialVersion,
      lastCommittedAt: Date.now(),
      commitHash: initialHash,
    };
    this.versions.set(key, meta);
    return meta;
  }

  /**
   * Returns current metadata for a key.
   */
  public getMeta(key: string): OCCObjectMeta | undefined {
    return this.versions.get(key);
  }

  /**
   * Returns current version number for a key (defaults to 1 if unregistered).
   */
  public getVersion(key: string): number {
    return this.versions.get(key)?.version ?? 1;
  }

  /**
   * Begins a new transaction.
   */
  public beginTransaction(txId: string): OCCTransaction {
    if (this.activeTx.has(txId)) {
      throw new Error(`[OCC Error] Transaction '${txId}' is already active.`);
    }

    const tx: OCCTransaction = {
      txId,
      readSet: new Map(),
      writeSet: new Map(),
      startedAt: Date.now(),
      status: 'ACTIVE',
    };

    this.activeTx.set(txId, tx);
    return tx;
  }

  /**
   * Records a read operation in the transaction's read set.
   */
  public recordRead(txId: string, key: string): number {
    const tx = this.activeTx.get(txId);
    if (!tx || tx.status !== 'ACTIVE') {
      throw new Error(`[OCC Error] Transaction '${txId}' not active.`);
    }

    const currentVersion = this.getVersion(key);
    tx.readSet.set(key, currentVersion);
    return currentVersion;
  }

  /**
   * Stages a write operation in the transaction's write set.
   */
  public stageWrite(txId: string, key: string, payload: unknown): void {
    const tx = this.activeTx.get(txId);
    if (!tx || tx.status !== 'ACTIVE') {
      throw new Error(`[OCC Error] Transaction '${txId}' not active.`);
    }

    tx.writeSet.set(key, payload);
  }

  /**
   * Validates whether all keys in readSet match current committed versions.
   */
  public validate(txId: string): { valid: boolean; conflicts: string[] } {
    const tx = this.activeTx.get(txId);
    if (!tx) {
      throw new Error(`[OCC Error] Transaction '${txId}' not found.`);
    }

    const conflicts: string[] = [];
    for (const [key, observedVersion] of tx.readSet.entries()) {
      const current = this.getVersion(key);
      if (current !== observedVersion) {
        conflicts.push(`Key '${key}': observed v${observedVersion} != current v${current}`);
      }
    }

    return {
      valid: conflicts.length === 0,
      conflicts,
    };
  }

  /**
   * Atomically commits a transaction if validation succeeds.
   */
  public commit(txId: string, newHashGenerator?: (key: string, v: number) => string): Map<string, number> {
    const tx = this.activeTx.get(txId);
    if (!tx || tx.status !== 'ACTIVE') {
      throw new Error(`[OCC Error] Transaction '${txId}' is not active.`);
    }

    const validation = this.validate(txId);
    if (!validation.valid) {
      tx.status = 'CONFLICT';
      throw new Error(
        `[OCC E7010] Concurrency conflict detected in transaction '${txId}':\n  ${validation.conflicts.join('\n  ')}`
      );
    }

    // Apply writes and bump versions
    const committedVersions = new Map<string, number>();
    const now = Date.now();

    for (const [key] of tx.writeSet.entries()) {
      const currentMeta = this.versions.get(key);
      const nextVersion = (currentMeta?.version ?? 0) + 1;
      const hash = newHashGenerator ? newHashGenerator(key, nextVersion) : `0xOCC_${nextVersion}_${now}`;

      this.versions.set(key, {
        key,
        version: nextVersion,
        lastCommittedAt: now,
        commitHash: hash,
      });

      committedVersions.set(key, nextVersion);
    }

    tx.status = 'COMMITTED';
    this.activeTx.delete(txId);
    return committedVersions;
  }

  /**
   * Aborts a transaction.
   */
  public abort(txId: string): void {
    const tx = this.activeTx.get(txId);
    if (tx) {
      tx.status = 'ABORTED';
      this.activeTx.delete(txId);
    }
  }

  /**
   * Checks if an atomic single-key update is valid.
   */
  public verifyAndBump(key: string, expectedVersion: number, newHash: string = '0xCOMMITTED'): number {
    const current = this.getVersion(key);
    if (current !== expectedVersion) {
      throw new Error(
        `[OCC E7010] Atomic update conflict on key '${key}': expected v${expectedVersion}, found v${current}.`
      );
    }

    const next = current + 1;
    this.versions.set(key, {
      key,
      version: next,
      lastCommittedAt: Date.now(),
      commitHash: newHash,
    });

    return next;
  }
}
