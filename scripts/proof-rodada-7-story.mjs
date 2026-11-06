import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { appendFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { checkScreen } from './check-screen.mjs';
assert.equal(process.env.DISPLAY, ':80');
const out = 'evidence/rodada-7', report = { owner: 'tla-rodada-7-story', errors: [], screens: {}, pagesAtEnd: null };
const event = type => appendFile(`${out}/web-events.ndjson`, JSON.stringify({ owner: report.owner, pid: process.pid, type, bench: 'tla' }) + '\n');
const server = spawn('/usr/bin/python', ['-m', 'http.server', '6107', '--bind', '127.0.0.1', '--directory', 'storybook-static'], { stdio: 'ignore' });
let browser, context;
try {
  const base = 'http://127.0.0.1:6107/iframe.html';
  for (let n = 0; n < 100; n++) { try { if ((await fetch(base)).ok) break; } catch {} await delay(50); }
  browser = await chromium.connectOverCDP('http://127.0.0.1:19080'); context = await browser.newContext();
  const page = await context.newPage(); await event('open');
  page.on('pageerror', e => report.errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) report.errors.push(`${r.status()} ${r.url()}`); });
  for (const [id, selector] of [['arena-menu-real--configuracao', '.menu-content'], ['arena-hud-real--headhunter-leve', '#game'], ['arena-menu-real--vitoria-headhunter', '.overlay-panel'], ['arena-menu-real--empate-headhunter', '.overlay-panel']]) {
    await page.goto(`${base}?id=${id}&viewMode=story`); await page.locator(selector).waitFor();
    if (id.endsWith('configuracao')) await page.locator('#rules').selectOption('headhunter');
    for (const [width, height] of [[1366,768],[900,1000],[844,390]]) {
      await page.setViewportSize({ width, height }); await delay(200);
      const key = `${id}-${width}x${height}`;
      report.screens[key] = await checkScreen(page, selector);
      // Short result dialogs intentionally occupy less than 40%; no main editor.
      if (selector !== '.overlay-panel') assert.ok(report.screens[key].passou, key);
      if (selector === '.overlay-panel') {
        const button = await page.getByRole('button', { name: 'Revanche' }).boundingBox();
        assert.ok(button.y >= 0 && button.y + button.height <= height, 'result CTA inside viewport');
        if (id.includes('empate')) assert.equal(await page.locator('.victory-stats').count(), 0);
      }
      if (selector === '.menu-content') {
        const rect = await page.getByRole('button', { name: 'Começar partida' }).boundingBox();
        assert.ok(rect.y >= 0 && rect.y + rect.height <= height, 'CTA inside viewport');
      }
      if (id.includes('hud')) { assert.match(await page.locator('.arena-footer').textContent(), /94s/); await page.locator('.quality-notice').waitFor(); }
      await page.screenshot({ path: `${out}/story-${key}.png` });
    }
  }
  assert.deepEqual(report.errors, []);
} finally { if (context) await context.close(); if (browser) await browser.close(); await event('close'); report.pagesAtEnd = 0; server.kill(); await writeFile(`${out}/story-report.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report));
