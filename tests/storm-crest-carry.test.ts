import test from 'node:test';
import assert from 'node:assert/strict';
import { rigRuntime } from './helpers/arco-rig-runtime.ts';
import { STORM_BOW } from '../src/render/equipped-bow.ts';

// Exact case from the iteration-2 render: Storm idle carry, the preserved dragon
// (vertex 18817, rigid on LeftHand) floated ahead of the tilted upper limb. The
// model's non-uniform scale shears the hand, so its world angle to the hand axis
// depends on the arm pose. Relaxed carry seats it on the authored limb; a
// nocked arrow keeps the bow exactly across the shot.
test('Storm crest sits on the upper limb in relaxed carry; hold stays across the aim', async () => {
  const { THREE, fighters, frames, world, scene } = await rigRuntime();
  const f = world.fighters[1], v = (fighters as any).views[1], bow = v.equippedBow, ik = v.rig.armIK;
  const limbEnd = STORM_BOW.limb[STORM_BOW.limb.length - 1];
  const limbAngle = (r: number) => {
    const limb = STORM_BOW.limb; let k = 1;
    while (k < limb.length - 1 && Math.hypot(...limb[k]) < r) k++;
    const [a, b] = [limb[k - 1], limb[k]], ra = Math.hypot(...a), rb = Math.hypot(...b), t = Math.min(1, Math.max(0, (r - ra) / (rb - ra)));
    return Math.atan2(a[1] + (b[1] - a[1]) * t, a[0] + (b[0] - a[0]) * t);
  };
  const crestInBow = () => { scene.updateMatrixWorld(true); return bow.root.worldToLocal(ik.ornamentTip(new THREE.Vector3())); };
  frames(60);
  assert.equal(f.charging, false); assert.equal(v.relax, 1);
  const idle = crestInBow(), r = Math.hypot(idle.x, idle.y);
  assert.ok(Math.abs(Math.atan2(idle.y, idle.x) - limbAngle(r)) < 1e-6, 'idle: crest on the limb at its own radius');
  assert.ok(r > Math.hypot(...limbEnd) * .9, 'crest reaches the limb end, not mid-air beside it');
  assert.ok(Math.abs(idle.z) < .06, 'crest stays at the bow plane depth');
  Object.assign(f, { charging: true, charge: .35, aimX: 1, aimY: 0, facing: 1 }); frames(120); scene.updateMatrixWorld(true);
  assert.equal(v.relax, 0);
  const upper = bow.upperTip.getWorldPosition(new THREE.Vector3()), lower = bow.lowerTip.getWorldPosition(new THREE.Vector3());
  assert.ok(Math.abs(upper.sub(lower).normalize().dot(new THREE.Vector3(1, 0, 0))) < 1e-8, 'nocked: bow exactly across the sim aim, no seat rotation');
});
