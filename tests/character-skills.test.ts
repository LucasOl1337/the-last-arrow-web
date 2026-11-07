import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, DT, resetRound, snapshot, step } from '../src/sim/world.ts';
import { emptyIntent } from '../src/sim/input.ts';
import { moveFighter } from '../src/sim/physics.ts';
import { stepArrows } from '../src/sim/arrows.ts';
import { activateSkill, stepSkills, WATER_COOLDOWN, STORM_COOLDOWN } from '../src/sim/skills.ts';
import { think, predictShot } from '../src/sim/bot.ts';
import { parseIntent } from '../src/net/protocol.ts';
import { kill } from '../src/sim/rules.ts';

function arena() {
  const w = createWorld({ humans: 2, bots: 0, difficulty: 'hard' }); w.phase = 'playing';
  w.level = { ...w.level, rows: Array(18).fill('.'.repeat(32)) };
  w.fighters.forEach((f, id) => Object.assign(f, { x: 10 + id * 2, y: 8, prevX: 10 + id * 2, prevY: 8, invulnerable: 0 }));
  return w;
}
const incoming = (kind: 'normal' | 'bolt' | 'bomb' = 'normal') => ({ id: 7, owner: 1, x: 10.7, y: 8, vx: -23, vy: 0, angle: Math.PI, age: 1, stuck: false, kind });

