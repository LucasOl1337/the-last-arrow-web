import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';
const cut = process.argv[2] ?? 'before';
const out = '/home/lol/.hermes/despachos/1107-082604-melhorias-do-last-arrow/anexos';
const browser = await chromium.connectOverCDP('http://127.0.0.1:19082');
const context = browser.contexts()[0];
const page = context.pages().find(p => p.url().startsWith('http://127.0.0.1:6139/'));
if (!page) throw new Error('Use the registered sol-visual mission tab');
const report = { cut, owner: 'sol-visual', pid: process.pid, errors: [], cases: [] };
page.on('pageerror', e => report.errors.push(String(e)));
try {
  for (const theme of ['totem', 'moss', 'canopy']) {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`http://127.0.0.1:6139/iframe.html?id=arena-visual-legivel--textura-${theme}&viewMode=story`);
    await page.waitForSelector('main[data-models="true"]', { timeout: 60000 });
    await page.evaluate(() => {
      const b = window.__visualBench;
      b.frozen = true; b.time = 2;
      // Stabilize the actual animation once, at the same pose for both captures.
      for (let i = 0; i < 120; i++) b.fighters.update(b.world, 1, 2, 1 / 60);
      b.arena.camera.position.set(16, b.arena.camera.position.y, b.arena.camera.position.z);
      b.arena.draw(2, 0);
    });
    await page.screenshot({ path: `${out}/visual-${cut}-${theme}.png` });
    report.cases.push(await page.evaluate(theme => {
      const b = window.__visualBench, rect = document.querySelector('canvas').getBoundingClientRect();
      return { theme, models: b.fighters.usingModels, visuals: b.fighters.inspect(),
        viewport: { width: innerWidth, height: innerHeight },
        gate: { area: rect.width * rect.height / (innerWidth * innerHeight), top: rect.top,
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth },
        materials: b.fighters.views.map(v => v.rig.uniforms.map(u => ({ rim: u.uRimStrength.value, self: u.uSelf.value }))) };
    }, theme));
  }
} finally {
  await writeFile(`${out}/visual-${cut}-report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report));
