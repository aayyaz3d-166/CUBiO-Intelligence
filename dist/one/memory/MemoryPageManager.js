/**
 * ONE Language — Paged Memory Manager
 * ====================================
 * Module: @one/memory/MemoryPageManager
 *
 * Implements the PAGE primitive for discrete spatial memory segmentation.
 * Manages fixed-size pages (64 KB / 256 KB) with canonical spatial alignment,
 * zero-copy view slicing, dirty page tracking, and strict physical RSS bounds.
 */
export class MemoryPageManager {
    static DEFAULT_PAGE_SIZE = 64 * 1024; // 64 KB per page
    pages = new Map();
    maxPages;
    pageSizeBytes;
    nextPageId = 0;
    constructor(maxPages = 256, pageSizeBytes = MemoryPageManager.DEFAULT_PAGE_SIZE) {
        this.maxPages = maxPages;
        this.pageSizeBytes = pageSizeBytes;
    }
    /**
     * Allocates a new fixed-size memory page.
     */
    allocatePage(canonicalAddressRange = [0, 0], pin = false) {
        if (this.pages.size >= this.maxPages) {
            throw new Error(`[MemoryPageManager E7011] Paged memory exhaustion: maximum ${this.maxPages} pages (${(this.maxPages * this.pageSizeBytes) / 1024 / 1024} MB) allocated.`);
        }
        const pageId = this.nextPageId++;
        const buffer = new Uint8Array(this.pageSizeBytes);
        const now = Date.now();
        const page = {
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
    getPage(pageId) {
        const page = this.pages.get(pageId);
        if (page) {
            page.lastAccessedAt = Date.now();
        }
        return page;
    }
    /**
     * Writes data into a specific page at an offset.
     */
    writePage(pageId, offset, data) {
        const page = this.getPage(pageId);
        if (!page) {
            throw new Error(`[MemoryPageManager Error] Page #${pageId} not found.`);
        }
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        if (offset + bytes.length > page.pageSizeBytes) {
            throw new Error(`[MemoryPageManager E7008] Page write out of bounds: offset ${offset} + ${bytes.length} > page size ${page.pageSizeBytes}`);
        }
        page.buffer.set(bytes, offset);
        page.isDirty = true;
        page.lastAccessedAt = Date.now();
    }
    /**
     * Reads data slice from a page.
     */
    readPage(pageId, offset, length) {
        const page = this.getPage(pageId);
        if (!page) {
            throw new Error(`[MemoryPageManager Error] Page #${pageId} not found.`);
        }
        if (offset + length > page.pageSizeBytes) {
            throw new Error(`[MemoryPageManager E7008] Page read out of bounds: offset ${offset} + ${length} > page size ${page.pageSizeBytes}`);
        }
        return page.buffer.subarray(offset, offset + length);
    }
    /**
     * Pins or unpins a page in physical memory to prevent eviction.
     */
    setPinned(pageId, pinned) {
        const page = this.pages.get(pageId);
        if (page) {
            page.isPinned = pinned;
        }
    }
    /**
     * Deallocates a page.
     */
    freePage(pageId) {
        const page = this.pages.get(pageId);
        if (!page)
            return false;
        if (page.isPinned) {
            throw new Error(`[MemoryPageManager E7010] Cannot free pinned page #${pageId}.`);
        }
        return this.pages.delete(pageId);
    }
    /**
     * Returns all active pages.
     */
    getActivePages() {
        return Array.from(this.pages.values());
    }
    /**
     * Total allocated paged bytes.
     */
    getTotalPagedBytes() {
        return this.pages.size * this.pageSizeBytes;
    }
    /**
     * Page count.
     */
    pageCount() {
        return this.pages.size;
    }
}
