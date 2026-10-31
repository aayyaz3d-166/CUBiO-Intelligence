/**
 * Oview OS — Sovereign Standalone Desktop Application Runner (Target A)
 * ======================================================================
 * DesktopRunner.ts: Generates and executes the standalone portable desktop
 * application bundle without external dependencies (no Electron, no React),
 * running as an isolated sovereign desktop window via native WebView.
 */

import * as fs from 'fs';
import * as path from 'path';
import { OviewBundler } from '../tooling/OviewBundler';

export interface DesktopRunnerOptions {
  width?: number;
  height?: number;
  frameless?: boolean;
  kiosk?: boolean;
  theme?: 'cyber-glass' | 'deep-space' | 'neon-matrix';
  outputDir?: string;
}

export class DesktopRunner {
  private static instance: DesktopRunner | null = null;

  private constructor() {}

  public static getInstance(): DesktopRunner {
    if (!DesktopRunner.instance) {
      DesktopRunner.instance = new DesktopRunner();
    }
    return DesktopRunner.instance;
  }

  /**
   * Builds the standalone portable desktop bundle and runner scripts.
   */
  public generateBundle(options: DesktopRunnerOptions = {}): { htmlPath: string; batPath: string; ps1Path: string } {
    const outDir = path.resolve(options.outputDir || 'dist/oview');
    fs.mkdirSync(outDir, { recursive: true });

    const htmlPath = path.join(outDir, 'index.html');
    OviewBundler.bundleToFile(htmlPath, {
      title: 'Oview OS — Sovereign Desktop Environment',
    });

    const width = options.width || 1280;
    const height = options.height || 800;

    // 1. Windows Native Launcher (BAT)
    // Uses built-in Windows msedge --app (zero electron, zero npm dependency, standalone app window)
    const batPath = path.join(outDir, 'run-oview.bat');
    const batContent = `@echo off
title Oview OS — Sovereign Desktop Environment
echo ================================================================================
echo   Oview OS: Launching Sovereign Standalone Desktop Environment...
echo   Powered by ONE Language, OLTO Reactive Windowing, and ECHO-1 AI Core
echo ================================================================================

set HTML_PATH=%~dp0index.html

:: Detect Microsoft Edge / Chrome in App Mode (Frameless window without browser tabs or URL bar)
start msedge --app="file:///%HTML_PATH%" --window-size=${width},${height} --no-first-run --no-default-browser-check

if errorlevel 1 (
    start chrome --app="file:///%HTML_PATH%" --window-size=${width},${height}
)
if errorlevel 1 (
    start "" "%HTML_PATH%"
)
`;
    fs.writeFileSync(batPath, batContent, 'utf-8');

    // 2. PowerShell High-Performance Native Launcher (PS1)
    const ps1Path = path.join(outDir, 'run-oview.ps1');
    const ps1Content = `# Oview OS Sovereign Desktop Runner
$htmlPath = Join-Path $PSScriptRoot "index.html"
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "  OVIEW OS: Launching Sovereign Standalone Desktop Environment..." -ForegroundColor Green
Write-Host "  Substrate: ONE Language Core | GUI: OLTO Engine | AI: ECHO-1 Offline Brain" -ForegroundColor Gray
Write-Host "================================================================================" -ForegroundColor Cyan

# Launch in dedicated application window mode
Start-Process "msedge" -ArgumentList "--app=file:///$htmlPath --window-size=${width},${height} --no-first-run" -ErrorAction SilentlyContinue
`;
    fs.writeFileSync(ps1Path, ps1Content, 'utf-8');

    return { htmlPath, batPath, ps1Path };
  }
}
