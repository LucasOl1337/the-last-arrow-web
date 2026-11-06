import { proof, memoryProbe, measure } from './bench-rodada-9.mjs';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { writeFile } from 'node:fs/promises';

await proof('session', async ({ page, cdp, report, base, out, before, shot }) => {
  const probe = await memoryProbe(cdp, page);
  const matches = [
    { map: 'moss', character: 'mizu', humans: 1, mode: 'headhunter' },
    { map: 'moss', character: 'mizu', humans: 1, mode: 'headhunter', rematch: true },
    { map: 'totem', character: 'stormdragon', humans: 0, mode: 'versus' },
    { map: 'canopy', character: 'kaze', humans: 1, mode: 'headhunter' },
    { map: 'falls', character: 'akane', humans: 0, mode: 'headhunter' },
    { map: 'roots', character: 'mizu', humans: 1, mode: 'versus' },
    { map: 'moss', character: 'akane', humans: 0, mode: 'headhunter' },
    { map: 'totem', character: 'mizu', humans: 1, mode: 'headhunter' },
  ];
  report.matches = []; report.measurement = 'One navigation; real 1x FPS, GC outside FPS window; CDP WebAudio and DOM counters. Baseline only finishes at24x; final plays all eight at1x.';
  await page.goto(`${base}?seed=3`);
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  report.timeOrigin = timeOrigin; const began = Date.now();
  report.gpu = await page.evaluate(() => navigator.userAgent);
  for (const [i, config] of matches.entries()) {
    if (config.rematch) await page.getByRole('button', { name: 'Revanche' }).click();
    else {
      if (i) await page.getByRole('button', { name: 'Escolher outra arena' }).click();
      await page.locator('#mode').selectOption(String(config.humans));
      await page.locator('#rules').selectOption(config.mode);
      await page.locator(`#map [data-value="${config.map}"]`).click();
      await page.locator(`#character1 [data-value="${config.character}"]`).click();
      await page.locator('#difficulty [data-value="hard"]').click();
      await page.getByRole('button', { name: 'Começar partida' }).click();
    }
    await page.waitForFunction(() => window.__tla.diagnostics().models && window.__tla.state().phase === 'playing');
    await page.evaluate(() => {
      const w = window.__tla.world, push = w.events.push; window.sessionEvents = {};
      w.events.push = function (...events) { for (const e of events) { const key = `${e.type}:${e.actor}`; window.sessionEvents[key] = (window.sessionEvents[key] ?? 0) + 1; } return push.apply(this, events); };
    });
    await delay(1800);
    const fps = measure(page, before ? 6000 : 12000);
    if (config.humans) {
      const hold = async (keys, ms) => { for (const k of keys) await page.keyboard.down(k); await delay(ms); for (const k of keys.toReversed()) await page.keyboard.up(k); };
      await hold(['KeyD', 'KeyJ'], 400); await hold(['KeyK'], 180); await hold(['KeyA', 'KeyL'], 180);
      await hold(['KeyA', 'KeyJ'], 400); await hold(['KeyW', 'KeyJ'], 350);
    }
    const sample = { index: i + 1, ...config, fpsStart: await fps, startResources: await probe() };
    report.matches.push(sample);
    await shot(`partida-${i + 1}-${config.map}`);
    if (!before) {
      await delay(25000);
      assert.notEqual(await page.evaluate(() => window.__tla.world.phase), 'matchover');
      sample.fpsLate = await measure(page, 12000);
      sample.lateResources = await probe();
      assert.ok(sample.fpsLate.fps >= 58, `${config.map} late: ${sample.fpsLate.fps}`);
    }
    if (before) await page.evaluate(() => window.__tla.setTimeScale(24));
    await page.waitForFunction(() => window.__tla.state().phase === 'matchover', null, { timeout: before ? 90000 : 900000 });
    sample.finish = await page.evaluate(() => ({ state: window.__tla.state(), events: window.sessionEvents, timeOrigin: performance.timeOrigin }));
    assert.equal(sample.finish.timeOrigin, timeOrigin, 'no reload between matches');
    assert.equal(sample.finish.state.mode, config.mode);
    assert.equal(sample.finish.state.fighters[0].human, !!config.humans);
    if (config.mode === 'headhunter') assert.equal(sample.finish.state.matchTime, 120);
    else assert.equal(Math.max(...sample.finish.state.fighters.map(f => f.score)), 5);
    await delay(6000); // Drain the longest sample (Storm victory) before counting live audio nodes.
    sample.endResources = await probe(); sample.elapsedSeconds = (Date.now() - began) / 1000;
    if (!before) {
      assert.ok(sample.fpsStart.fps >= 58, `${config.map}: ${sample.fpsStart.fps}`);
      assert.equal(sample.fpsStart.diagnostics.quality.level, 'normal');
      assert.deepEqual(sample.endResources.diagnostics.audioFailures, []);
    }
    await writeFile(`${out}/session-progress.json`, JSON.stringify(report, null, 2));
    console.log('MATCH', sample.index, config.map, sample.fpsStart.fps, JSON.stringify(sample.endResources));
  }
  report.durationSeconds = (Date.now() - began) / 1000;
  await shot('oitava-vitoria');
  await page.getByRole('button', { name: 'Escolher outra arena' }).click();
  report.menuResources = await probe();
  if (!before) {
    const a = report.matches[1].endResources, b = report.matches[6].endResources;
    assert.ok(b.diagnostics.textures <= a.diagnostics.textures + 8, 'bounded textures after caches warm');
    assert.ok(b.heap.usedSize - a.heap.usedSize < 8 * 1024 * 1024, 'bounded JS heap across warm matches');
    const audio = report.matches.map(m => m.endResources.audio.live);
    assert.ok(Math.max(...audio) <= 5, `only permanent audio graph remains: ${audio}`);
    const listeners = report.matches.map(m => m.endResources.dom.jsEventListeners);
    assert.ok(Math.max(...listeners) - Math.min(...listeners) <= 5, `stable listeners: ${listeners}`);
  }
});
