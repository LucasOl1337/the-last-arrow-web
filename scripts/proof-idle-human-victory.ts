// Exact seed-7 regression on the deployed server's own simulation, without world injection.
// Online rooms are two humans/no bots; do not claim a WebSocket bot match.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createWorld, step, DT } from '../src/sim/world.ts';

const w = createWorld({ humans: 1, bots: 3, seed: 7 });
const results: { tick: number; type: string; actor: number; scores: number[] }[] = [];
let kills = 0;
for (let tick = 0; tick < 300 / DT && w.phase !== 'matchover'; tick++) {
  step(w); // Never send a human intent or overwrite runtime state.
  for (const event of w.events) {
    if (event.type === 'kill') kills++;
    if (event.type === 'round' || event.type === 'victory') results.push({ tick: w.tick, type: event.type, actor: event.actor, scores: w.fighters.map(f => f.score) });
  }
}
assert.equal(w.phase, 'matchover');
assert.ok(w.fighters.some(f => !f.human && f.score === 5));
const hash = (file: string) => createHash('sha256').update(readFileSync(new URL(file, import.meta.url))).digest('hex');
console.log(JSON.stringify({
  proof: 'deployed-simulation-exact-case', websocketBotMatch: false, humanInputsSent: 0,
  options: w.options, phase: w.phase, tick: w.tick, seconds: w.tick * DT, winner: w.winner,
  kills, results, fighters: w.fighters.map(f => ({ id: f.id, human: f.human, score: f.score })),
  sourceHashes: { bot: hash('../src/sim/bot.ts'), world: hash('../src/sim/world.ts'), level: hash('../src/sim/level.ts') },
}));
