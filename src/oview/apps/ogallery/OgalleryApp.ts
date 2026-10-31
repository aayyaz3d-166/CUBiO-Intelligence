/**
 * Ogallery — Controller & Sovereign Media Engine
 * ============================================================================
 * OgalleryApp.ts: Manages VFS media scanning, zoom, rotation,
 * and automated slideshow transitions.
 */

import { VirtualFileSystem } from '../../vfs/VirtualFileSystem';

export interface GalleryItem {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
}

export class OgalleryApp {
  private vfs: VirtualFileSystem;
  private items: GalleryItem[] = [];
  private activeIndex: number = 0;
  private zoomLevel: number = 100;
  private rotation: number = 0;
  private isSlideshow: boolean = false;

  constructor() {
    this.vfs = VirtualFileSystem.getInstance();
    this.scanMedia();
  }

  public scanMedia(): GalleryItem[] {
    this.items = [];
    try {
      const mediaDir = this.vfs.listDirectory('/user/media');
      for (const entry of mediaDir) {
        if (entry.type === 'file' && (entry.name.endsWith('.png') || entry.name.endsWith('.svg') || entry.name.endsWith('.jpg') || entry.name.endsWith('.art'))) {
          this.items.push({
            id: entry.name,
            name: entry.name,
            path: `/user/media/${entry.name}`,
            size: entry.size,
            type: 'image',
          });
        }
      }
    } catch {
      // media folder may be empty
    }

    // Fallback default sample images if media folder is empty
    if (this.items.length === 0) {
      this.items.push({
        id: 'artwork.png',
        name: 'artwork.png',
        path: '/user/media/artwork.png',
        size: 1024,
        type: 'image',
      });
      this.items.push({
        id: 'cyber_landscape.png',
        name: 'cyber_landscape.png',
        path: '/user/media/cyber_landscape.png',
        size: 2048,
        type: 'image',
      });
      this.items.push({
        id: 'sovereign_symbol.svg',
        name: 'sovereign_symbol.svg',
        path: '/user/media/sovereign_symbol.svg',
        size: 512,
        type: 'image',
      });
    }

    return [...this.items];
  }

  public getItems(): GalleryItem[] {
    return [...this.items];
  }

  public getActiveItem(): GalleryItem {
    return this.items[this.activeIndex] || this.items[0];
  }

  public setActiveIndex(index: number): void {
    if (index >= 0 && index < this.items.length) {
      this.activeIndex = index;
      this.zoomLevel = 100;
      this.rotation = 0;
    }
  }

  public nextImage(): GalleryItem {
    this.activeIndex = (this.activeIndex + 1) % this.items.length;
    this.zoomLevel = 100;
    this.rotation = 0;
    return this.getActiveItem();
  }

  public prevImage(): GalleryItem {
    this.activeIndex = (this.activeIndex - 1 + this.items.length) % this.items.length;
    this.zoomLevel = 100;
    this.rotation = 0;
    return this.getActiveItem();
  }

  public zoomIn(): number {
    this.zoomLevel = Math.min(300, this.zoomLevel + 25);
    return this.zoomLevel;
  }

  public zoomOut(): number {
    this.zoomLevel = Math.max(50, this.zoomLevel - 25);
    return this.zoomLevel;
  }

  public resetZoom(): number {
    this.zoomLevel = 100;
    return this.zoomLevel;
  }

  public getZoomLevel(): number {
    return this.zoomLevel;
  }

  public rotateClockwise(): number {
    this.rotation = (this.rotation + 90) % 360;
    return this.rotation;
  }

  public rotateCounterClockwise(): number {
    this.rotation = (this.rotation + 270) % 360;
    return this.rotation;
  }

  public getRotation(): number {
    return this.rotation;
  }

  public toggleSlideshow(): boolean {
    this.isSlideshow = !this.isSlideshow;
    return this.isSlideshow;
  }

  public isSlideshowActive(): boolean {
    return this.isSlideshow;
  }
}
