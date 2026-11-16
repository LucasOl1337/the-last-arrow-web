import {chromium} from 'playwright-core';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {checkScreen} from '../scripts/check-screen.mjs';
const out=process.env.TLA_PROOF_DIR;assert.ok(out);await mkdir(out,{recursive:true});
const cli=(...a)=>JSON.parse(execFileSync('agent-bench-web',['--bench','tla-sombras-astra','--mission','sombras-arena-astra',...a],{encoding:'utf8'}));
cli('hygiene');const {tab}=cli('open','--url','http://127.0.0.1:6118/iframe.html?id=arena-visual-legivel--espaco-musgo&viewMode=story');
const b=await chromium.connectOverCDP('http://127.0.0.1:19086');const report={owner:'sombras-arena-astra',pid:process.pid,checks:[]};
try{
 let page;for(const p of b.contexts()[0].pages()){const s=await p.context().newCDPSession(p);const {targetInfo}=await s.send('Target.getTargetInfo');await s.detach();if(targetInfo.targetId===tab)page=p;}assert.ok(page);
 await page.waitForFunction(()=>window.__visualBench?.fighters.usingModels);
 for(const [width,height] of [[1366,768],[900,1000],[360,800]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(160);
  const state=await page.evaluate(()=>{
   const {arena:a,world:w}=window.__visualBench;
   a.camera.updateMatrixWorld();
   const x=innerWidth*.61,y=innerHeight*.57;
   const pointer=a.pointerOnArena(x,y);
   const projected=a.camera.position.clone().set(pointer.x,18-pointer.y,.55).project(a.camera);
   const pixel={x:(projected.x+1)/2*innerWidth,y:(1-projected.y)/2*innerHeight};
   return {pointer,pixel,expected:{x,y},viewport:[innerWidth,innerHeight],rows:w.level.rows,platforms:w.level.platforms};
  });
  assert.ok(Number.isFinite(state.pointer.x));assert.ok(Number.isFinite(state.pointer.y));
  assert.ok(Math.hypot(state.pixel.x-state.expected.x,state.pixel.y-state.expected.y)<.01,'production pointer projection survives resize');
  const gate=await checkScreen(page,'main');assert.deepEqual(gate.falhas,[]);
  report.checks.push({...state,gate});await page.screenshot({path:`${out}/story-${width}x${height}.png`});
 }
}finally{report.cleanup=cli('finish');report.hygiene=cli('hygiene');await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await b.close();}
