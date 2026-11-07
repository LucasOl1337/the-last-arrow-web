import * as THREE from 'three';

/** Diagnostic only. Does not move a bone, arrow, mesh, collider or camera. */
export function spatialProbe(model: THREE.Object3D, nock: THREE.Object3D, root: THREE.Object3D, aimX: number, aimY: number, spawn: THREE.Vector3) {
  root.updateWorldMatrix(true, true);
  const bone = (name: string) => {
    const node = model.getObjectByName(`mixamorig${name}`);
    if (!node) throw new Error(`Spatial probe requires actual bone ${name}`);
    return node;
  };
  const pos = (name: string) => bone(name).getWorldPosition(new THREE.Vector3());
  const hand = pos('LeftHand'), shoulder = pos('LeftArm'), clavicle = pos('LeftShoulder'), elbow = pos('LeftForeArm');
  const tip = nock.localToWorld(new THREE.Vector3(.54, 0, 0));
  const tail = nock.localToWorld(new THREE.Vector3(-.19, 0, 0));
  const direction = new THREE.Vector3(aimX, -aimY, 0).normalize();
  const tipFromHand = tip.clone().sub(hand);
  const target = spawn.clone().sub(tipFromHand);
  const displacement = target.clone().sub(hand);
  const normal = new THREE.Vector3(-direction.y, direction.x, 0);
  // Product of local max scales bounds the operator norm, even through rotated
  // nonuniform scales/shear. getWorldScale() columns are NOT that upper bound.
  const scaleBound = (node: THREE.Object3D) => {
    let bound = 1;
    for (let parent: THREE.Object3D | null = node; parent; parent = parent.parent) {
      bound *= Math.max(Math.abs(parent.scale.x), Math.abs(parent.scale.y), Math.abs(parent.scale.z));
    }
    return bound * 1.000001; // conservative tolerance for authored float quaternions
  };
  const segmentBound = (child: THREE.Object3D) => child.position.length() * scaleBound(child.parent!);
  const armReachBound = segmentBound(bone('LeftForeArm')) + segmentBound(bone('LeftHand'));
  const withClavicleBound = armReachBound + segmentBound(bone('LeftArm'));
  return {
    feet: root.getWorldPosition(new THREE.Vector3()).toArray(), hand: hand.toArray(), shoulder: shoulder.toArray(), clavicle: clavicle.toArray(),
    elbow: elbow.toArray(), tip: tip.toArray(), tail: tail.toArray(), spawn: spawn.toArray(), targetHand: target.toArray(),
    tipFromHand: tipFromHand.toArray(), arrowLength: tip.distanceTo(tail), gap: tip.distanceTo(spawn),
    gapVector: tip.clone().sub(spawn).toArray(), displacement: displacement.toArray(),
    alongArrow: displacement.dot(direction), perpendicularInArena: displacement.dot(normal),
    arrowOnlySlideResidual: Math.hypot(displacement.dot(normal), displacement.z),
    armLengths: [shoulder.distanceTo(elbow), elbow.distanceTo(hand)], armReachBound, withClavicleBound,
    shoulderToTarget: shoulder.distanceTo(target), clavicleToTarget: clavicle.distanceTo(target),
    minErrorFixedShoulder: Math.max(0, shoulder.distanceTo(target) - armReachBound),
    minErrorFixedClavicle: Math.max(0, clavicle.distanceTo(target) - withClavicleBound),
    targetAboveFeet: target.y - root.getWorldPosition(new THREE.Vector3()).y,
  };
}
