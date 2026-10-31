/**
 * Art Canvas — Controller & Creative Studio Logic
 * ============================================================================
 * ArtCanvasApp.ts: Implements drawing tools, brush dynamics, undo stack,
 * and VFS persistence for Art Canvas studio.
 */

import { VirtualFileSystem } from '../../vfs/VirtualFileSystem';

export type ArtTool = 'brush' | 'pencil' | 'line' | 'rect' | 'circle' | 'eraser';

export interface ArtLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
}

export class ArtCanvasApp {
  private currentTool: ArtTool = 'brush';
  private strokeColor: string = '#10b981';
  private strokeWidth: number = 4;
  private canvasWidth: number = 800;
  private canvasHeight: number = 520;
  private historyStack: string[] = []; // Stores Base64 / dataURLs
  private vfs: VirtualFileSystem;
  private currentPath: string = '/user/media/artwork.png';
  private layers: ArtLayer[] = [
    { id: 'layer_1', name: 'Background', visible: true, opacity: 1.0 },
    { id: 'layer_2', name: 'Artwork', visible: true, opacity: 1.0 },
  ];
  private activeLayerId: string = 'layer_2';

  constructor() {
    this.vfs = VirtualFileSystem.getInstance();
  }

  public getTool(): ArtTool {
    return this.currentTool;
  }

  public setTool(tool: ArtTool): void {
    this.currentTool = tool;
  }

  public getColor(): string {
    return this.strokeColor;
  }

  public setColor(color: string): void {
    this.strokeColor = color;
  }

  public getStrokeWidth(): number {
    return this.strokeWidth;
  }

  public setStrokeWidth(width: number): void {
    this.strokeWidth = Math.max(1, Math.min(width, 60));
  }

  public getDimensions(): { width: number; height: number } {
    return { width: this.canvasWidth, height: this.canvasHeight };
  }

  public pushHistory(dataUrl: string): void {
    this.historyStack.push(dataUrl);
    if (this.historyStack.length > 25) {
      this.historyStack.shift();
    }
  }

  public undo(): string | null {
    if (this.historyStack.length > 1) {
      this.historyStack.pop();
      return this.historyStack[this.historyStack.length - 1];
    }
    return null;
  }

  public getHistoryCount(): number {
    return this.historyStack.length;
  }

  public getLayers(): ArtLayer[] {
    return [...this.layers];
  }

  public saveToVFS(path: string = this.currentPath, content: string = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkWPjfDwAEcQHsXm31kQAAAABJRU5ErkJggg=='): boolean {
    this.currentPath = path;
    try {
      this.vfs.writeFile(path, content);
      return true;
    } catch {
      return false;
    }
  }

  public loadFromVFS(path: string): string | null {
    try {
      const content = this.vfs.readFile(path);
      this.currentPath = path;
      return content;
    } catch {
      return null;
    }
  }

  public getCurrentPath(): string {
    return this.currentPath;
  }
}
