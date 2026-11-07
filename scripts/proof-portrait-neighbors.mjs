import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.TLA_EVIDENCE??'/home/lol/.hermes/despachos/1107-082604-melhorias-do-last-arrow/portrait-evidencias';
const b=await chromium.connectOverCDP('http://127.0.0.1:19080');let page;const report={errors:[],resize:[]};
try{
 for(const p of b.contexts()[0].pages()){const s=await p.context().newCDPSession(p);const {targetInfo}=await s.send('Target.getTargetInfo');await s.detach();if(targetInfo.targetId===process.env.TLA_TAB)page=p;}assert.ok(page);
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.setViewportSize({width:360,height:800});await page.goto('http://127.0.0.1:6140/iframe.html?id=arena-camera-legibilidade--proxima-extremos&viewMode=story');await page.waitForSelector('#game[data-models=true]');
 report.motion=await page.evaluate(()=>{
  const {arena:a,world:w,hud,fighters}=window.__cameraBench;let t=30;const p=w.fighters[0];
  const sample=()=>{a.cameraTarget=p.alive?{x:p.x,y:18-p.y}:undefined;fighters.update(w,1,t,0);a.draw(t+=1/60,0);hud.update(w,false,a.camera,t);return {camera:a.camera.position.toArray(),labels:[...document.querySelectorAll('.overhead')].map(e=>({hidden:e.hidden,dir:e.dataset.direction}))};};
  const set=(x,y)=>{Object.assign(p,{x,y,prevX:x,prevY:y});return sample();};
  const left=set(.1,15),right=set(31.9,15),top=set(16,.1),bottom=set(16,17.9);p.alive=false;const dead=sample();p.alive=true;const respawn=set(2,15.45);return{left,right,top,bottom,dead,respawn};
 });
 const m=report.motion;assert.ok(m.left.camera[0]<8&&m.right.camera[0]>24);assert.ok(m.top.camera[1]>10&&m.bottom.camera[1]<8);assert.equal(m.dead.camera[0],16);assert.equal(m.dead.labels[0].hidden,true);assert.equal(m.respawn.labels[0].hidden,false);assert.equal(m.respawn.labels[1].dir,'→');assert.ok(Object.values(m).every(s=>s.camera[2]===m.left.camera[2]));
 for(const [width,height]of [[900,1000],[360,800],[1366,768]]){
  await page.setViewportSize({width,height});
  for(const close of [true,false]){
   const r=await page.evaluate(close=>{const {arena:a}=window.__cameraBench;a.closeCamera=close;a.resizeToCanvas();a.draw(40,0);const r=a.canvas.getBoundingClientRect(),expected={x:12,y:10};const v=a.camera.position.clone().set(expected.x,18-expected.y,.55).project(a.camera);const actual=a.pointerOnArena(r.left+(v.x+1)*r.width/2,r.top+(1-v.y)*r.height/2);return{canvas:r.toJSON(),aspect:a.camera.aspect,expected,actual,error:Math.hypot(actual.x-expected.x,actual.y-expected.y),z:a.camera.position.z};},close);
   assert.ok(r.error<1e-9);assert.ok(Math.abs(r.aspect-r.canvas.width/r.canvas.height)<1e-12);report.resize.push({width,height,close,...r});
  }
 }
 await page.setViewportSize({width:360,height:800});await page.goto('http://127.0.0.1:6140/iframe.html?id=arena-camera-legibilidade--quatro-retrato&viewMode=story');await page.waitForSelector('#game[data-models=true]');
 report.four=await page.evaluate(()=>{const canvas=document.querySelector('canvas').getBoundingClientRect(),score=document.querySelector('.scoreboard').getBoundingClientRect(),cards=[...document.querySelectorAll('.score-card')],labels=[...document.querySelectorAll('.overhead')];return {canvas:canvas.toJSON(),score:score.toJSON(),cardCount:cards.length,scoreBeforeArena:score.bottom<=canvas.top,cardFonts:cards.map(e=>parseFloat(getComputedStyle(e.querySelector('b')).fontSize)),labels:labels.map(e=>({rect:e.getBoundingClientRect().toJSON(),text:e.textContent})),area:canvas.width*canvas.height/(innerWidth*innerHeight),overflow:document.documentElement.scrollWidth>innerWidth};});
 assert.equal(report.four.cardCount,4);assert.ok(report.four.scoreBeforeArena);assert.ok(report.four.cardFonts.every(n=>n>=12));assert.ok(report.four.area>=.4);assert.equal(report.four.overflow,false);
 await page.screenshot({path:`${out}/four-360x800.png`});assert.deepEqual(report.errors,[]);
}catch(e){report.failure=e.stack;throw e;}finally{await writeFile(`${out}/neighbors-report.json`,JSON.stringify(report,null,2));await b.close();}
console.log('Portrait wrap/respawn, canvas offsets, near/wide resize/pointer, four-player scoreboard passed');
