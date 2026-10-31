/**
 * Oview OS — Sovereign Infinite Whiteboard Application Controller (Phase 12: Ocanvas)
 * ====================================================================================
 * OcanvasApp.ts: 2D infinite spatial canvas, interactive sticky notes,
 * mind-mapping connector arrows, flowcharts, and board persistence.
 */

import { VirtualFileSystem } from '../../vfs/VirtualFileSystem';
import { OltoDOMRenderer, OltoDOMElement } from '../../../olto/runtime/OltoDOMRenderer';

export type CanvasItemType = 'sticky' | 'shape' | 'connector';

export interface BaseItem {
  id: string;
  type: CanvasItemType;
  x: number;
  y: number;
}

export interface StickyItem extends BaseItem {
  type: 'sticky';
  width: number;
  height: number;
  text: string;
  color: string; // e.g. '#fef08a' (yellow), '#fbcfe8' (pink), '#bbf7d0' (green), '#bae6fd' (cyan)
}

export interface ShapeItem extends BaseItem {
  type: 'shape';
  width: number;
  height: number;
  shapeType: 'rect' | 'circle' | 'diamond';
  label: string;
  color: string;
}

export interface ConnectorItem extends BaseItem {
  type: 'connector';
  fromId: string;
  toId: string;
  label?: string;
  color?: string;
}

export type CanvasItem = StickyItem | ShapeItem | ConnectorItem;

export class OcanvasApp {
  private vfs: VirtualFileSystem;
  public title: string = 'Architecture Mindmap';
  public panX: number = 0;
  public panY: number = 0;
  public zoom: number = 1.0;
  public activeTool: string = 'select';
  public selectedId: string | null = null;
  public items: CanvasItem[] = [];

  constructor(title: string = 'Architecture Mindmap', vfs?: VirtualFileSystem) {
    this.title = title;
    this.vfs = vfs || VirtualFileSystem.getInstance();
    this.initializeDefaultBoard();
  }

  private initializeDefaultBoard(): void {
    // 1. Central Concept Box
    const coreId = 'node_core';
    this.items.push({
      id: coreId,
      type: 'shape',
      shapeType: 'rect',
      x: 180,
      y: 120,
      width: 180,
      height: 70,
      label: 'Sovereign Oview OS\n(ONE Language Core)',
      color: '#10b981',
    });

    // 2. Sticky Note A: Osheets
    const osheetsId = 'sticky_osheets';
    this.items.push({
      id: osheetsId,
      type: 'sticky',
      x: 460,
      y: 70,
      width: 160,
      height: 120,
      text: '📊 Osheets\n• Excel in ONE\n• Live Formula Math\n• CSV & VFS Export',
      color: '#bae6fd', // Cyan
    });

    // 3. Sticky Note B: Ocanvas
    const ocanvasId = 'sticky_ocanvas';
    this.items.push({
      id: ocanvasId,
      type: 'sticky',
      x: 460,
      y: 240,
      width: 160,
      height: 120,
      text: '🎨 Ocanvas\n• Infinite 2D Surface\n• Miro & FigJam Style\n• Mind-Mapping Links',
      color: '#fef08a', // Yellow
    });

    // 4. Connectors
    this.items.push({
      id: 'conn_1',
      type: 'connector',
      fromId: coreId,
      toId: osheetsId,
      label: 'Powers',
      color: '#38bdf8',
      x: 0,
      y: 0,
    });

    this.items.push({
      id: 'conn_2',
      type: 'connector',
      fromId: coreId,
      toId: ocanvasId,
      label: 'Visualizes',
      color: '#fbbf24',
      x: 0,
      y: 0,
    });
  }

  public addSticky(text: string, x: number = 200, y: number = 200, color: string = '#fef08a'): StickyItem {
    const item: StickyItem = {
      id: 'sticky_' + Math.random().toString(36).substring(2, 9),
      type: 'sticky',
      x,
      y,
      width: 150,
      height: 110,
      text,
      color,
    };
    this.items.push(item);
    this.selectedId = item.id;
    return item;
  }

