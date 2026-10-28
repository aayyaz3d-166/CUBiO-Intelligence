/**
 * ONE Language — GATE 18: Explorer UI
 * Module: Frontend JavaScript
 *
 * Consumes the backend REST API at /api/* and renders
 * query results, reasoning trace, concept graph, binary inspector,
 * and benchmark/status data.  Mock-only areas are labelled.
 */
(function () {
  'use strict';

  // ── DOM refs ──
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const queryInput = $('#query-input');
  const queryForm = $('#query-form');
  const queryBtn = $('#query-btn');
  const queryStatus = $('#query-status');
  const resultOutput = $('#result-output');
  const traceOutput = $('#trace-output');
  const traceClear = $('#trace-clear');
  const graphCanvas = $('#graph-canvas');
  const binaryOutput = $('#binary-output');
  const binInspectBtn = $('#bin-inspect-btn');
  const benchmarkOutput = $('#benchmark-output');
  const benchBtn = $('#bench-btn');
  const footerTime = $('#footer-time');
  const statusBadge = $('#status-badge');
  const nodeVersion = $('#node-version');
  const backendLabel = $('#backend-label');

  // ── Fetch helpers ──
  async function apiGet(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function apiPost(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // ── Load /api/status ──
  async function loadStatus() {
    try {
      const s = await apiGet('/api/status');
      statusBadge.textContent = 'online';
      statusBadge.className = 'badge ok';
      nodeVersion.textContent = 'node ' + (s.nodeVersion || 'v?') + '  ts ' + (s.tsVersion || '?');
      backendLabel.textContent = s.backend || 'ONE Language';
      footerTime.textContent = new Date(s.timestamp || Date.now()).toLocaleTimeString();
      // Refresh status every 5s
      setTimeout(loadStatus, 5000);
    } catch (e) {
      statusBadge.textContent = 'offline';
      statusBadge.className = 'badge err';
      footerTime.textContent = 'connection error';
    }
  }

  // ── Render concept graph on canvas ──
  function drawGraph(data) {
    const canvas = graphCanvas;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#11141c';
    ctx.fillRect(0, 0, W, H);

    if (!data || !data.nodes) {
      ctx.fillStyle = '#8a94a5';
      ctx.font = '12px monospace';
      ctx.fillText('No graph data', 16, 24);
      return;
    }

    const nodes = data.nodes;
    const edges = data.edges || [];

    // Compute layout bounds (from node positions)
    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pad = 0.1;
    const sx = (W - 60) / (maxX - minX + pad * 2);
    const sy = (H - 60) / (maxY - minY + pad * 2);

    // Helper: map [0,1] -> pixel
    function toX(v) { return 30 + (v - minX) * sx; }
    function toY(v) { return H - 30 - (v - minY) * sy; }

    // Draw edges (dark, thin)
    ctx.strokeStyle = '#2a3340';
    ctx.lineWidth = 1.5;
    for (const e of edges) {
      const x1 = toX(nodes.find(n => n.id === e.source).x);
      const y1 = toY(nodes.find(n => n.id === e.source).y);
      const x2 = toX(nodes.find(n => n.id === e.target).x);
      const y2 = toY(nodes.find(n => n.id === e.target).y);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Draw nodes
    for (const n of nodes) {
      const x = toX(n.x);
      const y = toY(n.y);
      const radius = 18;

      // Edge colors by relation type
      if (n.type === 'CATEGORY') {
        ctx.fillStyle = '#4a7aff';
        ctx.strokeStyle = '#5b8cff';
      } else if (n.type === 'OBJECT') {
        ctx.fillStyle = '#6a5aff';
        ctx.strokeStyle = '#7a6aff';
      } else {
        ctx.fillStyle = '#e6edf3';
        ctx.strokeStyle = '#8a94a5';
      }
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Label
      ctx.fillStyle = '#e6edf3';
      ctx.font = '11px monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.label, x + 22, y + 3);
      ctx.fillStyle = '#8a94a5';
      ctx.fillText(n.type, x + 22, y + 16);
    }

    // Edge labels
    ctx.fillStyle = '#8a94a5';
    ctx.font = '10px monospace';
    for (const e of edges) {
      const src = nodes.find(n => n.id === e.source);
      const tgt = nodes.find(n => n.id === e.target);
      const x1 = toX(src.x);
      const y1 = toY(src.y);
      const x2 = toX(tgt.x);
      const y2 = toY(tgt.y);
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      ctx.fillText(e.relation, mx + 4, my - 4);
    }
  }

  // ── API call: query ──
  async function runQuery() {
    const text = queryInput.value.trim();
    if (!text) { queryStatus.textContent = 'Enter a query first'; return; }

    queryBtn.disabled = true;
    queryBtn.textContent = 'Running…';
    queryStatus.textContent = 'Running…';
    resultOutput.textContent = 'Querying real engine…';

    try {
      const data = await apiPost('/api/query', {query: text});
      resultOutput.textContent = data.result || 'No result';
      queryStatus.textContent = 'OK';
      queryStatus.className = 'status ok';
    } catch (e) {
      resultOutput.textContent = 'Error: ' + e.message;
      queryStatus.textContent = 'Error';
      queryStatus.className = 'status err';
    } finally {
      queryBtn.disabled = false;
      queryBtn.textContent = 'Run';
    }
  }

  // ── API call: trace ──
  async function loadTrace() {
    try {
      const data = await apiGet('/api/trace?n=20');
      traceOutput.textContent = data.entries.join('\n') || 'No trace entries';
    } catch (e) {
      traceOutput.textContent = 'Error loading trace: ' + e.message;
    }
  }

  // ── API call: binary inspector ──
  async function inspectBinary() {
    const files = [];
    if ($('#bin-encoder').checked) files.push('binaryEncoder.ts');
    if ($('#bin-decoder').checked) files.push('binaryDecoder.ts');
    if ($('#bin-codebook').checked) files.push('binaryCodebook.ts');

    if (files.length === 0) {
      binaryOutput.textContent = 'No files selected';
      return;
    }

    try {
      const data = await apiPost('/api/binary', {files});
      let out = '';
      for (const [name, info] of Object.entries(data.results)) {
        out += 'File: ' + name + '\n';
        if (info.error) {
          out += '  ERROR: ' + info.error + '\n';
        } else {
          out += '  size: ' + info.size + ' bytes\n';
          out += '  sha256: ' + info.sha256 + '\n';
        }
      }
      binaryOutput.textContent = out || 'No results';
    } catch (e) {
      binaryOutput.textContent = 'Error: ' + e.message;
    }
  }

  // ── API call: benchmark ──
  async function runBenchmark() {
    benchBtn.disabled = true;
    benchBtn.textContent = 'Running…';
    benchmarkOutput.textContent = 'Running read-only benchmark…';

    try {
      const data = await apiGet('/api/benchmark');
      benchmarkOutput.textContent = data.results.join('\n') || 'No benchmark output';
      benchBtn.disabled = false;
      benchBtn.textContent = 'Run Benchmark';
    } catch (e) {
      benchmarkOutput.textContent = 'Error: ' + e.message;
      benchBtn.disabled = false;
      benchBtn.textContent = 'Run Benchmark';
    }
  }

  // ── Wire up events ──
  queryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    runQuery();
  });

  traceClear.addEventListener('click', () => {
    traceOutput.textContent = 'Trace cleared';
  });

  binInspectBtn.addEventListener('click', inspectBinary);

  benchBtn.addEventListener('click', runBenchmark);

  // ── Init ──
  loadStatus();
  loadTrace();
})();
