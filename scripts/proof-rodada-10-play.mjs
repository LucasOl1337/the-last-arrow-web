import { proof, measure } from './bench-rodada-10.mjs';
import { createPilot } from './p1-rodada-10.mjs';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { checkScreen } from './check-screen.mjs';

await proof('play', async ({page,base,report,shot}) => {
  await page.goto(`${base}?seed=3`);
  await page.getByRole('button',{name:'Começar partida'}).click();
  await page.waitForFunction(()=>window.__tla.diagnostics().models);
  report.maps=[];
  for(const difficulty of ['easy','normal']) for(const map of ['moss','totem','canopy','falls','roots']) {
    await page.evaluate(({map,difficulty})=>window.__tla.startMatch({map,difficulty,humans:1,bots:3,seed:3}),{map,difficulty});
    await page.evaluate(()=>{
      const w=window.__tla.world; window.play10={events:[],rounds:[],samples:[]};
      const push=w.events.push;
      w.events.push=function(...events) {
        window.play10.events.push(...events.map(e=>({...e,tick:w.tick,round:w.round,seconds:w.roundTime})));
        for(const e of events) if(e.type==='round'||e.type==='victory') window.play10.rounds.push({round:w.round,winner:w.winner,seconds:w.roundTime});
        return push.apply(this,events);
      };
    });
    await page.waitForFunction(()=>window.__tla.state().phase==='playing');
    const pilot=createPilot(); let held=[];
    const measurement=measure(page,10000), begin=Date.now(); let captured=false;
    // Entire 18s observation is actively keyboard-piloted at 1x, including any new rounds.
    while(Date.now()-begin<18000) {
      const state=await page.evaluate(()=>window.__tla.state()), keys=pilot(state);
      for(const key of held) if(!keys.includes(key)) await page.keyboard.up(key);
      for(const key of keys) if(!held.includes(key)) await page.keyboard.down(key);
      held=keys;
      await page.evaluate(()=>{const w=window.__tla.world;window.play10.samples.push({round:w.round,time:w.roundTime,phase:w.phase,fighters:w.fighters.map(f=>({id:f.id,alive:f.alive,x:f.x,y:f.y,charging:f.charging,ammo:f.ammo,brain:{target:f.brain.target,patrol:f.brain.patrol,hold:f.brain.hold}}))});});
      if(!captured&&Date.now()-begin>4000&&state.phase==='playing') {await shot(`${difficulty}-${map}`);captured=true;}
      await delay(50);
    }
    for(const key of held) await page.keyboard.up(key);
    const m=await measurement, play=await page.evaluate(()=>window.play10);
    assert.ok(m.fps>=58,`${difficulty}/${map} FPS ${m.fps}`);
    assert.equal(m.diagnostics.models,true); assert.deepEqual(m.diagnostics.audioFailures,[]);
    assert.ok(play.events.some(e=>e.actor===0&&e.type==='shoot'),'P1 keyboard fires');
    report.maps.push({difficulty,map,measurement:m,...play});
    console.log(difficulty,map,m.fps,'rounds',play.rounds.length,'P1 shots',play.events.filter(e=>e.actor===0&&e.type==='shoot').length);
  }
  report.screens={};
  for(const [width,height] of [[1366,768],[900,1000],[844,390]]) {
    await page.setViewportSize({width,height}); await delay(150);
    report.screens[`${width}x${height}`]=await checkScreen(page,'#game');assert.ok(report.screens[`${width}x${height}`].passou);
    await shot(`arena-${width}x${height}`);
  }
  report.renderer=await page.evaluate(()=>{const c=document.querySelector('canvas').getContext('webgl2'),e=c.getExtension('WEBGL_debug_renderer_info');return c.getParameter(e.UNMASKED_RENDERER_WEBGL);});
});
