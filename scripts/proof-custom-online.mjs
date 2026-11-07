import {chromium} from 'playwright-core';
import {WebSocket} from 'ws';
import assert from 'node:assert/strict';
import {writeFile,appendFile} from 'node:fs/promises';
const out='/home/lol/.hermes/despachos/1107-082604-melhorias-do-last-arrow/anexos';
const browser=await chromium.connectOverCDP(process.env.TLA_CDP??'http://127.0.0.1:19081');
let page,peer;const report={tests:[],errors:[],events:[]};
try{
 for(const p of browser.contexts()[0].pages()){const s=await p.context().newCDPSession(p);const {targetInfo}=await s.send('Target.getTargetInfo');await s.detach();if(targetInfo.targetId===process.env.TLA_TAB)page=p;}
 assert.ok(page);await appendFile(`${out}/controles-web-events.ndjson`,JSON.stringify({mission:'arrow-controles',action:'attach-online',pid:process.pid,tab:process.env.TLA_TAB})+'\n');
 page.on('pageerror',e=>report.errors.push(e.message));await page.setViewportSize({width:1366,height:768});await page.goto('https://arrow.symbiose.si/');
 await page.getByRole('button',{name:'Controles',exact:true}).click();await page.getByRole('combobox',{name:'Layout de controles'}).selectOption('mouse-space');await page.getByRole('button',{name:'Restaurar preset',exact:true}).click();
 await page.locator('[data-action=jump]').click();await page.keyboard.press('v');
 await page.locator('[data-action=shoot]').click();await page.locator('[data-action=shoot]').click({button:'right'});
 await page.locator('[data-action=pause]').click();await page.keyboard.press('p');
 await page.getByRole('button',{name:'Voltar',exact:true}).click();await page.getByRole('button',{name:'Jogar online',exact:true}).click();await page.getByRole('button',{name:'Criar sala',exact:true}).click();
 await page.locator('.online-panel [role=status]').filter({hasText:'esperando'}).waitFor();const room=new URL(await page.getByRole('textbox',{name:'Link do convite'}).inputValue()).searchParams.get('room');
 peer=new WebSocket('wss://arrow.symbiose.si/ws',{origin:'https://arrow.symbiose.si'});let latest;
 peer.on('message',v=>{const m=JSON.parse(v);if(m.type==='start')peer.send(JSON.stringify({type:'ready'}));if(m.type==='state'){latest=m.world;report.events.push(...m.events);}});
 await new Promise((resolve,reject)=>{peer.once('open',resolve);peer.once('error',reject);});peer.send(JSON.stringify({type:'join',room}));
 await page.waitForFunction(()=>window.__tla.world.phase==='playing'&&window.__tla.world.fighters[0].grounded);
 await page.keyboard.down('v');await page.waitForFunction(()=>window.__tla.world.fighters[0].vy<0);await page.keyboard.up('v');assert.ok(report.events.some(e=>e.type==='jump'&&e.actor===0));report.tests.push('V remapped jump confirmed by authoritative server and peer');
 await page.mouse.move(1040,300);await page.mouse.down({button:'right'});await page.waitForFunction(()=>window.__tla.world.fighters[0].charging);assert.equal(latest.fighters[0].charging,true);await page.mouse.up({button:'right'});await page.waitForFunction(()=>!window.__tla.world.fighters[0].charging);assert.ok(report.events.some(e=>e.type==='shoot'&&e.actor===0));report.tests.push('right mouse shot confirmed by authoritative server and peer');
 await page.mouse.down({button:'right'});await page.waitForFunction(()=>window.__tla.world.fighters[0].charging);const before=report.events.filter(e=>e.type==='shoot'&&e.actor===0).length;await page.keyboard.press('p');await page.getByRole('button',{name:'Continuar',exact:true}).waitFor();await page.mouse.up({button:'right'});await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.waitForFunction(()=>!window.__tla.world.fighters[0].charging);assert.equal(report.events.filter(e=>e.type==='shoot'&&e.actor===0).length,before);report.tests.push('remapped pause cancels held bow online without firing');
 await page.screenshot({path:`${out}/controles-online-remapeado.png`});assert.deepEqual(report.errors,[]);
}catch(error){report.failure=error.stack;throw error;}finally{peer?.terminate();if(page&&!page.isClosed())await page.close();report.ownPagesAtEnd=0;await appendFile(`${out}/controles-web-events.ndjson`,JSON.stringify({mission:'arrow-controles',action:'close-online',pid:process.pid,tab:process.env.TLA_TAB})+'\n');await writeFile(`${out}/controles-online-report.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({tests:report.tests,errors:report.errors}));
