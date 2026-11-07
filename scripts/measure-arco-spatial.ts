import { rigRuntime } from '../tests/helpers/arco-rig-runtime.ts';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { HEIGHT } from '../src/sim/level.ts';
import { bodyHalfHeight } from '../src/sim/body.ts';
import { spatialProbe } from '../src/render/arco-spatial-probe.ts';

/** One concrete case: actual published inverted diagonal, no parameter search. */
export async function measureSpatial() {
  const { THREE, kits, world, fighters, arrows, frames } = await rigRuntime();
  const projectileGeometry = (arrows as any).mesh.geometry;
  projectileGeometry.computeBoundingBox();
  const projectileTipX = projectileGeometry.boundingBox.max.x;
  const views = (fighters as any).views;
  frames(30);
  world.fighters.forEach(f => Object.assign(f, { charging: true, charge: 0 })); frames(1);
  world.fighters.forEach(f => Object.assign(f, { charge: .35 })); frames(720);
  world.fighters.forEach(f => Object.assign(f, { aimX: Math.SQRT1_2, aimY: -Math.SQRT1_2 })); frames(720);
  world.fighters.forEach(f => Object.assign(f, { aimX: -Math.SQRT1_2, facing: -1 })); frames(120);
  world.fighters.forEach(f => Object.assign(f, { crouching: true })); frames(1);
  world.fighters.forEach(f => Object.assign(f, { crouching: false, grounded: false, vy: -5 })); frames(1);
  world.fighters.forEach(f => Object.assign(f, { grounded: true, vy: 0, vx: 0 })); frames(120);
  const result = views.map((v: any, i: number) => {
    v.root.updateWorldMatrix(true, true);
    const f = world.fighters[i], kit = i ? kits.storm! : kits.mizu!;
    const vector = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
    const pos = (name: string) => v.rig.model.getObjectByName(`mixamorig${name}`).getWorldPosition(vector());
    const direction = vector(f.aimX, -f.aimY, 0);
    const center = vector(f.x, HEIGHT - f.y, .8);
    const spawn = center.clone().addScaledVector(direction, .22);
    const hand = pos('LeftHand'), arm = pos('LeftArm'), elbow = pos('LeftForeArm');
    const tip = v.nock.localToWorld(vector(.54));
    const tail = v.nock.localToWorld(vector(-.19));
    // Existing geometry + existing pull: tip = hand + (.54 - .14) * direction.
    const tipFromHand = tip.clone().sub(hand);
    const targetHand = spawn.clone().sub(tipFromHand);
    const visibleProjectileTip = spawn.clone().addScaledVector(direction, projectileTipX);
    const upperLength = elbow.distanceTo(arm), foreLength = hand.distanceTo(elbow);
    const shoulderToTarget = targetHand.distanceTo(arm);
    const displacement = targetHand.clone().sub(hand);
    const normal = vector(-direction.y, direction.x, 0);
    // Conservative world-space upper bound under anisotropic model scale: even
    // optimal local rotations cannot exceed the largest linear scale per segment.
    const localTransforms = () => JSON.stringify([v.root, v.pivot, v.rig.model, v.nock, ...v.rig.bones].map(o => [o.position.toArray(), o.quaternion.toArray(), o.scale.toArray()]));
    const beforeProbe = localTransforms();
    const probe = spatialProbe(v.rig.model, v.nock, v.root, f.aimX, f.aimY, spawn);
    const probePreservesPose = beforeProbe === localTransforms();
    const conservativeArmReach = probe.armReachBound;
    const bones = Object.fromEntries(['Hips','Spine','Spine1','Spine2','LeftShoulder','LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand','Head','LeftFoot','RightFoot'].map(name => [name, pos(name).toArray()]));
    const authoredHand = v.rig.model.worldToLocal(hand.clone());
    // Reconstruct exactly: model local hand -> model scale/floor offset -> yaw -> root.
    const modelLocalToPivot = authoredHand.clone().applyMatrix4(v.rig.model.matrix);
    const pivotLocalToRoot = modelLocalToPivot.clone().applyMatrix4(v.pivot.matrix);
    const composedHand = pivotLocalToRoot.clone().applyMatrix4(v.root.matrix);
    return {
      character: i ? 'storm' : 'mizu', probe, probePreservesPose, fighter: { x: f.x, y: f.y, halfHeight: bodyHalfHeight(f), aim: [f.aimX, f.aimY] },
      asset: { height: kit.height, floor: kit.floor, visualHeight: 2.4, modelScale: v.rig.model.scale.toArray(), modelOffset: v.rig.model.position.toArray() },
      composition: { root: v.root.position.toArray(), pivotScale: v.pivot.scale.toArray(), yaw: v.yaw, pitch: v.aim,
        authoredHand: authoredHand.toArray(), scaledHand: modelLocalToPivot.toArray(), yawedHand: pivotLocalToRoot.toArray(),
        hand: hand.toArray(), reconstructedError: composedHand.distanceTo(hand), bones },
      geometry: { tail: tail.toArray(), tip: tip.toArray(), length: tip.distanceTo(tail), tipFromHand: tipFromHand.toArray(),
        simulatedSpawn: spawn.toArray(), currentGap: tip.distanceTo(spawn), vectorTipMinusSpawn: tip.clone().sub(spawn).toArray(),
        projectileLocalTip: projectileTipX, visibleProjectileTip: visibleProjectileTip.toArray(),
        actualTipToTipGap: tip.distanceTo(visibleProjectileTip) },
      required: { hand: targetHand.toArray(), displacement: displacement.toArray(), distance: displacement.length(),
        alongArrow: displacement.dot(direction), perpendicularInArena: displacement.dot(normal), depth: displacement.z,
        arrowOnlySlideResidual: Math.hypot(displacement.dot(normal), displacement.z),
        globalBodyShiftInVisualHeights: displacement.length() / 2.4 },
      reach: { upperLength, foreLength, reach: upperLength + foreLength, conservativeArmReach, shoulderToTarget,
        minErrorFixedShoulder: Math.max(0, shoulderToTarget - conservativeArmReach),
        targetHeightAboveFeet: targetHand.y - v.root.position.y, shoulderHeightAboveFeet: arm.y - v.root.position.y },
    };
  });
  return { base: 'f9ee69067200d4da830eb70654235e161f89a5b3', publicRuntime: 'a64719071f9258f1dcac9ded9bd60999f23ad26a',
    case: 'published diagonal inverted before release; exact neighbor sequence from measure-arco-rig.ts',
    units: 'tiles and radians; actual GLB bones, no raster or visual approval', characters: result };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await measureSpatial();
  if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
