/**
 * Oview OS — Sovereign Workspace Manager (Virtual Desktops / Spaces)
 * ============================================================================
 * WorkspaceManager.ts: Manages multi-desktop workspaces ("Spaces"),
 * window assignment per space, and spatial transitions.
 */

export interface WorkspaceSpace {
  id: number;
  name: string;
  icon: string;
  description: string;
  windowIds: string[];
}

export class WorkspaceManager {
  private static instance: WorkspaceManager | null = null;

  public static getInstance(): WorkspaceManager {
    if (!WorkspaceManager.instance) {
      WorkspaceManager.instance = new WorkspaceManager();
    }
    return WorkspaceManager.instance;
  }

  public static resetInstance(): void {
    WorkspaceManager.instance = null;
  }

  private spaces: WorkspaceSpace[] = [
    { id: 1, name: 'Core Workspace', icon: '⚡', description: 'Terminal, Explorer, System Shell', windowIds: [] },
    { id: 2, name: 'Dev & Web', icon: '🌐', description: 'CUBiO Browser, Code Editor', windowIds: [] },
    { id: 3, name: 'Creative Studio', icon: '🖌️', description: 'Art Canvas & Vector Studio', windowIds: [] },
    { id: 4, name: 'Media & Play', icon: '🎮', description: 'Rebel X Play (RXP) & Arcade', windowIds: [] },
  ];

  private activeSpaceId: number = 1;

  private constructor() {}

  public getSpaces(): WorkspaceSpace[] {
    return [...this.spaces];
  }

  public getActiveSpaceId(): number {
    return this.activeSpaceId;
  }

  public getActiveSpace(): WorkspaceSpace {
    return this.spaces.find(s => s.id === this.activeSpaceId) || this.spaces[0];
  }

  public switchSpace(spaceId: number): void {
    if (this.spaces.some(s => s.id === spaceId)) {
      this.activeSpaceId = spaceId;
    }
  }

  public assignWindowToSpace(windowId: string, spaceId: number): void {
    // Remove from other spaces
    for (const space of this.spaces) {
      space.windowIds = space.windowIds.filter(id => id !== windowId);
    }
    // Add to target space
    const target = this.spaces.find(s => s.id === spaceId);
    if (target && !target.windowIds.includes(windowId)) {
      target.windowIds.push(windowId);
    }
  }

  public removeWindow(windowId: string): void {
    for (const space of this.spaces) {
      space.windowIds = space.windowIds.filter(id => id !== windowId);
    }
  }

  public isWindowInActiveSpace(windowId: string): boolean {
    const activeSpace = this.getActiveSpace();
    // If a window is unassigned, it is visible across all spaces by default
    const isAssigned = this.spaces.some(s => s.windowIds.includes(windowId));
    if (!isAssigned) return true;
    return activeSpace.windowIds.includes(windowId);
  }
}
