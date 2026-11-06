import assert from 'node:assert/strict';
import { proof } from './bench-rodada-5.mjs';
import { checkScreen } from './check-screen.mjs';

await proof('menu-story', async ({ page, report, base, shot }) => {
  report.screens = {};
  for (const [width, height] of [[1366, 768], [900, 1000], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${base}?id=arena-menu-real--som-silenciado-externamente&viewMode=story`);
    const muted = page.getByRole('button', { name: 'Som desligado' });
    await muted.waitFor(); assert.equal(await muted.getAttribute('aria-pressed'), 'true');
    await shot(`som-story-${width}`);
    await muted.click(); assert.equal(await page.getByRole('button', { name: 'Som ligado' }).getAttribute('aria-pressed'), 'false');
    await page.getByRole('button', { name: 'Voltar ao menu' }).click();
    await page.locator('#map').waitFor();
    await page.locator('#map img').evaluateAll(imgs => Promise.all(imgs.map(img => img.decode())));
    report.screens[width] = await checkScreen(page, '.menu-content');
    await shot(`menu-story-${width}`);
    const cta = await page.getByRole('button', { name: 'Começar partida' }).boundingBox();
    assert.ok(cta.y >= 0 && cta.y + cta.height <= height, `${width}: start CTA must be above the fold`);
    const thumbs = await page.locator('#map img').evaluateAll(imgs => imgs.map(img => ({ src: img.src, loaded: img.complete && img.naturalWidth > 0 })));
    assert.ok(thumbs.every(t => t.loaded));
    assert.ok(thumbs[3].src.endsWith('/bg/templo.jpg') && thumbs[4].src.endsWith('/bg/ruins.jpg'));
    assert.ok(report.screens[width].passou, `${width}: menu gate`);
    await page.locator('#map [data-value="falls"]').click();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#map [data-value="roots"]').getAttribute('aria-checked'), 'true');
  }
}, { story: true });
