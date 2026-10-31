/**
 * Recorder — Controller & Sovereign Audio Capture Engine
 * ============================================================================
 * RecorderApp.ts: Manages WebAudio microphone recording simulation/capture,
 * live waveform visualization data, and VFS export to /user/media/.
 */

import { VirtualFileSystem } from '../../vfs/VirtualFileSystem';

export interface RecordedAudioNote {
  id: string;
  name: string;
  path: string;
  durationSeconds: number;
  timestamp: number;
}

export class RecorderApp {
  private vfs: VirtualFileSystem;
  private isRecording: boolean = false;
  private durationSeconds: number = 0;
  private waveformData: number[] = new Array(24).fill(5);
  private recordings: RecordedAudioNote[] = [];

  constructor() {
    this.vfs = VirtualFileSystem.getInstance();
    this.scanRecordings();
  }

  public scanRecordings(): RecordedAudioNote[] {
    this.recordings = [];
    try {
      const media = this.vfs.listDirectory('/user/media');
      for (const file of media) {
        if (file.name.startsWith('recording_') && file.name.endsWith('.wav')) {
          this.recordings.push({
            id: file.name,
            name: file.name,
            path: `/user/media/${file.name}`,
            durationSeconds: Math.max(1, Math.floor(file.size / 1024)),
            timestamp: Date.now(),
          });
        }
      }
    } catch {
      // media folder may be empty
    }
    return [...this.recordings];
  }

  public getRecordings(): RecordedAudioNote[] {
    return [...this.recordings];
  }

  public startRecording(): void {
    this.isRecording = true;
    this.durationSeconds = 0;
  }

  public pauseRecording(): void {
    this.isRecording = false;
  }

  public toggleRecording(): boolean {
    this.isRecording = !this.isRecording;
    return this.isRecording;
  }

  public isRecordingActive(): boolean {
    return this.isRecording;
  }

  public getDurationSeconds(): number {
    return this.durationSeconds;
  }

  public tickDuration(deltaSec: number = 1): number {
    if (this.isRecording) {
      this.durationSeconds += deltaSec;
      // Simulate live microphone waveform oscillation
      this.waveformData = this.waveformData.map(() => {
        return Math.floor(Math.random() * 50) + 10;
      });
    } else {
      this.waveformData = this.waveformData.map(v => Math.max(4, Math.floor(v * 0.8)));
    }
    return this.durationSeconds;
  }

  public getWaveformData(): number[] {
    return [...this.waveformData];
  }

  public saveToVFS(fileName?: string): RecordedAudioNote {
    this.isRecording = false;
    const name = fileName || `recording_${Date.now()}.wav`;
    const vfsPath = `/user/media/${name}`;
    
    // Write sovereign audio payload header
    const audioPayload = `SOVEREIGN_WAV_HEADER:DURATION=${this.durationSeconds}s:ENCODED=PCM_16BIT_44100HZ`;
    this.vfs.writeFile(vfsPath, audioPayload);

    const note: RecordedAudioNote = {
      id: name,
      name,
      path: vfsPath,
      durationSeconds: Math.max(1, this.durationSeconds),
      timestamp: Date.now(),
    };
    this.recordings.push(note);
    this.durationSeconds = 0;
    return note;
  }
}
