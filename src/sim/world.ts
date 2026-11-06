import { emptyIntent } from './input.ts';
import type { Intent } from './input.ts';
import { LEVELS, delta, solid, WIDTH, HEIGHT } from './level.ts';
import type { Level } from './level.ts';
import { moveFighter, HALF_W, HALF_H } from './physics.ts';
import { stepArrows, updateBow } from './arrows.ts';
import { stepRules, checkStomps } from './rules.ts';
import { think, createBrain } from './bot.ts';
import type { Brain } from './bot.ts';
import { stepChests, CHEST_INTERVAL } from './treasure.ts';

export const DT = 1 / 120;
export const COUNTDOWN_SECONDS = 1.2;
export const SPAWN_PROTECTION = 1;
export const HEADHUNTER_SECONDS = 120;
export const RESPAWN_SECONDS = 1.5;
export const CHARACTERS = [
  { id: 'mizu', name: 'Mizu', color: '#6497e0', cloth: '#20375d', accent: '#d7b977' },
  { id: 'stormdragon', name: 'Stormdragon', color: '#71e4f3', cloth: '#35465c', accent: '#a7f8ff' },
  { id: 'kaze', name: 'Kaze', color: '#97cf8b', cloth: '#345944', accent: '#e3d19e' },
  { id: 'akane', name: 'Akane', color: '#f38d87', cloth: '#8c3644', accent: '#f4cb99' },
] as const;
export type Difficulty = 'easy' | 'normal' | 'hard';
export type ArrowKind = 'normal' | 'bolt' | 'bomb';
export interface Chest { id: number; x: number; y: number; reward: ArrowKind[] }
export interface MatchOptions {
  humans?: number; bots?: number; map?: string; difficulty?: Difficulty; characters?: string[]; seed?: number;
  mode?: 'versus' | 'headhunter';
}
export interface Fighter {
  id: number; character: number; human: boolean; x: number; y: number; prevX: number; prevY: number;
  vx: number; vy: number; facing: number; aimX: number; aimY: number; alive: boolean;
  ammo: number; grounded: boolean; wall: number; coyote: number; jumpBuffer: number;
  dashTime: number; dashCooldown: number; invulnerable: number; wallLock: number;
  charging: boolean; charge: number; shotCooldown: number; score: number; kills: number;
  intent: Intent; brain: Brain;
  /** Active match-time deadline while dead in headhunter; null otherwise. */
  respawnAt: number | null;
  /** FIFO quiver. Optional for older consumers; ammo remains its numeric mirror. */
  inventory?: ArrowKind[];
  crouching?: boolean;
}
export interface Arrow {
  id: number; owner: number; x: number; y: number; vx: number; vy: number;
  angle: number; stuck: boolean; age: number;
  kind?: ArrowKind;
  /** A piercing bolt damages each fighter at most once. */
  hitTargets?: number[];
  /** Last open point before a piercing bolt entered terrain; used when it expires. */
  lastFreeX?: number; lastFreeY?: number;
}
export interface SimEvent {
  type: 'jump' | 'dash' | 'shoot' | 'impact' | 'catch' | 'pickup' | 'kill' | 'round' | 'victory' | 'chest-spawn' | 'chest-open' | 'explosion';
  x: number; y: number; actor: number; target?: number;
  kind?: ArrowKind; radius?: number; chestId?: number; reward?: ArrowKind[];
  cause?: 'arrow' | 'bolt' | 'bomb' | 'stomp';
}
export interface World {
  level: Level; options: Required<MatchOptions>; fighters: Fighter[]; arrows: Arrow[];
  events: SimEvent[]; phase: 'countdown' | 'playing' | 'roundover' | 'matchover';
  phaseTime: number; roundTime: number; tick: number; round: number; winner: number | null;
  /** Elapsed active seconds, excluding countdown/inter-round freezes; capped at 120 in headhunter. */
  matchTime: number;
  nextArrowId: number; rng: number;
  /** UI digit: 3, 2, 1 during the 1.2 s freeze; 0 otherwise. */
  countdown?: number;
  chests?: Chest[]; chestTimer?: number; nextChestId?: number;
}
export function random(w: World): number {
  let n = w.rng; n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
  w.rng = n >>> 0;
  return w.rng / 4294967296;
}
export function createWorld(opts: MatchOptions = {}): World {
  const humans = Math.max(0, Math.min(2, Math.floor(opts.humans ?? 1)));
  const bots = Math.max(2 - humans, Math.min(4 - humans, Math.floor(opts.bots ?? 3)));
  const options: Required<MatchOptions> = {
    humans, bots, map: LEVELS.find(l => l.id === opts.map)?.id ?? 'moss',
    mode: opts.mode === 'headhunter' ? 'headhunter' : 'versus',
    difficulty: ['easy', 'normal', 'hard'].includes(opts.difficulty ?? '') ? opts.difficulty! : 'normal',
    characters: opts.characters ?? ['mizu', 'stormdragon', 'kaze', 'akane'], seed: (opts.seed ?? 1) >>> 0,
  };
  const w: World = {
    level: LEVELS.find(l => l.id === options.map)!, options, fighters: [], arrows: [], events: [],
    phase: 'countdown', phaseTime: COUNTDOWN_SECONDS, roundTime: 0, matchTime: 0, tick: 0, round: 0, winner: null,
    nextArrowId: 1, rng: options.seed || 1, nextChestId: 1,
  };
  for (let id = 0; id < humans + bots; id++) {
    w.fighters.push({
      id, character: Math.max(0, CHARACTERS.findIndex(c => c.id === options.characters[id])), human: id < humans,
      x: 0, y: 0, prevX: 0, prevY: 0, vx: 0, vy: 0, facing: id % 2 ? -1 : 1,
      aimX: 1, aimY: 0, alive: true, ammo: 3, grounded: false, wall: 0, coyote: 0, jumpBuffer: 0,
      dashTime: 0, dashCooldown: 0, invulnerable: 0, wallLock: 0, charging: false, charge: 0,
      shotCooldown: 0, score: 0, kills: 0, respawnAt: null, intent: emptyIntent(), brain: createBrain(),
    });
  }
  resetRound(w);
  return w;
}
function placeFighter(f: Fighter, spawn: { x: number; y: number }): void {
  Object.assign(f, {
    x: spawn.x, y: spawn.y, prevX: spawn.x, prevY: spawn.y, vx: 0, vy: 0, alive: true,
    ammo: 3, grounded: false, wall: 0, coyote: 0, jumpBuffer: 0, dashTime: 0, dashCooldown: 0,
    invulnerable: SPAWN_PROTECTION, wallLock: 0, charging: false, charge: 0, shotCooldown: 0,
    aimX: f.facing, aimY: 0, intent: emptyIntent(), brain: createBrain(), respawnAt: null,
    inventory: ['normal', 'normal', 'normal'], crouching: false,
  });
}
/** Maximise distance to the nearest living enemy using toroidal, not screen, distance. */
export function respawnFighter(w: World, f: Fighter): void {
  const candidates = [...w.level.spawns];
  for (const p of w.level.platforms) for (let x = p.left + 0.5; x < p.right; x++) {
    candidates.push({ x, y: p.y - HALF_H - 0.01 });
  }
  const enemies = w.fighters.filter(other => other !== f && other.alive);
  let best: { x: number; y: number } | undefined, bestDistance = -1;
  for (const spot of candidates) {
    let blocked = false;
    for (let y = Math.floor(spot.y - HALF_H); y <= Math.floor(spot.y + HALF_H); y++)
      for (let x = Math.floor(spot.x - HALF_W); x <= Math.floor(spot.x + HALF_W); x++)
        if (solid(w.level, x, y)) blocked = true;
    if (blocked) continue;
    const distance = Math.min(...enemies.map(other => Math.hypot(delta(spot.x, other.x, WIDTH), delta(spot.y, other.y, HEIGHT))));
    if (distance < 1.5 || distance <= bestDistance) continue;
    best = spot; bestDistance = distance;
  }
  // If every supported position is occupied, keep the deadline and retry next tick.
  if (best) placeFighter(f, best);
}
export function resetRound(w: World): void {
  w.round++; w.roundTime = 0; w.phase = 'countdown'; w.phaseTime = COUNTDOWN_SECONDS;
  w.countdown = 3; w.winner = null; w.arrows.length = 0;
  w.chests = []; w.chestTimer = CHEST_INTERVAL;
  for (const f of w.fighters) {
    const spawn = w.level.spawns[(f.id + w.round - 1) % 4];
    placeFighter(f, spawn);
  }
}
/** Exactly one fixed tick. Events live until the next step; consumers must drain after each tick. */
export function step(w: World, intents?: readonly Intent[]): void {
  w.events.length = 0; w.tick++;
  if (w.phase !== 'playing') { stepRules(w); return; }
  w.roundTime += DT;
  w.matchTime = w.options.mode === 'headhunter' ? Math.min(HEADHUNTER_SECONDS, w.matchTime + DT) : w.matchTime + DT;
  for (const f of w.fighters) {
    if (!f.alive) continue;
    const intent = f.human ? (intents?.[f.id] ?? f.intent) : think(w, f);
    moveFighter(w, f, intent);
    updateBow(w, f, intent);
  }
  stepArrows(w);
  checkStomps(w);
  stepChests(w);
  stepRules(w);
}
export function snapshot(w: World) {
  return {
    tick: w.tick, phase: w.phase, countdown: w.countdown ?? 0, round: w.round, roundTime: w.roundTime, winner: w.winner,
    mode: w.options.mode, matchTime: w.matchTime,
    chests: (w.chests ?? []).map(c => ({ ...c, reward: [...c.reward] })), chestTimer: w.chestTimer,
    map: w.level.id, seed: w.options.seed,
    fighters: w.fighters.map(f => ({ id: f.id, name: CHARACTERS[f.character].name, human: f.human, x: f.x, y: f.y, vx: f.vx, vy: f.vy, alive: f.alive, respawnAt: f.respawnAt, ammo: f.ammo, score: f.score, kills: f.kills, grounded: f.grounded, invulnerable: f.invulnerable, inventory: f.inventory ? [...f.inventory] : undefined })),
    arrows: w.arrows.map(a => ({ ...a, hitTargets: a.hitTargets ? [...a.hitTargets] : undefined })),
    events: w.events.map(e => ({ ...e, reward: e.reward ? [...e.reward] : undefined })),
  };
}
