/**
 * Oview OS — Sovereign Spreadsheet Application Controller (Phase 12: Osheets)
 * ==============================================================================
 * OsheetsApp.ts: Tabular data grid, ONE Language formula evaluator,
 * cell formatting, auto-calculations (SUM, AVG, MIN, MAX), and CSV export.
 */

import { VirtualFileSystem } from '../../vfs/VirtualFileSystem';
import { OltoDOMRenderer, OltoDOMElement } from '../../../olto/runtime/OltoDOMRenderer';

export interface CellData {
  raw: string;
  computed: string;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  format?: 'text' | 'currency' | 'number';
}

export class OsheetsApp {
  private vfs: VirtualFileSystem;
  public title: string = 'Sovereign Budget 2026';
  public selectedCell: string = 'A1';
  public selectedRange: string[] = ['A1'];
  public cells: Record<string, CellData> = {};
  public colHeaders: string[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  public rowCount: number = 25;

  constructor(title: string = 'Sovereign Budget 2026', vfs?: VirtualFileSystem) {
    this.title = title;
    this.vfs = vfs || VirtualFileSystem.getInstance();
    this.initializeDefaultData();
  }

  private initializeDefaultData(): void {
    // Seed default template: Sovereign Budget
    this.setCellValue('A1', 'Item Description');
    this.setCellValue('B1', 'Category');
    this.setCellValue('C1', 'Cost ($)');
    this.setCellValue('D1', 'Status');

    this.setCellFormat('A1', { bold: true });
    this.setCellFormat('B1', { bold: true });
    this.setCellFormat('C1', { bold: true, align: 'right' });
    this.setCellFormat('D1', { bold: true });

    this.setCellValue('A2', 'Cloud Server VM');
    this.setCellValue('B2', 'Infrastructure');
    this.setCellValue('C2', '120');
    this.setCellValue('D2', 'Paid');

    this.setCellValue('A3', 'Domain Name Registry');
    this.setCellValue('B3', 'Operations');
    this.setCellValue('C3', '25');
    this.setCellValue('D3', 'Paid');

    this.setCellValue('A4', 'Hardware Edge Nodes');
    this.setCellValue('B4', 'Hardware');
    this.setCellValue('C4', '350');
    this.setCellValue('D4', 'Pending');

    this.setCellValue('A5', 'TOTAL COST');
    this.setCellFormat('A5', { bold: true });
    this.setCellValue('C5', '=SUM(C2:C4)');
    this.setCellFormat('C5', { bold: true, align: 'right', format: 'currency' });

    this.recalculateAll();
  }

  public setCellValue(cellId: string, raw: string): void {
    const id = cellId.toUpperCase().trim();
    if (!this.cells[id]) {
      this.cells[id] = { raw: '', computed: '' };
    }
    this.cells[id].raw = raw;
    this.recalculateAll();
  }

  public getCellValue(cellId: string): string {
    const id = cellId.toUpperCase().trim();
    return this.cells[id] ? this.cells[id].raw : '';
  }

  public getComputedValue(cellId: string): string {
    const id = cellId.toUpperCase().trim();
    return this.cells[id] ? this.cells[id].computed : '';
  }

  public setCellFormat(cellId: string, format: Partial<CellData>): void {
    const id = cellId.toUpperCase().trim();
    if (!this.cells[id]) {
      this.cells[id] = { raw: '', computed: '' };
    }
    Object.assign(this.cells[id], format);
  }

  public expandRange(rangeStr: string): string[] {
    const parts = rangeStr.toUpperCase().trim().split(':');
    if (parts.length === 1) return [parts[0]];
    if (parts.length !== 2) return [];

    const start = parts[0];
    const end = parts[1];

    const startCol = start.charCodeAt(0);
    const startRow = parseInt(start.slice(1), 10);
    const endCol = end.charCodeAt(0);
    const endRow = parseInt(end.slice(1), 10);

    if (isNaN(startRow) || isNaN(endRow)) return [];

    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);

    const result: string[] = [];
    for (let c = minCol; c <= maxCol; c++) {
      for (let r = minRow; r <= maxRow; r++) {
        result.push(String.fromCharCode(c) + r);
      }
    }
    return result;
  }

