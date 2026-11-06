import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, appendFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

// All visual work is isolated on tla, invoked by /tmp/tla-prova.sh with a heavy slot.
export async function proof(name, run, { dev = false, story = false, mobile = false, before = false } = {}) {
  assert.equal(process.env.DISPLAY, ':80');
  const out = `evidence/rodada-8${before ? '/antes' : ''}`; await mkdir(out, { recursive: true });
  const report = { owner: `tla-rodada-8-${name}`, pid: process.pid, errors: [], pagesAtEnd: null };
  const event = type => appendFile(`${out}/web-events.ndjson`, JSON.stringify({ owner: report.owner, pid: process.pid, type, bench: 'tla' }) + '\n');
  const server = story ? spawn('/usr/bin/python', ['-m', 'http.server', '6107', '--bind', '127.0.0.1', '--directory', 'storybook-static'], { stdio: 'ignore' })
    : spawn(process.execPath, ['node_modules/vite/bin/vite.js', ...(dev ? [] : ['preview']), '--host', '127.0.0.1', '--port', '4176', '--strictPort'], { stdio: 'ignore' });
  const base = story ? 'http://127.0.0.1:6107/iframe.html' : 'http://127.0.0.1:4176/the-last-arrow-web/';
  let browser, context;
  try {
    let ready = false;
    for (let n = 0; n < 100; n++) { try { if ((await fetch(base)).ok) { ready = true; break; } } catch {} await delay(50); }
    assert.ok(ready, 'server ready');
    browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`, headless: true,
      ignoreDefaultArgs: ['--enable-automation'], args: ['--remote-debugging-port=19188'] });
    context = await browser.newContext({ viewport: mobile ? { width: 844, height: 390 } : { width: 1600, height: 900 }, hasTouch: mobile, isMobile: mobile });
    const page = await context.newPage(); await event('open');
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) report.errors.push(`${r.status()} ${r.url()}`); });
    const cdp = await context.newCDPSession(page);
    await run({ page, cdp, context, report, base, out, shot: name => page.screenshot({ path: `${out}/${name}.png` }) });
    assert.deepEqual(report.errors, []);
  } catch (e) { report.failure = String(e.stack); throw e; }
  finally {
    if (context) { await context.close(); await event('close'); }
    if (browser) await browser.close();
    report.pagesAtEnd = 0; server.kill('SIGTERM');
    await writeFile(`${out}/${name}-report.json`, JSON.stringify(report, null, 2));
  }
  console.log(name, JSON.stringify(report));
}

// Real CDP touch points (not dispatchEvent); keep both contacts active for move+shoot.
export function fingers(cdp) {
  const points = new Map();
  const send = type => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...points].map(([id, p]) => ({ id, ...p, radiusX: 5, radiusY: 5, force: 1 })) });
  return {
    async down(id, x, y) { points.set(id, { x, y }); await send('touchStart'); },
    async move(id, x, y) { points.set(id, { x, y }); await send('touchMove'); },
    async up(id) {
      // CDP touchEnd takes the contacts being released, not the contacts remaining.
      const point = points.get(id);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ id, ...point }] });
      points.delete(id);
    },
    async cancel() { points.clear(); await send('touchCancel'); },
  };
}
export const center = async locator => { const r = await locator.boundingBox(); assert.ok(r); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
export const measure = (page, ms = 6000) => page.evaluate(ms => new Promise(resolve => {
  let begin, last, frames = 0, maxGap = 0;
  const tick = now => { if (begin === undefined) { begin = last = now; requestAnimationFrame(tick); return; }
    frames++; maxGap = Math.max(maxGap, now - last); last = now;
    if (now - begin >= ms) resolve({ fps: frames * 1000 / (now - begin), maxGap, diagnostics: window.__tla.diagnostics() }); else requestAnimationFrame(tick);
  }; requestAnimationFrame(tick);
}), ms);
export async function instrument(page) {
  await page.evaluate(() => {
    const w = window.__tla.world; window.events8 = []; const push = w.events.push;
    w.events.push = function (...es) { window.events8.push(...es.map(e => ({ ...e, tick: w.tick, at: performance.now() }))); return push.apply(this, es); };
  });
}
