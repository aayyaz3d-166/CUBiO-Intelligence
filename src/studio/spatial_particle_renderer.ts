/**
 * CUBiO / AGI ONE — GATE CNL-P26.6
 * NATIVE GPU PARTICLE RENDERER & HOLOGRAPHIC LIVING UI ENGINE
 *
 * File: f:\\ONE language\\src\\studio\\spatial_particle_renderer.ts
 * Module: @one/studio/spatial-particle-renderer
 * Specification: Gate CNL-P26.6 Particle-Dense Living UI Architecture
 *
 * High-density volumetric particle cloud renderer for the 343-cell lattice.
 * Pure native TypeScript engine with ZERO HTML, CSS, DOM, Three.js, WebGL, or Canvas APIs.
 *
 * Key Architecture:
 *   - 343 Core Quantum Lattice Nodes + Orbiting Micro-Particle Cloud (1,000+ particles)
 *   - Radial Harmonic Wave Emitter expanding outward from Center Node [★171]
 *   - 3D Euler perspective rotation matrix (Yaw, Pitch, Roll, Zoom)
 *   - Point-spread halo intensity falloff and sub-pixel glow synthesis
 *   - Deterministic back-to-front depth sorting (Painter's algorithm)
 *   - Native Glass-Panel Command Center framing with high-contrast Unicode geometry
 *   - Buffer width safety: zero-width ANSI escape codes never corrupt column alignment
 *
 * Epistemic Truth Lock:
 *   - Simulated harmonic bands are purely mathematical decompositions, NOT physical RF frequencies.
 *   - PHYSICAL_FREQUENCY_CLAIM = NONE (No physical radio frequency claims).
 *   - Native Render Buffer operates strictly in-memory without browser Canvas APIs.
 */

import { QuantumCellState, LatticeSnapshot } from '../core/spatial_quantum_mapper';
import { ValidatedRenderFrame } from './native_state_bridge';
import {
  IsometricCamera,
  Matrix3D,
  stripAnsi,
  getVisibleWidth,
  checkAnsiSupport,
  ColorMode,
  ANSI_CODES
} from './spatial_voxel_renderer';

export interface Particle {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly coreCellId: number;       // 0..342 for core node, or parent cellId for micro-particle
  readonly isCenterNode: boolean;    // true for cell 171
  readonly isSelected: boolean;
  readonly luminance: number;        // 0.0 .. 1.0
  readonly haloSize: number;         // 1 .. 3
  readonly colorTier: 'CORE_ORIGIN' | 'NEON_CYAN' | 'EMERALD_HIGH' | 'EMERALD_MID' | 'DEEP_SPACE';
  readonly glyph: string;
}

export interface ParticleBufferState {
  readonly totalParticleCount: number;
  readonly coreNodeCount: number;
  readonly microParticleCount: number;
  readonly waveRadius: number;
  readonly activeEpoch: number;
}

export interface ParticleRenderResult {
  readonly frameSequence: number;
  readonly stateEpoch: number;
  readonly renderedText: string;
  readonly bufferState: ParticleBufferState;
  readonly renderDurationMs: number;
}

export interface ParticleRendererOptions {
  selectedCellId?: number;
  camera?: Partial<IsometricCamera>;
  renderBufferWidth?: number;
  renderBufferHeight?: number;
  colorMode?: ColorMode;
  microParticleDensity?: number; // default 3 micro-particles per active node
}

export class SpatialParticleRenderer {
  private selectedCellId: number = 171;
  private camera: { yawDeg: number; pitchDeg: number; rollDeg: number; zoom: number } = {
    yawDeg: 45,
    pitchDeg: 30,
    rollDeg: 0,
    zoom: 1.0
  };
  private renderBufferWidth: number = 80;
  private renderBufferHeight: number = 24;
  private colorMode: ColorMode = 'AUTO';
  private microParticleDensity: number = 5;
  private animationTick: number = 0;

  // Extended ANSI Palette for Holographic UI (Cyan accents + Emerald core)
  private static readonly ANSI_CYAN_GLOW = '\x1b[1;96m';
  private static readonly ANSI_CYAN_DIM = '\x1b[36m';

