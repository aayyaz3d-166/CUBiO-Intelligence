/**
 * CUBiO / AGI ONE — GATE CNL-P26.4 & CNL-P26.4-RECON-001
 * SPATIAL VOXEL RENDERER & 3D PROJECTION ENGINE
 *
 * File: f:\ONE language\src\studio\spatial_voxel_renderer.ts
 * Module: @one/studio/spatial-voxel-renderer
 * Specification: Gate CNL-P26.4 Section 4 & 5 | Forensically Reconciled
 *
 * Native volumetric rendering of the 343-cell HCP lattice (7 x 7 x 7).
 * Pure native TypeScript engine with ZERO HTML, CSS, DOM, Three.js, WebGL, or Canvas APIs.
 *
 * Features:
 *   - Canonical lattice geometry: 7 x 7 x 7 = 343 cells
 *   - Coordinate mapping: (i, j, k) -> cellId = i*49 + j*7 + k, Address369 = 26 + cellId
 *   - Center origin node 171 at (3, 3, 3) highlighted visual anchor
 *   - Deterministic visual state mapping:
 *       Probability -> Intensity glyphs (., :, +, *, #, @)
 *       Resonance   -> Activation state & simulated harmonic bands (BAND_3, BAND_6, BAND_9)
 *       Phase       -> Harmonic directional quadrant indicators
 *       Collapsed   -> Mathematical superposition vs collapsed indicator
 *   - Multi-slice layer view: k in 0..6 (7 layers of 7x7=49 cells)
 *   - Isometric 3D orbit projection engine with yaw, pitch, and zoom onto Native Render Buffer
 *
 * EPISTEMIC TRUTH LOCK:
 *   - Simulated harmonic bands are purely mathematical decompositions, NOT physical RF frequencies.
 *   - PHYSICAL_FREQUENCY_CLAIM = NONE (No physical radio frequency claims).
 *   - Native Render Buffer operates strictly in-memory without browser Canvas APIs.
 */
import { SpatialParticleRenderer } from './spatial_particle_renderer';
export const ANSI_CODES = {
    RESET: '\x1b[0m',
    DIM_GREEN: '\x1b[2;32m',
    NORMAL_GREEN: '\x1b[32m',
    BRIGHT_GREEN: '\x1b[92m',
    HIGHLIGHT_GREEN: '\x1b[1;92m'
};
export function stripAnsi(text) {
    return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}