  public evaluateFormula(expr: string): string {
    const trimmed = expr.trim();
    if (!trimmed.startsWith('=')) return trimmed;

    const formula = trimmed.slice(1).trim().toUpperCase();

    // 1. Function: =SUM(range)
    const sumMatch = formula.match(/^SUM\(([A-Z0-9:]+)\)$/);
    if (sumMatch) {
      const cells = this.expandRange(sumMatch[1]);
      let sum = 0;
      for (const cid of cells) {
        const val = parseFloat(this.getComputedValue(cid));
        if (!isNaN(val)) sum += val;
      }
      return sum.toString();
    }

    // 2. Function: =AVG(range)
    const avgMatch = formula.match(/^AVG\(([A-Z0-9:]+)\)$/);
    if (avgMatch) {
      const cells = this.expandRange(avgMatch[1]);
      let sum = 0;
      let count = 0;
      for (const cid of cells) {
        const val = parseFloat(this.getComputedValue(cid));
        if (!isNaN(val)) {
          sum += val;
          count++;
        }
      }
      return count > 0 ? (sum / count).toFixed(2) : '0';
    }

    // 3. Function: =MIN(range)
    const minMatch = formula.match(/^MIN\(([A-Z0-9:]+)\)$/);
    if (minMatch) {
      const cells = this.expandRange(minMatch[1]);
      let min = Infinity;
      for (const cid of cells) {
        const val = parseFloat(this.getComputedValue(cid));
        if (!isNaN(val) && val < min) min = val;
      }
      return min === Infinity ? '0' : min.toString();
    }

    // 4. Function: =MAX(range)
    const maxMatch = formula.match(/^MAX\(([A-Z0-9:]+)\)$/);
    if (maxMatch) {
      const cells = this.expandRange(maxMatch[1]);
      let max = -Infinity;
      for (const cid of cells) {
        const val = parseFloat(this.getComputedValue(cid));
        if (!isNaN(val) && val > max) max = val;
      }
      return max === -Infinity ? '0' : max.toString();
    }

    // 5. Function: =COUNT(range)
    const countMatch = formula.match(/^COUNT\(([A-Z0-9:]+)\)$/);
    if (countMatch) {
      const cells = this.expandRange(countMatch[1]);
      let count = 0;
      for (const cid of cells) {
        const val = this.getComputedValue(cid);
        if (val.trim() !== '') count++;
      }
      return count.toString();
    }

    // 6. Basic Binary Arithmetic: =A1 + B1, =A1 * 2, etc.
    const binaryMatch = formula.match(/^([A-Z0-9]+)\s*([\+\-\*\/])\s*([A-Z0-9]+)$/);
    if (binaryMatch) {
      const leftKey = binaryMatch[1];
      const op = binaryMatch[2];
      const rightKey = binaryMatch[3];

      const leftVal = isNaN(Number(leftKey)) ? parseFloat(this.getComputedValue(leftKey)) : parseFloat(leftKey);
      const rightVal = isNaN(Number(rightKey)) ? parseFloat(this.getComputedValue(rightKey)) : parseFloat(rightKey);

      if (isNaN(leftVal) || isNaN(rightVal)) return '#VALUE!';

      switch (op) {
        case '+': return (leftVal + rightVal).toString();
        case '-': return (leftVal - rightVal).toString();
        case '*': return (leftVal * rightVal).toString();
        case '/': return rightVal !== 0 ? (leftVal / rightVal).toString() : '#DIV/0!';
      }
    }

    return '#ERROR!';
  }

  public recalculateAll(): void {
    // 2 passes for dependency resolution
    for (let pass = 0; pass < 2; pass++) {
      for (const [id, cell] of Object.entries(this.cells)) {
        if (cell.raw.startsWith('=')) {
          cell.computed = this.evaluateFormula(cell.raw);
        } else {
          cell.computed = cell.raw;
        }
      }
    }
  }

