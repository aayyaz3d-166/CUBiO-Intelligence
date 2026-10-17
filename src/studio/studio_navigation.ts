/**
 * CUBiO / AGI ONE — GATE CNL-P26.4
 * STUDIO NAVIGATION SUBSYSTEM
 *
 * File: f:\ONE language\src\studio\studio_navigation.ts
 * Module: @one/studio/studio-navigation
 * Specification: Gate CNL-P26.4 Section 8
 *
 * Native workspace navigation across 7 sovereign sections:
 *   1. OVERVIEW      - System-wide summary, health, and status
 *   2. MEMORY_3D     - 343-Cell HCP Lattice 3D Voxel Workspace
 *   3. DATABASE      - SQLite 9-table schema & lineage audit
 *   4. INTELLIGENCE  - CUBiO Intelligence Core & Autonomous Builder
 *   5. NETWORK       - Native IPC transport & node topology
 *   6. SECURITY      - Actuation lockout, sandbox & PQC boundary
 *   7. SETTINGS      - Rendering options, projection, and cameras
 *
 * SOVEREIGN TECHNOLOGY LOCK:
 * ZERO React Router, ZERO browser history, ZERO URL hashes, ZERO DOM state.
 * Pure deterministic state machine in native ONE Language.
 */

export type StudioSection =
  | 'OVERVIEW'
  | 'MEMORY_3D'
  | 'DATABASE'
  | 'INTELLIGENCE'
  | 'NETWORK'
  | 'SECURITY'
  | 'SETTINGS';

export interface StudioSectionInfo {
  readonly id: StudioSection;
  readonly index: number; // 1..7
  readonly title: string;
  readonly shortcut: string; // e.g. "1" or "Alt+1"
  readonly description: string;
}

export const SECTIONS: readonly StudioSectionInfo[] = [
  {
    id: 'OVERVIEW',
    index: 1,
    title: 'Overview',
    shortcut: '1',
    description: 'System-wide summary, health, and aggregate metrics'
  },
  {
    id: 'MEMORY_3D',
    index: 2,
    title: '3D Memory',
    shortcut: '2',
    description: '343-Cell HCP Lattice 3D Voxel Workspace'
  },
  {
    id: 'DATABASE',
    index: 3,
    title: 'Database',
    shortcut: '3',
    description: 'SQLite 9-table schema, records, and lineage DAG'
  },
  {
    id: 'INTELLIGENCE',
    index: 4,
    title: 'Intelligence',
    shortcut: '4',
    description: 'CUBiO Intelligence Core, Reasoning & 4-Pillar Graph'
  },
  {
    id: 'NETWORK',
    index: 5,
    title: 'Network',
    shortcut: '5',
    description: 'Native IPC transport, Big-Endian frames & topology'
  },
  {
    id: 'SECURITY',
    index: 6,
    title: 'Security',
    shortcut: '6',
    description: 'Actuation lockout, secret scanner & PQC boundaries'
  },
  {
    id: 'SETTINGS',
    index: 7,
    title: 'Settings',
    shortcut: '7',
    description: 'Rendering camera, isometric orbit & display settings'
  }
];

export class StudioNavigation {
  private activeSection: StudioSection = 'MEMORY_3D';
  private history: StudioSection[] = ['MEMORY_3D'];
  private readonly maxHistoryLength: number = 32;

  constructor(initialSection: StudioSection = 'MEMORY_3D') {
    this.navigate(initialSection);
  }

  public navigate(section: StudioSection): void {
    const valid = SECTIONS.find(s => s.id === section);
    if (!valid) {
      throw new Error(`[StudioNavigation] Invalid section: ${section}`);
    }
    this.activeSection = section;
    this.history.push(section);
    if (this.history.length > this.maxHistoryLength) {
      this.history.shift();
    }
  }

  public navigateByIndex(index: number): void {
    const target = SECTIONS.find(s => s.index === index);
    if (!target) {
      throw new Error(`[StudioNavigation] Invalid section index: ${index}. Must be 1..7`);
    }
    this.navigate(target.id);
  }

  public getActiveSection(): StudioSection {
    return this.activeSection;
  }

  public getActiveSectionInfo(): StudioSectionInfo {
    return SECTIONS.find(s => s.id === this.activeSection)!;
  }

  public listSections(): readonly StudioSectionInfo[] {
    return SECTIONS;
  }

  public getHistory(): readonly StudioSection[] {
    return this.history;
  }

  /**
   * Formats the 7-section navigation bar into a clean horizontal header.
   */
  public formatNavigationBar(): string {
    const items = SECTIONS.map(s => {
      const isSelected = s.id === this.activeSection;
      return isSelected ? `[ ${s.index}. ${s.title} ]` : `  ${s.index}. ${s.title}  `;
    });

    return items.join('|');
  }
}
