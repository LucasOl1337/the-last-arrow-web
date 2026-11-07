import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { rigRuntime } from './helpers/arco-rig-runtime.ts';
import { STORM_ORNAMENT } from '../src/render/storm-ornament.ts';

test('Storm606: rest invariant, isolated skin clone and hand-relative stability in real production poses', async () => {
  const { THREE, kits, world, fighters, frames, scene } = await rigRuntime();
  const { instantiate } = await import('../src/render/characters.ts');
  const { disposeSkeletons } = await import('../src/render/disposal.ts');
  const { bindStormOrnament } = await import('../src/render/storm-ornament.ts');
  const find = (root: any) => { let mesh: any; root.traverse((o: any) => { if (o.isSkinnedMesh && !o.material.userData.outline) mesh ??= o; }); return mesh; };
  const v = (fighters as any).views[1], mesh = find(v.rig.model), source = find(kits.storm!.template), g = mesh.geometry;
  const manifest = JSON.parse(await readFile('evidence/bow-sockets/storm-upper-component.json','utf8'));
  const vertices: number[] = STORM_ORNAMENT.vertexRanges.flatMap(([a,b]) => Array.from({length:b-a+1},(_,k)=>a+k));
  const triangles = STORM_ORNAMENT.triangleRanges.flatMap(([a,b]) => Array.from({length:b-a+1},(_,k)=>a+k));
  assert.deepEqual(vertices,manifest.vertices); assert.deepEqual(triangles,manifest.triangles);
  assert.equal(vertices.length,435); assert.equal(triangles.length,606);
  assert.notEqual(g,source.geometry);
  const selected = new Set(vertices);
  for (const [name, attr] of Object.entries(source.geometry.attributes) as [string, any][]) {
    const next = g.getAttribute(name); assert.notEqual(next.array,attr.array);
    for(let i=0;i<attr.count;i++) if(!selected.has(i) || !['skinIndex','skinWeight'].includes(name)) {
      for(let k=0;k<attr.itemSize;k++) assert.equal(next.getComponent(i,k),attr.getComponent(i,k),`${name}/${i}/${k}`);
    }
  }
  assert.deepEqual(g.index.array,source.geometry.index.array);
  assert.equal(mesh.material.map,source.material.map);
  assert.equal(kits.storm!.sourceSha256,STORM_ORNAMENT.sha256);
  const other = instantiate(kits.storm!), otherMesh = find(other);
  assert.notEqual(otherMesh.geometry,g); assert.notEqual(otherMesh.geometry.getAttribute('skinIndex').array,g.getAttribute('skinIndex').array);
  const unknown = instantiate({...kits.storm!,sourceSha256:'unknown'});
  assert.equal(find(unknown).geometry,source.geometry);
  assert.equal(find(instantiate(kits.mizu!)).geometry,find(kits.mizu!.template).geometry);
  // Exact fail-closed cases: a foreign triangle sharing this fragment, changed
  // source weights, and an already-animated hand must not partially edit a kit.
  const bad = instantiate({...kits.storm!,sourceSha256:undefined}), badMesh = find(bad);
  badMesh.geometry = source.geometry.clone();
  badMesh.geometry.index.setX(0,18817);
  assert.equal(bindStormOrnament(bad,STORM_ORNAMENT.sha256),false);
  badMesh.geometry.index.setX(0,source.geometry.index.getX(0));
  badMesh.geometry.getAttribute('skinWeight').setX(18817,.5);
  assert.equal(bindStormOrnament(bad,STORM_ORNAMENT.sha256),false);
  badMesh.geometry.getAttribute('skinWeight').setX(18817,1);
  bad.getObjectByName('mixamorigLeftHandMiddle3')!.rotateX(.2);
  assert.equal(bindStormOrnament(bad,STORM_ORNAMENT.sha256),false);
  badMesh.geometry.dispose();
  const hand = v.rig.bowHand, middle = v.rig.model.getObjectByName('mixamorigLeftHandMiddle3');
  const report: any = {vertices:vertices.length,triangles:triangles.length,states:{}};
  let restHand: number[][];
  const sample = (name: string) => {
    scene.updateMatrixWorld(true); mesh.skeleton.update();
    const points = () => Array.from({length:g.getAttribute('position').count},(_,i) => mesh.localToWorld(mesh.getVertexPosition(i,new THREE.Vector3())));
    const after = points(); mesh.geometry=source.geometry; const before=points();mesh.geometry=g;
    const inverse = hand.matrixWorld.clone().invert();
    const local = vertices.map(i=>after[i].clone().applyMatrix4(inverse).toArray());
    restHand ??= local;
    const outside = Math.max(...after.map((p:any,i:number)=>selected.has(i)?0:p.distanceTo(before[i])));
    const restError = Math.max(...vertices.map(i=>after[i].distanceTo(before[i])));
    const handDrift = Math.max(...local.map((p,i)=>new THREE.Vector3().fromArray(p).distanceTo(new THREE.Vector3().fromArray(restHand[i]))));
    const beforeDrift = Math.max(...vertices.map((id,i)=>before[id].clone().applyMatrix4(inverse).distanceTo(new THREE.Vector3().fromArray(restHand[i]))));
    report.states[name]={outsideError:outside,changedComponentDistance:restError,handRelativeError:handDrift,beforeHandRelativeError:beforeDrift,handMatrix:hand.matrixWorld.toArray(),middleMatrix:middle.matrixWorld.toArray(),upperAfter:after[18817].toArray(),lowerAfter:after[19287].toArray(),upperBefore:before[18817].toArray(),lowerBefore:before[19287].toArray()};
    assert.equal(outside,0); assert.ok(handDrift<1e-8,`${name}: ${handDrift}`);
    if(name==='rest')assert.ok(restError<=1e-6,`rest: ${restError}`);
  };
  sample('rest'); frames(30);sample('idle');
  world.fighters.forEach(f=>Object.assign(f,{charging:true,charge:.35}));frames(120);sample('hold');frames(600);sample('hold10s');
  world.fighters.forEach(f=>Object.assign(f,{aimX:-Math.SQRT1_2,aimY:-Math.SQRT1_2,facing:-1}));frames(120);sample('inverted');
  world.fighters.forEach(f=>Object.assign(f,{crouching:true}));frames(1);sample('crouch');
  world.fighters.forEach(f=>Object.assign(f,{crouching:false,grounded:false,vy:-5}));frames(1);sample('jump');
  world.fighters.forEach(f=>{f.charging=false;fighters.event('shoot',f.id);});frames(1);sample('release');frames(30);sample('afterRelease');
  // Genuine bug regression: original Middle3 skin moves in the hand's rest frame.
  assert.ok(report.states.hold.beforeHandRelativeError>.1);
  assert.equal(source.geometry.getAttribute('skinIndex').getX(18817),source.skeleton.bones.findIndex((b:any)=>b.name==='mixamorigLeftHandMiddle3'));
  // Independent instance and template remain unchanged even if one clone changes.
  const originalOther = otherMesh.geometry.getAttribute('skinIndex').getX(18817);
  g.getAttribute('skinIndex').setX(18817,0);
  assert.equal(otherMesh.geometry.getAttribute('skinIndex').getX(18817),originalOther);
  g.getAttribute('skinIndex').setX(18817,originalOther);
  let disposed=0,sourceDisposed=0;g.addEventListener('dispose',()=>disposed++);source.geometry.addEventListener('dispose',()=>sourceDisposed++);
  disposeSkeletons(v.rig.model);disposeSkeletons(v.rig.model);assert.equal(disposed,1);assert.equal(sourceDisposed,0);
  if(process.env.STORM_REPORT)await writeFile(process.env.STORM_REPORT,JSON.stringify(report,null,2)+'\n');
});
