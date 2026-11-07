import { chromium } from 'playwright-core';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root=process.argv[2],bench='arrow-mizu-neighbors',mission='mizu-neighbors-1107';
const cli=(...args)=>JSON.parse(execFileSync('agent-bench',args,{encoding:'utf8'}));
assert.ok(cli('fila').vagas.some(v=>v.bench===bench));assert.equal(cli('status',bench).control_mode,'agente');assert.equal(cli('browser-status',bench).lives_in,bench);
const {tab}=JSON.parse(await readFile(`${root}/tab.json`,'utf8')),cdp=JSON.parse(await readFile(`${root}/cdp.json`,'utf8'));
const browser=await chromium.connectOverCDP(cdp.webSocketDebuggerUrl);const report={errors:[],states:{}};
try{
 let page;for(const p of browser.contexts()[0].pages()){const s=await p.context().newCDPSession(p);const {targetInfo}=await s.send('Target.getTargetInfo');await s.detach();if(targetInfo.targetId===tab)page=p;}
 assert.ok(page);page.on('pageerror',e=>report.errors.push(e.message));await page.setViewportSize({width:1366,height:768});await page.waitForSelector('main[data-models=true]',{timeout:45000});
 for(const state of (process.env.MIZU_PROOF_STATES || 'hold,north-east-turn1,inverted,crouch,release5').split(',')){
  await page.evaluate(state=>window.__mizuBow.pose(state),state);
  for(const before of [true,false]){
   const key=`${state}-${before?'before':'after'}`;
   if(existsSync(`${root}/${key}.png`))continue;
   report.states[key]=await page.evaluate(before=>{const p=window.__mizuBow;p.compare(before);return p.inspect();},before);
   // Direct compositor capture avoids the Playwright screenshot/fonts
   // pipeline that timed out after a successful WebGL draw in turn1.
   const capture=await page.context().newCDPSession(page);
   try{
    await page.bringToFront();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{window.__mizuBow.draw();requestAnimationFrame(resolve);})));
    const {data}=await Promise.race([capture.send('Page.captureScreenshot',{format:'png',fromSurface:true}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('CDP capture deadline90s')),90000).unref())]);
    await writeFile(`${root}/${key}.png`,Buffer.from(data,'base64'));
   }
   finally{await capture.detach();}
  }
 }
 // Front-facing detail complements arena-plane profile; never substitute for gameplay.
 await page.evaluate(()=>{window.__mizuBow.pose('hold',0);window.__mizuBow.compare(false);});await page.screenshot({path:`${root}/hold-front.png`,timeout:90000});
 await page.evaluate(()=>{const p=window.__mizuBow;p.pose('hold');p.game=true;p.draw();});await page.screenshot({path:`${root}/game-hold.png`,timeout:90000});
 await page.setViewportSize({width:900,height:1000});await page.screenshot({path:`${root}/game-900x1000.png`,timeout:90000});
 await page.setViewportSize({width:360,height:800});await page.screenshot({path:`${root}/game-360x800.png`,timeout:90000});
 assert.match(Object.values(report.states)[0].renderer,/NVIDIA/i);
 assert.deepEqual(report.errors,[]);
}catch(e){report.failure=e.stack;throw e;}
finally{await browser.close();report.finish=JSON.parse(execFileSync('agent-bench-web',['--bench',bench,'--mission',mission,'finish'],{encoding:'utf8'}));await writeFile(`${root}/gpu-proof.json`,JSON.stringify(report,null,2)+'\n');}
