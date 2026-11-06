import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { checkScreen } from './check-screen.mjs';

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
    const officialGate = await checkScreen(page, selector);
    const exception = selector === '.overlay-panel' ? 'Diálogo curto de ação, não editor: expandir até 40% só criaria espaço vazio.' : null;
    assert.deepEqual(officialGate.falhas.filter(f => !(exception && f.startsWith('b.'))), []);
    report.checks.push({ label, measurements, officialGate, exception });
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
    await page.waitForFunction(() => window.__tla.state().phase === 'matchover', undefined, { timeout: 25000 });
    await page.getByRole('heading', { name: /venceu/ }).waitFor();
    report.humanMatch = await page.evaluate(() => window.__tla.state());
    assert.equal(report.humanMatch.fighters.length, 4); assert.equal(report.humanMatch.fighters[0].human, true);
    assert.ok(report.humanMatch.fighters.some(f => f.score === 5)); await gate('vitoria-integrada', '.overlay-panel');
    await page.getByRole('button', { name: 'Revanche' }).click(); assert.equal(await page.evaluate(() => window.__tla.state().round), 1);
    await page.goto(`${url}/?autoplay=bots4&seed=42`);
    await page.waitForFunction(() => window.__tla?.state().phase === 'playing');
    await page.evaluate(() => window.__tla.setTimeScale(24));
    await page.waitForFunction(() => window.__tla.state().round > 1, undefined, { timeout: 10000 });
    report.autoplay = await page.evaluate(() => window.__tla.state());
    assert.equal(report.autoplay.fighters.filter(f => f.human).length, 0); await gate('autoplay', '#game');
    report.renderer = await page.evaluate(() => window.__tla.diagnostics());
    // Prove actual keyboard -> production input -> simulation, including both P2 binding sets.
    await page.evaluate(() => {
      window.__tla.startMatch({ humans: 2, bots: 0, seed: 15 });
      const w = window.__tla.world; w.phase = 'playing';
      Object.assign(w.fighters[0], { x: 6, y: 15.45, prevX: 6, prevY: 15.45, grounded: true });
      Object.assign(w.fighters[1], { x: 26, y: 15.45, prevX: 26, prevY: 15.45, grounded: true });
    });
    await page.keyboard.down('d'); await delay(100); await page.keyboard.up('d');
    assert.ok(await page.evaluate(() => window.__tla.world.fighters[0].x > 6.1));
    await page.keyboard.down('j'); await delay(70);
    assert.equal(await page.evaluate(() => window.__tla.world.fighters[0].ammo), 3);
    await page.keyboard.up('j'); await page.waitForFunction(() => window.__tla.world.fighters[0].ammo === 2);
    await page.keyboard.down('k'); await delay(80); await page.keyboard.up('k');
    assert.ok(await page.evaluate(() => window.__tla.world.fighters[0].vy < 0));
    await page.keyboard.press('l'); await page.waitForFunction(() => window.__tla.world.fighters[0].dashCooldown > 0);
    await page.keyboard.down('ArrowLeft'); await delay(100); await page.keyboard.up('ArrowLeft');
    assert.ok(await page.evaluate(() => window.__tla.world.fighters[1].x < 25.9));
    await page.keyboard.down(','); await delay(70); await page.keyboard.up(',');
    await page.waitForFunction(() => window.__tla.world.fighters[1].ammo === 2);
    await page.keyboard.down('.'); await delay(70); await page.keyboard.up('.');
    assert.ok(await page.evaluate(() => window.__tla.world.fighters[1].vy < 0));
    await page.keyboard.press('/'); await page.waitForFunction(() => window.__tla.world.fighters[1].dashCooldown > 0);
    await delay(250); await page.keyboard.down('Numpad1'); await delay(60); await page.keyboard.up('Numpad1');
    await page.waitForFunction(() => window.__tla.world.fighters[1].ammo === 1);
    await page.waitForFunction(() => window.__tla.world.fighters[1].grounded);
    await page.keyboard.down('Numpad2'); await delay(70); await page.keyboard.up('Numpad2');
    assert.ok(await page.evaluate(() => window.__tla.world.fighters[1].vy < 0));
    await page.waitForFunction(() => window.__tla.world.fighters[1].dashCooldown === 0);
    await page.keyboard.press('Numpad3'); await page.waitForFunction(() => window.__tla.world.fighters[1].dashCooldown > 0);
    report.keyboard = 'P1 WASD/J/K/L and P2 arrows/comma/period/slash/Numpad1/2/3 exercised';
    // Standard Gamepad API mock only at the hardware boundary; Controls remains production code.
    await page.evaluate(() => {
      window.__tla.startMatch({ humans: 2, bots: 0, seed: 15 }); window.__tla.world.phase = 'playing';
      window.__testPads = [0, 1].map(index => ({ index, connected: true, mapping: 'standard', axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) }));
      navigator.getGamepads = () => window.__testPads;
      window.__testPads[0].axes[0] = 1; window.__testPads[1].axes[0] = -1;
      window.__testPads[0].buttons[2].pressed = true; window.__testPads[1].buttons[2].pressed = true;
    });
    await delay(100);
    await page.evaluate(() => { window.__testPads[0].buttons[2].pressed = false; window.__testPads[1].buttons[2].pressed = false; });
    await page.waitForFunction(() => window.__tla.world.fighters.every(f => f.ammo === 2));
    await page.evaluate(() => { window.__testPads[0].buttons[0].pressed = true; window.__testPads[1].buttons[1].pressed = true; });
    await page.waitForFunction(() => window.__tla.world.fighters[1].dashCooldown > 0);
    await page.evaluate(() => { window.__testPads[0].buttons[9].pressed = true; });
    await page.waitForFunction(() => window.__tla.state().paused);
    await page.evaluate(() => { window.__testPads[0].buttons[9].pressed = false; }); await delay(50);
    await page.evaluate(() => { window.__testPads[0].buttons[9].pressed = true; });
    await page.waitForFunction(() => !window.__tla.state().paused);
    report.gamepad = 'Two standard gamepads: move, release shot, jump, dash and Start pause/resume';
    await page.evaluate(() => { delete navigator.getGamepads; delete window.__testPads; });
    for (const [map, difficulty] of [['totem', 'easy'], ['canopy', 'hard']]) {
      await page.evaluate(({ map, difficulty }) => { window.__tla.startMatch({ humans: 0, bots: 4, map, difficulty, seed: 42 }); window.__tla.setTimeScale(24); }, { map, difficulty });
      await page.waitForFunction(() => window.__tla.state().round > 1, undefined, { timeout: 15000 });
      await gate(`map-${map}`, '#game');
    }
    await page.evaluate(() => { window.__tla.startMatch({ humans: 0, bots: 4, seed: 42 }); });
    await page.waitForFunction(() => window.__tla.diagnostics().frames >= 240);
    report.performance = await page.evaluate(() => window.__tla.diagnostics());
    const before = await page.evaluate(() => window.__tla.diagnostics().geometries);
    await page.evaluate(() => window.__tla.startMatch({ humans: 0, bots: 4, seed: 42 }));
    await page.waitForFunction(() => window.__tla.diagnostics().frames > 2);
    const after = await page.evaluate(() => window.__tla.diagnostics().geometries);
    // Three.js uploads halo geometries lazily when a dash first makes them visible.
    assert.ok(after <= before, `Revanche acumulou geometrias: ${before} -> ${after}`); report.rematchGeometries = { before, after };
  }
  assert.deepEqual(report.errors, []);
  await page.close(); report.pagesAtEnd = context.pages().length;
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (browser) await browser.close(); server.kill('SIGTERM');
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
