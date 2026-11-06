import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, DT } from '../src/sim/world.ts';
import { think } from '../src/sim/bot.ts';
import { moveFighter } from '../src/sim/physics.ts';

// Totem seed3/round5: unarmed Akane at x=.18,y=5.45 repeatedly aimed for
// x=31.3, but both edges have contiguous floor at y=6. It never reached the chest below.
test('supply route descends past the real edge of Totem continuous wrap ledge',()=>{
  const w=createWorld({humans:1,bots:3,map:'totem',difficulty:'normal',seed:3});w.phase='playing';
  const f=w.fighters[3];
  Object.assign(f,{x:.18,y:5.45,prevX:.18,prevY:5.45,vx:0,vy:0,grounded:true,ammo:0,inventory:[],invulnerable:0});
  w.fighters[0].alive=w.fighters[1].alive=false;
  Object.assign(w.fighters[2],{x:31.65,y:5.45,invulnerable:0});
  w.chests=[{id:2,x:1.5,y:12.5,reward:['normal','normal']}];
  Object.assign(f.brain,{ready:true,target:2,reaction:1,shootTimer:1,travelled:20});
  const intent={...think(w,f)};
  assert.ok(f.brain.waypointX>3&&f.brain.waypointX<4,`exit at real edge, not seam: ${f.brain.waypointX}`);
  moveFighter(w,f,intent);
  let descended=false;
  for(let tick=0;tick<Math.round(2/DT);tick++){
    moveFighter(w,f,think(w,f));
    if(f.y>7){descended=true;break;}
  }
  assert.ok(descended,'route must actually leave the wrap platform');
});
