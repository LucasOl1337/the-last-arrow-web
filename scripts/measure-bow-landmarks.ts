import { rigRuntime } from '../tests/helpers/arco-rig-runtime.ts';
import { BOW_LANDMARKS, skinnedLandmark } from '../src/render/bow-landmarks.ts';
import { writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const { THREE, kits, world, fighters, frames } = await rigRuntime();
const views = (fighters as any).views;
const sample = () => views.map((v: any, i: number) => {
  const key = i ? 'storm' : 'mizu', definition = BOW_LANDMARKS[key];
  let mesh: any; v.rig.model.traverse((o: any) => { if (o.isSkinnedMesh && o.material.userData.uniforms) mesh = o; });
  const hand = v.rig.bowHand.getWorldPosition(new THREE.Vector3());
  const points = definition.points.map(p => ({ ...p, world: skinnedLandmark(mesh, p.vertex).toArray() }));
  return { character: key, hand: hand.toArray(), points, upperLowerDistance: new THREE.Vector3().fromArray(points[0].world).distanceTo(new THREE.Vector3().fromArray(points[1].world)),
    crossingToHand: new THREE.Vector3().fromArray(points[2].world).distanceTo(hand) };
});
const rest = sample(); frames(30); const idle = sample();
world.fighters.forEach(f => Object.assign(f, { charging: true, charge: .35 })); frames(120); const hold = sample(); frames(600); const hold10s = sample();
world.fighters.forEach(f => Object.assign(f, { aimX: -Math.SQRT1_2, aimY: -Math.SQRT1_2, facing: -1 })); frames(120); const inverted = sample();
world.fighters.forEach(f => Object.assign(f, { crouching: true })); frames(1); const crouch = sample();
world.fighters.forEach(f => Object.assign(f, { crouching: false, grounded: false, vy: -5 })); frames(1); const jump = sample();
const provenance = await Promise.all((['mizu','storm'] as const).map(async key => {
 let mesh: any; kits[key]!.template.traverse((o: any) => { if (o.isSkinnedMesh) mesh=o; });
 const g=mesh.geometry, index=g.index, uv=g.getAttribute('uv'), skin=g.getAttribute('skinIndex'), weight=g.getAttribute('skinWeight');
 const points=BOW_LANDMARKS[key].points.map(p=>{
  const vertices=[0,1,2].map(k=>index.getX(p.triangle*3+k));
  const box=new THREE.Box3();vertices.forEach(v=>box.expandByPoint(skinnedLandmark(mesh,v)));
  const [a,b,c]=vertices;
  const uvArea=Math.abs((uv.getX(b)-uv.getX(a))*(uv.getY(c)-uv.getY(a))-(uv.getY(b)-uv.getY(a))*(uv.getX(c)-uv.getX(a)))/2;
  const incident=[];for(let t=0;t<index.count/3;t++)if([0,1,2].some(k=>index.getX(t*3+k)===p.vertex))incident.push(t);
  return {...p,triangleVertices:vertices,incidentTriangles:incident,triangleBounds:{min:box.min.toArray(),max:box.max.toArray()},uv:[uv.getX(p.vertex),uv.getY(p.vertex)],uvArea,
   weights:[0,1,2,3].map(k=>({bone:mesh.skeleton.bones[skin.getComponent(p.vertex,k)].name,weight:weight.getComponent(p.vertex,k)})).filter(x=>x.weight>0)};
 });
 return {character:key,source:`public/assets/models/${key}.glb`,sha256:createHash('sha256').update(await readFile(`public/assets/models/${key}.glb`)).digest('hex'),mesh:mesh.name,primitive:0,status:BOW_LANDMARKS[key].status,points};
}));
const report={base:'fb9f16ccd768d14b26b08389620b505c81e76044',runtime:'83aff6b',provenance,cases:{rest,idle,hold,hold10s,inverted,crouch,jump},functionalStringApproved:false};
await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({hold:hold.map(p=>({character:p.character,crossingToHand:p.crossingToHand})),provenance:provenance.map(p=>({character:p.character,points:p.points.map(x=>({name:x.name,vertex:x.vertex,triangle:x.triangle,uvArea:x.uvArea}))}))},null,2));
