/**
 * OLTO Frontend Subsystem — Declarative Theme & Design System
 * ============================================================
 * Provides unified color tokens, typography scales, spacing grids,
 * and reactive Dark/Light mode theme switching.
 */

import { Signal } from '../runtime/Signal';

export interface ThemeColors {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  surfaceHover: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  success: string;
  error: string;
  warning: string;
  info: string;
}

export const DarkTheme: ThemeColors = {
  primary: '#3b82f6',
  accent: '#8b5cf6',
  background: '#0f172a',
  surface: '#1e293b',
  surfaceHover: '#334155',
  border: '#334155',
  textPrimary: '#f8fafc',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#06b6d4',
};

export const LightTheme: ThemeColors = {
  primary: '#2563eb',
  accent: '#7c3aed',
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceHover: '#f1f5f9',
  border: '#e2e8f0',
  textPrimary: '#0f172a',
  textSecondary: '#334155',
  textMuted: '#64748b',
  success: '#059669',
  error: '#dc2626',
  warning: '#d97706',
  info: '#0891b2',
};

export const Typography = {
  size: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    black: 900,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
};

export const Elevation = {
  0: 'none',
  1: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
  2: '0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)',
  3: '0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23)',
  4: '0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22)',
};

export class ThemeManager {
  private static instance: ThemeManager | null = null;
  public mode: Signal<'dark' | 'light'> = new Signal<'dark' | 'light'>('dark');

  public static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  public get colors(): ThemeColors {
    return this.mode.get() === 'dark' ? DarkTheme : LightTheme;
  }

  public toggle(): void {
    this.mode.set(this.mode.peek() === 'dark' ? 'light' : 'dark');
  }

  public setMode(newMode: 'dark' | 'light'): void {
    this.mode.set(newMode);
  }
}

export const Theme = ThemeManager.getInstance();
