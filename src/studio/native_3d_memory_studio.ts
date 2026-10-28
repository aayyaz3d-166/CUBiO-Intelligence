/**
 * CUBiO / AGI ONE — GATE CNL-P26.4
 * NATIVE 3D MEMORY STUDIO — MASTER APPLICATION ORCHESTRATOR
 *
 * File: f:\ONE language\src\studio\native_3d_memory_studio.ts
 * Module: @one/studio/native-3d-memory-studio
 * Specification: Gate CNL-P26.4 Master Orchestrator
 *
 * Sovereign Native 3D Memory Studio orchestrator combining:
 *   - NativeStateBridge: atomic 8-stage frame validator
 *   - SpatialVoxelRenderer: 343-cell volumetric & isometric projection engine
 *   - CellInspector: 12-field deep mathematical cell inspector
 *   - StudioNavigation: 7-section sovereign workspace navigation
 *   - AgiOneInspector: 8-domain telemetry panel with strict truth lock
 *
 * STRICT SOVEREIGN TECHNOLOGICAL LOCK:
 *   - ZERO React, Tailwind, CSS, HTML, DOM
 *   - ZERO Three.js, WebGL, Canvas APIs, browser APIs
 *   - ZERO Node.js runtime builtins in core state machine
 *   - ZERO external AI models / ZERO Qwen residue
 *   - Permanent actuation lockout (isActuationBlocked === true)
 */

import {
  LatticeSnapshot,
  QuantumCellState,
  SpatialQuantumMapper
} from '../core/spatial_quantum_mapper';
import {
  NativeStateBridge,
  ValidatedRenderFrame,
  SnapshotValidationError,
  FrameIntegrityError
} from './native_state_bridge';
import {
  SpatialVoxelRenderer,
  ProjectionMode,
  RenderResult,
  RendererOptions
} from './spatial_voxel_renderer';
import { SpatialParticleRenderer } from './spatial_particle_renderer';
import {
  CellInspector,
  CellInspectionDetails
} from './cell_inspector';
import {
  StudioNavigation,
  StudioSection,
  StudioSectionInfo
} from './studio_navigation';
import {
  AgiOneInspector,
  AgiOneTelemetry
} from './agi_one_inspector';

export class ActuationBlockedError extends Error {
  constructor(message: string = 'Hardware actuation is permanently blocked in sovereign read-only 3D Memory Studio') {
    super(`[P26.4 Actuation Blocked] ${message}`);
    this.name = 'ActuationBlockedError';
  }
}

export type StudioLifecycleState =
  | 'INITIALIZING'
  | 'READY'
  | 'COMPUTING'
  | 'RENDERING'
  | 'DEGRADED'
  | 'UNAVAILABLE'
  | 'INVALID_FRAME'
  | 'INTEGRITY_FAILURE'
  | 'TOOLCHAIN_REQUIRED'
  | 'ERROR';

export interface StudioWorkspaceOutput {
  readonly lifecycleState: StudioLifecycleState;
  readonly activeSection: StudioSection;
  readonly navigationBar: string;
  readonly mainViewportText: string;
  readonly inspectorDetails: CellInspectionDetails;
  readonly inspectorSummaryText: string;
  readonly telemetryPanelText: string;
  readonly statusFooterText: string;
  readonly renderLatencyMs: number;
}

export interface StudioConfig {
  initialSection?: StudioSection;
  projectionMode?: ProjectionMode;
  initialSliceK?: number;
  initialCellId?: number;
}

export class Native3DMemoryStudio {
  private lifecycleState: StudioLifecycleState = 'INITIALIZING';
  private readonly stateBridge: NativeStateBridge;
  private readonly voxelRenderer: SpatialVoxelRenderer;
  private readonly cellInspector: CellInspector;
  private readonly navigation: StudioNavigation;
  private readonly agiOneInspector: AgiOneInspector;

  // Actuation Lockout Invariant
  private readonly actuationBlocked: boolean = true;

