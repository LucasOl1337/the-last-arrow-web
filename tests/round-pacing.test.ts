import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, resetRound, step, DT, COUNTDOWN_SECONDS } from '../src/sim/world.ts';

test('20 rounds normal / moss / seed 3: 8–20 s on average, catches and opened treasure', t => {
  const w = createWorld({ humans: 0, bots: 4, map: 'moss', difficulty: 'normal', seed: 3 });
  const durations: number[] = [];
  const counts = { catch: 0, 'chest-open': 0, 'chest-spawn': 0, jump: 0, dash: 0, kill: 0, shoot: 0, wrap: 0 };
  for (let round = 0; round < 20; round++) {
    if (round) {
      // Continue the same RNG stream/spawn rotation; scores alone don't affect bot decisions.
      for (const f of w.fighters) f.score = 0;
      resetRound(w);
    }
    let finished = false;
    for (let tick = 0; tick < (90 + COUNTDOWN_SECONDS + 1) / DT; tick++) {
      step(w);
      for (const event of w.events) if (event.type in counts) counts[event.type as keyof typeof counts]++;
      for (const f of w.fighters) if (f.alive && (Math.abs(f.x - f.prevX) > 16 || Math.abs(f.y - f.prevY) > 9)) counts.wrap++;
      if (w.phase === 'roundover' || w.phase === 'matchover') { finished = true; break; }
    }
    assert.ok(finished, `round ${round + 1} must finish`);
    assert.notEqual(w.winner, null, `round ${round + 1} must end by combat, not timeout/draw`);
    durations.push(w.roundTime);
  }
  const mean = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
  t.diagnostic(JSON.stringify({ seed: 3, rounds: durations.length, activeMean: mean, withCountdownMean: mean + COUNTDOWN_SECONDS,
    durations: durations.map(n => Number(n.toFixed(3))), counts }));
  assert.ok(mean >= 8 && mean <= 20, `mean active round length ${mean.toFixed(3)} s must be 8–20 s`);
  assert.ok(counts.catch >= 1, 'bots must catch a live arrow with a dash');
  assert.ok(counts['chest-open'] >= 1, 'bots must find and open spawned treasure');
  assert.ok(counts.jump >= 20 && counts.dash >= 20 && counts.wrap > 0, 'bots must traverse, evade and wrap');
});
