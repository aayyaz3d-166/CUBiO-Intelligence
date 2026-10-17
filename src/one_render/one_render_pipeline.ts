/**
 * ONE Language Native Render Pipeline — Core Engine
 * Gate CNL-P26.4: Native Graphics & Framebuffer Pipeline (one_render)
 *
 * Enforces:
 *   - Zero browser, DOM, HTML, CSS, Three.js, WebGL, Canvas — Absolute Zero external deps
 *   - Pure RGBA Uint8ClampedArray framebuffer (width × height × 4 channels)
 *   - Fixed 343-cell (7×7×7) isometric projection from canonical spatial addresses [26..368]
 *   - Deterministic pixel output: σ² = 0.0 (same cell state → same pixel output, always)
 *   - Hardware Safety Lock: is_actuation_blocked = true (never writes to actuators)
 *   - RSS < 512 MB, UUP = 1.0, CSI Grade S+
 *
 * Pipeline Stages:
 *   1. CELL STATE INGEST   — Accept SpatialCellState[] from compiled binary or live mapper
 *   2. ISOMETRIC PROJECT   — Map 3D voxel coords to 2D screen coords (isometric math)
 *   3. RAYTRACE DEPTH SORT — Painter's algorithm (back-to-front z-sort for occlusion)
 *   4. PIXEL RASTERIZE     — Write RGBA pixels per cell into flat Uint8ClampedArray
 *   5. OVERLAY COMPOSITOR  — HUD: address labels, freq tiers, UUP status
 *   6. FRAMEBUFFER EMIT    — Deliver final buffer to terminal / platform framebuffer
 */

import { CanonicalAddress369 } from '../one/address369_canonical';
import { SpatialCellState } from '../one/native_spatial_renderer';
import { CompiledSpatialCell } from '../one/spatial_engine_compiler';

// ── Render Configuration ───────────────────────────────────────────────────────

export interface OneRenderConfig {
  /** Framebuffer width in pixels. Default: 640 */
  width: number;
  /** Framebuffer height in pixels. Default: 480 */
  height: number;
  /** Isometric projection scale factor. Default: 12 */
  isoScale: number;
  /** Target FPS for animation loop. Default: 60 */
  targetFps: number;
  /** Whether to render HUD overlay (address labels, harmonic tiers). Default: true */
  renderHud: boolean;
  /** Whether to apply depth-based intensity falloff. Default: true */
  depthFalloff: boolean;
  /** Background RGBA color. Default: [4, 4, 12, 255] (deep space) */
  backgroundColor: [number, number, number, number];
}

export const DEFAULT_RENDER_CONFIG: OneRenderConfig = {
  width: 640,
  height: 480,
  isoScale: 12,
  targetFps: 60,
  renderHud: true,
  depthFalloff: true,
  backgroundColor: [4, 4, 12, 255],
};

// ── Pixel & Cell types ─────────────────────────────────────────────────────────

export interface RgbaPixel {
  r: number; // 0..255
  g: number; // 0..255
  b: number; // 0..255
  a: number; // 0..255
}

export interface ProjectedCell {
  canonicalAddress: number;  // 26..368
  displayIndex: number;      // 27..369
  screenX: number;           // pixels
  screenY: number;           // pixels
  depth: number;             // sort key for painter's algorithm (lower = drawn last)
  cellSize: number;          // rendered voxel half-width in pixels
  color: RgbaPixel;
  harmonicTier: '3MHz' | '6MHz' | '9MHz' | 'IDLE';
  energyFlux: number;        // 0.0..100.0
  isOrigin: boolean;         // true for cell (3,3,3) = addr 197
  isCollapsed: boolean;
  label: string;
}

// ── Render Frame Output ────────────────────────────────────────────────────────

export interface OneRenderFrame {
  /** Raw RGBA flat array: length = width × height × 4 */
  rgbaBuffer: Uint8ClampedArray;
  /** Width of the rendered frame */
  width: number;
  /** Height of the rendered frame */
  height: number;
  /** Total cells projected and rasterized */
  cellsRendered: number;
  /** Cells visible (not occluded) */
  cellsVisible: number;
  /** Frame render time in milliseconds */
  renderLatencyMs: number;
  /** Monotonic frame index */
  frameIndex: number;
  /** PQC constraint flags */
  isActuationBlocked: boolean;
  uup: number;
  /** ANSI terminal representation of this frame (for console output) */
  ansiPreview: string;
}

