import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

// Visual pass proof. Run inside the bench and the heavy queue:
//   agent-bench fila tla rodar -- agent-bench exec tla -- $NODE scripts/visual-proof.mjs
// Serves dist/ with vite preview at the GitHub Pages base, owns its only browser/tab, closes both in finally.
const out = process.env.TLA_PROOF_DIR ?? 'evidence/visual-1';
const quick = process.argv.includes('--quick');
await mkdir(out, { recursive: true });
const port = 4174;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
const report = { owner: 'tla-visual-1', viewport: '1600x900', errors: [], warnings: [], maps: {}, pagesAtEnd: null };
let browser;
try {
  const base = `http://127.0.0.1:${port}/the-last-arrow-web/`;
  for (let n = 0; n < 100; n++) { try { if ((await fetch(base)).ok) break; } catch {} await delay(50); }
  browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`, headless: true,
    args: ['--headless=new', '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') report.errors.push(msg.text()); else if (msg.type() === 'warning' && !/GPU stall|GL Driver/.test(msg.text())) report.warnings.push(msg.text()); });
  page.on('response', r => { if (r.status() >= 400) report.errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(`${base}?autoplay=bots4&seed=3`);
  await page.waitForFunction(() => window.__tla?.diagnostics().models === true, undefined, { timeout: 30000 });
  const maps = quick ? ['moss'] : ['moss', 'totem', 'canopy'];
  for (const map of maps) {
    const entry = report.maps[map] = { shots: [], states: [] };
    await page.evaluate(map => window.__tla.startMatch({ humans: 0, bots: 4, map, seed: 3 }), map);
    await page.waitForFunction(() => window.__tla.state().phase === 'playing', undefined, { timeout: 10000 });
    // Spread captures over the round: running, jumping, aiming, kills.
    for (const [i, wait] of [600, 1400, 2300, 3400].entries()) {
      await delay(i === 0 ? wait : wait - [600, 1400, 2300, 3400][i - 1]);
      const file = `${out}/${map}-${i + 1}.png`;
      await page.screenshot({ path: file });
      const s = await page.evaluate(() => {
        const w = window.__tla.world;
        return { tick: w.tick, phase: w.phase, round: w.round, fighters: w.fighters.map(f => ({ x: +f.x.toFixed(2), y: +f.y.toFixed(2), vx: +f.vx.toFixed(1), vy: +f.vy.toFixed(1), grounded: f.grounded, charging: f.charging, alive: f.alive, facing: f.facing })) };
      });
      entry.shots.push(file); entry.states.push(s);
    }
    // 60 fps check at 1600x900: frames are only counted at timeScale 1 while unpaused.
    await page.evaluate(map => window.__tla.startMatch({ humans: 0, bots: 4, map, seed: 5 }), map);
    await page.waitForFunction(() => window.__tla.diagnostics().frames >= 360, undefined, { timeout: 30000 });
    entry.performance = await page.evaluate(() => window.__tla.diagnostics());
  }
  // Close-up pose sheet: freeze the sim and pose fighters through the test hook (render only reads state).
  await page.evaluate(() => {
    window.__tla.startMatch({ humans: 0, bots: 4, map: 'moss', seed: 3 });
    window.__tla.setTimeScale(0);
    const w = window.__tla.world; w.phase = 'playing';
    const ground = 15.45; // standing on the bottom-left floor (row 16)
    const pose = (f, o) => Object.assign(f, { prevX: o.x, prevY: o.y, vx: 0, vy: 0, grounded: true, charging: false, alive: true, invulnerable: 0, dashTime: 0, ...o });
    pose(w.fighters[0], { x: 3, y: ground, facing: 1, aimX: 0.7071, aimY: -0.7071, charging: true, charge: 0.5 });
    pose(w.fighters[1], { x: 6.5, y: ground, facing: -1, aimX: -1, aimY: 0, vx: -7.8 });
    pose(w.fighters[2], { x: 25, y: ground, facing: -1, aimX: -1, aimY: 0, charging: true, charge: 0.4 });
    pose(w.fighters[3], { x: 28.5, y: ground - 1.6, facing: 1, aimX: 1, aimY: 0, grounded: false, vy: -8 });
  });
  await delay(900);
  await page.screenshot({ path: `${out}/poses.png` });
  await page.evaluate(() => { const f = window.__tla.world.fighters[1]; f.alive = false; });
  await delay(350);
  await page.screenshot({ path: `${out}/death.png` });
  await page.evaluate(() => window.__tla.setTimeScale(1));
  report.stateDistribution = await page.evaluate(async () => {
    // Sample poses for 6 s of real play to prove run/jump/fall/shoot all occur.
    window.__tla.startMatch({ humans: 0, bots: 4, map: 'moss', seed: 11 });
    const counts = { run: 0, jump: 0, fall: 0, shoot: 0, idle: 0 };
    const t0 = performance.now();
    while (performance.now() - t0 < 6000) {
      for (const f of window.__tla.world.fighters) {
        if (!f.alive) continue;
        if (f.charging) counts.shoot++; else if (!f.grounded) counts[f.vy < 0 ? 'jump' : 'fall']++; else counts[Math.abs(f.vx) > 0.6 ? 'run' : 'idle']++;
      }
      await new Promise(r => setTimeout(r, 50));
    }
    return counts;
  });
  for (const map of maps) {
    const p = report.maps[map].performance;
    assert.ok(p.models, `${map}: modelos 3D não carregaram`);
    assert.ok(p.fps >= 58, `${map}: ${p.fps.toFixed(1)} fps`);
  }
  assert.deepEqual(report.errors, []);
  await page.close(); report.pagesAtEnd = context.pages().length;
  console.log(JSON.stringify({ maps: Object.fromEntries(Object.entries(report.maps).map(([k, v]) => [k, v.performance])), states: report.stateDistribution, warnings: report.warnings.slice(0, 5) }, null, 1));
} finally {
  if (browser) await browser.close(); server.kill('SIGTERM');
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
