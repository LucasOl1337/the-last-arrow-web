import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, resetRound, step, snapshot, DT, COUNTDOWN_SECONDS } from '../src/sim/world.ts';
import type { Arrow, World } from '../src/sim/world.ts';
import { emptyIntent } from '../src/sim/input.ts';
import { moveFighter } from '../src/sim/physics.ts';
import { stepArrows, updateBow, BOMB_RADIUS } from '../src/sim/arrows.ts';
import { giveArrows, MAX_AMMO } from '../src/sim/inventory.ts';
import { stepChests, CHEST_INTERVAL } from '../src/sim/treasure.ts';
import { kill, stepRules } from '../src/sim/rules.ts';
import { think } from '../src/sim/bot.ts';
import { delta, solid, WIDTH, HEIGHT } from '../src/sim/level.ts';

function arena(): World {
  const w = createWorld({ humans: 2, bots: 2, seed: 3 });
  w.phase = 'playing'; w.countdown = 0;
  w.level = { ...w.level, rows: Array(HEIGHT).fill('.'.repeat(WIDTH)) };
  for (const f of w.fighters) Object.assign(f, { x: 3 + f.id * 5, y: 8, invulnerable: 0 });
  return w;
}
function arrow(changes: Partial<Arrow> = {}): Arrow {
  return { id: 99, owner: 0, x: 7.5, y: 8, vx: 23, vy: 0, angle: 0, age: 0.5, stuck: false, kind: 'normal', ...changes };
}

test('countdown exposes 3–2–1 for 1.2 s and freezes all input/physics at every spawn', () => {
  const w = createWorld({ humans: 2, bots: 0 });
  const initial = snapshot(w).fighters;
  const input = { ...emptyIntent(), moveX: 1, jump: true, jumpHeld: true, shoot: true, shootHeld: true, dash: true };
  assert.equal(w.countdown, 3);
  for (let n = 1; n <= Math.round(COUNTDOWN_SECONDS / DT); n++) {
    step(w, [input, input]);
    assert.equal(w.countdown, n < 48 ? 3 : n < 96 ? 2 : n < 144 ? 1 : 0);
    assert.deepEqual(snapshot(w).fighters, initial);
    assert.equal(w.events.length, 0);
    assert.equal(w.roundTime, 0);
    assert.equal(w.arrows.length, 0);
  }
  assert.equal(w.phase, 'playing');
  assert.ok(w.fighters.every(f => f.invulnerable === 1));
  step(w, [emptyIntent(), emptyIntent()]);
  assert.equal(w.arrows.length, 0, 'countdown shoot must not leak into play');
  assert.ok(w.fighters.every(f => f.invulnerable < 1));
  resetRound(w);
  assert.equal(w.phase, 'countdown'); assert.equal(w.countdown, 3);
  assert.ok(w.fighters.every(f => f.invulnerable === 1 && !f.charging));
  assert.deepEqual(w.chests, []); assert.equal(w.chestTimer, CHEST_INTERVAL);
});

test('spawn protection lasts one active second, cannot be shortened by dash, and is not a catch', () => {
  const w = arena(), victim = w.fighters[1]; victim.invulnerable = 1;
  w.arrows.push(arrow({ x: victim.x - 0.4 })); stepArrows(w);
  assert.equal(victim.alive, true); assert.equal(victim.ammo, 3);
  assert.ok(!w.events.some(e => e.type === 'catch'));
  moveFighter(w, victim, { ...emptyIntent(), dash: true });
  assert.ok(victim.invulnerable > 0.98);
  for (let n = 1; n < 119; n++) moveFighter(w, victim, emptyIntent());
  kill(w, victim, 0); assert.equal(victim.alive, true);
  for (let n = 0; n < 2; n++) moveFighter(w, victim, emptyIntent());
  kill(w, victim, 0); assert.equal(victim.alive, false);
});

test('FIFO quiver shoots, catches, drops and recovers arrow kinds without losing the ammo mirror', () => {
  const w = arena(), shooter = w.fighters[0], victim = w.fighters[1];
  shooter.ammo = 0; giveArrows(shooter, ['bomb', 'bolt', 'normal']);
  updateBow(w, shooter, { ...emptyIntent(), shoot: true });
  assert.equal(w.arrows[0].kind, 'bomb'); assert.equal(shooter.ammo, 2);
  assert.deepEqual(shooter.inventory, ['bolt', 'normal']);
  w.arrows.length = 0;
  victim.ammo = 0; giveArrows(victim, ['normal']);
  victim.dashTime = victim.invulnerable = 0.1;
  w.arrows.push(arrow({ kind: 'bolt', x: victim.x - 0.4 })); stepArrows(w);
  assert.equal(w.arrows.length, 0); assert.deepEqual(victim.inventory, ['normal', 'bolt']);
  victim.invulnerable = 0; kill(w, victim, 0);
  assert.deepEqual(w.arrows.map(a => a.kind), ['normal', 'bolt']);
  assert.deepEqual(victim.inventory, []); assert.equal(victim.ammo, 0);
  Object.assign(shooter, { x: victim.x, y: victim.y }); stepArrows(w);
  assert.equal(shooter.ammo, 4); assert.equal(shooter.inventory!.filter(k => k === 'bolt').length, 2);
  giveArrows(shooter, ['normal', 'normal', 'bomb']);
  assert.equal(shooter.ammo, MAX_AMMO); assert.equal(shooter.inventory!.at(-1), 'bomb');
  w.events.length = 0; shooter.dashTime = shooter.invulnerable = 0.1;
  w.arrows.push(arrow({ owner: 2, x: shooter.x - 0.4, kind: 'bolt' })); stepArrows(w);
  assert.equal(shooter.ammo, MAX_AMMO); assert.equal(w.arrows.length, 0);
  assert.ok(w.events.some(e => e.type === 'catch' && e.kind === 'bolt'));
});