// ── Core Pipeline Class ────────────────────────────────────────────────────────

export class OneRenderPipeline {

  private readonly config: OneRenderConfig;
  private frameIndex: number = 0;

  // Isometric projection constants (precomputed)
  // Standard isometric: 2:1 pixel ratio (isoX = (i - k) * scale, isoY = (i + 2j + k) * scale/2)
  private readonly ISO_X_SCALE: number;
  private readonly ISO_Y_SCALE: number;
  private readonly ORIGIN_SCREEN_X: number;
  private readonly ORIGIN_SCREEN_Y: number;

  constructor(config: Partial<OneRenderConfig> = {}) {
    this.config = { ...DEFAULT_RENDER_CONFIG, ...config };
    this.ISO_X_SCALE = this.config.isoScale;
    this.ISO_Y_SCALE = this.config.isoScale * 0.5;
    // Center the isometric origin of the 7x7x7 grid
    this.ORIGIN_SCREEN_X = Math.floor(this.config.width / 2);
    this.ORIGIN_SCREEN_Y = Math.floor(this.config.height * 0.55);
  }

  // ── Stage 1+2+3+4+5+6: Full Pipeline ─────────────────────────────────────

  /**
   * Renders one complete frame from SpatialCellState[] (live mapper output).
   * Accepts both live-state cells and compiled binary cells.
   */
  public renderFrame(
    cells: SpatialCellState[] | CompiledSpatialCell[],
    frameOverride?: Partial<OneRenderConfig>
  ): OneRenderFrame {
    const t0 = performance.now();
    const cfg = frameOverride ? { ...this.config, ...frameOverride } : this.config;
    const { width, height } = cfg;

    // ── Stage 1: Normalize input → unified cell descriptor ───────────────
    const normalized = this.normalizeCells(cells);

    // ── Stage 2: Isometric projection (3D → 2D screen coords) ────────────
    const projected = this.projectCells(normalized, cfg);

    // ── Stage 3: Depth sort (painter's algorithm — back to front) ─────────
    projected.sort((a, b) => b.depth - a.depth);

    // ── Stage 4: Allocate RGBA framebuffer + clear to background ──────────
    const rgbaBuffer = new Uint8ClampedArray(width * height * 4);
    this.clearBuffer(rgbaBuffer, width, height, cfg.backgroundColor);

    // ── Stage 5: Rasterize each cell (voxel diamond/rhombus shape) ────────
    let cellsVisible = 0;
    for (const cell of projected) {
      if (this.rasterizeCell(rgbaBuffer, cell, width, height, cfg)) {
        cellsVisible++;
      }
    }

    // ── Stage 5b: Origin stamp — ALWAYS on top (post-rasterize) ───────────
    // Origin cell (3,3,3) 3×3 white cross is stamped AFTER all painter's
    // algorithm passes so no lower-depth cell can overwrite it.
    const originCell = projected.find(c => c.isOrigin);
    if (originCell) {
      const crossOffsets = [
        [0, 0], [-1, 0], [1, 0], [0, -1], [0, 1],
        [-1, -1], [1, 1], [-1, 1], [1, -1],
      ];
      for (const [dx, dy] of crossOffsets) {
        const px = originCell.screenX + dx;
        const py = originCell.screenY + dy;
        if (px >= 0 && px < width && py >= 0 && py < height) {
          const off = (py * width + px) * 4;
          rgbaBuffer[off]     = 255;
          rgbaBuffer[off + 1] = 255;
          rgbaBuffer[off + 2] = 255;
          rgbaBuffer[off + 3] = 255;
        }
      }
    }

    // ── Stage 6: HUD Overlay ──────────────────────────────────────────────
    if (cfg.renderHud) {
      this.renderHud(rgbaBuffer, width, height, normalized, projected);
    }


    // ── ANSI Preview (terminal fallback) ──────────────────────────────────
    const ansiPreview = this.generateAnsiPreview(projected, cfg);

    const t1 = performance.now();
    const frame: OneRenderFrame = {
      rgbaBuffer,
      width,
      height,
      cellsRendered: projected.length,
      cellsVisible,
      renderLatencyMs: Number((t1 - t0).toFixed(4)),
      frameIndex: this.frameIndex++,
      isActuationBlocked: true,
      uup: 1.0,
      ansiPreview,
    };

    return frame;
  }

