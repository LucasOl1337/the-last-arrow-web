import { chromium } from 'playwright-core';
import { WebSocket } from 'ws';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const [out, expected] = process.argv.slice(2), bench='arrow-storm-arma',mission='storm-arma-1107';
const cli=(...args)=>JSON.parse(execFileSync('agent-bench',args,{encoding:'utf8'}));
assert.ok(cli('fila').vagas.some(v=>v.bench===bench));assert.equal(cli('status',bench).control_mode,'agente');assert.equal(cli('browser-status',bench).lives_in,bench);
const {tab}=JSON.parse(await readFile(`${out}/public-tab.json`,'utf8'));
const {webSocketDebuggerUrl}=JSON.parse(await readFile(`${out}/cdp.json`,'utf8'));
const browser=await chromium.connectOverCDP(webSocketDebuggerUrl);let page,peer;
const report={errors:[],received:0};
try {
 for(const p of browser.contexts()[0].pages()){const s=await p.context().newCDPSession(p);const {targetInfo}=await s.send('Target.getTargetInfo');await s.detach();if(targetInfo.targetId===tab)page=p;}
 assert.ok(page);page.on('pageerror',e=>report.errors.push(e.message));
 // Observe actual uploaded skin-index data without changing shaders/geometry.
 await page.addInitScript(()=>{
  window.__stormUploads=[];
  for(const C of [WebGLRenderingContext,WebGL2RenderingContext]){
   const original=C.prototype.bufferData;
   C.prototype.bufferData=function(target,data,...args){
    if(ArrayBuffer.isView(data)&&data.length===19451*4&&data[18817*4]===17&&data[19287*4]===17&&data[18817*4+1]===0){
     window.__stormUploads.push({count:data.length,upperJoint:data[18817*4],lowerJoint:data[19287*4],otherJoint:data[19351*4]});
    }
    return original.call(this,target,data,...args);
   };
  }
 });
 await page.setViewportSize({width:1366,height:768});await page.goto('https://arrow.symbiose.si/');
 report.version=await page.evaluate(()=>fetch('/version.json',{cache:'no-store'}).then(r=>r.json()));assert.equal(report.version.revision,expected);
 await page.evaluate(()=>window.__tla.startMatch({humans:1,bots:1,map:'totem',seed:42,characters:['stormdragon','mizu']}));
 await page.waitForFunction(()=>window.__tla.diagnostics().models&&window.__tla.world.phase==='playing'&&!document.querySelector('.countdown').textContent.trim());
 await page.evaluate(()=>window.__tla.world.fighters.forEach(f=>{f.invulnerable=100;}));
 const canvas = await page.locator('#game canvas').boundingBox();
 await page.mouse.move(canvas.x+canvas.width*.7,canvas.y+canvas.height*.45);await page.mouse.down();
 await page.waitForFunction(()=>window.__tla.visuals()[0]?.nock && Math.abs(window.__tla.visuals()[0].animationTime-.18)<1e-6);
 await page.evaluate(()=>window.__tla.setTimeScale(0));
 report.offline=await page.evaluate(()=>({models:window.__tla.diagnostics().models,characters:window.__tla.world.fighters.map(f=>f.character),uploads:window.__stormUploads,visuals:window.__tla.visuals()}));
 assert.deepEqual(report.offline.characters,[1,0]);
 assert.ok(report.offline.uploads.length>0,'actual corrected skinIndex buffer must reach GPU');
 await page.screenshot({path:`${out}/public-hold.png`,timeout:90000});
 for(const [width,height] of [[900,1000],[360,800]]){await page.setViewportSize({width,height});await page.screenshot({path:`${out}/public-${width}x${height}.png`,timeout:90000});}
 await page.mouse.up();await page.setViewportSize({width:1366,height:768});
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Voltar ao menu',exact:true}).click();
 await page.getByRole('button',{name:'Jogar online',exact:true}).click();await page.getByRole('button',{name:'Criar sala',exact:true}).click();
 await page.locator('.online-panel [role=status]').filter({hasText:'esperando'}).waitFor();
 const room=new URL(await page.getByRole('textbox',{name:'Link do convite'}).inputValue()).searchParams.get('room');
 peer=new WebSocket('wss://arrow.symbiose.si/ws',{origin:'https://arrow.symbiose.si'});
 let resolve;const playing=new Promise(r=>{resolve=r;});
 peer.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='start')peer.send(JSON.stringify({type:'ready'}));if(m.type==='state'){report.received++;if(m.world.phase==='playing')resolve();}});
 await new Promise((r,j)=>{peer.once('open',r);peer.once('error',j);});peer.send(JSON.stringify({type:'join',room}));
 let timer;try{await Promise.race([playing,new Promise((_,j)=>{timer=setTimeout(()=>j(new Error('online playing timeout')),30000);})]);}finally{clearTimeout(timer);}
 await page.waitForFunction(()=>!document.querySelector('#game').hidden&&window.__tla.diagnostics().models&&window.__tla.world.phase==='playing'&&window.__tla.state().online);
 report.online=await page.evaluate(()=>({online:window.__tla.state().online,models:window.__tla.diagnostics().models,characters:window.__tla.world.fighters.map(f=>f.character),uploads:window.__stormUploads}));
 await page.waitForFunction(()=>!document.querySelector('.countdown').textContent.trim());
 await page.screenshot({path:`${out}/public-online.png`,timeout:90000});assert.ok(report.received>0);assert.deepEqual(report.errors,[]);
}catch(e){report.failure=e.stack;throw e;}
finally{
 peer?.terminate();await browser.close();
 report.finish=JSON.parse(execFileSync('agent-bench-web',['--bench',bench,'--mission',mission,'finish'],{encoding:'utf8'}));
 await writeFile(`${out}/public-proof.json`,JSON.stringify(report,null,2)+'\n');
}
