import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='/home/lol/.hermes/despachos/1107-082604-melhorias-do-last-arrow/anexos';
const browser=await chromium.connectOverCDP('http://127.0.0.1:19082');
const page=browser.contexts()[0].pages().find(p=>p.url().includes(':6139/'));
const report={cases:[],errors:[]};page.on('pageerror',e=>report.errors.push(String(e)));
try{
 await page.setViewportSize({width:1366,height:768});
 await page.goto('http://127.0.0.1:6139/iframe.html?id=arena-visual-legivel--textura-totem&viewMode=story');
 await page.waitForSelector('main[data-models=true]');
 report.camera=await page.evaluate(()=>{
  const b=window.__visualBench;b.frozen=true;const a=b.arena; a.closeCamera=true;
  let t=20;const draw=(target,shake=0,focus,zoom=0)=>{a.cameraTarget=target;t+=1/60;a.draw(t,shake,focus,zoom);return {camera:a.camera.position.toArray(),follow:{x:a.followState.x,y:a.followState.y},layers:a.layers.map(l=>l.mesh.position.toArray())};};
  const top=draw({x:16,y:17.9}),bottom=draw({x:16,y:.1});
  const left=draw({x:.1,y:3}),right=draw({x:31.9,y:3});
  const shaken=draw({x:31.9,y:3},.2,{x:2,y:15},1),clean=draw({x:31.9,y:3});
  const dead=draw(undefined),respawn=draw({x:2,y:2});
  const driftStart=respawn.layers;for(let i=0;i<300;i++)draw({x:2,y:2});const driftEnd=draw({x:2,y:2}).layers;
  b.time=t;return{top,bottom,left,right,shaken,clean,dead,respawn,driftStart,driftEnd};
 });
 const r=report.camera;
 assert.ok(r.bottom.camera[1]<8);assert.ok(r.top.camera[1]>10);
 assert.ok(r.left.camera[0]<14&&r.right.camera[0]>18);
 assert.deepEqual(r.clean.camera.slice(0,2),[r.clean.follow.x,r.clean.follow.y]);
 assert.equal(r.dead.camera[0],16);assert.ok(r.respawn.camera[0]<14);
 assert.notDeepEqual(r.driftStart,r.driftEnd);
 await page.screenshot({path:`${out}/visual-camera-edge.png`});
 for(const size of [{width:900,height:1000},{width:1366,height:768}]){
  await page.setViewportSize(size);
  report.cases.push(await page.evaluate(size=>{const a=window.__visualBench.arena;a.resize(size.width,size.height);a.draw(30,0);return{size,camera:a.camera.position.toArray(),aspect:a.camera.aspect};},size));
 }
 assert.equal(report.cases[0].camera[1],9);
 assert.ok(report.cases[0].camera[2]>report.cases[1].camera[2]);
 assert.deepEqual(report.errors,[]);
}finally{await writeFile(`${out}/visual-camera-report.json`,JSON.stringify(report,null,2));await browser.close();}
console.log('Camera edges, x/y wrap, shake recovery, death/respawn, viewport and background drift: passed');
