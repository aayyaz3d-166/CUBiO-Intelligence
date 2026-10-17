/**
 * ONE Language — Paged Memory Manager
 * ====================================
 * Module: @one/memory/MemoryPageManager
 *
 * Implements the PAGE primitive for discrete spatial memory segmentation.
 * Manages fixed-size pages (64 KB / 256 KB) with canonical spatial alignment,
 * zero-copy view slicing, dirty page tracking, and strict physical RSS bounds.
 */

export interface MemoryPage {
  pageId: number;
  pageSizeBytes: number;
  canonicalAddressRange: [number, number]; // e.g. [26, 35]
  buffer: Uint8Array;
  isDirty: boolean;
  isPinned: boolean;
  allocatedAt: number;
  lastAccessedAt: number;
}

export class MemoryPageManager {
  public static readonly DEFAULT_PAGE_SIZE = 64 * 1024; // 64 KB per page
  private pages: Map<number, MemoryPage> = new Map();
  private maxPages: number;
  private pageSizeBytes: number;
  private nextPageId: number = 0;

  constructor(maxPages: number = 256, pageSizeBytes: number = MemoryPageManager.DEFAULT_PAGE_SIZE) {
    this.maxPages = maxPages;
    this.pageSizeBytes = pageSizeBytes;
  }

  /**
   * Allocates a new fixed-size memory page.
   */
  public allocatePage(canonicalAddressRange: [number, number] = [0, 0], pin: boolean = false): MemoryPage {
    if (this.pages.size >= this.maxPages) {
      throw new Error(
        `[MemoryPageManager E7011] Paged memory exhaustion: maximum ${this.maxPages} pages (${
          (this.maxPages * this.pageSizeBytes) / 1024 / 1024
        } MB) allocated.`
      );
    }

    const pageId = this.nextPageId++;
    const buffer = new Uint8Array(this.pageSizeBytes);
    const now = Date.now();

    const page: MemoryPage = {
      pageId,
      pageSizeBytes: this.pageSizeBytes,
      canonicalAddressRange,
      buffer,
      isDirty: false,
      isPinned: pin,
      allocatedAt: now,
      lastAccessedAt: now,
    };

    this.pages.set(pageId, page);
    return page;
  }

  /**
   * Retrieves a page by its ID, updating its access timestamp.
   */
  public getPage(pageId: number): MemoryPage | undefined {
    const page = this.pages.get(pageId);
    if (page) {
      page.lastAccessedAt = Date.now();
    }
    return page;
  }

  /**
   * Writes data into a specific page at an offset.
   */
  public writePage(pageId: number, offset: number, data: Uint8Array | number[]): void {
    const page = this.getPage(pageId);
    if (!page) {
      throw new Error(`[MemoryPageManager Error] Page #${pageId} not found.`);
    }

    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    if (offset + bytes.length > page.pageSizeBytes) {
      throw new Error(
        `[MemoryPageManager E7008] Page write out of bounds: offset ${offset} + ${bytes.length} > page size ${page.pageSizeBytes}`
      );
    }

    page.buffer.set(bytes, offset);
    page.isDirty = true;
    page.lastAccessedAt = Date.now();
  }

  /**
   * Reads data slice from a page.
   */
  public readPage(pageId: number, offset: number, length: number): Uint8Array {
    const page = this.getPage(pageId);
    if (!page) {
      throw new Error(`[MemoryPageManager Error] Page #${pageId} not found.`);
    }

    if (offset + length > page.pageSizeBytes) {
      throw new Error(
        `[MemoryPageManager E7008] Page read out of bounds: offset ${offset} + ${length} > page size ${page.pageSizeBytes}`
      );
    }

    return page.buffer.subarray(offset, offset + length);
  }

  /**
   * Pins or unpins a page in physical memory to prevent eviction.
   */
  public setPinned(pageId: number, pinned: boolean): void {
    const page = this.pages.get(pageId);
    if (page) {
      page.isPinned = pinned;
    }
  }

  /**
   * Deallocates a page.
   */
  public freePage(pageId: number): boolean {
    const page = this.pages.get(pageId);
    if (!page) return false;
    if (page.isPinned) {
      throw new Error(`[MemoryPageManager E7010] Cannot free pinned page #${pageId}.`);
    }
    return this.pages.delete(pageId);
  }

  /**
   * Returns all active pages.
   */
  public getActivePages(): MemoryPage[] {
    return Array.from(this.pages.values());
  }

  /**
   * Total allocated paged bytes.
   */
  public getTotalPagedBytes(): number {
    return this.pages.size * this.pageSizeBytes;
  }

  /**
   * Page count.
   */
  public pageCount(): number {
    return this.pages.size;
  }
}