  public getRangeStats(range: string[]): { sum: number; avg: number; count: number; min: number; max: number } {
    let sum = 0;
    let count = 0;
    let min = Infinity;
    let max = -Infinity;

    for (const cid of range) {
      const val = parseFloat(this.getComputedValue(cid));
      if (!isNaN(val)) {
        sum += val;
        count++;
        if (val < min) min = val;
        if (val > max) max = val;
      }
    }

    return {
      sum,
      avg: count > 0 ? sum / count : 0,
      count,
      min: min === Infinity ? 0 : min,
      max: max === -Infinity ? 0 : max,
    };
  }

  public exportToCSV(): string {
    const rows: string[] = [];
    for (let r = 1; r <= this.rowCount; r++) {
      const cols: string[] = [];
      let hasData = false;
      for (const c of this.colHeaders) {
        const id = `${c}${r}`;
        const val = this.getComputedValue(id);
        if (val) hasData = true;
        // Escape quotes
        cols.push(`"${val.replace(/"/g, '""')}"`);
      }
      if (hasData || r <= 10) {
        rows.push(cols.join(','));
      }
    }
    return rows.join('\n');
  }

  public saveToVFS(path: string = '/user/documents/budget_2026.osheet'): void {
    const payload = JSON.stringify({
      title: this.title,
      cells: this.cells,
      colHeaders: this.colHeaders,
      rowCount: this.rowCount,
      exportedAt: Date.now(),
    }, null, 2);
    this.vfs.writeFile(path, payload);
  }

  public loadFromVFS(path: string): boolean {
    if (!this.vfs.exists(path)) return false;
    try {
      const raw = this.vfs.readFile(path);
      const parsed = JSON.parse(raw);
      if (parsed.cells) {
        this.title = parsed.title || this.title;
        this.cells = parsed.cells;
        this.recalculateAll();
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  /**
   * DOM Renderer for Osheets Component.
   */
  public renderToElement(): OltoDOMElement {
    const container = OltoDOMRenderer.createElement('div');
    container.setAttribute('class', 'oview-app-osheets');
    container.setAttribute('style', 'display: flex; flex-direction: column; height: 100%; color: #f8fafc; font-family: -apple-system, sans-serif; background: #0f172a;');

    // Header Toolbar
    const toolbar = OltoDOMRenderer.createElement('div');
    toolbar.setAttribute('style', 'display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(0,0,0,0.3); border-bottom: 1px solid rgba(255,255,255,0.08);');
    const titleSpan = OltoDOMRenderer.createElement('span');
    titleSpan.setAttribute('style', 'font-weight: 700; color: #10b981; font-size: 13px;');
    titleSpan.appendChild(OltoDOMRenderer.createTextNode(`📊 ${this.title}`));
    toolbar.appendChild(titleSpan);
    container.appendChild(toolbar);

    // Formula Bar
    const fxBar = OltoDOMRenderer.createElement('div');
    fxBar.setAttribute('style', 'display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: rgba(0,0,0,0.2); border-bottom: 1px solid rgba(255,255,255,0.06); font-family: monospace; font-size: 11px;');
    const fxLabel = OltoDOMRenderer.createElement('span');
    fxLabel.setAttribute('style', 'color: #38bdf8; font-weight: bold;');
    fxLabel.appendChild(OltoDOMRenderer.createTextNode(this.selectedCell + ' fx:'));
    const fxVal = OltoDOMRenderer.createElement('span');
    fxVal.setAttribute('style', 'color: #fff;');
    fxVal.appendChild(OltoDOMRenderer.createTextNode(this.getCellValue(this.selectedCell)));
    fxBar.appendChild(fxLabel);
    fxBar.appendChild(fxVal);
    container.appendChild(fxBar);

    // Status bar
    const statusBar = OltoDOMRenderer.createElement('div');
    statusBar.setAttribute('style', 'display: flex; justify-content: space-between; padding: 4px 12px; background: rgba(0,0,0,0.4); border-top: 1px solid rgba(255,255,255,0.08); font-size: 10px; color: #94a3b8;');
    const stats = this.getRangeStats(['C2', 'C3', 'C4']);
    const statsText = OltoDOMRenderer.createElement('span');
    statsText.appendChild(OltoDOMRenderer.createTextNode(`SUM: ${stats.sum} | AVG: ${stats.avg.toFixed(1)} | COUNT: ${stats.count}`));
    statusBar.appendChild(statsText);
    container.appendChild(statusBar);

    return container;
  }
}
