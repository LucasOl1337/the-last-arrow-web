import { proof, measure, instrument } from './bench-rodada-8.mjs';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { checkScreen } from './check-screen.mjs';
await proof('desktop', async ({ page, cdp, base, report, shot }) => {
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  await page.goto(`${base}?seed=3`);
  await page.getByRole('button',{name:'Começar partida'}).click();
  await instrument(page); await page.locator('.controls-hint').waitFor();
  report.hint=await page.locator('.controls-hint').textContent();
  await page.waitForFunction(()=>window.__tla.diagnostics().models&&window.__tla.state().phase==='playing');
  await page.keyboard.down('KeyJ'); await delay(180); await page.keyboard.up('KeyJ');
  await page.waitForFunction(()=>window.events8.some(e=>e.actor===0&&e.type==='shoot'));
  report.cold={clicksToStart:1,gesturesToShot:2,firstShotMs:await page.evaluate(()=>window.events8.find(e=>e.actor===0&&e.type==='shoot').at),cacheDisabled:true,network:'local preview, no network throttling'};
  report.maps={};
  for(const map of ['moss','totem','canopy','falls','roots']) {
    await page.evaluate(map=>window.__tla.startMatch({humans:1,bots:3,seed:3,map}),map);
    await page.waitForFunction(()=>window.__tla.diagnostics().models&&window.__tla.state().phase==='playing');
    await delay(1000); const measurement=measure(page);
    await page.keyboard.down('KeyD'); await delay(300); await page.keyboard.down('KeyJ'); await delay(200); await page.keyboard.up('KeyJ'); await page.keyboard.up('KeyD');
    await page.keyboard.down('KeyA'); await page.keyboard.press('KeyK'); await delay(300); await page.keyboard.up('KeyA');
    const m=await measurement; assert.ok(m.fps>=58,map); assert.equal(m.diagnostics.models,true); assert.deepEqual(m.diagnostics.audioFailures,[]);
    report.maps[map]=m; await shot(`desktop-${map}`); console.log('desktop',map,m.fps);
  }
  report.screens={};
  for(const [width,height] of [[1366,768],[900,1000]]) {
    await page.setViewportSize({width,height}); await delay(100);
    report.screens[`${width}x${height}`]=await checkScreen(page,'#game'); assert.ok(report.screens[`${width}x${height}`].passou);
    await shot(`desktop-${width}x${height}`);
  }
  report.renderer=await page.evaluate(()=>{const c=document.querySelector('canvas').getContext('webgl2'),ext=c.getExtension('WEBGL_debug_renderer_info');return c.getParameter(ext.UNMASKED_RENDERER_WEBGL);});
},{});
