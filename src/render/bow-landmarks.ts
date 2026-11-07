import * as THREE from 'three';

/** Verified on actual GLB surfaces, NOT validated functional string sockets.
 * Vertex/triangle IDs are tied to these asset hashes. No body-bounds inference.
 * Mizu is a stowed back bow; Storm's upper ornament is a disconnected fragment.
 * This module is for the inspector/tests only, not imported by gameplay.
 */
export const BOW_LANDMARKS = {
  mizu: {
    sha256: '50ea717daab340296cd5d8afb9f411aac21b6f92f36487538019187c0ad5daea',
    status: 'stowed-back-bow-not-a-handheld-weapon',
    points: [
      { name: 'upper-back-bow-end', vertex: 18219, triangle: 27690 },
      { name: 'lower-back-bow-end', vertex: 1563, triangle: 2607 },
      { name: 'bow-quiver-crossing-surface', vertex: 8991, triangle: 13602 },
      { name: 'upper-authored-string-surface', vertex: 16821, triangle: 25391 },
    ],
  },
  storm: {
    sha256: 'e80a656100b91cfc024b9bf62c136b12cdfe06b6fb77af5bf06c7bac434b1f4f',
    status: 'disconnected-upper-ornament-and-fused-lower-grip-no-complete-bow',
    points: [
      { name: 'upper-ornament-horn', vertex: 18817, triangle: 28085 },
      { name: 'upper-ornament-bottom', vertex: 19287, triangle: 28739 },
      { name: 'lower-grip-end', vertex: 19351, triangle: 28834 },
      { name: 'lower-grip-surface', vertex: 19362, triangle: 28848 },
    ],
  },
} as const;

/** Same skin transform as Three's mesh shader. updateWorldMatrix alone is NOT
 * enough: SkinnedMesh updates attached bindMatrixInverse in updateMatrixWorld.
 */
export function skinnedLandmark(mesh: THREE.SkinnedMesh, vertex: number, target = new THREE.Vector3()) {
  let root: THREE.Object3D = mesh;
  while (root.parent) root = root.parent;
  root.updateMatrixWorld(true);
  mesh.skeleton.update();
  return mesh.localToWorld(mesh.getVertexPosition(vertex, target));
}
