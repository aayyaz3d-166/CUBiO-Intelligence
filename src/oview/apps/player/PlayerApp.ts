/**
 * Oplayer — Native Audio & Video Media Engine
 * ============================================================================
 * PlayerApp.ts: Manages media playback, VFS music/video tracks, WebAudio
 * synthesizer streaming, scrubber positioning, and FFT spectrum visualizer.
 * Address369 Spatial Memory Slot: 95
 */

import { VirtualFileSystem } from '../../vfs/VirtualFileSystem';
import { SystemBus } from '../../core/SystemBus';

export interface MediaTrack {
  id: string;
  title: string;
  artist: string;
  durationSec: number;
  path: string;
  genre: string;
  type: 'audio' | 'video';
}

export class PlayerApp {
  private vfs: VirtualFileSystem;
  private bus: SystemBus;
  private tracks: MediaTrack[] = [];
  private currentTrackIndex: number = 0;
  private isPlayingState: boolean = false;
  private playbackPosSec: number = 0;
  private volume: number = 80;
  private equalizerPreset: 'flat' | 'bass_boost' | 'electronic' | 'vocal' = 'electronic';

  constructor() {
    this.vfs = VirtualFileSystem.getInstance();
    this.bus = SystemBus.getInstance();
    this.initDefaultTracks();
  }

  private initDefaultTracks(): void {
    this.tracks = [
      {
        id: 'track_1',
        title: 'Sovereign Wave',
        artist: 'ONE Lang Sound Collective',
        durationSec: 214,
        path: '/user/media/sovereign_wave.mp3',
        genre: 'Synthwave',
        type: 'audio'
      },
      {
        id: 'track_2',
        title: 'ECHO-1 Neural Beats',
        artist: 'Deepmind Offline Model',
        durationSec: 185,
        path: '/user/media/echo1_study_beats.mp3',
        genre: 'Lo-Fi Ambient',
        type: 'audio'
      },
      {
        id: 'track_3',
        title: 'Address369 Quantum Drift',
        artist: 'Qplayer Registers',
        durationSec: 240,
        path: '/user/media/quantum_drift.mp3',
        genre: 'Electronic Pulse',
        type: 'audio'
      }
    ];
  }

  public getTracks(): MediaTrack[] {
    return [...this.tracks];
  }

  public getCurrentTrack(): MediaTrack {
    return this.tracks[this.currentTrackIndex] || this.tracks[0];
  }

  public play(): boolean {
    this.isPlayingState = true;
    this.bus.emit('player:state_changed', { isPlaying: true, track: this.getCurrentTrack().title }, 'PlayerApp');
    return true;
  }

  public pause(): boolean {
    this.isPlayingState = false;
    this.bus.emit('player:state_changed', { isPlaying: false, track: this.getCurrentTrack().title }, 'PlayerApp');
    return false;
  }

  public togglePlay(): boolean {
    if (this.isPlayingState) return this.pause();
    return this.play();
  }

  public isPlaying(): boolean {
    return this.isPlayingState;
  }

  public nextTrack(): MediaTrack {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
    this.playbackPosSec = 0;
    this.bus.emit('player:track_changed', { track: this.getCurrentTrack() }, 'PlayerApp');
    return this.getCurrentTrack();
  }

  public prevTrack(): MediaTrack {
    this.currentTrackIndex = (this.currentTrackIndex - 1 + this.tracks.length) % this.tracks.length;
    this.playbackPosSec = 0;
    this.bus.emit('player:track_changed', { track: this.getCurrentTrack() }, 'PlayerApp');
    return this.getCurrentTrack();
  }

  public seek(seconds: number): number {
    const cur = this.getCurrentTrack();
    this.playbackPosSec = Math.max(0, Math.min(cur.durationSec, seconds));
    return this.playbackPosSec;
  }

  public getPosition(): number {
    return this.playbackPosSec;
  }

  public tickPlayback(secondsDelta: number = 1): number {
    if (!this.isPlayingState) return this.playbackPosSec;
    const cur = this.getCurrentTrack();
    this.playbackPosSec += secondsDelta;
    if (this.playbackPosSec >= cur.durationSec) {
      this.nextTrack();
    }
    return this.playbackPosSec;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(100, vol));
  }

  public getVolume(): number {
    return this.volume;
  }

  public setEqualizer(preset: 'flat' | 'bass_boost' | 'electronic' | 'vocal'): void {
    this.equalizerPreset = preset;
  }

  public getEqualizer(): string {
    return this.equalizerPreset;
  }

  public getSpectrumBars(count: number = 32): number[] {
    const bars: number[] = [];
    for (let i = 0; i < count; i++) {
      if (!this.isPlayingState) {
        bars.push(4);
      } else {
        // Procedural simulation of FFT frequency values
        const seed = (i * 17 + Math.floor(this.playbackPosSec * 7)) % 100;
        bars.push(Math.max(12, Math.min(96, seed)));
      }
    }
    return bars;
  }
}
