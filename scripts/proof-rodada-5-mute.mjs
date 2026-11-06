import assert from 'node:assert/strict';
import { proof } from './bench-rodada-5.mjs';

await proof('mute', async ({ page, report, base, shot }) => {
  await page.goto(base);
  await page.getByRole('button', { name: 'Começar partida' }).click();
  await page.waitForFunction(() => window.__tla.diagnostics().models && window.__tla.world.phase === 'playing');
  await page.keyboard.press('Escape'); await page.keyboard.press('KeyM');
  const muted = page.getByRole('button', { name: 'Som desligado', exact: true });
  await muted.waitFor(); assert.equal(await muted.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.mute-toggle').getAttribute('aria-pressed'), 'true');
  await shot('pausa-mute');
  await page.getByRole('button', { name: 'Voltar ao menu' }).click();
  await muted.waitFor(); await muted.click();
  assert.equal(await page.locator('.mute-toggle').getAttribute('aria-pressed'), 'false');
  await page.getByRole('button', { name: 'Começar partida' }).click();
  await page.locator('.mute-toggle').click(); await page.keyboard.press('Escape');
  await muted.waitFor(); report.keyboardHudMenuAgree = true;
});
