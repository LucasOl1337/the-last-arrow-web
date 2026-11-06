import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { rootSpeed, runTimeScale, clipWindow } from '../src/render/animation.ts';

test('cadence uses each authored stride and actual horizontal model scale, with no low-speed floor', () => {
  // Concrete Mizu and Kaze asset measurements, not generated input variations.
  const mizu = new THREE.AnimationClip('run', 1.25, [new THREE.VectorKeyframeTrack('mixamorigHips.position', [0, 1.25], [0, 0, 0, 2.4413088, 0, 0])]);
  const kaze = new THREE.AnimationClip('run', 1.25, [new THREE.VectorKeyframeTrack('mixamorigHips.position', [0, 1.25], [0, 0, 0, 3.2384678, 0, 0])]);
  assert.ok(rootSpeed(kaze) > rootSpeed(mizu));
  const speed = rootSpeed(mizu), scale = 2.4 / .98 * 1.18;
  assert.ok(Math.abs(runTimeScale(7.8, speed, scale) * speed * scale - 7.8) < 1e-8);
  assert.equal(runTimeScale(0, speed, scale), 0);
  assert.ok(runTimeScale(.7, speed, scale) < .15);
  assert.equal(runTimeScale(-3.9, speed, scale), runTimeScale(7.8, speed, scale) / 2);
});

test('airborne clip windows have exact interpolated boundaries and independent mixer actions', () => {
  const clip = new THREE.AnimationClip('jump', 1, [new THREE.VectorKeyframeTrack('Hips.position', [0, .5, 1], [0, 0, 0, 0, 1, 0, 0, 0, 0])]);
  const jump = clipWindow(clip, 'jump-up', .12, .3), fall = clipWindow(clip, 'fall-down', .3, .38);
  assert.equal(jump.duration, .18); assert.equal(fall.name, 'fall-down');
  assert.ok(Math.abs(jump.tracks[0].values[1] - .24) < 1e-6);
  assert.ok(Math.abs(fall.tracks[0].values[1] - .6) < 1e-6);
  const mixer = new THREE.AnimationMixer(new THREE.Group());
  assert.notEqual(mixer.clipAction(jump), mixer.clipAction(fall));
  assert.deepEqual(Array.from(clip.tracks[0].times), [0, .5, 1]);
});
