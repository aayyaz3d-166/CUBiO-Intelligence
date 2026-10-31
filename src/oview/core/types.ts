/**
 * Oview OS — Sovereign Desktop Operating System Substrate
 * ========================================================
 * types.ts: Core Data Models, Window State Invariants & System Event Types
 */

export type WindowId = string;
export type AppId = string;

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowState extends WindowBounds {
  id: WindowId;
  appId: AppId;
  title: string;
  icon: string;
  minWidth: number;
  minHeight: number;
  isMinimized: boolean;
  isMaximized: boolean;
  isFocused: boolean;
  zIndex: number;
  prevBounds?: WindowBounds;
  state?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export type AppCategory = 'system' | 'productivity' | 'developer' | 'utility' | 'ai';

export interface AppDescriptor {
  id: AppId;
  name: string;
  icon: string;
  category: AppCategory;
  description: string;
  defaultWidth: number;
  defaultHeight: number;
  minWidth?: number;
  minHeight?: number;
  singleInstance?: boolean;
  memorySlot369?: number; // Address369 spatial memory allocation slot [0..368]
  factory?: (windowId: WindowId, context: AppContext) => any;
}

export interface AppContext {
  windowId: WindowId;
  bus: any;
  wm: any;
  vfs?: any;
  echo?: any;
}

export type OviewTheme = 'cyber-glass' | 'deep-space' | 'emerald-sovereign' | 'neon-matrix';

export interface SystemThemeConfig {
  id: OviewTheme;
  name: string;
  accent: string;
  bgGradient: string;
  glassSurface: string;
  glassBorder: string;
  textPrimary: string;
  textMuted: string;
  blur: string;
  glow: string;
}

export interface SystemTelemetry {
  cpuUsage: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  activeProcesses: number;
  openWindows: number;
  spatialSlotUsage: number;
  uptimeSeconds: number;
}

export interface SystemEvent<T = any> {
  type: string;
  source: string;
  payload: T;
  timestamp: number;
}
