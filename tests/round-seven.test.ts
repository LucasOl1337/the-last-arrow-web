import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/sim/world.ts';
import { stepArrows, updateBow } from '../src/sim/arrows.ts';
import { think } from '../src/sim/bot.ts';
import { checkStomps } from '../src/sim/rules.ts';
import { solid } from '../src/sim/level.ts';
import { emptyIntent } from '../src/sim/input.ts';

// Exact counterexamples found by inspecting the real rules; no generated input sweep.
test('a bolt expiring inside the Totem column leaves recoverable ammo on its entry face', () => {
  const w = createWorld({ humans: 1, bots: 3, map: 'totem' });
  // The map redesign opened row 7; the surviving Totem pillar is on row 8.
  // Assert the precondition so map changes cannot silently turn this into a free-space case.
  assert.equal(solid(w.level, 10.4, 8.5), true, 'fixture must start inside the current Totem pillar');
  w.arrows = [{ id: 42, owner: 0, x: 10.4, y: 8.5, vx: 23, vy: 0, angle: 0, age: 7, stuck: false, kind: 'bolt' }];
  stepArrows(w);
  const a = w.arrows[0];
  assert.equal(a.stuck, true);
  assert.equal(solid(w.level, a.x, a.y), false, 'expired bolt must not be buried in a solid column');
  Object.assign(w.fighters[0], { x: 9.68, y: 8.5, ammo: 2, inventory: ['normal', 'normal'] });
  stepArrows(w);
  assert.equal(w.arrows.length, 0); assert.deepEqual(w.fighters[0].inventory, ['normal', 'normal', 'bolt']);
});

test('a bolt expiring in the opened Totem lane stays put and needs the real pickup range', () => {
  const w = createWorld({ humans: 2, bots: 0, map: 'totem' });
  assert.equal(solid(w.level, 10.4, 7.5), false);
  w.arrows = [{ id: 42, owner: 0, x: 10.4, y: 7.5, vx: 23, vy: 0, angle: 0, age: 7, stuck: false, kind: 'bolt' }];
  stepArrows(w);
  const a = w.arrows[0];
  assert.equal(a.stuck, true); assert.ok(Math.abs(a.x - (10.4 + 23 / 120)) < 1e-12);
  assert.equal(solid(w.level, a.x, a.y), false);
  Object.assign(w.fighters[0], { x: 9.68, y: 7.5, ammo: 2, inventory: ['normal', 'normal'] });
  stepArrows(w); assert.equal(w.arrows.length, 1, '0.912 tile is outside the unchanged 0.9 pickup range');
  w.fighters[0].x = 9.7;
  stepArrows(w); assert.equal(w.arrows.length, 0);
  assert.deepEqual(w.fighters[0].inventory, ['normal', 'normal', 'bolt']);
  stepArrows(w); assert.equal(w.fighters[0].ammo, 3, 'pickup cannot duplicate ammo');
});

test('a tracked bolt expires at its open entry face while a normal arrow stops at the Totem pillar', () => {
  const w = createWorld({ humans: 2, bots: 0, map: 'totem' });
  assert.equal(solid(w.level, 9.9, 8.5), false); assert.equal(solid(w.level, 10.1, 8.5), true);
  const bolt = { id: 42, owner: 0, x: 9.9, y: 8.5, vx: 23, vy: 0, angle: 0, age: 6.98, stuck: false, kind: 'bolt' as const };
  const normal = { ...bolt, id: 43, kind: 'normal' as const };
  w.arrows = [bolt, normal];
  stepArrows(w);
  assert.ok(bolt.x > 10 && !bolt.stuck, 'only bolt pierces the pillar');
  assert.equal(normal.stuck, true); assert.ok(normal.x < 10);
  assert.equal(solid(w.level, normal.x, normal.y), false);
  stepArrows(w); stepArrows(w);
  assert.equal(bolt.stuck, true); assert.ok(bolt.x < 10, 'expiry returns to the recorded entry face, not through the pillar');
  assert.equal(solid(w.level, bolt.x, bolt.y), false);
  Object.assign(w.fighters[0], { x: 9.68, y: 8.5, ammo: 0, inventory: [] });
  stepArrows(w); assert.equal(w.arrows.length, 0);
  assert.equal(w.fighters[0].ammo, 2);
  assert.deepEqual([...w.fighters[0].inventory!].sort(), ['bolt', 'normal']);
  stepArrows(w); assert.equal(w.fighters[0].ammo, 2);
});

test('a hard bot cancels a pending bomb release beside the Totem column instead of suicide', () => {
  const w = createWorld({ humans: 1, bots: 3, map: 'totem', difficulty: 'hard' });
  w.phase = 'playing';
  const f = w.fighters[1], target = w.fighters[0];
  Object.assign(f, { x: 9.5, y: 7.5, invulnerable: 0, grounded: false, ammo: 1, inventory: ['bomb'], charging: true, aimX: 1, aimY: 0 });
  Object.assign(target, { x: 13, y: 7.5, invulnerable: 0 });
  w.fighters[2].alive = w.fighters[3].alive = false;
  Object.assign(f.brain, { ready: true, target: 0, hold: 0, shootTimer: 1, reaction: .08 });
  const intent = think(w, f); updateBow(w, f, intent);
  assert.equal(f.charging, false); assert.equal(w.arrows.length, 0); assert.equal(f.ammo, 1);
});

test('a stomp across the vertical wrap carries its cause for the result statistics', () => {
  const w = createWorld({ humans: 2, bots: 0 });
  const [a, b] = w.fighters;
  Object.assign(a, { x: 16, y: 17.8, prevX: 16, prevY: 17.7, vy: 8, invulnerable: 0 });
  Object.assign(b, { x: 16, y: .85, prevX: 16, prevY: .85, invulnerable: 0 });
  checkStomps(w);
  assert.equal(b.alive, false); assert.equal(a.vy, -10);
  assert.equal(w.events.find(e => e.type === 'kill')?.cause, 'stomp');
});
