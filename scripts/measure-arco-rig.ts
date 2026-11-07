import { rigRuntime } from '../tests/helpers/arco-rig-runtime.ts';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { updateBow, stepArrows } from '../src/sim/arrows.ts';
import { HEIGHT } from '../src/sim/level.ts';

/** Exact requested sequence, real GLBs/mixer/simulation; no rendered-image claim. */
export async function measureRig() {
  const { THREE, kits, world, fighters, arrows, frames } = await rigRuntime();
  const internals = fighters as any;
  const sample = () => internals.views.map((v: any) => {
    v.root.updateWorldMatrix(true, true);
    const hand = v.rig.bowHand.getWorldPosition(new THREE.Vector3());
    const tail = v.nock.localToWorld(new THREE.Vector3(-.19, 0, 0));
    const tip = v.nock.localToWorld(new THREE.Vector3(.54, 0, 0));
    const direction = tip.clone().sub(tail).normalize();
    const axisError = hand.clone().sub(tail).cross(direction).length();
    const f = world.fighters[v.character];
    return {
      character: v.character, state: v.state, animationTime: v.rig.actions[v.state].time,
      visible: v.nock.visible, hand: hand.toArray(), anchor: v.nock.position.toArray(),
      tail: tail.toArray(), tip: tip.toArray(), handAxisError: axisError,
      depthError: Math.abs(hand.z - v.nock.position.z),
      aimError: direction.angleTo(new THREE.Vector3(f.aimX, -f.aimY, 0)),
      pitch: [v.rig.spine1, v.rig.spine2].map((b: any) => b.quaternion.angleTo(v.rig.pitchBase.get(b))),
      quaternionNorms: v.rig.bones.map((b: any) => b.quaternion.length()),
      pivotScale: v.pivot.scale.toArray(),
      legs: Object.fromEntries(Object.entries(v.rig.aimLegs).map(([n, a]: [string, any]) => [n, { scheduled: a.isScheduled(), weight: a.getEffectiveWeight() }])),
      materials: (() => {
        const original: any[] = [], current: any[] = [];
        const kit = v.character === 0 ? kits.mizu! : kits.storm!;
        kit.template.traverse((o: any) => { if (o.isMesh) original.push(o); });
        v.rig.model.traverse((o: any) => { if (o.isMesh && o.material.userData.uniforms) current.push(o); });
        return current.map((o, i) => ({ geometryPreserved: ['position', 'normal', 'uv'].every(name => {
          const a = o.geometry.getAttribute(name), b = original[i].geometry.getAttribute(name);
          return a.count === b.count && Array.from({ length: a.count }, (_, v) => v).every(v => Array.from({ length: a.itemSize }, (_, k) => k).every(k => a.getComponent(v, k) === b.getComponent(v, k)));
        }) && o.geometry.index.array.every((n: number, j: number) => n === original[i].geometry.index.array[j]),
          mapPreserved: o.material.map === original[i].material.map,
          tint: o.material.userData.uniforms.uTintAmount.value, roughness: o.material.roughness }));
      })(),
      // A probe, NOT a zero target: visual body is taller than the simulation hitbox.
      tipToSimSpawn: tip.distanceTo(new THREE.Vector3(f.x + f.aimX * .22, HEIGHT - (f.y + f.aimY * .22), .8)),
    };
  });
  frames(30); const idle = sample();
  world.fighters.forEach(f => Object.assign(f, { charging: true, charge: 0 }));
  frames(1); const draw = sample();
  world.fighters.forEach(f => Object.assign(f, { charge: .35 }));
  frames(120); const heldStart = sample();
  frames(600); const held10s = sample();
  world.fighters.forEach(f => Object.assign(f, { aimX: Math.SQRT1_2, aimY: -Math.SQRT1_2 }));
  frames(120); const diagonal = sample();
  frames(600); const diagonal10s = sample();
  world.fighters.forEach(f => Object.assign(f, { aimX: -Math.SQRT1_2, facing: -1 }));
  frames(1); const turnFirst = sample();
  frames(119); const turned = sample();
  world.fighters.forEach(f => Object.assign(f, { crouching: true })); frames(1); const crouch = sample();
  world.fighters.forEach(f => Object.assign(f, { crouching: false, grounded: false, vy: -5 })); frames(1); const jump = sample();
  world.fighters.forEach(f => Object.assign(f, { grounded: true, vy: 0, vx: 0 })); frames(120);
  const beforeRelease = sample();
  const expectedSpawn = world.fighters.map(f => [f.x + f.aimX * .22, f.y + f.aimY * .22]);
  world.fighters.forEach(f => updateBow(world, f, { shootHeld: false } as any));
  const spawned = world.arrows.map(a => ({ ...a }));
  world.events.filter(e => e.type === 'shoot').forEach(e => fighters.event(e.type, e.actor!));
  frames(1); arrows.update(world, 20); const release = sample();
  const mesh = (arrows as any).mesh;
  const renderedProjectiles = world.arrows.map((a, i) => {
    const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix);
    const p = mesh.geometry.getAttribute('position'); let tipX = -Infinity;
    for (let n = 0; n < p.count; n++) tipX = Math.max(tipX, p.getX(n));
    return { id: a.id, origin: new THREE.Vector3().setFromMatrixPosition(matrix).toArray(),
      tip: new THREE.Vector3(tipX, 0, 0).applyMatrix4(matrix).toArray() };
  });
  stepArrows(world); const projectileNextStep = world.arrows.map(a => ({ ...a }));
  frames(30); const afterRelease = sample();
  // Concrete short-tap bug: shoot event arrives before a single charging render.
  world.fighters.forEach(f => { Object.assign(f, { charging: false, shotCooldown: 0 }); updateBow(world, f, { shoot: true, shootHeld: false } as any); fighters.event('shoot', f.id); });
  frames(1); const tapRelease = sample();
  return { kind: 'CPU transforms / actual assets, not visual approval', idle, draw, heldStart, held10s,
    diagonal, diagonal10s, turnFirst, turned, crouch, jump, beforeRelease, release,
    expectedSpawn, spawned, renderedProjectiles, projectileNextStep, afterRelease, tapRelease };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await measureRig();
  const output = process.argv[2];
  if (output) await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(Object.fromEntries(['held10s', 'diagonal', 'turnFirst', 'release', 'tapRelease'].map(k => [k, (report as any)[k].map((v: any) => ({ character: v.character, handAxisError: v.handAxisError, depthError: v.depthError, animationTime: v.animationTime, tipToSimSpawn: v.tipToSimSpawn }))])), null, 2));
}
