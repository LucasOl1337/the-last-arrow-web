import { asset } from './paths.ts';
import type { SimEvent, World } from './sim/world.ts';
const files = {
  music: 'music.mp3', mizuShoot: 'mizu_shoot.wav', mizuDash: 'mizu_dash.ogg',
  stormShoot: 'storm_shoot.ogg', stormDash: 'storm_dash.ogg', stormUlt: 'storm_ult.wav',
} as const;
type Sound = keyof typeof files;
const MUSIC_VOLUME = 0.14;
/** Transparent below -3.7 dBFS; soft saturation leaves headroom when effects coincide. */
function safetyCurve() {
  const curve = new Float32Array(4097);
  for (let i = 0; i < curve.length; i++) {
    const x = i * 2 / (curve.length - 1) - 1, a = Math.abs(x);
    curve[i] = Math.sign(x) * (a <= 0.65 ? a : 0.65 + 0.2 * Math.tanh((a - 0.65) / 0.2));
  }
  return curve;
}
export class AudioEngine {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private music: AudioBufferSourceNode | null = null;
  private buffers = new Map<Sound, AudioBuffer>();
  private sampleLevels = new Map<Sound, number>();
  private noiseBuffer: AudioBuffer | null = null;
  private loading = false;
  muted = false;
  suspended = false;
  failures: string[] = [];
  /** Music only starts after a real gesture (unlock is called from pointer/key handlers). */
  async unlock() {
    this.context ??= new AudioContext();
    if (!this.gain) {
      this.gain = this.context.createGain(); this.gain.gain.value = this.muted ? 0 : this.suspended ? 0.16 : 0.6;
      const safety = this.context.createWaveShaper(); safety.curve = safetyCurve(); safety.oversample = '4x';
      this.gain.connect(safety); safety.connect(this.context.destination);
    }
    await this.context.resume();
    if (this.loading) return;
    this.loading = true;
    await Promise.all(Object.entries(files).map(async ([key, file]) => {
      try {
        const response = await fetch(asset(`audio/${file}`)); if (!response.ok) throw new Error(String(response.status));
        const buffer = await this.context!.decodeAudioData(await response.arrayBuffer());
        this.buffers.set(key as Sound, buffer);
        // Source assets differ by ~29 dB. Match their peaks once on load, not per shot.
        if (key !== 'music') {
          let peak = 0;
          for (let channel = 0; channel < buffer.numberOfChannels; channel++)
            for (const value of buffer.getChannelData(channel)) peak = Math.max(peak, Math.abs(value));
          this.sampleLevels.set(key as Sound, peak > 0 ? Math.min(32, 0.65 / peak) : 1);
        }
      } catch { this.failures.push(file); }
    }));
    if (!this.music && this.buffers.has('music')) {
      this.music = this.context.createBufferSource(); this.music.buffer = this.buffers.get('music')!; this.music.loop = true;
      const musicGain = this.context.createGain(); musicGain.gain.value = MUSIC_VOLUME; this.music.connect(musicGain); musicGain.connect(this.gain); this.music.start();
    }
  }
  setMuted(muted: boolean) { this.muted = muted; this.updateGain(); }
  setPaused(paused: boolean) { this.suspended = paused; this.updateGain(); }
  private updateGain() { if (this.gain && this.context) this.gain.gain.setTargetAtTime(this.muted ? 0 : this.suspended ? 0.16 : 0.6, this.context.currentTime, 0.03); }
  private sample(name: Sound, volume = 0.6) {
    if (!this.context || !this.gain || !this.buffers.has(name)) return;
    const source = this.context.createBufferSource(), gain = this.context.createGain();
    source.buffer = this.buffers.get(name)!; gain.gain.value = volume * (this.sampleLevels.get(name) ?? 1); source.connect(gain); gain.connect(this.gain); source.start();
    source.onended = () => { source.disconnect(); gain.disconnect(); };
  }
  private tone(hz: number, duration: number, type: OscillatorType, end: number, volume = 0.15, delay = 0) {
    if (!this.context || !this.gain) return;
    const oscillator = this.context.createOscillator(), gain = this.context.createGain(), now = this.context.currentTime + delay;
    oscillator.type = type; oscillator.frequency.setValueAtTime(hz, now); oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
    gain.gain.setValueAtTime(0.0001, this.context.currentTime); gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain); gain.connect(this.gain); oscillator.start(now); oscillator.stop(now + duration + 0.02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  /** Filtered white-noise burst: the base of impacts, catches, explosions and thunder. */
  private noise(duration: number, filter: BiquadFilterType, hz: number, volume: number, opts: { q?: number; endHz?: number; delay?: number; attack?: number } = {}) {
    if (!this.context || !this.gain) return;
    const ctx = this.context;
    if (!this.noiseBuffer) {
      this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource(), biquad = ctx.createBiquadFilter(), gain = ctx.createGain();
    const now = ctx.currentTime + (opts.delay ?? 0), attack = opts.attack ?? 0.002;
    source.buffer = this.noiseBuffer; source.loop = true;
    biquad.type = filter; biquad.frequency.setValueAtTime(hz, now); biquad.Q.value = opts.q ?? 1;
    if (opts.endHz) biquad.frequency.exponentialRampToValueAtTime(opts.endHz, now + duration);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime); gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + attack); gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(biquad); biquad.connect(gain); gain.connect(this.gain);
    source.start(now, Math.random() * 0.5); source.stop(now + duration + 0.02);
    source.onended = () => { source.disconnect(); biquad.disconnect(); gain.disconnect(); };
  }
  /** Bowstring creak when a fighter starts drawing (not a sim event: main.ts detects the charge edge). */
  draw() {
    this.tone(95, 0.32, 'sawtooth', 150, 0.06);
    this.noise(0.3, 'bandpass', 1800, 0.08, { q: 8, endHz: 2600, attack: 0.08 });
  }
  private impact(material: 'stone' | 'wood') {
    if (material === 'stone') { // dry, bright click with a short grit tail
      this.noise(0.05, 'highpass', 3200, 0.22); this.noise(0.14, 'bandpass', 1200, 0.08, { q: 2, delay: 0.01 });
      this.tone(2400, 0.04, 'square', 900, 0.03);
    } else { // wood: hollow thunk, low body resonance
      this.tone(210, 0.16, 'sine', 120, 0.22); this.noise(0.08, 'bandpass', 600, 0.16, { q: 4 });
    }
  }
  private tchak() {
    this.noise(0.035, 'highpass', 4000, 0.3); this.tone(1700, 0.06, 'triangle', 700, 0.12);
    this.noise(0.05, 'bandpass', 2200, 0.18, { q: 6, delay: 0.045 }); this.tone(900, 0.12, 'sine', 1800, 0.08, 0.05);
  }
  private chestOpen() {
    this.tone(140, 0.22, 'sawtooth', 70, 0.05); // hinge creak
    this.noise(0.18, 'bandpass', 900, 0.04, { q: 10, endHz: 500 });
    [660, 880, 1320].forEach((hz, n) => this.tone(hz, 0.35, 'sine', hz * 1.01, 0.07, 0.12 + n * 0.07)); // treasure sparkle
  }
  private bomb() {
    this.tone(90, 0.7, 'sine', 30, 0.45); this.noise(0.9, 'lowpass', 1800, 0.5, { endHz: 120 });
    this.noise(0.25, 'highpass', 2000, 0.15);
  }
  private bolt() {
    this.noise(0.08, 'highpass', 5000, 0.25); // crack
    this.tone(1800, 0.12, 'sawtooth', 120, 0.08);
    this.noise(0.9, 'lowpass', 400, 0.22, { delay: 0.05, attack: 0.05, endHz: 80 }); // rumble
  }
  event(e: SimEvent, w: World) {
    const storm = w.fighters[e.actor]?.character === 1;
    if (e.type === 'shoot') { this.sample(storm ? 'stormShoot' : 'mizuShoot'); if (e.kind === 'bolt') this.bolt(); }
    if (e.type === 'dash') this.sample(storm ? 'stormDash' : 'mizuDash', 0.4);
    if (e.type === 'jump') this.tone(220, 0.08, 'sine', 460, 0.06);
    if (e.type === 'impact' && e.kind !== 'bomb') this.impact(w.level.id === 'canopy' ? 'wood' : 'stone');
    if (e.type === 'kill') this.tone(160, 0.2, 'sawtooth', 30, 0.18);
    if (e.type === 'catch') this.tchak();
    if (e.type === 'pickup') this.tone(540, 0.12, 'sine', 1200);
    if (e.type === 'chest-open') this.chestOpen();
    if (e.type === 'chest-spawn') this.tone(1046, 0.25, 'sine', 1568, 0.05);
    if (e.type === 'explosion') this.bomb();
    if (e.type === 'victory') { if (storm) this.sample('stormUlt', 0.25); else this.tone(330, 0.8, 'triangle', 660); }
  }
}
