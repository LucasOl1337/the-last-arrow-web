import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GamepadInput, padAxis } from '../src/input/gamepad.ts';
import type { PadSnapshot } from '../src/input/gamepad.ts';
import { createWorld, step } from '../src/sim/world.ts';
import { emptyIntent } from '../src/sim/input.ts';
function pad(index = 0, buttons: number[] = [], axes = [0, 0], id = `simulated-${index}`): PadSnapshot {
  return { index, id, mapping: 'standard', connected: true, axes, buttons: Array.from({ length: 17 }, (_, n) => ({ pressed: buttons.includes(n), value: Number(buttons.includes(n)) })) };
}
function armed(...pads: PadSnapshot[]) { const g = new GamepadInput(); g.poll(pads, 0); return g; }
test('SIMULATED standard snapshots: TowerFall A jump, X/B shoot, all shoulders dodge; RT never shoots', () => {
  const g = armed(pad());
  assert.deepEqual(g.poll([pad(0, [0, 2, 7])], 10), ['confirm']);
  assert.equal(g.frames[0].jump, true); assert.equal(g.frames[0].shoot, true); assert.equal(g.frames[0].dash, true);
  g.consumeEdges(); g.poll([pad(0, [0, 2, 7])], 20);
  assert.equal(g.frames[0].jump, false); assert.equal(g.frames[0].shoot, false); assert.equal(g.frames[0].shootHeld, true);
  g.poll([pad()], 30); assert.equal(g.frames[0].shootHeld, false);
  g.poll([pad(0, [7])], 40); assert.equal(g.frames[0].shoot, false); assert.equal(g.frames[0].dash, true);
  g.consumeEdges(); g.poll([pad()], 50); g.poll([pad(0, [1])], 60); assert.equal(g.frames[0].shoot, true);
});
test('SIMULATED deadzone, analogue strength and D-pad override', () => {
  assert.equal(padAxis(0.25), 0); assert.equal(padAxis(NaN), 0); assert.equal(padAxis(Infinity), 0);
  assert.equal(padAxis(0.625), 0.5); assert.equal(padAxis(-1), -1);
  const g = armed(pad()); g.poll([pad(0, [], [0.625, -1])], 10);
  assert.equal(g.frames[0].moveX, 0.5); assert.equal(g.frames[0].moveY, -1);
  assert.ok(Math.abs(g.frames[0].aimX! - Math.SQRT1_2) < 1e-9); assert.ok(Math.abs(g.frames[0].aimY! + Math.SQRT1_2) < 1e-9);
  g.poll([pad(0, [14, 13], [1, -1])], 20); assert.equal(g.frames[0].moveX, -1); assert.equal(g.frames[0].moveY, 1); assert.equal(g.frames[0].crouch, true);
});
test('SIMULATED sparse physical indices map once, retain P2 on disconnect and cancel drawn shot', () => {
  const g = armed(pad(3), pad(6));
  assert.deepEqual(g.slots, [3, 6, null, null]);
  g.poll([pad(3, [2]), pad(6, [0])], 10); assert.equal(g.frames[0].shootHeld, true); assert.equal(g.frames[1].jump, true);
  g.consumeEdges(); g.poll([null, pad(6, [0])], 20);
  assert.deepEqual(g.slots, [null, 6, null, null]); assert.equal(g.frames[0].cancelShot, true); assert.equal(g.frames[0].shootHeld, false); assert.equal(g.frames[1].jump, false);
  g.poll([pad(8, [2]), pad(6)], 30); assert.deepEqual(g.slots, [8, 6, null, null]); assert.equal(g.frames[0].shootHeld, false);
  g.consumeEdges(); g.poll([pad(8), pad(6)], 40); g.poll([pad(8, [2]), pad(6)], 50); assert.equal(g.frames[0].shoot, true);
});
test('SIMULATED blur/reset requires neutral stick and buttons, including held Start', () => {
  const g = armed(pad()); g.poll([pad(0, [2])], 1); g.consumeEdges();
  assert.deepEqual(g.poll([pad(0, [2, 9], [1, 0])], 2, false), []); assert.equal(g.frames[0].cancelShot, true);
  g.poll([pad(0, [2, 9], [1, 0])], 3); assert.equal(g.frames[0].shootHeld, false); assert.equal(g.frames[0].moveX, 0);
  g.poll([pad()], 4); assert.deepEqual(g.poll([pad(0, [9])], 5), ['pause']);
  g.reset(); assert.deepEqual(g.poll([pad(0, [9])], 6), []);
  g.poll([pad()], 7); assert.deepEqual(g.poll([pad(0, [9])], 8), ['pause']);
});
test('SIMULATED menu edges, direction repeat and deduplication across two pads', () => {
  const g = armed(pad(0), pad(1));
  assert.deepEqual(g.poll([pad(0, [0, 13]), pad(1, [0])], 1), ['confirm', 'down']);
  assert.deepEqual(g.poll([pad(0, [0, 13]), pad(1, [0])], 2), []);
  assert.deepEqual(g.poll([pad(0, [13]), pad(1)], 351), ['down']);
  assert.deepEqual(g.poll([pad(0, [8]), pad(1)], 400), ['back']);
});
test('SIMULATED unknown mappings are not guessed from manufacturer id', () => {
  const g = new GamepadInput(); const p = { ...pad(0, [0]), id: 'DualSense Xbox', mapping: '' };
  assert.deepEqual(g.poll([p], 0), []); assert.equal(g.unsupported, 1); assert.deepEqual(g.slots, [null, null, null, null]);
});
test('SIMULATED disconnect cancellation reaches the unchanged sim without firing or spending an arrow', () => {
  const g = armed(pad()); const w = createWorld({ humans: 1, bots: 1, seed: 1 });
  w.phase = 'playing'; const f = w.fighters[0]; f.charging = true; f.charge = 0.5; const count = f.ammo;
  g.poll([], 10); step(w, g.frames);
  assert.equal(f.charging, false); assert.equal(f.ammo, count); assert.equal(w.arrows.length, 0);
});
test('SIMULATED local P2 input never aliases outgoing online P1 intent', () => {
  const g = armed(pad(4), pad(7)); g.poll([pad(4), pad(7, [2], [1, 0])], 10);
  const outgoing = JSON.parse(JSON.stringify(g.frames[0]));
  assert.equal(outgoing.moveX, 0); assert.equal(outgoing.shoot, false);
  assert.equal(g.frames[1].moveX, 1); assert.equal(g.frames[1].shoot, true);
  assert.deepEqual({ ...emptyIntent(), ...outgoing }, g.frames[0]);
});
