import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='/home/lol/.hermes/despachos/1107-082604-melhorias-do-last-arrow/anexos';
const browser=await chromium.connectOverCDP('http://127.0.0.1:19082');
const page=browser.contexts()[0].pages().find(p=>p.url().includes(':6139/'));
const report={errors:[],cases:[]}; page.on('pageerror',e=>report.errors.push(String(e)));
try {
 await page.setViewportSize({width:1366,height:768});
 await page.goto('http://127.0.0.1:6139/iframe.html?id=arena-visual-legivel--mira&viewMode=story');
 await page.waitForSelector('main[data-models=true]');
 report.pose=await page.evaluate(()=>{
  const b=window.__visualBench;b.frozen=true;const f=b.world.fighters[0], v=b.fighters.views[0];
  Object.assign(f,{aimX:Math.SQRT1_2,aimY:-Math.SQRT1_2,charging:true,charge:.35});
  const sample=()=>({spines:[v.rig.spine1,v.rig.spine2].map(n=>n.quaternion.toArray()),pitch:[v.rig.spine1,v.rig.spine2].map(n=>n.quaternion.angleTo(v.rig.pitchBase.get(n))),visual:b.fighters.inspect()[0],legs:Object.fromEntries(Object.entries(v.rig.aimLegs).map(([n,a])=>[n,a.getEffectiveWeight()]))});
  for(let i=0;i<120;i++)b.fighters.update(b.world,1,2,1/60);const start=sample();
  for(let i=0;i<600;i++)b.fighters.update(b.world,1,2+i/60,1/60);const held=sample();
  Object.assign(f,{vx:5,grounded:true});for(let i=0;i<60;i++)b.fighters.update(b.world,1,12+i/60,1/60);const strafe=sample();
  Object.assign(f,{crouching:true});b.fighters.update(b.world,1,13,1/60);const crouch=sample();
  Object.assign(f,{crouching:false,grounded:false,vy:-5});b.fighters.update(b.world,1,13,1/60);const jump=sample();
  Object.assign(f,{grounded:true,vx:0,vy:0});b.fighters.update(b.world,1,13,1/60);
  b.time=2;b.arena.draw(2,0);return {start,held,strafe,crouch,jump};
 });
 for(let bone=0;bone<2;bone++)assert.ok(Math.abs(report.pose.start.pitch[bone]-report.pose.held.pitch[bone])<1e-6,'procedural pitch relative to animated base must not accumulate in 10 sec');
 assert.equal(report.pose.strafe.visual.state,'shoot');assert.ok(report.pose.strafe.legs.run>0);
 assert.ok(report.pose.jump.legs.jump>0);
 await page.screenshot({path:`${out}/visual-aim-after.png`});
 for(const size of [{width:1366,height:768},{width:900,height:1000},{width:360,height:800}]){
  await page.setViewportSize(size);
  await page.evaluate(()=>{const b=window.__visualBench;b.arena.resize(innerWidth,innerHeight);b.arena.draw(2,0);});
  const gate=await page.evaluate(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {area:r.width*r.height/innerWidth/innerHeight,top:r.top,overflow:document.documentElement.scrollWidth>innerWidth};});
  assert.ok(gate.area>=.4&&gate.top<.85*size.height&&!gate.overflow);report.cases.push({size,gate});
  await page.screenshot({path:`${out}/visual-aim-${size.width}x${size.height}.png`});
 }
 assert.deepEqual(report.errors,[]);
}finally{await writeFile(`${out}/visual-aim-report.json`,JSON.stringify(report,null,2));await browser.close();}
console.log('Aim hold 10s, strafe, crouch, jump, 3 viewports: passed');
