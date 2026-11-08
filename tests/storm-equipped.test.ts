import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { rigRuntime } from './helpers/arco-rig-runtime.ts';

const armNames=new Set(['LeftShoulder','LeftArm','LeftForeArm','LeftHand','RightShoulder','RightArm','RightForeArm','RightHand'].map(n=>'mixamorig'+n));
// Grip/hook finger curl is part of the same arm-only overlay (hands and fingers).
const armBone=(name:string)=>armNames.has(name)||/^mixamorig(Left|Right)Hand(Index|Middle|Ring|Pinky|Thumb)[123]$/.test(name);
test('Storm equipped: exact 23 states, both strings, contact, links, paused pose and preserved ornament',async()=>{
 const {THREE,world,fighters,scene,frames}=await rigRuntime(),v=(fighters as any).views[1],f=world.fighters[1],bow=v.equippedBow,ik=v.rig.armIK;
 assert.ok(bow&&ik);assert.equal(bow.root.name,'storm-authored-equipped-bow');
 let mesh:any;v.rig.model.traverse((o:any)=>{if(o.isSkinnedMesh&&o.material.userData.uniforms)mesh=o;});
 const g=mesh.geometry,j=g.getAttribute('skinIndex'),w=g.getAttribute('skinWeight'),right:number[]=[];
 for(let i=0;i<j.count;i++){let weight=0;for(let k=0;k<4;k++)if(mesh.skeleton.bones[j.getComponent(i,k)].name.startsWith('mixamorigRightHand'))weight+=w.getComponent(i,k);if(weight>.5)right.push(i);}
 const rows:any[]=[],point=(o:any)=>o.getWorldPosition(new THREE.Vector3());
 const sample=(name:string)=>{
  scene.updateMatrixWorld(true);mesh.skeleton.update();mesh.computeBoundingBox();mesh.computeBoundingSphere();
  const hand=point(v.rig.bowHand),nock=point(bow.nock),aim=new THREE.Vector3(f.aimX,-f.aimY,0);
  const segments=[bow.upperTip,bow.lowerTip].map((tip:any)=>{
   const start=point(tip),delta=nock.clone().sub(start),ray=new THREE.Raycaster(start,delta.clone().normalize(),.005,delta.length()-.005);
   return ray.intersectObject(mesh,false).map(hit=>{
    const vertices=[0,1,2].map(k=>g.index.getX(hit.faceIndex!*3+k)),weights:Record<string,number>={};
    for(const id of vertices)for(let k=0;k<4;k++){const b=mesh.skeleton.bones[j.getComponent(id,k)].name;weights[b]=(weights[b]??0)+w.getComponent(id,k)/3;}
    const posed=vertices.map(id=>mesh.localToWorld(mesh.getVertexPosition(id,new THREE.Vector3()))),direct=ray.ray.intersectTriangle(posed[0],posed[1],posed[2],false,new THREE.Vector3());
    assert.ok(direct&&direct.distanceTo(hit.point)<1e-8,'ray/posed triangle mismatch');
    return {triangle:hit.faceIndex,vertices,weights,point:hit.point.toArray()};
   });
  });
  let contact=Infinity;for(const id of right)contact=Math.min(contact,mesh.localToWorld(mesh.getVertexPosition(id,new THREE.Vector3())).distanceTo(nock));
  const row={name,segments,contact,charging:f.charging,gripError:point(bow.grip).distanceTo(ik.gripWorld),wristToGrip:point(bow.grip).distanceTo(hand),nockTailError:f.charging?nock.distanceTo(v.nock.localToWorld(new THREE.Vector3(-.19,0,0))):null,metrics:{...ik.metrics},hand:hand.toArray(),nock:nock.toArray()};rows.push(row);
  assert.ok(row.gripError<=1e-8);assert.ok(row.wristToGrip<.2);if(f.charging){assert.ok(row.nockTailError!<1e-8);assert.ok(Math.abs(v.nock.localToWorld(new THREE.Vector3(.54,0,0)).distanceTo(nock)-.73)<1e-8);}
  assert.ok(nock.clone().sub(hand).dot(aim)<0);
  bow.strings.forEach((s:any,i:number)=>{assert.ok(s.localToWorld(new THREE.Vector3(0,-.5,0)).distanceTo(point([bow.upperTip,bow.lowerTip][i]))<1e-8);assert.ok(s.localToWorld(new THREE.Vector3(0,.5,0)).distanceTo(nock)<1e-8);assert.equal(s.material.emissive.getHex(),0);});
  const frozen=JSON.stringify(world),transforms=v.rig.bones.map((b:any)=>[b,b.position.toArray(),b.scale.toArray(),b.quaternion.toArray()]);
  ik.restore();ik.apply(f.aimX,f.aimY,bow.pull(f.charging,f.charge,v.releaseTime));
  for(const [b,p,s,q]of transforms){assert.deepEqual(b.position.toArray(),p);assert.deepEqual(b.scale.toArray(),s);if(!armBone(b.name))assert.deepEqual(b.quaternion.toArray(),q);assert.ok(Math.abs(b.quaternion.length()-1)<1e-6);}
  assert.equal(JSON.stringify(world),frozen);
  assert.equal(j.getX(18817),17);assert.equal(j.getX(19287),17);
 };
 frames(30);sample('idle');Object.assign(f,{charging:true,charge:.175});frames(10);sample('draw');f.charge=.35;frames(120);sample('east');frames(600);sample('hold10s');
 const q=Math.SQRT1_2;
 for(const [name,x,y]of [['north-east',q,-q],['north',0,-1],['inverted',-q,-q],['west',-1,0],['south-west',-q,q],['south',0,1],['south-east',q,q]]as const){Object.assign(f,{aimX:x,aimY:y,facing:x<0?-1:1});frames(1);sample(name+'-turn1');frames(119);sample(name);}
 f.crouching=true;frames(1);sample('crouch');Object.assign(f,{crouching:false,grounded:false,vy:-5});frames(1);sample('jump');
 const pose=()=>JSON.stringify(v.rig.bones.map((b:any)=>[b.position.toArray(),b.quaternion.toArray(),b.scale.toArray()]));fighters.update(world,1,20,0);const before=pose();for(let i=0;i<600;i++)fighters.update(world,1,20,0);assert.equal(pose(),before);
 f.charging=false;fighters.event('shoot',f.id);frames(1);sample('release1');frames(4);sample('release5');frames(20);sample('release-ended');
 if(process.env.STORM_EQUIPPED_REPORT)await writeFile(process.env.STORM_EQUIPPED_REPORT,JSON.stringify(rows,null,2)+'\n');
 assert.deepEqual(rows.filter(r=>r.segments.flat().length).map(r=>({state:r.name,hits:r.segments.flat()})),[],'string crosses actual Storm skin');
 assert.deepEqual(rows.filter(r=>r.metrics.unreachable||Math.abs(r.metrics.handDepth-r.metrics.targetDepth)>1e-6).map(r=>r.name),[],'support target unreachable');
 assert.deepEqual(rows.filter(r=>r.charging&&Math.abs(r.contact-.005)>=1e-5).map(r=>({state:r.name,contact:r.contact})),[],'draw hand must contact nock');
});
