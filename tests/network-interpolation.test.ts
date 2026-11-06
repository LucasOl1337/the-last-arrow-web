import {test} from 'node:test';import assert from 'node:assert/strict';
import {createWorld} from '../src/sim/world.ts';import {joinSnapshot} from '../src/net/interpolation.ts';
test('packet burst continues from the displayed pose instead of jumping to old destination',()=>{
 const old=createWorld({humans:2,bots:0});old.phase='playing';old.tick=120;Object.assign(old.fighters[0],{prevX:10,x:12,prevY:6,y:6});
 const next=structuredClone(old);next.tick=124;next.fighters[0].x=14;
 const beforeDisplayed=10.5;const duration=joinSnapshot(old,next,.25);
 assert.equal(next.fighters[0].prevX,beforeDisplayed);assert.equal(next.fighters[0].x,14);assert.equal(duration,1000/30);
 // Previous implementation began at12: a1.5world-unit discontinuity in the exact same case.
 assert.equal(Math.abs(12-beforeDisplayed),1.5);assert.equal(Math.abs(next.fighters[0].prevX-beforeDisplayed),0);
});
test('100ms packet gap uses bounded catch-up and toroidal continuity',()=>{
 const old=createWorld();old.tick=120;Object.assign(old.fighters[0],{prevX:31.8,x:.2,prevY:6,y:6});
 const next=structuredClone(old);next.tick=132;next.fighters[0].x=.8;
 assert.equal(joinSnapshot(old,next,.5),100);assert.ok(Math.abs(next.fighters[0].prevX-32)<1e-9);assert.equal(next.fighters[0].x,.8);
});
test('respawn and new rounds snap rather than animate through platforms',()=>{
 const old=createWorld();old.fighters[0].alive=false;const next=structuredClone(old);next.fighters[0].alive=true;next.fighters[0].x=20;
 joinSnapshot(old,next,.2);assert.equal(next.fighters[0].prevX,20);
 const round=structuredClone(next);round.round++;round.fighters[0].x=5;joinSnapshot(next,round,.1);assert.equal(round.fighters[0].prevX,5);
});
