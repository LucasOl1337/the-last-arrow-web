import { chromium } from 'playwright-core';
import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { checkScreen } from './check-screen.mjs';
const out = process.env.TLA_EVIDENCE ?? '/home/lol/.hermes/despachos/1107-082604-melhorias-do-last-arrow/camera-evidencias';
const mode = process.env.TLA_PHASE ?? 'before';
await mkdir(out, { recursive: true });
const browser = await chromium.connectOverCDP(process.env.TLA_CDP ?? 'http://127.0.0.1:19080');
let page;
const report = { mode, cases: [], errors: [], ownTabsAtEnd: null };
try {
  for (const p of browser.contexts()[0].pages()) {
    const c = await p.context().newCDPSession(p); const { targetInfo } = await c.send('Target.getTargetInfo'); await c.detach();
    if (targetInfo.targetId === process.env.TLA_TAB) page = p;
  }
  assert.ok(page, 'registered mission tab required');
  await appendFile(`${out}/web-events.ndjson`, JSON.stringify({ pid: process.pid, mission: 'camera-continua', tab: process.env.TLA_TAB, action: 'attach', mode }) + '\n');
  page.on('pageerror', e => report.errors.push(e.message));
  for (const [width, height] of [[1366,768], [900,1000], [360,800]]) {
    await page.setViewportSize({ width, height });
    for (const close of [true, false]) {
      await page.goto(`${process.env.TLA_STORY ?? 'http://127.0.0.1:6140'}/iframe.html?id=arena-camera-legibilidade--${close ? 'proxima' : 'ampla'}-extremos&viewMode=story`);
      await page.waitForSelector('#game[data-models=true]');
      const metrics = await page.evaluate(() => {
        const { world, arena } = window.__cameraBench;
        const r = document.querySelector('#game').getBoundingClientRect();
        const project = (x, y) => { const p = arena.camera.position.clone().set(x, y, .6).project(arena.camera); return { x: (p.x+1)*r.width/2, y: (1-p.y)*r.height/2 }; };
        const bodies = world.fighters.map((f, i) => {
          const head = project(f.x, 18-f.y+2.4-.55), feet = project(f.x, 18-f.y-.55);
          const left = project(f.x-.6, 18-f.y), right = project(f.x+.6,18-f.y);
          const label = document.querySelectorAll('.overhead')[i], rect = label.getBoundingClientRect(), direction = label.querySelector('.wrap-direction');
          return { id: f.id, head, feet, heightPx: feet.y-head.y, fullyVisible: left.x>=0 && right.x<=r.width && head.y>=0 && feet.y<=r.height,
            marker: { text: direction.textContent, visible: !direction.hidden, width: rect.width, height: rect.height,
              fontPx: parseFloat(getComputedStyle(label.querySelector('.fighter-label')).fontSize), inside: rect.left>=r.left && rect.right<=r.right && rect.top>=r.top && rect.bottom<=r.bottom } };
        });
        const a = project(0,18), b = project(32,0);
        return { arenaBox: { width:r.width,height:r.height }, arenaProjectedFraction: (Math.min(r.width,b.x)-Math.max(0,a.x))*(Math.min(r.height,b.y)-Math.max(0,a.y))/(innerWidth*innerHeight),
          camera: arena.camera.position.toArray(), bodies, located: bodies.filter(b=>b.fullyVisible || (b.marker.visible && b.marker.inside && b.marker.fontPx>=12)).length };
      });
      const gate = await checkScreen(page, '#game');
      report.cases.push({ width, height, close, metrics, gate });
      await page.screenshot({ path: `${out}/${mode}-${width}x${height}-${close?'close':'wide'}.png` });
      if (mode !== 'before') {
        assert.equal(metrics.located,2,'each living body is visible or has a readable directional edge marker');
        if (width!==360) assert.ok(gate.passou, JSON.stringify(gate));
        else assert.equal(gate.medidas.rolagem_horizontal,false);
      }
    }
  }
  assert.deepEqual(report.errors, []);
} catch(e) { report.failure=e.stack; throw e; }
finally {
  if (page && !page.isClosed()) await page.close();
  report.ownTabsAtEnd=0;
  await writeFile(`${out}/${mode}-report.json`, JSON.stringify(report,null,2));
  await appendFile(`${out}/web-events.ndjson`, JSON.stringify({ pid:process.pid,mission:'camera-continua',tab:process.env.TLA_TAB,action:'close',mode })+'\n');
  await browser.close();
}
console.log(JSON.stringify(report.cases.map(c=>({size:[c.width,c.height],close:c.close,located:c.metrics.located,gate:c.gate.passou,bodies:c.metrics.bodies})),null,2));
