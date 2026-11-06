import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {checkScreen} from './check-screen.mjs';
const out='evidence/retomada/stories';await mkdir(out,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:19080');let page;const report={screens:[],errors:[]};
try {
 for(const p of browser.contexts()[0].pages()){const c=await p.context().newCDPSession(p);const {targetInfo}=await c.send('Target.getTargetInfo');await c.detach();if(targetInfo.targetId===process.env.TLA_TAB)page=p;}
 assert.ok(page);page.on('pageerror',e=>report.errors.push(e.message));await page.bringToFront();
 for(const story of ['arena-online-real--entrada','arena-online-real--esperando','arena-online-real--erro','arena-menu-real--configuracao','arena-menu-real--pausa-online','arena-animacao-real--camera-proxima']) {
  for(const [width,height] of [[1366,768],[900,1000],[844,390]]) {
   await page.setViewportSize({width,height});await page.goto(`http://127.0.0.1:6107/iframe.html?id=${story}&viewMode=story`);
   const main=story.includes('animacao')?'#game':'.menu-layer';await page.locator(main).waitFor();
   if(story.includes('animacao'))await page.waitForFunction(()=>document.querySelector('#game')?.dataset.models==='true');
   const gate=await checkScreen(page,main);report.screens.push({story,width,height,...gate});assert.ok(gate.passou,`${story} ${width}: ${gate.falhas}`);
   const clipped=await page.locator('.online-panel button,.menu-actions button,.overlay-panel>button').evaluateAll(els=>els.filter(e=>{const r=e.getBoundingClientRect();return r.top<0||r.bottom>innerHeight||r.left<0||r.right>innerWidth;}).map(e=>e.textContent));assert.deepEqual(clipped,[],`${story} buttons fit`);
   await page.screenshot({path:`${out}/${story}-${width}x${height}.png`});
  }
 }
 assert.deepEqual(report.errors,[]);
} catch(e){report.failure=e.stack;throw e;}
finally{if(page&&!page.isClosed())await page.close();report.ownPagesAtEnd=0;await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
console.log('Stories reais: 18 portões aprovados.');
