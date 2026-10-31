// oneIO.ts — File I/O + Text/Data utilities for ONE language
// Addresses: "Text / file / data I/O" (Python 100 → ONE needs 30)
// Provides: readFile, writeFile, appendFile, exists, readJSON, writeJSON,
//           readCSV, listFiles, stringify, parseJSON, readFileSync

/* eslint-disable @typescript-eslint/no-var-requires */
const fsNative = require('fs');
import * as path from 'path';

export interface FileStats {
  exists: boolean;
  sizeBytes: number;
  isDirectory: boolean;
  modifiedAt: Date;
}

export class OneIO {
  /**
   * Read entire file as string
   * Returns null if file does not exist
   */
  public static readFile(filePath: string): string | null {
    try {
      return fsNative.readFileSync(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Write string to file (overwrites)
   */
  public static async writeFile(filePath: string, content: string): Promise<boolean> {
    try {
      await fsNative.promises.writeFile(filePath, content, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Append string to file
   */
  public static async appendFile(filePath: string, content: string): Promise<boolean> {
    try {
      await fsNative.promises.appendFile(filePath, content, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if file exists
   */
  public static exists(filePath: string): boolean {
    try {
      return fsNative.existsSync(filePath);
    } catch {
      return false;
    }
  }

  /**
   * Read file as JSON — returns parsed object or null
   */
  public static readJSON(filePath: string): any | null {
    const content = this.readFile(filePath);
    if (content === null) return null;
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Write object as JSON
   */
  public static writeJSON(filePath: string, data: any): Promise<boolean> {
    try {
      return OneIO.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch {
      return Promise.resolve(false);
    }
  }

  /**
   * Read CSV — returns array of objects (first row = headers)
   */
  public static readCSV(filePath: string): any[] {
    const content = this.readFile(filePath);
    if (content === null) return [];
    const lines = content.trim().split('\n');
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row: any = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
      rows.push(row);
    }
    return rows;
  }

  /**
   * List files in directory
   */
  public static listFiles(dirPath: string): string[] {
    try {
      return fsNative.readdirSync(dirPath);
    } catch {
      return [];
    }
  }

  /**
   * Get file stats
   */
  public static getStats(filePath: string): FileStats {
    const stats = fsNative.statSync(filePath);
    return {
      exists: true,
      sizeBytes: stats.size,
      isDirectory: stats.isDirectory(),
      modifiedAt: stats.mtime,
    };
  }

  /**
   * Stringify any value (like Python's json.dumps)
   */
  public static stringify(data: any, indent: number = 2): string {
    return JSON.stringify(data, null, indent);
  }

  /**
   * Parse JSON string
   */
  public static parseJSON<T>(text: string): T {
    return JSON.parse(text);
  }
}

/**
 * Convenience functions (Python-style)
 */
export const io = OneIO;
export const fsIO = OneIO; // Alias
export const file = OneIO; // Short alias

export function read_file(filePath: string): string | null {
  return OneIO.readFile(filePath);
}

export function write_file(filePath: string, content: string): Promise<boolean> {
  return OneIO.writeFile(filePath, content);
}

export function append_file(filePath: string, content: string): Promise<boolean> {
  return OneIO.appendFile(filePath, content);
}

export function file_exists(filePath: string): boolean {
  return OneIO.exists(filePath);
}

export function read_json<T>(filePath: string): T | null {
  return OneIO.readJSON(filePath) as T;
}

export function write_json<T>(filePath: string, data: T): Promise<boolean> {
  return OneIO.writeJSON(filePath, data);
}

export function read_csv(filePath: string): any[] {
  return OneIO.readCSV(filePath);
}

export function list_files(directory: string): string[] {
  return OneIO.listFiles(directory);
}

export function print_json(data: any): string {
  return OneIO.stringify(data);
}
