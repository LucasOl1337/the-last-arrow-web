import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cameraFrame, followCamera, backgroundMotion } from '../src/render/camera-frame.ts';
test('close framing makes fighters 28% larger; wide preserves the arena', () => {
  const wide = cameraFrame(16/9, false), near = cameraFrame(16/9, true, {x: 16,y: 9});
  assert.ok(Math.abs(wide.height / near.height - 1.28) < 1e-9);
  assert.ok(wide.width >= 32 && wide.height >= 18);
});
test('wrap targets clamp at the physical arena edges', () => {
  const left = cameraFrame(16/9, true, {x: 0,y: 0});
  const right = cameraFrame(16/9, true, {x: 32,y: 18});
  assert.equal(left.x - left.width/2, 0); assert.equal(left.y - left.height/2, 0);
  assert.equal(right.x + right.width/2, 32); assert.equal(right.y + right.height/2, 18);
});
test('vertical wrap snaps even though clamped camera displacement is under five tiles', () => {
  const before = followCamera(undefined, 16/9, true, { x: 16, y: 17.9 }, 1/60);
  const after = followCamera(before, 16/9, true, { x: 16, y: .1 }, 1/60);
  assert.ok(Math.abs(before.y - after.y) < 5);
  assert.equal(after.y, cameraFrame(16/9, true, { x: 16, y: .1 }).y);
});
test('ordinary follow eases; viewport, death and respawn reframe atomically', () => {
  const start = followCamera(undefined, 16/9, true, { x: 16, y: 9 }, 1/60);
  const moving = followCamera(start, 16/9, true, { x: 18, y: 9 }, 1/60);
  assert.ok(moving.x > 16 && moving.x < 18);
  const portrait = followCamera(moving, .9, true, { x: 18, y: 9 }, 1/60);
  assert.equal(portrait.x, cameraFrame(.9, true, {x:18,y:9}).x);
  assert.equal(portrait.y, 9);
  const dead = followCamera(moving, 16/9, true, undefined, 1/60);
  assert.equal(dead.x, 16);
  const respawn = followCamera(dead, 16/9, true, { x: 2, y: 2 }, 1/60);
  assert.equal(respawn.x, cameraFrame(16/9, true, { x: 2, y: 2 }).x);
  assert.ok(Number.isFinite(cameraFrame(0, true).height));
});
test('background drift is continuous, bounded and uses no shake state', () => {
  const a = backgroundMotion(.14, 18, 10, 2), b = backgroundMotion(.14, 18, 10, 2+1/60);
  assert.ok(Math.abs(a.x-b.x)<.001 && Math.abs(a.y-b.y)<.001);
  const edge = backgroundMotion(.14, 32, 18, 100);
  assert.ok(Math.abs(edge.x)<=.65 && Math.abs(edge.y)<=.28);
});
