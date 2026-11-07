import * as THREE from 'three';

/** Exact, visually verified component1: evidence/bow-sockets/storm-upper-component.json.
 * No body-bound heuristic, pivot or vertex-position edit. Hash covers source GLB bytes. */
export const STORM_ORNAMENT = {
  sha256: 'e80a656100b91cfc024b9bf62c136b12cdfe06b6fb77af5bf06c7bac434b1f4f',
  mesh: 'tripo_node_c3539ae2-3081-4955-a42b-33878f231512',
  vertexCount: 19451, triangleCount: 28963,
  vertexRanges: [[18815, 18892], [18986, 19342]],
  triangleRanges: [[28074, 28170], [28320, 28828]],
} as const;
const owned = new WeakSet<THREE.BufferGeometry>();
const inRanges = (n: number, ranges: readonly (readonly [number, number])[]) => ranges.some(([a,b]) => n >= a && n <= b);

/** Only called on a fresh SkeletonUtils clone in bind/rest pose, before animation.
 * Inverse binds already put both bones in the same mesh rest space; rebinding
 * weights therefore needs no invented offset or position/normal compensation. */
export function bindStormOrnament(model: THREE.Object3D, sourceSha256?: string): boolean {
  if (sourceSha256 !== STORM_ORNAMENT.sha256) return false;
  const meshes: THREE.SkinnedMesh[] = [];
  model.traverse(o => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(o as THREE.SkinnedMesh); });
  if (meshes.length !== 1) return false;
  const mesh = meshes[0], g = mesh.geometry, p = g.getAttribute('position'), j = g.getAttribute('skinIndex'), w = g.getAttribute('skinWeight'), index = g.index;
  if (mesh.name !== STORM_ORNAMENT.mesh || p.count !== STORM_ORNAMENT.vertexCount || index?.count !== STORM_ORNAMENT.triangleCount * 3 || !j || !w) return false;
  const old = mesh.skeleton.bones.findIndex(b => b.name === 'mixamorigLeftHandMiddle3');
  const hand = mesh.skeleton.bones.findIndex(b => b.name === 'mixamorigLeftHand');
  if (old < 0 || hand < 0) return false;
  // Verify every selected triangle, and that no outside triangle shares a vertex.
  for (let t = 0; t < index.count / 3; t++) {
    const selected = inRanges(t, STORM_ORNAMENT.triangleRanges);
    for (let k = 0; k < 3; k++) if (inRanges(index.getX(t*3+k), STORM_ORNAMENT.vertexRanges) !== selected) return false;
  }
  model.updateMatrixWorld(true);
  const skinMatrix = (bone: number) => new THREE.Matrix4().copy(mesh.bindMatrixInverse)
    .multiply(mesh.skeleton.bones[bone].matrixWorld).multiply(mesh.skeleton.boneInverses[bone]).multiply(mesh.bindMatrix);
  const before = skinMatrix(old), after = skinMatrix(hand);
  for (const [a,b] of STORM_ORNAMENT.vertexRanges) for (let v = a; v <= b; v++) {
    if (j.getX(v) !== old || w.getX(v) !== 1 || w.getY(v) !== 0 || w.getZ(v) !== 0 || w.getW(v) !== 0) return false;
    const position = new THREE.Vector3().fromBufferAttribute(p,v);
    if (position.clone().applyMatrix4(before).distanceTo(position.applyMatrix4(after)) > 2e-7) return false;
  }
  const copy = g.clone(); // All attributes owned by this instance, never by the kit/opponent.
  const joints = copy.getAttribute('skinIndex'), weights = copy.getAttribute('skinWeight');
  for (const [a,b] of STORM_ORNAMENT.vertexRanges) for (let v = a; v <= b; v++) {
    joints.setXYZW(v, hand, 0, 0, 0); weights.setXYZW(v, 1, 0, 0, 0);
  }
  mesh.geometry = copy; owned.add(copy);
  return true;
}

/** Outlines share the instance geometry; dispose once, never the kit geometry. */
export function disposeStormOrnament(root: THREE.Object3D) {
  root.traverse(o => {
    const geometry = (o as THREE.Mesh).geometry;
    if (geometry && owned.delete(geometry)) geometry.dispose();
  });
}
