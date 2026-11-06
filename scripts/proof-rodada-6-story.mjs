import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { appendFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { checkScreen } from './check-screen.mjs';
assert.equal(process.env.DISPLAY, ':80');
const out = 'evidence/rodada-6', report = { owner: 'tla-rodada-6-story', pid: process.pid, errors: [], screens: {}, pagesAtStart: 0, pagesAtEnd: null };
const event = type => appendFile(`${out}/web-events.ndjson`, JSON.stringify({ owner: report.owner, pid: process.pid, type, bench: 'tla' }) + '\n');
const server = spawn('/usr/bin/python', ['-m', 'http.server', '6107', '--bind', '127.0.0.1', '--directory', 'storybook-static'], { stdio: 'ignore' });
let browser;
try {
  const base = 'http://127.0.0.1:6107/iframe.html';
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(base)).ok) { ready = true; break; } } catch {} await delay(50); }
  assert.ok(ready);
  browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`, headless: true, args: ['--headless=new'] });
  const page = await browser.newPage(); await event('open');
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) report.errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(`${base}?id=arena-animacao-real--tiro-em-pe&viewMode=story`);
  await page.locator('#game[data-models="true"]').waitFor();
  for (const [width, height] of [[1366, 768], [900, 1000], [844, 390]]) {
    await page.setViewportSize({ width, height }); await delay(300);
    report.screens[`${width}x${height}`] = await checkScreen(page, '#game');
    assert.ok(report.screens[`${width}x${height}`].passou);
    await page.screenshot({ path: `${out}/story-${width}x${height}.png` });
  }
  assert.deepEqual(report.errors, []);
  await page.close(); await event('close');
} finally {
  if (browser) { await browser.close(); report.pagesAtEnd = 0; await event('browser-closed'); }
  server.kill('SIGTERM'); await writeFile(`${out}/story-report.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report));