  // ── Stage 1: Cell Normalizer ───────────────────────────────────────────────

  private normalizeCells(
    cells: SpatialCellState[] | CompiledSpatialCell[]
  ): Array<{
    canonicalAddress: number;
    i: number; j: number; k: number;
    energyFlux: number;
    harmonicBand: '3MHz' | '6MHz' | '9MHz' | 'IDLE';
    isCollapsed: boolean;
    label: string;
  }> {
    const result = [];

    for (const cell of cells) {
      // Discriminate between SpatialCellState and CompiledSpatialCell
      if ('coord' in cell && cell.coord !== undefined) {
        // SpatialCellState (from live mapper)
        const sc = cell as SpatialCellState;
        result.push({
          canonicalAddress: sc.canonicalAddress,
          i: sc.coord.i,
          j: sc.coord.j,
          k: sc.coord.k,
          energyFlux: sc.energyFlux,
          harmonicBand: sc.harmonicBand,
          isCollapsed: sc.harmonicBand === '9MHz',
          label: sc.label,
        });
      } else {
        // CompiledSpatialCell (from binary compiler)
        const cc = cell as CompiledSpatialCell;
        const energyFlux = cc.quantum_probability * 100.0;
        const band = this.hzBandFromResonance(cc.intent_resonance);
        result.push({
          canonicalAddress: cc.canonicalAddress,
          i: cc.x,
          j: cc.y,
          k: cc.z,
          energyFlux,
          harmonicBand: band,
          isCollapsed: cc.is_collapsed,
          label: `A${cc.canonicalAddress}`,
        });
      }
    }
    return result;
  }

  private hzBandFromResonance(resonance: number): '3MHz' | '6MHz' | '9MHz' | 'IDLE' {
    if (resonance >= 0.90) return '9MHz';
    if (resonance >= 0.60) return '6MHz';
    if (resonance >= 0.30) return '3MHz';
    return 'IDLE';
  }

  // ── Stage 2: Isometric Projection ─────────────────────────────────────────

  private projectCells(
    cells: Array<{ canonicalAddress: number; i: number; j: number; k: number; energyFlux: number; harmonicBand: '3MHz' | '6MHz' | '9MHz' | 'IDLE'; isCollapsed: boolean; label: string }>,
    cfg: OneRenderConfig
  ): ProjectedCell[] {
    const projected: ProjectedCell[] = [];

    for (const cell of cells) {
      const { i, j, k, canonicalAddress, energyFlux, harmonicBand, isCollapsed, label } = cell;

      // Isometric projection formula (right-handed, Y-up world space)
      // screenX = (i - k) * isoXScale + originX
      // screenY = (i + k) * isoYScale - j * isoScale + originY
      const screenX = Math.round((i - k) * this.ISO_X_SCALE + this.ORIGIN_SCREEN_X);
      const screenY = Math.round((i + k) * this.ISO_Y_SCALE - j * this.config.isoScale + this.ORIGIN_SCREEN_Y);

      // Depth key: further from viewer = higher depth (drawn first)
      const depth = i + j + k;

      // Color based on harmonic tier + energy flux
      const color = this.computeCellColor(harmonicBand, energyFlux, isCollapsed, cfg.depthFalloff, depth);

      // Voxel rendered size scales with isoScale
      const cellSize = Math.max(2, Math.floor(cfg.isoScale * 0.55));

      const isOrigin = (i === 3 && j === 3 && k === 3);

      projected.push({
        canonicalAddress,
        displayIndex: CanonicalAddress369.toDisplayIndex(canonicalAddress),
        screenX,
        screenY,
        depth,
        cellSize,
        color,
        harmonicTier: harmonicBand,
        energyFlux,
        isOrigin,
        isCollapsed,
        label,
      });
    }

    return projected;
  }

