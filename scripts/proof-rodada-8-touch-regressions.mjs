import { proof, fingers, center, instrument } from './bench-rodada-8.mjs';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { checkScreen } from './check-screen.mjs';

await proof('touch-regressions', async ({ page, cdp, base, report, shot }) => {
  report.viewports = {};
  const touch = fingers(cdp);
  const p1 = () => page.evaluate(() => { const f = window.__tla.world.fighters[0]; return { x:f.x, y:f.y, vx:f.vx, vy:f.vy, charging:f.charging, ammo:f.ammo, aimX:f.aimX, aimY:f.aimY }; });
  const events = () => page.evaluate(() => window.events8);
  // Separate exact regression fixture, bots remain active and all actions use CDP touch.
  const setup = async () => {
    await page.evaluate(() => {
      window.__tla.startMatch({ humans:1,bots:3,seed:3,map:'moss' });
      const w = window.__tla.world; w.phase='playing'; w.countdown=0;
      Object.assign(w.fighters[0], { x:5,prevX:5,y:15.45,prevY:15.45,grounded:true });
    }); await instrument(page);
  };
  await page.goto(`${base}?seed=3`);
  await page.getByRole('button',{name:'Começar partida'}).tap();
  await page.waitForFunction(()=>window.__tla.diagnostics().models);
  await page.setViewportSize({width:844,height:390}); await setup();
  await page.evaluate(()=>{window.pointerTrace=[]; for(const name of ['pointerdown','pointerup','pointercancel','lostpointercapture']) document.addEventListener(name,e=>window.pointerTrace.push({type:e.type,id:e.pointerId,target:e.target.className}),true);});
  const stick=await center(page.locator('.touch-stick')), shoot=await center(page.locator('.shoot'));
  await touch.down(1,stick.x,stick.y); await touch.move(1,stick.x+30,stick.y);
  await touch.down(2,shoot.x,shoot.y); await delay(120);
  report.moveAndShoot=await p1(); assert.ok(report.moveAndShoot.vx>0 && report.moveAndShoot.charging && report.moveAndShoot.x>5);
  await touch.up(2); await delay(50); report.afterRelease={p1:await p1(),state:await page.evaluate(()=>window.__tla.state()),events:await events(),trace:await page.evaluate(()=>window.pointerTrace)}; assert.ok((await events()).some(e=>e.actor===0&&e.type==='shoot')); await touch.up(1);
  await setup(); await touch.down(2,shoot.x,shoot.y); await delay(50);
  await page.getByRole('button',{name:'Pausar partida'}).tap();
  const tick=await page.evaluate(()=>window.__tla.state().tick); await delay(100); assert.equal(await page.evaluate(()=>window.__tla.state().tick),tick);
  await page.getByRole('button',{name:'Continuar'}).tap(); await delay(60);
  report.pauseReset=await p1(); assert.equal(report.pauseReset.charging,false); assert.equal(report.pauseReset.ammo,3);
  await touch.up(2); await delay(50); assert.ok(!(await events()).some(e=>e.actor===0&&e.type==='shoot'));
  await touch.down(2,shoot.x,shoot.y); await delay(60); await touch.up(2); await delay(50);
  assert.ok((await events()).some(e=>e.actor===0&&e.type==='shoot'),'new gesture works');
  // OS cancel/lost capture is cancellation, never bow release.
  await setup(); await touch.down(2,shoot.x,shoot.y); await delay(50); await touch.cancel();
  await page.getByRole('dialog',{name:'Partida pausada'}).waitFor();
  await page.getByRole('button',{name:'Continuar'}).tap(); await delay(50);
  report.cancelReset=await p1(); assert.equal(report.cancelReset.ammo,3); assert.equal(report.cancelReset.charging,false);
  // Rotate while both fingers are active. Frozen portrait preserves tick and cancels drawing.
  await setup(); await touch.down(1,stick.x,stick.y); await touch.move(1,stick.x+30,stick.y); await touch.down(2,shoot.x,shoot.y); await delay(60);
  await page.setViewportSize({width:390,height:844}); await delay(80);
  const portraitTick=await page.evaluate(()=>window.__tla.state().tick); await delay(200); assert.equal(await page.evaluate(()=>window.__tla.state().tick),portraitTick);
  await touch.up(2); await touch.up(1); await page.setViewportSize({width:844,height:390}); await delay(80);
  report.rotationReset=await p1(); assert.equal(report.rotationReset.charging,false); assert.equal(report.rotationReset.ammo,3);
  // Existing ground friction takes ~120 ms to stop from full speed; no touch means it decelerates.
  await page.waitForFunction(()=>window.__tla.world.fighters[0].vx===0,null,{timeout:500});
  report.rotationStopped=await p1();
  await setup();
  const jump=await center(page.locator('.jump')), dash=await center(page.locator('.dash'));
  await touch.down(2,jump.x,jump.y); await delay(80); report.jump=await p1(); await touch.up(2);
  assert.ok(report.jump.vy<0 && (await events()).some(e=>e.actor===0&&e.type==='jump'));
  await touch.down(2,dash.x,dash.y); await delay(60); await touch.up(2);
  assert.ok((await events()).some(e=>e.actor===0&&e.type==='dash')); report.jumpDashEvents=await events();
  // Losing pointer capture (browser/OS) and window blur must cancel, not release a shot.
  await setup(); await touch.down(1,stick.x,stick.y); await touch.move(1,stick.x+30,stick.y); await touch.down(2,shoot.x,shoot.y); await delay(60);
  report.releasedCapture=await page.evaluate(()=>{ const zone=document.querySelector('.touch-stick'); const e=window.pointerTrace.findLast(e=>e.type==='pointerdown'&&zone.hasPointerCapture(e.id)); if(!e) throw new Error('no active stick capture'); zone.releasePointerCapture(e.id); return e.id; });
  // Pointer Events processes pending capture changes on the next pointer event.
  await touch.move(1,stick.x+28,stick.y);
  await page.getByRole('dialog',{name:'Partida pausada'}).waitFor(); await touch.up(2); await touch.up(1);
  await page.getByRole('button',{name:'Continuar'}).tap(); await delay(80); report.lostCapture=await p1(); assert.equal(report.lostCapture.ammo,3); assert.equal(report.lostCapture.charging,false);
  await setup(); await touch.down(2,shoot.x,shoot.y); await delay(50); await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await page.getByRole('dialog',{name:'Partida pausada'}).waitFor(); await touch.up(2); await page.getByRole('button',{name:'Continuar'}).tap(); await delay(50);
  report.blurReset=await p1(); assert.equal(report.blurReset.ammo,3); assert.equal(report.blurReset.charging,false);
  // Pinch on the canvas, outside the controls, must not zoom or scroll the page.
  await touch.down(1,350,200); await touch.down(2,480,200); await touch.move(1,300,180); await touch.move(2,530,220); await touch.up(1); await touch.up(2);
  report.afterPinch=await page.evaluate(()=>({scale:visualViewport.scale,scrollX,scrollY})); assert.deepEqual(report.afterPinch,{scale:1,scrollX:0,scrollY:0});
  report.errorsFromAudio=await page.evaluate(()=>window.__tla.diagnostics().audioFailures); assert.deepEqual(report.errorsFromAudio,[]);
}, {mobile:true});
