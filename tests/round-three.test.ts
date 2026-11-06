import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, step, snapshot, DT, COUNTDOWN_SECONDS, HEADHUNTER_SECONDS, RESPAWN_SECONDS } from '../src/sim/world.ts';
import { kill, stepRules } from '../src/sim/rules.ts';
import { think, predictShot } from '../src/sim/bot.ts';
import { LEVELS, WIDTH, HEIGHT, delta, solid, themeOf } from '../src/sim/level.ts';
import { emptyIntent } from '../src/sim/input.ts';
import { moveFighter, HALF_W, HALF_H } from '../src/sim/physics.ts';
import { stepArrows, updateBow } from '../src/sim/arrows.ts';

function arena(mode: 'versus' | 'headhunter' = 'headhunter') {
  const w = createWorld({ humans: 2, bots: 0, mode, difficulty: 'hard' });
  w.phase = 'playing'; w.countdown = 0;
  w.level = { ...w.level, rows: Array(HEIGHT).fill('.'.repeat(WIDTH)) };
  for (const f of w.fighters) Object.assign(f, { x: 4 + f.id * 8, y: 8, invulnerable: 0, vx: 0, vy: 0 });
  return w;
}

test('new arenas are symmetric, have open wrap routes, headroom and reachable platform graphs', () => {
  assert.deepEqual(LEVELS.map(l => l.id), ['moss', 'totem', 'canopy', 'falls', 'roots']);
  assert.equal(themeOf('falls'), 'totem'); assert.equal(themeOf('roots'), 'moss');
  assert.equal(themeOf('canopy'), 'canopy'); assert.equal(themeOf('unknown'), 'moss');
  for (const level of LEVELS) {
    assert.ok(level.rows.every(row => row === [...row].reverse().join('')), level.id);
    for (const spawn of level.spawns) {
      for (const x of [spawn.x - HALF_W, spawn.x + HALF_W])
        for (const y of [spawn.y - HALF_H, spawn.y + HALF_H]) assert.equal(solid(level, x, y), false, `${level.id} spawn headroom`);
    }
    for (const from of level.platforms) {
      const reached = new Set([from.id]), queue = [from.id];
      for (const id of queue) for (const next of level.platforms[id].links) if (!reached.has(next)) { reached.add(next); queue.push(next); }
      assert.equal(reached.size, level.platforms.length, `${level.id}: reach every platform from ${from.id}`);
    }
  }
  for (const id of ['falls', 'roots']) {
    const level = LEVELS.find(l => l.id === id)!;
    assert.equal(level.theme, themeOf(id));
    assert.ok(level.rows.some((row, y) => row[0] === '.' && row[31] === '.' && level.rows[(y + 1) % HEIGHT][0] === '.'));
    assert.ok(Array.from({ length: WIDTH }, (_, x) => x).some(x => level.rows[0][x] === '.' && level.rows[17][x] === '.'));
  }
});

test('roots short tunnel fits a standing fighter and can be crossed without a jump or dash', () => {
  const w = createWorld({ humans: 2, bots: 0, map: 'roots' }), f = w.fighters[0];
  Object.assign(f, { x: 10.5, y: 10.45, vx: 0, vy: 0, grounded: true });
  for (let tick = 0; tick < Math.round(0.5 / DT); tick++) moveFighter(w, f, { ...emptyIntent(), moveX: 1 });
  assert.ok(f.x > 13.5, `must leave the three-tile tunnel, got x=${f.x}`);
});

test('headhunter scores each enemy kill once, not suicide/environment, and does not end at five or last survivor', () => {
  const w = arena(), [a, b] = w.fighters;
  a.score = 4; w.matchTime = 7;
  kill(w, b, a.id); kill(w, b, a.id);
  assert.equal(a.score, 5); assert.equal(a.kills, 1); assert.equal(b.respawnAt, 8.5);
  stepRules(w); assert.equal(w.phase, 'playing'); assert.equal(w.winner, null);
  kill(w, a, a.id); assert.equal(a.score, 5); assert.equal(a.kills, 1);
  stepRules(w); assert.equal(w.phase, 'playing', 'all dead still wait for respawn');
  w.matchTime = 8.5; stepRules(w);
  assert.ok(w.fighters.every(f => f.alive && f.respawnAt === null));
  a.invulnerable = 0; kill(w, a, -1); assert.equal(a.score, 5); assert.equal(b.score, 0);
  assert.equal(createWorld().options.mode, 'versus');
});

