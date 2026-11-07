import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Controls } from '../src/ui/controls.ts';
import { saveBinding } from '../src/ui/control-layouts.ts';
import type { PadSnapshot } from '../src/input/gamepad.ts';
const win = Object.assign(new EventTarget(), { closest: () => null });
const doc = Object.assign(new EventTarget(), { hidden: false });
let snapshots: (PadSnapshot | null)[] = [];
const storage = new Map<string,string>();
Object.defineProperty(globalThis,'window',{value:win,configurable:true});
Object.defineProperty(globalThis,'document',{value:doc,configurable:true});
Object.defineProperty(globalThis,'navigator',{value:{getGamepads:()=>snapshots},configurable:true});
Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)},configurable:true});
function pad(index:number,buttons:number[]=[],axes=[0,0]):PadSnapshot {return {index,id:`SIMULATED-${index}`,connected:true,mapping:'standard',axes,buttons:Array.from({length:17},(_,n)=>({pressed:buttons.includes(n)}))};}
function key(type:string,code:string) {const e=Object.assign(new Event(type,{cancelable:true}),{code,repeat:false});win.dispatchEvent(e);}
test('SIMULATED actual Controls retains keyboard rebind, mouse hold and independent P2 without input alias',()=>{
  const controls=new Controls(()=>{},()=>{});controls.active=true;
  snapshots=[null,null,pad(2),pad(3)];controls.pollGamepads(0);controls.consumeEdges();
  assert.equal(saveBinding('jump','KeyV'),null); // layout reset, same as production
  controls.pollGamepads(1);controls.consumeEdges();key('keydown','KeyV');key('keydown','ArrowRight');
  let frames=controls.sample();assert.equal(frames[0].jump,true);assert.equal(frames[1].moveX,1);assert.equal(frames[0].moveX,0);
  controls.consumeEdges();key('keyup','KeyV');key('keyup','ArrowRight');
  const canvas=new EventTarget() as HTMLCanvasElement;controls.attachPointer(canvas,()=>({x:0.6,y:-0.8}));
  const down=Object.assign(new Event('pointerdown',{cancelable:true}),{pointerType:'mouse',button:0,clientX:100,clientY:100});canvas.dispatchEvent(down);
  frames=controls.sample();assert.equal(frames[0].shoot,true);assert.equal(frames[0].shootHeld,true);assert.equal(frames[0].aimX,0.6);
  controls.consumeEdges();win.dispatchEvent(Object.assign(new Event('pointerup'),{button:0}));
  snapshots=[null,null,pad(2),pad(3,[2])];controls.pollGamepads(2);frames=controls.sample();
  assert.equal(frames[0].shootHeld,false);assert.equal(frames[1].shootHeld,true);assert.equal(frames[0].aimX,0.6,'P2 does not steal P1 mouse');
});
test('SIMULATED actual Controls polls title menu, keeps edges until online send, cancels on disconnect/blur',()=>{
  let pause=0,blur=0;const controls=new Controls(()=>pause++,()=>blur++);const actions:string[]=[];controls.onMenu=a=>actions.push(a);
  snapshots=[pad(5)];controls.pollGamepads(0);snapshots=[pad(5,[0])];controls.pollGamepads(1);assert.deepEqual(actions,['confirm']);
  controls.reset();controls.active=true;snapshots=[pad(5)];controls.pollGamepads(2);controls.consumeEdges();
  snapshots=[pad(5,[2])];controls.pollGamepads(3);assert.equal(controls.sample()[0].shoot,true);
  controls.pollGamepads(4);assert.equal(controls.sample()[0].shoot,true,'edge retained until network tick');
  controls.consumeEdges();assert.equal(controls.sample()[0].shoot,false);
  snapshots=[];controls.pollGamepads(5);assert.equal(controls.sample()[0].cancelShot,true);
  controls.consumeEdges();snapshots=[pad(7)];controls.pollGamepads(6);snapshots=[pad(7,[9])];controls.pollGamepads(7);assert.equal(pause,1);
  win.dispatchEvent(new Event('blur'));assert.equal(blur,1);assert.equal(controls.sample()[0].cancelShot,true);
  controls.consumeEdges();win.dispatchEvent(new Event('focus'));controls.pollGamepads(8);assert.equal(controls.sample()[0].moveX,0);
});
