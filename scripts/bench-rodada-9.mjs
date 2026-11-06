import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, appendFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
export { measure } from './bench-rodada-8.mjs';

export async function proof(name, run, { story = false } = {}) {
  assert.equal(process.env.DISPLAY, ':80');
  const before = process.env.TLA_BEFORE === '1';
  const out = `evidence/rodada-9${before ? '/antes' : ''}`; await mkdir(out, { recursive: true });
  const report = { owner: `tla-rodada-9-${name}`, pid: process.pid, before, errors: [], expectedErrors: [], pagesAtEnd: null };
  const event = type => appendFile(`${out}/web-events.ndjson`, JSON.stringify({ owner: report.owner, pid: process.pid, type, bench: 'tla' }) + '\n');
  const server = story ? spawn('/usr/bin/python', ['-m', 'http.server', '6107', '--bind', '127.0.0.1', '--directory', 'storybook-static'], { stdio: 'ignore' })
    : spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4176', '--strictPort'], { stdio: 'ignore' });
  const base = story ? 'http://127.0.0.1:6107/iframe.html' : 'http://127.0.0.1:4176/the-last-arrow-web/';
  let browser, context;
  let expected = () => false;
  const record = error => (expected(error) ? report.expectedErrors : report.errors).push(error);
  try {
    let ready = false;
    for (let n = 0; n < 100; n++) { try { if ((await fetch(base)).ok) { ready = true; break; } } catch {} await delay(50); }
    assert.ok(ready, 'server ready');
    const executablePath = `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`;
    browser = await chromium.launch({ executablePath, headless: true, ignoreDefaultArgs: ['--enable-automation'], args: ['--remote-debugging-port=19189', '--enable-precise-memory-info'] });
    context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const page = await context.newPage();
    await event('open');
    page.on('pageerror', e => record({ type: 'pageerror', text: e.message }));
    page.on('console', m => { if (m.type() === 'error') record({ type: 'console', text: m.text(), url: m.location().url }); });
    page.on('response', r => { if (r.status() >= 400) record({ type: 'http', text: String(r.status()), url: r.url() }); });
    const cdp = await context.newCDPSession(page);
    await run({ page, cdp, context, report, base, out, before, event, expect: fn => { expected = fn; }, shot: name => page.screenshot({ path: `${out}/${name}.png` }) });
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

// Counts are emitted by Chromium, not a JS wrapper retaining audio nodes/listener targets.
export async function memoryProbe(cdp, page) {
  const nodes = new Map(), contexts = new Set(); let created = 0, destroyed = 0;
  cdp.on('WebAudio.audioNodeCreated', ({ node }) => { nodes.set(node.nodeId, node.nodeType); created++; });
  cdp.on('WebAudio.audioNodeWillBeDestroyed', ({ nodeId }) => { nodes.delete(nodeId); destroyed++; });
  cdp.on('WebAudio.contextCreated', ({ context }) => contexts.add(context.contextId));
  cdp.on('WebAudio.contextWillBeDestroyed', ({ contextId }) => contexts.delete(contextId));
  await cdp.send('WebAudio.enable');
  return async () => {
    await cdp.send('HeapProfiler.collectGarbage'); await delay(200);
    const heap = await cdp.send('Runtime.getHeapUsage');
    const dom = await cdp.send('Memory.getDOMCounters');
    return { heap, dom, audio: { contexts: contexts.size, created, destroyed, live: nodes.size,
      types: [...nodes.values()].reduce((counts, type) => { counts[type] = (counts[type] ?? 0) + 1; return counts; }, {}) },
      ...await page.evaluate(() => ({ diagnostics: window.__tla.diagnostics(), performanceMemory: performance.memory ? { usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize } : null })) };
  };
}
