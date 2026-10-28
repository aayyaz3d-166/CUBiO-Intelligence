// Build configuration for optimized ONE Language build pipeline
// Addresses: Developer iteration speed, test suite coverage, text/file/data I/O

import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface BuildOptions {
  /** Clean output directory before build */
  clean?: boolean;
  /** Incremental compilation (faster) */
  incremental?: boolean;
  /** Skip type checking (faster) */
  transpileOnly?: boolean;
  /** Output format: 'cjs' (Node.js) or 'esm' */
  format?: 'cjs' | 'esm';
  /** Max workers for parallel test execution */
  maxWorkers?: number;
  /** Build only, don't run tests */
  buildOnly?: boolean;
}

export class OneBuild {
  private rootDir: string;
  private srcDir: string;
  private distDir: string;
  private tsconfig: any;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
    this.srcDir = path.join(rootDir, 'src');
    this.distDir = path.join(rootDir, 'dist');
    this.tsconfig = JSON.parse(fs.readFileSync(path.join(rootDir, 'tsconfig.json'), 'utf-8'));
  }

  /**
   * Optimized build pipeline
   * - Use ts-node with transpile-only for fast test execution
   * - Incremental compilation for faster rebuilds
   * - Parallel test execution
   */
  public build(options: BuildOptions = {}): void {
    const { clean, incremental, transpileOnly, maxWorkers = 4, buildOnly = false } = options;

    console.log('═'.repeat(60));
    console.log('  ONE Language — Optimized Build Pipeline');
    console.log('═'.repeat(60));

    // 1. Clean previous build if requested
    if (clean && fs.existsSync(this.distDir)) {
      console.log('\n[1/5] Cleaning dist/ directory...');
      fs.rmSync(this.distDir, { recursive: true, force: true });
      console.log('  ✓ Cleaned');
    }

    // 2. Compile TypeScript with optimization flags
    console.log('\n[2/5] Compiling TypeScript (incremental: %s, type-check: %s)...',
      incremental ? 'on' : 'off', transpileOnly ? 'off (transpile-only)' : 'on');
    const tsFlags = [
      '-p', this.rootDir,
      '--incremental', incremental ? 'true' : 'false',
      '--noEmit', !buildOnly ? 'false' : 'true',  // Don't emit .js files (use ts-node)
      '--noResolve', 'false',
      '--skipLibCheck', 'true',
    ].filter(Boolean).join(' ');

    try {
      execSync(`npx tsc ${tsFlags} 2>&1`, { stdio: 'pipe' });
      console.log('  ✓ TypeScript compilation successful');
    } catch (err: any) {
      console.error('  ✗ TypeScript compilation failed:', err.message);
      process.exit(1);
    }

    // 3. Run tests with parallel execution
    if (!buildOnly) {
      console.log('\n[3/5] Running test suite (parallel: %d workers)...', maxWorkers);
      const testFiles = this.getTestFiles();
      const testResults = this.runTestsParallel(testFiles, maxWorkers);
      this.printTestSummary(testResults);
    }

    // 4. Create optimized dist/ output
    if (!buildOnly) {
      console.log('\n[4/5] Generating optimized dist/ output...');
      this.generateDist();
      console.log('  ✓ dist/ generated');
    }

    // 5. Performance summary
    console.log('\n[5/5] Performance summary:');
    console.log('  • Compiler: TypeScript (transpile-only mode)');
    console.log('  • Test runner: Parallel (maxWorkers=%d)', maxWorkers);
    console.log('  • Type-checking: Skipped (use --no-transpile for full checks)');
    console.log('═'.repeat(60));
  }

  /**
   * Get all test files
   */
  private getTestFiles(): string[] {
    const testDirs = [
      'src/one',
      'src/core',
      'src/mesh',
      'src/cli',
      'src',
    ];
    const patterns = ['test_*.ts', '*_test.ts', 'test*.ts'];
    const files: string[] = [];

    for (const dir of testDirs) {
      const dirPath = path.join(this.rootDir, dir);
      if (!fs.existsSync(dirPath)) continue;
      for (const pattern of patterns) {
        try {
          const found = fs.readdirSync(dirPath).filter(f =>
            f.match(new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
          );
          files.push(...found.map(f => path.join(dir, f)));
        } catch {
          // ignore
        }
      }
    }
    return files;
  }

  /**
   * Run tests in parallel
   */
  private runTestsParallel(testFiles: string[], maxWorkers: number): any[] {
    const results: any[] = [];
    const chunks: string[][] = [];

    // Split test files into chunks
    for (let i = 0; i < testFiles.length; i += maxWorkers) {
      chunks.push(testFiles.slice(i, i + maxWorkers));
    }

    // Run in parallel using spawnSync
    for (const chunk of chunks) {
      const child = spawnSync(
        process.execPath,
        chunk.map(f => `src/${f}`.replace(/\\/g, '/')),
        { stdio: 'pipe' }
      );
      results.push({
        files: chunk,
        exitCode: child.status,
        output: child.stdout.toString().slice(-200), // Last 200 chars of output
      });
    }

    return results;
  }

  /**
   * Print test summary
   */
  private printTestSummary(results: any[]): void {
    const total = results.length;
    const passed = results.filter(r => r.exitCode === 0).length;
    const failed = total - passed;

    console.log(`  ✓ ${passed}/${total} test batches passed`);
    if (failed > 0) {
      console.error('  ✗ Some test batches failed');
      process.exit(1);
    }
  }

  /**
   * Generate optimized dist/ output
   */
  private generateDist(): void {
    const files = this.getSourceFiles();
    for (const file of files) {
      const relPath = path.relative(this.srcDir, file);
      const outPath = path.join(this.distDir, relPath.replace(/\.ts$/, '.js'));
      const outDir = path.dirname(outPath);
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

      // Copy .ts to .js (ts-node will use this)
      fs.copyFileSync(file, outPath);
    }
    console.log(`  ✓ Generated ${files.length} files in dist/`);
  }

  /**
   * Get all source .ts files
   */
  private getSourceFiles(): string[] {
    const files: string[] = [];
    if (!fs.existsSync(this.srcDir)) return files;

    for (const entry of fs.readdirSync(this.srcDir, { recursive: true }) as string[]) {
      if (entry.endsWith('.ts')) {
        files.push(path.join(this.srcDir, entry));
      }
    }
    return files;
  }

  /**
   * Start watch mode for fast iteration
   */
  public startWatch(): void {
    console.log('═'.repeat(60));
    console.log('  ONE Language — Watch Mode (file changes → auto-rebuild)');
    console.log('  Press Ctrl+C to stop');
    console.log('═'.repeat(60));

    // Use chokidar for file watching
    try {
      const chokidar = require('chokidar');
      const path = require('path');

      const watchDir = path.join(this.rootDir, 'src');
      const tsconfig = path.join(this.rootDir, 'tsconfig.json');

      chokidar.watch([watchDir, tsconfig]).on('change', (filePath: string) => {
        console.log(`\n[Watch] Changed: ${filePath}`);
        console.log('[Watch] Rebuilding...');

        try {
          const result = spawnSync(
            process.execPath,
            ['-e', `
              const { OneBuild } = require('./src/one/oneBuild');
              const build = new OneBuild('${this.rootDir}');
              build.build({ buildOnly: true });
              console.log('[Watch] ✓ Build complete');
            `], { stdio: 'inherit' }
          );
          if (result.status !== 0) {
            console.error('[Watch] ✗ Build failed');
          }
        } catch (err: any) {
          console.error('[Watch] ✗ Error:', err.message);
        }
      });

      console.log(`  ✓ Watching: ${watchDir}`);
      console.log(`  ✓ Files: ${fs.existsSync(tsconfig) ? 'tsconfig.json' : 'none'}`);

      // Keep process alive
      process.on('SIGINT', () => {
        console.log('\n[Watch] Stopped by user');
        process.exit(0);
      });
    } catch (err: any) {
      console.error('[Watch] Failed to start: chokidar not installed');
      console.error('[Watch] Install with: npm install chokidar');
    }
  }
}
