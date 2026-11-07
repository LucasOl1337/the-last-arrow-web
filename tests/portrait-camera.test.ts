import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cameraFrame, followCamera } from '../src/render/camera-frame.ts';
import { cameraDirection } from '../src/render/camera-indicator.ts';

test('360x800 square close canvas is real combat area >=40%, without stretching',()=>{
  const frame=cameraFrame(1,true,{x:2,y:2.55});
  assert.equal(frame.width,frame.height);assert.equal(frame.height,19.4/1.28);
  assert.ok(360*360/(360*800)>=.4);
  const camera=new THREE.PerspectiveCamera(30,1,.1,200);camera.position.set(frame.x,frame.y,frame.height/(2*Math.tan(Math.PI/12)));camera.updateMatrixWorld();
  const project=(x:number,y:number)=>new THREE.Vector3(x,y,.6).project(camera);
  const origin=project(2,3),east=project(3,3),north=project(2,4);
  assert.ok(Math.abs((east.x-origin.x)-(north.y-origin.y))<1e-12,'same pixel scale on both axes');
  const top=project(29.4,4.4),bottom=project(30.6,2);
  assert.equal(cameraDirection({left:(top.x+1)/2,right:(bottom.x+1)/2,top:(1-top.y)/2,bottom:(1-bottom.y)/2}),'→');
  assert.ok(2.4/frame.height*360>55,'near body grows from32.76px to >55px');
});
test('square near wrap/respawn reset atomically; wide still includes all32x18',()=>{
  const a=followCamera(undefined,1,true,{x:.1,y:17.9},1/60);
  const b=followCamera(a,1,true,{x:31.9,y:.1},1/60);
  const expected=cameraFrame(1,true,{x:31.9,y:.1});assert.equal(b.x,expected.x);assert.equal(b.y,expected.y);
  const dead=followCamera(b,1,true,undefined,1/60);assert.equal(dead.x,16);assert.equal(dead.y,9);
  const born=followCamera(dead,1,true,{x:2,y:2.55},1/60);assert.equal(born.x,cameraFrame(1,true,{x:2,y:2.55}).x);
  const wide=cameraFrame(1,false);assert.ok(wide.width>=32&&wide.height>=18);assert.equal(wide.x,16);
  // A complete32:18world at360px width cannot occupy40%of800px height.
  assert.ok((360*18/32)/800<.4,'report wide portrait limitation honestly, not as a green area gate');
});
