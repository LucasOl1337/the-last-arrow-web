import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, step, snapshot, DT } from '../src/sim/world.ts';
import { emptyIntent } from '../src/sim/input.ts';
import { LEVELS, WIDTH, HEIGHT, solid, nextPlatform } from '../src/sim/level.ts';
import { moveFighter } from '../src/sim/physics.ts';
import { updateBow, stepArrows } from '../src/sim/arrows.ts';
import { kill, stepRules, checkStomps } from '../src/sim/rules.ts';
import { think } from '../src/sim/bot.ts';
import type { World } from '../src/sim/world.ts';
function arena(): World {
  const w = createWorld({ humans: 2, bots: 0, seed: 42 });
  w.phase = 'playing';
  for (const f of w.fighters) f.invulnerable = 0;
  w.level = { ...w.level, rows: Array(18).fill('.'.repeat(32)) };
  Object.assign(w.fighters[0], { x: 8, y: 8, prevX: 8, prevY: 8 });
  Object.assign(w.fighters[1], { x: 20, y: 8, prevX: 20, prevY: 8 });
  return w;
}
function floor(w: World) { const rows = [...w.level.rows]; rows[10] = '#'.repeat(32); w.level = { ...w.level, rows }; }
test('five 32x18 maps have safe distinct spawns and connected platform paths', () => {
  assert.equal(LEVELS.length, 5);
  for (const level of LEVELS) {
    assert.equal(level.rows.length, HEIGHT); assert.ok(level.rows.every(row => row.length === WIDTH));
    assert.equal(new Set(level.spawns.map(p => `${p.x},${p.y}`)).size, 4);
    for (const s of level.spawns) assert.equal(solid(level, s.x, s.y), false);
    assert.ok(level.platforms.every(p => p.links.length > 0));
    assert.ok(nextPlatform(level, 0, level.platforms.length - 1));
  }
});
test('coyote, buffered jump, release cut, fast fall and wall jump', () => {
  const w = arena(), f = w.fighters[0], i = emptyIntent();
  f.coyote = 0.06; i.jump = i.jumpHeld = true;
  moveFighter(w, f, i); assert.ok(f.vy < -15);
  i.jump = i.jumpHeld = false; moveFighter(w, f, i); assert.ok(f.vy > -6);
  f.vy = 5; i.moveY = 1; moveFighter(w, f, i); assert.ok(f.vy > 5.5);
  floor(w); Object.assign(f, { y: 9.43, vy: 3, coyote: 0, grounded: false });
  i.moveY = 0; i.jump = i.jumpHeld = true; moveFighter(w, f, i);
  i.jump = false; moveFighter(w, f, i); assert.ok(f.vy < -15);
  Object.assign(f, { x: 8, y: 6, wall: 1, grounded: false, coyote: 0 });
  i.jump = true; moveFighter(w, f, i); assert.ok(f.vx < 0); assert.ok(f.vy < -15);
});
test('AABB blocks walls, head hits, landing and wall slide', () => {
  const w = arena(), f = w.fighters[0], i = emptyIntent(); floor(w);
  const rows = [...w.level.rows]; rows[7] = '.........#......................'; rows[8] = rows[7]; w.level = { ...w.level, rows };
  Object.assign(f, { x: 8.67, y: 8, vx: 7, vy: 5 }); i.moveX = 1;
  moveFighter(w, f, i); assert.ok(f.x <= 8.68); assert.equal(f.wall, 1);
  moveFighter(w, f, i); assert.ok(f.vy <= 3);
  Object.assign(f, { x: 5, y: 9.44, vy: 10 }); moveFighter(w, f, emptyIntent()); assert.equal(f.grounded, true);
  Object.assign(f, { x: 9.5, y: 9.56, vy: -10 }); moveFighter(w, f, { ...emptyIntent(), jumpHeld: true }); assert.equal(f.vy, 0);
});
test('fighters and arrows wrap on both axes', () => {
  const w = arena(), f = w.fighters[0];
  Object.assign(f, { x: 31.99, y: 17.99, vx: 10, vy: 10, dashTime: 0.1 });
  moveFighter(w, f, emptyIntent()); assert.ok(f.x < 1 && f.y < 1);
  Object.assign(f, { x: 0.01, y: 0.01, vx: -10, vy: -10, dashTime: 0.1 });
  moveFighter(w, f, emptyIntent()); assert.ok(f.x > 31 && f.y > 17);
  w.arrows.push({ id: 1, owner: 0, x: 31.99, y: 17.99, vx: 23, vy: 8, angle: 0, age: 0, stuck: false });
  stepArrows(w); assert.ok(w.arrows[0].x < 1 && w.arrows[0].y < 1);
});
test('hold/release fires once, eight-way aim, ammo cap and recoverable wall arrows', () => {
  const w = arena(), f = w.fighters[0], i = { ...emptyIntent(), moveX: 1, moveY: -1, shoot: true, shootHeld: true };
  moveFighter(w, f, i); updateBow(w, f, i); assert.equal(w.arrows.length, 0);
  i.shoot = i.shootHeld = false; updateBow(w, f, i); assert.equal(w.arrows.length, 1); assert.equal(f.ammo, 2);
  assert.ok(Math.abs(w.arrows[0].vx + w.arrows[0].vy) < 0.001);
  updateBow(w, f, i); assert.equal(w.arrows.length, 1);
  w.arrows.length = 0; floor(w);
  w.arrows.push({ id: 2, owner: 0, x: 8, y: 9.95, vx: 0, vy: 23, angle: 1, age: 0.4, stuck: false });
  stepArrows(w); assert.equal(w.arrows[0].stuck, true);
  f.y = 9.45; f.ammo = 5; stepArrows(w); assert.equal(f.ammo, 6); assert.equal(w.arrows.length, 0);
});
test('one arrow kills; timed dash catches instead and respects cooldown', () => {
  const w = arena(), victim = w.fighters[1];
  const arrow = () => ({ id: 1, owner: 0, x: victim.x - 0.4, y: victim.y, vx: 23, vy: 0, angle: 0, age: 0.5, stuck: false });
  moveFighter(w, victim, { ...emptyIntent(), moveX: -1, dash: true });
  const cooldown = victim.dashCooldown;
  w.arrows.push(arrow()); stepArrows(w); assert.equal(victim.alive, true); assert.equal(victim.ammo, 4);
  moveFighter(w, victim, { ...emptyIntent(), dash: true }); assert.ok(victim.dashCooldown < cooldown);
  victim.invulnerable = 0; w.arrows.push(arrow()); stepArrows(w); assert.equal(victim.alive, false);
});
test('stomp kills only from above and bounces the attacker', () => {
  const w = arena(), [a, b] = w.fighters;
  Object.assign(a, { x: 8, y: 8, prevX: 8, prevY: 7.9, vy: 8 });
  Object.assign(b, { x: 8, y: 9.05, prevX: 8, prevY: 9.05 });
  checkStomps(w); assert.equal(b.alive, false); assert.equal(a.vy, -10);
});
test('last survivor scores once, five wins ends match, zero survivors draw', () => {
  const w = arena(); w.fighters[0].score = 4;
  kill(w, w.fighters[1], 0); stepRules(w); assert.equal(w.phase, 'matchover'); assert.equal(w.winner, 0);
  stepRules(w); assert.equal(w.fighters[0].score, 5);
  const draw = arena(); kill(draw, draw.fighters[0], 1); kill(draw, draw.fighters[1], 0); stepRules(draw);
  assert.equal(draw.phase, 'roundover'); assert.equal(draw.winner, null); assert.deepEqual(draw.fighters.map(f => f.score), [0, 0]);
});
test('bot seeks recoverable ammo and unsticks using jump/dash', () => {
  const w = createWorld({ humans: 0, bots: 4 }); w.phase = 'playing';
  const f = w.fighters[0]; f.ammo = 0;
  w.arrows.push({ id: 1, owner: 1, x: f.x + 2, y: f.y, vx: 0, vy: 0, age: 1, stuck: true, angle: 0 });
  assert.equal(think(w, f).moveX, 1);
  f.brain.stuck = 0.9; f.brain.reaction = 1;
  const i = think(w, f); assert.equal(i.jump, true); assert.equal(i.dash, true);
});
test('seed 42 four-bot match completes naturally and replays deterministically', () => {
  const a = createWorld({ humans: 0, bots: 4, seed: 42 }), b = createWorld({ humans: 0, bots: 4, seed: 42 });
  let kills = 0;
  for (let n = 0; n < 240 / DT && a.phase !== 'matchover'; n++) { step(a); step(b); kills += a.events.filter(e => e.type === 'kill').length; }
  assert.equal(a.phase, 'matchover'); assert.ok(kills >= 15); assert.ok(a.round > 1);
  assert.deepEqual(snapshot(a), snapshot(b));
});
test('one human vs three bots reaches victory without controlling the human', () => {
  const w = createWorld({ humans: 1, bots: 3, seed: 7 });
  for (let n = 0; n < 300 / DT && w.phase !== 'matchover'; n++) step(w);
  assert.equal(w.phase, 'matchover'); assert.ok(w.fighters.some(f => !f.human && f.score === 5));
});
