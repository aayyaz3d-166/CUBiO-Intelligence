/**
 * ONE Language — Virtual Memory Paging Engine
 * ============================================
 * Module: @one/memory/extreme/VirtualMemoryPagingEngine
 *
 * Implements Section 6 of Extreme-Scale 3D Memory Toolchain.
 * Architecture:
 *   VIRTUAL SPACE (5+ ZB)
 *         ↓
 *     PAGE TABLE (Sparse Map)
 *         ↓
 *   ACTIVE WORKING SET (Bounded Frame Slots)
 *         ↓
 *   LOCAL PHYSICAL MEMORY (64 KB Pages)
 *         ↓
 *      EVICTION (LRU / Pin-Safe Policy)
 */

import { MemoryPageManager, MemoryPage } from '../MemoryPageManager';
import { VirtualScaleAddressEngine } from './VirtualScaleAddressEngine';

export interface PageTableEntry {
  virtualPageNumber: bigint;
  physicalPageId: number;
  isResident: boolean;
  isDirty: boolean;
  isPinned: boolean;
  lastAccessedMs: number;
  allocatedAtMs: number;
}

export interface PagingEngineMetrics {
  totalVirtualPagesAddressed: number;
  residentPhysicalPages: number;
  maxPhysicalPages: number;
  pageSizeBytes: number;
  physicalMemoryUsedBytes: number;
  maxPhysicalMemoryLimitBytes: number;
  pageHits: number;
  pageFaults: number;
  pageEvictions: number;
  hitRatio: number;
}

export class VirtualMemoryPagingEngine {
  public static readonly DEFAULT_PAGE_SIZE = 64 * 1024; // 64 KB
  public static readonly DEFAULT_MAX_PHYSICAL_PAGES = 256; // 256 * 64KB = 16 MB

  private readonly pageManager: MemoryPageManager;
  private readonly addressEngine: VirtualScaleAddressEngine;
  private readonly pageSize: number;
  private readonly maxResidentPages: number;

  // Sparse Virtual Page Table: maps virtualPageNumber -> PageTableEntry
  private readonly pageTable: Map<string, PageTableEntry> = new Map();

  // Active Working Set (LRU order of resident virtual page numbers)
  private readonly residentQueue: Set<string> = new Set();

  // Telemetry
  private pageHits: number = 0;
  private pageFaults: number = 0;
  private pageEvictions: number = 0;

  constructor(
    maxResidentPages: number = VirtualMemoryPagingEngine.DEFAULT_MAX_PHYSICAL_PAGES,
    pageSize: number = VirtualMemoryPagingEngine.DEFAULT_PAGE_SIZE,
    addressEngine?: VirtualScaleAddressEngine
  ) {
    this.pageSize = pageSize;
    this.maxResidentPages = maxResidentPages;
    this.pageManager = new MemoryPageManager(maxResidentPages, pageSize);
    this.addressEngine = addressEngine ?? new VirtualScaleAddressEngine();
  }

  /**
   * Translates a virtual address into a physical page frame and byte offset.
   * Performs demand paging: if page is not resident, triggers admission and page fault handler.
   */
  public accessAddress(virtualAddress: bigint): { page: MemoryPage; offset: number } {
    this.addressEngine.validateAddress(virtualAddress);

    const vpn = virtualAddress / BigInt(this.pageSize);
    const offset = Number(virtualAddress % BigInt(this.pageSize));
    const vpnKey = vpn.toString(16);

    const entry = this.pageTable.get(vpnKey);

    if (entry && entry.isResident) {
      // Page Hit
      this.pageHits++;
      entry.lastAccessedMs = Date.now();

      // Refresh LRU position
      this.residentQueue.delete(vpnKey);
      this.residentQueue.add(vpnKey);

      const page = this.pageManager.getPage(entry.physicalPageId);
      if (!page) {
        throw new Error(`[VirtualMemoryPagingEngine Error] Corrupt physical page mapping: ${entry.physicalPageId}`);
      }
      return { page, offset };
    }

    // Page Fault: Page not resident in working set
    this.pageFaults++;
    const admittedPage = this.admitPage(vpn, vpnKey);
    return { page: admittedPage, offset };
  }

