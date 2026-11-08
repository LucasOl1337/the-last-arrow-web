import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { rigRuntime } from './helpers/arco-rig-runtime.ts';
import { MIZU_EQUIPPED } from '../src/render/equipped-mizu-bow.ts';

// Finite explicit acceptance states requested for this one asset, not input fuzz.
test('authored Mizu bow: grip/tips/string/nock across eight aims and exact rig neighbors', async () => {
  const { THREE, fighters, world, scene, kits, frames } = await rigRuntime();
  const views = (fighters as any).views, v = views[0], bow = v.equippedBow;
  assert.ok(bow); assert.ok(views[1].equippedBow); assert.notEqual(views[1].equippedBow,bow);
  const original: any[]=[]; kits.mizu!.template.traverse((o:any)=>{if(o.isSkinnedMesh)original.push(o);});
  const current: any[]=[]; v.rig.model.traverse((o:any)=>{if(o.isSkinnedMesh&&o.material.userData.uniforms)current.push(o);});
  assert.equal(current[0].geometry,original[0].geometry);assert.equal(current[0].material.map,original[0].material.map);
  const f=world.fighters[0], rows: any[]=[];
  const sample=(name:string)=>{
    scene.updateMatrixWorld(true);
    const hand=v.rig.bowHand.getWorldPosition(new THREE.Vector3());
    const point=(o:any)=>o.getWorldPosition(new THREE.Vector3());
    const upper=point(bow.upperTip),lower=point(bow.lowerTip),nock=point(bow.nock),grip=point(bow.grip);
    const aim=new THREE.Vector3(f.aimX,-f.aimY,0).normalize();
    // Riser sits in the measured closed fist (grip pose), not on the wrist joint.
    assert.ok(grip.distanceTo(v.rig.armIK.gripWorld)<1e-8);assert.ok(grip.distanceTo(hand)<.2);
    // Nocked: bow exactly across the sim aim. Relaxed carry (no arrow) tilts the
    // bow on purpose; then it is exactly across the displayed carry aim instead.
    const across=f.charging?aim:new THREE.Vector3(v.bowAim.x,-v.bowAim.y,0).normalize();
    if(f.charging)assert.ok(Math.abs(v.bowAim.x-f.aimX)+Math.abs(v.bowAim.y-f.aimY)<1e-12);
    assert.ok(Math.abs(upper.clone().sub(lower).normalize().dot(across))<1e-8);
    assert.ok(Math.abs(upper.distanceTo(lower)-1.28)<1e-8);
    const tips=[upper,lower];
    bow.strings.forEach((s:any,i:number)=>{
      assert.ok(s.localToWorld(new THREE.Vector3(0,-.5,0)).distanceTo(tips[i])<1e-8);
      assert.ok(s.localToWorld(new THREE.Vector3(0,.5,0)).distanceTo(nock)<1e-8);
    });
    if(f.charging){
      const tail=v.nock.localToWorld(new THREE.Vector3(-.19,0,0)),tip=v.nock.localToWorld(new THREE.Vector3(.54,0,0));
      assert.ok(tail.distanceTo(nock)<1e-8);assert.ok(Math.abs(tip.distanceTo(tail)-.73)<1e-8);
      assert.ok(tip.clone().sub(tail).normalize().dot(aim)>1-1e-8);
      assert.ok(nock.clone().sub(upper).dot(aim)<=1e-8);
      if(f.charge>0)assert.ok(nock.clone().sub(upper).dot(aim)<0);
    }
    // Surface crossings are reported honestly for visual acceptance, not hidden.
    const mesh=current[0];mesh.skeleton.update();mesh.computeBoundingBox();mesh.computeBoundingSphere();
    const ray=new THREE.Raycaster();const stringHits=tips.map(tip=>{
      const direction=nock.clone().sub(tip);ray.set(tip,direction.clone().normalize());ray.near=.005;ray.far=direction.length()-.005;
      return ray.intersectObject(mesh,false).map(hit=>({distance:hit.distance,triangle:hit.faceIndex,point:hit.point.toArray()}));
    });
    const right=v.rig.model.getObjectByName('mixamorigRightHand').getWorldPosition(new THREE.Vector3());
    const arrowTip=v.nock.localToWorld(new THREE.Vector3(.54,0,0));
    rows.push({name,hand:hand.toArray(),upper:upper.toArray(),lower:lower.toArray(),nock:nock.toArray(),rightHand:right.toArray(),rightHandToNock:right.distanceTo(nock),stringHits,arrowTipToPhysicsOrigin:f.charging?arrowTip.distanceTo(new THREE.Vector3(f.x+f.aimX*.22,18-(f.y+f.aimY*.22),.8)):null});
  };
  frames(30);sample('idle');
  Object.assign(f,{charging:true,charge:0});frames(1);sample('draw-start');
  f.charge=.175;frames(10);sample('half-draw');
  f.charge=.35;frames(120);sample('hold');frames(600);sample('hold10s');
  // Exactly the eight product directions, fixed named fixtures.
  const q=Math.SQRT1_2;
  for(const [name,x,y] of [['east',1,0],['north-east',q,-q],['north',0,-1],['inverted-diagonal',-q,-q],['west',-1,0],['south-west',-q,q],['south',0,1],['south-east',q,q]] as const){
    Object.assign(f,{aimX:x,aimY:y,facing:x<0?-1:1});frames(120);sample(name);
  }
  Object.assign(f,{crouching:true});frames(1);sample('crouch');
  Object.assign(f,{crouching:false,grounded:false,vy:-5});frames(1);sample('jump');
  const pose=()=>JSON.stringify({bones:v.rig.bones.map((b:any)=>[b.position.toArray(),b.quaternion.toArray(),b.scale.toArray()]),bow:bow.root.matrixWorld.toArray(),nock:bow.nock.position.toArray()});
  fighters.update(world,1,20,0);scene.updateMatrixWorld(true);const before=pose();
  for(let i=0;i<600;i++)fighters.update(world,1,20,0);scene.updateMatrixWorld(true);assert.equal(pose(),before);
  Object.assign(f,{charging:false});fighters.event('shoot',f.id);frames(1);sample('release1');frames(4);sample('release5');frames(20);sample('release-ended');
  assert.equal(bow.nock.position.x,-MIZU_EQUIPPED.brace);
  for(const mesh of bow.strings) assert.equal((mesh.material as any).emissive.getHex(),0);
  if(process.env.MIZU_BOW_REPORT)await writeFile(process.env.MIZU_BOW_REPORT,JSON.stringify({candidate:'one authored equipped asset',rows,pausedFrames:600},null,2)+'\n');
});
