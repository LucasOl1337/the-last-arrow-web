import { proof, fingers, center, instrument } from './bench-rodada-8.mjs';
import { setTimeout as delay } from 'node:timers/promises';
await proof('mobile', async ({ page, cdp, base, report, shot }) => {
  await page.goto(`${base}?seed=3`);
  report.coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  await shot('menu-844x390');
  await page.getByRole('button', { name: 'Começar partida' }).tap();
  await instrument(page); await shot('countdown-844x390');
  await page.waitForFunction(() => window.__tla.diagnostics().models && window.__tla.state().phase === 'playing');
  const f = fingers(cdp), stick = await center(page.locator('.stick-base')), shoot = await center(page.locator('.touch-btn.shoot'));
  await f.down(1, stick.x, stick.y); await f.move(1, stick.x + 36, stick.y);
  await f.down(2, shoot.x, shoot.y); await delay(120);
  report.multitouch = await page.evaluate(() => ({ ...window.__tla.world.fighters[0].intent, charging: window.__tla.world.fighters[0].charging }));
  // Concrete edge: finger held through pause; reset must not resurrect input.
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Continuar' }).tap(); await delay(60);
  report.resumedWithOldTouches = await page.evaluate(() => ({ ...window.__tla.world.fighters[0].intent, charging: window.__tla.world.fighters[0].charging }));
  await f.cancel(); await delay(100); await shot('jogo-844x390');
  for (const [width,height] of [[932,430],[390,844]]) {
    await page.setViewportSize({ width,height }); await delay(150); await shot(`jogo-${width}x${height}`);
  }
  report.portrait = await page.evaluate(() => ({ warning: document.querySelector('.rotate-notice')?.textContent ?? null, width: innerWidth, scrollWidth: document.documentElement.scrollWidth, hud: getComputedStyle(document.querySelector('.score-card b')).fontSize }));
  report.events = await page.evaluate(() => window.events8);
}, { mobile: true, before: true });
