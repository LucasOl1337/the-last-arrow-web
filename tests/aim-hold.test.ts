import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, DT } from '../src/sim/world.ts';
import { emptyIntent } from '../src/sim/input.ts';
import { moveFighter } from '../src/sim/physics.ts';
import { updateBow } from '../src/sim/arrows.ts';

function fixture() {
  const w = createWorld({ humans: 2, bots: 0 });
  w.phase = 'playing';
  w.level = { ...w.level, rows: Array.from({ length: 18 }, (_, y) => y === 17 ? '#'.repeat(32) : '.'.repeat(32)) };
  const f = w.fighters[0];
  Object.assign(f, { x: 10, y: 16.45, prevX: 10, prevY: 16.45, grounded: true, invulnerable: 0 });
  return { w, f };
}
test('long pointer hold has bounded draw state; release emits one shot and clears draw', () => {
  const { w, f } = fixture();
  const hold = { ...emptyIntent(), aimX: .6, aimY: -.8, shootHeld: true };
  for (let tick = 0; tick < 1200; tick++) { moveFighter(w, f, hold); updateBow(w, f, hold); }
  assert.equal(f.charging, true);
  assert.ok(f.charge <= .35, `fully drawn bow must saturate, got ${f.charge}`);
  assert.equal(w.arrows.length, 0); assert.equal(f.ammo, 3);
  const release = { ...hold, shootHeld: false };
  moveFighter(w, f, release); updateBow(w, f, release);
  assert.equal(f.charging, false); assert.equal(f.charge, 0);
  assert.equal(w.arrows.length, 1); assert.equal(f.ammo, 2);
  assert.equal(w.arrows[0].vx, 23 * .6); assert.equal(w.arrows[0].vy, 23 * -.8);
  updateBow(w, f, release); assert.equal(w.arrows.length, 1);
});
test('holding pointer aim does not change strafe, crouch feet, or jump physics', () => {
  const { w, f } = fixture(); const control = fixture();
  const tick = (input: ReturnType<typeof emptyIntent>) => {
    const aiming = { ...input, shootHeld: true, aimX: .6, aimY: -.8 };
    moveFighter(w, f, aiming); updateBow(w, f, aiming);
    moveFighter(control.w, control.f, input);
    for (const key of ['x', 'y', 'vx', 'vy', 'grounded', 'crouching'] as const) assert.equal(f[key], control.f[key], key);
    assert.equal(f.aimX, .6); assert.equal(f.aimY, -.8);
  };
  for (let n = 0; n < 24; n++) tick({ ...emptyIntent(), moveX: -1 });
  assert.ok(f.vx < 0);
  tick({ ...emptyIntent(), crouch: true }); assert.equal(f.crouching, true);
  tick({ ...emptyIntent(), jump: true, jumpHeld: true });
  assert.equal(f.crouching, false); assert.ok(f.vy < 0);
  for (let n = 0; n < 12; n++) tick({ ...emptyIntent(), jumpHeld: true, moveX: 1 });
  tick(emptyIntent()); assert.ok(f.vy >= -6, 'short jump still cuts on release');
});
test('cancelled hold clears state without an arrow and permits a fresh draw', () => {
  const { w, f } = fixture();
  updateBow(w, f, { ...emptyIntent(), shootHeld: true });
  updateBow(w, f, { ...emptyIntent(), cancelShot: true, shootHeld: true });
  assert.equal(f.charging, false); assert.equal(f.charge, 0); assert.equal(f.ammo, 3); assert.equal(w.arrows.length, 0);
  updateBow(w, f, { ...emptyIntent(), shootHeld: true });
  assert.equal(f.charging, true); assert.equal(f.charge, DT);
});
