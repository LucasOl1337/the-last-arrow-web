import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { writeFile, appendFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
assert.equal(process.env.DISPLAY, ':80');
const out = 'evidence/rodada-7', report = { owner: 'tla-rodada-7-quality', errors: [], cpuThrottle: 4, viewport: { width: 3840, height: 2160 }, deviceScaleFactor: 2, pagesAtEnd: null };
const event = type => appendFile(`${out}/web-events.ndjson`, JSON.stringify({ owner: report.owner, pid: process.pid, type, bench: 'tla' }) + '\n');
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4176', '--strictPort'], { stdio: 'ignore' });
const url = 'http://127.0.0.1:4176/the-last-arrow-web/';
let browser;
try {
  for (let n = 0; n < 100; n++) { try { if ((await fetch(url)).ok) break; } catch {} await delay(50); }
  browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`, headless: true,
    ignoreDefaultArgs: ['--enable-automation'], args: ['--remote-debugging-port=19187', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: report.viewport, deviceScaleFactor: report.deviceScaleFactor }); await event('open');
  page.on('pageerror', e => report.errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) report.errors.push(`${r.status()} ${r.url()}`); });
  const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(url); await page.locator('#map [data-value="totem"]').click(); await page.locator('#difficulty [data-value="hard"]').click();
  await page.getByRole('button', { name: 'Começar partida' }).click();
  await page.waitForFunction(() => window.__tla.diagnostics().models);
  await page.waitForFunction(() => window.__tla.diagnostics().quality.decided);
  report.decision = await page.evaluate(() => window.__tla.diagnostics());
  await delay(1000);
  const measure = page.evaluate(() => new Promise(resolve => { let begin, frames = 0, maxGap = 0, last;
    function frame(now) { if (begin === undefined) begin = now; else { frames++; maxGap = Math.max(maxGap, now-last); } last=now;
      if (now-begin >= 8000) resolve({ fps: frames*1000/(now-begin), maxGap, diagnostics: window.__tla.diagnostics() }); else requestAnimationFrame(frame);
    } requestAnimationFrame(frame);
  }));
  for (const keys of [['KeyD','KeyK'],['KeyA','KeyJ'],['KeyD','KeyL'],['KeyW','KeyJ']]) {
    for (const key of keys) await page.keyboard.down(key); await delay(350); for (const key of [...keys].reverse()) await page.keyboard.up(key); await delay(400);
  }
  report.after = await measure;
  await page.screenshot({ path: `${out}/cpu4-4k-leve.png`, scale: 'css' });
  assert.equal(report.decision.quality.level, 'low'); assert.ok(report.decision.quality.detectedFps < 50);
  assert.equal(report.decision.quality.bloom, false); assert.ok(report.decision.quality.pixelRatio < 1.5);
  assert.ok(report.after.fps >= 45, `low quality: ${report.after.fps}`);
  // Rematch+resize retains safe quality, with readable DOM and unchanged models.
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(() => window.__tla.startMatch({ humans: 1, bots: 3, map: 'totem', seed: 3 })); await delay(2400);
  report.rematch = await page.evaluate(() => window.__tla.diagnostics()); assert.equal(report.rematch.quality.level, 'low');
  await page.screenshot({ path: `${out}/cpu4-leve-1600.png`, scale: 'css' });
  assert.deepEqual(report.errors, []);
} finally { if (browser) await browser.close(); await event('close'); report.pagesAtEnd = 0; server.kill(); await writeFile(`${out}/quality-report.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report));
