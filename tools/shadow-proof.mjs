import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = process.env.TLA_PROOF_DIR;
assert.ok(out);
await mkdir(out, {recursive:true});
const cli = (...args) => JSON.parse(execFileSync('agent-bench-web', ['--bench','tla-sombras-astra','--mission','sombras-arena-astra',...args], {encoding:'utf8'}));
cli('hygiene');
const {tab} = cli('open','--url','http://127.0.0.1:6118/iframe.html?id=arena-visual-legivel--sombras-borda-e-wrap&viewMode=story');
const browser = await chromium.connectOverCDP('http://127.0.0.1:19086');
const report = {owner:'sombras-arena-astra',pid:process.pid,cases:[],errors:[]};
try {
  let page;
  for (const p of browser.contexts()[0].pages()) {
    const session = await p.context().newCDPSession(p);
    const {targetInfo} = await session.send('Target.getTargetInfo'); await session.detach();
    if (targetInfo.targetId === tab) page = p;
  }
  assert.ok(page);
  page.on('pageerror', e=>report.errors.push(e.message));
  await page.setViewportSize({width:1366,height:768});
  await page.waitForFunction(()=>window.__visualBench?.fighters.usingModels);
  report.gpu = await page.evaluate(()=>{
    const gl=window.__visualBench.arena.renderer.getContext(), ext=gl.getExtension('WEBGL_debug_renderer_info');
    return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
  });
  assert.match(report.gpu,/NVIDIA/);
  for (const [name,x,y,crouching,alive] of [
    ['ground',4.5,4.45,false,true], ['edge',6.9,4.45,false,true],
    ['air',6.9,2.45,false,true], ['wrap',16,17,false,true],
    ['crouch',4.5,4.681,true,true], ['wall',6.9,5.2,false,true],
    ['dead',4.5,4.45,false,false], ['no-terrain',16,4.45,false,true],
  ]) {
    await page.evaluate(({x,y,crouching,alive})=>{
      const p=window.__visualBench; p.frozen=true;p.time=1;
      p.world.fighters=p.world.fighters.slice(0,1);
      Object.assign(p.world.fighters[0],{x,prevX:x,y,prevY:y,crouching,alive,grounded:y<5,vy:y<5?-3:3});
      p.fighters.reset(p.world);
      for(let i=0;i<30;i++)p.fighters.update(p.world,1,1,1/60);
      p.arena.draw(1,0);
    },{x,y,crouching,alive});
    await page.waitForTimeout(80);
    if (name === 'dead') await page.evaluate(() => { const p=window.__visualBench;p.time=2;p.fighters.update(p.world,1,2,0);p.arena.draw(2,0); });
    const state = await page.evaluate(()=>{
      const p=window.__visualBench, s=p.fighters.views[0].shadow;
      return {fighter:{x:p.world.fighters[0].x,y:p.world.fighters[0].y},visible:s.visible,position:s.position.toArray(),scale:s.scale.toArray(),opacity:s.material.opacity,uv:Array.from(s.geometry.attributes.uv.array)};
    });
    report.cases.push({name,...state});
    if(process.env.TLA_ASSERT_SHADOW==='1'){
      if(['wall','dead','no-terrain'].includes(name))assert.equal(state.visible,false,name);
      else assert.equal(state.visible,true,name);
      if(name==='wrap')assert.equal(state.position[1],15.02);
      if(name==='edge')assert.ok(state.position[0]+state.scale[0]/2<=7.000001);
    }
    await page.screenshot({path:`${out}/${name}.png`});
    if(name==='edge') {
      // Diagnostic lens only: same world/pose, zoom on the platform contact.
      await page.evaluate(()=>{const a=window.__visualBench.arena;a.draw=()=>{};a.camera.position.set(5.5,14,12);a.camera.updateProjectionMatrix();a.renderer.render(a.scene,a.camera);});
      await page.screenshot({path:`${out}/edge-detail.png`});
      await page.reload();await page.waitForFunction(()=>window.__visualBench?.fighters.usingModels);
    }
  }
  assert.deepEqual(report.errors,[]);
} finally {
  report.cleanup=cli('finish'); report.hygiene=cli('hygiene');
  await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
  await browser.close();
}
