import {chromium} from 'playwright-core';
import {WebSocket} from 'ws';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const [out,url,expected]=process.argv.slice(2),bench='arrow-mizu-neighbors',mission='mizu-neighbors-1107';
const cli=(...args)=>JSON.parse(execFileSync('agent-bench',args,{encoding:'utf8'}));
assert.ok(cli('fila').vagas.some(v=>v.bench===bench));assert.equal(cli('status',bench).control_mode,'agente');assert.equal(cli('browser-status',bench).lives_in,bench);
const {tab}=JSON.parse(await readFile(`${out}/tab.json`,'utf8')),{webSocketDebuggerUrl}=JSON.parse(await readFile(`${out}/cdp.json`,'utf8'));
const browser=await chromium.connectOverCDP(webSocketDebuggerUrl);let page,peer;const report={errors:[],states:{},snapshots:0};
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
try{
 for(const p of browser.contexts()[0].pages()){const s=await p.context().newCDPSession(p);const {targetInfo}=await s.send('Target.getTargetInfo');await s.detach();if(targetInfo.targetId===tab)page=p;}
 assert.ok(page);page.on('pageerror',e=>report.errors.push(e.message));await page.setViewportSize({width:1366,height:768});await page.goto(url);
 if(expected){report.version=await page.evaluate(()=>fetch('/version.json',{cache:'no-store'}).then(r=>r.json()));assert.equal(report.version.revision,expected);}
 await page.evaluate(()=>window.__tla.startMatch({humans:2,bots:0,map:'totem',seed:42,characters:['mizu','stormdragon']}));
 await page.waitForFunction(()=>window.__tla.diagnostics().models&&window.__tla.world.phase==='playing'&&!document.querySelector('.countdown').textContent.trim());
 await page.evaluate(()=>{window.__tla.world.fighters.forEach(f=>{f.invulnerable=100;});});
 const box=await page.locator('#game canvas').boundingBox();await page.mouse.move(box.x+box.width*.8,box.y+box.height*.5);await page.mouse.down();
 await page.waitForFunction(()=>Math.abs(window.__tla.visuals()[0].animationTime-.18)<1e-6);
 await page.evaluate(()=>window.__tla.setTimeScale(0));
 for(const state of ['hold','inverted','crouch']){
  await page.evaluate(state=>{const f=window.__tla.world.fighters[0];Object.assign(f,{charging:true,charge:.35,aimX:state==='hold'?1:state==='inverted'?-Math.SQRT1_2:Math.SQRT1_2,aimY:state==='hold'?0:state==='inverted'?-Math.SQRT1_2:Math.SQRT1_2,facing:state==='inverted'?-1:1,crouching:state==='crouch'});},state);
  await page.evaluate(()=>new Promise(resolve=>{let n=0;const step=()=>{if(++n===120)resolve();else requestAnimationFrame(step);};requestAnimationFrame(step);}));
  const data=await page.evaluate(()=>({visuals:window.__tla.visuals(),diagnostics:window.__tla.diagnostics()}));const v=data.visuals[0];
  assert.ok(v.equippedBow?.visible);assert.ok(distance(v.equippedBow.grip,v.bowHand)<1e-7);assert.ok(distance(v.equippedBow.nock,v.nockTail)<1e-7);assert.equal(data.visuals[1].equippedBow,null);
  report.states[state]=data;
  const s=await page.context().newCDPSession(page);try{const {data}=await s.send('Page.captureScreenshot',{format:'png',fromSurface:true});await writeFile(`${out}/${state}.png`,Buffer.from(data,'base64'));}finally{await s.detach();}
 }
 await page.mouse.up();await page.keyboard.press('Escape');await page.getByRole('button',{name:'Voltar ao menu',exact:true}).click();
 if(expected){
  await page.getByRole('button',{name:'Jogar online',exact:true}).click();await page.getByRole('button',{name:'Criar sala',exact:true}).click();await page.locator('.online-panel [role=status]').filter({hasText:'esperando'}).waitFor();
  const room=new URL(await page.getByRole('textbox',{name:'Link do convite'}).inputValue()).searchParams.get('room'),u=new URL('/ws',url);u.protocol=u.protocol==='https:'?'wss:':'ws:';
  peer=new WebSocket(u,{origin:new URL(url).origin});let resolve;const playing=new Promise(r=>resolve=r);
  peer.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='start')peer.send(JSON.stringify({type:'ready'}));if(m.type==='state'){report.snapshots++;if(m.world.phase==='playing')resolve();}});
  await new Promise((r,j)=>{peer.once('open',r);peer.once('error',j);});peer.send(JSON.stringify({type:'join',room}));
  let timer;try{await Promise.race([playing,new Promise((_,j)=>{timer=setTimeout(()=>j(new Error('online deadline')),30000);})]);}finally{clearTimeout(timer);}
  await page.waitForFunction(()=>window.__tla.state().online&&window.__tla.diagnostics().models&&window.__tla.world.phase==='playing'&&!document.querySelector('.countdown').textContent.trim());
  report.online=await page.evaluate(()=>({state:window.__tla.state(),visuals:window.__tla.visuals()}));assert.ok(report.snapshots>0);assert.ok(report.online.visuals.some(v=>v.equippedBow?.visible));
  const s=await page.context().newCDPSession(page);try{const {data}=await s.send('Page.captureScreenshot',{format:'png',fromSurface:true});await writeFile(`${out}/online.png`,Buffer.from(data,'base64'));}finally{await s.detach();}
 }
 assert.deepEqual(report.errors,[]);
}catch(e){report.failure=e.stack;throw e;}
finally{peer?.terminate();await browser.close();report.finish=JSON.parse(execFileSync('agent-bench-web',['--bench',bench,'--mission',mission,'finish'],{encoding:'utf8'}));await writeFile(`${out}/proof.json`,JSON.stringify(report,null,2)+'\n');}