  constructor(config?: StudioConfig) {
    this.stateBridge = new NativeStateBridge();
    this.voxelRenderer = new SpatialVoxelRenderer({
      activeSliceK: config?.initialSliceK ?? 3,
      selectedCellId: config?.initialCellId ?? 171,
      projectionMode: config?.projectionMode ?? 'SLICE'
    });
    this.cellInspector = new CellInspector(config?.initialCellId ?? 171);
    this.navigation = new StudioNavigation(config?.initialSection ?? 'MEMORY_3D');
    this.agiOneInspector = new AgiOneInspector();

    this.lifecycleState = 'READY';
  }

  // --- Subsystem Accessors ---
  public getStateBridge(): NativeStateBridge {
    return this.stateBridge;
  }

  public getVoxelRenderer(): SpatialVoxelRenderer {
    return this.voxelRenderer;
  }

  public getParticleRenderer(): SpatialParticleRenderer {
    return this.voxelRenderer.getParticleRenderer();
  }

  public getCellInspector(): CellInspector {
    return this.cellInspector;
  }

  public getNavigation(): StudioNavigation {
    return this.navigation;
  }

  public getAgiOneInspector(): AgiOneInspector {
    return this.agiOneInspector;
  }

  public getLifecycleState(): StudioLifecycleState {
    return this.lifecycleState;
  }

  public isActuationBlocked(): boolean {
    return this.actuationBlocked;
  }

  public executeActuation(): never {
    throw new ActuationBlockedError();
  }

  // --- Interactive Commands ---

  public navigate(section: StudioSection): void {
    this.navigation.navigate(section);
  }

  public selectCell(cellId: number): void {
    if (cellId < 0 || cellId > 342 || !Number.isInteger(cellId)) {
      throw new Error(`[Native3DMemoryStudio] Invalid cellId: ${cellId}. Must be integer in 0..342`);
    }
    this.voxelRenderer.setSelectedCell(cellId);
    this.cellInspector.setActiveCell(cellId);

    // Auto-align slice to the selected cell's z-coordinate (k)
    const k = cellId % 7;
    this.voxelRenderer.setSlice(k);
  }

  public selectCenterOrigin(): void {
    this.selectCell(171); // Node (3, 3, 3)
  }

  public setSlice(k: number): void {
    this.voxelRenderer.setSlice(k);
  }

  public setProjectionMode(mode: ProjectionMode): void {
    this.voxelRenderer.setProjectionMode(mode);
  }

  public rotateCamera(yawDeltaDeg: number, pitchDeltaDeg: number, rollDeltaDeg: number = 0): void {
    const cam = this.voxelRenderer.getCamera();
    let newYaw = (cam.yawDeg + yawDeltaDeg) % 360;
    if (newYaw < 0) newYaw += 360;

    let newPitch = Math.max(-89, Math.min(89, cam.pitchDeg + pitchDeltaDeg));
    let newRoll = ((cam.rollDeg ?? 0) + rollDeltaDeg) % 360;
    if (newRoll < 0) newRoll += 360;

    this.voxelRenderer.setCamera({ yawDeg: newYaw, pitchDeg: newPitch, rollDeg: newRoll });
  }

  public stepRotation(yawDelta: number = 15, pitchDelta: number = 0, rollDelta: number = 0): void {
    this.rotateCamera(yawDelta, pitchDelta, rollDelta);
  }

  public setZoom(zoom: number): void {
    if (zoom <= 0.1 || zoom > 10.0) {
      throw new Error(`[Native3DMemoryStudio] Zoom must be in (0.1, 10.0], received: ${zoom}`);
    }
    this.voxelRenderer.setCamera({ zoom });
  }

  // --- Snapshot Ingestion ---

  public ingestSnapshot(snapshot: LatticeSnapshot): ValidatedRenderFrame {
    this.lifecycleState = 'COMPUTING';
    try {
      const frame = this.stateBridge.ingestSnapshot(snapshot);
      this.lifecycleState = 'READY';
      return frame;
    } catch (err: any) {
      if (err instanceof FrameIntegrityError) {
        this.lifecycleState = 'INTEGRITY_FAILURE';
      } else if (err instanceof SnapshotValidationError) {
        this.lifecycleState = 'INVALID_FRAME';
      } else {
        this.lifecycleState = 'ERROR';
      }
      throw err;
    }
  }

