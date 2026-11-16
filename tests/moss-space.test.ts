import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, WIDTH, HEIGHT, solid } from '../src/sim/level.ts';
import { createWorld, step, DT } from '../src/sim/world.ts';
import { moveFighter } from '../src/sim/physics.ts';
import { emptyIntent } from '../src/sim/input.ts';
const level=LEVELS.find(l=>l.id==='moss')!;

test('Musgo adds real supporting floor, not camera zoom or stretched models',()=>{
  assert.equal(WIDTH,32);assert.equal(HEIGHT,18);
  assert.equal(level.platforms.reduce((n,p)=>n+p.right-p.left,0),60); // was 48
  assert.equal(level.platforms.length,10);
  assert.equal(level.rows[13],'..........############..........');
  assert.equal(level.rows[8],'....########........########....');
});
test('a fighter can run across added middle floor; horizontal air seam stays open',()=>{
  const w=createWorld({humans:2,bots:0,map:'moss'}), f=w.fighters[0];
  Object.assign(f,{x:9.5,y:7.45,vx:0,vy:0,grounded:true});
  for(let i=0;i<.2/DT;i++)moveFighter(w,f,{...emptyIntent(),moveX:1});
  assert.ok(f.x>10.3);assert.equal(f.grounded,true); // previously fell after x=10
  Object.assign(f,{x:.4,y:1,vx:-7.8,vy:0,grounded:false});
  for(let i=0;i<.2/DT;i++)moveFighter(w,f,{...emptyIntent(),moveX:-1});
  assert.ok(f.x>30);assert.equal(solid(level,f.x,f.y),false);
});
test('official four-bot Musgo seed 42 still fights, traverses and resolves a round',()=>{
 const w=createWorld({humans:0,bots:4,map:'moss',seed:42});
 const events={kill:0,jump:0,shoot:0};
 while(w.round===1 && w.tick<35/DT){step(w);for(const e of w.events)if(e.type in events)events[e.type as keyof typeof events]++;}
 assert.equal(w.round,2);assert.equal(events.kill,3);assert.ok(events.jump>0);assert.ok(events.shoot>0);
});
