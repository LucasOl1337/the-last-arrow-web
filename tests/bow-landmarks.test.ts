import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { rigRuntime } from './helpers/arco-rig-runtime.ts';
import { BOW_LANDMARKS, skinnedLandmark } from '../src/render/bow-landmarks.ts';

test('verified bow landmarks keep exact asset/triangle/skin provenance and follow posed mesh without mutations', async () => {
  const { THREE, world, fighters, frames } = await rigRuntime();
  const views = (fighters as any).views;
  world.fighters.forEach(f => Object.assign(f, { charging: true, charge: .35 })); frames(120);
  for (const [i, name] of (['mizu', 'storm'] as const).entries()) {
    const definition = BOW_LANDMARKS[name];
    assert.equal(createHash('sha256').update(await readFile(`public/assets/models/${name}.glb`)).digest('hex'), definition.sha256);
    const v = views[i]; let mesh: any;
    v.rig.model.traverse((o: any) => { if (o.isSkinnedMesh && o.material.userData.uniforms) mesh = o; });
    const geometry = mesh.geometry, vertices = Array.from(geometry.getAttribute('position').array), indices = Array.from(geometry.index.array);
    const local = () => JSON.stringify(v.rig.bones.map((b: any) => [b.position.toArray(),b.quaternion.toArray(),b.scale.toArray()]));
    const before = local();
    for (const point of definition.points) {
      const triangle = [0,1,2].map(k => geometry.index.getX(point.triangle * 3 + k));
      assert.ok(triangle.includes(point.vertex), `${name}/${point.name}: exact triangle contains landmark`);
      const actual = skinnedLandmark(mesh, point.vertex);
      // Independently reproduce the skinning shader's weighted bind transform.
      const bind = new THREE.Vector3().fromBufferAttribute(geometry.getAttribute('position'),point.vertex).applyMatrix4(mesh.bindMatrix);
      const expected = new THREE.Vector3(), j = geometry.getAttribute('skinIndex'), w = geometry.getAttribute('skinWeight');
      let sum = 0;
      for (let k=0;k<4;k++) {
        const weight = w.getComponent(point.vertex,k); sum += weight;
        const bone = j.getComponent(point.vertex,k);
        const matrix = new THREE.Matrix4().multiplyMatrices(mesh.skeleton.bones[bone].matrixWorld,mesh.skeleton.boneInverses[bone]);
        expected.addScaledVector(bind.clone().applyMatrix4(matrix),weight);
      }
      expected.applyMatrix4(mesh.bindMatrixInverse).applyMatrix4(mesh.matrixWorld);
      assert.ok(actual.distanceTo(expected)<1e-8); assert.ok(Math.abs(sum-1)<1e-6);
    }
    assert.equal(local(),before); assert.equal(mesh.geometry,geometry);
    assert.deepEqual(Array.from(geometry.getAttribute('position').array),vertices);
    assert.deepEqual(Array.from(geometry.index.array),indices);
  }
  // The verified Storm fragment now follows the hand; Mizu's unchanged stowed
  // bow still follows the thigh. Raw source weights remain in the manifest.
  const checkBone = (i: number, vertex: number, expected: string) => {
    let mesh: any; views[i].rig.model.traverse((o: any) => { if(o.isSkinnedMesh&&o.material.userData.uniforms)mesh=o; });
    const joint = mesh.geometry.getAttribute('skinIndex').getX(vertex);
    assert.equal(mesh.skeleton.bones[joint].name,expected);
  };
  checkBone(0,1563,'mixamorigRightUpLeg'); checkBone(1,19287,'mixamorigLeftHand');
});
