import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, WIDTH, HEIGHT, delta, solid, platformAt, nextPlatform } from '../src/sim/level.ts';
import { createWorld, DT } from '../src/sim/world.ts';
import { emptyIntent } from '../src/sim/input.ts';
import { moveFighter, HALF_H, HALF_W } from '../src/sim/physics.ts';
import { updateBow, stepArrows, ARROW_SPEED, ARROW_GRAVITY } from '../src/sim/arrows.ts';
import { stepChests } from '../src/sim/treasure.ts';
import { measureMaps, sightline } from '../scripts/measure-map-combat.mjs';

const CASES = [
  { map:'moss', open:5, shot:[0,3], jump:[8.5,15.45,13,12.45], wrapX:16 },
  { map:'totem', open:6, shot:[0,2], jump:[11,12.45,14.5,10.45], wrapX:2 },
  { map:'canopy', open:5, shot:[1,3], jump:[8,11.45,14.5,10.45], wrapX:4 },
  { map:'falls', open:5, shot:[0,3], jump:[10,14.45,7,12.45], wrapX:4 },
  { map:'roots', open:4, shot:[0,3], jump:[9,14.45,14.5,12.45], wrapX:4 },
] as const;

for (const c of CASES) {
  test(`${c.map}: explicit spawn sightlines and body-sized safe spawns`,()=>{
    const level=LEVELS.find(l=>l.id===c.map)!;
    const report=measureMaps().find(l=>l.id===c.map)!;
    assert.equal(report.sightlines.filter(s=>s.clear).length,c.open);
    assert.equal(new Set(level.spawns.map(s=>`${s.x},${s.y}`)).size,4);
    for(const s of level.spawns) {
      for(const x of [s.x-HALF_W,s.x+HALF_W]) for(const y of [s.y-HALF_H,s.y+HALF_H]) assert.equal(solid(level,x,y),false);
      assert.ok(solid(level,s.x,s.y+HALF_H+.02));
    }
    assert.ok(sightline(level,level.spawns[c.shot[0]],level.spawns[c.shot[1]]).clear);
  });

  test(`${c.map}: normal arrow reaches the fixed firing-angle target, not just an unobstructed ray`,()=>{
    const w=createWorld({map:c.map,humans:2,bots:0});w.phase='playing';
    const [a,b]=c.shot.map(i=>w.level.spawns[i]);
    const [shooter,target]=w.fighters;
    Object.assign(shooter,{...a,invulnerable:0});Object.assign(target,{...b,invulnerable:0});
    const dx=delta(a.x,b.x,WIDTH),dy=delta(a.y,b.y,HEIGHT),speed=ARROW_SPEED,g=ARROW_GRAVITY;
    const disc=speed**4-g*(g*dx*dx-2*dy*speed*speed);
    assert.ok(disc>=0);
    const slope=(-speed*speed+Math.sqrt(disc))/(g*Math.abs(dx));
    shooter.aimX=Math.sign(dx)/Math.hypot(1,slope);shooter.aimY=slope/Math.hypot(1,slope);
    updateBow(w,shooter,{...emptyIntent(),shoot:true});
    for(let tick=0;tick<2/DT && target.alive;tick++) stepArrows(w);
    assert.equal(target.alive,false,'fixed normal-arrow shot must hit before sticking on a tile');
    assert.ok(w.events.some(e=>e.type==='kill'&&e.target===target.id));
  });

  test(`${c.map}: every pickup surface has headroom and a directed route from each spawn`,()=>{
    const level=LEVELS.find(l=>l.id===c.map)!;
    for(const spawn of level.spawns) {
      const origin=platformAt(level,spawn.x,spawn.y).id, reached=new Set([origin]), queue=[origin];
      for(let i=0;i<queue.length;i++) for(const next of level.platforms[queue[i]].links) if(!reached.has(next)){reached.add(next);queue.push(next);}
      assert.equal(reached.size,level.platforms.length);
      for(const target of level.platforms) if(origin!==target.id) assert.ok(level.platforms[origin].links.includes(nextPlatform(level,origin,target.id).id));
    }
    // Finite surface enumeration, not input variations: these are all actual chest slots.
    for(const p of level.platforms) for(let x=p.left+.5;x<p.right;x++) {
      assert.equal(solid(level,x,p.y-.5),false);
      assert.equal(solid(level,x,p.y-1.5),false);
      assert.equal(solid(level,x,p.y),true);
    }
    const w=createWorld({map:c.map,seed:42,humans:2,bots:0});w.phase='playing';w.chestTimer=0;stepChests(w);
    assert.equal(w.chests?.length,1);
    const chest=w.chests![0];Object.assign(w.fighters[0],{x:chest.x,y:chest.y,ammo:0,inventory:[]});stepChests(w);
    assert.equal(w.chests?.length,0);assert.ok(w.fighters[0].ammo>0);
  });

  test(`${c.map}: fixed jump, horizontal seam and vertical drop use the real collision solver`,()=>{
    const w=createWorld({map:c.map,humans:2,bots:0}),f=w.fighters[0];
    const [x,y,targetX,targetY]=c.jump;Object.assign(f,{x,y,vx:0,vy:0,grounded:true,wall:0});
    const startY=f.y;let climbed=false,landed=false;
    for(let tick=0;tick<2/DT;tick++) {
      moveFighter(w,f,{...emptyIntent(),moveX:Math.abs(targetX-f.x)>.12?Math.sign(targetX-f.x):0,jump:tick===0,jumpHeld:true});
      if(f.y<startY-2)climbed=true;
      if(climbed&&f.grounded){landed=true;break;}
      assert.equal(solid(w.level,f.x,f.y),false);
    }
    assert.ok(climbed);assert.ok(landed);
    assert.ok(Math.abs(f.y-targetY)<.01,'jump must land on the specified neighboring ledge, not return to origin');
    assert.ok(Math.abs(f.x-targetX)<.8);
    // Open a chest and recover a stuck arrow where the real jump landed, without teleporting.
    w.phase='playing';w.chestTimer=12;f.ammo=0;f.inventory=[];
    w.chests=[{id:1,x:targetX,y:targetY,reward:['normal']}];stepChests(w);
    assert.equal(w.chests.length,0);assert.equal(f.ammo,1);
    w.arrows=[{id:1,owner:1,x:targetX,y:targetY,vx:0,vy:0,angle:0,stuck:true,age:1,kind:'normal'}];stepArrows(w);
    assert.equal(w.arrows.length,0);assert.equal(f.ammo,2);
    // Both ends of row zero are empty in every arena; x wraps without collision.
    Object.assign(f,{x:31.9,y:1,vx:7.8,vy:0,grounded:false,wall:0});
    for(let i=0;i<5;i++)moveFighter(w,f,{...emptyIntent(),moveX:1});
    assert.ok(f.x<1);
    Object.assign(f,{x:c.wrapX,y:17.8,vx:0,vy:19,grounded:false,wall:0});
    let wrapped=false;
    for(let i=0;i<1/DT;i++) {const before=f.y;moveFighter(w,f,emptyIntent());if(before>17&&f.y<1)wrapped=true;if(wrapped&&f.grounded)break;}
    assert.ok(wrapped);assert.ok(f.grounded,'drop through bottom must land on a real upper ledge');
  });
}

test('arena silhouettes differ structurally, not only by name/theme',()=>{
  const signatures=LEVELS.map(l=>l.platforms.map(p=>`${p.left}:${p.right}:${p.y}`).join('|'));
  assert.equal(new Set(signatures).size,5);
  assert.ok(LEVELS.find(l=>l.id==='canopy')!.rows.some(row=>row!==[...row].reverse().join('')));
});
