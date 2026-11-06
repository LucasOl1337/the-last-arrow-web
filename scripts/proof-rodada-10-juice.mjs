import { proof } from './bench-rodada-10.mjs';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';

await proof('juice',async({page,base,report,shot})=>{
  report.catches=[];
  for(const reduced of [false,true]) {
    await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
    await page.goto(`${base}?seed=3`);await page.getByRole('button',{name:'Começar partida'}).click();
    await page.waitForFunction(()=>window.__tla.diagnostics().models);
    await page.evaluate(()=>window.__tla.startMatch({humans:1,bots:3,map:'totem',seed:3}));
    await page.waitForFunction(()=>window.__tla.world.phase==='playing');
    // Let the real 700ms LUTEM hint finish; it otherwise covers this authored early catch.
    await delay(800);
    await page.evaluate(()=>{
      window.__tla.setTimeScale(0);const w=window.__tla.world;w.roundTime=6;w.arrows=[];
      const poses=[[16,10.45],[26,1.44],[6,1.44],[11,5.44]];
      w.fighters.forEach((f,id)=>Object.assign(f,{x:poses[id][0],prevX:poses[id][0],y:poses[id][1],prevY:poses[id][1],vx:0,vy:0,invulnerable:0,grounded:true,dashTime:0,dashCooldown:0,charging:false}));
      w.arrows.push({id:w.nextArrowId++,owner:1,x:13.9,y:10.35,vx:23,vy:0,age:.3,stuck:false,angle:0});
      window.catch10={events:[],frames:[]};const push=w.events.push;
      w.events.push=function(...events){window.catch10.events.push(...events.map(e=>({...e,tick:w.tick,at:performance.now()})));return push.apply(this,events);};
      const until=performance.now()+1200;
      const frame=now=>{window.catch10.frames.push({at:now,tick:w.tick});if(now<until)requestAnimationFrame(frame);};requestAnimationFrame(frame);
    });
    await page.keyboard.down('KeyA');await page.keyboard.down('KeyL');
    await page.evaluate(()=>window.__tla.setTimeScale(1));
    await page.waitForFunction(()=>window.catch10.events.some(e=>e.type==='catch'&&e.actor===0));
    await page.keyboard.up('KeyL');await page.keyboard.up('KeyA');
    await page.locator('.catch-label:not([hidden])').waitFor();
    await shot(reduced?'catch-reduced-motion':'catch-real');
    const ammo=await page.evaluate(()=>window.__tla.world.fighters[0].ammo);assert.equal(ammo,4);
    await delay(650);
    assert.equal(await page.locator('.catch-label:not([hidden])').count(),0,'feedback expires');
    const capture=await page.evaluate(()=>window.catch10), event=capture.events.find(e=>e.type==='catch'&&e.actor===0);
    const frames=capture.frames.filter(f=>f.at>=event.at-20&&f.at<event.at+160);
    let frozen=0;
    for(let i=1;i<frames.length;i++)if(frames[i].tick===frames[i-1].tick)frozen+=frames[i].at-frames[i-1].at;
    assert.ok(reduced?frozen<25:frozen>=25&&frozen<=85,`catch frozen ${frozen}ms, reduced ${reduced}`);
    report.catches.push({reduced,ammo,frozenMs:frozen,...capture});
  }
  // Authored positions at all four wrap boundaries; sim frozen for inspection only.
  await page.evaluate(()=>{
    window.__tla.startMatch({humans:1,bots:3,map:'moss',seed:3});window.__tla.setTimeScale(0);
    const w=window.__tla.world;w.phase='playing';w.roundTime=6;
    const poses=[[0.05,9],[31.95,9],[13,.05],[19,17.95]];
    w.fighters.forEach((f,i)=>Object.assign(f,{x:poses[i][0],prevX:poses[i][0],y:poses[i][1],prevY:poses[i][1],invulnerable:0}));
  });
  await delay(150);await shot('wrap-four-edges');
  report.directions=await page.locator('.wrap-direction:not([hidden])').allTextContents();
  assert.deepEqual(report.directions,['←','→','↑','↓']);
  await page.evaluate(()=>{const w=window.__tla.world;w.fighters.forEach((f,i)=>Object.assign(f,{x:8+5*i,prevX:8+5*i,y:8,prevY:8}));});
  await delay(80);assert.equal(await page.locator('.wrap-direction:not([hidden])').count(),0);
  // A real horizontal crossing, keyboard input, not a fabricated wrap event.
  await page.evaluate(()=>{const f=window.__tla.world.fighters[0];Object.assign(f,{x:31.9,prevX:31.9,y:8.5,prevY:8.5,vx:0,vy:0});window.__tla.setTimeScale(1);});
  await page.keyboard.down('KeyD');
  await page.waitForFunction(()=>window.__tla.world.fighters[0].x<.5);await page.keyboard.up('KeyD');
  await page.evaluate(()=>window.__tla.setTimeScale(0));
  await shot('wrap-keyboard-arrival');report.wrapped=await page.evaluate(()=>window.__tla.state());
  assert.ok(report.wrapped.fighters[0].x<.5);
  await page.evaluate(()=>{window.__tla.world.fighters[0].alive=false;});await delay(50);
  assert.equal(await page.locator('.overhead').first().isVisible(),false,'dead fighter has no edge label');
  await page.evaluate(()=>window.__tla.startMatch({humans:1,bots:3}));await delay(80);
  assert.equal(await page.locator('.catch-label:not([hidden])').count(),0,'rematch clears feedback');
});
