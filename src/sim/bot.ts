import { DT, random } from './world.ts';
import type { World, Fighter, Chest } from './world.ts';
import { emptyIntent, clearIntent } from './input.ts';
import type { Intent } from './input.ts';
import { delta, wrap, solid, platformAt, nextPlatform, WIDTH, HEIGHT } from './level.ts';
import { ARROW_GRAVITY, ARROW_SPEED, BOLT_GRAVITY, BOMB_RADIUS } from './arrows.ts';
import { moveFighter } from './physics.ts';
import { STORM_GUST_RADIUS } from './skills.ts';
export interface Brain {
  intent: Intent; reaction: number; target: number; aimError: number; shootTimer: number;
  hold: number; jumpHold: number; stuck: number; lastX: number; lastY: number;
  navigation: number; waypointX: number; waypointY: number; escape: number;
  planTime: number; patrol: number; travelled: number; shots: number; ready: boolean;
  threatId: number; threatTime: number; drawX: number; drawY: number;
}
export function createBrain(): Brain {
  return { intent: emptyIntent(), reaction: 0, target: -1, aimError: 0, shootTimer: 0.3,
    hold: 0, jumpHold: 0, stuck: 0, lastX: 0, lastY: 0, navigation: 0, waypointX: 0, waypointY: 0, escape: 0,
    planTime: 0, patrol: -1, travelled: 0, shots: 0, ready: false, threatId: -1, threatTime: 0, drawX: 1, drawY: 0 };
}
// Character, not spawn slot: the same opponent keeps its habits between rounds.
const styles = [
  { route: 'roam', chestRange: 6 },    // Mizu: balanced wanderer
  { route: 'press', chestRange: 3 },   // Storm: closes on opponents
  { route: 'high', chestRange: 4 },    // Kaze: takes the higher flank
  { route: 'supply', chestRange: 12 }, // Akane: hunts treasure
] as const;
const tuning = {
  easy: { reaction: 0.36, error: 0.25, delay: 1.9, dodge: 2.2, opening: 3.2, range: 8, draw: 0.44 },
  normal: { reaction: 0.24, error: 0.13, delay: 1.45, dodge: 3.2, opening: 2.6, range: 10, draw: 0.28 },
  hard: { reaction: 0.08, error: 0.035, delay: 0.85, dodge: 4.5, opening: 1.5, range: 15, draw: 0.12 },
};
function clearShot(w: World, f: Fighter, dx: number, dy: number, time: number): boolean {
  if (f.inventory?.[0] === 'bolt') return true;
  for (let t = 0.025; t < time; t += 0.025) {
    if (solid(w.level, f.x + dx * ARROW_SPEED * t, f.y + dy * ARROW_SPEED * t + ARROW_GRAVITY * t * t / 2)) return false;
  }
  return true;
}
/** Predict only observed motion, with the same gravity, wall collision and wrap as gameplay. */
export function predictShot(w: World, f: Fighter, target: Fighter): { aimX: number; aimY: number; time: number } | null {
  const ghost = { ...target, skill: target.skill ? { ...target.skill } : undefined }, sandbox = { ...w, events: [] };
  const motion = { ...emptyIntent(), moveX: Math.abs(target.vx) < 0.01 ? 0 : Math.sign(target.vx), jumpHeld: target.vy < 0 };
  const kind = f.inventory?.[0] ?? 'normal', gravity = kind === 'bolt' ? BOLT_GRAVITY : ARROW_GRAVITY;
  const rays = Array.from({ length: 8 }, (_, index) => {
    const angle = index * Math.PI / 4, aimX = Math.cos(angle), aimY = Math.sin(angle);
    return { aimX, aimY, x: f.x + aimX * 0.22, y: f.y + aimY * 0.22, vx: aimX * ARROW_SPEED, vy: aimY * ARROW_SPEED, blocked: false };
  });
  for (let tick = 1; tick <= Math.ceil(tuning.hard.range / ARROW_SPEED / DT); tick++) {
    moveFighter(sandbox, ghost, motion);
    for (const ray of rays) {
      if (ray.blocked) continue;
      ray.vy += gravity * DT;
      const samples = Math.max(1, Math.ceil(Math.hypot(ray.vx, ray.vy) * DT / 0.12));
      for (let n = 0; n < samples; n++) {
        ray.x = wrap(ray.x + ray.vx * DT / samples, WIDTH); ray.y = wrap(ray.y + ray.vy * DT / samples, HEIGHT);
        if (kind !== 'bolt' && solid(w.level, ray.x, ray.y)) { ray.blocked = true; break; }
        if (Math.abs(delta(ray.x, ghost.x, WIDTH)) <= 0.39 && Math.abs(delta(ray.y, ghost.y, HEIGHT)) <= 0.58)
          return { aimX: ray.aimX, aimY: ray.aimY, time: tick * DT };
      }
    }
    if (rays.every(ray => ray.blocked)) break;
  }
  return null;
}
/** Refuse an immediate self-blast, including a wall that moved into the aim lane while drawing. */
function safeBombShot(w: World, f: Fighter, aimX: number, aimY: number): boolean {
  let x = f.x + aimX * 0.22, y = f.y + aimY * 0.22, vy = aimY * ARROW_SPEED;
  const vx = aimX * ARROW_SPEED;
  for (let tick = 0; tick < 24; tick++) {
    vy += ARROW_GRAVITY * DT;
    const samples = Math.max(1, Math.ceil(Math.hypot(vx, vy) * DT / 0.12));
    for (let n = 0; n < samples; n++) {
      x = wrap(x + vx * DT / samples, WIDTH); y = wrap(y + vy * DT / samples, HEIGHT);
      const impact = solid(w.level, x, y) || w.fighters.some(other => other !== f && other.alive &&
        Math.abs(delta(x, other.x, WIDTH)) <= 0.39 && Math.abs(delta(y, other.y, HEIGHT)) <= 0.58);
      if (impact) return Math.hypot(delta(x, f.x, WIDTH), delta(y, f.y, HEIGHT)) > BOMB_RADIUS + 0.4;
    }
  }
  return true;
}
export function think(w: World, f: Fighter): Intent {
  const b = f.brain, i = b.intent, settings = tuning[w.options.difficulty], style = styles[f.character];
  clearIntent(i);
  if (w.phase !== 'playing' || !f.alive) { b.target = -1; b.hold = 0; f.charging = false; return i; }
  const targetable = (target?: Fighter): target is Fighter => !!target && target !== f && target.alive && target.invulnerable <= 0;
  // Cancel a pending release as soon as its target dies or enters spawn/dash protection.
  if (!targetable(w.fighters[b.target])) {
    if (b.target >= 0) b.reaction = 0;
    b.target = -1; b.hold = 0; f.charging = false;
  }
  if (!b.ready) {
    b.ready = true; b.lastX = f.x; b.lastY = f.y;
    b.shootTimer = settings.opening + random(w) * 1.2;
  }
  b.reaction -= DT; b.navigation -= DT; b.shootTimer -= DT; b.planTime -= DT;
  b.jumpHold = Math.max(0, b.jumpHold - DT); b.escape = Math.max(0, b.escape - DT);
  if (b.reaction <= 0) {
    b.reaction = settings.reaction;
    b.aimError = (random(w) - 0.5) * settings.error;
    let nearest = Infinity;
    for (const target of w.fighters) {
      if (!targetable(target)) continue;
      const d = Math.hypot(delta(f.x, target.x, WIDTH), delta(f.y, target.y, HEIGHT));
      if (d < nearest) { nearest = d; b.target = target.id; }
    }
    const moved = Math.hypot(delta(b.lastX, f.x, WIDTH), delta(b.lastY, f.y, HEIGHT));
    b.stuck = moved < 0.16 ? b.stuck + settings.reaction : 0;
    b.travelled += moved;
    b.lastX = f.x; b.lastY = f.y;
  }
  const target = w.fighters[b.target];
  // Commit to another platform while reloading/repositioning, rather than camping a firing lane.
  if (b.planTime <= 0 || b.patrol < 0) {
    const from = platformAt(w.level, f.x, f.y);
    const candidates = from.links.filter(id => id !== b.patrol);
    b.patrol = candidates.length ? candidates[Math.floor(random(w) * candidates.length)] : from.id;
    if (target && style.route !== 'roam' && style.route !== 'supply' && candidates.length) {
      const score = (id: number) => {
        const p = w.level.platforms[id], x = (p.left + p.right) / 2;
        const approach = Math.abs(delta(x, target.x, WIDTH)) + Math.abs(delta(p.y - 0.55, target.y, HEIGHT));
        return style.route === 'high' ? p.y * 2 + approach * 0.2 : approach;
      };
      b.patrol = candidates.reduce((best, id) => score(id) < score(best) ? id : best);
    }
    b.planTime = 1.4 + random(w) * 1.1; b.navigation = 0;
  }
  const patrol = w.level.platforms[b.patrol];
  let goalX = target?.x ?? (patrol.left + patrol.right) / 2, goalY = target?.y ?? patrol.y - 0.55;
  if (f.ammo > 0 && (b.shootTimer > 0.45 || b.travelled < 2.5)) {
    goalX = (patrol.left + patrol.right) / 2; goalY = patrol.y - 0.55;
  }
  const chest = w.chests?.reduce<Chest | undefined>((best, c) => {
    const distance = (x: number, y: number) => Math.abs(delta(f.x, x, WIDTH)) + Math.abs(delta(f.y, y, HEIGHT));
    return !best || distance(c.x, c.y) < distance(best.x, best.y) ? c : best;
  }, undefined);
  const seekChest = !!chest && (f.ammo === 0 || Math.hypot(delta(f.x, chest.x, WIDTH), delta(f.y, chest.y, HEIGHT)) <= style.chestRange);
  if (seekChest) { goalX = chest.x; goalY = chest.y; }
  else if (f.ammo === 0) {
    let best = Infinity;
    for (const a of w.arrows) if (a.stuck) {
      const d = Math.abs(delta(f.x, a.x, WIDTH)) + Math.abs(delta(f.y, a.y, HEIGHT));
      if (d < best) { best = d; goalX = a.x; goalY = a.y; }
    }
  }
  const goalDX = delta(f.x, goalX, WIDTH), goalDY = delta(f.y, goalY, HEIGHT);
  if (b.navigation <= 0) {
    b.navigation = 0.24;
    const from = platformAt(w.level, f.x, f.y), to = platformAt(w.level, goalX, goalY);
    if (from.id === to.id || Math.hypot(goalDX, goalDY) < 4) { b.waypointX = goalX; b.waypointY = goalY; }
    else {
      const next = nextPlatform(w.level, from.id, to.id);
      // A high platform linked from the bottom is reached by falling through Y wrap,
      // not by attempting a jump taller than the entire jump envelope.
      const nextY = next.y + (from.y - next.y > 12 ? HEIGHT : 0);
      // Descend via an actual edge, not by pressing down into a solid tile.
      if (nextY > from.y && f.grounded) {
        // Edge platforms can be one continuous ledge through the wrap seam.
        // Choose its nearest physical exit; aiming toward the platform below flips
        // direction at the seam and makes unarmed bots oscillate without descending.
        let left = from.left, right = from.right;
        for (let n = 0; n < WIDTH && solid(w.level, left - 0.01, from.y); n++) left--;
        for (let n = 0; n < WIDTH && solid(w.level, right + 0.01, from.y); n++) right++;
        left = wrap(left - 0.7, WIDTH); right = wrap(right + 0.7, WIDTH);
        b.waypointX = Math.abs(delta(f.x, left, WIDTH)) < Math.abs(delta(f.x, right, WIDTH)) ? left : right;
        b.waypointY = nextY - 0.55;
      } else { b.waypointX = (next.left + next.right) / 2; b.waypointY = nextY - 0.55; }
    }
  }
  const dx = delta(f.x, b.waypointX, WIDTH), dy = b.waypointY - f.y;
  i.moveX = Math.abs(dx) > 0.25 ? Math.sign(dx) : Math.sign(goalDX);
  // Don't keep jumping above a chest on a lower platform; descend via the waypoint edge.
  if (f.grounded && ((dy < -0.8 && Math.abs(dx) < 7) || (!seekChest && Math.abs(goalDX) < 2.2 && Math.abs(goalDY) < 1))) {
    i.jump = true; b.jumpHold = 0.55;
  }
  if (f.wall && b.jumpHold < 0.15) { i.jump = true; b.jumpHold = 0.48; }
  if (goalDY > 2 && Math.abs(goalDX) < 1.2 && !f.grounded) { i.moveY = 1; i.moveX = 0; }
  if (b.stuck > 0.7) { b.escape = 0.5; b.stuck = 0; i.jump = true; b.jumpHold = 0.6; }
  if (b.escape > 0) { i.moveX = f.wall ? -f.wall : (f.id % 2 ? 1 : -1); i.dash = f.dashCooldown <= 0; }
  i.jumpHeld = b.jumpHold > 0;

  // A polling interval is not reaction latency: easy/normal must actually have seen
  // this incoming arrow for 360/240 ms. A newly spawned close shot cannot be caught instantly.
  let threat = -1;
  for (const a of w.arrows) {
    if (a.stuck || (a.owner === f.id && a.age < 0.18)) continue;
    const ax = delta(f.x, a.x, WIDTH), ay = delta(f.y, a.y, HEIGHT);
    const vx = a.vx - f.vx, vy = a.vy - f.vy, speed2 = vx * vx + vy * vy;
    const time = speed2 ? -(ax * vx + ay * vy) / speed2 : -1;
    if (time <= 0 || time >= 0.65 || Math.hypot(ax + vx * time, ay + vy * time) >= 0.85 || Math.hypot(ax, ay) >= 12) continue;
    let visible = true;
    if (a.kind !== 'bolt') for (let t = 0.1; t < 1; t += 0.1) {
      if (solid(w.level, f.x + ax * t, f.y + ay * t)) { visible = false; break; }
    }
    if (!visible) continue;
    threat = a.id;
    b.threatTime = b.threatId === threat ? b.threatTime + DT : 0;
    b.threatId = threat;
    const reacted = w.options.difficulty === 'hard'
      ? b.reaction >= settings.reaction - DT * 1.5 : b.threatTime + 1e-9 >= settings.reaction;
    if (reacted && f.dashCooldown <= 0 && time < 0.24 && Math.hypot(ax, ay) < settings.dodge) {
      i.dash = true; i.moveX = Math.abs(ax) > 0.45 ? Math.sign(ax) : 0;
      i.moveY = Math.abs(ay) > 0.65 ? Math.sign(ay) : 0;
      b.hold = 0;
    }
    break;
  }
  if (threat < 0) { b.threatId = -1; b.threatTime = 0; }

  if (!target) return i;
  // Hard bots take a clear drop onto a target rather than stopping to draw their bow.
  const tx = delta(f.x, target.x, WIDTH), ty = delta(f.y, target.y, HEIGHT);
  // Easy bots keep their route: the pulse already separates the attacker, and
  // retreating too abandons their slow next shot. Hard bots retain tactical peel.
  // Mizu retains the observed-projectile dodge above, leaving a ward in that lane.
  if (f.character === 1 && f.dashCooldown <= 0 && !f.charging && !i.dash &&
      Math.hypot(tx, ty) < STORM_GUST_RADIUS && clearShot(w, f, tx / (Math.hypot(tx, ty) || 1), ty / (Math.hypot(tx, ty) || 1), Math.hypot(tx, ty) / ARROW_SPEED)) {
    i.dash = true; if(w.options.difficulty!=='easy')i.moveX = -Math.sign(tx) || f.facing; i.moveY = 0;
  }
  if (w.options.difficulty === 'hard' && !i.dash && !f.grounded && f.vy >= 0 && ty > 0.6 && ty < 3.5 && Math.abs(tx) < 1.1) {
    let clearDrop = true;
    for (let y = 0.55; y < ty; y += 0.25) if (solid(w.level, f.x, f.y + y)) clearDrop = false;
    if (clearDrop) {
      i.moveX = Math.abs(tx) > 0.15 ? Math.sign(tx) : 0; i.moveY = 1;
      i.jump = i.jumpHeld = false; b.hold = 0; f.charging = false;
      return i;
    }
  }
  // Ballistic lead constrained to the same eight directions available to humans.
  const flight = Math.hypot(tx, ty) / ARROW_SPEED;
  const leadX = tx + target.vx * flight * 0.65;
  const gravity = f.inventory?.[0] === 'bolt' ? BOLT_GRAVITY : ARROW_GRAVITY;
  const leadY = ty + target.vy * flight * 0.55 - gravity * flight * flight / 2;
  const angle = Math.round((Math.atan2(leadY, leadX) + b.aimError) / (Math.PI / 4)) * Math.PI / 4;
  const hard = w.options.difficulty === 'hard';
  const prediction = hard && !i.dash && f.ammo > 0 && (f.charging || (b.shootTimer <= 0 && b.travelled >= 2.5)) ? predictShot(w, f, target) : null;
  // Easy/normal commit to the visible draw, rather than tracking a dodge at 120 Hz.
  const committed = !hard && f.charging;
  const aimX = committed ? b.drawX : prediction?.aimX ?? Math.round(Math.cos(angle) * 1000) / 1000;
  const aimY = committed ? b.drawY : prediction?.aimY ?? Math.round(Math.sin(angle) * 1000) / 1000;
  if (f.inventory?.[0] === 'bomb' && !safeBombShot(w, f, aimX, aimY)) {
    // Cancel, don't release: updateBow interprets a released hold as a real shot.
    b.hold = 0; f.charging = false; b.shootTimer = Math.max(b.shootTimer, 0.3);
    return i;
  }
  const miss = Math.abs(leadX * aimY - leadY * aimX);
  const range = b.shots === 0 && !hard ? 6.5 : settings.range;
  const canHit = hard ? prediction !== null : miss < 0.85 && clearShot(w, f, aimX, aimY, flight);
  if (!i.dash && !f.charging && f.ammo > 0 && b.shootTimer <= 0 && b.travelled >= 2.5 &&
      target.invulnerable <= 0 && Math.hypot(tx, ty) < range && canHit) {
    b.hold = settings.draw; b.drawX = aimX; b.drawY = aimY;
    b.shootTimer = settings.delay + random(w) * 0.8;
    b.travelled = 0; b.shots++;
    i.shoot = true;
  }
  if (!i.dash && (b.hold > 0 || f.charging)) {
    i.moveX = Math.abs(aimX) < 0.1 ? 0 : Math.sign(aimX);
    i.moveY = Math.abs(aimY) < 0.1 ? 0 : Math.sign(aimY);
    b.hold = Math.max(0, b.hold - DT); i.shootHeld = b.hold > 0;
  }
  return i;
}
