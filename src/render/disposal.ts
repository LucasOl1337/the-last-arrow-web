import * as THREE from 'three';
import { disposeStormOrnament } from './storm-ornament.ts';

/** Each cloned rig owns its skeletons; outlines may share one with the body.
 * Geometry and textures belong to the kit, except the guarded Storm skin clone. */
export function disposeSkeletons(root: THREE.Object3D) {
  disposeStormOrnament(root);
  const skeletons = new Set<THREE.Skeleton>();
  root.traverse(object => {
    const mesh = object as THREE.SkinnedMesh;
    if (mesh.isSkinnedMesh) skeletons.add(mesh.skeleton);
  });
  for (const skeleton of skeletons) skeleton.dispose();
}

/** Instance matrix/color buffers are owned by the mesh, not its geometry. */
export function disposeInstances(root: THREE.Object3D) {
  root.traverse(object => {
    const mesh = object as THREE.InstancedMesh;
    if (mesh.isInstancedMesh) mesh.dispose();
  });
}
