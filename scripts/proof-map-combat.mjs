// Run only under: agent-bench fila arrow-mapas rodar -- node scripts/proof-map-combat.mjs
import {chromium} from 'playwright-core';
import {writeFile,appendFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {stripTypeScriptTypes} from 'node:module';
import assert from 'node:assert/strict';
const out='evidence/mapas-sol',mission='tla-mapas-sol';
const annex='/home/lol/.hermes/despachos/1107-082604-melhorias-do-last-arrow/anexos';
const oldSource=execFileSync('git',['show','11f933a:src/sim/level.ts'],{encoding:'utf8'});
const oldJs=stripTypeScriptTypes(oldSource);
const baseline=await import(`data:text/javascript;base64,${Buffer.from(oldJs).toString('base64')}`);
const browser=await chromium.connectOverCDP('http://127.0.0.1:19084');
let page;const report={owner:mission,pid:process.pid,baseline:'11f933a',candidate:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),screens:[],errors:[]};
try {
  for(const p of browser.contexts()[0].pages()) {
    const s=await p.context().newCDPSession(p);const {targetInfo}=await s.send('Target.getTargetInfo');await s.detach();
    if(targetInfo.targetId===process.env.TLA_MAP_TAB)page=p;
  }
  assert.ok(page,'attach only the registered mission tab');
  await appendFile(`${out}/web-events.ndjson`,JSON.stringify({mission,pid:process.pid,action:'attach',tab:process.env.TLA_MAP_TAB})+'\n');
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.setViewportSize({width:1366,height:768});
  await page.goto('http://127.0.0.1:4183/the-last-arrow-web/');
  await page.waitForFunction(()=>!!window.__tla);
  await page.evaluate(async()=>{const {LEVELS}=await import('/the-last-arrow-web/src/sim/level.ts');window.__mapCandidates=structuredClone(LEVELS);});
  for(const kind of ['baseline','after']) {
    for(const id of ['moss','totem','canopy','falls','roots']) {
      await page.evaluate(async({id,kind,old})=>{
        const {LEVELS}=await import('/the-last-arrow-web/src/sim/level.ts');
        const data=kind==='baseline'?old:window.__mapCandidates.find(l=>l.id===id);
        Object.assign(LEVELS.find(l=>l.id===id),structuredClone(data));
        window.__tla.startMatch({map:id,seed:42,humans:2,bots:0,characters:['mizu','stormdragon']});
        window.__tla.setTimeScale(0);window.__tla.world.phase='playing';
      },{id,kind,old:baseline.LEVELS.find(l=>l.id===id)});
      await page.waitForFunction(()=>window.__tla.diagnostics().models);
      if(await page.evaluate(()=>window.__tla.state().cameraClose))await page.getByRole('button',{name:/Câmera:/}).click();
      await page.waitForTimeout(300);
      const path=`${annex}/mapas-${kind}-${id}.png`;
      await page.screenshot({path});
      const state=await page.evaluate(()=>({state:window.__tla.state(),diagnostics:window.__tla.diagnostics()}));
      assert.equal(state.state.map,id);assert.equal(state.state.cameraClose,false);
      report.screens.push({kind,id,path,view:{width:1366,height:768},...state});
    }
  }
  // The existing close camera is preserved: one real frame at its default setting.
  await page.getByRole('button',{name:/Câmera:/}).click();
  await page.waitForTimeout(200);await page.screenshot({path:`${annex}/mapas-after-roots-camera-proxima.png`});
  assert.deepEqual(report.errors,[]);
} catch(e){report.failure=String(e.stack);throw e;}
finally {
  if(page&&!page.isClosed()){await page.close();await appendFile(`${out}/web-events.ndjson`,JSON.stringify({mission,pid:process.pid,action:'close',tab:process.env.TLA_MAP_TAB})+'\n');}
  report.ownPagesAtEnd=0;await writeFile(`${out}/visual-report.json`,JSON.stringify(report,null,2));await browser.close();
}
console.log('Five real maps before/after captured; own tab closed.');
