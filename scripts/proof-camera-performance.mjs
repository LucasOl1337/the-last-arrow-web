import {chromium} from 'playwright-core';import {writeFile,mkdir,appendFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const out='evidence/retomada/performance';await mkdir(out,{recursive:true});const browser=await chromium.connectOverCDP('http://127.0.0.1:19080');let page;const report={samples:[],conditions:'One headed bench tab; 1366x768; same frozen simulation, animations active; no hidden/headless renderer.'};
try{
 for(const p of browser.contexts()[0].pages()){const c=await p.context().newCDPSession(p);const {targetInfo}=await c.send('Target.getTargetInfo');await c.detach();if(targetInfo.targetId===process.env.TLA_TAB)page=p;}
 assert.ok(page);await appendFile(`${out}/web-events.ndjson`,JSON.stringify({owner:'tla-retomada',pid:process.pid,action:'attach',tab:process.env.TLA_TAB})+'\n');
 await page.bringToFront();await page.setViewportSize({width:1366,height:768});await page.goto('https://arrow.symbiose.si/');await page.getByRole('button',{name:'Começar partida'}).click();await page.waitForFunction(()=>window.__tla.diagnostics().models&&window.__tla.state().phase==='playing');
 await page.waitForTimeout(3000);await page.evaluate(()=>window.__tla.setTimeScale(0));
 report.renderer=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
 for(const close of [false,false,true,true]){
  if(await page.evaluate(()=>window.__tla.state().cameraClose)!==close)await page.keyboard.press('c');await page.waitForTimeout(300);
  const m=await page.evaluate(()=>new Promise(resolve=>{const times=[];const end=performance.now()+5000;function frame(t){times.push(t);if(t<end)requestAnimationFrame(frame);else resolve({fps:(times.length-1)*1000/(times.at(-1)-times[0]),frames:times.length,diagnostics:window.__tla.diagnostics()});}requestAnimationFrame(frame);}));report.samples.push({close,...m});
 }
 await page.screenshot({path:`${out}/camera-fixa.png`});
}finally{if(page&&!page.isClosed())await page.close();report.ownPagesAtEnd=0;await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await appendFile(`${out}/web-events.ndjson`,JSON.stringify({owner:'tla-retomada',pid:process.pid,action:'close',tab:process.env.TLA_TAB})+'\n');await browser.close();}
console.log(report.renderer,report.samples.map(x=>({close:x.close,fps:x.fps})));
