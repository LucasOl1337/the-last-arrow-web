import * as THREE from 'three';

/** Each cloned rig owns its skeletons; outlines may share one with the body.
 * Geometry and albedo textures belong to the cached GLB template, not the clone. */
export function disposeSkeletons(root: THREE.Object3D) {
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
