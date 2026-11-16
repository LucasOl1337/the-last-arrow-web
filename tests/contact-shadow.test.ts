import test from 'node:test';
import assert from 'node:assert/strict';
import { contactShadow } from '../src/render/contact-shadow.ts';
import { LEVELS, WIDTH, HEIGHT } from '../src/sim/level.ts';
import { bodyHalfHeight } from '../src/sim/body.ts';
const moss = LEVELS.find(l=>l.id==='moss')!;

test('real moss edge clips the receiver instead of painting the void',()=>{
  const s=contactShadow(moss,6.9,5)!;
  assert.ok(s); assert.equal(s.right,7); assert.ok(s.u1<1); assert.ok(s.left>=2);
});
test('real bottom seam projects onto the canonical top platform',()=>{
  const s=contactShadow(moss,16,17.55)!;
  assert.equal(s.y,HEIGHT-3+.02); assert.ok(s.opacity>0 && s.opacity<.75);
});
test('wall/interpolated penetration is not a receiving top face',()=>{
  assert.equal(contactShadow(moss,6.9,5.75),null);
});
test('flat floor, jump and fall retain a bounded fading contact',()=>{
  const floor=contactShadow(moss,4.5,5)!;
  assert.equal(floor.opacity,.75); assert.ok(floor.z+floor.depth/2<=.42);
  const air=contactShadow(moss,4.5,3)!;
  assert.ok(air.opacity<floor.opacity); assert.ok(air.depth<floor.depth);
  const falling=contactShadow(moss,4.5,4)!;
  assert.ok(falling.opacity>air.opacity && falling.opacity<floor.opacity);
});
test('crouch uses the same feet; death fades out; empty column has no shadow',()=>{
  const standingFeet=4.45+bodyHalfHeight({crouching:false});
  const crouchingFeet=4.7+bodyHalfHeight({crouching:true});
  assert.deepEqual(contactShadow(moss,4.5,standingFeet),contactShadow(moss,4.5,crouchingFeet));
  assert.equal(contactShadow(moss,4.5,5,0),null);
  assert.equal(contactShadow(moss,4.5,5,.5)!.opacity,.375);
  assert.equal(contactShadow(moss,16,5),null);
});
test('horizontal interpolated wrap is canonical; buried tile is not a top',()=>{
  const s=contactShadow(moss,WIDTH+.1,10)!;
  assert.ok(s.x>=0 && s.x<WIDTH); assert.ok(s.left>=0);
  const rows=Array.from({length:HEIGHT},()=>'.'.repeat(WIDTH));
  rows[4]=rows[5]='####'+'.'.repeat(WIDTH-4);
  assert.equal(contactShadow({...moss,rows},2,5),null);
});
test('negative interpolated seam coordinates can receive on the last row',()=>{
  const rows=Array.from({length:HEIGHT},()=>'.'.repeat(WIDTH));
  rows[HEIGHT-1]='####'+'.'.repeat(WIDTH-4);
  const s=contactShadow({...moss,rows},2,-1)!;
  assert.ok(s);assert.equal(s.y,1.02);assert.equal(s.opacity,.75);
});
