import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/sim/world.ts';
import { think } from '../src/sim/bot.ts';

function route(character: string, chest = false) {
  const w=createWorld({humans:1,bots:3,characters:['mizu',character,'kaze','akane'],seed:3}); w.phase='playing';
  const [target,f]=w.fighters;
  Object.assign(target,{x:20,y:7.45,invulnerable:0});
  Object.assign(f,{x:12,y:7.45,grounded:true,invulnerable:0});
  w.fighters[2].alive=w.fighters[3].alive=false;
  Object.assign(f.brain,{ready:true,target:0,reaction:1,shootTimer:1,travelled:5});
  if(chest)w.chests=[{id:1,x:6.5,y:4.45,reward:['bolt']}];
  think(w,f);return {w,f};
}
test('Storm keeps its approach route; retired Kaze uses Mizu navigation instead of a removed personality',()=>{
  const storm=route('stormdragon'),mizu=route('mizu'),legacy=route('kaze');
  const stormPlatform=storm.w.level.platforms[storm.f.brain.patrol];
  assert.equal(stormPlatform.left,18);assert.equal(stormPlatform.y,8);
  assert.equal(legacy.f.character,mizu.f.character);
  assert.equal(legacy.f.brain.patrol,mizu.f.brain.patrol);
  assert.equal(legacy.f.brain.waypointX,mizu.f.brain.waypointX);
});
test('retired Akane uses Storm pressure, not the removed supply-hunter behavior',()=>{
  const storm=route('stormdragon',true),legacy=route('akane',true);
  assert.notEqual(storm.f.brain.waypointX,6.5);
  assert.equal(legacy.f.character,storm.f.character);
  assert.equal(legacy.f.brain.waypointX,storm.f.brain.waypointX);
});
test('an empty quiver overrides personality so Storm still seeks that chest',()=>{
  const {w,f}=route('stormdragon',true);f.ammo=0;f.inventory=[];f.brain.navigation=0;
  think(w,f);assert.equal(f.brain.waypointX,6.5);
});
