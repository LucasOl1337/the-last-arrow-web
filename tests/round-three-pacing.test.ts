import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, resetRound, step, DT, COUNTDOWN_SECONDS } from '../src/sim/world.ts';
import { LEVELS } from '../src/sim/level.ts';

// Requested acceptance fixture: one fixed RNG stream per authored arena, not generated input variations.
for (const level of LEVELS) test(`${level.id}: ten rounds / four normal bots / seed 3, <=20% timeouts and no four-second idle tile`, t => {
  const w = createWorld({ humans: 0, bots: 4, difficulty: 'normal', map: level.id, seed: 3 });
  const durations: number[] = [];
  let timeouts = 0, maxIdle = 0, shots = 0, wraps = 0;
  let worst = { round: 0, fighter: 0, tile: '', time: 0 };
  for (let round = 1; round <= 10; round++) {
    if (round > 1) { for (const f of w.fighters) f.score = 0; resetRound(w); }
    const trackers = w.fighters.map(() => ({ tile: '', ticks: 0 }));
    let finished = false;
    for (let tick = 0; tick < Math.ceil((90 + COUNTDOWN_SECONDS + 1) / DT); tick++) {
      const playing = w.phase === 'playing';
      step(w);
      if (playing) for (const f of w.fighters) {
        const tracker = trackers[f.id], tile = `${Math.floor(f.x)},${Math.floor(f.y)}`;
        const fired = w.events.some(e => e.type === 'shoot' && e.actor === f.id);
        if (fired) shots++;
        if (!f.alive || tracker.tile !== tile || fired) tracker.ticks = 0;
        else tracker.ticks++;
        tracker.tile = tile;
        const idle = tracker.ticks * DT;
        if (idle > maxIdle) { maxIdle = idle; worst = { round, fighter: f.id, tile, time: w.roundTime }; }
        if (f.alive && (Math.abs(f.x - f.prevX) > 16 || Math.abs(f.y - f.prevY) > 9)) wraps++;
      }
      if (w.phase === 'roundover' || w.phase === 'matchover') { finished = true; break; }
    }
    assert.ok(finished, `${level.id}, round ${round} must finish`);
    if (w.roundTime >= 90) timeouts++;
    durations.push(Number(w.roundTime.toFixed(3)));
  }
  t.diagnostic(JSON.stringify({ map: level.id, seed: 3, rounds: 10, timeouts, timeoutPercent: timeouts * 10,
    maxIdle: Number(maxIdle.toFixed(3)), worst, shots, wraps, durations }));
  assert.ok(timeouts <= 2, `${level.id}: ${timeouts}/10 timeouts`);
  assert.ok(maxIdle <= 4, `${level.id}: idle ${maxIdle.toFixed(3)} s, ${JSON.stringify(worst)}`);
  assert.ok(wraps > 0, `${level.id}: bots must use wrap routes`);
});
