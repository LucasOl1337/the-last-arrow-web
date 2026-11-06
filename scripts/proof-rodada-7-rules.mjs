import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { writeFile, appendFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
assert.equal(process.env.DISPLAY, ':80');
const out = 'evidence/rodada-7', report = { owner: 'tla-rodada-7-rules', errors: [], cases: {}, pagesAtEnd: null };
const event = type => appendFile(`${out}/web-events.ndjson`, JSON.stringify({ owner: report.owner, pid: process.pid, type, bench: 'tla' }) + '\n');
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4176', '--strictPort'], { stdio: 'ignore' });
const base = 'http://127.0.0.1:4176/the-last-arrow-web/';
let browser;
try {
  for (let n = 0; n < 100; n++) { try { if ((await fetch(base)).ok) break; } catch {} await delay(50); }
  browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`, headless: true,
    ignoreDefaultArgs: ['--enable-automation'], args: ['--remote-debugging-port=19187', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } }); await event('open');
  page.on('pageerror', e => report.errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) report.errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(base); await page.getByRole('button', { name: 'Começar partida' }).click(); await page.waitForFunction(() => window.__tla.diagnostics().models);
  // Explicit initial fixtures on real map, then normal sim+keyboard. No claim of spontaneous encounters.
  const setup = async name => page.evaluate(name => {
    const api = window.__tla; api.startMatch({ humans: 1, bots: 3, map: 'totem', mode: name === 'draw' ? 'headhunter' : 'versus', seed: 3, difficulty: 'hard' });
    api.setTimeScale(0); const w = api.world; w.phase = 'playing'; w.countdown = 0; w.chestTimer = 12;
    window.caseEvents = []; const push = w.events.push;
    w.events.push = function (...es) { window.caseEvents.push(...es.map(e => ({ ...e, tick: w.tick }))); return push.apply(this, es); };
    w.fighters.forEach((f, i) => Object.assign(f, { x: 3 + i * 8, prevX: 3 + i * 8, y: 1, prevY: 1, invulnerable: i ? 10 : 0 }));
    const f = w.fighters[0];
    if (name === 'bolt' || name === 'bomb') {
      Object.assign(f, { x: 8.5, prevX: 8.5, y: 7.5, prevY: 7.5, vx: 0, vy: 0, ammo: 0, inventory: [], facing: 1, aimX: 1, aimY: 0 });
      w.chests = [{ id: 99, x: f.x, y: f.y, reward: [name] }];
      if (name === 'bomb') Object.assign(w.fighters[1], { x: 9.5, prevX: 9.5, y: 7.5, prevY: 7.5, invulnerable: 0 });
    } else if (name === 'stomp') {
      Object.assign(f, { x: 8, prevX: 8, y: 14.1, prevY: 14.1, vy: 15 });
      Object.assign(w.fighters[1], { x: 8, prevX: 8, y: 15.45, prevY: 15.45, grounded: true, invulnerable: 0, vx: 0, vy: 0 });
    } else if (name === 'expiry') {
      Object.assign(f, { x: 9.68, prevX: 9.68, y: 7.5, prevY: 7.5, ammo: 2, inventory: ['normal','normal'] });
      w.arrows = [{ id: 42, owner: 0, x: 10.4, y: 7.5, vx: 23, vy: 0, angle: 0, age: 7, stuck: false, kind: 'bolt', lastFreeX: 9.99, lastFreeY: 7.5 }];
    } else if (name === 'draw') { w.matchTime = 120 - 1/120; w.fighters.forEach(f => { f.score = 3; }); }
    api.setTimeScale(1);
  }, name);
  const onlyDraw = process.env.TLA_ONLY_DRAW === '1';
  for (const name of (onlyDraw ? ['draw'] : ['bolt','bomb','stomp','expiry','draw'])) {
    await setup(name);
    if (name === 'bolt' || name === 'bomb') {
      await page.waitForFunction(() => window.caseEvents.some(e => e.type === 'chest-open'));
      await page.keyboard.down('KeyJ'); await delay(30); await page.keyboard.up('KeyJ');
      await page.waitForFunction(() => window.caseEvents.some(e => e.type === 'shoot'));
      if (name === 'bolt') await delay(100); else await page.waitForFunction(() => window.caseEvents.some(e => e.type === 'explosion'));
    } else if (name === 'stomp') await page.waitForFunction(() => window.caseEvents.some(e => e.cause === 'stomp'));
    else if (name === 'expiry') await page.waitForFunction(() => window.caseEvents.some(e => e.type === 'pickup' && e.kind === 'bolt'));
    else await page.waitForFunction(() => window.__tla.state().phase === 'matchover');
    await page.evaluate(() => window.__tla.setTimeScale(0));
    report.cases[name] = await page.evaluate(() => ({ state: window.__tla.state(), events: window.caseEvents, text: document.querySelector('.menu-layer').hidden ? '' : document.querySelector('.menu-layer').textContent }));
    await page.screenshot({ path: `${out}/regressao-${name}.png` });
  }
  if (!onlyDraw) {
  assert.equal(report.cases.bolt.events.find(e => e.type === 'shoot').kind, 'bolt');
  assert.ok(report.cases.bolt.state.arrows.some(a => a.kind === 'bolt' && a.x > 10 && !a.stuck), 'bolt crosses Totem wall');
  assert.equal(report.cases.bomb.events.filter(e => e.type === 'explosion').length, 1);
  assert.ok(report.cases.bomb.events.some(e => e.type === 'kill' && e.cause === 'bomb'));
  assert.ok(report.cases.stomp.events.some(e => e.type === 'kill' && e.cause === 'stomp' && e.actor === 0));
  assert.ok(report.cases.expiry.state.fighters[0].inventory.includes('bolt'));
  }
  assert.equal(report.cases.draw.state.winner, null); assert.match(report.cases.draw.text, /Empate em abates/);
  assert.equal(await page.locator('.victory-stats').count(), 0);
  assert.deepEqual(report.errors, []);
} finally { if (browser) await browser.close(); await event('close'); report.pagesAtEnd = 0; server.kill(); await writeFile(`${out}/${process.env.TLA_ONLY_DRAW === '1' ? 'draw-' : ''}rules-report.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ errors: report.errors, cases: Object.keys(report.cases), pagesAtEnd: report.pagesAtEnd }));
