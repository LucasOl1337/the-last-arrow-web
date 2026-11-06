import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

// Run through agent-bench fila tla rodar -- agent-bench exec tla -- npm run test:browser.
// The sole browser/tab belong to this process and close in finally. Never attach to a user's browser.
const stories = process.argv.includes('--stories');
const out = process.env.TLA_PROOF_DIR ?? `evidence/${stories ? 'stories-before' : 'browser'}`;
await mkdir(out, { recursive: true });
const port = stories ? 6106 : 4173;
const server = stories
  ? spawn('/usr/bin/python', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', 'storybook-static'], { stdio: 'ignore' })
  : spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
let browser;
const report = { owner: 'tla-core', route: 'isolated headless chromium / agent-bench tla', errors: [], checks: [], pagesAtEnd: null };
try {
  const url = `http://127.0.0.1:${port}`;
  for (let n = 0; n < 100; n++) { try { if ((await fetch(url)).ok) break; } catch {} await delay(50); }
  browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`, headless: true,
    args: ['--headless=new', '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') report.errors.push(msg.text()); });
  page.on('response', response => { if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`); });
  const gate = async (label, selector) => {
    const measurements = await page.evaluate(selector => {
      const el = document.querySelector(selector), r = el.getBoundingClientRect();
      const visible = e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).display !== 'none'; };
      return {
        principal_topo: r.top, principal_fracao: Math.min(r.width, innerWidth) * Math.min(r.height, innerHeight) / (innerWidth * innerHeight),
        rolagem_horizontal: document.documentElement.scrollWidth > innerWidth + 1,
        salvar_visiveis: [...document.querySelectorAll('button')].filter(visible).filter(e => /^salvar|^save/i.test(e.textContent)).length,
        inputs_vazios_em_branco: [...document.querySelectorAll('input,textarea')].filter(visible).filter(e => !e.value && /em branco|blank/.test(e.placeholder)).length,
        ajudas_longas: [...document.querySelectorAll('p,small')].filter(visible).filter(e => !el.contains(e) && e.textContent.length > 140).map(e => e.textContent),
        rolagens_ate_principal: Math.max(0, Math.ceil((r.top - innerHeight * 0.85) / innerHeight)),
      };
    }, selector);
    assert.equal(measurements.rolagem_horizontal, false); assert.equal(measurements.rolagens_ate_principal, 0);
    assert.equal(measurements.salvar_visiveis, 0); assert.equal(measurements.inputs_vazios_em_branco, 0);
    assert.equal(measurements.ajudas_longas.length, 0);
    report.checks.push({ label, measurements });
    await page.screenshot({ path: `${out}/${label}.png` });
  };
  if (stories) {
    await page.goto(`${url}/iframe.html?id=arena-menu-real--configuracao&viewMode=story`);
    await page.getByRole('button', { name: 'Começar partida' }).waitFor();
    for (const [width, height] of [[1366, 768], [900, 1000], [360, 800]]) {
      await page.setViewportSize({ width, height }); await gate(`menu-${width}x${height}`, '.menu-content');
    }
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.selectOption('#mode', '2'); assert.equal(await page.locator('#bots').inputValue(), '2');
    await page.selectOption('#bots', '0'); await page.selectOption('#character2', 'akane');
    await page.getByRole('button', { name: 'Começar partida' }).click(); await page.getByRole('heading', { name: 'Partida pausada' }).waitFor();
    await page.getByRole('button', { name: 'Controles', exact: true }).click(); await page.getByRole('heading', { name: 'Como jogar' }).waitFor();
    await gate('controles', '.overlay-panel');
    await page.getByRole('button', { name: 'Voltar', exact: true }).click(); await page.getByRole('heading', { name: 'Partida pausada' }).waitFor();
    for (const [story, heading] of [['vitoria', 'Stormdragon venceu'], ['erro-grafico', 'Não foi possível abrir a arena']]) {
      await page.goto(`${url}/iframe.html?id=arena-menu-real--${story}&viewMode=story`);
      await page.getByRole('heading', { name: heading }).waitFor(); await gate(story, '.overlay-panel');
    }
  } else {
    await page.goto(`${url}/?seed=7`);
    await page.getByRole('button', { name: 'Começar partida' }).waitFor();
    await gate('menu-integrado', '.menu-content');
    await page.getByRole('button', { name: 'Controles', exact: true }).click();
    await page.getByRole('button', { name: 'Voltar', exact: true }).click();
    await page.getByRole('button', { name: 'Começar partida' }).click();
    await page.waitForFunction(() => window.__tla.state().phase === 'playing');
    await gate('arena', '#game');
    await page.keyboard.press('Escape'); await page.getByRole('heading', { name: 'Partida pausada' }).waitFor();
    const pausedTick = await page.evaluate(() => window.__tla.state().tick);
    await delay(150); assert.equal(await page.evaluate(() => window.__tla.state().tick), pausedTick);
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.evaluate(() => window.__tla.setTimeScale(24));
    await page.waitForFunction(() => window.__tla.state().phase === 'matchover', { timeout: 25000 });
    await page.getByRole('heading', { name: /venceu/ }).waitFor();
    report.humanMatch = await page.evaluate(() => window.__tla.state());
    assert.equal(report.humanMatch.fighters.length, 4); assert.equal(report.humanMatch.fighters[0].human, true);
    assert.ok(report.humanMatch.fighters.some(f => f.score === 5)); await gate('vitoria-integrada', '.overlay-panel');
    await page.getByRole('button', { name: 'Revanche' }).click(); assert.equal(await page.evaluate(() => window.__tla.state().round), 1);
    await page.goto(`${url}/?autoplay=bots4&seed=42`);
    await page.waitForFunction(() => window.__tla?.state().phase === 'playing');
    await page.evaluate(() => window.__tla.setTimeScale(24));
    await page.waitForFunction(() => window.__tla.state().round > 1, { timeout: 10000 });
    report.autoplay = await page.evaluate(() => window.__tla.state());
    assert.equal(report.autoplay.fighters.filter(f => f.human).length, 0); await gate('autoplay', '#game');
    report.renderer = await page.evaluate(() => window.__tla.diagnostics());
  }
  assert.deepEqual(report.errors, []);
  await page.close(); report.pagesAtEnd = context.pages().length;
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (browser) await browser.close(); server.kill('SIGTERM');
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
