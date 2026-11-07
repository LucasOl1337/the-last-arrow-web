import test from 'node:test';
import assert from 'node:assert/strict';
import { rigRuntime } from './helpers/arco-rig-runtime.ts';

const edited = new Set(['LeftShoulder','LeftArm','LeftForeArm','LeftHand','RightShoulder','RightArm','RightForeArm','RightHand'].map(n=>'mixamorig'+n));
test('arm IK preserves links, torso and simulation; all fixed neighbors clear body and head', async()=>{
  const {THREE,scene,world,fighters,frames}=await rigRuntime();
  const views=(fighters as any).views,v=views[0],f=world.fighters[0],ik=v.rig.armIK;
  assert.ok(ik);assert.equal(views[1].rig.armIK,undefined);
  let mesh:any;v.rig.model.traverse((o:any)=>{if(o.isSkinnedMesh&&o.material.userData.uniforms)mesh=o;});
  const links=v.rig.bones.filter((b:any)=>edited.has(b.name)).map((b:any)=>({bone:b,position:b.position.toArray(),scale:b.scale.toArray()}));
  const check=(state:string)=>{
    scene.updateMatrixWorld(true);mesh.skeleton.update();mesh.computeBoundingBox();mesh.computeBoundingSphere();
    assert.equal(ik.metrics.unreachable,false,`${state}: support target unreachable`);
    assert.ok(Math.abs(ik.metrics.handDepth-ik.metrics.targetDepth)<1e-6,`${state}: reach error`);
    for(const {bone,position,scale} of links){
      bone.position.toArray().forEach((x:number,i:number)=>assert.ok(Math.abs(x-position[i])<1e-7,`${state}: arm link changed`));
      bone.scale.toArray().forEach((x:number,i:number)=>assert.ok(Math.abs(x-scale[i])<1e-7,`${state}: arm scale changed`));
    }
    const transforms=v.rig.bones.map((b:any)=>[b,b.position.toArray(),b.scale.toArray()]);
    const point=(o:any)=>o.getWorldPosition(new THREE.Vector3()),nock=point(v.equippedBow.nock);
    for(const tip of [v.equippedBow.upperTip,v.equippedBow.lowerTip]){
      const start=point(tip),delta=nock.clone().sub(start),ray=new THREE.Raycaster(start,delta.clone().normalize(),.005,delta.length()-.005);
      assert.deepEqual(ray.intersectObject(mesh,false).map(h=>h.faceIndex),[],`${state}: string crosses skin`);
    }
    let contact=Infinity;
    for(let i=0;i<mesh.geometry.getAttribute('position').count;i++){
      let right=0;for(let k=0;k<4;k++)if(mesh.skeleton.bones[mesh.geometry.getAttribute('skinIndex').getComponent(i,k)].name.startsWith('mixamorigRightHand'))right+=mesh.geometry.getAttribute('skinWeight').getComponent(i,k);
      if(right>.5)contact=Math.min(contact,mesh.localToWorld(mesh.getVertexPosition(i,new THREE.Vector3())).distanceTo(nock));
    }
    assert.ok(Math.abs(contact-.005)<1e-5,`${state}: draw hand not tangent to nock (${contact})`);
    const frozen=JSON.stringify(world),outside=v.rig.bones.filter((b:any)=>!edited.has(b.name)).map((b:any)=>[b,b.quaternion.toArray()]);
    ik.restore();ik.apply(f.aimX,f.aimY,v.equippedBow.pull(f.charging,f.charge,v.releaseTime));
    for(const [bone,q] of outside)assert.deepEqual(bone.quaternion.toArray(),q,`${state}: edited ${bone.name}`);
    for(const [bone,p,s] of transforms){assert.deepEqual(bone.position.toArray(),p);assert.deepEqual(bone.scale.toArray(),s);}
    assert.equal(JSON.stringify(world),frozen);
  };
  frames(30);check('idle');Object.assign(f,{charging:true,charge:.175});frames(10);check('draw');f.charge=.35;frames(120);check('east');frames(600);check('hold10s');
  const q=Math.SQRT1_2;
  for(const [name,x,y] of [['north-east',q,-q],['north',0,-1],['inverted',-q,-q],['west',-1,0],['south-west',-q,q],['south',0,1],['south-east',q,q]] as const){
    Object.assign(f,{aimX:x,aimY:y,facing:x<0?-1:1});frames(1);check(name+'-turn1');frames(119);check(name);
  }
  f.crouching=true;frames(1);check('crouch');Object.assign(f,{crouching:false,grounded:false,vy:-5});frames(1);check('jump');
  f.charging=false;fighters.event('shoot',f.id);frames(1);check('release1');frames(4);check('release5');frames(20);check('release-ended');
});
