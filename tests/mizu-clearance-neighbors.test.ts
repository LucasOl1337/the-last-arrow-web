import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { rigRuntime } from './helpers/arco-rig-runtime.ts';

/** Explicit product directions/neighbors, one geometry implementation, no sweep.
 * Original tri23457 test remains unchanged in mizu-string-clearance.test.ts. */
test('both Mizu string segments clear the head in all eight aims and pose neighbors', async () => {
  const { THREE, scene, world, fighters, frames }=await rigRuntime();
  const v=(fighters as any).views[0],f=world.fighters[0],rows:any[]=[];
  let mesh:any;v.rig.model.traverse((o:any)=>{if(o.isSkinnedMesh&&o.material.userData.uniforms)mesh=o;});
  const sample=(name:string)=>{
    scene.updateMatrixWorld(true);mesh.skeleton.update();mesh.computeBoundingBox();mesh.computeBoundingSphere();
    const bow=v.equippedBow,point=(o:any)=>o.getWorldPosition(new THREE.Vector3()),nock=point(bow.nock),hand=point(v.rig.bowHand);
    const aim=new THREE.Vector3(f.aimX,-f.aimY,0).normalize();
    assert.ok(point(bow.grip).distanceTo(hand)<=.03,`${name}: grip outside hand`);
    assert.ok(nock.clone().sub(hand).dot(aim)<0,`${name}: nock not behind grip`);
    const segments=[bow.upperTip,bow.lowerTip].map((tip:any)=>{
      const start=point(tip),delta=nock.clone().sub(start),ray=new THREE.Raycaster(start,delta.clone().normalize(),.005,delta.length()-.005);
      return ray.intersectObject(mesh,false).map(hit=>{
        const g=mesh.geometry,j=g.getAttribute('skinIndex'),w=g.getAttribute('skinWeight');let headWeight=0;
        const vertices=[0,1,2].map(k=>g.index.getX(hit.faceIndex!*3+k));
        for(const id of vertices)for(let k=0;k<4;k++)if(mesh.skeleton.bones[j.getComponent(id,k)].name==='mixamorigHead')headWeight+=w.getComponent(id,k)/3;
        // Re-test actual posed triangle directly. No stale bounding boxes/bind,
        // and no anatomical classifier deciding whether the intersection exists.
        const p=vertices.map(id=>mesh.localToWorld(mesh.getVertexPosition(id,new THREE.Vector3())));
        const direct=ray.ray.intersectTriangle(p[0],p[1],p[2],false,new THREE.Vector3());
        assert.ok(direct && direct.distanceTo(hit.point)<1e-8,`${name}: triangle/raycast mismatch`);
        return {triangle:hit.faceIndex,vertices,point:hit.point.toArray(),headWeight};
      });
    });
    rows.push({name,segments,headHits:segments.flat().filter(h=>h.headWeight>.8)});
  };
  frames(30);sample('idle');Object.assign(f,{charging:true,charge:.175});frames(10);sample('draw');f.charge=.35;frames(120);sample('east');frames(600);sample('hold10s');
  const q=Math.SQRT1_2;
  for(const [name,x,y] of [['north-east',q,-q],['north',0,-1],['inverted',-q,-q],['west',-1,0],['south-west',-q,q],['south',0,1],['south-east',q,q]] as const){
    Object.assign(f,{aimX:x,aimY:y,facing:x<0?-1:1});frames(1);sample(name+'-turn1');frames(119);sample(name);
  }
  Object.assign(f,{crouching:true});frames(1);sample('crouch');
  Object.assign(f,{crouching:false,grounded:false,vy:-5});frames(1);sample('jump');
  Object.assign(f,{charging:false});fighters.event('shoot',f.id);frames(1);sample('release1');frames(4);sample('release5');frames(20);sample('release-ended');
  if(process.env.MIZU_CLEARANCE_REPORT)await writeFile(process.env.MIZU_CLEARANCE_REPORT,JSON.stringify(rows,null,2)+'\n');
  const failures=rows.filter(r=>r.headHits.length).map(r=>({state:r.name,triangles:r.headHits.map((h:any)=>h.triangle)}));
  assert.deepEqual(failures,[],`head clearance failed: ${JSON.stringify(failures)}`);
});