test('legacy fighters/arrows without optional fields still fire and pick up normal arrows', () => {
  const w = arena(), f = w.fighters[0]; delete f.inventory;
  updateBow(w, f, { ...emptyIntent(), shoot: true });
  assert.equal(w.arrows[0].kind, 'normal'); assert.equal(f.ammo, 2);
  w.arrows = [arrow({ x: f.x, y: f.y, stuck: true, kind: undefined })];
  stepArrows(w); assert.equal(f.ammo, 3); assert.deepEqual(f.inventory, ['normal', 'normal', 'normal']);
});

test('bolt crosses a solid wall and multiple targets with almost no gravity, then expires', () => {
  const w = arena();
  const rows = [...w.level.rows]; rows[8] = '.......#........................'; w.level = { ...w.level, rows };
  Object.assign(w.fighters[1], { x: 8.5, y: 8.5 });
  Object.assign(w.fighters[2], { x: 10, y: 8.5 });
  w.fighters[3].invulnerable = 1; Object.assign(w.fighters[3], { x: 11.5, y: 8.5 });
  const bolt = arrow({ kind: 'bolt', x: 6.8, y: 8.5 }); w.arrows.push(bolt);
  for (let n = 0; n < 30; n++) stepArrows(w);
  assert.equal(w.fighters[1].alive, false); assert.equal(w.fighters[2].alive, false);
  assert.equal(w.fighters[3].alive, true); assert.equal(bolt.stuck, false);
  assert.ok(Math.abs(bolt.y - 8.5) < 0.01); assert.deepEqual(bolt.hitTargets, [1, 2, 3]);
  assert.equal(w.events.filter(e => e.type === 'kill').length, 2);
  bolt.age = 7; stepArrows(w); assert.equal(bolt.stuck, true);
});

test('bomb explodes once at a wall with radius 1.6, wraps damage and respects protection', () => {
  const w = arena();
  const rows = [...w.level.rows]; rows[8] = '#...............................'; w.level = { ...w.level, rows };
  Object.assign(w.fighters[0], { x: 31, y: 8.4 }); // Owner is not immune to their bomb.
  Object.assign(w.fighters[1], { x: 1, y: 8.4 });
  Object.assign(w.fighters[2], { x: 1, y: 8.4, invulnerable: 0.1 });
  Object.assign(w.fighters[3], { x: 2, y: 8.4 });
  w.arrows.push(arrow({ kind: 'bomb', x: 31.95, y: 8.4 })); stepArrows(w);
  assert.equal(w.fighters[0].alive, false); assert.equal(w.fighters[1].alive, false);
  assert.equal(w.fighters[2].alive, true); assert.equal(w.fighters[3].alive, true);
  const explosion = w.events.find(e => e.type === 'explosion');
  assert.ok(explosion); assert.equal(explosion.radius, BOMB_RADIUS); assert.equal(explosion.actor, 0);
  assert.ok(!w.arrows.some(a => a.id === 99));
  stepArrows(w); assert.equal(w.events.filter(e => e.type === 'explosion').length, 1);
});

test('bomb detonates on a target but a timed catch disarms it', () => {
  const w = arena(); w.arrows.push(arrow({ kind: 'bomb', x: w.fighters[1].x - 0.4 }));
  stepArrows(w); assert.equal(w.fighters[1].alive, false);
  assert.equal(w.events.filter(e => e.type === 'explosion').length, 1);
  const caught = arena(), f = caught.fighters[1]; f.dashTime = f.invulnerable = 0.1;
  caught.arrows.push(arrow({ kind: 'bomb', x: f.x - 0.4 })); stepArrows(caught);
  assert.equal(f.alive, true); assert.equal(f.inventory!.at(-1), 'bomb');
  assert.ok(!caught.events.some(e => e.type === 'explosion'));
});

