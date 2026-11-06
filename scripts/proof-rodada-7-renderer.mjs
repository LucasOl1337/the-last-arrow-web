import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { writeFile, appendFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
assert.equal(process.env.DISPLAY, ':80');
const out = 'evidence/rodada-7', result = { errors: [], renderers: [], pagesAtEnd: null };
const isolated = process.env.TLA_ISOLATED === '1', vulkan = process.env.TLA_VULKAN === '1';
const event = type => appendFile(`${out}/web-events.ndjson`, JSON.stringify({ owner: 'tla-rodada-7-renderer', pid: process.pid, type, bench: 'tla' }) + '\n');
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4176', '--strictPort'], { stdio: 'ignore' });
const url = 'http://127.0.0.1:4176/the-last-arrow-web/';
try {
  for (let n = 0; n < 100; n++) { try { if ((await fetch(url)).ok) break; } catch {} await delay(50); }
  for (const kind of (vulkan ? ['headed-vulkan'] : isolated ? ['isolated-render'] : ['bench-chromium', 'private-chrome'])) {
    let browser, context;
    try {
      browser = kind === 'bench-chromium' ? await chromium.connectOverCDP('http://127.0.0.1:19080') : await chromium.launch({
        executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`, headless: isolated,
        ignoreDefaultArgs: ['--enable-automation'], args: ['--remote-debugging-port=19187', '--ozone-platform=x11', '--autoplay-policy=no-user-gesture-required', ...(vulkan ? ['--use-angle=vulkan'] : [])] });
      context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
      const page = await context.newPage(); await event(`open-${kind}`);
      page.on('pageerror', e => result.errors.push(e.message));
      await page.goto(url); await page.getByRole('button', { name: 'Começar partida' }).click();
      await page.waitForFunction(() => window.__tla.diagnostics().models); await delay(2000);
      const info = await page.evaluate(() => {
        const gl = document.querySelector('canvas').getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info');
        return { renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL), vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL), dpr: devicePixelRatio, visibility: document.visibilityState };
      });
      const cdp = await context.newCDPSession(page);
      for (const rate of [1, 4]) {
        await cdp.send('Emulation.setCPUThrottlingRate', { rate });
        await page.evaluate(() => window.__tla.startMatch({ humans: 1, bots: 3, map: 'totem', difficulty: 'hard', seed: 3 }));
        await delay(3000);
        const metrics = await page.evaluate(() => new Promise(resolve => { let begin, n = 0; function frame(t) { if (begin === undefined) begin = t; else n++; if (t - begin >= 5000) resolve({ fps: n * 1000 / (t - begin), diagnostics: window.__tla.diagnostics() }); else requestAnimationFrame(frame); } requestAnimationFrame(frame); }));
        result.renderers.push({ kind, rate, ...info, ...metrics });
      }
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    } finally { if (context) await context.close(); if (browser) await browser.close(); await event(`close-${kind}`); }
  }
} finally { server.kill(); result.pagesAtEnd = 0; await writeFile(`${out}/${vulkan ? 'vulkan-' : isolated ? 'isolated-' : 'adaptive-'}renderer-report.json`, JSON.stringify(result, null, 2)); }
console.log(JSON.stringify(result));
