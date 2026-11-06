import { createWorld, resetRound, step } from '../src/sim/world.ts';
import { createPilot, keysToIntent } from './p1-rodada-10.mjs';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
assert.equal(process.env.DISPLAY,':80');
const w=createWorld({humans:1,bots:3,map:'totem',difficulty:'normal',seed:3}),pilot=createPilot();
let previous=[],lastSample=-1;const samples=[];let fixture=null;
for(let r=1;r<=5;r++){
  if(r>1){for(const f of w.fighters)f.score=0;resetRound(w);}previous=[];
  for(let tick=0;tick<11200;tick++){
    const keys=pilot(w);step(w,[keysToIntent(keys,previous)]);previous=keys;
    if(r===5&&Math.floor(w.roundTime)!==lastSample){lastSample=Math.floor(w.roundTime);
      samples.push(structuredClone({time:w.roundTime,phase:w.phase,chests:w.chests,arrows:w.arrows,events:w.events,fighters:w.fighters}));
      if(!fixture&&w.roundTime>=25)fixture=structuredClone(w);
    }
    if(w.phase==='roundover'||w.phase==='matchover')break;
  }
}
await writeFile('evidence/rodada-10/duel-inspection.json',JSON.stringify({samples,fixture},null,2));
for(const s of samples)console.log(s.time.toFixed(1),s.fighters.filter(f=>f.alive).map(f=>({id:f.id,x:f.x.toFixed(1),y:f.y.toFixed(1),ammo:f.ammo,charging:f.charging,patrol:f.brain.patrol,waypoint:[f.brain.waypointX,f.brain.waypointY],shootTimer:f.brain.shootTimer,travel:f.brain.travelled})),s.arrows.length);
