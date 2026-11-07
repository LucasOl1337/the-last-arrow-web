import test from 'node:test';
import assert from 'node:assert/strict';
import { rigRuntime } from './helpers/arco-rig-runtime.ts';

// Visual acceptance gate for the one known inverted-diagonal case. A collision
// with the head is a rejection even if grip/axis/string math is perfectly valid.
test('Mizu equipped string must not cross head in the exact inverted diagonal', async () => {
  const { THREE, scene, world, fighters, frames } = await rigRuntime();
  const v=(fighters as any).views[0],f=world.fighters[0];
  Object.assign(f,{charging:true,charge:.35});frames(120);
  Object.assign(f,{aimX:-Math.SQRT1_2,aimY:-Math.SQRT1_2,facing:-1});frames(120);
  scene.updateMatrixWorld(true);let mesh:any;
  v.rig.model.traverse((o:any)=>{if(o.isSkinnedMesh&&o.material.userData.uniforms)mesh=o;});
  mesh.skeleton.update();mesh.computeBoundingBox();mesh.computeBoundingSphere();
  const b=v.equippedBow,start=b.lowerTip.getWorldPosition(new THREE.Vector3()),end=b.nock.getWorldPosition(new THREE.Vector3()),direction=end.clone().sub(start);
  const ray=new THREE.Raycaster(start,direction.clone().normalize(),.005,direction.length()-.005);
  const headHits=ray.intersectObject(mesh,false).filter(hit=>{
    const index=mesh.geometry.index,j=mesh.geometry.getAttribute('skinIndex'),w=mesh.geometry.getAttribute('skinWeight');let head=0;
    for(let n=0;n<3;n++){const v=index.getX(hit.faceIndex!*3+n);for(let k=0;k<4;k++)if(mesh.skeleton.bones[j.getComponent(v,k)].name==='mixamorigHead')head+=w.getComponent(v,k)/3;}
    return head>.8;
  });
  assert.equal(headHits.length,0,`string crosses head triangles: ${headHits.map(h=>h.faceIndex).join(',')}`);
});
