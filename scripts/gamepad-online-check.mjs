// Actual authoritative online room; Gamepad API inputs are explicitly SIMULATED.
import { chromium } from 'playwright-core';
import { WebSocket } from 'ws';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.TLA_PROOF_URL || 'https://arrow.symbiose.si/';
const out=process.env.TLA_OUT || '/home/lol/.hermes/despachos/1107-082604-melhorias-do-last-arrow/evidencias/gamepad/public-online';
await mkdir(out,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:19085');
const context=browser.contexts()[0];let page,peer,latest;
const report={simulated:true,hardwareVerified:false,base,events:[],errors:[],snapshots:0};
const nextState=predicate=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{peer.off('message',onMessage);reject(new Error('Authoritative state timeout'));},15000);
  function onMessage(raw){const m=JSON.parse(raw);if(m.type==='state'&&predicate(m.world)){clearTimeout(timer);peer.off('message',onMessage);resolve(m.world);}}
  peer.on('message',onMessage);
});
try {
  for(const p of context.pages()){const s=await context.newCDPSession(p);const {targetInfo}=await s.send('Target.getTargetInfo');await s.detach();if(targetInfo.targetId===process.env.TLA_TAB)page=p;}
  assert.ok(page,'registered mission tab missing');page.on('pageerror',e=>report.errors.push(String(e)));
  await page.setViewportSize({width:1366,height:768});
  await page.addInitScript(()=>{
    window.simPads=[];Object.defineProperty(navigator,'getGamepads',{value:()=>window.simPads});
    window.setSimPad=(index,buttons=[],axes=[0,0])=>{window.simPads[index]={index,id:`SIMULATED-${index}`,connected:true,mapping:'standard',axes,buttons:Array.from({length:17},(_,n)=>({pressed:buttons.includes(n),value:Number(buttons.includes(n))}))};};
  });
  await page.goto(base);await page.locator('#mode').waitFor();
  await page.evaluate(()=>{window.setSimPad(3);window.setSimPad(6);window.dispatchEvent(new Event('focus'));});
  await page.waitForFunction(()=>document.querySelector('.gamepad-status')?.textContent.includes('P1 + P2'));
  await page.getByRole('button',{name:'Jogar online',exact:true}).click();await page.getByRole('button',{name:'Criar sala',exact:true}).click();
  await page.locator('.online-panel [role=status]').filter({hasText:'esperando'}).waitFor();
  const room=new URL(await page.getByRole('textbox',{name:'Link do convite'}).inputValue()).searchParams.get('room');report.room=room;
  const url=new URL(base);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname='/ws';url.search='';
  peer=new WebSocket(url,{origin:new URL(base).origin});
  peer.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='start')peer.send(JSON.stringify({type:'ready'}));if(m.type==='state'){latest=m.world;report.snapshots++;report.events.push(...m.events.filter(e=>e.actor===0));}});
  await new Promise((r,j)=>{peer.once('open',r);peer.once('error',j);});peer.send(JSON.stringify({type:'join',room}));
  await page.waitForFunction(()=>window.__tla.state().online && window.__tla.world.phase==='playing' && window.__tla.world.fighters[0].grounded);
  await page.evaluate(()=>{window.setSimPad(3);window.setSimPad(6);});await page.waitForTimeout(150);
  // P2 local is not routed to the server's local P1 intent.
  const origin=await nextState(w=>w.phase==='playing'&&w.fighters[0].grounded);
  await page.evaluate(()=>window.setSimPad(6,[2],[1,0]));await page.waitForTimeout(250);
  assert.equal(latest.fighters[0].charging,false);assert.equal(latest.fighters[0].ammo,3);assert.ok(Math.abs(latest.fighters[0].x-origin.fighters[0].x)<0.01);
  await page.evaluate(()=>{window.setSimPad(6);window.setSimPad(3,[],[-1,0]);});
  const moving=await nextState(w=>w.fighters[0].vx< -0.1);assert.ok(moving.fighters[0].x<origin.fighters[0].x);
  await page.evaluate(()=>window.setSimPad(3));await nextState(w=>Math.abs(w.fighters[0].vx)<0.01);
  await page.evaluate(()=>window.setSimPad(3,[0]));await nextState(w=>w.fighters[0].vy< -0.1);
  await page.evaluate(()=>window.setSimPad(3));await nextState(w=>w.fighters[0].grounded);
  await page.evaluate(()=>window.setSimPad(3,[2],[1,-1]));
  const aiming=await nextState(w=>w.fighters[0].charging);assert.ok(Math.abs(aiming.fighters[0].aimX-Math.SQRT1_2)<1e-6);assert.ok(Math.abs(aiming.fighters[0].aimY+Math.SQRT1_2)<1e-6);
  await page.screenshot({path:`${out}/gamepad-online-aim.png`});
  await page.evaluate(()=>window.setSimPad(3));await nextState(w=>w.fighters[0].ammo===2&&!w.fighters[0].charging);
  await page.evaluate(()=>window.setSimPad(3,[7],[-1,0]));await nextState(w=>w.fighters[0].dashCooldown>0);
  await page.evaluate(()=>window.setSimPad(3));await nextState(w=>w.fighters[0].grounded&&w.fighters[0].shotCooldown<=0);
  // Disconnect while drawing must send cancellation, never a release shot.
  await page.evaluate(()=>window.setSimPad(3,[2]));await nextState(w=>w.fighters[0].charging);
  const ammo=latest.fighters[0].ammo;await page.evaluate(()=>{window.simPads[3]=null;});await nextState(w=>!w.fighters[0].charging);assert.equal(latest.fighters[0].ammo,ammo);
  // Reconnect at a new index, pause held draw and resume with fresh neutral state.
  await page.evaluate(()=>window.setSimPad(8));await page.waitForTimeout(120);
  await page.evaluate(()=>window.setSimPad(8,[2]));await nextState(w=>w.fighters[0].charging);
  await page.evaluate(()=>window.setSimPad(8,[2,9]));await page.waitForFunction(()=>window.__tla.state().paused);
  await nextState(w=>!w.fighters[0].charging);assert.equal(latest.fighters[0].ammo,ammo);
  await page.screenshot({path:`${out}/gamepad-online-pause.png`});
  await page.evaluate(()=>window.setSimPad(8));await page.waitForTimeout(120);
  await page.evaluate(()=>window.setSimPad(8,[0]));await page.waitForFunction(()=>!window.__tla.state().paused);
  await page.evaluate(()=>window.setSimPad(8));await page.waitForTimeout(160);assert.equal(latest.fighters[0].ammo,ammo);assert.equal(latest.fighters[0].charging,false);
  assert.ok(report.events.some(e=>e.type==='shoot'));assert.ok(report.events.some(e=>e.type==='jump'));assert.ok(report.events.some(e=>e.type==='dash'));
  assert.deepEqual(report.errors,[]);report.passed=true;report.disconnectCancelled=true;report.pauseCancelled=true;report.localP2DoesNotAliasP1=true;report.diagonalAimVerified=true;
} catch(e){report.failure=String(e.stack);throw e;}
finally {
  if(peer){peer.close();await new Promise(r=>{if(peer.readyState===WebSocket.CLOSED)return r();peer.once('close',r);setTimeout(()=>{peer.terminate();r();},1500).unref();});}
  if(page&&!page.isClosed()){await page.goto(base);}
  await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();
}
