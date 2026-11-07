import { chromium } from 'playwright-core';
import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { checkScreen } from './check-screen.mjs';
const out=process.env.TLA_EVIDENCE??'/home/lol/.hermes/despachos/1107-082604-melhorias-do-last-arrow/portrait-evidencias';
const mode=process.env.TLA_PHASE??'after',story=process.env.TLA_STORY??'http://127.0.0.1:6140';
await mkdir(out,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:19080');let page;
const report={mode,cases:[],errors:[],ownTabsAtEnd:null};
try{
 for(const p of browser.contexts()[0].pages()){const s=await p.context().newCDPSession(p);const {targetInfo}=await s.send('Target.getTargetInfo');await s.detach();if(targetInfo.targetId===process.env.TLA_TAB)page=p;}
 assert.ok(page,'registered mission tab required');page.on('pageerror',e=>report.errors.push(e.message));
 await appendFile(`${out}/web-events.ndjson`,JSON.stringify({mission:'portrait-camera',pid:process.pid,tab:process.env.TLA_TAB,action:'attach',mode})+'\n');
 for(const [width,height]of [[1366,768],[900,1000],[360,800]]){
  await page.setViewportSize({width,height});
  for(const close of [true,false]){
   assert.ok(JSON.parse(execFileSync('agent-bench',['fila'],{encoding:'utf8'})).vagas.some(v=>v.bench==='arrow-camera'),'GPU lease');
   await page.goto(`${story}/iframe.html?id=arena-camera-legibilidade--${close?'proxima':'ampla'}-extremos&viewMode=story`);
   await page.waitForSelector('#game[data-models=true]');
   const metrics=await page.evaluate(()=>{
    const {world,arena}=window.__cameraBench,r=document.querySelector('canvas').getBoundingClientRect();
    const project=(x,y,z=.6)=>{const v=arena.camera.position.clone().set(x,y,z).project(arena.camera);return{x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};};
    const overlap=(a,b)=>Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top);
    const blockers=[...document.querySelectorAll('.scoreboard,.arena-footer,.camera-toggle,.mute-toggle')];
    const bodies=world.fighters.map((f,i)=>{
     const head=project(f.x,18-f.y+1.85),feet=project(f.x,18-f.y-.55),left=project(f.x-.6,18-f.y),right=project(f.x+.6,18-f.y);
     const label=document.querySelectorAll('.overhead')[i],lr=label.getBoundingClientRect(),arrow=label.querySelector('.wrap-direction');
     return {head,feet,heightPx:feet.y-head.y,fullyVisible:left.x>=r.left&&right.x<=r.right&&head.y>=r.top&&feet.y<=r.bottom,
      marker:{text:arrow.textContent,visible:!arrow.hidden,fontPx:parseFloat(getComputedStyle(label.querySelector('.fighter-label')).fontSize),inside:lr.left>=r.left&&lr.right<=r.right&&lr.top>=r.top&&lr.bottom<=r.bottom},
      overlaps:blockers.filter(b=>overlap(lr,b.getBoundingClientRect())).map(b=>b.className)};
    });
    // Area is the actual world plane z0; body/label measurements remain at their own z.6.
    const a=project(0,18,0),b=project(32,0,0),origin=project(16,9),east=project(17,9),north=project(16,10);
    return {canvas:r.toJSON(),arenaProjectedFraction:Math.max(0,Math.min(r.right,b.x)-Math.max(r.left,a.x))*Math.max(0,Math.min(r.bottom,b.y)-Math.max(r.top,a.y))/(innerWidth*innerHeight),
     scaleRatio:(east.x-origin.x)/(origin.y-north.y),camera:arena.camera.position.toArray(),aspect:arena.camera.aspect,bodies,located:bodies.filter(b=>b.fullyVisible||(b.marker.visible&&b.marker.inside&&b.marker.fontPx>=12)).length,
     hud:blockers.map(el=>({class:el.className,rect:el.getBoundingClientRect().toJSON(),font:parseFloat(getComputedStyle(el).fontSize),visible:el.getBoundingClientRect().height>0})),
     hudOverlaps:blockers.flatMap((a,i)=>blockers.slice(i+1).filter(b=>overlap(a.getBoundingClientRect(),b.getBoundingClientRect())).map(b=>[a.className,b.className]))};
   });
   const gate=await checkScreen(page,'#game>canvas');
   const areaPass=metrics.arenaProjectedFraction>=.4;
   report.cases.push({width,height,close,metrics,areaPass,gate});
   await page.screenshot({path:`${out}/${mode}-${width}x${height}-${close?'close':'wide'}.png`});
   if(mode!=='before'){
    assert.equal(metrics.located,2);assert.ok(Math.abs(metrics.scaleRatio-1)<1e-9,'no anisotropic art stretching');
    assert.ok(metrics.bodies.every(b=>b.overlaps.length===0));
    if(width===360)assert.deepEqual(metrics.hudOverlaps,[]);
    assert.ok(metrics.hud.every(h=>h.visible),'no hidden HUD');
    if(close||width!==360){assert.ok(areaPass,'actual projected arena >=40%');assert.ok(gate.passou,JSON.stringify(gate));}
    else {assert.ok(metrics.bodies.every(b=>b.fullyVisible),'wide portrait still whole arena');assert.equal(areaPass,false,'whole-arena wide limit must remain explicit');}
   }
  }
 }
 assert.deepEqual(report.errors,[]);
}catch(e){report.failure=e.stack;throw e;}
finally{if(page&&!page.isClosed()&&!process.env.TLA_KEEP_TAB)await page.close();report.ownTabsAtEnd=page&&!page.isClosed()?1:0;await writeFile(`${out}/${mode}-report.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report.cases.map(c=>({size:[c.width,c.height],close:c.close,area:c.metrics.arenaProjectedFraction,located:c.metrics.located,gate:c.gate.passou})),null,2));
