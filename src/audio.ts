import type { SimEvent, World } from './sim/world.ts';
const files = {
  music: 'music.mp3', mizuShoot: 'mizu_shoot.wav', mizuDash: 'mizu_dash.ogg',
  stormShoot: 'storm_shoot.ogg', stormDash: 'storm_dash.ogg', stormUlt: 'storm_ult.wav',
} as const;
type Sound = keyof typeof files;
export class AudioEngine {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private music: AudioBufferSourceNode | null = null;
  private buffers = new Map<Sound, AudioBuffer>();
  private loading = false;
  muted = false;
  suspended = false;
  failures: string[] = [];
  async unlock() {
    this.context ??= new AudioContext();
    if (!this.gain) { this.gain = this.context.createGain(); this.gain.gain.value = this.muted ? 0 : 0.6; this.gain.connect(this.context.destination); }
    await this.context.resume();
    if (this.loading) return;
    this.loading = true;
    await Promise.all(Object.entries(files).map(async ([key, file]) => {
      try {
        const response = await fetch(`/assets/audio/${file}`); if (!response.ok) throw new Error(String(response.status));
        this.buffers.set(key as Sound, await this.context!.decodeAudioData(await response.arrayBuffer()));
      } catch { this.failures.push(file); }
    }));
    if (!this.music && this.buffers.has('music')) {
      this.music = this.context.createBufferSource(); this.music.buffer = this.buffers.get('music')!; this.music.loop = true;
      const musicGain = this.context.createGain(); musicGain.gain.value = 0.22; this.music.connect(musicGain); musicGain.connect(this.gain); this.music.start();
    }
  }
  setMuted(muted: boolean) { this.muted = muted; this.updateGain(); }
  setPaused(paused: boolean) { this.suspended = paused; this.updateGain(); }
  private updateGain() { if (this.gain && this.context) this.gain.gain.setTargetAtTime(this.muted ? 0 : this.suspended ? 0.16 : 0.6, this.context.currentTime, 0.03); }
  private sample(name: Sound, volume = 0.6) {
    if (!this.context || !this.gain || !this.buffers.has(name)) return;
    const source = this.context.createBufferSource(), gain = this.context.createGain();
    source.buffer = this.buffers.get(name)!; gain.gain.value = volume; source.connect(gain); gain.connect(this.gain); source.start();
    source.onended = () => { source.disconnect(); gain.disconnect(); };
  }
  private tone(hz: number, duration: number, type: OscillatorType, end: number, volume = 0.15) {
    if (!this.context || !this.gain) return;
    const oscillator = this.context.createOscillator(), gain = this.context.createGain(), now = this.context.currentTime;
    oscillator.type = type; oscillator.frequency.setValueAtTime(hz, now); oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
    gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain); gain.connect(this.gain); oscillator.start(); oscillator.stop(now + duration);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  event(e: SimEvent, w: World) {
    const storm = w.fighters[e.actor]?.character === 1;
    if (e.type === 'shoot') this.sample(storm ? 'stormShoot' : 'mizuShoot');
    if (e.type === 'dash') this.sample(storm ? 'stormDash' : 'mizuDash', 0.4);
    if (e.type === 'jump') this.tone(220, 0.08, 'sine', 460, 0.06);
    if (e.type === 'impact') this.tone(180, 0.06, 'triangle', 45);
    if (e.type === 'kill') this.tone(160, 0.2, 'sawtooth', 30, 0.18);
    if (e.type === 'catch' || e.type === 'pickup') this.tone(540, 0.12, 'sine', 1200);
    if (e.type === 'victory') { if (storm) this.sample('stormUlt', 0.25); else this.tone(330, 0.8, 'triangle', 660); }
  }
}
