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
import { NativeStateBridge, SnapshotValidationError, FrameIntegrityError } from './native_state_bridge';
import { SpatialVoxelRenderer } from './spatial_voxel_renderer';
import { CellInspector } from './cell_inspector';
import { StudioNavigation } from './studio_navigation';
import { AgiOneInspector } from './agi_one_inspector';
export class ActuationBlockedError extends Error {
    constructor(message = 'Hardware actuation is permanently blocked in sovereign read-only 3D Memory Studio') {
        super(`[P26.4 Actuation Blocked] ${message}`);
        this.name = 'ActuationBlockedError';
    }
}
export class Native3DMemoryStudio {
    lifecycleState = 'INITIALIZING';
    stateBridge;
    voxelRenderer;
    cellInspector;
    navigation;
    agiOneInspector;
    // Actuation Lockout Invariant
    actuationBlocked = true;
    constructor(config) {
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
    getStateBridge() {
        return this.stateBridge;
    }
    getVoxelRenderer() {
        return this.voxelRenderer;
    }
    getParticleRenderer() {
        return this.voxelRenderer.getParticleRenderer();
    }
    getCellInspector() {
        return this.cellInspector;
    }
    getNavigation() {
        return this.navigation;
    }
    getAgiOneInspector() {
        return this.agiOneInspector;
    }
    getLifecycleState() {
        return this.lifecycleState;
    }
    isActuationBlocked() {
        return this.actuationBlocked;
    }
    executeActuation() {
        throw new ActuationBlockedError();
    }
    // --- Interactive Commands ---
    navigate(section) {
        this.navigation.navigate(section);
    }
    selectCell(cellId) {
        if (cellId < 0 || cellId > 342 || !Number.isInteger(cellId)) {
            throw new Error(`[Native3DMemoryStudio] Invalid cellId: ${cellId}. Must be integer in 0..342`);
        }
        this.voxelRenderer.setSelectedCell(cellId);
        this.cellInspector.setActiveCell(cellId);
        // Auto-align slice to the selected cell's z-coordinate (k)
        const k = cellId % 7;
        this.voxelRenderer.setSlice(k);
    }
    selectCenterOrigin() {
        this.selectCell(171); // Node (3, 3, 3)
    }
    setSlice(k) {
        this.voxelRenderer.setSlice(k);
    }
    setProjectionMode(mode) {
        this.voxelRenderer.setProjectionMode(mode);
    }
    rotateCamera(yawDeltaDeg, pitchDeltaDeg, rollDeltaDeg = 0) {
        const cam = this.voxelRenderer.getCamera();
        let newYaw = (cam.yawDeg + yawDeltaDeg) % 360;
        if (newYaw < 0)
            newYaw += 360;
        let newPitch = Math.max(-89, Math.min(89, cam.pitchDeg + pitchDeltaDeg));
        let newRoll = ((cam.rollDeg ?? 0) + rollDeltaDeg) % 360;
        if (newRoll < 0)
            newRoll += 360;
        this.voxelRenderer.setCamera({ yawDeg: newYaw, pitchDeg: newPitch, rollDeg: newRoll });
    }
    stepRotation(yawDelta = 15, pitchDelta = 0, rollDelta = 0) {
        this.rotateCamera(yawDelta, pitchDelta, rollDelta);
    }
    setZoom(zoom) {
        if (zoom <= 0.1 || zoom > 10.0) {
            throw new Error(`[Native3DMemoryStudio] Zoom must be in (0.1, 10.0], received: ${zoom}`);
        }
        this.voxelRenderer.setCamera({ zoom });
    }
    // --- Snapshot Ingestion ---
    ingestSnapshot(snapshot) {
        this.lifecycleState = 'COMPUTING';
        try {
            const frame = this.stateBridge.ingestSnapshot(snapshot);
            this.lifecycleState = 'READY';
            return frame;
        }
        catch (err) {
            if (err instanceof FrameIntegrityError) {
                this.lifecycleState = 'INTEGRITY_FAILURE';
            }
            else if (err instanceof SnapshotValidationError) {
                this.lifecycleState = 'INVALID_FRAME';
            }
            else {
                this.lifecycleState = 'ERROR';
            }
            throw err;
        }
    }
    // --- Workspace Rendering ---
    renderWorkspace() {
        const startTime = Date.now();
        this.lifecycleState = 'RENDERING';
        const activeFrame = this.stateBridge.getActiveFrame();
        const navBar = this.navigation.formatNavigationBar();
        const currentSection = this.navigation.getActiveSection();
        let mainViewportText = '';
        if (currentSection === 'MEMORY_3D') {
            if (activeFrame) {
                const renderResult = this.voxelRenderer.render(activeFrame);
                mainViewportText = renderResult.renderedText;
            }
            else {
                mainViewportText = this.renderAwaitingFrameNotice();
            }
        }
        else {
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
        }
        catch {
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
    renderAwaitingFrameNotice() {
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
    renderSectionStub(section) {
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
    formatFooterBar(frame, selectedCellId, renderMs) {
        const epochStr = frame ? `EPOCH: ${frame.stateEpoch}` : 'EPOCH: —';
        const seqStr = frame ? `SEQ: ${frame.sequenceNumber}` : 'SEQ: —';
        const hashStr = frame ? `HASH: ${frame.canonicalHash.substring(0, 8)}...` : 'HASH: —';
        return `[LIFECYCLE: ${this.lifecycleState}] | ${epochStr} | ${seqStr} | SELECTED: ${selectedCellId} | LATENCY: ${renderMs}ms | ACTUATION: BLOCKED | ${hashStr}`;
    }
}
