import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, DT } from '../src/sim/world.ts';
import { think } from '../src/sim/bot.ts';
import { WIDTH, HEIGHT } from '../src/sim/level.ts';

function encounter(difficulty: 'easy' | 'normal' | 'hard') {
  const w = createWorld({ humans: 1, bots: 3, difficulty, seed: 3 });
  w.phase = 'playing';
  w.level = { ...w.level, rows: Array(HEIGHT).fill('.'.repeat(WIDTH)) };
  w.fighters[2].alive = w.fighters[3].alive = false;
  Object.assign(w.fighters[0], { x: 8, y: 8, vx: 0, vy: 0, invulnerable: 0 });
  const f = w.fighters[1];
  Object.assign(f, { x: 12, y: 8, vx: 0, vy: 0, invulnerable: 0 });
  Object.assign(f.brain, { ready: true, target: 0, reaction: 0, shootTimer: 4, lastX:12,lastY:8 });
  w.arrows.push({id:7,owner:0,x:10.2,y:8,vx:23,vy:0,age:.3,stuck:false,angle:0});
  return {w,f};
}

test('easy cannot instantly catch an arrow first seen 78ms from impact', () => {
  const {w,f}=encounter('easy');
  assert.equal(think(w,f).dash,false);
});
test('normal cannot instantly catch an arrow first seen 78ms from impact', () => {
  const {w,f}=encounter('normal');
  assert.equal(think(w,f).dash,false);
});
test('hard retains its deliberate close-range interception', () => {
  const {w,f}=encounter('hard');
  const intent=think(w,f); assert.equal(intent.dash,true);assert.equal(intent.moveX,-1);
});
test('normal may catch a threat observed for its full reaction time, but not through terrain', () => {
  const {w,f}=encounter('normal');
  // Repeated perception of this single fixed arrow; no physics advance in this unit fixture.
  w.arrows[0].x=5;
  for(let n=0;n<Math.ceil(.24/DT)+1;n++) think(w,f);
  w.arrows[0].x=10.2;
  assert.equal(think(w,f).dash,true);
  const blocked=encounter('normal');
  blocked.w.level.rows=Array(HEIGHT).fill('...........#....................');
  for(let n=0;n<Math.ceil(.24/DT)+1;n++) think(blocked.w,blocked.f);
  assert.equal(think(blocked.w,blocked.f).dash,false);
});