  public addShape(label: string, shapeType: 'rect' | 'circle' | 'diamond' = 'rect', x: number = 250, y: number = 250, color: string = '#10b981'): ShapeItem {
    const item: ShapeItem = {
      id: 'shape_' + Math.random().toString(36).substring(2, 9),
      type: 'shape',
      shapeType,
      x,
      y,
      width: 160,
      height: 60,
      label,
      color,
    };
    this.items.push(item);
    this.selectedId = item.id;
    return item;
  }

  public addConnector(fromId: string, toId: string, label: string = '', color: string = '#38bdf8'): ConnectorItem {
    const item: ConnectorItem = {
      id: 'conn_' + Math.random().toString(36).substring(2, 9),
      type: 'connector',
      fromId,
      toId,
      label,
      color,
      x: 0,
      y: 0,
    };
    this.items.push(item);
    return item;
  }

  public moveItem(id: string, dx: number, dy: number): boolean {
    const item = this.items.find(i => i.id === id);
    if (!item || item.type === 'connector') return false;
    item.x += dx;
    item.y += dy;
    return true;
  }

  public deleteItem(id: string): boolean {
    const initialLen = this.items.length;
    this.items = this.items.filter(i => {
      if (i.id === id) return false;
      if (i.type === 'connector') {
        const conn = i as ConnectorItem;
        if (conn.fromId === id || conn.toId === id) return false;
      }
      return true;
    });
    if (this.selectedId === id) this.selectedId = null;
    return this.items.length < initialLen;
  }

  public setPan(x: number, y: number): void {
    this.panX = x;
    this.panY = y;
  }

  public setZoom(zoom: number): void {
    this.zoom = Math.max(0.2, Math.min(3.0, zoom));
  }

  public saveToVFS(path: string = '/user/documents/architecture_mindmap.board'): void {
    const payload = JSON.stringify({
      title: this.title,
      panX: this.panX,
      panY: this.panY,
      zoom: this.zoom,
      items: this.items,
      savedAt: Date.now(),
    }, null, 2);
    this.vfs.writeFile(path, payload);
  }

  public loadFromVFS(path: string): boolean {
    if (!this.vfs.exists(path)) return false;
    try {
      const raw = this.vfs.readFile(path);
      const parsed = JSON.parse(raw);
      if (parsed.items) {
        this.title = parsed.title || this.title;
        this.panX = parsed.panX || 0;
        this.panY = parsed.panY || 0;
        this.zoom = parsed.zoom || 1.0;
        this.items = parsed.items;
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  /**
   * DOM Renderer for Ocanvas Component.
   */
  public renderToElement(): OltoDOMElement {
    const container = OltoDOMRenderer.createElement('div');
    container.setAttribute('class', 'oview-app-ocanvas');
    container.setAttribute('style', 'display: flex; flex-direction: column; height: 100%; color: #f8fafc; font-family: -apple-system, sans-serif; background: #090d16; overflow: hidden;');

    // Header Toolbar
    const toolbar = OltoDOMRenderer.createElement('div');
    toolbar.setAttribute('style', 'display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(0,0,0,0.3); border-bottom: 1px solid rgba(255,255,255,0.08);');
    const titleSpan = OltoDOMRenderer.createElement('span');
    titleSpan.setAttribute('style', 'font-weight: 700; color: #38bdf8; font-size: 13px;');
    titleSpan.appendChild(OltoDOMRenderer.createTextNode(`🎨 ${this.title}`));
    toolbar.appendChild(titleSpan);
    container.appendChild(toolbar);

    // Canvas Status Bar
    const statusBar = OltoDOMRenderer.createElement('div');
    statusBar.setAttribute('style', 'display: flex; justify-content: space-between; padding: 4px 12px; background: rgba(0,0,0,0.4); border-top: 1px solid rgba(255,255,255,0.08); font-size: 10px; color: #94a3b8;');
    const infoText = OltoDOMRenderer.createElement('span');
    infoText.appendChild(OltoDOMRenderer.createTextNode(`Items: ${this.items.length} | Zoom: ${Math.round(this.zoom * 100)}% | Infinite 2D Surface`));
    statusBar.appendChild(infoText);
    container.appendChild(statusBar);

    return container;
  }
}
