import {chromium} from 'playwright-core';
import {WebSocket} from 'ws';
import {mkdir,writeFile,appendFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createPilot,keysToIntent} from './p1-rodada-10.mjs';
import {setTimeout as delay} from 'node:timers/promises';
const out='evidence/retomada/partida';await mkdir(out,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:19080');let page,peer;
const report={errors:[],blocked:[],http:[],rounds:[],start:new Date().toISOString()};
try{
 for(const p of browser.contexts()[0].pages()){const s=await p.context().newCDPSession(p);const {targetInfo}=await s.send('Target.getTargetInfo');await s.detach();if(targetInfo.targetId===process.env.TLA_TAB)page=p;}
 assert.ok(page);await appendFile(`${out}/web-events.ndjson`,JSON.stringify({owner:'tla-retomada',pid:process.pid,action:'attach',tab:process.env.TLA_TAB})+'\n');
 page.on('requestfailed',r=>report.blocked.push({url:r.url(),error:r.failure()?.errorText}));
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push({text:m.text(),location:m.location()});});page.on('response',r=>{if(r.status()>=400)report.http.push({url:r.url(),status:r.status()});});
 await page.bringToFront();await page.setViewportSize({width:1366,height:768});await page.goto('https://arrow.symbiose.si/');
 await page.getByRole('button',{name:'Jogar online',exact:true}).click();await page.getByRole('button',{name:'Criar sala',exact:true}).click();
 const status=page.locator('.online-panel [role=status]');await status.filter({hasText:'esperando'}).waitFor();
 const room=new URL(await page.getByRole('textbox',{name:'Link do convite'}).inputValue()).searchParams.get('room');report.room=room;
 let latest,starts=0,peerMessages=[];peer=new WebSocket('wss://arrow.symbiose.si/ws',{origin:'https://arrow.symbiose.si'});
 peer.on('message',raw=>{const m=JSON.parse(raw.toString());if(m.type==='start'){starts++;peer.send(JSON.stringify({type:'ready'}));}if(m.type==='state')latest=m.world;peerMessages.push(m.type);});
 await new Promise((r,j)=>{peer.once('open',r);peer.once('error',j);});peer.send(JSON.stringify({type:'join',room}));
 await page.waitForFunction(()=>window.__tla.state().phase==='playing');
 const pilots=[createPilot(),createPilot()];let held=[],other=[],round=-1;const begin=Date.now();let shot=false;
 while(Date.now()-begin<6*60_000){
   const state=await page.evaluate(()=>window.__tla.state());
   if(state.phase==='matchover'){report.final=state;break;}
   if(state.round!==round){round=state.round;report.rounds.push({round,elapsed:(Date.now()-begin)/1000,score:state.fighters.map(f=>f.score)});console.log('round',round,'score',state.fighters.map(f=>f.score));}
   const keys=pilots[0](state);for(const k of held)if(!keys.includes(k))await page.keyboard.up(k);for(const k of keys)if(!held.includes(k))await page.keyboard.down(k);held=keys;
   if(latest){const swapped={...latest,fighters:[{...latest.fighters[1],id:0},{...latest.fighters[0],id:1}]};const keys2=pilots[1](swapped);peer.send(JSON.stringify({type:'input',input:keysToIntent(keys2,other)}));other=keys2;}
   if(!shot&&Date.now()-begin>4000&&state.phase==='playing'){await page.screenshot({path:`${out}/combate.png`});shot=true;}
   await delay(100);
 }
 for(const k of held)await page.keyboard.up(k);
 assert.ok(report.final,'match reaches victory in six minutes');assert.ok(report.final.fighters.some(f=>f.score===5));
 report.peerFinal=latest;assert.deepEqual(latest.fighters.map(f=>f.score),report.final.fighters.map(f=>f.score));
 await page.getByRole('button',{name:/Revanche/}).waitFor();await page.screenshot({path:`${out}/vitoria.png`});
 await page.getByRole('button',{name:/Revanche/}).click();await status.filter({hasText:'revanche'}).waitFor();
 peer.send(JSON.stringify({type:'rematch'}));await page.waitForFunction(()=>window.__tla.state().phase==='playing' && window.__tla.state().fighters.every(f=>f.score===0));
 report.rematch=await page.evaluate(()=>window.__tla.state());assert.equal(starts,2);await page.screenshot({path:`${out}/revanche.png`});
 peer.close();await status.filter({hasText:/saiu|encerrada/}).waitFor();report.disconnect=await status.innerText();
 report.diagnostics=await page.evaluate(()=>window.__tla.diagnostics());
}catch(e){report.failure=e.stack;throw e;}
finally{peer?.terminate();if(page&&!page.isClosed())await page.close();report.end=new Date().toISOString();report.ownPagesAtEnd=0;await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await appendFile(`${out}/web-events.ndjson`,JSON.stringify({owner:'tla-retomada',pid:process.pid,action:'close',tab:process.env.TLA_TAB})+'\n');await browser.close();}
console.log('Partida completa, placar compartilhado, revanche e saída comprovados.');
