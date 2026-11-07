import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { measureRig } from '../scripts/measure-arco-rig.ts';
import { DT } from '../src/sim/world.ts';
import { HEIGHT } from '../src/sim/level.ts';
import { ARROW_GRAVITY } from '../src/sim/arrows.ts';

const close = (a: number, b: number, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('actual Mizu/Storm rig: idle, draw, 10s hold, diagonal, turn, crouch, jump, release and short tap', async () => {
  const r = await measureRig();
  if (process.env.ARCO_RIG_REPORT) await writeFile(process.env.ARCO_RIG_REPORT, JSON.stringify(r, null, 2) + '\n');
  // Exactly two authored assets and requested states, not generated input variations.
  assert.equal(r.idle.length, 2);
  for (const character of [0, 1]) {
    assert.equal(r.idle[character].visible, false);
    assert.equal(r.idle[character].state, 'idle');
    assert.equal(r.draw[character].visible, true);
    close(r.draw[character].animationTime, 1 / 60);
    for (const name of ['draw', 'heldStart', 'held10s', 'diagonal', 'diagonal10s', 'turnFirst', 'turned', 'crouch', 'jump'] as const) {
      const s = r[name][character];
      assert.equal(s.visible, true, name);
      assert.ok(s.handAxisError < 1e-8, `${name}: arrow must pass through actual animated hand, including depth`);
      close(s.depthError, 0);
      assert.ok(s.aimError < 1e-6, `${name}: arrow points along sim aim, not wrist roll`);
      for (const norm of s.quaternionNorms) close(norm, 1, 1e-6);
      for (const m of s.materials) { assert.equal(m.geometryPreserved, true); assert.equal(m.mapPreserved, true); assert.equal(m.tint, 0); close(m.roughness, .78); }
    }
    close(r.held10s[character].animationTime, .18);
    for (const bone of [0, 1]) {
      close(r.heldStart[character].pitch[bone], r.held10s[character].pitch[bone]);
      close(r.diagonal[character].pitch[bone], r.diagonal10s[character].pitch[bone]);
    }
    close(r.crouch[character].pivotScale[1], .58);
    assert.equal(r.jump[character].legs.jump.scheduled, true);
    assert.equal(r.jump[character].legs.idle.scheduled, false);
    assert.equal(r.jump[character].state, 'shoot');
    // The decorative arrow is gone in the FIRST release frame, not a frame late.
    assert.equal(r.release[character].visible, false);
    close(r.release[character].animationTime, .18 + 2 / 60);
    assert.equal(r.afterRelease[character].state, 'idle');
    assert.equal(r.afterRelease[character].visible, false);
    // Same clip point even when no charging frame was rendered before the sim event.
    close(r.tapRelease[character].animationTime, r.release[character].animationTime);
    assert.equal(r.tapRelease[character].visible, false);
    const a = r.spawned[character], next = r.projectileNextStep[character];
    close(a.x, r.expectedSpawn[character][0]); close(a.y, r.expectedSpawn[character][1]);
    close(r.renderedProjectiles[character].origin[0], a.x, 2e-6);
    close(r.renderedProjectiles[character].origin[1], HEIGHT - a.y, 2e-6);
    close(r.renderedProjectiles[character].origin[2], .8, 1e-6);
    assert.equal(next.stuck, false);
    close(next.x, a.x + a.vx * DT);
    close(next.y, a.y + (a.vy + ARROW_GRAVITY * DT) * DT);
    // Do not hide the known taller-mesh vs hitbox gap by moving the sim projectile.
    assert.ok(r.beforeRelease[character].tipToSimSpawn > 1);
  }
});