test('respawn waits exactly 1.5 active seconds, selects a free distant position and resets only life state', () => {
  const w = createWorld({ humans: 2, bots: 0, mode: 'headhunter', map: 'roots' });
  w.phase = 'playing'; w.countdown = 0; w.matchTime = 10;
  const [victim, enemy] = w.fighters;
  Object.assign(victim, { invulnerable: 0, score: 3, kills: 4, charging: true, charge: 9, dashTime: 0.1, vx: 20 });
  Object.assign(enemy, { x: 0.1, y: 6, invulnerable: 0 });
  kill(w, victim, enemy.id);
  assert.equal(victim.respawnAt, 10 + RESPAWN_SECONDS);
  w.matchTime = victim.respawnAt! - DT; stepRules(w); assert.equal(victim.alive, false);
  const dead = snapshot(w).fighters[victim.id]; assert.equal(dead.respawnAt, 11.5);
  w.matchTime += DT; stepRules(w);
  assert.equal(victim.alive, true); assert.equal(victim.respawnAt, null);
  assert.equal(victim.invulnerable, 1); assert.equal(victim.ammo, 3);
  assert.deepEqual(victim.inventory, ['normal', 'normal', 'normal']);
  assert.equal(victim.score, 3); assert.equal(victim.kills, 4);
  assert.equal(victim.vx, 0); assert.equal(victim.vy, 0); assert.equal(victim.charging, false);
  assert.equal(victim.prevX, victim.x); assert.equal(victim.prevY, victim.y);
  const distance = (x: number, y: number) => Math.hypot(delta(x, enemy.x, WIDTH), delta(y, enemy.y, HEIGHT));
  assert.ok(distance(victim.x, victim.y) >= 8, 'spawn is far even through the wrap seam');
  assert.ok(w.level.spawns.every(s => distance(victim.x, victim.y) >= distance(s.x, s.y)), 'at least as safe as each original spawn');
  for (const x of [victim.x - HALF_W, victim.x + HALF_W])
    for (const y of [victim.y - HALF_H, victim.y + HALF_H]) assert.equal(solid(w.level, x, y), false);
  assert.equal(solid(w.level, victim.x, victim.y + HALF_H + 0.02), true);
});

test('headhunter clock excludes countdown, ends at 120 active seconds and freezes the result', () => {
  const w = createWorld({ humans: 2, bots: 0, mode: 'headhunter' });
  for (let tick = 0; tick < Math.round(COUNTDOWN_SECONDS / DT); tick++) { step(w); assert.equal(w.matchTime, 0); }
  step(w); assert.equal(w.matchTime, DT);
  w.matchTime = HEADHUNTER_SECONDS - DT; w.roundTime = w.matchTime;
  w.fighters[0].score = 7; w.fighters[1].score = 5;
  w.fighters[0].alive = false; w.fighters[0].respawnAt = HEADHUNTER_SECONDS;
  step(w);
  assert.equal(w.matchTime, 120); assert.equal(w.phase, 'matchover'); assert.equal(w.winner, 0);
  assert.equal(w.fighters[0].alive, false, 'no respawn on/after the final whistle');
  assert.deepEqual(w.events.map(e => [e.type, e.actor]), [['victory', 0]]);
  const ended = snapshot(w); step(w);
  assert.equal(w.events.length, 0); assert.equal(w.matchTime, ended.matchTime);
  assert.deepEqual(snapshot(w).fighters, ended.fighters);
  assert.equal(ended.mode, 'headhunter'); assert.equal(ended.matchTime, 120);
});

test('full headhunter match runs one 120-second round with recurring kills, safe simultaneous respawns and deterministic replay', () => {
  const w = createWorld({ humans: 0, bots: 4, map: 'roots', mode: 'headhunter', seed: 3 });
  const replay = createWorld(w.options);
  let kills = 0, respawns = 0;
  for (let tick = 0; tick < Math.round((COUNTDOWN_SECONDS + HEADHUNTER_SECONDS) / DT); tick++) {
    const deadlines = w.fighters.map(f => f.respawnAt);
    step(w); step(replay);
    kills += w.events.filter(e => e.type === 'kill' && e.actor !== e.target).length;
    for (const f of w.fighters) if (deadlines[f.id] !== null && f.alive) {
      respawns++;
      assert.ok(Math.abs(w.matchTime - deadlines[f.id]!) < 1e-8, 'respawn is exactly on the active deadline');
      assert.equal(f.respawnAt, null); assert.equal(f.invulnerable, 1);
      assert.ok(w.fighters.every(other => other === f || !other.alive || Math.hypot(delta(f.x, other.x, WIDTH), delta(f.y, other.y, HEIGHT)) >= 1.5));
    }
  }
  assert.equal(w.phase, 'matchover'); assert.equal(w.round, 1); assert.equal(w.matchTime, 120);
  assert.ok(kills > 10 && respawns > 10, 'combat continues across many lives, without round resets');
  assert.equal(w.fighters.reduce((sum, f) => sum + f.score, 0), kills);
  assert.deepEqual(snapshot(w), snapshot(replay));
});

