/**
 * Phase 7A — Write-Ahead Log (WAL)
 *
 * JSONL-based append-only log for safe state mutation persistence.
 * Each entry is a JSON object written synchronously to wal.log.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface WALEntry {
  /** Monotonic sequence number */
  seq: number;
  /** ISO timestamp */
  timestamp: string;
  /** Type of mutation */
  type: 'node_create' | 'node_remove' | 'variable_set' | 'variable_delete' | 'funnel_open' | 'funnel_close' | 'rss_set' | 'mesh_register' | 'mesh_unregister' | 'checkpoint' | 'custom';
  /** Human-readable description */
  description: string;
  /** Serialized payload (scheme-dependent) */
  payload: Record<string, any>;
}

export interface WALConfig {
  /** Directory for WAL files */
  logDir: string;
  /** WAL log file name */
  logFile?: string;
  /** Maximum entries before forced checkpoint (0 = unlimited) */
  maxEntriesBeforeCheckpoint?: number;
}

const DEFAULT_CONFIG: Required<WALConfig> = {
  logDir: './data/one_state',
  logFile: 'wal.log',
  maxEntriesBeforeCheckpoint: 1000,
};

export class WriteAheadLog {
  private config: Required<WALConfig>;
  private filePath: string;
  private seq: number;
  private entriesSinceCheckpoint: number;
  private writeBuffer: string[];

  constructor(config: Partial<WALConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.filePath = path.resolve(this.config.logDir, this.config.logFile!);
    this.seq = 0;
    this.entriesSinceCheckpoint = 0;
    this.writeBuffer = [];

    // Ensure log directory exists
    fs.mkdirSync(this.config.logDir, { recursive: true });
  }

  /**
   * Append a WAL entry atomically (sync write).
   */
  public append(entry: Omit<WALEntry, 'seq' | 'timestamp'>): WALEntry {
    this.seq++;
    const fullEntry: WALEntry = {
      ...entry,
      seq: this.seq,
      timestamp: new Date().toISOString(),
    };

    const line = JSON.stringify(fullEntry) + '\n';
    this.writeBuffer.push(line);

    // Flush immediately for crash safety
    this.flush();

    this.entriesSinceCheckpoint++;
    return fullEntry;
  }

  /**
   * Batch append multiple entries.
   */
  public appendBatch(entries: Array<Omit<WALEntry, 'seq' | 'timestamp'>>): WALEntry[] {
    return entries.map(e => this.append(e));
  }

  /**
   * Synchronously flush buffered writes to disk.
   */
  private flush(): void {
    if (this.writeBuffer.length === 0) return;
    const data = this.writeBuffer.join('');
    fs.appendFileSync(this.filePath, data, 'utf-8');
    this.writeBuffer = [];
  }

  /**
   * Read all WAL entries from disk.
   */
  public readAll(): WALEntry[] {
    if (!fs.existsSync(this.filePath)) return [];
    const content = fs.readFileSync(this.filePath, 'utf-8');
    if (!content.trim()) return [];
    const lines = content.trim().split('\n');
    const entries: WALEntry[] = [];
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as WALEntry;
        entries.push(parsed);
      } catch {
        // Skip corrupt lines
      }
    }
    this.seq = entries.length > 0 ? entries[entries.length - 1].seq : 0;
    return entries;
  }

  /**
   * Read WAL entries after a given sequence number.
   */
  public readSince(seq: number): WALEntry[] {
    const all = this.readAll();
    return all.filter(e => e.seq > seq);
  }

  /**
   * Get the latest sequence number.
   */
  public getLatestSeq(): number {
    return this.seq;
  }

  /**
   * Truncate the WAL (called after successful checkpoint).
   */
  public truncate(): void {
    this.writeBuffer = [];
    this.entriesSinceCheckpoint = 0;
    if (fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, '', 'utf-8');
    }
    this.seq = 0;
  }

  /**
   * Get count of entries since last checkpoint.
   */
  public getEntriesSinceCheckpoint(): number {
    return this.entriesSinceCheckpoint;
  }

  /**
   * Get total entry count.
   */
  public getTotalEntries(): number {
    return this.readAll().length;
  }

  /**
   * Close and flush any remaining buffer.
   */
  public close(): void {
    this.flush();
  }

  /**
   * Remove the WAL file (for clean reset).
   */
  public remove(): void {
    this.close();
    if (fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
    }
    this.seq = 0;
    this.entriesSinceCheckpoint = 0;
  }
}
