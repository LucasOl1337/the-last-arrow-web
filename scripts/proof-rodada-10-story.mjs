import { proof } from './bench-rodada-10.mjs';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { checkScreen } from './check-screen.mjs';
await proof('story',async({page,base,before,report,shot})=>{
  report.screens={};
  for(const id of ['arena-juice-real--catch','arena-hud-real--wrap-com-direcao']) {
    await page.goto(`${base}?id=${id}&viewMode=story`);await page.locator('#game').waitFor();
    if(id.includes('juice'))await page.waitForFunction(()=>document.querySelector('#game').dataset.models==='true');
    for(const [width,height] of [[1366,768],[900,1000],[844,390]]) {
      await page.setViewportSize({width,height});await delay(200);
      const key=`${id}-${width}x${height}`;
      report.screens[key]=await checkScreen(page,'#game');assert.ok(report.screens[key].passou);
      if(!before&&id.includes('wrap')){
        assert.deepEqual(await page.locator('.wrap-direction:not([hidden])').allTextContents(),['←','→','↑','↓']);
      }
      if(!before&&id.includes('juice'))assert.equal(await page.locator('.catch-label:not([hidden])').textContent(),'PEGOU!');
      report.screens[key].labels=await page.locator('.overhead:not([hidden])').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,text:e.textContent};}));
      for(const r of report.screens[key].labels) assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=width&&r.y+r.h<=height,'label in viewport');
      await shot(`story-${key}`);
    }
  }
},{story:true});
