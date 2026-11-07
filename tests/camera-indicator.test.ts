import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cameraFrame } from '../src/render/camera-frame.ts';
import { cameraDirection } from '../src/render/camera-indicator.ts';

function projectBody(close: boolean, target: {x:number;y:number}, x: number, y: number) {
  const frame = cameraFrame(16/9,close,target), camera = new THREE.PerspectiveCamera(30,16/9,.1,200);
  camera.position.set(frame.x,frame.y,frame.height/(2*Math.tan(Math.PI/12))); camera.updateMatrixWorld();
  const head = new THREE.Vector3(x-.6,18-y+2.4-.55,.6).project(camera);
  const feet = new THREE.Vector3(x+.6,18-y-.55,.6).project(camera);
  return {left:(head.x+1)/2,right:(feet.x+1)/2,top:(1-head.y)/2,bottom:(1-feet.y)/2};
}
test('fixed x2/x30 duel: camera-clipped rival is right, even away from the map seam',()=>{
  assert.equal(cameraDirection(projectBody(true,{x:2,y:2.55},30,15.45)),'→');
  assert.equal(cameraDirection(projectBody(true,{x:2,y:2.55},2,15.45)),'');
  assert.equal(cameraDirection(projectBody(false,{x:2,y:2.55},30,15.45)),'');
});
test('horizontal wrap reverses the camera-edge signal, not the player identity',()=>{
  assert.equal(cameraDirection(projectBody(true,{x:31.9,y:3},2,15.45)),'←');
  assert.equal(cameraDirection(projectBody(true,{x:.1,y:3},30,15.45)),'→');
});
test('vertical clipping and corner combine directions from the visual body bounds',()=>{
  assert.equal(cameraDirection({left:.4,right:.5,top:-.1,bottom:.2}),'↑');
  assert.equal(cameraDirection({left:.4,right:.5,top:.9,bottom:1.1}),'↓');
  assert.equal(cameraDirection({left:-.2,right:-.1,top:-.1,bottom:.2}),'↑←');
  assert.equal(cameraDirection({left:0,right:1,top:0,bottom:1}),'');
});
