import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cameraFrame } from '../src/render/camera-frame.ts';
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
