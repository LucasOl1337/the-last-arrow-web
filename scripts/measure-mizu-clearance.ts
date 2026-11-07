import { rigRuntime } from '../tests/helpers/arco-rig-runtime.ts';
import { writeFile } from 'node:fs/promises';
const { THREE, scene, world, fighters, frames }=await rigRuntime();
const v=(fighters as any).views[0],f=world.fighters[0];
let mesh:any;v.rig.model.traverse((o:any)=>{if(o.isSkinnedMesh&&o.material.userData.uniforms)mesh=o;});
const rows:any[]=[];
const sample=(name:string)=>{
 scene.updateMatrixWorld(true);mesh.skeleton.update();mesh.computeBoundingBox();mesh.computeBoundingSphere();
 const pos=(o:any)=>o.getWorldPosition(new THREE.Vector3());
 const b=v.equippedBow,upper=pos(b.upperTip),lower=pos(b.lowerTip),nock=pos(b.nock),hand=pos(v.rig.bowHand);
 const bones=Object.fromEntries(['LeftForeArm','LeftHand','LeftHandIndex1','LeftHandMiddle1','LeftHandPinky1','RightHand','Head','LeftArm'].map(n=>{const bone=v.rig.model.getObjectByName('mixamorig'+n);return[n,{world:pos(bone).toArray(),model:v.rig.model.worldToLocal(pos(bone)).toArray(),quaternion:bone.getWorldQuaternion(new THREE.Quaternion()).toArray()}];}));
 const tri=[0,1,2].map(k=>mesh.geometry.index.getX(23457*3+k));
 const vertices=tri.map(i=>{const local=mesh.getVertexPosition(i,new THREE.Vector3()),w=mesh.localToWorld(local.clone());return {id:i,raw:new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'),i).toArray(),skinnedLocal:local.toArray(),world:w.toArray()};});
 // Independent shader-equation proof; no cached attached inverse-bind shortcut.
 let transportError=0;
 for(const item of vertices){const id=item.id,g=mesh.geometry;const bind=new THREE.Vector3().fromBufferAttribute(g.getAttribute('position'),id).applyMatrix4(mesh.bindMatrix),p=new THREE.Vector3();for(let k=0;k<4;k++){const joint=g.getAttribute('skinIndex').getComponent(id,k),weight=g.getAttribute('skinWeight').getComponent(id,k),matrix=new THREE.Matrix4().multiplyMatrices(mesh.skeleton.bones[joint].matrixWorld,mesh.skeleton.boneInverses[joint]);p.addScaledVector(bind.clone().applyMatrix4(matrix),weight);}p.applyMatrix4(mesh.bindMatrixInverse).applyMatrix4(mesh.matrixWorld);transportError=Math.max(transportError,p.distanceTo(new THREE.Vector3().fromArray(item.world)));}
 const hits=[upper,lower].map(tip=>{const d=nock.clone().sub(tip),ray=new THREE.Raycaster(tip,d.clone().normalize(),.005,d.length()-.005);return ray.intersectObject(mesh,false).map(h=>{const weights:Record<string,number>={};for(let n=0;n<3;n++){const i=mesh.geometry.index.getX(h.faceIndex!*3+n);for(let k=0;k<4;k++){const weight=mesh.geometry.getAttribute('skinWeight').getComponent(i,k)/3;if(weight){const bone=mesh.skeleton.bones[mesh.geometry.getAttribute('skinIndex').getComponent(i,k)].name;weights[bone]=(weights[bone]??0)+weight;}}}return{tri:h.faceIndex,point:h.point.toArray(),distance:h.distance,weights};});});
 rows.push({name,bones,upper:upper.toArray(),lower:lower.toArray(),nock:nock.toArray(),hand:hand.toArray(),tri23457:vertices,transportError,hits,rightNock:pos(v.rig.model.getObjectByName('mixamorigRightHand')).distanceTo(nock)});
};
frames(30);sample('idle');Object.assign(f,{charging:true,charge:.35});frames(120);sample('horizontal');frames(600);sample('hold10s');
const q=Math.SQRT1_2;
for(const [name,x,y] of [['north-east',q,-q],['north',0,-1],['inverted',-q,-q],['west',-1,0],['south-west',-q,q],['south',0,1],['south-east',q,q]] as const){Object.assign(f,{aimX:x,aimY:y,facing:x<0?-1:1});frames(120);sample(name);}
Object.assign(f,{crouching:true});frames(1);sample('crouch');Object.assign(f,{crouching:false,grounded:false,vy:-5});frames(1);sample('jump');
await writeFile(process.argv[2],JSON.stringify(rows,null,2)+'\n');
console.log(rows.map(r=>({name:r.name,transportError:r.transportError,hits:r.hits.map((hits:any[])=>hits.map(h=>({tri:h.tri,weights:h.weights}))),rightNock:r.rightNock})));
