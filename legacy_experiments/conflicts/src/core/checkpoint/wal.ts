export interface WALRecord {
  sequenceId: number;
  nodeId: string;
  operation: string;
  payloadHash: string;
  timestamp: number;
  stateData: Record<string, unknown>;
}

export class WriteAheadLog {
  private logStream: WALRecord[] = [];
  private sequenceCounter: number = 0;

  /**
   * Computes a deterministic bit-exact 32-bit FNV-1a hash of arbitrary state data.
   */
  public computeStateHash(data: unknown): string {
    const jsonStr = JSON.stringify(data);
    let hash = 0x811c9dc5;
    for (let i = 0; i < jsonStr.length; i++) {
      hash ^= jsonStr.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  public append(nodeId: string, operation: string, stateData: Record<string, unknown>): WALRecord {
    this.sequenceCounter++;
    const payloadHash = this.computeStateHash(stateData);

    const record: WALRecord = {
      sequenceId: this.sequenceCounter,
      nodeId,
      operation,
      payloadHash,
      timestamp: 369 * this.sequenceCounter, // Deterministic synthetic clock step (σ² = 0.0)
      stateData: JSON.parse(JSON.stringify(stateData)),
    };

    this.logStream.push(record);
    return record;
  }

  public getLogStream(): readonly WALRecord[] {
    return this.logStream;
  }

  public getSequenceCount(): number {
    return this.sequenceCounter;
  }

  public clear(): void {
    this.logStream = [];
    this.sequenceCounter = 0;
  }
}