export function getVisibleWidth(text) {
    return stripAnsi(text).length;
}
export function checkAnsiSupport() {
    if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '') {
        return false;
    }
    if (process.env.FORCE_COLOR === '0') {
        return false;
    }
    if (process.env.FORCE_COLOR !== undefined && process.env.FORCE_COLOR !== '0') {
        return true;
    }
    if (process.stdout && Boolean(process.stdout.isTTY)) {
        return true;
    }
    if (process.platform === 'win32') {
        try {
            const os = require('os');
            const release = os.release();
            const parts = release.split('.').map((p) => parseInt(p, 10));
            if (parts[0] > 10 || (parts[0] === 10 && parts[2] >= 10586)) {
                return true;
            }
        }
        catch {
            // Fallback
        }
    }
    if (process.env.TERM && process.env.TERM !== 'dumb') {
        return true;
    }
    if (Boolean(process.env.COLORTERM)) {
        return true;
    }
    return false;
}
export class SpatialVoxelRenderer {
    activeSliceK = 3;
    selectedCellId = 171;
    projectionMode = 'SLICE';
    camera = {
        yawDeg: 45,
        pitchDeg: 30,
        rollDeg: 0,
        zoom: 1.0
    };
    renderBufferWidth = 80;
    renderBufferHeight = 24;
    colorMode = 'AUTO';
    particleRenderer = null;
    constructor(options) {
        if (options) {
            if (options.activeSliceK !== undefined)
                this.setSlice(options.activeSliceK);
            if (options.selectedCellId !== undefined)
                this.setSelectedCell(options.selectedCellId);
            if (options.projectionMode !== undefined)
                this.projectionMode = options.projectionMode;
            if (options.camera)
                this.setCamera(options.camera);
            if (options.renderBufferWidth !== undefined)
                this.renderBufferWidth = options.renderBufferWidth;
            if (options.renderBufferHeight !== undefined)
                this.renderBufferHeight = options.renderBufferHeight;
            if (options.colorMode !== undefined)
                this.colorMode = options.colorMode;
        }
    }
    setColorMode(mode) {
        this.colorMode = mode;
    }
    getColorMode() {
        return this.colorMode;
    }
    isAnsiActive() {
        if (this.colorMode === 'MONOCHROME')
            return false;
        if (this.colorMode === 'GREEN_MATRIX')
            return true;
        return checkAnsiSupport();
    }
    static stripAnsi(text) {
        return stripAnsi(text);
    }
    static getVisibleWidth(text) {
        return getVisibleWidth(text);
    }
    static checkAnsiSupport() {
        return checkAnsiSupport();
    }
    setSlice(k) {
        if (k < 0 || k > 6 || !Number.isInteger(k)) {
            throw new Error(`[SpatialVoxelRenderer] Slice k must be an integer in 0..6, received: ${k}`);
        }
        this.activeSliceK = k;
    }
    getActiveSlice() {
        return this.activeSliceK;
    }
    setSelectedCell(cellId) {
        if (cellId < 0 || cellId > 342 || !Number.isInteger(cellId)) {
            throw new Error(`[SpatialVoxelRenderer] cellId must be an integer in 0..342, received: ${cellId}`);
        }
        this.selectedCellId = cellId;
    }
    getSelectedCell() {
        return this.selectedCellId;
    }
    setProjectionMode(mode) {
        this.projectionMode = mode;
    }
    getProjectionMode() {
        return this.projectionMode;
    }
    setCamera(camera) {
        this.camera = {
            yawDeg: camera.yawDeg !== undefined ? camera.yawDeg : this.camera.yawDeg,
            pitchDeg: camera.pitchDeg !== undefined ? camera.pitchDeg : this.camera.pitchDeg,
            rollDeg: camera.rollDeg !== undefined ? camera.rollDeg : this.camera.rollDeg,
            zoom: camera.zoom !== undefined ? camera.zoom : this.camera.zoom
        };
    }
    getCamera() {
        return this.camera;
    }
    getParticleRenderer() {
        if (!this.particleRenderer) {
            this.particleRenderer = new SpatialParticleRenderer({
                selectedCellId: this.selectedCellId,
                camera: this.camera,
                renderBufferWidth: this.renderBufferWidth,
                renderBufferHeight: this.renderBufferHeight,
                colorMode: this.colorMode
            });
        }
        return this.particleRenderer;
    }
    getRenderBufferSize() {
        return { width: this.renderBufferWidth, height: this.renderBufferHeight };
    }
    centerOnOriginNode() {
        this.selectedCellId = 171; // Node (3, 3, 3)
        this.activeSliceK = 3;
    }
    /**
     * Deterministic visual mapping of a single quantum cell state.
     */
    mapCellToVisual(cell) {
        const isCenter = cell.cell_id === 171;
        const isSelected = cell.cell_id === this.selectedCellId;
        // 1. Probability -> Intensity glyph
        let intensityGlyph;
        const p = cell.probability;
        if (p < 0.0010) {
            intensityGlyph = '·';
        }
        else if (p < 0.0025) {
            intensityGlyph = '░';
        }
        else if (p < 0.0050) {
            intensityGlyph = '▒';
        }
        else if (p < 0.0100) {
            intensityGlyph = '▓';
        }
        else {
            intensityGlyph = '█';
        }
        // 2. Resonance -> Activation glyph & simulated harmonic band
        let resonanceBand;
        let resonanceGlyph;
        const r = cell.resonance;
        if (r < 0.25) {
            resonanceBand = 'INACTIVE';
            resonanceGlyph = '○';
        }
        else if (r < 0.50) {
            resonanceBand = 'HARMONIC';
            resonanceGlyph = '◐';
        }
        else if (r < 0.75) {
            resonanceBand = 'COHERENT';
            resonanceGlyph = '●';
        }
        else {
            resonanceBand = 'RESONANT';
            resonanceGlyph = '✦';
        }
        // 369 Harmonic Triad Decomposition (SIMULATED_HARMONIC_BAND_3, BAND_6, BAND_9)
        // Non-physical mathematical band index derived from spatial lattice coordinates
        const triadMod = Math.floor(r * 100) % 3;
        const simulatedHarmonicOrder = triadMod === 0 ? 3 : triadMod === 1 ? 6 : 9;
        const simulatedHarmonicBand = simulatedHarmonicOrder === 3
            ? 'SIMULATED_HARMONIC_BAND_3'
            : simulatedHarmonicOrder === 6
                ? 'SIMULATED_HARMONIC_BAND_6'
                : 'SIMULATED_HARMONIC_BAND_9';
        // 3. Phase -> Directional Harmonic Quadrant
        // Phase is in [-PI, PI)
        const phi = cell.phase;
        let phaseQuadrant;
        let phaseGlyph;
        if (phi >= 0 && phi < Math.PI / 2) {
            phaseQuadrant = 1;
            phaseGlyph = '↗';
        }
        else if (phi >= Math.PI / 2 && phi <= Math.PI) {
            phaseQuadrant = 2;
            phaseGlyph = '↖';
        }
        else if (phi < -Math.PI / 2 && phi >= -Math.PI) {
            phaseQuadrant = 3;
            phaseGlyph = '↙';
        }
        else {
            phaseQuadrant = 4;
            phaseGlyph = '↘';
        }
        // 4. State Indicator: Collapsed vs Superposed
        const isCollapsed = cell.probability > 0.999;
        const stateIndicator = isCollapsed ? '[X]' : '(~)';
        return {
            cellId: cell.cell_id,
            address369: cell.address369,
            coordinates: [cell.i, cell.j, cell.k],
            intensityGlyph,
            resonanceGlyph,
            resonanceBand,
            simulatedHarmonicBand,
            simulatedHarmonicOrder,
            phaseGlyph,
            phaseQuadrant,
            stateIndicator,
            isCenterNode: isCenter,
            isSelected
        };
    }
    /**
     * Renders the active frame to Native Render Buffer text output.
     */
    render(frame) {
        const startTime = Date.now();
        const snapshot = frame.snapshot;
        const matrix = snapshot.lattice_state_matrix;
        const visualStates = new Array(343);
        for (let c = 0; c < 343; c++) {
            visualStates[c] = this.mapCellToVisual(matrix[c]);
        }
        let renderedText;
        if (this.projectionMode === 'SLICE') {
            renderedText = this.renderSliceView(visualStates, frame);
        }
        else if (this.projectionMode === 'PARTICLE') {
            renderedText = this.renderParticleView(frame);
        }
        else {
            renderedText = this.renderIsometricView(visualStates, frame);
        }
        const duration = Date.now() - startTime;
        return {
            frameSequence: frame.sequenceNumber,
            stateEpoch: frame.stateEpoch,
            mode: this.projectionMode,
            activeSliceK: this.activeSliceK,
            selectedCellId: this.selectedCellId,
            centerCellId: 171,
            renderedText,
            voxelMatrix: visualStates,
            renderDurationMs: duration
        };
    }
    /**
     * Particle Cloud View Renderer:
     * Volumetric high-density particle matrix rendering via SpatialParticleRenderer.
     */
    renderParticleView(frame) {
        const pRenderer = this.getParticleRenderer();
        pRenderer.setSelectedCell(this.selectedCellId);
        pRenderer.setCamera(this.camera);
        pRenderer.setColorMode(this.colorMode);
        return pRenderer.render(frame).renderedText;
    }
    /**
     * Slice View Renderer:
     * Displays the 7 x 7 grid for the active slice k.
     */
    renderSliceView(voxels, frame) {
        const k = this.activeSliceK;
        const lines = [];
        lines.push(`================================================================================`);
        lines.push(`  CUBiO 3D MEMORY STUDIO — 343-CELL LATTICE (7x7x7) — SLICE LAYER K = ${k}`);
        lines.push(`  EPOCH: ${frame.stateEpoch} | SEQ: ${frame.sequenceNumber} | CELLS: 343 | STATUS: COMPUTED`);
        lines.push(`================================================================================`);
        lines.push(``);
        lines.push(`      j=0     j=1     j=2     j=3     j=4     j=5     j=6`);
        lines.push(`    +-------+-------+-------+-------+-------+-------+-------+`);
        for (let i = 0; i < 7; i++) {
            let rowTop = `i=${i} |`;
            let rowMid = `    |`;
            let rowBot = `    |`;
            for (let j = 0; j < 7; j++) {
                const cellId = i * 49 + j * 7 + k;
                const voxel = voxels[cellId];
                // Format cell display
                let anchorTag = ` ${voxel.cellId.toString().padStart(3, ' ')} `;
                if (voxel.isCenterNode && voxel.isSelected) {
                    anchorTag = `[★${voxel.cellId.toString().padStart(3, ' ')}]`;
                }
                else if (voxel.isCenterNode) {
                    anchorTag = ` ★${voxel.cellId.toString().padStart(3, ' ')} `;
                }
                else if (voxel.isSelected) {
                    anchorTag = `[${voxel.cellId.toString().padStart(3, ' ')}]`;
                }
                else {
                    anchorTag = `  ${voxel.cellId.toString().padStart(3, ' ')}  `;
                }
                // Mid: Glyphs (Intensity, Resonance, Phase, State)
                const glyphStr = `${voxel.intensityGlyph}${voxel.resonanceGlyph}${voxel.phaseGlyph}`;
                const midTag = `  ${glyphStr}  `;
                // Bot: Address369
                const botTag = ` A${voxel.address369.toString().padStart(3, ' ')} `;
                rowTop += `${anchorTag.padEnd(7, ' ')}|`;
                rowMid += `${midTag.padEnd(7, ' ')}|`;
                rowBot += `${botTag.padEnd(7, ' ')}|`;
            }
            lines.push(rowTop);
            lines.push(rowMid);
            lines.push(rowBot);
            lines.push(`    +-------+-------+-------+-------+-------+-------+-------+`);
        }
        lines.push(``);
        lines.push(`  Legend: ★ Center Node (171: 3,3,3) | [ID] Selected Cell | A### Address369`);
        lines.push(`  Glyphs: [Intensity] · ░ ▒ ▓ █  | [Resonance] ○ ◐ ● ✦ | [Phase] ↗ ↖ ↙ ↘`);
        return lines.join('\n');
    }
    /**
     * Isometric 3D Projection Engine:
     * True Native 3D Volumetric mathematical projection of all 343 cells onto Native Render Buffer.
     * Features:
     *   - 3D Rotation Matrix R = Rz(yaw) * Rx(pitch) * Ry(roll)
     *   - Perspective-adjusted Isometric / Orthographic projection
     *   - Deterministic back-to-front depth sorting (Painter's algorithm)
     *   - Mathematical depth shading & simulated harmonic resonance pulse
     *   - Visual anchors: Center Origin Node 171 (3,3,3) & Selected Cell
     */
    renderIsometricView(voxels, frame) {
        const width = this.renderBufferWidth;
        const height = this.renderBufferHeight;
        const grid = Array.from({ length: height }, () => Array(width).fill(' '));
        const yaw = this.camera.yawDeg;
        const pitch = this.camera.pitchDeg;
        const roll = this.camera.rollDeg ?? 0;
        const zoom = this.camera.zoom;
        const rawProjected = [];
        let minZ = Infinity;
        let maxZ = -Infinity;
        // 1. Transform all 343 cells centered around origin node (3, 3, 3)
        for (let c = 0; c < 343; c++) {
            const v = voxels[c];
            const cx = v.coordinates[0] - 3;
            const cy = v.coordinates[1] - 3;
            const cz = v.coordinates[2] - 3;
            const [rx, ry, rz] = Matrix3D.transformPoint([cx, cy, cz], yaw, pitch, roll);
            if (rz < minZ)
                minZ = rz;
            if (rz > maxZ)
                maxZ = rz;
            rawProjected.push({ voxel: v, rx, ry, rz });
        }
        const zRange = (maxZ - minZ) > 1e-5 ? (maxZ - minZ) : 1.0;
        const projected = [];
        // Screen projection factors accounting for character aspect ratio
        const scaleX = 4.2 * zoom;
        const scaleY = 2.1 * zoom;
        const focalDist = 18.0;
        for (let c = 0; c < 343; c++) {
            const item = rawProjected[c];
            const pFactor = focalDist / (focalDist - item.rz);
            const screenX = Math.round(width / 2 + item.rx * scaleX * pFactor);
            const screenY = Math.round(height / 2 - item.ry * scaleY * pFactor);
            const normDepth = (item.rz - minZ) / zRange; // 0.0 (farthest) to 1.0 (nearest)
            projected.push({
                voxel: item.voxel,
                projX: screenX,
                projY: screenY,
                depth: item.rz,
                normDepth
            });
        }
        // 2. Deterministic Depth Sorting (back-to-front painter's algorithm)
        // Secondary sort by cellId ensures bit-identical deterministic ordering
        projected.sort((a, b) => (a.depth - b.depth) || (a.voxel.cellId - b.voxel.cellId));
        const useAnsi = this.isAnsiActive();
        // 3. Render into Native Render Buffer
        for (const p of projected) {
            const x = p.projX;
            const y = p.projY;
            if (y >= 0 && y < height && x >= 0 && x < width) {
                let char;
                let colorCode = '';
                if (p.voxel.isCenterNode) {
                    // Center origin node 171 receives the strongest visual highlight
                    char = '★';
                    colorCode = ANSI_CODES.HIGHLIGHT_GREEN;
                }
                else if (p.voxel.isSelected) {
                    char = '◈'; // Selected Cell indicator
                    colorCode = ANSI_CODES.HIGHLIGHT_GREEN;
                }
                else {
                    // Mathematical resonance pulse: deterministic phase modulation along 3-6-9 orders
                    const pulse = 0.10 * Math.sin(p.voxel.phaseQuadrant * (Math.PI / 2) +
                        (frame.stateEpoch * 0.4) +
                        (p.voxel.simulatedHarmonicOrder * (Math.PI / 3)));
                    // Depth shading & resonance activation weight
                    const resWeight = p.voxel.resonanceBand === 'RESONANT' ? 1.0 :
                        p.voxel.resonanceBand === 'COHERENT' ? 0.75 :
                            p.voxel.resonanceBand === 'HARMONIC' ? 0.45 : 0.15;
                    // Normalized probability weight (bounded in [0, 1])
                    const rawProb = p.voxel.intensityGlyph === '█' ? 1.0 :
                        p.voxel.intensityGlyph === '▓' ? 0.8 :
                            p.voxel.intensityGlyph === '▒' ? 0.5 :
                                p.voxel.intensityGlyph === '░' ? 0.3 : 0.1;
                    // Deterministic visual intensity: depth (near=brighter, far=darker) + resonance + probability + pulse
                    const visualWeight = 0.35 * p.normDepth + 0.35 * resWeight + 0.15 * rawProb + 0.15 + pulse;
                    const clamped = Math.max(0.0, Math.min(1.0, visualWeight));
                    if (clamped < 0.22) {
                        char = '·';
                        colorCode = ANSI_CODES.DIM_GREEN;
                    }
                    else if (clamped < 0.44) {
                        char = '░';
                        colorCode = ANSI_CODES.DIM_GREEN;
                    }
                    else if (clamped < 0.66) {
                        char = '▒';
                        colorCode = ANSI_CODES.NORMAL_GREEN;
                    }
                    else if (clamped < 0.85) {
                        char = '▓';
                        colorCode = ANSI_CODES.BRIGHT_GREEN;
                    }
                    else {
                        char = '█';
                        colorCode = ANSI_CODES.BRIGHT_GREEN;
                    }
                }
                // Apply ANSI Green Shader to Native Render Buffer cell (zero-width safety preserved)
                grid[y][x] = useAnsi ? `${colorCode}${char}${ANSI_CODES.RESET}` : char;
            }
        }
        const lines = [];
        lines.push(`================================================================================`);
        lines.push(`  CUBiO 3D MEMORY STUDIO — 343-CELL LATTICE — ISOMETRIC ORBIT (YAW: ${yaw}°, PITCH: ${pitch}°, ROLL: ${roll}°, ZOOM: ${zoom.toFixed(1)}x)`);
        lines.push(`  EPOCH: ${frame.stateEpoch} | SEQ: ${frame.sequenceNumber} | CELLS: 343 | SELECTED: ${this.selectedCellId} | PROJECTION: TRUE NATIVE 3D`);
        lines.push(`================================================================================`);
        for (let r = 0; r < height; r++) {
            lines.push(grid[r].join(''));
        }
        lines.push(`--------------------------------------------------------------------------------`);
        lines.push(`  Anchor: ★171 Center Origin (Address369: 197 / 3,3,3) | ◈ Selected Node (${this.selectedCellId})`);
        lines.push(`  Depth Shading: Foreground █ ▓ ▒ ░ · Background | Pulse: SIMULATED HARMONIC BAND (3/6/9)`);
        lines.push(`  EPISTEMIC LOCK: Computational representation only — PHYSICAL_FREQUENCY_CLAIM = NONE`);
        return lines.join('\n');
    }
}
/**
 * 3D Transformation Math Engine (Zero External Dependencies)
 */
