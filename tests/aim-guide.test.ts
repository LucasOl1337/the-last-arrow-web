import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aimGuide } from '../src/render/aim-guide.ts';
import { createWorld, DT } from '../src/sim/world.ts';
import { stepArrows, ARROW_SPEED, ARROW_GRAVITY } from '../src/sim/arrows.ts';

test('aim preview ends on the actual simulated flight, independent of charge', () => {
  const w = createWorld({ humans: 2, bots: 0, seed: 3 });
  w.level.rows = Array(18).fill('.'.repeat(32)); w.fighters.forEach(f => f.alive = false);
  const guide = aimGuide(w.level, 8, 8, 1, 0);
  w.arrows.push({ id: 1, owner: 0, x: 8.22, y: 8, vx: ARROW_SPEED, vy: 0, angle: 0, stuck: false, age: 0 });
  for (let i = 0; i < 14; i++) stepArrows(w);
  assert.ok(Math.abs(w.arrows[0].x - guide.end.x) < 1e-8);
  assert.ok(Math.abs(w.arrows[0].y - guide.end.y) < 1e-8);
  assert.equal(guide.points.length, 5);
  assert.ok(guide.end.y > 8 + .5 * ARROW_GRAVITY * (14 * DT) ** 2);
});
test('normal preview stops before walls; bolt preview passes and world seams stop both', () => {
  const w = createWorld({ humans: 2, bots: 0, seed: 3 }); w.level.rows = Array(18).fill('.'.repeat(32));
  w.level.rows = w.level.rows.map((row, y) => y === 8 ? row.slice(0, 10) + '#' + row.slice(11) : row);
  const normal = aimGuide(w.level, 8, 8, 1, 0), bolt = aimGuide(w.level, 8, 8, 1, 0, true);
  assert.equal(normal.blocked, true); assert.ok(normal.end.x < 10);
  assert.ok(bolt.end.x > 10); assert.equal(bolt.blocked, false);
  const seam = aimGuide(w.level, 31, 4, 1, 0, true);
  assert.equal(seam.blocked, true); assert.ok(seam.end.x < 32);
});