  /**
   * Reads data from a virtual address range.
   */
  public readVirtual(virtualAddress: bigint, length: number): Uint8Array {
    this.addressEngine.validateRange(virtualAddress, BigInt(length));
    const result = new Uint8Array(length);

    let bytesRead = 0;
    let currAddr = virtualAddress;

    while (bytesRead < length) {
      const { page, offset } = this.accessAddress(currAddr);
      const availableInPage = this.pageSize - offset;
      const toRead = Math.min(length - bytesRead, availableInPage);

      const slice = this.pageManager.readPage(page.pageId, offset, toRead);
      result.set(slice, bytesRead);

      bytesRead += toRead;
      currAddr += BigInt(toRead);
    }

    return result;
  }

  /**
   * Writes data to a virtual address range.
   */
  public writeVirtual(virtualAddress: bigint, data: Uint8Array | number[]): void {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const length = bytes.length;
    this.addressEngine.validateRange(virtualAddress, BigInt(length));

    let bytesWritten = 0;
    let currAddr = virtualAddress;

    while (bytesWritten < length) {
      const { page, offset } = this.accessAddress(currAddr);
      const availableInPage = this.pageSize - offset;
      const toWrite = Math.min(length - bytesWritten, availableInPage);

      const chunk = bytes.subarray(bytesWritten, bytesWritten + toWrite);
      this.pageManager.writePage(page.pageId, offset, chunk);

      // Mark page table entry dirty
      const vpn = currAddr / BigInt(this.pageSize);
      const entry = this.pageTable.get(vpn.toString(16));
      if (entry) entry.isDirty = true;

      bytesWritten += toWrite;
      currAddr += BigInt(toWrite);
    }
  }

  /**
   * Demands admission of a virtual page into physical memory, evicting if necessary.
   */
  private admitPage(vpn: bigint, vpnKey: string): MemoryPage {
    // If working set is full, evict the oldest unpinned page
    if (this.residentQueue.size >= this.maxResidentPages) {
      this.evictOldest();
    }

    // Allocate physical page frame
    const physicalPage = this.pageManager.allocatePage([0, 0], false);

    const entry: PageTableEntry = {
      virtualPageNumber: vpn,
      physicalPageId: physicalPage.pageId,
      isResident: true,
      isDirty: false,
      isPinned: false,
      lastAccessedMs: Date.now(),
      allocatedAtMs: Date.now(),
    };

    this.pageTable.set(vpnKey, entry);
    this.residentQueue.add(vpnKey);

    return physicalPage;
  }

  /**
   * Evicts the coldest unpinned resident page under LRU policy.
   */
  public evictOldest(): boolean {
    for (const vpnKey of this.residentQueue) {
      const entry = this.pageTable.get(vpnKey);
      if (entry && !entry.isPinned) {
        // Remove from physical page manager
        this.pageManager.freePage(entry.physicalPageId);
        entry.isResident = false;
        this.residentQueue.delete(vpnKey);
        this.pageEvictions++;
        return true;
      }
    }
    return false; // All pages pinned
  }

  /**
   * Returns current paging metrics and bounded memory stats.
   */
  public getMetrics(): PagingEngineMetrics {
    const resident = this.residentQueue.size;
    const usedBytes = resident * this.pageSize;
    const maxBytes = this.maxResidentPages * this.pageSize;
    const totalAccesses = this.pageHits + this.pageFaults;
    const hitRatio = totalAccesses > 0 ? this.pageHits / totalAccesses : 0;

    return {
      totalVirtualPagesAddressed: this.pageTable.size,
      residentPhysicalPages: resident,
      maxPhysicalPages: this.maxResidentPages,
      pageSizeBytes: this.pageSize,
      physicalMemoryUsedBytes: usedBytes,
      maxPhysicalMemoryLimitBytes: maxBytes,
      pageHits: this.pageHits,
      pageFaults: this.pageFaults,
      pageEvictions: this.pageEvictions,
      hitRatio,
    };
  }

  /**
   * Returns the underlying physical page manager.
   */
  public getPhysicalPageManager(): MemoryPageManager {
    return this.pageManager;
  }
}
