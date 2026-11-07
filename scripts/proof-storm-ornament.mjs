import { chromium } from 'playwright-core';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root = process.argv[2];
const bench = 'arrow-storm-arma', mission = 'storm-arma-1107';
const cli = (...a) => JSON.parse(execFileSync('agent-bench',a,{encoding:'utf8'}));
assert.ok(cli('fila').vagas.some(v=>v.bench===bench));
assert.equal(cli('status',bench).control_mode,'agente');
assert.equal(cli('browser-status',bench).lives_in,bench);
const {tab}=JSON.parse(await readFile(`${root}/tab.json`,'utf8'));
const cdp=JSON.parse(await readFile(`${root}/cdp.json`,'utf8'));
const browser=await chromium.connectOverCDP(cdp.webSocketDebuggerUrl);
const report={errors:[],states:{}};
try {
 let page;
 for(const p of browser.contexts()[0].pages()) {const s=await p.context().newCDPSession(p);const {targetInfo}=await s.send('Target.getTargetInfo');await s.detach();if(targetInfo.targetId===tab)page=p;}
 assert.ok(page);page.on('pageerror',e=>report.errors.push(String(e)));
 await page.setViewportSize({width:1366,height:768});await page.waitForSelector('main[data-models=true]');
 report.renderer=await page.evaluate(()=>window.__bowSockets.rendererInfo());
 for(const state of ['rest','hold','hold10s','release','inverted','crouch','jump']) {
  await page.evaluate(state=>window.__bowSockets.pose(1,state,0),state);
  report.states[state]={};
  for(const before of [true,false]) {
   const key=before?'before':'after';
   report.states[state][key]=await page.evaluate(before=>{
    const b=window.__bowSockets;b.compareSkin(before);const m=b.mesh();
    return {points:[18817,19287,19351,19362].map(v=>b.vertex(v)),bones:['mixamorigLeftHand','mixamorigLeftHandMiddle3'].map(n=>m.skeleton.bones.find(b=>b.name===n).matrixWorld.toArray())};
   },before);
   await page.screenshot({path:`${root}/${state}-${key}.png`,timeout:90000});
  }
 }
 await writeFile(`${root}/gpu-proof.json`,JSON.stringify(report,null,2));
} finally {
 await browser.close();
 execFileSync('agent-bench-web',['--bench',bench,'--mission',mission,'finish'],{stdio:'inherit'});
}
