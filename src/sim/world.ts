import { emptyIntent } from './input.ts';
import type { Intent } from './input.ts';
import { LEVELS } from './level.ts';
import type { Level } from './level.ts';
import { moveFighter } from './physics.ts';
import { stepArrows, updateBow } from './arrows.ts';
import { stepRules, checkStomps } from './rules.ts';
import { think, createBrain } from './bot.ts';
import type { Brain } from './bot.ts';

export const DT = 1 / 120;
export const CHARACTERS = [
  { id: 'mizu', name: 'Mizu', color: '#6497e0', cloth: '#20375d', accent: '#d7b977' },
  { id: 'stormdragon', name: 'Stormdragon', color: '#71e4f3', cloth: '#35465c', accent: '#a7f8ff' },
  { id: 'kaze', name: 'Kaze', color: '#97cf8b', cloth: '#345944', accent: '#e3d19e' },
  { id: 'akane', name: 'Akane', color: '#f38d87', cloth: '#8c3644', accent: '#f4cb99' },
] as const;
export type Difficulty = 'easy' | 'normal' | 'hard';
export interface MatchOptions {
  humans?: number; bots?: number; map?: string; difficulty?: Difficulty; characters?: string[]; seed?: number;
}
export interface Fighter {
  id: number; character: number; human: boolean; x: number; y: number; prevX: number; prevY: number;
  vx: number; vy: number; facing: number; aimX: number; aimY: number; alive: boolean;
  ammo: number; grounded: boolean; wall: number; coyote: number; jumpBuffer: number;
  dashTime: number; dashCooldown: number; invulnerable: number; wallLock: number;
  charging: boolean; charge: number; shotCooldown: number; score: number; kills: number;
  intent: Intent; brain: Brain;
}
export interface Arrow {
  id: number; owner: number; x: number; y: number; vx: number; vy: number;
  angle: number; stuck: boolean; age: number;
}
export interface SimEvent {
  type: 'jump' | 'dash' | 'shoot' | 'impact' | 'catch' | 'pickup' | 'kill' | 'round' | 'victory';
  x: number; y: number; actor: number; target?: number;
}
export interface World {
  level: Level; options: Required<MatchOptions>; fighters: Fighter[]; arrows: Arrow[];
  events: SimEvent[]; phase: 'countdown' | 'playing' | 'roundover' | 'matchover';
  phaseTime: number; roundTime: number; tick: number; round: number; winner: number | null;
  nextArrowId: number; rng: number;
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
    difficulty: ['easy', 'normal', 'hard'].includes(opts.difficulty ?? '') ? opts.difficulty! : 'normal',
    characters: opts.characters ?? ['mizu', 'stormdragon', 'kaze', 'akane'], seed: (opts.seed ?? 1) >>> 0,
  };
  const w: World = {
    level: LEVELS.find(l => l.id === options.map)!, options, fighters: [], arrows: [], events: [],
    phase: 'countdown', phaseTime: 1.2, roundTime: 0, tick: 0, round: 0, winner: null,
    nextArrowId: 1, rng: options.seed || 1,
  };
  for (let id = 0; id < humans + bots; id++) {
    w.fighters.push({
      id, character: Math.max(0, CHARACTERS.findIndex(c => c.id === options.characters[id])), human: id < humans,
      x: 0, y: 0, prevX: 0, prevY: 0, vx: 0, vy: 0, facing: id % 2 ? -1 : 1,
      aimX: 1, aimY: 0, alive: true, ammo: 3, grounded: false, wall: 0, coyote: 0, jumpBuffer: 0,
      dashTime: 0, dashCooldown: 0, invulnerable: 0, wallLock: 0, charging: false, charge: 0,
      shotCooldown: 0, score: 0, kills: 0, intent: emptyIntent(), brain: createBrain(),
    });
  }
  resetRound(w);
  return w;
}
export function resetRound(w: World): void {
  w.round++; w.roundTime = 0; w.phase = 'countdown'; w.phaseTime = 1.2; w.winner = null; w.arrows.length = 0;
  for (const f of w.fighters) {
    const spawn = w.level.spawns[(f.id + w.round - 1) % 4];
    Object.assign(f, {
      x: spawn.x, y: spawn.y, prevX: spawn.x, prevY: spawn.y, vx: 0, vy: 0, alive: true,
      ammo: 3, grounded: false, wall: 0, coyote: 0, jumpBuffer: 0, dashTime: 0, dashCooldown: 0,
      invulnerable: 0, wallLock: 0, charging: false, charge: 0, shotCooldown: 0,
      aimX: f.facing, aimY: 0, brain: createBrain(),
    });
  }
}
/** Exactly one fixed tick. Events live until the next step; consumers must drain after each tick. */
export function step(w: World, intents?: readonly Intent[]): void {
  w.events.length = 0; w.tick++;
  if (w.phase !== 'playing') { stepRules(w); return; }
  w.roundTime += DT;
  for (const f of w.fighters) {
    if (!f.alive) continue;
    const intent = f.human ? (intents?.[f.id] ?? f.intent) : think(w, f);
    moveFighter(w, f, intent);
    updateBow(w, f, intent);
  }
  stepArrows(w);
  checkStomps(w);
  stepRules(w);
}
export function snapshot(w: World) {
  return {
    tick: w.tick, phase: w.phase, round: w.round, roundTime: w.roundTime, winner: w.winner,
    map: w.level.id, seed: w.options.seed,
    fighters: w.fighters.map(f => ({ id: f.id, name: CHARACTERS[f.character].name, human: f.human, x: f.x, y: f.y, vx: f.vx, vy: f.vy, alive: f.alive, ammo: f.ammo, score: f.score, kills: f.kills, grounded: f.grounded, invulnerable: f.invulnerable })),
    arrows: w.arrows.map(a => ({ ...a })),
  };
}