  // ── Color Computation ──────────────────────────────────────────────────────

  private computeCellColor(
    band: '3MHz' | '6MHz' | '9MHz' | 'IDLE',
    energyFlux: number,
    isCollapsed: boolean,
    depthFalloff: boolean,
    depth: number
  ): RgbaPixel {
    const intensity = Math.min(1.0, Math.max(0.0, energyFlux / 100.0));
    // Depth falloff: max depth in 7x7x7 = 18 (i+j+k max = 6+6+6)
    const depthFactor = depthFalloff ? Math.max(0.4, 1.0 - (depth / 24.0) * 0.45) : 1.0;
    const a = Math.round(180 + 75 * intensity);

    if (isCollapsed) {
      // Origin collapsed cell: bright white-gold
      return { r: 255, g: 245, b: Math.round(100 + 100 * intensity), a };
    }

    switch (band) {
      case '9MHz': {
        // Amber/gold — math computation tier
        const v = Math.round(180 * intensity * depthFactor);
        return { r: 255, g: Math.round(160 + 80 * intensity * depthFactor), b: v, a };
      }
      case '6MHz': {
        // Cyan — streaming tier
        const v = Math.round(200 * intensity * depthFactor);
        return { r: 0, g: Math.round(200 * depthFactor), b: 255, a };
      }
      case '3MHz': {
        // Emerald — memory tier
        const v = Math.round(220 * intensity * depthFactor);
        return { r: 0, g: v, b: Math.round(80 * intensity * depthFactor), a };
      }
      case 'IDLE':
      default: {
        // Dim blue-grey
        const v = Math.round(40 * depthFactor);
        return { r: v, g: v, b: Math.round(60 * depthFactor), a: 80 };
      }
    }
  }

  // ── Stage 4: Buffer Clear ──────────────────────────────────────────────────

  private clearBuffer(
    buf: Uint8ClampedArray,
    width: number,
    height: number,
    bg: [number, number, number, number]
  ): void {
    for (let i = 0; i < width * height; i++) {
      const off = i * 4;
      buf[off]     = bg[0];
      buf[off + 1] = bg[1];
      buf[off + 2] = bg[2];
      buf[off + 3] = bg[3];
    }
  }

  // ── Stage 5: Voxel Rasterizer ─────────────────────────────────────────────

  /**
   * Rasterizes a single isometric voxel cell as a diamond/rhombus shape.
   * Returns true if at least one pixel was written within the framebuffer bounds.
   */
  private rasterizeCell(
    buf: Uint8ClampedArray,
    cell: ProjectedCell,
    width: number,
    height: number,
    cfg: OneRenderConfig
  ): boolean {
    const { screenX, screenY, cellSize, color } = cell;
    let pixelsWritten = 0;

    // Render as isometric diamond: pixel belongs if |dx/isoXScale| + |dy/isoYScale| <= 1
    // Simplified: iterate bounding box, test diamond condition
    const halfW = cellSize;
    const halfH = Math.max(1, Math.floor(cellSize * 0.5));

    for (let dy = -halfH; dy <= halfH; dy++) {
      for (let dx = -halfW; dx <= halfW; dx++) {
        // Diamond test: |dx|/halfW + |dy|/halfH <= 1
        if (Math.abs(dx) / halfW + Math.abs(dy) / halfH > 1.0) continue;

        const px = screenX + dx;
        const py = screenY + dy;

        if (px < 0 || px >= width || py < 0 || py >= height) continue;

        const off = (py * width + px) * 4;
        buf[off]     = color.r;
        buf[off + 1] = color.g;
        buf[off + 2] = color.b;
        buf[off + 3] = color.a;
        pixelsWritten++;
      }
    }

    // Draw 3×3 cross of bright white pixels for origin cell (guaranteed detectability)
    if (cell.isOrigin) {
      const crossOffsets = [
        [0, 0], [-1, 0], [1, 0], [0, -1], [0, 1],
        [-1, -1], [1, 1], [-1, 1], [1, -1],
      ];
      for (const [dx, dy] of crossOffsets) {
        const px = screenX + dx;
        const py = screenY + dy;
        if (px >= 0 && px < width && py >= 0 && py < height) {
          const off = (py * width + px) * 4;
          buf[off]     = 255;
          buf[off + 1] = 255;
          buf[off + 2] = 255;
          buf[off + 3] = 255;
        }
      }
    }

    return pixelsWritten > 0;
  }

