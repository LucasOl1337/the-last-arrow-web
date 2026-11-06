import { proof, measure } from './bench-rodada-9.mjs';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { checkScreen } from './check-screen.mjs';

await proof('robustness', async ({ page, cdp, context, report, base, before, shot, event, expect }) => {
  await page.goto(`${base}?autoplay=bots4&seed=3`);
  await page.waitForFunction(() => window.__tla.diagnostics().models && window.__tla.state().phase === 'playing');
  // A real background target: no synthetic visibility event. One temporary second own tab.
  const background = await context.newPage(); await event('visibility-tab-open');
  try {
    await background.goto('data:text/html,<title>Visibility probe</title>'); await background.bringToFront();
    // Headless pages do not become hidden on tab switch; CDP lifecycle frozen is the real browser suspension path.
    report.tabSwitchHidden = await page.evaluate(() => document.hidden);
    await cdp.send('Page.setWebLifecycleState', { state: 'frozen' }); await delay(1000);
    await cdp.send('Page.setWebLifecycleState', { state: 'active' }); await page.bringToFront();
  } finally { await background.close(); await event('visibility-tab-close'); }
  report.visibility = await page.evaluate(() => ({ state: window.__tla.state(), hidden: document.hidden }));
  if (await page.getByRole('button', { name: 'Continuar', exact: true }).isVisible()) await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  report.resize = {};
  for (const [width,height] of [[1366,768],[900,1000],[844,390],[1600,900]]) {
    await page.setViewportSize({width,height}); await delay(300);
    report.resize[`${width}x${height}`] = await checkScreen(page, '#game');
    assert.ok(report.resize[`${width}x${height}`].passou);
    await shot(`resize-${width}x${height}`);
  }
  const tick = await page.evaluate(() => window.__tla.world.tick);
  await page.evaluate(() => {
    window.loss = document.querySelector('#game canvas').getContext('webgl2').getExtension('WEBGL_lose_context'); window.loss.loseContext();
  });
  await delay(350); await shot('contexto-perdido');
  report.lost = await page.evaluate(() => ({ state: window.__tla.state(), text: document.querySelector('.menu-layer').textContent }));
  await page.evaluate(() => window.loss.restoreContext()); await delay(2000);
  report.restored = await page.evaluate(() => ({ state: window.__tla.state(), text: document.querySelector('.menu-layer').textContent, diagnostics: window.__tla.diagnostics() }));
  await shot('contexto-restaurado');
  if (!before) {
    assert.match(report.lost.text, /Imagem interrompida/); assert.match(report.restored.text, /Partida pausada/);
    assert.ok(report.restored.state.tick <= tick + 12, 'no time lost during context recovery');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.waitForFunction(t => window.__tla.world.tick > t + 30, tick);
    report.recoveryFPS = await measure(page, 6000); assert.ok(report.recoveryFPS.fps >= 58);
    await shot('contexto-jogavel');
  }
  await page.goto(`${base}?autoplay=bots4&map=nao-existe&seed=3`);
  await page.waitForFunction(() => window.__tla.diagnostics().models && window.__tla.world.phase === 'playing');
  report.invalidMap = await page.evaluate(() => ({ state: window.__tla.state(), text: document.body.textContent }));
  assert.equal(report.invalidMap.state.map, 'moss');
  if (!before) assert.match(report.invalidMap.text, /Arena inválida/);
  await shot('mapa-invalido');
  const missing = ['models/mizu.glb', 'tex/stone.jpg', 'bg/templo.jpg', 'audio/mizu_shoot.wav'];
  // These exact intentionally failed resources are the only errors allowed.
  expect(e => missing.some(file => e.url?.endsWith(file)) && (e.type === 'http' && e.text === '404' || e.type === 'console' && e.text.includes('404')));
  const route = async route => {
    if (missing.some(file => route.request().url().endsWith(file))) await route.fulfill({ status: 404, contentType: 'text/plain', body: 'Injected round-nine asset failure' });
    else await route.continue();
  };
  await page.route('**/assets/**', route);
  await page.goto(`${base}?seed=3`); await page.locator('#map [data-value="totem"]').click();
  await page.getByRole('button', { name: 'Começar partida' }).click();
  await page.waitForFunction(() => window.__tla.world.phase === 'playing'); await delay(2500);
  report.missingAssets = await page.evaluate(() => ({ diagnostics: window.__tla.diagnostics(), text: document.body.textContent, tick: window.__tla.world.tick }));
  await shot('assets-404');
  await page.waitForFunction(t => window.__tla.world.tick > t + 60, report.missingAssets.tick);
  if (!before) {
    assert.match(report.missingAssets.text, /Modelos incompletos/); assert.match(report.missingAssets.text, /Texturas indisponíveis/); assert.match(report.missingAssets.text, /Áudio incompleto/);
    assert.equal(report.missingAssets.diagnostics.models, true, 'sibling fallback remains animated');
    await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Voltar ao menu' }).click();
    await page.getByRole('button', { name: 'Começar partida' }).click();
    await page.waitForFunction(() => window.__tla.world.phase === 'playing');
    report.retryFallback = await page.evaluate(() => window.__tla.diagnostics());
  }
  assert.ok(report.expectedErrors.length >= missing.length);
});
