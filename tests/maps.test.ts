import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, step, DT } from '../src/sim/world.ts';
import { stepRules } from '../src/sim/rules.ts';

test('Templo do Totem / fácil / seed 42: bots finish by combat, not timeout', () => {
  const w = createWorld({ humans: 0, bots: 4, map: 'totem', difficulty: 'easy', seed: 42 });
  let kills = 0, jumps = 0;
  while (w.round === 1 && w.tick < 20 / DT) {
    step(w); for (const event of w.events) { if (event.type === 'kill') kills++; if (event.type === 'jump') jumps++; }
  }
  assert.equal(w.round, 2); assert.equal(kills, 3); assert.ok(jumps > 0);
  assert.equal(w.fighters.reduce((sum, f) => sum + f.score, 0), 1);
});

test('Copas Altas / difícil / seed 42: bots traverse, catch and replenish ammunition', () => {
  const w = createWorld({ humans: 0, bots: 4, map: 'canopy', difficulty: 'hard', seed: 42 });
  const counts = { kill: 0, jump: 0, catch: 0, pickup: 0 };
  while (w.round === 1 && w.tick < 20 / DT) {
    step(w); for (const event of w.events) if (event.type in counts) counts[event.type as keyof typeof counts]++;
  }
  assert.equal(w.round, 2); assert.equal(counts.kill, 3);
  assert.ok(counts.jump >= 3); assert.ok(counts.catch > 0); assert.ok(counts.pickup > 0);
});

test('90-second draw does not award points, then restarts with three arrows', () => {
  const w = createWorld({ humans: 2, bots: 0 }); w.phase = 'playing'; w.roundTime = 90;
  stepRules(w); assert.equal(w.phase, 'roundover'); assert.equal(w.winner, null);
  assert.ok(w.fighters.every(f => f.score === 0));
  w.phaseTime = 0; stepRules(w); assert.equal(w.round, 2); assert.ok(w.fighters.every(f => f.alive && f.ammo === 3));
});
