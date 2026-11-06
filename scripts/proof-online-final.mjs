import {chromium} from 'playwright-core';
import {mkdir,writeFile,appendFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='evidence/retomada/final';await mkdir(out,{recursive:true});const browser=await chromium.connectOverCDP('http://127.0.0.1:19080');
const ids=process.env.TLA_TABS.split(',');const pages=[];const report={errors:[],blocked:[],http:[]};
try{
 for(const p of browser.contexts()[0].pages()){const c=await p.context().newCDPSession(p);const {targetInfo}=await c.send('Target.getTargetInfo');await c.detach();if(ids.includes(targetInfo.targetId))pages[ids.indexOf(targetInfo.targetId)]=p;}
 assert.equal(pages.filter(Boolean).length,2);await appendFile(`${out}/web-events.ndjson`,JSON.stringify({owner:'tla-retomada',pid:process.pid,action:'attach',ids})+'\n');
 const [a,b]=pages;
 for(const p of pages){p.on('pageerror',e=>report.errors.push(e.message));p.on('requestfailed',r=>report.blocked.push({url:r.url(),error:r.failure()?.errorText}));p.on('response',r=>{if(r.status()>=400)report.http.push({url:r.url(),status:r.status()});});await p.setViewportSize({width:1366,height:768});}
 await a.bringToFront();await a.goto('https://arrow.symbiose.si/');await a.getByRole('radio',{name:'Cachoeira Sagrada',exact:true}).click();await a.locator('#rules').selectOption('headhunter');
 await a.getByRole('button',{name:'Jogar online',exact:true}).click();await a.getByRole('button',{name:'Criar sala',exact:true}).click();
 await a.locator('.online-panel [role=status]').filter({hasText:'esperando'}).waitFor();const invite=await a.getByRole('textbox',{name:'Link do convite'}).inputValue();report.invite=invite;
 await a.setViewportSize({width:844,height:390});await a.screenshot({path:`${out}/convite-celular.png`});
 assert.ok(await a.getByRole('button',{name:'Copiar convite'}).evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));
 await a.setViewportSize({width:1366,height:768});
 await b.bringToFront();await b.goto(invite);await b.getByRole('button',{name:'Entrar na sala',exact:true}).click();await b.waitForFunction(()=>window.__tla.state().phase==='playing');
 report.options=await b.evaluate(()=>window.__tla.world.options);assert.equal(report.options.map,'falls');assert.equal(report.options.mode,'headhunter');
 await b.keyboard.press('Escape');await b.getByRole('heading',{name:'O duelo continua',exact:true}).waitFor();const tick=await b.evaluate(()=>window.__tla.world.tick);await b.waitForTimeout(180);assert.ok(await b.evaluate(()=>window.__tla.world.tick)>tick,'menu does not pause the server');await b.screenshot({path:`${out}/menu-online.png`});await b.getByRole('button',{name:'Continuar',exact:true}).click();
 assert.equal(await b.evaluate(()=>window.__tla.state().paused),false);
 await b.keyboard.down('a');await b.keyboard.down('j');await b.waitForTimeout(450);await b.keyboard.up('j');await b.keyboard.up('a');await b.waitForTimeout(300);await b.screenshot({path:`${out}/cachoeira-online.png`});
 report.state=await b.evaluate(()=>window.__tla.state());
 report.fps=await b.evaluate(()=>new Promise(resolve=>{const times=[];const end=performance.now()+5000;function frame(t){times.push(t);if(t<end)requestAnimationFrame(frame);else resolve({fps:(times.length-1)*1000/(times.at(-1)-times[0]),frames:times.length});}requestAnimationFrame(frame);}));
 await b.keyboard.press('Escape');await b.getByRole('button',{name:'Voltar ao menu',exact:true}).click();await b.getByRole('button',{name:'Começar partida'}).waitFor();
 await a.bringToFront();await a.locator('.online-panel [role=status]').filter({hasText:/saiu|encerrada/}).waitFor();report.exit='menu restored; remote player notified';
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.http,[]);
 assert.ok(report.blocked.every(r=>r.url.startsWith('https://static.cloudflareinsights.com/')&&r.error==='net::ERR_BLOCKED_BY_CLIENT'),'only optional Cloudflare analytics is blocked');
}catch(e){report.failure=e.stack;throw e;}
finally{for(const p of pages.filter(Boolean))if(!p.isClosed())await p.close();report.ownPagesAtEnd=0;await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await appendFile(`${out}/web-events.ndjson`,JSON.stringify({owner:'tla-retomada',pid:process.pid,action:'close',ids})+'\n');await browser.close();}
console.log('Publicação final: mapa/regras, convite móvel, menu sem pausa, saída e FPS verificados.');
