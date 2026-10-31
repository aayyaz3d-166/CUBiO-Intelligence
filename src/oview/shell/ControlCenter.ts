/**
 * Control Center & Notification Manager — Shell Subsystem
 * ============================================================================
 * ControlCenter.ts: Manages system audio volume, screen brightness,
 * sovereign mesh toggle, theme switcher, and toast notification queue.
 */

import { SystemBus } from '../core/SystemBus';

export interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
}

export class ControlCenter {
  private static instance: ControlCenter | null = null;

  public static getInstance(): ControlCenter {
    if (!ControlCenter.instance) {
      ControlCenter.instance = new ControlCenter();
    }
    return ControlCenter.instance;
  }

  public static resetInstance(): void {
    ControlCenter.instance = null;
  }

  private bus: SystemBus;
  private volume: number = 80;
  private brightness: number = 100;
  private isWifiEnabled: boolean = true;
  private isDndEnabled: boolean = false;
  private activeTheme: 'cyber-glass' | 'deep-space' | 'neon-matrix' = 'cyber-glass';
  private isOpen: boolean = false;
  private notifications: ToastNotification[] = [];
  private notifCounter: number = 1;

  private constructor() {
    this.bus = SystemBus.getInstance();
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(100, vol));
    this.bus.emit('system:volume_changed', { volume: this.volume }, 'ControlCenter');
  }

  public getBrightness(): number {
    return this.brightness;
  }

  public setBrightness(bright: number): void {
    this.brightness = Math.max(10, Math.min(100, bright));
    this.bus.emit('system:brightness_changed', { brightness: this.brightness }, 'ControlCenter');
  }

  public toggleWifi(): boolean {
    this.isWifiEnabled = !this.isWifiEnabled;
    this.bus.emit('system:wifi_toggled', { enabled: this.isWifiEnabled }, 'ControlCenter');
    return this.isWifiEnabled;
  }

  public isWifi(): boolean {
    return this.isWifiEnabled;
  }

  public toggleDnd(): boolean {
    this.isDndEnabled = !this.isDndEnabled;
    return this.isDndEnabled;
  }

  public isDnd(): boolean {
    return this.isDndEnabled;
  }

  public setTheme(theme: 'cyber-glass' | 'deep-space' | 'neon-matrix'): void {
    this.activeTheme = theme;
    this.bus.emit('theme:changed', { theme: this.activeTheme }, 'ControlCenter');
  }

  public getTheme(): string {
    return this.activeTheme;
  }

  public toggleOpen(): boolean {
    this.isOpen = !this.isOpen;
    return this.isOpen;
  }

  public isControlCenterOpen(): boolean {
    return this.isOpen;
  }

  // --- Toast Notification Queue ---
  public pushNotification(title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): ToastNotification {
    const notif: ToastNotification = {
      id: `toast_${Date.now()}_${this.notifCounter++}`,
      title,
      message,
      type,
      timestamp: Date.now(),
    };
    this.notifications.unshift(notif);
    if (this.notifications.length > 20) {
      this.notifications.pop();
    }
    this.bus.emit('system:notify', notif, 'ControlCenter');
    return notif;
  }

  public getNotifications(): ToastNotification[] {
    return [...this.notifications];
  }

  public dismissNotification(id: string): void {
    this.notifications = this.notifications.filter(n => n.id !== id);
  }

  public clearAllNotifications(): void {
    this.notifications = [];
  }
}
