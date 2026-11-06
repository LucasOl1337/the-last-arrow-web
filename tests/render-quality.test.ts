import test from 'node:test';
import assert from 'node:assert/strict';
import { AutoQuality, lowPixelRatio } from '../src/render/quality.ts';

test('4K HiDPI low quality caps the raster at 1280x720 instead of keeping a 4032x2268 buffer', () => {
  const ratio = lowPixelRatio(2, 3840, 2160);
  assert.equal(3840 * ratio, 1280); assert.equal(2160 * ratio, 720);
  assert.equal(lowPixelRatio(1, 1600, 900), .7);
});

test('40 FPS for two real seconds reduces quality exactly once and keeps it on rematch', () => {
  const q = new AutoQuality(); q.begin(); q.sample(0, true);
  for (let n = 1; n < 80; n++) assert.equal(q.sample(n * 25, true), false);
  assert.equal(q.sample(2000, true), true); assert.ok(Math.abs(q.detectedFps! - 40) < 1e-9);
  assert.equal(q.sample(2025, true), false); q.begin(); assert.equal(q.level, 'low');
});
test('normal 60 FPS and the exact 50 FPS threshold keep full quality', () => {
  const normal = new AutoQuality(); normal.sample(0, true);
  for (let n = 1; n <= 120; n++) normal.sample(n * 1000 / 60, true);
  assert.equal(normal.level, 'normal'); assert.ok(normal.inspect().decided);
  const boundary = new AutoQuality(); boundary.sample(0, true);
  for (let n = 1; n <= 100; n++) boundary.sample(n * 20, true);
  assert.equal(boundary.level, 'normal'); assert.ok(Math.abs(boundary.detectedFps! - 50) < 1e-9);
});
test('hidden/paused/testing time is excluded, but a visible long frame is not capped at 50 ms', () => {
  const q = new AutoQuality(); q.sample(0, true); q.sample(1000, false); q.sample(10000, true);
  assert.equal(q.inspect().sampleSeconds, 0);
  assert.equal(q.sample(12000, true), true); assert.equal(q.detectedFps, .5);
});
