import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile,appendFile} from 'node:fs/promises';
import {checkScreen} from './check-screen.mjs';
const out=process.env.TLA_OUT??'/home/lol/.hermes/despachos/1107-082604-melhorias-do-last-arrow/anexos';await mkdir(out,{recursive:true});
const base=process.env.TLA_URL??'http://127.0.0.1:5187/';
const browser=await chromium.connectOverCDP(process.env.TLA_CDP??'http://127.0.0.1:19081');
const report={base,tests:[],gates:[],errors:[],ownPagesAtEnd:null};let page;
const log=action=>appendFile(`${out}/controles-web-events.ndjson`,JSON.stringify({mission:'arrow-controles',pid:process.pid,action,tab:process.env.TLA_TAB})+'\n');
const binding=action=>page.locator(`[data-action="${action}"]`);
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tla-control-bindings-v1')??'{}'));
try{
 for(const p of browser.contexts()[0].pages()){const s=await p.context().newCDPSession(p);const {targetInfo}=await s.send('Target.getTargetInfo');await s.detach();if(targetInfo.targetId===process.env.TLA_TAB)page=p;}
 assert.ok(page,'registered mission tab required');await log('attach');page.on('pageerror',e=>report.errors.push(e.message));
 await page.setViewportSize({width:1366,height:768});
 if(!process.env.TLA_PUBLIC){
  await page.goto('http://127.0.0.1:6117/iframe.html?id=arena-controles-ergonomicos--plataforma&viewMode=story');
  await binding('jump').waitFor();
  for(const [width,height] of [[1366,768],[900,1000],[360,800]]){await page.setViewportSize({width,height});const gate=await checkScreen(page,'.controls-panel');assert.equal(gate.medidas.rolagem_horizontal,false);if(width>360)assert.ok(gate.passou,JSON.stringify(gate));report.gates.push({surface:'storybook',width,height,...gate});await page.screenshot({path:`${out}/controles-story-${width}x${height}.png`});}
 }
 await page.setViewportSize({width:1366,height:768});await page.goto(base);
 for(const [width,height] of [[1366,768],[900,1000],[360,800]]){await page.setViewportSize({width,height});const gate=await checkScreen(page,'.menu-content');assert.equal(gate.medidas.rolagem_horizontal,false);const start=await page.getByRole('button',{name:'Começar partida'}).boundingBox();if(width>360)assert.ok(start.y+start.height<=height,'start above fold');report.gates.push({surface:'menu',width,height,...gate});await page.screenshot({path:`${out}/controles-menu-${width}x${height}.png`});}
 await page.setViewportSize({width:1366,height:768});await page.getByRole('button',{name:'Controles',exact:true}).click();
 const select=page.getByRole('combobox',{name:'Layout de controles'});
 assert.equal(await select.locator('option').count(),5);await select.selectOption('mouse-space');await page.getByRole('button',{name:'Restaurar preset',exact:true}).click();
 await binding('jump').click();await page.keyboard.press('v');assert.equal(await binding('jump').textContent(),'V');assert.deepEqual((await saved())['mouse-space'].jump,['KeyV']);report.tests.push('individual keyboard binding saved');
 await page.reload();await page.getByRole('button',{name:'Controles',exact:true}).click();assert.equal(await binding('jump').textContent(),'V');report.tests.push('reload preserves custom binding');
 await binding('jump').click();await page.keyboard.press('Escape');assert.equal(await binding('jump').textContent(),'V');assert.ok(await page.getByRole('heading',{name:'Controles',exact:true}).isVisible());report.tests.push('Escape cancels without changing binding or leaving controls');
 await binding('jump').click();await page.keyboard.press('a');assert.match(await page.getByRole('status').textContent(),/já está/);await page.screenshot({path:`${out}/controles-conflito.png`});assert.deepEqual((await saved())['mouse-space'].jump,['KeyV']);
 await page.keyboard.press('ArrowLeft');assert.match(await page.getByRole('status').textContent(),/P2/);await page.getByRole('button',{name:'Cancelar alteração',exact:true}).click();assert.equal(await binding('jump').textContent(),'V');report.tests.push('P1 and P2 conflicts rejected atomically, Cancel button works');
 await binding('shoot').click();await binding('shoot').click({button:'right'});assert.equal(await binding('shoot').textContent(),'Mouse direito');assert.equal(await binding('shoot').getAttribute('aria-pressed'),'false');
 await binding('pause').click();await page.keyboard.press('p');assert.equal(await binding('pause').textContent(),'P');report.tests.push('mouse button capture and pause remap');
 // Keyboard traversal must escape capture rather than trapping the player.
 await binding('dash').click();await page.keyboard.press('Tab');assert.equal(await binding('dash').getAttribute('aria-pressed'),'false');report.tests.push('Tab cancels capture and moves focus');
 for(const [width,height] of [[1366,768],[900,1000],[360,800]]){await page.setViewportSize({width,height});const gate=await checkScreen(page,'.controls-panel');assert.equal(gate.medidas.rolagem_horizontal,false);if(width>360){assert.ok(gate.passou,JSON.stringify(gate));const r=await page.getByRole('button',{name:'Voltar',exact:true}).boundingBox();const panel=await page.locator('.controls-panel').boundingBox();assert.ok(r.y+r.height<=panel.y+panel.height-1,'back inside panel, not clipped');}report.gates.push({surface:'game',width,height,...gate});await page.screenshot({path:`${out}/controles-depois-${width}x${height}.png`});}
 await page.setViewportSize({width:1366,height:768});await page.getByRole('button',{name:'Voltar',exact:true}).click();
 // Actual input path, not a duplicate implementation. Native events feed Controls in gameplay.
 await page.getByRole('combobox',{name:'Modo',exact:true}).selectOption('2');await page.getByRole('button',{name:'Começar partida'}).click();await page.waitForFunction(()=>window.__tla?.world.phase==='playing');
 await page.evaluate(()=>{const w=window.__tla.world;w.phase='playing';w.phaseTime=0;w.level={...w.level,rows:Array.from({length:18},(_,y)=>y===17?'################################':'................................')};w.fighters.forEach((f,id)=>Object.assign(f,{human:true,alive:true,invulnerable:100,x:id?22:9,y:16.45,prevX:id?22:9,prevY:16.45,vx:0,vy:0,grounded:true,ammo:3,inventory:['normal','normal','normal'],dashCooldown:0}));});
 await page.keyboard.down('v');await page.waitForTimeout(50);assert.ok(await page.evaluate(()=>window.__tla.world.fighters[0].vy<0),'mapped jump reaches gameplay');await page.keyboard.up('v');
 await page.mouse.move(1000,240);await page.mouse.down({button:'right'});await page.waitForTimeout(80);assert.ok(await page.evaluate(()=>window.__tla.world.fighters[0].charging),'mapped right mouse draws bow');await page.mouse.up({button:'right'});
 await page.keyboard.down('ArrowLeft');await page.waitForTimeout(70);assert.ok(await page.evaluate(()=>window.__tla.world.fighters[1].vx<0),'P2 arrows preserved');await page.keyboard.up('ArrowLeft');report.tests.push('real gameplay: remapped jump, right mouse shot and P2 movement');
 await page.keyboard.press('p');await page.getByRole('button',{name:'Continuar',exact:true}).waitFor();await page.getByRole('button',{name:'Controles',exact:true}).click();await page.keyboard.press('Escape');await page.getByRole('button',{name:'Continuar',exact:true}).waitFor();report.tests.push('remapped pause works and Escape returns controls to pause');
 await page.getByRole('button',{name:'Controles',exact:true}).click();await page.getByRole('button',{name:'Restaurar preset',exact:true}).click();assert.equal(await binding('jump').textContent(),'W');assert.equal(await binding('shoot').textContent(),'Mouse esquerdo');
 await select.selectOption('classic');assert.equal(await binding('shoot').textContent(),'J');await select.selectOption('mouse-q');assert.equal(await binding('jump').textContent(),'Espaço');await select.selectOption('mouse-r');assert.equal(await binding('dash').textContent(),'R');await select.selectOption('mouse-h');assert.equal(await binding('dash').textContent(),'H');report.tests.push('restore and all five presets retained');
 assert.deepEqual(report.errors,[]);
}catch(e){report.failure=e.stack;throw e;}finally{if(page&&!page.isClosed())await page.close();await log('close');report.ownPagesAtEnd=0;await writeFile(`${out}/controles-${process.env.TLA_PUBLIC?'publico':'local'}-report.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({tests:report.tests,gates:report.gates.map(g=>({surface:g.surface,width:g.width,height:g.height,pass:g.passou,failures:g.falhas})),errors:report.errors}));
