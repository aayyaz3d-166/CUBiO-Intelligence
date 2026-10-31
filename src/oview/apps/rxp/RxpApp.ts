/**
 * Rebel X Play (RXP) — Controller & Media/Arcade Engine
 * ============================================================================
 * RxpApp.ts: Implements spatial audio synthesis, track playlist,
 * dynamic audio equalizer, and 60 FPS sovereign arcade game physics.
 */

export interface RxpTrack {
  id: string;
  title: string;
  artist: string;
  frequency: number;
  wave: 'sine' | 'square' | 'sawtooth' | 'triangle';
}

export interface RxpGameState {
  ballX: number;
  ballY: number;
  ballRadius: number;
  vx: number;
  vy: number;
  paddleX: number;
  paddleWidth: number;
  score: number;
  highScore: number;
  isGameOver: boolean;
}

export class RxpApp {
  private mode: 'audio' | 'arcade' = 'audio';
  private isPlaying: boolean = false;
  private currentTrackIndex: number = 0;
  private volume: number = 0.8;
  private visualizerBars: number[] = new Array(16).fill(10);

  private tracks: RxpTrack[] = [
    { id: 'track_1', title: 'Cyber Pulse 369', artist: 'Sovereign Core Synth', frequency: 369, wave: 'sawtooth' },
    { id: 'track_2', title: 'Sovereign Odyssey', artist: 'Deep Space Ambient', frequency: 432, wave: 'sine' },
    { id: 'track_3', title: 'Neon Horizon', artist: '8-Bit Chiptune Matrix', frequency: 528, wave: 'square' },
  ];

  private gameState: RxpGameState = {
    ballX: 320,
    ballY: 190,
    ballRadius: 7,
    vx: 4,
    vy: -4,
    paddleX: 270,
    paddleWidth: 100,
    score: 0,
    highScore: 0,
    isGameOver: false,
  };

  public getMode(): 'audio' | 'arcade' {
    return this.mode;
  }

  public setMode(mode: 'audio' | 'arcade'): void {
    this.mode = mode;
  }

  public getTracks(): RxpTrack[] {
    return [...this.tracks];
  }

  public getCurrentTrack(): RxpTrack {
    return this.tracks[this.currentTrackIndex];
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public play(): void {
    this.isPlaying = true;
  }

  public pause(): void {
    this.isPlaying = false;
  }

  public togglePlay(): boolean {
    this.isPlaying = !this.isPlaying;
    return this.isPlaying;
  }

  public nextTrack(): RxpTrack {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
    return this.getCurrentTrack();
  }

  public prevTrack(): RxpTrack {
    this.currentTrackIndex = (this.currentTrackIndex - 1 + this.tracks.length) % this.tracks.length;
    return this.getCurrentTrack();
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(vol, 1));
  }

  /**
   * Updates visualizer amplitudes (used for animation).
   */
  public tickVisualizer(): number[] {
    if (!this.isPlaying) {
      this.visualizerBars = this.visualizerBars.map(v => Math.max(8, v * 0.9));
    } else {
      this.visualizerBars = this.visualizerBars.map(() => {
        return Math.floor(Math.random() * 80) + 15;
      });
    }
    return [...this.visualizerBars];
  }

  public getGameState(): RxpGameState {
    return { ...this.gameState };
  }

  public setPaddlePosition(x: number): void {
    this.gameState.paddleX = Math.max(0, Math.min(x - this.gameState.paddleWidth / 2, 640 - this.gameState.paddleWidth));
  }

  /**
   * Advances the 60 FPS arcade physics by 1 tick.
   */
  public updateGameTick(): RxpGameState {
    if (this.gameState.isGameOver) return this.gameState;

    // Move ball
    this.gameState.ballX += this.gameState.vx;
    this.gameState.ballY += this.gameState.vy;

    // Bounce off walls (left/right)
    if (this.gameState.ballX - this.gameState.ballRadius <= 0) {
      this.gameState.ballX = this.gameState.ballRadius;
      this.gameState.vx = Math.abs(this.gameState.vx);
    } else if (this.gameState.ballX + this.gameState.ballRadius >= 640) {
      this.gameState.ballX = 640 - this.gameState.ballRadius;
      this.gameState.vx = -Math.abs(this.gameState.vx);
    }

    // Bounce off ceiling
    if (this.gameState.ballY - this.gameState.ballRadius <= 0) {
      this.gameState.ballY = this.gameState.ballRadius;
      this.gameState.vy = Math.abs(this.gameState.vy);
    }

    // Paddle collision
    const paddleTop = 350;
    if (
      this.gameState.ballY + this.gameState.ballRadius >= paddleTop &&
      this.gameState.ballY - this.gameState.ballRadius <= paddleTop + 14 &&
      this.gameState.ballX >= this.gameState.paddleX &&
      this.gameState.ballX <= this.gameState.paddleX + this.gameState.paddleWidth
    ) {
      this.gameState.vy = -Math.abs(this.gameState.vy) * 1.02; // slight speed increase
      this.gameState.score += 10;
      if (this.gameState.score > this.gameState.highScore) {
        this.gameState.highScore = this.gameState.score;
      }
    }

    // Floor collision (Game Over)
    if (this.gameState.ballY > 380) {
      this.gameState.isGameOver = true;
    }

    return { ...this.gameState };
  }

  public restartGame(): void {
    this.gameState.ballX = 320;
    this.gameState.ballY = 190;
    this.gameState.vx = 4 * (Math.random() > 0.5 ? 1 : -1);
    this.gameState.vy = -4;
    this.gameState.score = 0;
    this.gameState.isGameOver = false;
  }
}
