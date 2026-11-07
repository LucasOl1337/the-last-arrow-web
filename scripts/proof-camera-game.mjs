import { chromium } from 'playwright-core';
import { WebSocket } from 'ws';
import { writeFile, appendFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.TLA_EVIDENCE??'/home/lol/.hermes/despachos/1107-082604-melhorias-do-last-arrow/camera-evidencias';
const base=process.env.TLA_URL??'http://127.0.0.1:5190/the-last-arrow-web/';
const label=base.startsWith('https')?'public':'local';
const browser=await chromium.connectOverCDP(process.env.TLA_CDP??'http://127.0.0.1:19080');
let page,peer;const report={base,tests:[],errors:[],ownTabsAtEnd:null};
try {
  for(const p of browser.contexts()[0].pages()){const s=await p.context().newCDPSession(p);const {targetInfo}=await s.send('Target.getTargetInfo');await s.detach();if(targetInfo.targetId===process.env.TLA_TAB)page=p;}
  assert.ok(page);await appendFile(`${out}/web-events.ndjson`,JSON.stringify({pid:process.pid,mission:'camera-continua',tab:process.env.TLA_TAB,action:'attach-game',label})+'\n');
  page.on('pageerror',e=>report.errors.push(e.message));await page.setViewportSize({width:1366,height:768});await page.goto(base);
  if(label==='public') {
    report.version=await page.evaluate(()=>fetch('/version.json',{cache:'no-store'}).then(r=>r.json()));
    if(process.env.TLA_EXPECTED_SHA)assert.equal(report.version.revision,process.env.TLA_EXPECTED_SHA);
    await page.screenshot({path:`${out}/public-menu.png`});
  }
  await page.getByRole('button',{name:'Controles',exact:true}).click();
  const select=page.getByRole('combobox',{name:'Layout de controles'});report.presets=await select.locator('option').count();assert.equal(report.presets,5);
  await select.selectOption('mouse-space');const binding=page.locator('[data-action=camera]');
  if(await binding.textContent()!=='B'){await binding.click();await page.keyboard.press('b');}
  await page.reload();await page.getByRole('button',{name:'Controles',exact:true}).click();assert.equal(await binding.textContent(),'B');
  await page.getByRole('button',{name:'Voltar',exact:true}).click();
  await page.evaluate(()=>window.__tla.startMatch({humans:1,bots:1,map:'totem',seed:42}));
  await page.waitForFunction(()=>window.__tla.diagnostics().models&&window.__tla.world.phase==='playing');
  await page.evaluate(()=>{window.__tla.setTimeScale(0);window.__tla.world.fighters.forEach((f,i)=>Object.assign(f,{x:i?30:2,prevX:i?30:2,y:15.45,prevY:15.45,invulnerable:100,grounded:true}));});
  await page.waitForFunction(()=>document.querySelectorAll('.overhead')[1]?.dataset.direction==='→');
  await page.waitForFunction(()=>!document.querySelector('.countdown').textContent.trim());
  await page.screenshot({path:`${out}/${label}-game-close.png`});
  await page.keyboard.press('b');await page.waitForFunction(()=>!window.__tla.state().cameraClose);
  await page.waitForFunction(()=>document.querySelectorAll('.overhead')[1]?.dataset.direction==='');
  await page.keyboard.press('c');assert.equal(await page.evaluate(()=>window.__tla.state().cameraClose),false);
  await page.keyboard.press('b');await page.waitForFunction(()=>window.__tla.state().cameraClose);report.tests.push('all five presets retained; B camera rebind persists across reload; C no longer toggles; near/wide indicator parity');
  // The actual input path still aims at the right/up quadrant after the close/wide remap.
  const canvas=await page.locator('#game canvas').boundingBox();
  await page.mouse.move(canvas.x+canvas.width*.65,canvas.y+canvas.height*.35);
  await page.evaluate(()=>window.__tla.setTimeScale(1));
  await page.waitForFunction(()=>{const f=window.__tla.world.fighters[0];return f.aimX>.5&&f.aimY<0;});
  report.aim=await page.evaluate(()=>{const f=window.__tla.world.fighters[0];window.__tla.setTimeScale(0);return{x:f.aimX,y:f.aimY};});
  report.tests.push('production mouse input retains right/up world direction after camera toggles');
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Voltar ao menu',exact:true}).click();
  await page.getByRole('button',{name:'Jogar online',exact:true}).click();await page.getByRole('button',{name:'Criar sala',exact:true}).click();
  await page.locator('.online-panel [role=status]').filter({hasText:'esperando'}).waitFor();
  const room=new URL(await page.getByRole('textbox',{name:'Link do convite'}).inputValue()).searchParams.get('room');
  const wsUrl=label==='public'?'wss://arrow.symbiose.si/ws':'ws://127.0.0.1:8890/ws';
  peer=new WebSocket(wsUrl,{origin:new URL(base).origin});let received=0;
  let resolvePlaying;const peerPlaying=new Promise(resolve=>{resolvePlaying=resolve;});
  peer.on('message',v=>{const m=JSON.parse(v);if(m.type==='start')peer.send(JSON.stringify({type:'ready'}));if(m.type==='state'){received++;if(m.world.phase==='playing')resolvePlaying();}});
  await new Promise((r,j)=>{peer.once('open',r);peer.once('error',j);});peer.send(JSON.stringify({type:'join',room}));
  // The previous offline world is still 'playing' while the network handshake is in flight.
  // Wait for this room's authoritative playing event and visible canvas, not that stale world.
  let deadline;try{await Promise.race([peerPlaying,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(new Error('peer did not enter playing')),30000);})]);}finally{clearTimeout(deadline);}
  await page.waitForFunction(()=>!document.querySelector('#game').hidden&&window.__tla.diagnostics().models&&window.__tla.world.phase==='playing'&&window.__tla.state().online);
  assert.equal(await page.evaluate(()=>window.__tla.state().cameraClose),true);
  await page.keyboard.press('b');await page.waitForFunction(()=>!window.__tla.state().cameraClose);
  await page.keyboard.press('b');await page.waitForFunction(()=>window.__tla.state().cameraClose);
  report.online=await page.evaluate(()=>({state:window.__tla.state().online,models:window.__tla.diagnostics().models,labels:[...document.querySelectorAll('.overhead')].map(l=>({hidden:l.hidden,direction:l.dataset.direction,text:l.textContent}))}));
  assert.ok(received>0);report.online.peerSnapshots=received;report.tests.push('real online match: two fighters, loaded models, authoritative peer snapshots and rebound near/wide toggle');
  await page.waitForFunction(()=>!document.querySelector('.countdown').textContent.trim());
  await page.screenshot({path:`${out}/${label}-online.png`});
  assert.deepEqual(report.errors,[]);
}catch(e){report.failure=e.stack;throw e;}
finally{peer?.terminate();if(page&&!page.isClosed()&&!process.env.TLA_KEEP_TAB)await page.close();report.ownTabsAtEnd=page&&!page.isClosed()?1:0;await writeFile(`${out}/${label}-game-report.json`,JSON.stringify(report,null,2));await appendFile(`${out}/web-events.ndjson`,JSON.stringify({pid:process.pid,mission:'camera-continua',tab:process.env.TLA_TAB,action:report.ownTabsAtEnd?'retain-next-proof':'close-game',label})+'\n');await browser.close();}
console.log(JSON.stringify(report,null,2));