export class Matrix3D {
    /**
     * Pure mathematical 3D Euler rotation matrix: R = Rz(yaw) * Rx(pitch) * Ry(roll)
     * Transforms coordinate [x, y, z] in R^3
     */
    static transformPoint(point, yawDeg, pitchDeg, rollDeg = 0) {
        const deg2rad = Math.PI / 180;
        const yRad = yawDeg * deg2rad;
        const pRad = pitchDeg * deg2rad;
        const rRad = rollDeg * deg2rad;
        const cosY = Math.cos(yRad);
        const sinY = Math.sin(yRad);
        const cosP = Math.cos(pRad);
        const sinP = Math.sin(pRad);
        const cosR = Math.cos(rRad);
        const sinR = Math.sin(rRad);
        // Roll around Y axis
        const x1 = point[0] * cosR + point[2] * sinR;
        const y1 = point[1];
        const z1 = -point[0] * sinR + point[2] * cosR;
        // Pitch around X axis
        const x2 = x1;
        const y2 = y1 * cosP - z1 * sinP;
        const z2 = y1 * sinP + z1 * cosP;
        // Yaw around Z axis
        const x3 = x2 * cosY - y2 * sinY;
        const y3 = x2 * sinY + y2 * cosY;
        const z3 = z2;
        return [x3, y3, z3];
    }
}