  constructor(options?: ParticleRendererOptions) {
    if (options) {
      if (options.selectedCellId !== undefined) this.selectedCellId = options.selectedCellId;
      if (options.camera) this.setCamera(options.camera);
      if (options.renderBufferWidth !== undefined) this.renderBufferWidth = options.renderBufferWidth;
      if (options.renderBufferHeight !== undefined) this.renderBufferHeight = options.renderBufferHeight;
      if (options.colorMode !== undefined) this.colorMode = options.colorMode;
      if (options.microParticleDensity !== undefined) this.microParticleDensity = options.microParticleDensity;
    }
  }

  public setCamera(camera: Partial<IsometricCamera>): void {
    this.camera = {
      yawDeg: camera.yawDeg !== undefined ? camera.yawDeg : this.camera.yawDeg,
      pitchDeg: camera.pitchDeg !== undefined ? camera.pitchDeg : this.camera.pitchDeg,
      rollDeg: camera.rollDeg !== undefined ? camera.rollDeg : this.camera.rollDeg,
      zoom: camera.zoom !== undefined ? camera.zoom : this.camera.zoom
    };
  }

  public getCamera(): Readonly<IsometricCamera> {
    return this.camera;
  }

  public setSelectedCell(cellId: number): void {
    if (cellId < 0 || cellId > 342 || !Number.isInteger(cellId)) {
      throw new Error(`[SpatialParticleRenderer] cellId must be in 0..342, received: ${cellId}`);
    }
    this.selectedCellId = cellId;
  }

  public getSelectedCell(): number {
    return this.selectedCellId;
  }

  public setColorMode(mode: ColorMode): void {
    this.colorMode = mode;
  }

  public advanceTick(delta: number = 1): void {
    this.animationTick += delta;
  }

  public isAnsiActive(): boolean {
    if (this.colorMode === 'MONOCHROME') return false;
    if (this.colorMode === 'GREEN_MATRIX') return true;
    return checkAnsiSupport();
  }

