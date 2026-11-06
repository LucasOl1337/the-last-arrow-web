import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, appendFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { checkScreen } from './check-screen.mjs';

// One fixed seed, P1 keyboard + three bots, no input sweep/fuzz.
// Run on tla through /tmp/tla-prova.sh while holding the heavy slot.
assert.equal(process.env.DISPLAY, ':80');
const final = process.env.TLA_FINAL === '1';
const out = process.env.TLA_PROOF_DIR ?? (final ? 'evidence/rodada-7' : 'evidence/rodada-7/antes');
await mkdir(out, { recursive: true });
const report = { owner: 'tla-rodada-7', pid: process.pid, final, errors: [], maps: {}, pagesAtEnd: null };
const event = type => appendFile(`${out}/web-events.ndjson`, JSON.stringify({ owner: report.owner, pid: process.pid, type, bench: 'tla' }) + '\n');
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4176', '--strictPort'], { stdio: 'ignore' });
const base = 'http://127.0.0.1:4176/the-last-arrow-web/';
let browser, context;
async function choreography(page) {
  const hold = async (keys, ms) => { for (const k of keys) await page.keyboard.down(k); await delay(ms); for (const k of [...keys].reverse()) await page.keyboard.up(k); };
  await hold(['KeyD'], 650); await hold(['KeyJ'], 450); await hold(['KeyD', 'KeyK'], 300);
  await hold(['KeyD'], 700); await hold(['KeyA', 'KeyJ'], 400); await hold(['KeyA', 'KeyL'], 180);
  await hold(['KeyA'], 650); await hold(['KeyW', 'KeyJ'], 300); await hold(['KeyD', 'Space'], 220);
  await hold(['KeyD'], 800); await hold(['KeyJ'], 500); await hold(['KeyS'], 500);
}
const measure = (page, ms = 6000) => page.evaluate(ms => new Promise(resolve => {
  let begin, last, frames = 0, maxGap = 0;
  const tick = now => { if (begin === undefined) { begin = last = now; requestAnimationFrame(tick); return; }
    frames++; maxGap = Math.max(maxGap, now - last); last = now;
    if (now - begin >= ms) resolve({ fps: frames * 1000 / (now - begin), maxGap, diagnostics: window.__tla.diagnostics() });
    else requestAnimationFrame(tick);
  }; requestAnimationFrame(tick);
}), ms);
async function instrument(page) {
  await page.evaluate(() => {
    const w = window.__tla.world; window.trail = []; window.events7 = [];
    const push = w.events.push;
    w.events.push = function (...es) { window.events7.push(...es.map(e => ({ ...e, tick: w.tick, matchTime: w.matchTime, fighters: w.fighters.map(f => ({ id: f.id, x: f.x, y: f.y, alive: f.alive, score: f.score })) }))); return push.apply(this, es); };
    clearInterval(window.traceTimer);
    window.traceTimer = setInterval(() => { window.trail.push(window.__tla.state()); }, 250);
  });
}
try {
  let ready = false;
  for (let n = 0; n < 100; n++) { try { if ((await fetch(base)).ok) { ready = true; break; } } catch {} await delay(50); }
  assert.ok(ready);
  browser = final ? await chromium.launch({
    executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`, headless: true,
    ignoreDefaultArgs: ['--enable-automation'], args: ['--remote-debugging-port=19187', '--autoplay-policy=no-user-gesture-required']
  }) : await chromium.connectOverCDP('http://127.0.0.1:19080');
  report.route = final ? 'private isolated GPU render on tla (same as rounds 4–6)' : 'bench Chromium headed';
  report.existingPages = browser.contexts().flatMap(c => c.pages()).length;
  assert.ok(report.existingPages < 12);
  context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage(); await event('open');
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) report.errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(`${base}?seed=3`);
  await page.getByRole('button', { name: 'Começar partida' }).click();
  await page.waitForFunction(() => window.__tla.diagnostics().models);
  for (const map of ['moss', 'totem', 'canopy', 'falls', 'roots']) {
    await page.evaluate(map => window.__tla.startMatch({ humans: 1, bots: 3, map, seed: 3, difficulty: 'hard' }), map);
    await instrument(page);
    await page.waitForFunction(() => window.__tla.state().phase === 'playing');
    await delay(1200);
    const measurement = measure(page);
    await choreography(page); const metrics = await measurement;
    await choreography(page);
    report.maps[map] = { ...metrics, ...await page.evaluate(() => ({ events: window.events7, trail: window.trail, state: window.__tla.state() })) };
    await page.screenshot({ path: `${out}/${map}-jogo.png` });
    if (final) {
      assert.ok(metrics.fps >= 58, `${map}: ${metrics.fps}`); assert.equal(metrics.diagnostics.quality?.level, 'normal');
      assert.deepEqual(metrics.diagnostics.audioFailures, []);
      assert.deepEqual(report.maps[map].state.fighters.map(f => f.human), [true, false, false, false]);
      await page.evaluate(() => window.__tla.setTimeScale(24));
      await page.waitForFunction(() => window.__tla.state().phase === 'matchover', null, { timeout: 60000 });
      report.maps[map].finish = await page.evaluate(() => ({ state: window.__tla.state(), events: window.events7 }));
      assert.equal(report.maps[map].finish.state.fighters[report.maps[map].finish.state.winner].score, 5);
    }
    console.log(map, metrics.fps);
  }
  // Headhunter first 25 s at real speed under keyboard; finish at 24x only afterwards.
  if (final) {
    await page.goto(`${base}?seed=3`);
    await page.locator('#rules').selectOption('headhunter');
    await page.locator('#map [data-value="roots"]').click();
    await page.locator('#difficulty [data-value="hard"]').click();
    await page.getByRole('button', { name: 'Começar partida' }).click();
    await page.waitForFunction(() => window.__tla.diagnostics().models);
  } else await page.evaluate(() => window.__tla.startMatch({ humans: 1, bots: 3, map: 'roots', mode: 'headhunter', seed: 3, difficulty: 'hard' }));
  await instrument(page); await page.waitForFunction(() => window.__tla.state().phase === 'playing');
  for (let n = 0; n < 5; n++) await choreography(page);
  report.headhunterLive = await page.evaluate(() => ({ state: window.__tla.state(), footer: document.querySelector('.arena-footer').textContent, events: window.events7, trail: window.trail }));
  await page.screenshot({ path: `${out}/headhunter-jogo.png` });
  await page.evaluate(() => window.__tla.setTimeScale(24));
  await page.waitForFunction(() => window.__tla.state().phase === 'matchover', null, { timeout: 60000 });
  report.headhunterEnd = await page.evaluate(() => ({ state: window.__tla.state(), text: document.querySelector('.menu-layer').textContent, events: window.events7 }));
  await page.screenshot({ path: `${out}/headhunter-final.png` });
  if (final) {
    assert.equal(report.headhunterEnd.state.matchTime, 120);
    assert.match(report.headhunterLive.footer, /Headhunter/); assert.doesNotMatch(report.headhunterEnd.text, /Cinco vitórias/);
    const kills = report.headhunterEnd.events.filter(e => e.type === 'kill' && e.actor !== e.target && e.actor >= 0);
    assert.equal(report.headhunterEnd.state.fighters.reduce((n, f) => n + f.score, 0), kills.length);
    await page.getByRole('button', { name: 'Revanche' }).click();
    assert.equal(await page.evaluate(() => window.__tla.state().mode), 'headhunter');
    await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Voltar ao menu' }).click();
  }
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  // Fresh load under CPU4 includes real model setup, not a fake FPS hook.
  await page.goto(`${base}?seed=3`);
  await page.locator('#map [data-value="totem"]').click(); await page.locator('#difficulty [data-value="hard"]').click();
  await page.getByRole('button', { name: 'Começar partida' }).click();
  await page.waitForFunction(() => window.__tla.diagnostics().models);
  await page.waitForFunction(() => window.__tla.state().phase === 'playing');
  await delay(2500);
  const slow = measure(page, 8000); await choreography(page); report.cpu4 = await slow;
  await page.screenshot({ path: `${out}/cpu4-jogo.png` });
  if (final) { assert.ok(report.cpu4.fps >= 45); assert.deepEqual(report.cpu4.diagnostics.audioFailures, []); }
  console.log('CPU4', JSON.stringify(report.cpu4));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.evaluate(() => { clearInterval(window.traceTimer); });
  report.screens = {};
  for (const [width, height] of [[1366,768],[900,1000],[844,390]]) {
    await page.setViewportSize({ width, height }); await delay(150);
    report.screens[`${width}x${height}`] = await checkScreen(page, '#game');
    assert.ok(report.screens[`${width}x${height}`].passou);
    await page.screenshot({ path: `${out}/arena-${width}x${height}.png` });
  }
  assert.deepEqual(report.errors, []);
} finally {
  if (context) { await context.close(); report.pagesAtEnd = 0; await event('close'); }
  if (browser) { report.existingPagesAtEnd = browser.contexts().flatMap(c => c.pages()).length; await browser.close(); }
  server.kill('SIGTERM');
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
console.log('DONE', JSON.stringify({ errors: report.errors, pagesAtEnd: report.pagesAtEnd }));