  // --- Workspace Rendering ---

  public renderWorkspace(): StudioWorkspaceOutput {
    const startTime = Date.now();
    this.lifecycleState = 'RENDERING';

    const activeFrame = this.stateBridge.getActiveFrame();
    const navBar = this.navigation.formatNavigationBar();
    const currentSection = this.navigation.getActiveSection();

    let mainViewportText: string = '';

    if (currentSection === 'MEMORY_3D') {
      if (activeFrame) {
        const renderResult = this.voxelRenderer.render(activeFrame);
        mainViewportText = renderResult.renderedText;
      } else {
        mainViewportText = this.renderAwaitingFrameNotice();
      }
    } else {
      mainViewportText = this.renderSectionStub(currentSection);
    }

    const selectedCellId = this.voxelRenderer.getSelectedCell();
    const inspection = this.cellInspector.inspectCell(activeFrame, selectedCellId);
    const inspectorDetailsText = this.cellInspector.formatInspectionDetails(inspection);
    const telemetryPanel = this.agiOneInspector.formatTelemetryPanel();

    const elapsed = Date.now() - startTime;
    this.agiOneInspector.recordMeasuredLatency(elapsed);

    // Try measuring memory if process is available, without hard Node dependency
    try {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        this.agiOneInspector.recordMeasuredRss(process.memoryUsage().rss);
      }
    } catch {
      // Keep unmeasured
    }

    this.lifecycleState = 'READY';

    const statusFooterText = this.formatFooterBar(activeFrame, selectedCellId, elapsed);

    return {
      lifecycleState: this.lifecycleState,
      activeSection: currentSection,
      navigationBar: navBar,
      mainViewportText,
      inspectorDetails: inspection,
      inspectorSummaryText: inspectorDetailsText,
      telemetryPanelText: telemetryPanel,
      statusFooterText,
      renderLatencyMs: elapsed
    };
  }

  private renderAwaitingFrameNotice(): string {
    return [
      `================================================================================`,
      `  CUBiO 3D MEMORY STUDIO — AWAITING CANONICAL P26.3 SNAPSHOT`,
      `================================================================================`,
      `  State: STANDBY / READY`,
      `  Waiting for validated 343-cell lattice snapshot from NativeStateBridge.`,
      `  Invoke studio.ingestSnapshot(snapshot) to populate 3D volumetric space.`,
      `================================================================================`
    ].join('\n');
  }

  private renderSectionStub(section: StudioSection): string {
    const secInfo = this.navigation.getActiveSectionInfo();
    return [
      `================================================================================`,
      `  CUBiO SOVEREIGN WORKSPACE — SECTION: ${secInfo.title.toUpperCase()}`,
      `================================================================================`,
      `  Description: ${secInfo.description}`,
      `  Status:      ACTIVE SOVEREIGN DOMAIN`,
      `  Actuation:   PERMANENTLY LOCKED (READ ONLY)`,
      `================================================================================`
    ].join('\n');
  }

  private formatFooterBar(
    frame: ValidatedRenderFrame | null,
    selectedCellId: number,
    renderMs: number
  ): string {
    const epochStr = frame ? `EPOCH: ${frame.stateEpoch}` : 'EPOCH: —';
    const seqStr = frame ? `SEQ: ${frame.sequenceNumber}` : 'SEQ: —';
    const hashStr = frame ? `HASH: ${frame.canonicalHash.substring(0, 8)}...` : 'HASH: —';

    return `[LIFECYCLE: ${this.lifecycleState}] | ${epochStr} | ${seqStr} | SELECTED: ${selectedCellId} | LATENCY: ${renderMs}ms | ACTUATION: BLOCKED | ${hashStr}`;
  }
}
