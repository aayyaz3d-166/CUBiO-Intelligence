/**
 * CUBiO / AGI ONE — GATE CNL-P26.4 LIVE LAUNCH
 * NATIVE 3D MEMORY STUDIO LIVE DEVELOPMENT SERVER
 *
 * File: f:\ONE language\src\studio\live_server.ts
 * Module: @one/studio/live-server
 *
 * Exposes the verified, sovereign Native 3D Memory Studio on a browser-accessible
 * localhost URL while preserving all frozen P26.2, P26.3, and P26.4 invariants:
 *   - Native renderer / data flow preserved 100%
 *   - 343-cell 7x7x7 volumetric lattice state displayed
 *   - ZERO React / Tailwind / Three.js / WebGL / Canvas / DOM framework dependencies
 *   - Physical Sensor = UNAVAILABLE truth lock
 *   - Actuation Lockout = PERMANENTLY BLOCKED
 */
import * as http from 'node:http';
import * as url from 'node:url';
import { Native3DMemoryStudio } from './native_3d_memory_studio';
import { SpatialQuantumMapper } from '../core/spatial_quantum_mapper';
// --- Configuration & Parameters ---
const PREFERRED_PORTS = [3000, 8080, 8085, 3430, 0];
const standardParams = {
    base_frequency: 3.0,
    phase_velocity: 1.0,
    decay_constant: 0.1,
    harmonic_order: 3
};
const standardIntent = {
    direction: [0.57735, 0.57735, 0.57735],
    focus_point: [3, 3, 3],
    intensity: 0.85
};
// Initialize Studio and State
const studio = new Native3DMemoryStudio({
    projectionMode: 'PARTICLE',
    initialSliceK: 3,
    initialCellId: 171
});
let currentEpoch = 0;
let currentSeed = 12345;
function computeAndIngestSnapshot(epoch) {
    const snap = SpatialQuantumMapper.compute_lattice_snapshot(currentSeed, epoch, standardParams, standardIntent);
    studio.ingestSnapshot(snap);
    return snap;
}
// Ingest Initial Frame 0
computeAndIngestSnapshot(currentEpoch);
// --- HTML Template Generator (Pure Server-Rendered Monospace Studio Terminal) ---
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
function ansiToHtml(str) {
    return escapeHtml(str)
        .replace(/\x1b\[1;96m/g, '<span style="color:#00f0ff;font-weight:bold;text-shadow:0 0 8px rgba(0,240,255,0.8)">')
        .replace(/\x1b\[36m/g, '<span style="color:#00a0b0">')
        .replace(/\x1b\[1;92m/g, '<span style="color:#39ff14;font-weight:bold;text-shadow:0 0 8px rgba(57,255,20,0.8)">')
        .replace(/\x1b\[92m/g, '<span style="color:#00ff66;font-weight:bold">')
        .replace(/\x1b\[32m/g, '<span style="color:#2ea043">')
        .replace(/\x1b\[2;32m/g, '<span style="color:#196c2e">')
        .replace(/\x1b\[0m/g, '</span>')
        .replace(/\x1b\[[0-9;]*m/g, '');
}
function renderHtmlPage() {
    const ws = studio.renderWorkspace();
    const selectedCell = studio.getCellInspector().getActiveCell();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CUBiO / AGI ONE — Native 3D Memory Studio</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0b0f17;
      color: #c9d1d9;
      font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
      font-size: 13px;
      line-height: 1.4;
      padding: 16px;
    }
    header {
      border: 1px solid #30363d;
      background: #161b22;
      padding: 12px 16px;
      margin-bottom: 12px;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand {
      color: #58a6ff;
      font-weight: bold;
      font-size: 15px;
      letter-spacing: 1px;
    }
    .badges {
      display: flex;
      gap: 12px;
    }
    .badge {
      padding: 3px 8px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: bold;
      letter-spacing: 0.5px;
    }
    .badge-locked { background: #3d1b1f; color: #ff7b72; border: 1px solid #6e2025; }
    .badge-truth  { background: #262214; color: #d29922; border: 1px solid #5a4b18; }
    .badge-pass   { background: #132b1e; color: #3fb950; border: 1px solid #238636; }

    nav.controls {
      background: #161b22;
      border: 1px solid #30363d;
      padding: 10px 14px;
      margin-bottom: 12px;
      border-radius: 4px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }
    .control-group {
      display: flex;
      gap: 6px;
      align-items: center;
      margin-right: 12px;
    }
    .control-label {
      color: #8b949e;
      font-size: 11px;
      text-transform: uppercase;
      margin-right: 2px;
    }
    a.btn {
      display: inline-block;
      padding: 4px 10px;
      background: #21262d;
      color: #c9d1d9;
      text-decoration: none;
      border: 1px solid #30363d;
      border-radius: 3px;
      font-size: 12px;
      transition: all 0.15s ease;
    }
    a.btn:hover {
      background: #30363d;
      color: #58a6ff;
      border-color: #58a6ff;
    }
    a.btn.active {
      background: #1f6feb;
      color: #ffffff;
      border-color: #388bfd;
      font-weight: bold;
    }
    a.btn.warn {
      border-color: #8957e5;
      color: #d2a8ff;
    }

    .workspace-grid {
      display: grid;
      grid-template-columns: minmax(680px, 1fr) 420px;
      gap: 12px;
      margin-bottom: 12px;
    }
    .panel {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 4px;
      padding: 12px;
      overflow-x: auto;
    }
    .panel-header {
      font-size: 12px;
      font-weight: bold;
      color: #79c0ff;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #21262d;
      display: flex;
      justify-content: space-between;
    }
    pre {
      font-family: inherit;
      font-size: 12px;
      color: #e6edf3;
      white-space: pre;
      line-height: 1.35;
    }

    .sidebar {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    footer {
      border: 1px solid #30363d;
      background: #161b22;
      padding: 8px 14px;
      border-radius: 4px;
      font-size: 11px;
      color: #8b949e;
      display: flex;
      justify-content: space-between;
    }

    /* Cell quick select form */
    form.cell-form {
      display: inline-flex;
      gap: 4px;
    }
    input.cell-input {
      width: 60px;
      background: #0d1117;
      border: 1px solid #30363d;
      color: #58a6ff;
      padding: 3px 6px;
      border-radius: 3px;
      font-family: inherit;
      font-size: 12px;
    }
    button.cell-submit {
      padding: 3px 8px;
      background: #21262d;
      color: #c9d1d9;
      border: 1px solid #30363d;
      border-radius: 3px;
      font-family: inherit;
      cursor: pointer;
    }
    button.cell-submit:hover {
      background: #30363d;
      color: #58a6ff;
    }
  </style>
</head>
<body>

  <header>
    <div class="brand">CUBiO / AGI ONE — NATIVE 3D MEMORY STUDIO (P26.4 LIVE)</div>
    <div class="badges">
      <span class="badge badge-pass">343 CELLS (7x7x7)</span>
      <span class="badge badge-truth">PHYSICAL SENSOR: UNAVAILABLE</span>
      <span class="badge badge-locked">ACTUATION: PERMANENTLY BLOCKED</span>
      <span class="badge badge-pass">UUP=1.0 / ZERO DRIFT</span>
    </div>
  </header>

  <nav class="controls">
    <div class="control-group">
      <span class="control-label">View:</span>
      <a class="btn" href="/?mode=PARTICLE">HOLOGRAPHIC PARTICLE CLOUD (1,000+)</a>
      <a class="btn" href="/?mode=ISOMETRIC">3D ISOMETRIC LATTICE</a>
      <a class="btn" href="/?mode=SLICE">SLICE VIEW</a>
    </div>

    <div class="control-group">
      <span class="control-label">3D Rotation:</span>
      <a class="btn" href="/?mode=ISOMETRIC&yaw=15">Yaw +15°</a>
      <a class="btn" href="/?mode=ISOMETRIC&yaw=-15">Yaw -15°</a>
      <a class="btn" href="/?mode=ISOMETRIC&pitch=15">Pitch +15°</a>
      <a class="btn" href="/?mode=ISOMETRIC&pitch=-15">Pitch -15°</a>
      <a class="btn" href="/?mode=ISOMETRIC&roll=15">Roll +15°</a>
      <a class="btn" href="/?mode=ISOMETRIC&roll=-15">Roll -15°</a>
      <a class="btn" href="/?mode=ISOMETRIC&camReset=1">Reset 3D Cam</a>
    </div>

    <div class="control-group">
      <span class="control-label">Layer K (0..6):</span>
      <a class="btn" href="/?k=0&mode=SLICE">0</a>
      <a class="btn" href="/?k=1&mode=SLICE">1</a>
      <a class="btn" href="/?k=2&mode=SLICE">2</a>
      <a class="btn" href="/?k=3&mode=SLICE">3★</a>
      <a class="btn" href="/?k=4&mode=SLICE">4</a>
      <a class="btn" href="/?k=5&mode=SLICE">5</a>
      <a class="btn" href="/?k=6&mode=SLICE">6</a>
    </div>

    <div class="control-group">
      <span class="control-label">Selection:</span>
      <a class="btn warn" href="/?cell=171">CENTER NODE 171 (3,3,3)</a>
      <form class="cell-form" action="/" method="GET">
        <input class="cell-input" type="number" name="cell" min="0" max="342" placeholder="ID (0..342)" value="${selectedCell}">
        <button class="cell-submit" type="submit">Go</button>
      </form>
    </div>

    <div class="control-group">
      <span class="control-label">Harmonic Pulse:</span>
      <a class="btn" href="/?step=next">Next Epoch (t=${currentEpoch + 1})</a>
      <a class="btn" href="/?step=reset">Reset (t=0)</a>
    </div>

    <div class="control-group">
      <span class="control-label">API:</span>
      <a class="btn" href="/api/state" target="_blank">JSON State</a>
      <a class="btn" href="/api/telemetry" target="_blank">Telemetry</a>
    </div>
  </nav>

  <div class="workspace-grid">
    <div class="panel">
      <div class="panel-header">
        <span>VOLUMETRIC LATTICE VIEWPORT (NATIVE RENDER BUFFER)</span>
        <span>${escapeHtml(ws.activeSection)}</span>
      </div>
      <pre>${ansiToHtml(ws.mainViewportText)}</pre>
    </div>

    <div class="sidebar">
      <div class="panel">
        <div class="panel-header">
          <span>CELL INSPECTOR (12 FIELDS)</span>
          <span>CELL ID: ${selectedCell}</span>
        </div>
        <pre>${escapeHtml(ws.inspectorSummaryText)}</pre>
      </div>

      <div class="panel">
        <div class="panel-header">
          <span>AGI ONE SYSTEM TELEMETRY</span>
          <span>8 DOMAINS</span>
        </div>
        <pre>${escapeHtml(ws.telemetryPanelText)}</pre>
      </div>
    </div>
  </div>

  <footer>
    <div>${escapeHtml(ws.statusFooterText)}</div>
    <div>RENDER LATENCY: ${ws.renderLatencyMs.toFixed(2)}ms | MEMORY RSS: ${(process.memoryUsage().rss / (1024 * 1024)).toFixed(1)}MB</div>
  </footer>

</body>
</html>`;
}
// --- Request Handler ---
function handleRequest(req, res) {
    const parsedUrl = url.parse(req.url || '/', true);
    const pathname = parsedUrl.pathname || '/';
    const query = parsedUrl.query;
    // Handle Interactive Query Params
    try {
        if (query.mode === 'SLICE' || query.mode === 'ISOMETRIC' || query.mode === 'PARTICLE') {
            studio.setProjectionMode(query.mode);
        }
        if (typeof query.k === 'string') {
            const k = parseInt(query.k, 10);
            if (k >= 0 && k <= 6) {
                studio.setSlice(k);
            }
        }
        if (typeof query.cell === 'string') {
            const cellId = parseInt(query.cell, 10);
            if (cellId >= 0 && cellId <= 342) {
                studio.selectCell(cellId);
            }
        }
        if (typeof query.yaw === 'string' || typeof query.pitch === 'string' || typeof query.roll === 'string') {
            const yaw = parseFloat(query.yaw || '0');
            const pitch = parseFloat(query.pitch || '0');
            const roll = parseFloat(query.roll || '0');
            studio.rotateCamera(yaw, pitch, roll);
        }
        if (query.camReset === '1') {
            studio.getVoxelRenderer().setCamera({ yawDeg: 45, pitchDeg: 30, rollDeg: 0, zoom: 1.0 });
        }
        if (typeof query.zoom === 'string') {
            const zoom = parseFloat(query.zoom);
            if (zoom > 0.1 && zoom <= 10.0) {
                studio.setZoom(zoom);
            }
        }
        if (query.step === 'next') {
            currentEpoch += 1;
            studio.getParticleRenderer().advanceTick(1);
            computeAndIngestSnapshot(currentEpoch);
        }
        else if (query.step === 'reset') {
            currentEpoch = 0;
            studio.getParticleRenderer().advanceTick(0);
            computeAndIngestSnapshot(currentEpoch);
        }
        if (typeof query.nav === 'string') {
            studio.navigate(query.nav);
        }
    }
    catch (err) {
        console.error(`[Native3DMemoryStudio Live] Error processing command:`, err.message);
    }
    // Route Handling
    if (pathname === '/api/state') {
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(studio.renderWorkspace(), null, 2));
        return;
    }
    if (pathname === '/api/telemetry') {
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(studio.getAgiOneInspector().getTelemetry(), null, 2));
        return;
    }
    // Default: HTML Console
    res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(renderHtmlPage());
}
// --- Server Launcher with Dynamic Port Fallback ---
async function startServer() {
    for (const port of PREFERRED_PORTS) {
        try {
            const server = await tryListen(port);
            const actualPort = server.address().port;
            return { server, port: actualPort };
        }
        catch {
            // Try next port
        }
    }
    throw new Error('Could not bind server to any available port');
}
function tryListen(port) {
    return new Promise((resolve, reject) => {
        const srv = http.createServer(handleRequest);
        srv.once('error', (err) => {
            srv.close();
            reject(err);
        });
        srv.listen(port, '127.0.0.1', () => {
            resolve(srv);
        });
    });
}
// Main Execution
startServer()
    .then(({ port }) => {
    console.log('================================================================================');
    console.log('  CUBiO / AGI ONE — P26.4 NATIVE 3D MEMORY STUDIO LIVE SERVER');
    console.log('================================================================================');
    console.log('  Server status   : RUNNING (LIVE)');
    console.log(`  Localhost URL   : http://localhost:${port}/`);
    console.log(`  Port            : ${port}`);
    console.log('  Architecture    : SOVEREIGN NATIVE (Pure in-memory Native Render Buffer)');
    console.log('  343-Cell Space  : 7 x 7 x 7 Volumetric Lattice Active');
    console.log('  Physical Sensor : UNAVAILABLE (Truth Lock Enforced)');
    console.log('  Actuation Lock  : PERMANENTLY BLOCKED');
    console.log('================================================================================');
})
    .catch((err) => {
    console.error('CRITICAL ERROR LAUNCHING SERVER:', err.message);
    process.exit(1);
});