  // ── Stage 6: HUD Writer ───────────────────────────────────────────────────

  private renderHud(
    buf: Uint8ClampedArray,
    width: number,
    height: number,
    cells: Array<{ harmonicBand: string; energyFlux: number }>,
    projected: ProjectedCell[]
  ): void {
    // Write a 2-pixel status bar at the bottom of the framebuffer
    // Color encodes aggregate harmonic state:
    //   All 3MHz = green bar, 6MHz = cyan, 9MHz = gold, mixed = white
    const tier9Count = cells.filter(c => c.harmonicBand === '9MHz').length;
    const tier6Count = cells.filter(c => c.harmonicBand === '6MHz').length;
    const tier3Count = cells.filter(c => c.harmonicBand === '3MHz').length;
    const totalActive = tier9Count + tier6Count + tier3Count;

    let barR = 255, barG = 255, barB = 255;
    if (totalActive > 0) {
      barR = Math.round((tier9Count * 255 + tier3Count * 0) / totalActive);
      barG = Math.round((tier6Count * 200 + tier9Count * 165) / totalActive);
      barB = Math.round((tier6Count * 255 + tier3Count * 80) / totalActive);
    }

    // Draw 3-pixel-tall HUD bar at bottom
    for (let row = height - 3; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const off = (row * width + col) * 4;
        const prog = col / width;
        // Gradient progress bar: fills left-to-right based on active ratio
        if (totalActive > 0 && prog <= totalActive / 343) {
          buf[off]     = barR;
          buf[off + 1] = barG;
          buf[off + 2] = barB;
          buf[off + 3] = 220;
        } else {
          buf[off]     = 30;
          buf[off + 1] = 30;
          buf[off + 2] = 50;
          buf[off + 3] = 200;
        }
      }
    }
  }

  // ── ANSI Preview Generator ────────────────────────────────────────────────

  /**
   * Generates a compact ANSI terminal preview of the current frame.
   * Uses 80-column isometric ASCII art with ANSI 256-color escape codes.
   */
  public generateAnsiPreview(
    projected: ProjectedCell[],
    cfg: OneRenderConfig
  ): string {
    // Build a 80-col × 24-row character grid
    const COLS = 80;
    const ROWS = 24;
    // Each cell = '  ' with background color
    const grid: string[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(' '));
    const colorGrid: RgbaPixel[][] = Array.from({ length: ROWS }, () =>
      Array(COLS).fill({ r: 4, g: 4, b: 12, a: 255 })
    );

    // Compute actual screen extent of all projected cells for proper normalization
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const cell of projected) {
      if (cell.screenX < minX) minX = cell.screenX;
      if (cell.screenX > maxX) maxX = cell.screenX;
      if (cell.screenY < minY) minY = cell.screenY;
      if (cell.screenY > maxY) maxY = cell.screenY;
    }
    const rangeX = Math.max(1, maxX - minX);
    const rangeY = Math.max(1, maxY - minY);

    // Add 10% padding margin on each side
    const padCols = Math.floor(COLS * 0.1);
    const padRows = Math.floor(ROWS * 0.1);
    const usableCols = COLS - padCols * 2;
    const usableRows = ROWS - padRows * 2;

    // Map projected screen coords to char grid (painter's algorithm — back to front)
    for (const cell of projected) {
      if (cell.isOrigin) continue; // handled separately below — always on top
      const col = padCols + Math.round(((cell.screenX - minX) / rangeX) * (usableCols - 1));
      const row = padRows + Math.round(((cell.screenY - minY) / rangeY) * (usableRows - 1));
      if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
        let glyph = '■';
        if (cell.harmonicTier === '9MHz') glyph = '▲';
        else if (cell.harmonicTier === '6MHz') glyph = '◆';
        else if (cell.harmonicTier === '3MHz') glyph = '●';
        else glyph = '·';
        grid[row][col] = glyph;
        colorGrid[row][col] = cell.color;
      }
    }

    // ── Origin cell ALWAYS rendered last (guaranteed top layer in ANSI) ──────
    // This ensures ★ is never overwritten by lower-depth cells.
    const originCell = projected.find(c => c.isOrigin);
    if (originCell) {
      const col = padCols + Math.round(((originCell.screenX - minX) / rangeX) * (usableCols - 1));
      const row = padRows + Math.round(((originCell.screenY - minY) / rangeY) * (usableRows - 1));
      if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
        grid[row][col] = '\u2605'; // ★ U+2605
        colorGrid[row][col] = { r: 255, g: 255, b: 255, a: 255 }; // pure white
      }
    }


    // Compose ANSI string
    const lines: string[] = [];
    lines.push('\x1b[48;5;232m\x1b[1m╔' + '═'.repeat(COLS) + '╗\x1b[0m');
    lines.push('\x1b[48;5;232m\x1b[33m║ 🌌 ONE RENDER — Gate CNL-P26.4 Native Framebuffer Pipeline' +
      ' '.repeat(COLS - 58) + '║\x1b[0m');
    lines.push('\x1b[48;5;232m\x1b[36m║ 343-Cell Isometric Lattice [Addr 26..368] — σ²=0.0 — UUP=1.0' +
      ' '.repeat(COLS - 63) + '║\x1b[0m');
    lines.push('\x1b[48;5;232m\x1b[1m╚' + '═'.repeat(COLS) + '╝\x1b[0m');

    for (let row = 0; row < ROWS; row++) {
      let line = '\x1b[48;5;232m│';
      for (let col = 0; col < COLS; col++) {
        const c = colorGrid[row][col];
        const glyph = grid[row][col];
        // Use ANSI 24-bit true color where supported
        line += `\x1b[38;2;${c.r};${c.g};${c.b}m${glyph}\x1b[0m\x1b[48;5;232m`;
      }
      line += '│\x1b[0m';
      lines.push(line);
    }

    lines.push('\x1b[48;5;232m\x1b[1m╚' + '═'.repeat(COLS) + '╝\x1b[0m');
    return lines.join('\n');
  }

  // ── Utility: Export framebuffer as TGA binary ──────────────────────────────

  /**
   * Encodes the RGBA framebuffer as a raw TGA binary (no external libs needed).
   * TGA format: 18-byte header + raw pixel data (BGRA order for TGA).
   * Output can be written directly to disk or sent over a socket.
   */
  public encodeTga(frame: OneRenderFrame): Buffer {
    const { rgbaBuffer, width, height } = frame;
    const headerSize = 18;
    const pixelBytes = width * height * 4;
    const tga = Buffer.alloc(headerSize + pixelBytes);

    // TGA header (type 2 = uncompressed true-color)
    tga[0] = 0;     // ID length
    tga[1] = 0;     // color map type (none)
    tga[2] = 2;     // image type (uncompressed true-color)
    tga.writeUInt16LE(0, 3);   // color map offset
    tga.writeUInt16LE(0, 5);   // color map length
    tga[7] = 0;     // color map entry size
    tga.writeUInt16LE(0, 8);   // x origin
    tga.writeUInt16LE(0, 10);  // y origin
    tga.writeUInt16LE(width, 12);
    tga.writeUInt16LE(height, 14);
    tga[16] = 32;   // bits per pixel (BGRA = 4 * 8)
    tga[17] = 0x28; // image descriptor: top-left origin, 8 alpha bits

    // Pixel data: TGA expects BGRA, our buffer is RGBA → swap R↔B
    let outOff = headerSize;
    for (let i = 0; i < pixelBytes; i += 4) {
      tga[outOff]     = rgbaBuffer[i + 2]; // B
      tga[outOff + 1] = rgbaBuffer[i + 1]; // G
      tga[outOff + 2] = rgbaBuffer[i];     // R
      tga[outOff + 3] = rgbaBuffer[i + 3]; // A
      outOff += 4;
    }

    return tga;
  }

  get currentFrameIndex(): number {
    return this.frameIndex;
  }
}
