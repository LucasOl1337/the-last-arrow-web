import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createWorld, resetRound, step, DT } from '../src/sim/world.ts';
import { createPilot, keysToIntent } from './p1-rodada-10.mjs';
assert.equal(process.env.DISPLAY, ':80', 'requested proof route: tla');
const before = process.env.TLA_BEFORE === '1';
const out = `evidence/rodada-10${before ? '/antes' : ''}`;
await mkdir(out, { recursive: true });
const report = { protocol: '20 consecutive rounds per authored map/difficulty, seed 3; same 5Hz P1 controller before/after; round wins, not match wins; simulation seconds, no render/FPS claim', maps: [], summary: {} };
for (const difficulty of ['easy', 'normal']) for (const map of ['moss','totem','canopy','falls','roots']) {
  const w = createWorld({humans:1,bots:3,seed:3,map,difficulty});
  const pilot = createPilot(); let previous = [];
  const result = {map,difficulty,rounds:[],events:{},byFighter: w.fighters.map(f=>({id:f.id,shots:0,catches:0,kills:0,chests:0,travel:0,airTicks:0,activeTicks:0})),firstBotKills:[],maxQuiet:0};
  for (let round = 0; round < 20; round++) {
    if (round) { for (const f of w.fighters) f.score = 0; resetRound(w); }
    previous = []; let quiet = 0, firstBotKill = false;
    for (let n = 0; n < 11200; n++) {
      const keys = pilot(w); step(w, [keysToIntent(keys, previous)]); previous = keys;
      if (w.phase === 'playing') {
        quiet += DT;
        for(const f of w.fighters) if(f.alive) {
          const s=result.byFighter[f.id]; s.activeTicks++; if(!f.grounded) s.airTicks++;
          s.travel += Math.hypot(Math.min(Math.abs(f.x-f.prevX),32-Math.abs(f.x-f.prevX)),Math.min(Math.abs(f.y-f.prevY),18-Math.abs(f.y-f.prevY)));
        }
      }
      for(const e of w.events) {
        result.events[e.type]=(result.events[e.type]??0)+1;
        const s=result.byFighter[e.actor]; if(!s) continue;
        if(e.type==='shoot') {s.shots++; quiet=0;}
        if(e.type==='catch') s.catches++;
        if(e.type==='chest-open') s.chests++;
        if(e.type==='kill') {s.kills++; quiet=0; if(e.actor!==0&&!firstBotKill) {result.firstBotKills.push(w.roundTime); firstBotKill=true;} }
      }
      result.maxQuiet=Math.max(result.maxQuiet,quiet);
      if(w.phase==='roundover'||w.phase==='matchover') break;
    }
    assert.ok(w.phase==='roundover'||w.phase==='matchover');
    result.rounds.push({round:w.round,winner:w.winner,seconds:w.roundTime,humanKills:w.fighters[0].kills});
  }
  const wins=result.rounds.filter(r=>r.winner===0).length;
  result.wins=wins; result.winRate=wins/result.rounds.length;
  result.meanSeconds=result.rounds.reduce((s,r)=>s+r.seconds,0)/result.rounds.length;
  result.timeouts=result.rounds.filter(r=>r.seconds>=90).length;
  report.maps.push(result); console.log(JSON.stringify({map,difficulty,wins,meanSeconds:result.meanSeconds,timeouts:result.timeouts,events:result.events}));
}
for(const difficulty of ['easy','normal']) {
  const maps=report.maps.filter(m=>m.difficulty===difficulty), rounds=maps.flatMap(m=>m.rounds);
  report.summary[difficulty]={rounds:rounds.length,wins:maps.reduce((s,m)=>s+m.wins,0),winRate:maps.reduce((s,m)=>s+m.wins,0)/rounds.length,meanSeconds:rounds.reduce((s,r)=>s+r.seconds,0)/rounds.length,timeouts:maps.reduce((s,m)=>s+m.timeouts,0)};
}
await writeFile(`${out}/balance-report.json`,JSON.stringify(report,null,2));
console.log(report.summary);
