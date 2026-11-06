import { proof, fingers, center } from './bench-rodada-8.mjs';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { checkScreen } from './check-screen.mjs';
await proof('story', async ({ page, cdp, base, report, shot }) => {
  report.screens = {};
  for (const [id, selector] of [['arena-menu-real--configuracao', '.menu-content'], ['arena-toque-real--countdown', '#game']]) {
    await page.goto(`${base}?id=${id}&viewMode=story`); await page.locator(selector).waitFor();
    for (const [width,height] of [[1366,768],[900,1000],[844,390],[932,430],[390,844]]) {
      await page.setViewportSize({ width,height }); await delay(200);
      const key = `${id}-${width}x${height}`;
      report.screens[key] = await checkScreen(page, selector);
      // Portrait touch deliberately replaces the landscape arena with a rotate notice.
      if (id.includes('toque') && height > width) { await page.locator('.rotate-notice').waitFor({ state: 'visible' }); }
      else assert.ok(report.screens[key].passou, key);
      if (id.includes('configuracao')) { const r = await page.getByRole('button', { name: 'Começar partida' }).boundingBox(); assert.ok(r.y + r.height <= height, key); }
      else if (width > height) {
        await page.locator('.controls-hint').waitFor();
        const game = await page.locator('#game').boundingBox(), buttons = await page.locator('.touch-buttons').boundingBox();
        assert.ok(buttons.x >= game.x + game.width, 'buttons outside combat');
      }
      await shot(`story-${key}`);
    }
  }
  await page.setViewportSize({ width: 844, height: 390 });
  const f = fingers(cdp), shoot = await center(page.locator('.shoot'));
  await f.down(1,shoot.x-8,shoot.y); await f.down(2,shoot.x+8,shoot.y); await f.up(2);
  assert.ok(await page.locator('.shoot').evaluate(b => b.classList.contains('on')), 'second finger up retains first');
  await f.up(1); assert.ok(!await page.locator('.shoot').evaluate(b => b.classList.contains('on')));
  report.twoFingersSameButton = 'passed';
}, { story: true, mobile: true });