test('same validated legacy skill command produces two distinct states/cooldowns, without interrupting draw', () => {
  const w = arena(); const input = parseIntent({ ...emptyIntent(), dash: true, moveX: 1, shootHeld: true })!;
  step(w, [input, input]);
  const [mizu, storm] = w.fighters;
  assert.equal(mizu.skill?.kind, 'water-guard'); assert.equal(mizu.dashCooldown, WATER_COOLDOWN);
  assert.equal(storm.skill?.kind, 'storm-gust'); assert.equal(storm.dashCooldown, STORM_COOLDOWN);
  assert.equal(mizu.charging, true); assert.equal(storm.charging, true);
  assert.equal(mizu.ammo, 3); assert.equal(storm.ammo, 3);
  assert.equal(w.events.filter(e => e.type === 'skill').length, 2);
  assert.equal(mizu.dashTime, .15 - DT); assert.equal(storm.dashTime, .15 - DT);
});
test('Mizu ward stays at origin and absorbs exactly one hostile bomb without explosion/ammo gain', () => {
  const w = arena(), f = w.fighters[0];
  moveFighter(w, f, { ...emptyIntent(), dash: true, moveX: -1 });
  assert.equal(f.skill?.x, 10); assert.ok(f.x < 10);
  f.x = 8; f.dashTime = 0; f.skill!.time = .54;
  w.arrows = [incoming('bomb'), { ...incoming(), id: 8 }];
  stepArrows(w);
  assert.equal(w.arrows.length, 1); assert.equal(f.skill?.charges, 0);
  assert.equal(w.events.some(e => e.type === 'explosion'), false); assert.equal(f.ammo, 3);
  assert.equal(w.events.filter(e => e.skill === 'water-guard' && e.type === 'impact').length, 1);
});
test('Mizu initial timed dodge still catches for ammo, then its remaining ward intercepts', () => {
  const w = arena(), f = w.fighters[0];
  moveFighter(w, f, { ...emptyIntent(), dash: true, moveX: 1 });
  w.arrows = [{ ...incoming(), x: f.x + .3 }]; stepArrows(w);
  assert.equal(f.ammo, 4); assert.equal(f.skill?.charges, 1);
  assert.equal(w.events.some(e => e.type === 'catch'), true);
  f.dashTime = 0; f.x = 8; w.arrows = [incoming()]; stepArrows(w);
  assert.equal(f.ammo, 4); assert.equal(f.skill?.charges, 0);
});
test('Mizu ward intercepts piercing bolt but not own arrow or a shot outside its radius', () => {
  const w = arena(), f = w.fighters[0]; activateSkill(w, f); f.x = 8;
  w.arrows = [incoming('bolt')]; stepArrows(w); assert.equal(w.arrows.length, 0);
  activateSkill(w, f); f.skill!.x = 10;
  w.arrows = [{ ...incoming(), owner: 0 }, { ...incoming(), id: 8, x: 11.2 }];
  stepArrows(w); assert.equal(w.arrows.length, 2); assert.equal(f.skill?.charges, 1);
});
test('Mizu expired ward and ward behind a wall cannot intercept', () => {
  const w = arena(), f = w.fighters[0]; activateSkill(w, f); f.x = 8;
  f.skill!.time = DT; moveFighter(w, f, emptyIntent());
  w.arrows = [incoming('bolt')]; stepArrows(w); assert.equal(w.arrows.length, 1);
  activateSkill(w, f); f.skill!.x = 10; f.skill!.y = 8;
  w.level.rows[8] = '.'.repeat(10) + '#' + '.'.repeat(21);
  w.arrows = [incoming('bolt')]; stepArrows(w); assert.equal(w.arrows.length, 1); assert.equal(f.skill?.charges, 1);
});
test('Storm pulse pushes once, deals no damage, preserves projectile ownership and ignores own/stuck arrows', () => {
  const w = arena(), storm = w.fighters[1], target = w.fighters[0];
  Object.assign(storm, { x: 10, y: 8 }); Object.assign(target, { x: 11, y: 8 });
  w.arrows = [{ ...incoming(), owner: 0, x: 11 }, { ...incoming(), id: 8, owner: 1 }, { ...incoming(), id: 9, owner: 0, stuck: true }];
  activateSkill(w, storm); stepSkills(w);
  assert.equal(target.vx, 12); assert.equal(target.alive, true);
  assert.equal(w.arrows[0].vx, 23); assert.equal(w.arrows[0].owner, 0);
  assert.equal(w.arrows[1].vx, -23); assert.equal(w.arrows[2].vx, -23);
  stepSkills(w); assert.equal(target.vx, 12, 'no repeated per-tick impulse');
});
test('Storm pulse respects radius, spawn protection, walls and toroidal distance', () => {
  const w = arena(), storm = w.fighters[1], target = w.fighters[0];
  storm.x = 10; target.x = 12.41; activateSkill(w, storm); stepSkills(w); assert.equal(target.vx, 0);
  target.x = 11; target.invulnerable = 1; activateSkill(w, storm); stepSkills(w); assert.equal(target.vx, 0);
  target.invulnerable = 0; target.x = 12; w.level.rows[8] = '.'.repeat(11) + '#' + '.'.repeat(20);
  activateSkill(w, storm); stepSkills(w); assert.equal(target.vx, 0);
  w.level.rows[8] = '.'.repeat(32); storm.x = 31.5; target.x = .5;
  activateSkill(w, storm); stepSkills(w); assert.equal(target.vx, 12, 'push toward nearest wrap side');
});
test('cooldown rejects early retrigger, reopens at deadline; round reset clears ability and cooldown', () => {
  const w = arena(), f = w.fighters[0]; const dash = { ...emptyIntent(), dash: true };
  moveFighter(w, f, dash); const original = f.skill;
  moveFighter(w, f, dash); assert.equal(f.skill, original); assert.equal(f.dashCooldown, WATER_COOLDOWN - DT);
  f.dashCooldown = DT * 2; moveFighter(w, f, dash); assert.equal(f.skill, original);
  moveFighter(w, f, dash); assert.notEqual(f.skill, original); assert.equal(f.dashCooldown, WATER_COOLDOWN);
  resetRound(w); assert.equal(f.skill, undefined); assert.equal(f.dashCooldown, 0);
});
test('authoritative JSON/snapshot carries detached ability state and timers; old worlds without state still step', () => {
  const w = arena(); activateSkill(w, w.fighters[0]); activateSkill(w, w.fighters[1]);
  const serialized = JSON.parse(JSON.stringify({ type: 'state', world: w, events: w.events }));
  assert.deepEqual(serialized.world.fighters[0].skill, w.fighters[0].skill);
  assert.equal(serialized.world.fighters[1].dashCooldown, STORM_COOLDOWN);
  const s = snapshot(w); w.fighters[0].skill!.charges = 0; assert.equal(s.fighters[0].skill?.charges, 1);
  w.fighters.forEach(f => { delete f.skill; }); assert.doesNotThrow(() => step(w));
});
test('death clears ward immediately; client cannot inject ability kind, radius, charges or cooldown', () => {
  const w = arena(), f = w.fighters[0]; activateSkill(w, f);
  kill(w, f, 1); assert.equal(f.skill, undefined);
  const command = parseIntent({ ...emptyIntent(), dash: true, skill: { kind: 'storm-gust', charges: 99 }, dashCooldown: 0, radius: 100 });
  assert.deepEqual(command, { ...emptyIntent(), dash: true });
});
test('Storm bot uses close-range pulse, Mizu keeps defensive dodge; shot prediction cannot mutate live skill', () => {
  const w = arena(), [target, bot] = w.fighters; bot.human = false;
  Object.assign(bot.brain, { ready: true, target: 0, reaction: 1, shootTimer: 1, navigation: 1, planTime: 1 });
  const i = { ...think(w, bot) }; assert.equal(i.dash, true); assert.equal(i.moveX, 1, 'hard bot retains tactical peel');
  moveFighter(w, bot, i); assert.equal(bot.skill?.kind, 'storm-gust');
  bot.character = 0; bot.dashCooldown = 0; assert.equal(think(w, bot).dash, false, 'no generic offensive pulse for Mizu');
  activateSkill(w, target); const time = target.skill!.time; predictShot(w, bot, target); assert.equal(target.skill!.time, time);
});