  /**
   * Generates the dense particle vertex cloud from the canonical quantum snapshot.
   */
  public generateParticleCloud(frame: ValidatedRenderFrame): { particles: Particle[]; bufferState: ParticleBufferState } {
    const matrix = frame.snapshot.lattice_state_matrix;
    const epoch = frame.stateEpoch;
    const t = epoch + this.animationTick * 0.15;

    // Harmonic wave radius expanding from origin node (3, 3, 3)
    const waveRadius = (t * 0.8) % 5.5;

    const particles: Particle[] = [];
    let microCount = 0;

    for (let c = 0; c < 343; c++) {
      const cell = matrix[c];
      const cx = cell.i - 3;
      const cy = cell.j - 3;
      const cz = cell.k - 3;

      const isCenter = cell.cell_id === 171;
      const isSelected = cell.cell_id === this.selectedCellId;

      // Distance from origin node
      const distFromOrigin = Math.sqrt(cx * cx + cy * cy + cz * cz);

      // Harmonic wave crest excitation
      const distToWaveCrest = Math.abs(distFromOrigin - waveRadius);
      const waveExcitation = Math.max(0, 1.0 - distToWaveCrest * 1.8);

      // Node intrinsic luminance based on probability and resonance
      const resWeight = cell.resonance;
      const probWeight = Math.min(1.0, cell.probability * 100);
      const baseLuminance = 0.25 + 0.45 * resWeight + 0.20 * probWeight + 0.25 * waveExcitation;
      const clampedLuminance = Math.min(1.0, Math.max(0.1, baseLuminance));

      // Determine Core Node Glyph & Color Tier
      let coreGlyph: string;
      let coreColorTier: Particle['colorTier'];

      if (isCenter) {
        coreGlyph = '★';
        coreColorTier = 'CORE_ORIGIN';
      } else if (isSelected) {
        coreGlyph = '◈';
        coreColorTier = 'NEON_CYAN';
      } else if (waveExcitation > 0.5) {
        coreGlyph = '✦';
        coreColorTier = 'NEON_CYAN';
      } else if (clampedLuminance > 0.7) {
        coreGlyph = '●';
        coreColorTier = 'EMERALD_HIGH';
      } else if (clampedLuminance > 0.4) {
        coreGlyph = '◐';
        coreColorTier = 'EMERALD_MID';
      } else {
        coreGlyph = '·';
        coreColorTier = 'DEEP_SPACE';
      }

      // 1. Add Core Quantum Lattice Node
      particles.push({
        x: cx,
        y: cy,
        z: cz,
        coreCellId: cell.cell_id,
        isCenterNode: isCenter,
        isSelected,
        luminance: isCenter ? 1.0 : clampedLuminance,
        haloSize: isCenter ? 3 : clampedLuminance > 0.6 ? 2 : 1,
        colorTier: coreColorTier,
        glyph: coreGlyph
      });

      // 2. Generate Orbiting Micro-Particles for active and wave-excited nodes
      if (cell.resonance > 0.18 || isCenter || waveExcitation > 0.15) {
        const numMicro = isCenter ? 8 : Math.max(1, Math.floor(this.microParticleDensity * (cell.resonance + waveExcitation)));
        for (let m = 0; m < numMicro; m++) {
          const angle = (m * (2 * Math.PI / numMicro)) + (t * 0.7) + cell.phase;
          const orbitR = 0.35 + 0.20 * Math.sin(t * 0.5 + m);

          const mx = cx + orbitR * Math.cos(angle);
          const my = cy + orbitR * Math.sin(angle);
          const mz = cz + 0.15 * Math.sin(angle * 2);

          const microLuminance = Math.max(0.05, (clampedLuminance * 0.65) * (1.0 - orbitR * 0.5));
          const microTier: Particle['colorTier'] =
            isCenter ? 'NEON_CYAN' :
            waveExcitation > 0.4 ? 'NEON_CYAN' :
            microLuminance > 0.4 ? 'EMERALD_MID' : 'DEEP_SPACE';

          const microGlyphs = ['·', ':', '✧', '°', '•'];
          const microGlyph = microGlyphs[m % microGlyphs.length];

          particles.push({
            x: mx,
            y: my,
            z: mz,
            coreCellId: cell.cell_id,
            isCenterNode: false,
            isSelected: false,
            luminance: microLuminance,
            haloSize: 1,
            colorTier: microTier,
            glyph: microGlyph
          });
          microCount++;
        }
      }
    }

    const bufferState: ParticleBufferState = {
      totalParticleCount: particles.length,
      coreNodeCount: 343,
      microParticleCount: microCount,
      waveRadius: parseFloat(waveRadius.toFixed(2)),
      activeEpoch: epoch
    };

    return { particles, bufferState };
  }

  /**
   * Renders the volumetric particle cloud into Native Render Buffer output text.
   */
  public render(frame: ValidatedRenderFrame): ParticleRenderResult {
    const startTime = Date.now();
    const width = this.renderBufferWidth;
    const height = this.renderBufferHeight;

    const { particles, bufferState } = this.generateParticleCloud(frame);

    // Initialize Native 2D Grid
    const grid: string[][] = Array.from({ length: height }, () => Array(width).fill(' '));
    const depthGrid: number[][] = Array.from({ length: height }, () => Array(width).fill(-Infinity));

    const yaw = this.camera.yawDeg;
    const pitch = this.camera.pitchDeg;
    const roll = this.camera.rollDeg ?? 0;
    const zoom = this.camera.zoom;
    const useAnsi = this.isAnsiActive();

    // 1. Transform & Project all particles
    interface ProjectedParticle {
      particle: Particle;
      projX: number;
      projY: number;
      depth: number;
      normDepth: number;
    }

    const rawTransformed: Array<{ particle: Particle; rx: number; ry: number; rz: number }> = [];
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const p of particles) {
      const [rx, ry, rz] = Matrix3D.transformPoint([p.x, p.y, p.z], yaw, pitch, roll);
      if (rz < minZ) minZ = rz;
      if (rz > maxZ) maxZ = rz;
      rawTransformed.push({ particle: p, rx, ry, rz });
    }

