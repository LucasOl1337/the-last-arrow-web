export type QualityLevel = 'normal' | 'low';
/** Low quality caps actual raster size too: 4K/HiDPI must not remain a 4K buffer. */
export function lowPixelRatio(dpr: number, width: number, height: number): number {
  return Math.min(Math.min(dpr, 1.5) * 0.7, 1280 / Math.max(1, width), 720 / Math.max(1, height));
}
/** One real-time, visible/unpaused 2 s window per match; never a simulation-clock FPS. */
export class AutoQuality {
  level: QualityLevel = 'normal';
  private last: number | null = null;
  private seconds = 0;
  private frames = 0;
  private decided = false;
  detectedFps: number | null = null;
  begin() {
    this.last = null; this.seconds = this.frames = 0;
    this.decided = this.level === 'low'; // Retain the safe level across rematches, no quality oscillation.
    if (!this.decided) this.detectedFps = null;
  }
  sample(nowMs: number, active: boolean): boolean {
    if (!active) { this.last = null; return false; }
    if (this.decided) return false;
    const last = this.last; this.last = nowMs;
    if (last === null || nowMs <= last) return false;
    this.seconds += (nowMs - last) / 1000; this.frames++;
    if (this.seconds < 2 - 1e-9) return false;
    this.decided = true; this.detectedFps = this.frames / this.seconds;
    if (this.detectedFps < 50 - 1e-9) { this.level = 'low'; return true; }
    return false;
  }
  inspect() { return { level: this.level, detectedFps: this.detectedFps, sampleSeconds: this.seconds, sampleFrames: this.frames, decided: this.decided }; }
}
