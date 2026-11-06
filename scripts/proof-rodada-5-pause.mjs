import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { proof } from './bench-rodada-5.mjs';

await proof('pause', async ({ page, report, base }) => {
  await page.goto(base);
  await page.getByRole('button', { name: 'Começar partida' }).click();
  await page.waitForFunction(() => window.__tla.diagnostics().models && window.__tla.world.phase === 'playing');
  // Exact observed bug: hold J -> Esc -> release J while paused -> Esc spends ammo.
  await page.keyboard.down('KeyJ'); await delay(80);
  assert.equal(await page.evaluate(() => window.__tla.world.fighters[0].charging), true);
  await page.keyboard.press('Escape'); await page.keyboard.up('KeyJ');
  const tick = await page.evaluate(() => window.__tla.world.tick);
  await delay(120); assert.equal(await page.evaluate(() => window.__tla.world.tick), tick);
  await page.keyboard.press('Escape'); await delay(80);
  report.afterResume = await page.evaluate(() => ({ ammo: window.__tla.world.fighters[0].ammo, charging: window.__tla.world.fighters[0].charging, paused: window.__tla.state().paused }));
  assert.deepEqual(report.afterResume, { ammo: 3, charging: false, paused: false });
  await page.keyboard.down('KeyJ'); await delay(60); await page.keyboard.up('KeyJ'); await delay(40);
  assert.equal(await page.evaluate(() => window.__tla.world.fighters[0].ammo), 2, 'a fresh gesture still shoots');
  // Losing focus takes the same cancellation path; no resumed movement or accidental shot.
  await page.keyboard.down('KeyJ'); await delay(250);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.keyboard.up('KeyJ'); await page.keyboard.press('Escape'); await delay(50);
  report.afterBlur = await page.evaluate(() => ({ ammo: window.__tla.world.fighters[0].ammo, charging: window.__tla.world.fighters[0].charging, paused: window.__tla.state().paused }));
  assert.deepEqual(report.afterBlur, { ammo: 2, charging: false, paused: false });
});
