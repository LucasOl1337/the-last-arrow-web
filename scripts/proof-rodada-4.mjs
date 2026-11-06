import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { checkScreen } from './check-screen.mjs';

// Only via: agent-bench launch tla -- /tmp/tla-prova.sh scripts/proof-rodada-4.mjs /tmp/tla-rodada-4.log
// Caller holds the heavy queue. One isolated headless browser/page, never the human browser.
assert.equal(process.env.DISPLAY, ':80', 'Run on the tla bench, not the human display');
const out = process.env.TLA_PROOF_DIR ?? 'evidence/rodada-4';
await mkdir(out, { recursive: true });
const port = 4176, base = `http://127.0.0.1:${port}/the-last-arrow-web/`;
const report = { owner: 'tla-rodada-4', pid: process.pid, viewport: '1600x900', errors: [], maps: {}, screens: {}, pagesAtStart: 0, pagesAtEnd: null };
const event = type => appendFile(`${out}/web-events.ndjson`, JSON.stringify({ owner: report.owner, pid: process.pid, type, bench: 'tla' }) + '\n');
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  let ready = false;
  for (let n = 0; n < 100; n++) { try { if ((await fetch(base)).ok) { ready = true; break; } } catch {} await delay(50); }
  assert.ok(ready, 'preview did not start');
  browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`, headless: true,
    args: ['--headless=new', '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage(); await event('open');
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') report.errors.push(msg.text()); });
  page.on('response', r => { if (r.status() >= 400) report.errors.push(`${r.status()} ${r.url()}`); });
  const shot = name => page.screenshot({ path: `${out}/${name}.png` });
  for (const map of ['moss', 'totem', 'canopy']) {
    const entry = report.maps[map] = {};
    await page.goto(`${base}?autoplay=bots4&map=${map}&seed=3`);
    await page.waitForFunction(() => window.__tla?.diagnostics().models, undefined, { timeout: 30000 });
    await delay(600); // compile/load before the measured round
    await page.evaluate(map => window.__tla.startMatch({ humans: 0, bots: 4, map, seed: 3 }), map);
    await page.waitForFunction(() => window.__tla.state().phase === 'playing');
    await delay(1000); await shot(`${map}-jogo`);
    // Observe actual play, not generated inputs or artificial state variations.
    entry.play = await page.evaluate(() => new Promise(resolve => {
      const api = window.__tla, start = performance.now();
      let frames = 0, previous = start, maxGap = 0, kills = 0, shots = 0, lastAlive = api.world.fighters.map(f => f.alive), arrows = api.world.nextArrowId;
      const observations = { clippedLabels: [], labelOverlaps: [], scoreboardOverlaps: [], penetrations: [], timeline: [] };
      function tick(now) {
        const w = api.world; frames++; maxGap = Math.max(maxGap, now - previous); previous = now;
        w.fighters.forEach((f, i) => { if (!f.alive && lastAlive[i]) kills++; lastAlive[i] = f.alive; });
        if (w.nextArrowId > arrows) shots += w.nextArrowId - arrows; arrows = w.nextArrowId;
        if (frames % 6 === 0 && w.phase === 'playing') {
          const area = document.querySelector('#game').getBoundingClientRect();
          const labels = [...document.querySelectorAll('.overhead')].filter(el => !el.hidden).map(el => ({ text: el.textContent, r: el.getBoundingClientRect() }));
          for (const { text, r } of labels) if ((r.left < area.left || r.right > area.right || r.top < area.top || r.bottom > area.bottom) && observations.clippedLabels.length < 8)
            observations.clippedLabels.push({ text, tick: w.tick, x: r.x, y: r.y, width: r.width, height: r.height });
          const score = document.querySelector('.scoreboard').getBoundingClientRect();
          for (const { text, r } of labels) if (r.left < score.right && r.right > score.left && r.top < score.bottom && r.bottom > score.top && observations.scoreboardOverlaps.length < 8)
            observations.scoreboardOverlaps.push({ tick: w.tick, text });
          for (let a = 0; a < labels.length; a++) for (let b = a + 1; b < labels.length; b++) {
            const x = labels[a].r, y = labels[b].r;
            if (x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top && observations.labelOverlaps.length < 8)
              observations.labelOverlaps.push({ tick: w.tick, names: [labels[a].text, labels[b].text] });
          }
          for (const f of w.fighters.filter(f => f.alive)) {
            for (let y = Math.floor(f.y - .55 + .002); y <= Math.floor(f.y + .55 - .002); y++)
              for (let x = Math.floor(f.x - .32 + .002); x <= Math.floor(f.x + .32 - .002); x++)
                if (w.level.rows[(y % 18 + 18) % 18][(x % 32 + 32) % 32] === '#' && observations.penetrations.length < 8)
                  observations.penetrations.push({ tick: w.tick, id: f.id, x: f.x, y: f.y });
          }
          if (frames % 60 === 0) observations.timeline.push({ tick: w.tick, round: w.round, fighters: w.fighters.map(f => ({ id: f.id, x: f.x, y: f.y, alive: f.alive, ammo: f.ammo })), arrows: w.arrows.length });
        }
        if (now - start >= 10000) resolve({ fps: frames * 1000 / (now - start), maxGap, kills, shots, ...observations, state: api.state() });
        else requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }));
    entry.performance = await page.evaluate(() => window.__tla.diagnostics());
    console.log(map, JSON.stringify({ fps: entry.play.fps, kills: entry.play.kills, clipped: entry.play.clippedLabels.length, overlaps: entry.play.labelOverlaps.length, penetrations: entry.play.penetrations.length }));
    entry.aim = await page.evaluate(() => new Promise(resolve => {
      const start = performance.now();
      const tick = () => {
        const w = window.__tla.world;
        const f = w.fighters.find(f => f.alive && f.charging && f.charge > .08 && f.y > 3 && f.y < 16 && f.x > 3 && f.x < 29);
        if (f) { window.__tla.setTimeScale(0); resolve({ id: f.id, x: f.x, y: f.y, aimX: f.aimX, aimY: f.aimY, tick: w.tick }); }
        else if (performance.now() - start > 20000) resolve(null); else requestAnimationFrame(tick);
      }; tick();
    }));
    assert.ok(entry.aim, `${map}: no real charging pose`);
    await delay(120); await shot(`${map}-mira`);
    if (map === 'totem') {
      const r = await page.locator('.overhead').nth(entry.aim.id).boundingBox();
      const clip = { x: Math.max(0, Math.min(1120, r.x + r.width / 2 - 240)), y: Math.max(0, Math.min(540, r.y - 40)), width: 480, height: 360 };
      await page.screenshot({ path: `${out}/mira-close.png`, clip });
    }
  }
  // First real death, not a fabricated kill: inspect the dissolve and visible flying arrows.
  await page.evaluate(() => window.__tla.startMatch({ humans: 0, bots: 4, map: 'canopy', seed: 21 }));
  report.kill = await page.evaluate(() => new Promise(resolve => {
    const start = performance.now();
    const tick = () => {
      const w = window.__tla.world, dead = w.fighters.find(f => !f.alive);
      if (dead) { window.__tla.setTimeScale(.02); resolve({ id: dead.id, x: dead.x, y: dead.y, tick: w.tick, phase: w.phase }); }
      else if (performance.now() - start > 30000) resolve(null); else requestAnimationFrame(tick);
    }; tick();
  }));
  assert.ok(report.kill, 'no real kill'); await delay(120); await shot('abate');
  // Arena gate on the actual build. No second browser/Storybook surface outside tla.
  for (const [width, height] of [[1366, 768], [900, 1000]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => { window.__tla.startMatch({ humans: 0, bots: 4, map: 'totem', seed: 3 }); window.__tla.setTimeScale(0); window.__tla.world.phase = 'playing'; });
    await delay(250); report.screens[`${width}x${height}`] = await checkScreen(page, '#game');
    await shot(`arena-${width}x${height}`);
    assert.ok(report.screens[`${width}x${height}`].passou, `screen gate ${width}x${height}`);
  }
  for (const [map, e] of Object.entries(report.maps)) {
    assert.ok(e.performance.models, `${map}: models missing`);
    assert.ok(e.play.fps >= 58, `${map}: measured ${e.play.fps.toFixed(2)} fps`);
    assert.ok(e.performance.fps >= 58, `${map}: diagnostic ${e.performance.fps.toFixed(2)} fps`);
    assert.deepEqual(e.play.penetrations, [], `${map}: actual hitbox penetrated solid tile`);
    assert.deepEqual(e.play.clippedLabels, [], `${map}: clipped overhead`);
    assert.deepEqual(e.play.labelOverlaps, [], `${map}: overlapping overheads`);
    assert.deepEqual(e.play.scoreboardOverlaps, [], `${map}: overhead over scoreboard`);
  }
  assert.deepEqual(report.errors, []);
  await page.close(); await event('close'); report.pagesAtEnd = context.pages().length;
  console.log(JSON.stringify({ maps: Object.fromEntries(Object.entries(report.maps).map(([k, v]) => [k, { fps: v.play.fps, diagnostic: v.performance.fps }])), kill: report.kill, errors: report.errors, pagesAtEnd: report.pagesAtEnd }));
} finally {
  if (browser) { await browser.close(); report.pagesAtEnd = 0; await event('browser-closed'); }
  server.kill('SIGTERM');
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