test('chests spawn at 12 active seconds on free supported tiles, open once and preserve rewards in snapshots', () => {
  const w = createWorld({ humans: 2, bots: 0, seed: 3 });
  stepChests(w); assert.equal(w.chestTimer, 12);
  w.phase = 'playing';
  for (let n = 0; n < CHEST_INTERVAL / DT - 1; n++) stepChests(w);
  assert.equal(w.chests!.length, 0);
  stepChests(w); assert.equal(w.chests!.length, 1);
  const c = w.chests![0];
  assert.equal(solid(w.level, c.x, c.y), false); assert.equal(solid(w.level, c.x, c.y + 1), true);
  assert.ok(w.fighters.every(f => Math.hypot(delta(f.x, c.x, WIDTH), delta(f.y, c.y, HEIGHT)) >= 1.5));
  const saved = snapshot(w); saved.chests[0].reward.push('bomb');
  assert.notDeepEqual(saved.chests[0].reward, c.reward);
  const f = w.fighters[0]; f.ammo = 0; f.x = c.x; f.y = c.y;
  stepChests(w); assert.equal(w.chests!.length, 0); assert.deepEqual(f.inventory, c.reward);
  stepChests(w); assert.equal(w.events.filter(e => e.type === 'chest-open').length, 1);
  assert.equal(w.events.find(e => e.type === 'chest-open')!.chestId, c.id);
});

test('a chest with ordinary ammo gives two arrows and clamps at six', () => {
  const w = arena(), f = w.fighters[0];
  w.chests = [{ id: 1, x: f.x, y: f.y, reward: ['normal', 'normal'] }];
  stepChests(w); assert.equal(f.ammo, 5);
  w.chests.push({ id: 2, x: f.x, y: f.y, reward: ['normal', 'normal'] });
  stepChests(w); assert.equal(f.ammo, 6); assert.equal(f.inventory!.length, 6);
});

test('hard bot predicts an incoming arrow and catches it instead of overwriting dash direction to aim', () => {
  const w = arena(); w.options.difficulty = 'hard';
  const f = w.fighters[1]; f.human = false;
  Object.assign(f, { x: 12, y: 8, vx: 0, vy: 0, charging: true });
  f.brain.hold = 0.1;
  w.arrows.push(arrow({ x: 9, y: 8 }));
  const i = { ...think(w, f) }; assert.equal(i.dash, true); assert.equal(i.moveX, -1);
  moveFighter(w, f, i); stepArrows(w);
  for (let n = 0; n < 10 && w.arrows.length; n++) { moveFighter(w, f, emptyIntent()); stepArrows(w); }
  assert.equal(f.alive, true); assert.equal(f.ammo, 4);
  assert.ok(w.events.some(e => e.type === 'catch' && e.actor === f.id));
});

test('normal bot repositions before its opening shot and prefers a nearby chest over the enemy', () => {
  const w = createWorld({ humans: 0, bots: 4, difficulty: 'normal', seed: 3 });
  while (w.phase === 'countdown' || w.roundTime < 2.5) {
    step(w); assert.ok(!w.events.some(e => e.type === 'shoot'));
  }
  const f = w.fighters[0];
  // The chest fixture requires a living bot; changed routes can kill slot0 during the opening.
  Object.assign(f, { x: 6.5, y: 4.45, grounded: true, alive: true });
  w.chests = [{ id: 1, x: 7.5, y: 4.5, reward: ['bolt'] }];
  f.brain.navigation = 0;
  const i = think(w, f);
  assert.equal(f.brain.waypointX, 7.5); assert.equal(i.moveX, 1);
  assert.equal(i.jump, false, 'do not hop over a chest on the current platform');
});

test('bot wall-jumps and approaches a chest across the horizontal wrap', () => {
  const w = createWorld({ humans: 0, bots: 4 }); w.phase = 'playing';
  const f = w.fighters[0];
  Object.assign(f, { x: 0.1, y: 9.45, grounded: false, coyote: 0, wall: -1 });
  w.chests = [{ id: 1, x: 31.5, y: 9.5, reward: ['bomb'] }];
  const i = think(w, f); assert.equal(i.moveX, -1); assert.equal(i.jump, true);
  moveFighter(w, f, i); assert.ok(f.vx > 0 && f.vy < -15);
});

test('round reset discards treasure and special ammo but preserves score and chest identity sequence', () => {
  const w = arena(); w.fighters[0].score = 2;
  giveArrows(w.fighters[0], ['bolt']);
  w.chests = [{ id: 9, x: 5, y: 4, reward: ['bomb'] }]; w.nextChestId = 10;
  w.phase = 'roundover'; w.phaseTime = 0; stepRules(w);
  assert.equal(w.fighters[0].score, 2); assert.equal(w.nextChestId, 10);
  assert.deepEqual(w.chests, []); assert.equal(w.chestTimer, CHEST_INTERVAL);
  assert.ok(w.fighters.every(f => f.ammo === 3 && f.inventory!.every(k => k === 'normal')));
});