    const zRange = (maxZ - minZ) > 1e-5 ? (maxZ - minZ) : 1.0;
    const projectedList: ProjectedParticle[] = [];

    const scaleX = 4.2 * zoom;
    const scaleY = 2.1 * zoom;
    const focalDist = 18.0;

    for (let i = 0; i < rawTransformed.length; i++) {
      const item = rawTransformed[i];
      const pFactor = focalDist / (focalDist - item.rz);
      const screenX = Math.round(width / 2 + item.rx * scaleX * pFactor);
      const screenY = Math.round(height / 2 - item.ry * scaleY * pFactor);
      const normDepth = (item.rz - minZ) / zRange;

      projectedList.push({
        particle: item.particle,
        projX: screenX,
        projY: screenY,
        depth: item.rz,
        normDepth
      });
    }

    // 2. Deterministic Depth Sorting (back-to-front painter's algorithm)
    projectedList.sort((a, b) => (a.depth - b.depth) || (a.particle.coreCellId - b.particle.coreCellId));

    // 3. Rasterize Particles into Render Buffer Grid
    for (const p of projectedList) {
      const x = p.projX;
      const y = p.projY;

      if (y >= 0 && y < height && x >= 0 && x < width) {
        const isOccupiedByCenter = grid[y][x].includes('★');
        if (!isOccupiedByCenter && (p.particle.isCenterNode || p.depth >= depthGrid[y][x] - 0.05)) {
          depthGrid[y][x] = p.particle.isCenterNode ? Infinity : p.depth;

          let colorPrefix = '';
          if (useAnsi) {
            switch (p.particle.colorTier) {
              case 'CORE_ORIGIN':
                colorPrefix = ANSI_CODES.HIGHLIGHT_GREEN;
                break;
              case 'NEON_CYAN':
                colorPrefix = SpatialParticleRenderer.ANSI_CYAN_GLOW;
                break;
              case 'EMERALD_HIGH':
                colorPrefix = ANSI_CODES.BRIGHT_GREEN;
                break;
              case 'EMERALD_MID':
                colorPrefix = ANSI_CODES.NORMAL_GREEN;
                break;
              case 'DEEP_SPACE':
              default:
                colorPrefix = ANSI_CODES.DIM_GREEN;
                break;
            }
          }

          grid[y][x] = useAnsi ? `${colorPrefix}${p.particle.glyph}${ANSI_CODES.RESET}` : p.particle.glyph;
        }
      }
    }

    // 4. Construct Modern Glass-Panel HUD Header & Borders
    const lines: string[] = [];

    // Header HUD
    lines.push('================================================================================');
    lines.push(`  CUBiO / AGI ONE — 343-CELL LATTICE — HOLOGRAPHIC PARTICLE CLOUD (PARTICLES: ${bufferState.totalParticleCount})`);
    lines.push(`  ISOMETRIC ORBIT (YAW: ${yaw}°, PITCH: ${pitch}°, ROLL: ${roll}°, ZOOM: ${zoom.toFixed(1)}x) | STATUS: LIVING UI`);
    lines.push('================================================================================');

    // Render Grid Rows
    for (let r = 0; r < height; r++) {
      lines.push(grid[r].join(''));
    }

    // Footer Status
    lines.push('--------------------------------------------------------------------------------');
    lines.push(`  Anchor: ★171 Center Origin (Address369: 197 / 3,3,3) | ◈ Selected Node (${this.selectedCellId})`);
    lines.push('  Depth Shading: Foreground █ ▓ ▒ ░ · Background | Pulse: SIMULATED HARMONIC BAND (3/6/9)');
    lines.push('  EPISTEMIC LOCK: Computational representation only — PHYSICAL_FREQUENCY_CLAIM = NONE');

    const renderedText = lines.join('\n');
    const duration = Date.now() - startTime;

    return {
      frameSequence: frame.sequenceNumber,
      stateEpoch: frame.stateEpoch,
      renderedText,
      bufferState,
      renderDurationMs: duration
    };
  }
}
