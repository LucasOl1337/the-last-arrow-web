import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { disposeSkeletons, disposeInstances } from '../src/render/disposal.ts';

test('body/outline share one disposed bone texture; ghost owns another; template survives', () => {
  const root = new THREE.Group(), geometry = new THREE.BoxGeometry(), material = new THREE.MeshBasicMaterial();
  const skeleton = new THREE.Skeleton([new THREE.Bone()]), ghostSkeleton = new THREE.Skeleton([new THREE.Bone()]);
  skeleton.computeBoneTexture(); ghostSkeleton.computeBoneTexture();
  let textures = 0, geometries = 0;
  skeleton.boneTexture!.addEventListener('dispose', () => textures++);
  ghostSkeleton.boneTexture!.addEventListener('dispose', () => textures++);
  geometry.addEventListener('dispose', () => geometries++);
  for (const own of [skeleton, skeleton, ghostSkeleton]) {
    const mesh = new THREE.SkinnedMesh(geometry, material); mesh.bind(own); root.add(mesh);
  }
  disposeSkeletons(root);
  assert.equal(textures, 2); assert.equal(geometries, 0);
  assert.equal(skeleton.boneTexture, null); assert.equal(ghostSkeleton.boneTexture, null);
});

test('terrain instance buffers receive their own dispose event', () => {
  const group = new THREE.Group();
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 2);
  let disposed = 0; mesh.addEventListener('dispose', () => disposed++); group.add(mesh);
  disposeInstances(group); assert.equal(disposed, 1);
});
