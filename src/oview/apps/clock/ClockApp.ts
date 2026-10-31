/**
 * Clock — Controller & Precision Time Substrate
 * ============================================================================
 * ClockApp.ts: Manages world timezones, millisecond-precision stopwatch
 * with split lap history, and countdown timer logic.
 */

export interface WorldCityTime {
  name: string;
  country: string;
  offsetHours: number;
  timeString: string;
  period: string;
}

export interface StopwatchLap {
  lapNumber: number;
  timeMs: number;
  formatted: string;
}

export class ClockApp {
  private activeTab: 'world' | 'stopwatch' | 'timer' = 'world';
  private selectedCity: string = 'Karachi';
  
  // Stopwatch state
  private stopwatchMs: number = 0;
  private isStopwatchRunning: boolean = false;
  private laps: StopwatchLap[] = [];

  // Timer state
  private timerTotalSeconds: number = 300;
  private timerRemainingSeconds: number = 300;
  private isTimerRunning: boolean = false;

  private cities: Array<{ name: string; country: string; offsetHours: number }> = [
    { name: 'Karachi', country: 'Pakistan', offsetHours: 5 },
    { name: 'Tokyo', country: 'Japan', offsetHours: 9 },
    { name: 'London', country: 'UK', offsetHours: 0 },
    { name: 'New York', country: 'USA', offsetHours: -5 },
    { name: 'UTC', country: 'Sovereign Standard', offsetHours: 0 },
  ];

  public getTab(): 'world' | 'stopwatch' | 'timer' {
    return this.activeTab;
  }

  public setTab(tab: 'world' | 'stopwatch' | 'timer'): void {
    this.activeTab = tab;
  }

  public getWorldTimes(): WorldCityTime[] {
    const now = new Date();
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;

    return this.cities.map(c => {
      const cityDate = new Date(utcTime + 3600000 * c.offsetHours);
      let hours = cityDate.getHours();
      const period = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const mins = String(cityDate.getMinutes()).padStart(2, '0');
      const secs = String(cityDate.getSeconds()).padStart(2, '0');
      return {
        name: c.name,
        country: c.country,
        offsetHours: c.offsetHours,
        timeString: `${hours}:${mins}:${secs}`,
        period,
      };
    });
  }

  public selectCity(cityName: string): void {
    this.selectedCity = cityName;
  }

  public getSelectedCity(): string {
    return this.selectedCity;
  }

  // --- Stopwatch Controls ---
  public startStopwatch(): void {
    this.isStopwatchRunning = true;
  }

  public pauseStopwatch(): void {
    this.isStopwatchRunning = false;
  }

  public toggleStopwatch(): boolean {
    this.isStopwatchRunning = !this.isStopwatchRunning;
    return this.isStopwatchRunning;
  }

  public resetStopwatch(): void {
    this.isStopwatchRunning = false;
    this.stopwatchMs = 0;
    this.laps = [];
  }

  public recordLap(): StopwatchLap {
    const lap: StopwatchLap = {
      lapNumber: this.laps.length + 1,
      timeMs: this.stopwatchMs,
      formatted: this.formatStopwatchTime(this.stopwatchMs),
    };
    this.laps.push(lap);
    return lap;
  }

  public getLaps(): StopwatchLap[] {
    return [...this.laps];
  }

  public tickStopwatch(deltaMs: number): number {
    if (this.isStopwatchRunning) {
      this.stopwatchMs += deltaMs;
    }
    return this.stopwatchMs;
  }

  public getStopwatchMs(): number {
    return this.stopwatchMs;
  }

  public formatStopwatchTime(ms: number): string {
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    const millis = Math.floor((ms % 1000) / 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(millis).padStart(2, '0')}`;
  }

  // --- Timer Controls ---
  public setTimer(seconds: number): void {
    this.timerTotalSeconds = Math.max(1, seconds);
    this.timerRemainingSeconds = this.timerTotalSeconds;
    this.isTimerRunning = false;
  }

  public startTimer(): void {
    this.isTimerRunning = true;
  }

  public pauseTimer(): void {
    this.isTimerRunning = false;
  }

  public resetTimer(): void {
    this.isTimerRunning = false;
    this.timerRemainingSeconds = this.timerTotalSeconds;
  }

  public tickTimer(deltaSeconds: number = 1): number {
    if (this.isTimerRunning && this.timerRemainingSeconds > 0) {
      this.timerRemainingSeconds = Math.max(0, this.timerRemainingSeconds - deltaSeconds);
      if (this.timerRemainingSeconds === 0) {
        this.isTimerRunning = false;
      }
    }
    return this.timerRemainingSeconds;
  }

  public getTimerRemaining(): number {
    return this.timerRemainingSeconds;
  }

  public isTimerActive(): boolean {
    return this.isTimerRunning;
  }
}
