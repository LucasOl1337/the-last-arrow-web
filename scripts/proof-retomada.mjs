import {chromium} from 'playwright-core';
import {writeFile,mkdir,appendFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {checkScreen} from './check-screen.mjs';
const out=process.env.TLA_PROOF_OUT??'evidence/retomada';await mkdir(out,{recursive:true});
const ids=(process.env.TLA_TABS??'4DDDFD5D6782992352CAD2863C9C0234,D218D445FF9CBBD67AA4448BA0A1719E').split(',');
const base=process.env.TLA_URL??'http://127.0.0.1:4176/the-last-arrow-web/';
const browser=await chromium.connectOverCDP('http://127.0.0.1:19080');const owned=[];
const report={errors:[],screens:[],events:[],url:base};
try {
 for(const p of browser.contexts()[0].pages()) {const s=await p.context().newCDPSession(p);const {targetInfo}=await s.send('Target.getTargetInfo');await s.detach();if(ids.includes(targetInfo.targetId))owned[ids.indexOf(targetInfo.targetId)]=p;}
 assert.equal(owned.filter(Boolean).length,2);
 await appendFile(`${out}/web-events.ndjson`,JSON.stringify({owner:'tla-retomada',pid:process.pid,action:'attach',ids})+'\n');
 const [a,b]=owned;
 for(const p of owned){p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});await p.setViewportSize({width:1366,height:768});}
 await a.bringToFront();await a.goto(base);await a.getByRole('button',{name:'Começar partida'}).click();
 await a.waitForFunction(()=>window.__tla.diagnostics().models);
 await a.keyboard.down('d');await a.waitForTimeout(500);await a.keyboard.up('d');
 await a.keyboard.down('j');await a.waitForTimeout(350);await a.keyboard.up('j');
 await a.waitForTimeout(300);await a.screenshot({path:`${out}/camera-proxima.png`});
 report.cameraClose=await a.evaluate(()=>window.__tla.state().cameraClose);assert.equal(report.cameraClose,true);
 await a.keyboard.press('c');assert.equal(await a.evaluate(()=>window.__tla.state().cameraClose),false);
 await a.screenshot({path:`${out}/camera-ampla.png`});
 await a.goto(base);await a.getByRole('button',{name:'Jogar online',exact:true}).click();await a.getByRole('button',{name:'Criar sala',exact:true}).click();
 await a.getByRole('status').filter({hasText:'esperando'}).waitFor();
 const invite=await a.getByRole('textbox',{name:'Link do convite'}).inputValue();report.room=new URL(invite).searchParams.get('room');
 await a.screenshot({path:`${out}/convite.png`});
 await b.bringToFront();await b.goto(invite);await b.getByRole('button',{name:'Entrar na sala',exact:true}).click();
 await b.waitForFunction(()=>window.__tla.state().online?.player===1 && window.__tla.state().phase==='playing');
 await b.waitForFunction(()=>window.__tla.diagnostics().models);
 const start=await b.evaluate(()=>window.__tla.state());report.playerTwoStart=start;
 await b.keyboard.down('a');await b.keyboard.down('j');await b.waitForTimeout(350);await b.keyboard.up('j');await b.keyboard.up('a');
 await b.keyboard.press('k');await b.waitForTimeout(250);
 report.playerTwoAfter=await b.evaluate(()=>window.__tla.state());
 assert.notEqual(report.playerTwoAfter.fighters[1].x,start.fighters[1].x,'P2 uses own WASD, not local P2 arrows');
 await b.screenshot({path:`${out}/online-p2.png`});
 await a.bringToFront();await a.waitForFunction(()=>window.__tla.state().online?.player===0&&window.__tla.state().tick>50);
 await a.keyboard.down('d');await a.keyboard.down('j');await a.waitForTimeout(400);await a.keyboard.up('j');await a.keyboard.up('d');await a.waitForTimeout(100);
 report.playerOne=await a.evaluate(()=>window.__tla.state());await a.screenshot({path:`${out}/online-p1.png`});
 assert.equal(report.playerOne.online.room,report.room);assert.equal(report.playerTwoAfter.online.room,report.room);
 for(const [width,height] of [[1366,768],[900,1000],[844,390]]) {await a.setViewportSize({width,height});await a.waitForTimeout(100);report.screens.push({width,height,...await checkScreen(a,'#game')});await a.screenshot({path:`${out}/arena-${width}x${height}.png`});}
 await b.close();await a.getByRole('status').filter({hasText:/saiu|encerrada/}).waitFor();report.disconnect=await a.getByRole('status').filter({hasText:/saiu|encerrada/}).innerText();
 await a.screenshot({path:`${out}/desconectado.png`});
 assert.deepEqual(report.errors,[]);
} catch(e){report.failure=e.stack;throw e;}
finally {for(const p of owned.filter(Boolean))if(!p.isClosed())await p.close();await appendFile(`${out}/web-events.ndjson`,JSON.stringify({owner:'tla-retomada',pid:process.pid,action:'close',ids})+'\n');report.ownPagesAtEnd=0;await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
console.log('Camera, convite, dois clientes, teclado P1/P2 e saída comprovados.');
