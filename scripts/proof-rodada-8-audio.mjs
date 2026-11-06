import { proof } from './bench-rodada-8.mjs';
import assert from 'node:assert/strict';
const before = process.env.TLA_BEFORE === '1';
await proof('audio', async ({ page, base, report }) => {
  await page.goto(base);
  report.signals = await page.evaluate(async () => {
    const { AudioEngine } = await import('./src/audio.ts');
    const { createWorld } = await import('./src/sim/world.ts');
    const NativeContext = window.AudioContext, originalRandom = Math.random;
    const sounds = [ 'corda', 'soltura', 'soltura-storm', 'pedra', 'madeira', 'catch', 'bau', 'bomba', 'raio', 'abate', 'vitoria', 'vitoria-storm', 'musica', 'dash', 'dash-storm', 'pulo', 'pickup', 'bau-aparece', 'mix-4-jogadores' ];
    const results = {};
    try {
      for (const name of sounds) {
        let rng = 3; Math.random = () => { rng ^= rng << 13; rng ^= rng >>> 17; rng ^= rng << 5; return (rng >>> 0) / 4294967296; };
        // Entire 125.47 s music loop and 4.53 s victory asset, not just their opening.
        const seconds = name === 'musica' ? 126 : name === 'vitoria-storm' ? 5 : 3;
        const ctx = new OfflineAudioContext(2, 48000 * seconds, 48000);
        Object.defineProperty(ctx, 'resume', { value: async () => {} });
        window.AudioContext = function () { return ctx; };
        const a = new AudioEngine(); await a.unlock();
        if (!['musica', 'mix-4-jogadores'].includes(name)) a.music?.stop();
        const w = createWorld({ map: name === 'madeira' ? 'canopy' : 'moss' });
        const emit = (type, actor = 0, kind = 'normal') => a.event({ type, actor, kind, x: 5, y: 5 }, w);
        if (name === 'corda') a.draw();
        if (name === 'soltura') emit('shoot');
        if (name === 'soltura-storm') emit('shoot', 1);
        if (['pedra', 'madeira'].includes(name)) emit('impact');
        if (name === 'catch') emit('catch');
        if (name === 'bau') emit('chest-open');
        if (name === 'bomba') emit('explosion');
        if (name === 'raio') emit('shoot', 0, 'bolt');
        if (name === 'abate') emit('kill');
        if (name === 'vitoria') emit('victory');
        if (name === 'vitoria-storm') emit('victory', 1);
        if (name === 'dash') emit('dash');
        if (name === 'dash-storm') emit('dash', 1);
        if (name === 'pulo') emit('jump');
        if (name === 'pickup') emit('pickup');
        if (name === 'bau-aparece') emit('chest-spawn');
        // Fixed stress chord: four simultaneous explosions/shots/kills plus music and victory.
        if (name === 'mix-4-jogadores') { for (let id = 0; id < 4; id++) { emit('explosion', id); emit('shoot', id, 'bolt'); emit('kill', id); } emit('victory', 1); }
        const b = await ctx.startRendering(); let peak = 0, sum = 0, clipped = 0;
        for (let c = 0; c < b.numberOfChannels; c++) for (const v of b.getChannelData(c)) { peak = Math.max(peak, Math.abs(v)); sum += v * v; if (Math.abs(v) >= 1) clipped++; }
        results[name] = { seconds, peak, peakDb: 20 * Math.log10(peak), rms: Math.sqrt(sum / (b.length * b.numberOfChannels)), clipped, samples: b.length * b.numberOfChannels, failures: a.failures };
      }
    } finally { window.AudioContext = NativeContext; Math.random = originalRandom; }
    return results;
  });
  for (const [name, signal] of Object.entries(report.signals)) {
    assert.ok(signal.peak > .005, `${name} audible signal`); assert.deepEqual(signal.failures, []);
    if (!before) { assert.equal(signal.clipped, 0, `${name} clipping`); assert.ok(signal.peak <= .9, `${name} headroom`); }
  }
}, { dev: true, before });
