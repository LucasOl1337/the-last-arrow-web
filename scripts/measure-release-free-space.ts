import { rigRuntime } from '../tests/helpers/arco-rig-runtime.ts';
import { updateBow } from '../src/sim/arrows.ts';
import { emptyIntent } from '../src/sim/input.ts';
import { bowSocket } from '../src/sim/bow-socket.ts';
import { solid, delta, WIDTH, HEIGHT } from '../src/sim/level.ts';
import { bodyHalfHeight } from '../src/sim/body.ts';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

/** Fixed free-space companion of measure-release-continuity for Mizu's inverted diagonal. In the
 * original measurement Mizu stands under the Totem platform and her held tip lies inside a solid
 * tile, so that state is not free space. Here Mizu stands at an open spot of the same map, Storm is
 * parked out of the way, and the corridor centre -> socket muzzle -> actual held tip is checked for
 * tiles and bodies before measuring the same real tip -> real projectile tip distance. */
export const FREE_SPACE = { map: 'totem', mizu: { x: 19, y: 15.45 }, storm: { x: 26, y: 15.45 } } as const;
const SAMPLE = .03;

export async function measureReleaseFreeSpace() {
  const { THREE, world, fighters, arrows, scene, frames } = await rigRuntime();
  world.options.seed = 42; world.options.difficulty = 'easy'; world.arrows = []; world.events = [];
  const q = Math.SQRT1_2, [mizu, storm] = world.fighters;
  if (world.level.id !== FREE_SPACE.map || mizu.character !== 0 || storm.character !== 1) throw new Error('unexpected runtime roster/map');
  Object.assign(storm, { ...FREE_SPACE.storm, charging: false, charge: 0, aimX: 1, aimY: 0, facing: 1, crouching: false, grounded: true });
  Object.assign(mizu, { ...FREE_SPACE.mizu, charging: true, charge: .35, shotCooldown: 0, ammo: 3, inventory: ['normal', 'normal', 'normal'], aimX: -q, aimY: -q, facing: -1, crouching: false, grounded: true });
  frames(120); scene.updateMatrixWorld(true);
  const view = (fighters as any).views[0];
  const held = view.nock.localToWorld(new THREE.Vector3(.54, 0, 0)), socket = bowSocket(mizu, .35);
  // Precondition: corridor centre -> socket muzzle (origin) -> actual held tip (sim coordinates).
  const corridor = [[mizu.x, mizu.y], [socket.origin.x, socket.origin.y], [held.x, HEIGHT - held.y]];
  const tiles: number[][] = [], bodies: { id: number; at: number[] }[] = [];
  let samples = 0;
  for (let k = 0; k + 1 < corridor.length; k++) {
    const [ax, ay] = corridor[k], [bx, by] = corridor[k + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / SAMPLE));
    for (let i = 0; i <= n; i++) {
      const x = ax + (bx - ax) * i / n, y = ay + (by - ay) * i / n; samples++;
      if (solid(world.level, x, y)) tiles.push([x, y]);
      for (const o of world.fighters) if (o.id !== mizu.id && o.alive && Math.abs(delta(o.x, x, WIDTH)) <= .39 && Math.abs(delta(o.y, y, HEIGHT)) <= bodyHalfHeight(o) + .03) bodies.push({ id: o.id, at: [x, y] });
    }
  }
  updateBow(world, mizu, emptyIntent()); arrows.update(world, 0);
  const mesh = (arrows as any).mesh, g = mesh.geometry.getAttribute('position'); let tipX = -Infinity;
  for (let i = 0; i < g.count; i++) tipX = Math.max(tipX, g.getX(i));
  const a = world.arrows.find(x => x.owner === mizu.id)!, index = world.arrows.indexOf(a), m = new THREE.Matrix4(); mesh.getMatrixAt(index, m);
  const tip = new THREE.Vector3(tipX, 0, 0).applyMatrix4(m);
  return {
    state: 'inverted-free-space', character: mizu.character, position: [mizu.x, mizu.y],
    precondition: { corridor, samples, sampleStep: SAMPLE, tiles, bodies, free: tiles.length === 0 && bodies.length === 0 },
    heldTip: held.toArray(), projectileTip: tip.toArray(), physicsOrigin: [a.x, a.y], arrows: world.arrows.length, ammo: mizu.ammo,
    tipToTip: held.distanceTo(tip),
  };
}
// CLI: `node scripts/measure-release-free-space.ts [report.json] [--gate]`; --gate applies the literal
// .15 acceptance (same as the original release-continuity test) and exits 1 when it fails.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const row = await measureReleaseFreeSpace(), out = process.argv.slice(2).find(a => !a.startsWith('--'));
  if (out) await writeFile(out, JSON.stringify(row, null, 2) + '\n');
  console.log(JSON.stringify(row, null, 2));
  if (process.argv.includes('--gate') && !(row.precondition.free && row.tipToTip <= .15)) { console.error(`free-space gate FAIL: tipToTip ${row.tipToTip}`); process.exitCode = 1; }
}
