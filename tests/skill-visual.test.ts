import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skillVisual } from '../src/render/skill-visual.ts';
test('guard uses snapshot origin/radius and vanishes after interception, expiry or death', () => {
  const state = {kind:'water-guard' as const,time:.5,x:4,y:7,charges:1};
  const before = {...state}, visual = skillVisual(state,true)!;
  assert.equal(visual.x,4); assert.equal(visual.y,11); assert.equal(visual.radius,.8);
  assert.deepEqual(state,before);
  assert.equal(skillVisual({...state,charges:0},true),null);
  assert.equal(skillVisual({...state,time:0},true),null);
  assert.equal(skillVisual(state,false),null);
  assert.equal(skillVisual(undefined,true),null);
});
test('gust reads zero-charge snapshots and expands/fades without adding damage or camera shake', () => {
  const state = {kind:'storm-gust' as const,time:.25,x:4,y:7,charges:0};
  const start=skillVisual(state,true)!, end=skillVisual({...state,time:.01},true)!;
  assert.ok(end.radius>start.radius && end.radius<=2.4);
  assert.ok(end.opacity<start.opacity); assert.notEqual(start.color,skillVisual({...state,kind:'water-guard',charges:1},true)!.color);
});
