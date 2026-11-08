import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, DT } from '../src/sim/world.ts';
import { emptyIntent } from '../src/sim/input.ts';
import { updateBow, stepArrows } from '../src/sim/arrows.ts';

// Regression guard from the rejected launch-transition candidate (recado48): on the Totem floor a
// full-draw horizontal shot must kill a same-level target 1.5 tiles away, with one arrow and one
// ammo spent. Any launch/muzzle change that lifts the flight over the hitbox at short range fails here.
for (const character of [0, 1]) test(`short same-level shot: 1.5 tiles, full draw, horizontal kills the target (${character ? 'Storm' : 'Mizu'})`, () => {
  const w = createWorld({ map: 'totem', humans: 2, bots: 0 }); w.phase = 'playing';
  const [shooter, target] = w.fighters;
  Object.assign(shooter, { x: 8, y: 15.45, character, aimX: 1, aimY: 0, facing: 1, charging: true, charge: .35, ammo: 3, inventory: ['normal', 'normal', 'normal'], shotCooldown: 0, invulnerable: 0, grounded: true, crouching: false });
  Object.assign(target, { x: 9.5, y: 15.45, invulnerable: 0, grounded: true, crouching: false });
  updateBow(w, shooter, emptyIntent());
  assert.equal(w.arrows.length, 1, 'one arrow released');
  assert.equal(shooter.ammo, 2, 'one ammo spent');
  assert.equal(w.events.filter(e => e.type === 'shoot' && e.actor === shooter.id).length, 1);
  const arrow = w.arrows[0].id;
  // Launch window of the existing owner immunity (.18 s) is ample: the usual line reaches it in ~.05 s.
  for (let tick = 0; tick < .18 / DT && target.alive; tick++) stepArrows(w);
  assert.equal(target.alive, false, 'same-level target 1.5 tiles away must die');
  assert.ok(w.events.some(e => e.type === 'kill' && e.target === target.id && e.actor === shooter.id && e.cause === 'arrow'));
  assert.equal(w.arrows.some(a => a.id === arrow), false, 'the normal arrow is consumed by the hit');
  assert.equal(shooter.ammo, 2, 'hit does not refund or spend more ammo');
});
