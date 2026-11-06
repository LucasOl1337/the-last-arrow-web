import { chromium } from 'playwright-core';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, appendFile, writeFile, unlink } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { checkScreen } from './check-screen.mjs';

// Fixed keyboard choreography, not fuzz. Caller holds tla's heavy slot.
// agent-bench launch tla -- env PLAYWRIGHT_BROWSERS_PATH=/home/lol/.cache/ms-playwright TLA_FINAL=1 /tmp/tla-prova.sh scripts/proof-rodada-6.mjs /tmp/tla-rodada-6-final.log
assert.equal(process.env.DISPLAY, ':80', 'Run via /tmp/tla-prova.sh on tla');
const final = process.env.TLA_FINAL === '1';
const out = process.env.TLA_PROOF_DIR ?? (final ? 'evidence/rodada-6' : 'evidence/rodada-6/antes');
await mkdir(out, { recursive: true });
const report = { owner: 'tla-rodada-6', pid: process.pid, final, errors: [], maps: {}, screens: {}, pagesAtStart: 0, pagesAtEnd: null };
const event = type => appendFile(`${out}/web-events.ndjson`, JSON.stringify({ owner: report.owner, pid: process.pid, type, bench: 'tla' }) + '\n');
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4176', '--strictPort'], { stdio: 'ignore' });
const base = 'http://127.0.0.1:4176/the-last-arrow-web/';
let browser;
const listen = page => {
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) report.errors.push(`${r.status()} ${r.url()}`); });
};
const start = async (page, map) => {
  await page.goto(`${base}?seed=3`);
  await page.locator(`#map [data-value="${map}"]`).click();
  await page.getByRole('button', { name: 'Começar partida' }).click();
  await page.waitForFunction(() => window.__tla.diagnostics().models);
  await page.waitForFunction(() => window.__tla.state().phase === 'playing');
  assert.deepEqual(await page.evaluate(() => window.__tla.state().fighters.map(f => f.human)), [true, false, false, false]);
};
const choreograph = async page => {
  const hold = async (keys, ms) => { for (const k of keys) await page.keyboard.down(k); await delay(ms); for (const k of [...keys].reverse()) await page.keyboard.up(k); };
  await hold(['KeyD'], 650);
  await hold(['KeyJ'], 450);
  await hold(['KeyD', 'KeyK'], 300);
  await hold(['KeyD'], 700);
  await hold(['KeyA', 'KeyJ'], 400);
  await hold(['KeyA', 'KeyL'], 180);
  await hold(['KeyA'], 650);
  await hold(['KeyW', 'KeyJ'], 300);
  await hold(['KeyD', 'Space'], 220);
  await hold(['KeyD'], 800);
  await hold(['KeyJ'], 500);
  await hold(['KeyS'], 500);
};
try {
  let ready = false;
  for (let n = 0; n < 100; n++) { try { if ((await fetch(base)).ok) { ready = true; break; } } catch {} await delay(50); }
  assert.ok(ready);
  browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`, headless: true,
    args: ['--headless=new', '--autoplay-policy=no-user-gesture-required'] });
  if (process.env.TLA_POSES !== '1') {
  const videoContext = await browser.newContext({ viewport: { width: 1600, height: 900 }, recordVideo: { dir: `${out}/raw`, size: { width: 1600, height: 900 } } });
  const videoPage = await videoContext.newPage(); await event('open-video'); listen(videoPage);
  await start(videoPage, 'totem');
  await videoPage.evaluate(() => {
    window.videoTrail = []; window.videoEvents = [];
    const w = window.__tla.world, push = w.events.push;
    w.events.push = function (...es) { window.videoEvents.push(...es.map(e => ({ ...e, tick: w.tick }))); return push.apply(this, es); };
    window.videoTimer = setInterval(() => window.videoTrail.push({ tick: w.tick, phase: w.phase, p1: { ...w.fighters[0] }, poses: window.__tla.visuals() }), 100);
  });
  const begin = Date.now();
  await choreograph(videoPage); await choreograph(videoPage);
  await delay(Math.max(0, 12000 - (Date.now() - begin)));
  report.video = await videoPage.evaluate(() => { clearInterval(window.videoTimer); return { trail: window.videoTrail, events: window.videoEvents, diagnostics: window.__tla.diagnostics() }; });
  const video = videoPage.video(); await videoPage.close(); await event('close-video'); await videoContext.close();
  const raw = await video.path();
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-sseof', '-12', '-i', raw, '-t', '12', '-an', '-c:v', 'libx264', '-threads', '2', '-preset', 'fast', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${out}/video-${final ? 'depois' : 'antes'}.mp4`]);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `${out}/video-${final ? 'depois' : 'antes'}.mp4`, '-vf', 'fps=2/3,scale=800:450,tile=4x2', '-frames:v', '1', `${out}/video-frames.jpg`]);
  await unlink(raw); // MP4 and inspected contact sheet are the deliverables, not the duplicate WebM.
  }
  // FPS is measured separately, without video encoding or screenshots in the window.
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage(); await event('open-proof'); listen(page);
  await start(page, 'totem');
  if (final) for (const map of ['moss', 'totem', 'canopy', 'falls', 'roots']) {
    await page.evaluate(map => window.__tla.startMatch({ humans: 1, bots: 3, map, seed: 3 }), map);
    await page.waitForFunction(() => window.__tla.state().phase === 'playing');
    const measurement = page.evaluate(() => new Promise(resolve => {
      const begin = performance.now(); let frames = 0;
      function tick(now) { frames++; if (now - begin >= 6000) resolve({ fps: frames * 1000 / (now - begin), diagnostics: window.__tla.diagnostics(), humans: window.__tla.state().fighters.map(f => f.human) }); else requestAnimationFrame(tick); }
      requestAnimationFrame(tick);
    }));
    await choreograph(page); report.maps[map] = await measurement;
    await page.screenshot({ path: `${out}/${map}-jogo.png` });
    assert.ok(report.maps[map].fps >= 58, `${map}: ${report.maps[map].fps}`);
    assert.ok(report.maps[map].diagnostics.fps >= 58, `${map}: diagnostic FPS`);
    assert.deepEqual(report.maps[map].diagnostics.audioFailures, []);
    console.log(map, report.maps[map].fps);
  }
  // Explicit render fixture: grounded draw, then exact run/jump/fall poses, no fake gameplay claim.
  await page.evaluate(() => {
    window.__tla.startMatch({ humans: 1, bots: 3, map: 'totem', seed: 3 }); window.__tla.setTimeScale(0);
    const w = window.__tla.world; w.phase = 'playing'; w.countdown = 0;
    w.fighters.forEach((f, i) => Object.assign(f, { x: 7 + i * 6, prevX: 7 + i * 6, y: 15.45, prevY: 15.45, grounded: true, vx: 0, vy: 0, invulnerable: 0, charging: true, charge: .5, aimX: i % 2 ? -1 : 1, aimY: 0, facing: i % 2 ? -1 : 1 }));
  });
  await delay(1400);
  report.draw = await page.evaluate(() => window.__tla.visuals());
  await page.screenshot({ path: `${out}/tiro-em-pe.png` });
  if (report.draw[0].headHeight !== undefined) {
    for (const [i, pose] of report.draw.entries()) {
      assert.ok(pose.headHeight > 1.65, `fighter ${i}: crouched shot ${pose.headHeight}`);
      assert.ok(pose.bowDirection[0] * (i % 2 ? -1 : 1) > .35, `fighter ${i}: wrong bow direction`);
      assert.ok(pose.weights.shoot > .99);
    }
    // Exact speed regression on the four real loaded rigs, not random inputs.
    await page.evaluate(() => window.__tla.world.fighters.forEach(f => Object.assign(f, { charging: false, vx: 3.9 })));
    await delay(350);
    report.runHalf = await page.evaluate(() => window.__tla.visuals());
    await page.evaluate(() => window.__tla.world.fighters.forEach(f => { f.vx = 7.8; }));
    await delay(150);
    report.runFull = await page.evaluate(() => window.__tla.visuals());
    for (let i = 0; i < 4; i++) {
      assert.ok(Math.abs(report.runFull[i].animationSpeed / report.runHalf[i].animationSpeed - 2) < .001);
      assert.ok(Math.abs(report.runFull[i].animationSpeed * report.runFull[i].strideSpeed - 7.8) < .001);
    }
    await page.screenshot({ path: `${out}/corrida.png` });
    // Physical jump on an explicit safe initial platform, through the actual P1 keyboard.
    await page.evaluate(() => {
      const api = window.__tla, w = api.world;
      w.fighters.forEach((f, i) => Object.assign(f, { x: 8 + 5 * i, prevX: 8 + 5 * i, y: 15.45, prevY: 15.45, grounded: true, vx: 0, vy: 0, invulnerable: 10, charging: false }));
      api.setTimeScale(1); window.jumpTrail = []; window.captureJump = true;
      function tick() { if (!window.captureJump) return; const f = w.fighters[0]; window.jumpTrail.push({ tick: w.tick, y: f.y, vy: f.vy, grounded: f.grounded, ...api.visuals()[0] }); requestAnimationFrame(tick); } tick();
    });
    await page.keyboard.down('KeyK'); await delay(250); await page.screenshot({ path: `${out}/pulo.png` });
    await page.keyboard.up('KeyK'); await delay(210); await page.screenshot({ path: `${out}/queda.png` });
    await delay(700);
    report.jump = await page.evaluate(() => { window.captureJump = false; return window.jumpTrail; });
    assert.ok(report.jump.some(p => p.state === 'jump'));
    assert.ok(report.jump.some(p => p.state === 'fall'));
    assert.ok(report.jump.some(p => p.state === 'land'));
    assert.ok(report.jump.some(p => p.weights.jump > .05 && p.weights.fall > .05), 'jump/fall must blend separate actions');
    assert.equal(report.jump.at(-1).state, 'idle');
    await page.screenshot({ path: `${out}/pouso.png` });
  }
  for (const [width, height] of [[1366, 768], [900, 1000]]) {
    await page.setViewportSize({ width, height }); await delay(200);
    report.screens[`${width}x${height}`] = await checkScreen(page, '#game');
    await page.screenshot({ path: `${out}/arena-${width}x${height}.png` });
    assert.ok(report.screens[`${width}x${height}`].passou);
  }
  assert.deepEqual(report.errors, []);
  await page.close(); await event('close-proof'); report.pagesAtEnd = context.pages().length;
} finally {
  if (browser) { await browser.close(); report.pagesAtEnd = 0; await event('browser-closed'); }
  server.kill('SIGTERM');
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
console.log('DONE', JSON.stringify({ errors: report.errors, pagesAtEnd: report.pagesAtEnd }));
