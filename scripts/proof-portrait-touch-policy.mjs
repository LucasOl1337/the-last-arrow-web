import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.TLA_EVIDENCE??'/home/lol/.hermes/despachos/1107-082604-melhorias-do-last-arrow/portrait-evidencias';
const b=await chromium.connectOverCDP('http://127.0.0.1:19080');let page,cdp;const report={};
try{
 for(const p of b.contexts()[0].pages()){const s=await p.context().newCDPSession(p);const {targetInfo}=await s.send('Target.getTargetInfo');if(targetInfo.targetId===process.env.TLA_TAB){page=p;cdp=s;break;}await s.detach();}assert.ok(page);
 await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});await page.setViewportSize({width:360,height:800});await page.goto('http://127.0.0.1:5190/the-last-arrow-web/');await page.evaluate(()=>window.__tla.startMatch({humans:1,bots:1}));await page.waitForSelector('#game.touch');
 report.portrait=await page.evaluate(()=>({coarse:matchMedia('(pointer:coarse)').matches,canvas:getComputedStyle(document.querySelector('canvas')).visibility,notice:getComputedStyle(document.querySelector('.rotate-notice')).display,text:document.querySelector('.rotate-notice').textContent}));
 assert.equal(report.portrait.coarse,true);assert.equal(report.portrait.canvas,'hidden');assert.notEqual(report.portrait.notice,'none');await page.screenshot({path:`${out}/touch-portrait-policy.png`});
 await page.setViewportSize({width:800,height:360});await page.waitForFunction(()=>getComputedStyle(document.querySelector('canvas')).visibility==='visible');
 report.landscape=await page.evaluate(()=>({notice:getComputedStyle(document.querySelector('.rotate-notice')).display,canvas:document.querySelector('canvas').getBoundingClientRect().toJSON(),stick:getComputedStyle(document.querySelector('.touch-stick')).display,buttons:getComputedStyle(document.querySelector('.touch-buttons')).display}));
 assert.equal(report.landscape.notice,'none');assert.notEqual(report.landscape.stick,'none');assert.notEqual(report.landscape.buttons,'none');
}catch(e){report.failure=e.stack;throw e;}finally{await cdp?.send('Emulation.setTouchEmulationEnabled',{enabled:false});await cdp?.detach();await writeFile(`${out}/touch-policy-report.json`,JSON.stringify(report,null,2));await b.close();}
console.log('Existing touch portrait rotation policy and landscape controls preserved');
