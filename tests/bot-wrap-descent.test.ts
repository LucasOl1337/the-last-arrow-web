import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, DT } from '../src/sim/world.ts';
import { moveFighter } from '../src/sim/physics.ts';
import { think } from '../src/sim/bot.ts';
import { platformAt, nextPlatform, HEIGHT } from '../src/sim/level.ts';

// Concrete stalled route from seed 7, round 10: lower Musgo ledge -> crown -> idle human.
test('bot exits the bottom Musgo ledge to fall through wrap instead of jumping toward the crown', () => {
  const w = createWorld({ humans: 1, bots: 3, seed: 7 }); w.phase = 'playing';
  const f = w.fighters[1], target = w.fighters[0];
  Object.assign(f, { x: 6.5, y: 15.45, grounded: true, invulnerable: 0 });
  Object.assign(target, { x: 25.218359979354233, y: 7.45, invulnerable: 0 });
  w.fighters[2].alive = w.fighters[3].alive = false;
  Object.assign(f.brain, { ready: true, target: 0, reaction: 1, shootTimer: -5, travelled: 80, navigation: 0, planTime: 1, patrol: 0 });
  const from = platformAt(w.level, f.x, f.y), to = platformAt(w.level, target.x, target.y);
  const next = nextPlatform(w.level, from.id, to.id);
  assert.equal(from.y, 16); assert.equal(next.y, 3); assert.ok(from.links.includes(next.id));
  const i = think(w, f);
  assert.equal(i.jump, false, 'a graph edge falling across wrap must not become a 13-tile upward jump');
  assert.equal(f.brain.waypointY, next.y + HEIGHT - .55);
  assert.ok(f.brain.waypointX < from.left || f.brain.waypointX > from.right, 'first leave the supporting ledge');
  assert.equal(i.moveX, Math.sign(f.brain.waypointX - f.x), 'walk toward the chosen nearest edge, not the crown center');
  let crossed = false;
  for (let tick = 0; tick < 4 / DT && !crossed; tick++) {
    const previousY = f.y;
    moveFighter(w, f, think(w, f));
    crossed = previousY > HEIGHT - 1 && f.y < 1;
  }
  assert.equal(crossed, true, 'the chosen exit must physically reach the vertical seam');
});
