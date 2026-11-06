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
test('Storm chooses the approach platform, Kaze the higher flank, from the same Musgo encounter',()=>{
  const storm=route('stormdragon'),kaze=route('kaze');
  const stormPlatform=storm.w.level.platforms[storm.f.brain.patrol],kazePlatform=kaze.w.level.platforms[kaze.f.brain.patrol];
  assert.equal(stormPlatform.left,18);assert.equal(stormPlatform.y,8);
  assert.ok(kazePlatform.y<stormPlatform.y);assert.notEqual(storm.f.brain.patrol,kaze.f.brain.patrol);
});
test('Akane detours to a distant chest; armed Storm keeps pressuring the opponent',()=>{
  const storm=route('stormdragon',true),akane=route('akane',true);
  assert.notEqual(storm.f.brain.waypointX,6.5);
  assert.equal(akane.f.brain.waypointX,6.5);
});
test('an empty quiver overrides personality so Storm still seeks that chest',()=>{
  const {w,f}=route('stormdragon',true);f.ammo=0;f.inventory=[];f.brain.navigation=0;
  think(w,f);assert.equal(f.brain.waypointX,6.5);
});
