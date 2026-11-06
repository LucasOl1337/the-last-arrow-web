import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

// Rodada 2 proof (legibility + feel). Run inside the bench and the heavy queue:
//   agent-bench fila tla rodar -- agent-bench exec tla -- $NODE scripts/proof-rodada-2.mjs
// Serves dist/ at the Pages base; owns its only browser and closes it in finally.
const out = process.env.TLA_PROOF_DIR ?? 'evidence/rodada-2';
await mkdir(out, { recursive: true });
const port = 4175;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
const report = { owner: 'tla-rodada-2', viewport: '1600x900', errors: [], maps: {}, pagesAtEnd: null };
let browser;
try {
  const base = `http://127.0.0.1:${port}/the-last-arrow-web/`;
  for (let n = 0; n < 100; n++) { try { if ((await fetch(base)).ok) break; } catch {} await delay(50); }
  browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`, headless: true,
    args: ['--headless=new', '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') report.errors.push(msg.text()); });
  page.on('response', r => { if (r.status() >= 400) report.errors.push(`${r.status()} ${r.url()}`); });
  const shot = name => page.screenshot({ path: `${out}/${name}.png` });
  for (const map of ['moss', 'totem', 'canopy']) {
    const entry = report.maps[map] = {};
    await page.goto(`${base}?autoplay=bots4&map=${map}&seed=3`);
    await page.waitForFunction(() => window.__tla?.diagnostics().models === true, undefined, { timeout: 30000 });
    // Restart so the round starts after models loaded; catch the big countdown digit.
    await page.evaluate(map => window.__tla.startMatch({ humans: 0, bots: 4, map, seed: 3 }), map);
    await page.waitForFunction(() => window.__tla.state().countdown === 2, undefined, { timeout: 5000 });
    if (map === 'moss') await shot('countdown');
    await page.waitForFunction(() => window.__tla.state().phase === 'playing', undefined, { timeout: 10000 });
    await delay(1200); await shot(`${map}-autoplay`);
    // Freeze on the first bot that charges, to show the dotted arc and nocked arrow.
    entry.aim = await page.evaluate(() => new Promise(resolve => {
      const t0 = performance.now();
      const tick = () => {
        const f = window.__tla.world.fighters.find(f => f.alive && f.charging && f.charge > 0.12);
        if (f) { window.__tla.setTimeScale(0); resolve({ id: f.id, aimX: f.aimX, aimY: f.aimY }); }
        else if (performance.now() - t0 > 15000) resolve(null); else requestAnimationFrame(tick);
      };
      tick();
    }));
    await delay(250); await shot(`${map}-mira`);
    await page.evaluate(() => window.__tla.setTimeScale(1));
    // Fixed scene: everyone frozen, standing — the reference legibility frame.
    await page.evaluate(() => {
      const w = window.__tla.world; window.__tla.setTimeScale(0);
      w.fighters.forEach(f => Object.assign(f, { charging: false, vx: 0, invulnerable: 0 }));
    });
    await delay(300); await shot(`${map}-parado`);
    // 60 fps at 1600x900 in real play.
    await page.evaluate(map => { window.__tla.setTimeScale(1); window.__tla.startMatch({ humans: 0, bots: 4, map, seed: 5 }); }, map);
    await page.waitForFunction(() => window.__tla.diagnostics().frames >= 360, undefined, { timeout: 30000 });
    entry.performance = await page.evaluate(() => window.__tla.diagnostics());
  }
  // Close-up: pose sheet with charging aim (diagonal) to inspect height vs hitbox, outline and rim.
  await page.evaluate(() => {
    window.__tla.startMatch({ humans: 0, bots: 4, map: 'totem', seed: 3 }); window.__tla.setTimeScale(0);
    const w = window.__tla.world; w.phase = 'playing'; w.countdown = 0;
    const lv = w.level, floor = [];
    // Find standing spots: empty tile above a solid tile on the lowest rows.
    for (let y = 16; y >= 10 && floor.length < 4; y--) for (let x = 2; x < 30 && floor.length < 4; x += 7) {
      const row = lv.rows[y + 1] ?? '', here = lv.rows[y] ?? '';
      if (row[x] === '#' && here[x] === '.' && (lv.rows[y - 1] ?? '.')[x] === '.') floor.push({ x: x + 0.5, y: y + 1 - 0.55 });
    }
    const aims = [[0.7071, -0.7071, true], [-1, 0, false], [1, 0, true], [-0.7071, -0.7071, true]];
    w.fighters.forEach((f, n) => { const p = floor[n] ?? { x: 4 + n * 7, y: 15.45 }; const [ax, ay, charging] = aims[n];
      Object.assign(f, { x: p.x, y: p.y, prevX: p.x, prevY: p.y, vx: 0, vy: 0, grounded: true, alive: true, invulnerable: 0, dashTime: 0, facing: Math.sign(ax), aimX: ax, aimY: ay, charging, charge: 0.5 }); });
    window.__poseSpots = floor;
  });
  await delay(800); await shot('poses-templo');
  // Kill camera: real play, freeze at the first kill to show push-in + slow motion.
  await page.evaluate(() => { window.__tla.setTimeScale(1); window.__tla.startMatch({ humans: 0, bots: 4, map: 'canopy', seed: 21 }); });
  report.kill = await page.evaluate(() => new Promise(resolve => {
    const t0 = performance.now();
    const tick = () => { const w = window.__tla.world;
      if (w.fighters.some(f => !f.alive)) { setTimeout(() => { window.__tla.setTimeScale(0.02); resolve({ tick: w.tick }); }, 180); }
      else if (performance.now() - t0 > 25000) resolve(null); else requestAnimationFrame(tick); };
    tick();
  }));
  await delay(100); await shot('abate-zoom');
  // Round-over card with score dots.
  await page.evaluate(() => window.__tla.setTimeScale(6));
  await page.waitForFunction(() => window.__tla.state().phase === 'roundover', undefined, { timeout: 20000 });
  await page.evaluate(() => window.__tla.setTimeScale(0)); await delay(700); await shot('fim-de-round');
  // Victory screen with portrait, logo and stats.
  await page.evaluate(() => window.__tla.setTimeScale(24));
  await page.waitForFunction(() => window.__tla.state().phase === 'matchover', undefined, { timeout: 30000 });
  await page.getByRole('heading', { name: /venceu|Empate/ }).waitFor(); await delay(300); await shot('vitoria');
  report.victoryText = await page.locator('.victory-panel').innerText();
  // Mute: M toggles inside the game.
  await page.goto(`${base}?autoplay=bots4&seed=3`);
  await page.waitForFunction(() => window.__tla?.state().phase === 'playing', undefined, { timeout: 20000 });
  await page.keyboard.press('m');
  report.muteAfterM = await page.locator('.mute-toggle').getAttribute('aria-pressed');
  assert.equal(report.muteAfterM, 'true');
  // Menu: portraits, map thumbnails and difficulty buttons; keyboard picks.
  await page.goto(`${base}?seed=7`);
  await page.getByRole('button', { name: 'Começar partida' }).waitFor(); await delay(500);
  await page.getByRole('radio', { name: 'Akane' }).first().click();
  await page.getByRole('radio', { name: 'Templo do Totem' }).click();
  await page.getByRole('radio', { name: /Difícil/ }).click();
  await shot('menu');
  await page.getByRole('button', { name: 'Começar partida' }).click();
  await page.waitForFunction(() => window.__tla.state().phase === 'playing');
  report.menuPick = await page.evaluate(() => ({ map: window.__tla.world.level.id, difficulty: window.__tla.world.options.difficulty, p1: window.__tla.world.fighters[0].character }));
  assert.deepEqual(report.menuPick, { map: 'totem', difficulty: 'hard', p1: 3 });
  await page.close();
  // Phone (landscape, touch): note in the menu and the virtual pad over the arena.
  const phone = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const mp = await phone.newPage(); mp.on('pageerror', e => report.errors.push(`mobile: ${e.message}`));
  await mp.goto(`${base}?seed=7`); await mp.getByRole('button', { name: 'Começar partida' }).waitFor();
  report.touchNote = await mp.locator('.touch-note').innerText();
  await mp.getByRole('button', { name: 'Começar partida' }).click();
  await mp.waitForFunction(() => window.__tla.state().phase === 'playing', undefined, { timeout: 20000 });
  const jumpBox = await mp.locator('.touch-btn.jump').boundingBox();
  await mp.touchscreen.tap(jumpBox.x + 20, jumpBox.y + 20);
  await delay(400); await mp.screenshot({ path: `${out}/celular-toque.png` });
  await mp.close(); await phone.close();
  for (const map of Object.keys(report.maps)) {
    const p = report.maps[map].performance;
    assert.ok(p.models, `${map}: modelos 3D não carregaram`);
    assert.ok(p.fps >= 58, `${map}: ${p.fps.toFixed(1)} fps`);
  }
  assert.deepEqual(report.errors, []);
  report.pagesAtEnd = context.pages().length;
  console.log(JSON.stringify({ fps: Object.fromEntries(Object.entries(report.maps).map(([k, v]) => [k, +v.performance.fps.toFixed(2)])), kill: report.kill, victory: report.victoryText, menu: report.menuPick, touch: report.touchNote }, null, 1));
} finally {
  if (browser) await browser.close(); server.kill('SIGTERM');
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
