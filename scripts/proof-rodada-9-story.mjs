import { proof } from './bench-rodada-9.mjs';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { checkScreen } from './check-screen.mjs';
await proof('story', async ({page,base,report,shot}) => {
  report.screens = {};
  for (const id of ['arena-menu-real--contexto-perdido','arena-recursos-reais--assets-indisponiveis']) {
    await page.goto(`${base}?id=${id}&viewMode=story`);
    const selector = id.includes('menu') ? '.menu-layer' : '#game'; await page.locator(selector).waitFor();
    for (const [width,height] of [[1366,768],[900,1000],[844,390]]) {
      await page.setViewportSize({width,height}); await delay(150);
      const key = `${id}-${width}x${height}`; report.screens[key] = await checkScreen(page,selector);
      assert.ok(report.screens[key].passou);
      const r = await page.locator(id.includes('menu') ? '.overlay-panel' : '.resource-notice').boundingBox();
      assert.ok(r.x >= 0 && r.y >= 0 && r.x+r.width <= width && r.y+r.height <= height);
      if (id.includes('menu')) {
        await page.locator('.overlay-panel button').focus(); await page.keyboard.press('Tab');
        assert.equal(await page.locator('.overlay-panel button').evaluate(b => b === document.activeElement),true);
      }
      await shot(`story-${key}`);
    }
  }
}, {story:true});
