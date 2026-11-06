import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/sim/world.ts';
import { matchStatus, victorySummary } from '../src/ui/match-copy.ts';
test('headhunter at 26 s shows 94 s and an 18-kill win, never first-to-five or 64 s', () => {
  const w = createWorld({ mode: 'headhunter' }); w.matchTime = w.roundTime = 26;
  assert.equal(matchStatus(w), 'Headhunter · Mais abates / 94s');
  assert.equal(victorySummary('headhunter', 18, true), '18 abates em 2 minutos. A arena é sua.');
  assert.equal(victorySummary('headhunter', 18, false), 'Tempo esgotado. Empate em abates.');
  w.matchTime = 120; assert.equal(matchStatus(w), 'Headhunter · Mais abates / 0s');
});
test('versus retains the five-win rule and 90-second round', () => {
  const w = createWorld(); w.roundTime = 26;
  assert.equal(matchStatus(w), 'Primeiro a 5 / 64s');
  assert.equal(victorySummary('versus', 5, true), 'Cinco vitórias. A arena é sua.');
});
