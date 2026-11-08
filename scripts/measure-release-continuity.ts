import { rigRuntime } from '../tests/helpers/arco-rig-runtime.ts';
import { updateBow } from '../src/sim/arrows.ts';
import { emptyIntent } from '../src/sim/input.ts';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export async function measureReleaseContinuity(){
 const {THREE,world,fighters,arrows,scene,frames}=await rigRuntime();
 world.options.seed=42;world.options.difficulty='easy';const rows:any[]=[];
 for(const [state,x,y,crouching]of [['horizontal',1,0,false],['inverted',-Math.SQRT1_2,-Math.SQRT1_2,false],['crouch',Math.SQRT1_2,Math.SQRT1_2,true]]as const){
  world.arrows=[];world.events=[];
  world.fighters.forEach(f=>Object.assign(f,{charging:true,charge:.35,shotCooldown:0,ammo:3,inventory:['normal','normal','normal'],aimX:x,aimY:y,facing:x<0?-1:1,crouching,grounded:true}));
  frames(120);scene.updateMatrixWorld(true);
  const held=(fighters as any).views.map((v:any)=>({tip:v.nock.localToWorld(new THREE.Vector3(.54,0,0)),hand:v.rig.bowHand.getWorldPosition(new THREE.Vector3())}));
  world.fighters.forEach(f=>updateBow(world,f,emptyIntent()));arrows.update(world,0);
  const mesh=(arrows as any).mesh,g=mesh.geometry.getAttribute('position');let tipX=-Infinity;for(let i=0;i<g.count;i++)tipX=Math.max(tipX,g.getX(i));
  world.arrows.forEach((a,i)=>{const m=new THREE.Matrix4();mesh.getMatrixAt(i,m);const tip=new THREE.Vector3(tipX,0,0).applyMatrix4(m),origin=new THREE.Vector3().setFromMatrixPosition(m),f=world.fighters[a.owner];rows.push({state,character:f.character,heldTip:held[i].tip.toArray(),hand:held[i].hand.toArray(),handFromFeet:held[i].hand.clone().sub(new THREE.Vector3(f.x,18-f.y-(crouching?.30:.55),.55)).toArray(),projectileTip:tip.toArray(),physicsOrigin:[a.x,a.y],renderOrigin:origin.toArray(),tipToTip:held[i].tip.distanceTo(tip),tipToPhysicsOrigin:held[i].tip.distanceTo(origin)});});
 }
 return rows;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const rows=await measureReleaseContinuity();if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(rows,null,2)+'\n');console.log(JSON.stringify(rows,null,2));}
