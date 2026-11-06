import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, appendFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { checkScreen } from './check-screen.mjs';

// Fixed human play sessions and named regressions, not generated/fuzz inputs.
// Only: agent-bench launch tla -- /tmp/tla-prova.sh scripts/proof-rodada-5.mjs LOG
// Caller holds the heavy queue. The one private browser/page closes in finally.
assert.equal(process.env.DISPLAY, ':80', 'tla bench required');
const final = process.env.TLA_FINAL === '1';
const out = final ? 'evidence/rodada-5' : 'evidence/rodada-5/antes';
await mkdir(out, { recursive: true });
const report = { owner: 'tla-rodada-5', pid: process.pid, final, errors: [], maps: {}, checks: {}, pagesAtStart: 0, pagesAtEnd: null };
const event = type => appendFile(`${out}/web-events.ndjson`, JSON.stringify({ owner: report.owner, pid: process.pid, type, bench: 'tla' }) + '\n');
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4176', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  const base = 'http://127.0.0.1:4176/the-last-arrow-web/';
  let ready = false;
  for (let n = 0; n < 100; n++) { try { if ((await fetch(base)).ok) { ready = true; break; } } catch {} await delay(50); }
  assert.ok(ready, 'preview not ready');
  browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`, headless: true,
    args: ['--headless=new', '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage(); await event('open');
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') report.errors.push(msg.text()); });
  page.on('response', r => { if (r.status() >= 400) report.errors.push(`${r.status()} ${r.url()}`); });
  await page.addInitScript(() => {
    window.testPad = null;
    Object.defineProperty(navigator, 'getGamepads', { value: () => [window.testPad] });
  });
  const shot = name => page.screenshot({ path: `${out}/${name}.png` });
  const keys = page.keyboard;
  const hold = async (names, ms) => { for (const k of names) await keys.down(k); await delay(ms); for (const k of [...names].reverse()) await keys.up(k); };
  const state = () => page.evaluate(() => window.__tla.state());
  const observe = () => page.evaluate(() => {
    const w = window.__tla.world;
    window.playLog = []; window.playTrail = []; window.playFrames = 0; window.playStart = performance.now(); window.playObserve = true;
    const push = w.events.push;
    w.events.push = function (...events) { window.playLog.push(...events.map(e => ({ ...e, tick: w.tick, round: w.round }))); return push.apply(this, events); };
    function tick() {
      if (!window.playObserve) return;
      window.playFrames++;
      const f = w.fighters[0];
      window.playTrail.push({ tick: w.tick, round: w.round, phase: w.phase, x: f.x, y: f.y, vx: f.vx, vy: f.vy, grounded: f.grounded, alive: f.alive, ammo: f.ammo, charging: f.charging, aimX: f.aimX, aimY: f.aimY });
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
  const observed = () => page.evaluate(() => {
    window.playObserve = false;
    return { fps: window.playFrames * 1000 / (performance.now() - window.playStart), events: window.playLog, trail: window.playTrail, diagnostics: window.__tla.diagnostics(), state: window.__tla.state() };
  });
  await page.goto(`${base}?seed=3`);
  await page.getByRole('button', { name: 'Começar partida' }).waitFor();
  await page.locator('#map img').evaluateAll(imgs => Promise.all(imgs.map(img => img.decode())));
  await shot('menu-1366x768');
  report.checks.menu = await checkScreen(page, '.menu-content');
  // Enter every map through the real menu, not an autoplay start hook.
  for (const [width, height] of (final ? [[1600, 900], [1366, 768]] : [[1366, 768]])) {
    await page.setViewportSize({ width, height });
    for (const map of ['moss', 'totem', 'canopy', 'falls', 'roots']) {
      const entry = report.maps[`${map}-${width}`] = {};
      await page.locator(`#map [data-value="${map}"]`).click();
      await page.getByRole('button', { name: 'Começar partida' }).click();
      await page.waitForFunction(() => window.__tla.diagnostics().models);
      await page.waitForFunction(() => window.__tla.state().phase === 'playing');
      assert.deepEqual((await state()).fighters.map(f => f.human), [true, false, false, false]);
      await observe();
      await hold(['KeyD'], 250);
      await keys.down('KeyD'); await hold(['KeyK'], 250); await keys.up('KeyD');
      await keys.down('KeyJ'); await hold(['KeyW', 'KeyD'], 200); await keys.up('KeyJ');
      await hold(['KeyA', 'KeyL'], 160);
      await hold(['KeyA', 'KeyJ'], 180);
      await hold(['KeyS'], 300);
      await shot(`${map}-p1-${width}`);
      await hold(['KeyD', 'Space'], 300);
      await hold(['KeyD'], 1100);
      await hold(['KeyW', 'KeyJ'], 160);
      await hold(['KeyS', 'KeyD', 'KeyL'], 180);
      await hold(['KeyA'], 700);
      await delay(3500);
      entry.play = await observed();
      console.log(map, width, JSON.stringify({ fps: entry.play.fps, p1: entry.play.events.filter(e => e.actor === 0).map(e => e.type), phase: entry.play.state.phase }));
      if (final) {
        assert.ok(entry.play.fps >= 58, `${map}-${width}: ${entry.play.fps} fps`);
        assert.ok(entry.play.diagnostics.fps >= 58, `${map}-${width}: diagnostics fps`);
      }
      if (final && width === 1366) {
        // Finish one actual P1+3-bot match per map. Acceleration is outside the FPS window.
        await page.evaluate(() => window.__tla.setTimeScale(24));
        await page.waitForFunction(() => window.__tla.state().phase === 'matchover', undefined, { timeout: 90000 });
        await page.getByRole('button', { name: 'Revanche' }).waitFor();
        entry.finished = await state();
        assert.ok(entry.finished.fighters.some(f => f.score === 5));
        if (map === 'roots') await shot('vitoria');
        await page.getByRole('button', { name: 'Revanche' }).click();
        await page.waitForFunction(() => window.__tla.state().phase === 'playing');
        await hold(['KeyD', 'KeyK'], 200);
        entry.rematch = await state();
        assert.equal(entry.rematch.round, 1);
        assert.equal(entry.rematch.timeScale, 1);
        assert.ok(entry.rematch.fighters.every(f => f.score === 0));
        if (map === 'roots') { await delay(600); await shot('revanche-p1'); }
      }
      await keys.press('Escape'); await page.getByRole('button', { name: 'Voltar ao menu' }).click();
    }
  }
  if (final) await shot('menu-apos-revanche');
  // Real pause/mute/controls flow. A held draw must not fire because the pause cleared keys.
  await page.locator('#map [data-value="moss"]').click();
  await page.getByRole('button', { name: 'Começar partida' }).click();
  await page.waitForFunction(() => window.__tla.state().phase === 'playing');
  await observe();
  await keys.down('KeyJ'); await delay(80); await keys.press('Escape');
  const pausedAt = await state(); await delay(220);
  report.checks.pauseFrozen = (await state()).tick === pausedAt.tick;
  await keys.press('KeyM');
  report.checks.mute = { hud: await page.locator('.mute-toggle').getAttribute('aria-pressed'), menu: await page.locator('.overlay-panel button').allTextContents() };
  await shot('pausa-mute');
  await page.getByRole('button', { name: 'Controles', exact: true }).click();
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await keys.press('Escape'); await delay(100);
  report.checks.pauseDraw = await observed();
  await keys.up('KeyJ');
  await keys.press('Escape'); await page.getByRole('button', { name: 'Voltar ao menu' }).click();
  report.checks.menuMute = await page.getByRole('button', { name: /Som (ligado|desligado)/ }).textContent();
  if (final) {
    assert.ok(report.checks.pauseFrozen);
    assert.equal(report.checks.mute.hud, 'true');
    assert.ok(report.checks.mute.menu.includes('Som desligado'));
    assert.equal(report.checks.menuMute, 'Som desligado');
    assert.equal(report.checks.pauseDraw.events.filter(e => e.type === 'shoot' && e.actor === 0).length, 0, 'pause must not release a held shot');
  }
  // Gamepad Start is simulated through the browser Gamepad API (no physical controller claim).
  await page.getByRole('button', { name: 'Começar partida' }).click();
  await page.waitForFunction(() => window.__tla.state().phase === 'playing');
  await page.evaluate(() => { window.testPad = { axes: [1, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) }; });
  const padBefore = await state(); await delay(180);
  report.checks.padMove = (await state()).fighters[0].x - padBefore.fighters[0].x;
  await page.evaluate(() => { window.testPad.buttons[9].pressed = true; });
  await delay(100); report.checks.padPaused = (await state()).paused;
  await page.evaluate(() => { window.testPad.buttons[9].pressed = false; }); await delay(50);
  await page.evaluate(() => { window.testPad.buttons[9].pressed = true; }); await delay(100);
  report.checks.padResumed = !(await state()).paused;
  await page.evaluate(() => { window.testPad = null; });
  assert.ok(report.checks.padMove > .4 && report.checks.padPaused && report.checks.padResumed);
  report.checks.audioFailures = await page.evaluate(() => window.__tla.diagnostics().audioFailures);
  assert.deepEqual(report.checks.audioFailures, []);
  await keys.press('Escape'); await page.getByRole('button', { name: 'Voltar ao menu' }).click();
  assert.deepEqual(report.errors, []);
  await page.close(); await event('close'); report.pagesAtEnd = context.pages().length;
  console.log('CHECKS', JSON.stringify({ pauseFrozen: report.checks.pauseFrozen, mute: report.checks.mute, padMove: report.checks.padMove, padPaused: report.checks.padPaused, padResumed: report.checks.padResumed, errors: report.errors, pagesAtEnd: report.pagesAtEnd }));
} finally {
  if (browser) { await browser.close(); report.pagesAtEnd = 0; await event('browser-closed'); }
  server.kill('SIGTERM');
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
