import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, appendFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { checkScreen } from './check-screen.mjs';

// Supplemental proof: finish a match on each shipped map, inspect the exact HUD story,
// and capture an actual kill away from the top HUD. Only via /tmp/tla-prova.sh on tla.
assert.equal(process.env.DISPLAY, ':80', 'tla bench required');
const out = 'evidence/rodada-4'; await mkdir(out, { recursive: true });
const report = { owner: 'tla-rodada-4-finish', pid: process.pid, errors: [], maps: {}, story: {}, pagesAtStart: 0, pagesAtEnd: null };
const event = type => appendFile(`${out}/web-events.ndjson`, JSON.stringify({ owner: report.owner, pid: process.pid, type, bench: 'tla' }) + '\n');
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4176', '--strictPort'], { stdio: 'ignore' });
const stories = spawn('/usr/bin/python', ['-m', 'http.server', '6107', '--bind', '127.0.0.1', '--directory', 'storybook-static'], { stdio: 'ignore' });
let browser;
try {
  const base = 'http://127.0.0.1:4176/the-last-arrow-web/';
  for (const url of [base, 'http://127.0.0.1:6107/iframe.html']) {
    let ready = false;
    for (let n = 0; n < 100; n++) { try { if ((await fetch(url)).ok) { ready = true; break; } } catch {} await delay(50); }
    assert.ok(ready, `${url} not ready`);
  }
  browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`, headless: true,
    args: ['--headless=new', '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage(); await event('open');
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') report.errors.push(msg.text()); });
  page.on('response', r => { if (r.status() >= 400) report.errors.push(`${r.status()} ${r.url()}`); });
  // Each named product map once, same seed; not randomized/generated input testing.
  for (const map of ['moss', 'totem', 'canopy', 'falls', 'roots']) {
    const entry = report.maps[map] = {};
    await page.goto(`${base}?autoplay=bots4&map=${map}&seed=3`);
    await page.waitForFunction(() => window.__tla?.diagnostics().models, undefined, { timeout: 30000 });
    // Measure each named map in real time before accelerating to match completion.
    {
      await delay(600);
      await page.evaluate(map => window.__tla.startMatch({ humans: 0, bots: 4, map, seed: 3 }), map);
      await page.waitForFunction(() => window.__tla.state().phase === 'playing');
      await delay(1000); await page.screenshot({ path: `${out}/${map}-jogo.png` });
      entry.realtime = await page.evaluate(() => new Promise(resolve => {
        const start = performance.now(); let frames = 0;
        function tick(now) { frames++; if (now - start >= 8000) resolve({ fps: frames * 1000 / (now - start), diagnostics: window.__tla.diagnostics() }); else requestAnimationFrame(tick); }
        requestAnimationFrame(tick);
      }));
      assert.ok(entry.realtime.fps >= 58, `${map} fps ${entry.realtime.fps}`);
      assert.ok(entry.realtime.diagnostics.fps >= 58, `${map} diagnostic fps`);
    }
    await page.evaluate(() => window.__tla.setTimeScale(24));
    await page.waitForFunction(() => window.__tla.state().phase === 'matchover', undefined, { timeout: 60000 });
    await page.getByRole('heading', { name: /venceu|Empate/ }).waitFor();
    entry.finished = await page.evaluate(() => window.__tla.state());
    assert.ok(entry.finished.fighters.some(f => f.score === 5), `${map} no winner`);
    console.log(map, JSON.stringify({ phase: entry.finished.phase, round: entry.finished.round, fps: entry.realtime?.fps }));
    if (map === 'canopy') await page.screenshot({ path: `${out}/partida-concluida.png` });
  }
  // Capture the second/later actual death if the first was behind the scoreboard.
  await page.evaluate(() => window.__tla.startMatch({ humans: 0, bots: 4, map: 'moss', seed: 3 }));
  report.kill = await page.evaluate(() => new Promise(resolve => {
    const start = performance.now(); let alive = window.__tla.world.fighters.map(f => f.alive);
    function tick() {
      const w = window.__tla.world;
      const dead = w.fighters.find((f, i) => alive[i] && !f.alive && f.y > 4 && f.y < 15 && f.x > 4 && f.x < 28);
      alive = w.fighters.map(f => f.alive);
      if (dead) { window.__tla.setTimeScale(.02); resolve({ id: dead.id, x: dead.x, y: dead.y, tick: w.tick, phase: w.phase }); }
      else if (performance.now() - start > 35000) resolve(null); else requestAnimationFrame(tick);
    } tick();
  }));
  assert.ok(report.kill, 'no unobstructed real kill');
  await delay(140); await page.screenshot({ path: `${out}/abate-em-jogo.png` });
  // Conservative crop includes victim, shock ring and the killer. Derived from the recorded world coords.
  const k = report.kill, cx = 800 + (k.x - 16) * 47, cy = 450 + (k.y - 9) * 47;
  await page.screenshot({ path: `${out}/abate-close.png`, clip: { x: Math.max(0, Math.min(1040, cx - 280)), y: Math.max(0, Math.min(480, cy - 260)), width: 560, height: 420 } });
  for (const [width, height] of [[1366, 768], [900, 1000], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.goto('http://127.0.0.1:6107/iframe.html?id=arena-hud-real--bordas-e-nomes-cruzados&viewMode=story');
    await page.locator('.overhead').first().waitFor(); await delay(150);
    const key = `${width}x${height}`;
    report.story[key] = await checkScreen(page, '#game');
    await page.screenshot({ path: `${out}/hud-story-${key}.png` });
    assert.ok(report.story[key].passou, `HUD story gate ${key}`);
  }
  assert.deepEqual(report.errors, []);
  await page.close(); await event('close'); report.pagesAtEnd = context.pages().length;
  console.log(JSON.stringify({ kill: report.kill, errors: report.errors, pagesAtEnd: report.pagesAtEnd }));
} finally {
  if (browser) { await browser.close(); report.pagesAtEnd = 0; await event('browser-closed'); }
  server.kill('SIGTERM'); stories.kill('SIGTERM');
  await writeFile(`${out}/finish-report.json`, JSON.stringify(report, null, 2));
}
