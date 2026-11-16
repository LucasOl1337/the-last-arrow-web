import { chromium } from 'playwright-core';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {checkScreen} from '../scripts/check-screen.mjs';
const out=process.env.TLA_PROOF_DIR, base=process.env.TLA_URL??'http://127.0.0.1:5188/the-last-arrow-web/';
assert.ok(out);await mkdir(out,{recursive:true});
const cli=(...args)=>JSON.parse(execFileSync('agent-bench-web',['--bench','tla-sombras-astra','--mission','sombras-arena-astra',...args],{encoding:'utf8'}));
cli('hygiene');const {tab}=cli('open','--url',`${base}?autoplay=bots4&seed=42`);
const browser=await chromium.connectOverCDP('http://127.0.0.1:19086');
const report={owner:'sombras-arena-astra',pid:process.pid,base,errors:[],screens:[]};
try{
 let page;for(const p of browser.contexts()[0].pages()){
  const s=await p.context().newCDPSession(p);const {targetInfo}=await s.send('Target.getTargetInfo');await s.detach();if(targetInfo.targetId===tab)page=p;
 }assert.ok(page);page.on('pageerror',e=>report.errors.push(e.message));
 await page.waitForFunction(()=>window.__tla?.diagnostics().models);
 await page.evaluate(()=>{window.__tla.startMatch({humans:0,bots:4,seed:42,map:'moss'});window.__tla.world.phase='playing';window.__tla.setTimeScale(0);});
 for(const [width,height] of [[1366,768],[900,1000],[360,800]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(120);
  const gate=await checkScreen(page,'#game');assert.deepEqual(gate.falhas,[]);
  await page.screenshot({path:`${out}/spectator-${width}x${height}.png`});report.screens.push({width,height,gate});
 }
 await page.setViewportSize({width:1366,height:768});
 await page.evaluate(()=>window.__tla.setTimeScale(1));
 await page.waitForFunction(()=>window.__tla.state().round>1,undefined,{timeout:60000});
 report.bots=await page.evaluate(()=>window.__tla.state());
 await page.evaluate(()=>{window.__tla.startMatch({humans:1,bots:1,seed:42,map:'moss'});window.__tla.world.phase='playing';});
 await page.keyboard.down('d');await page.waitForTimeout(150);await page.keyboard.up('d');
 await page.mouse.move(900,300);await page.mouse.down();await page.waitForTimeout(90);await page.mouse.up();
 await page.waitForFunction(()=>window.__tla.world.fighters[0].ammo===2);
 report.human=await page.evaluate(()=>window.__tla.state());
 assert.ok(report.human.fighters[0].x>6.5);
 await page.evaluate(()=>window.__tla.setTimeScale(0));
 for(const [width,height] of [[900,1000],[360,800]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(150);
  const gate=await checkScreen(page,'#game');assert.deepEqual(gate.falhas,[]);
  await page.screenshot({path:`${out}/player-${width}x${height}.png`});report.screens.push({player:true,width,height,gate});
 }
 report.diagnostics=await page.evaluate(()=>window.__tla.diagnostics());assert.deepEqual(report.errors,[]);
}finally{report.cleanup=cli('finish');report.hygiene=cli('hygiene');await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
