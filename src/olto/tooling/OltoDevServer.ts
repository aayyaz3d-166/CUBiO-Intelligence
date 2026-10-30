/**
 * OLTO Frontend Subsystem — Zero-Dependency Live Development Server
 * =================================================================
 * Features:
 *   - Native Node.js HTTP server (zero external npm dependencies)
 *   - Real-time file system watching on .olto source files
 *   - Auto-recompile with in-browser error reporting overlay
 *   - Live-reload heartbeat polling endpoint (/api/health)
 *   - Embedded reactive runtime & core component bundle delivery
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { OltoWebBundler } from './OltoWebBundler';

export interface DevServerOptions {
  entryFile: string;
  port?: number;
  theme?: 'dark' | 'light';
  title?: string;
  verbose?: boolean;
}

export class OltoDevServer {
  private server: http.Server | null = null;
  private watcher: fs.FSWatcher | null = null;
  private entryFile: string;
  private port: number;
  private theme: 'dark' | 'light';
  private title?: string;
  private verbose: boolean;

  private lastModified: number = Date.now();
  private cachedBundle: string = '';
  private lastError: string | null = null;
  private isRunning: boolean = false;

  constructor(options: DevServerOptions) {
    this.entryFile = path.resolve(options.entryFile);
    this.port = options.port || 3000;
    this.theme = options.theme || 'dark';
    this.title = options.title;
    this.verbose = options.verbose ?? false;

    if (!fs.existsSync(this.entryFile)) {
      throw new Error(`[OltoDevServer Error] Entry file not found: ${this.entryFile}`);
    }

    this.recompile();
  }

  /**
   * Starts the development HTTP server and begins file watching.
   */
  public start(portOverride?: number): Promise<number> {
    if (portOverride) {
      this.port = portOverride;
    }

    return new Promise((resolve, reject) => {
      try {
        this.server = http.createServer((req, res) => {
          this.handleRequest(req, res);
        });

        this.server.listen(this.port, () => {
          this.isRunning = true;
          this.startWatcher();
          if (this.verbose) {
            console.log(`[OLTO DevServer] Server active at http://localhost:${this.port}`);
          }
          resolve(this.port);
        });

        this.server.on('error', (err: any) => {
          this.stop();
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Stops the server and releases file watchers.
   */
  public stop(): Promise<void> {
    return new Promise((resolve) => {
      this.isRunning = false;
      if (this.watcher) {
        try {
          this.watcher.close();
        } catch (_) {}
        this.watcher = null;
      }

      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Returns whether the server is currently running.
   */
  public isListening(): boolean {
    return this.isRunning;
  }

  /**
   * Returns the active local URL for the dev server.
   */
  public getUrl(): string {
    return `http://localhost:${this.port}`;
  }

  /**
   * Forces a recompile of the entry file.
   */
  public recompile(): boolean {
    try {
      const source = fs.readFileSync(this.entryFile, 'utf-8');
      this.cachedBundle = OltoWebBundler.bundle(source, {
        devMode: true,
        devServerPort: this.port,
        theme: this.theme,
        title: this.title,
      });
      this.lastError = null;
      this.lastModified = Date.now();
      return true;
    } catch (err: any) {
      this.lastError = err.message || String(err);
      this.cachedBundle = this.renderErrorHTML(this.lastError);
      this.lastModified = Date.now();
      return false;
    }
  }

  /**
   * Internal request handler.
   */
  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = req.url || '/';

    // CORS headers for local tooling
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health / Live-reload polling endpoint
    if (url === '/api/health' || url.startsWith('/api/health?')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: this.lastError ? 'error' : 'ok',
          file: this.entryFile,
          updatedAt: this.lastModified,
          error: this.lastError,
        })
      );
      return;
    }

    // Main entry application bundle
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(this.cachedBundle);
      return;
    }

    // Favicon fallback
    if (url === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }

    // 404 Not Found
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`OLTO DevServer 404: Not Found (${url})`);
  }

  /**
   * Watcher setup with debouncing.
   */
  private startWatcher(): void {
    if (this.watcher) return;

    let debounceTimer: NodeJS.Timeout | null = null;
    const watchTarget = path.dirname(this.entryFile);

    try {
      this.watcher = fs.watch(watchTarget, { recursive: false }, (_eventType, filename) => {
        if (!filename) return;
        if (filename.endsWith('.olto')) {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            if (this.verbose) {
              console.log(`[OLTO DevServer] Source file changed (${filename}), recompiling...`);
            }
            this.recompile();
          }, 100);
        }
      });
    } catch (err) {
      if (this.verbose) {
        console.warn(`[OLTO DevServer] File watching fallback warning:`, err);
      }
    }
  }

  /**
   * Generates a clean developer overlay for compilation errors.
   */
  private renderErrorHTML(errorMessage: string): string {
    const escaped = errorMessage
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>OLTO Compilation Error</title>
  <style>
    body {
      margin: 0;
      padding: 32px;
      background: #0f172a;
      color: #f87171;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .card {
      background: #1e293b;
      border: 1px solid #ef4444;
      border-radius: 12px;
      padding: 24px;
      max-width: 900px;
      margin: 0 auto;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    h1 {
      margin: 0 0 16px;
      font-size: 20px;
      color: #ef4444;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    pre {
      background: #090d16;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      color: #fca5a5;
      font-size: 14px;
      line-height: 1.5;
    }
    .hint {
      margin-top: 16px;
      color: #94a3b8;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>⚠ OLTO Compiler Diagnostic Error</h1>
    <pre>${escaped}</pre>
    <div class="hint">Fix the syntax or semantic error in your <code>.olto</code> file. The browser will automatically reload once saved.</div>
  </div>
  <script>
    let lastCheck = Date.now();
    setInterval(() => {
      fetch('/api/health')
        .then(r => r.json())
        .then(d => {
          if (d.updatedAt && d.updatedAt > lastCheck && d.status === 'ok') {
            window.location.reload();
          }
        })
        .catch(() => {});
    }, 1000);
  </script>
</body>
</html>`;
  }
}
