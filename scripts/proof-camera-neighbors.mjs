import { chromium } from 'playwright-core';
import { writeFile, appendFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.TLA_EVIDENCE??'/home/lol/.hermes/despachos/1107-082604-melhorias-do-last-arrow/camera-evidencias';
const browser=await chromium.connectOverCDP(process.env.TLA_CDP??'http://127.0.0.1:19080');
let page; const report={errors:[],ownTabsAtEnd:null};
try {
  for(const p of browser.contexts()[0].pages()) { const c=await p.context().newCDPSession(p);const {targetInfo}=await c.send('Target.getTargetInfo');await c.detach();if(targetInfo.targetId===process.env.TLA_TAB)page=p; }
  assert.ok(page);
  await appendFile(`${out}/web-events.ndjson`,JSON.stringify({pid:process.pid,mission:'camera-continua',tab:process.env.TLA_TAB,action:'attach-neighbors'})+'\n');
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.setViewportSize({width:1366,height:768});
  await page.goto('http://127.0.0.1:6140/iframe.html?id=arena-camera-legibilidade--proxima-extremos&viewMode=story');
  await page.waitForSelector('#game[data-models=true]');
  report.motion=await page.evaluate(()=>{
    const b=window.__cameraBench,a=b.arena,[p,q]=b.world.fighters;
    const draw=()=> { b.time+=1/60;a.cameraTarget=p.alive?{x:p.x,y:18-p.y}:undefined;b.fighters.update(b.world,1,b.time,0);a.draw(b.time,0);b.hud.update(b.world,false,a.camera,b.time);return {camera:a.camera.position.toArray(),markers:[...document.querySelectorAll('.overhead')].map(el=>({direction:el.dataset.direction,visible:getComputedStyle(el).display!=='none',text:el.textContent}))}; };
    const set=(x,y)=>{Object.assign(p,{x,y,prevX:x,prevY:y});return draw();};
    const start=set(.1,15),wrappedX=set(31.9,15);Object.assign(q,{x:2,prevX:2});const rivalLeft=draw();
    const top=set(16,.1),bottom=set(16,17.9);
    p.alive=false;const death=draw();p.alive=true;const respawn=set(2,15.45);
    Object.assign(q,{x:30,prevX:30});const rivalRight=draw();q.alive=false;const rivalDead=draw();q.alive=true;const rivalRespawn=draw();
    // Camera distance remains fixed through seams, death and a rival's teleport.
    return {start,wrappedX,rivalLeft,top,bottom,death,respawn,rivalRight,rivalDead,rivalRespawn};
  });
  const m=report.motion;
  assert.ok(m.start.camera[0]<14&&m.wrappedX.camera[0]>18);
  assert.ok(m.top.camera[1]>10&&m.bottom.camera[1]<8);
  assert.equal(m.death.camera[0],16);assert.ok(m.respawn.camera[0]<14);
  assert.equal(m.rivalLeft.markers[1].direction,'←');assert.equal(m.rivalRight.markers[1].direction,'→');
  assert.equal(m.rivalDead.markers[1].visible,false);assert.equal(m.rivalRespawn.markers[1].visible,true);
  assert.ok(Object.values(m).every(s=>Math.abs(s.camera[2]-m.start.camera[2])<1e-9));
  report.projection=[];
  for(const [width,height]of [[1366,768],[900,1000],[360,800]]) {
    await page.setViewportSize({width,height});
    for(const close of [true,false]) {
      const result=await page.evaluate(({close})=>{
        const b=window.__cameraBench,a=b.arena,canvas=document.querySelector('canvas'),r=canvas.getBoundingClientRect();
        a.closeCamera=close;a.resize(r.width,r.height);b.time+=1/60;a.draw(b.time,0);b.hud.update(b.world,false,a.camera,b.time);
        const expected={x:22,y:10},v=a.camera.position.clone().set(expected.x,18-expected.y,.55).project(a.camera);
        const screen={x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};
        const actual=a.pointerOnArena(screen.x,screen.y);
        const labels=[...document.querySelectorAll('.overhead')].filter(el=>getComputedStyle(el).display!=='none');
        const blockers=[...document.querySelectorAll('.scoreboard,.arena-footer,.mute-toggle,.camera-toggle')];
        const overlap=(a,b)=>Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top);
        return {close,actual,expected,error:Math.hypot(actual.x-expected.x,actual.y-expected.y),aspect:a.camera.aspect,
          overlaps:labels.flatMap((l,i)=>blockers.filter(e=>overlap(l.getBoundingClientRect(),e.getBoundingClientRect())).map(e=>({i,blocker:e.className}))),camera:a.camera.position.toArray()};
      },{close});
      assert.ok(result.error<1e-9);assert.deepEqual(result.overlaps,[]);report.projection.push({width,height,...result});
    }
  }
  await page.setViewportSize({width:1366,height:768});
  await page.screenshot({path:`${out}/neighbors-wide.png`});
  assert.deepEqual(report.errors,[]);
}catch(e){report.failure=e.stack;throw e;}
finally{if(page&&!page.isClosed())await page.close();report.ownTabsAtEnd=0;await writeFile(`${out}/neighbors-report.json`,JSON.stringify(report,null,2));await appendFile(`${out}/web-events.ndjson`,JSON.stringify({pid:process.pid,mission:'camera-continua',tab:process.env.TLA_TAB,action:'close-neighbors'})+'\n');await browser.close();}
console.log('wrap X/Y, death/respawn, fixed distance, pointer round trip and HUD overlap: passed');
