import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, appendFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

/** Bench-only, one owned page; callers select a deterministic scenario, never fuzz. */
export async function proof(name, run, { story = false } = {}) {
  assert.equal(process.env.DISPLAY, ':80', 'Run through /tmp/tla-prova.sh on tla, with heavy slot');
  const out = 'evidence/rodada-5'; await mkdir(out, { recursive: true });
  const report = { owner: `tla-rodada-5-${name}`, pid: process.pid, errors: [], pagesAtStart: 0, pagesAtEnd: null };
  const event = type => appendFile(`${out}/web-events.ndjson`, JSON.stringify({ owner: report.owner, pid: process.pid, type, bench: 'tla' }) + '\n');
  const server = story
    ? spawn('/usr/bin/python', ['-m', 'http.server', '6107', '--bind', '127.0.0.1', '--directory', 'storybook-static'], { stdio: 'ignore' })
    : spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4176', '--strictPort'], { stdio: 'ignore' });
  let browser;
  try {
    const base = story ? 'http://127.0.0.1:6107/iframe.html' : 'http://127.0.0.1:4176/the-last-arrow-web/';
    let ready = false;
    for (let n = 0; n < 100; n++) { try { if ((await fetch(base)).ok) { ready = true; break; } } catch {} await delay(50); }
    assert.ok(ready, 'server not ready');
    browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`, headless: true,
      args: ['--headless=new', '--autoplay-policy=no-user-gesture-required'] });
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage(); await event('open');
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') report.errors.push(msg.text()); });
    page.on('response', r => { if (r.status() >= 400) report.errors.push(`${r.status()} ${r.url()}`); });
    await run({ page, report, base, out, shot: name => page.screenshot({ path: `${out}/${name}.png` }) });
    assert.deepEqual(report.errors, []);
    await page.close(); await event('close'); report.pagesAtEnd = context.pages().length;
    console.log(name, JSON.stringify(report));
  } finally {
    if (browser) { await browser.close(); report.pagesAtEnd = 0; await event('browser-closed'); }
    server.kill('SIGTERM');
    await writeFile(`${out}/${name}-report.json`, JSON.stringify(report, null, 2));
  }
}
