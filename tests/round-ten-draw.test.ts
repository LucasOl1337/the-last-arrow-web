import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, DT } from '../src/sim/world.ts';
import { think } from '../src/sim/bot.ts';
import { updateBow } from '../src/sim/arrows.ts';
import { moveFighter } from '../src/sim/physics.ts';
import { HEIGHT, WIDTH } from '../src/sim/level.ts';

function drawing(difficulty: 'easy' | 'normal') {
  const w=createWorld({humans:1,bots:3,difficulty,seed:3});w.phase='playing';
  w.level={...w.level,rows:Array(HEIGHT).fill('.'.repeat(WIDTH))};
  w.fighters[2].alive=w.fighters[3].alive=false;
  const [target,f]=w.fighters;
  Object.assign(target,{x:8,y:8,vx:0,vy:0,invulnerable:0});
  Object.assign(f,{x:12,y:8,vx:0,vy:0,invulnerable:0});
  Object.assign(f.brain,{ready:true,target:0,reaction:1,shootTimer:0,travelled:3,aimError:0});
  const i={...think(w,f)}; moveFighter(w,f,i);updateBow(w,f,i);
  assert.equal(f.charging,true);assert.equal(f.aimX,-1);
  return {w,f,target};
}
test('easy telegraphs a fixed leftward draw for at least 400ms, without tracking a target that crosses behind',()=>{
  const {w,f,target}=drawing('easy'); target.x=16;
  let ticks=1;
  while(f.charging&&ticks<120) {
    const i={...think(w,f)};
    assert.equal(i.moveX,-1,'keep the telegraphed eight-way aim');
    // Only bow advances: exact aiming case, no movement/gravity confound.
    updateBow(w,f,i);ticks++;
  }
  assert.ok(ticks*DT>=.4,`draw ${ticks*DT}s`);
  assert.equal(w.arrows.length,1);assert.ok(w.arrows[0].vx<0);
});
test('normal gives at least 260ms to read a committed shot, shorter than easy',()=>{
  const {w,f,target}=drawing('normal'); target.y=3;
  let ticks=1;
  while(f.charging&&ticks<120) {const i={...think(w,f)};assert.equal(i.moveY,0);updateBow(w,f,i);ticks++;}
  assert.ok(ticks*DT>=.26&&ticks*DT<.4);assert.equal(w.arrows.length,1);
});