test('simultaneous respawns reserve distinct supported spots and keep protection against immediate kills', () => {
  const w = createWorld({ humans: 0, bots: 4, mode: 'headhunter', map: 'falls' });
  w.phase = 'playing'; w.countdown = 0;
  for (const f of w.fighters) { f.invulnerable = 0; kill(w, f, -1); }
  w.matchTime = RESPAWN_SECONDS; stepRules(w);
  assert.ok(w.fighters.every(f => f.alive));
  for (const f of w.fighters) {
    for (const other of w.fighters) if (other !== f)
      assert.ok(Math.hypot(delta(f.x, other.x, WIDTH), delta(f.y, other.y, HEIGHT)) >= 1.5);
    kill(w, f, (f.id + 1) % 4); assert.equal(f.alive, true);
  }
});

test('headhunter tied high scores are a draw, never an arbitrary winner', () => {
  const w = arena(); w.matchTime = HEADHUNTER_SECONDS;
  w.fighters[0].score = w.fighters[1].score = 3;
  stepRules(w); assert.equal(w.phase, 'matchover'); assert.equal(w.winner, null);
  assert.equal(w.events[0].actor, -1);
});

test('bots never select a protected target and cancel a drawn shot when protection starts', () => {
  const w = createWorld({ humans: 0, bots: 4 });
  const f = w.fighters[0];
  assert.deepEqual(think(w, f), emptyIntent()); assert.equal(f.brain.target, -1);
  w.phase = 'playing';
  Object.assign(f, { x: 5, y: 4, invulnerable: 0 });
  Object.assign(w.fighters[1], { x: 6, y: 4, invulnerable: 1 });
  Object.assign(w.fighters[2], { x: 9, y: 4, invulnerable: 0 });
  w.fighters[3].alive = false;
  think(w, f); assert.equal(f.brain.target, 2, 'skip closer spawn-protected fighter');
  f.charging = true; f.brain.hold = 0.1; w.fighters[2].invulnerable = 0.15;
  const i = think(w, f);
  assert.equal(f.brain.target, -1); assert.equal(f.charging, false);
  assert.equal(i.shoot, false); assert.equal(i.shootHeld, false);
  updateBow(w, f, i); assert.equal(w.arrows.length, 0); assert.equal(f.ammo, 3);
  w.phase = 'countdown'; assert.deepEqual(think(w, f), emptyIntent());
});

test('hard bot drops for a stomp from above instead of firing, but does not stomp through a floor', () => {
  const w = arena('versus'), [f, target] = w.fighters;
  Object.assign(f, { x: 12, y: 6, vy: 3, grounded: false, charging: true });
  Object.assign(target, { x: 12, y: 8 });
  Object.assign(f.brain, { ready: true, target: 1, hold: 0.1, shootTimer: -1, travelled: 5 });
  const i = { ...think(w, f) };
  assert.equal(i.moveY, 1); assert.equal(i.moveX, 0); assert.equal(i.shoot, false);
  assert.equal(i.jumpHeld, false); assert.equal(f.charging, false);
  updateBow(w, f, i); assert.equal(w.arrows.length, 0);
  const rows = [...w.level.rows]; rows[7] = '#'.repeat(WIDTH); w.level = { ...w.level, rows };
  f.charging = true; f.brain.hold = 0.1;
  think(w, f); assert.equal(f.charging, true, 'a blocked drop must not cancel the bow for a stomp');
});

test('hard shot predictor follows falling-target physics and its eight-way shot hits in the real integrator', () => {
  const w = arena('versus'), [f, target] = w.fighters;
  Object.assign(f, { x: 5, y: 8 }); Object.assign(target, { x: 12, y: 6.5, vx: 0, vy: 0 });
  const before = snapshot(w), prediction = predictShot(w, f, target);
  assert.ok(prediction); assert.deepEqual(snapshot(w), before, 'prediction has no simulation side effects');
  assert.equal(prediction.aimX, 1); assert.equal(prediction.aimY, 0, 'lead accounts for target gravity, not only current velocity');
  f.aimX = prediction.aimX; f.aimY = prediction.aimY;
  updateBow(w, f, { ...emptyIntent(), shoot: true });
  for (let tick = 0; tick < Math.ceil(prediction.time / DT) + 1 && target.alive; tick++) {
    moveFighter(w, target, emptyIntent()); stepArrows(w);
  }
  assert.equal(target.alive, false);
});

test('hard prediction respects walls for normal/bomb arrows, piercing bolts and horizontal wrap', () => {
  const w = arena('versus'), [f, target] = w.fighters;
  Object.assign(f, { x: 5, y: 8 }); Object.assign(target, { x: 12, y: 6 });
  w.level = { ...w.level, rows: Array(HEIGHT).fill('........#.......................') };
  assert.equal(predictShot(w, f, target), null);
  f.inventory = ['bomb']; assert.equal(predictShot(w, f, target), null);
  f.inventory = ['bolt']; assert.ok(predictShot(w, f, target));
  w.level = { ...w.level, rows: Array(HEIGHT).fill('.'.repeat(WIDTH)) };
  Object.assign(f, { x: 30, y: 8 }); Object.assign(target, { x: 3, y: 7.3 });
  f.inventory = ['normal']; const across = predictShot(w, f, target);
  assert.ok(across); assert.equal(across.aimX, 1);
});
