import { DT, random } from './world.ts';
import type { World, Fighter } from './world.ts';
import { emptyIntent, clearIntent } from './input.ts';
import type { Intent } from './input.ts';
import { delta, wrap, solid, platformAt, nextPlatform, WIDTH, HEIGHT } from './level.ts';
import { ARROW_GRAVITY, ARROW_SPEED } from './arrows.ts';
export interface Brain {
  intent: Intent; reaction: number; target: number; aimError: number; shootTimer: number;
  hold: number; jumpHold: number; stuck: number; lastX: number; lastY: number;
  navigation: number; waypointX: number; waypointY: number; escape: number;
}
export function createBrain(): Brain {
  return { intent: emptyIntent(), reaction: 0, target: -1, aimError: 0, shootTimer: 0.3,
    hold: 0, jumpHold: 0, stuck: 0, lastX: 0, lastY: 0, navigation: 0, waypointX: 0, waypointY: 0, escape: 0 };
}
const tuning = {
  easy: { reaction: 0.32, error: 0.22, delay: 1.05, dodge: 1.0 },
  normal: { reaction: 0.16, error: 0.09, delay: 0.62, dodge: 1.9 },
  hard: { reaction: 0.07, error: 0.025, delay: 0.35, dodge: 2.7 },
};
function clearShot(w: World, f: Fighter, dx: number, dy: number, time: number): boolean {
  for (let t = 0.025; t < time; t += 0.025) {
    if (solid(w.level, f.x + dx * ARROW_SPEED * t, f.y + dy * ARROW_SPEED * t + ARROW_GRAVITY * t * t / 2)) return false;
  }
  return true;
}
export function think(w: World, f: Fighter): Intent {
  const b = f.brain, i = b.intent, settings = tuning[w.options.difficulty];
  clearIntent(i);
  b.reaction -= DT; b.navigation -= DT; b.shootTimer -= DT;
  b.jumpHold = Math.max(0, b.jumpHold - DT); b.escape = Math.max(0, b.escape - DT);
  if (b.reaction <= 0 || b.target < 0 || !w.fighters[b.target]?.alive) {
    b.reaction = settings.reaction;
    b.aimError = (random(w) - 0.5) * settings.error;
    let nearest = Infinity;
    for (const target of w.fighters) {
      if (!target.alive || target === f) continue;
      const d = Math.hypot(delta(f.x, target.x, WIDTH), delta(f.y, target.y, HEIGHT));
      if (d < nearest) { nearest = d; b.target = target.id; }
    }
    const moved = Math.hypot(delta(b.lastX, f.x, WIDTH), delta(b.lastY, f.y, HEIGHT));
    b.stuck = moved < 0.16 ? b.stuck + settings.reaction : 0;
    b.lastX = f.x; b.lastY = f.y;
  }
  const target = w.fighters[b.target];
  if (!target?.alive) return i;
  let goalX = target.x, goalY = target.y;
  if (f.ammo === 0) {
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
      // Descend via an actual edge, not by pressing down into a solid tile.
      if (next.y > from.y && f.grounded) {
        const right = delta(f.x, next.left + 0.5, WIDTH) >= 0;
        b.waypointX = wrap(right ? from.right + 0.7 : from.left - 0.7, WIDTH);
        b.waypointY = next.y - 0.55;
      } else { b.waypointX = (next.left + next.right) / 2; b.waypointY = next.y - 0.55; }
    }
  }
  const dx = delta(f.x, b.waypointX, WIDTH), dy = b.waypointY - f.y;
  i.moveX = Math.abs(dx) > 0.25 ? Math.sign(dx) : Math.sign(goalDX);
  if (f.grounded && ((dy < -0.8 && Math.abs(dx) < 7) || (Math.abs(goalDX) < 2.2 && goalDY >= -1))) {
    i.jump = true; b.jumpHold = 0.55;
  }
  if (f.wall && b.jumpHold < 0.15) { i.jump = true; b.jumpHold = 0.48; }
  if (goalDY > 2 && Math.abs(goalDX) < 1.2 && !f.grounded) { i.moveY = 1; i.moveX = 0; }
  if (b.stuck > 0.7) { b.escape = 0.5; b.stuck = 0; i.jump = true; b.jumpHold = 0.6; }
  if (b.escape > 0) { i.moveX = f.wall ? -f.wall : (f.id % 2 ? 1 : -1); i.dash = f.dashCooldown <= 0; }
  i.jumpHeld = b.jumpHold > 0;

  // Reaction-rate threat sensing, not omniscient per-frame evasion.
  if (b.reaction >= settings.reaction - DT * 1.5 && f.dashCooldown <= 0) {
    for (const a of w.arrows) {
      if (a.stuck || (a.owner === f.id && a.age < 0.18)) continue;
      const ax = delta(f.x, a.x, WIDTH), ay = delta(f.y, a.y, HEIGHT);
      if (Math.hypot(ax, ay) < settings.dodge && ax * a.vx + ay * a.vy < 0) {
        i.dash = true; i.moveX = Math.sign(ax); i.moveY = Math.abs(ay) > 0.7 ? Math.sign(ay) : 0; break;
      }
    }
  }

  // Ballistic lead constrained to the same eight directions available to humans.
  const tx = delta(f.x, target.x, WIDTH), ty = delta(f.y, target.y, HEIGHT);
  const flight = Math.hypot(tx, ty) / ARROW_SPEED;
  const leadX = tx + target.vx * flight * 0.65;
  const leadY = ty + target.vy * flight * 0.55 - ARROW_GRAVITY * flight * flight / 2;
  const angle = Math.round((Math.atan2(leadY, leadX) + b.aimError) / (Math.PI / 4)) * Math.PI / 4;
  const aimX = Math.round(Math.cos(angle) * 1000) / 1000, aimY = Math.round(Math.sin(angle) * 1000) / 1000;
  const miss = Math.abs(leadX * aimY - leadY * aimX);
  if (!i.dash && f.ammo > 0 && b.shootTimer <= 0 && Math.hypot(tx, ty) < 15 && miss < 0.85 && clearShot(w, f, aimX, aimY, flight)) {
    b.hold = 0.10 + settings.reaction * 0.25;
    b.shootTimer = settings.delay + random(w) * 0.35;
    i.shoot = true;
  }
  if (b.hold > 0 || f.charging) {
    i.moveX = Math.abs(aimX) < 0.1 ? 0 : Math.sign(aimX);
    i.moveY = Math.abs(aimY) < 0.1 ? 0 : Math.sign(aimY);
    b.hold = Math.max(0, b.hold - DT); i.shootHeld = b.hold > 0;
  }
  return i;
}
